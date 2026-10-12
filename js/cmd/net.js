/* Linux Awakening — networking commands (a tiny simulated LAN). */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const U = LA.util;
  const VFS = LA.VFS;
  const def = LA.def;

  /* the host key fingerprint ssh shows on first contact */
  LA.hostFingerprint = (ip) => 'SHA256:' + U.b64encode(U.sha256(ip)).slice(0, 43);

  const OUTSIDE = /\.(com|org|net|io|dev|edu|gov|uk|de)$|^(www\.)?(google|github|example|wikipedia)/;

  /* the DNS server this host asks: the first nameserver line of /etc/resolv.conf */
  const nameserver = (ctx) => {
    const n = ctx.fs.tryGet('/etc/resolv.conf');
    const m = n && ctx.fs.contentOf(n).match(/^nameserver\s+(\S+)/m);
    return m ? m[1] : '127.0.0.53';
  };
  def('ping', {
    interruptible: true,
    async run(ctx) {
      const args = ctx.args;
      let count = null, interval = 1, quiet = false;
      let target = null;
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-c') count = parseInt(args[++i], 10);
        else if (/^-c\d+$/.test(a)) count = parseInt(a.slice(2), 10);
        else if (a === '-i') interval = parseFloat(args[++i]);
        else if (a === '-q') quiet = true;
        else if (a === '-W' || a === '-w' || a === '-s') i++;
        else if (!a.startsWith('-')) target = a;
      }
      if (!target) { ctx.err.write('ping: usage error: Destination address required\n'); return 1; }
      const world = ctx.world;
      const h = world.resolve(target, ctx.host);
      if (!h) {
        ctx.err.write(OUTSIDE.test(target) ? `ping: ${target}: Temporary failure in name resolution\n` : `ping: ${target}: Name or service not known\n`);
        if (ctx.game && OUTSIDE.test(target)) ctx.game.onOutside(target);
        return 2;
      }
      const label = h.fqdn && h.fqdn !== h.ip ? `${h.fqdn} (${h.ip})` : h.ip;
      ctx.println(`PING ${h.fqdn || h.ip} (${h.ip}) 56(84) bytes of data.`);
      if (count === null && !ctx.isTTY) count = 4;
      const max = count === null ? 200 : count;
      const times = [];
      let sent = 0;
      const t0 = LA.now();
      for (let seq = 1; seq <= max; seq++) {
        sent++;
        if (h.up && h.icmp === false) { /* silently dropped by a firewall */ }
        else if (h.up) {
          const t = h.latency * (0.85 + Math.random() * 0.3);
          times.push(t);
          if (!quiet) ctx.println(`64 bytes from ${label}: icmp_seq=${seq} ttl=64 time=${t.toFixed(3)} ms`);
        } else if (!quiet) ctx.println(`From ${ctx.host.ip} icmp_seq=${seq} Destination Host Unreachable`);
        if (seq < max) { const ok = await ctx.sleep(interval * 1000); if (!ok) break; }
      }
      const recv = times.length;
      const loss = Math.round(((sent - recv) / sent) * 100);
      ctx.println(`\n--- ${h.fqdn || h.ip} ping statistics ---`);
      ctx.println(`${sent} packets transmitted, ${recv} received, ${h.up ? '' : `+${sent} errors, `}${loss}% packet loss, time ${Math.max(0, (sent - 1) * 1000 + Math.round((LA.now() - t0) % 7))}ms`);
      if (recv) {
        const min = Math.min(...times), maxT = Math.max(...times), avg = times.reduce((a, b) => a + b, 0) / recv;
        const mdev = Math.sqrt(times.reduce((a, b) => a + (b - avg) * (b - avg), 0) / recv);
        ctx.println(`rtt min/avg/max/mdev = ${min.toFixed(3)}/${avg.toFixed(3)}/${maxT.toFixed(3)}/${mdev.toFixed(3)} ms`);
      }
      if (ctx.game) ctx.game.onPing(h);
      return recv ? 0 : 1;
    },
  });

  function parseUrl(u) {
    let m = u.match(/^(https?|ftp):\/\/([^/:?#]+)(?::(\d+))?([^?#]*)?(\?[^#]*)?/i);
    if (!m) { m = u.match(/^([^/:?#]+)(?::(\d+))?(\/[^?#]*)?(\?[^#]*)?$/); if (!m) return null; return { scheme: 'http', host: m[1], port: m[2], path: m[3] || '/', query: m[4] || '' }; }
    return { scheme: m[1].toLowerCase(), host: m[2], port: m[3], path: m[4] || '/', query: m[5] || '' };
  }

  function fetch(ctx, url) {
    const u = parseUrl(url);
    if (!u) return { err: 3, msg: `curl: (3) URL using bad/illegal format or missing URL` };
    const h = ctx.world.resolve(u.host, ctx.host);
    if (!h) {
      if (ctx.game && OUTSIDE.test(u.host)) ctx.game.onOutside(u.host);
      return { err: 6, msg: `curl: (6) Could not resolve host: ${u.host}` };
    }
    if (!h.up || !h.http) return { err: 7, msg: `curl: (7) Failed to connect to ${u.host} port ${u.port || (u.scheme === 'https' ? 443 : 80)} after ${Math.floor(Math.random() * 5) + 1} ms: Couldn't connect to server`, h, u };
    const res = ctx.world.httpGet(h, u.path);
    return { h, u, res };
  }
  LA.httpFetch = fetch;

  def('curl', {
    async run(ctx) {
      const args = ctx.args;
      let silent = false, head = false, include = false, outFile = null, remoteName = false, fail = false, verbose = false, showErr = false;
      let url = null;
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a.startsWith('--')) {
          if (a === '--silent') silent = true;
          else if (a === '--head') head = true;
          else if (a === '--include') include = true;
          else if (a === '--output') outFile = args[++i];
          else if (a === '--remote-name') remoteName = true;
          else if (a === '--fail') fail = true;
          else if (a === '--location') { /* follow */ }
          else if (a === '--verbose') verbose = true;
          continue;
        }
        if (a.startsWith('-') && a.length > 1) {
          for (let k = 1; k < a.length; k++) {
            const c = a[k];
            if (c === 's') silent = true;
            else if (c === 'S') showErr = true;
            else if (c === 'I') head = true;
            else if (c === 'i') include = true;
            else if (c === 'L') { /* follow redirects */ }
            else if (c === 'O') remoteName = true;
            else if (c === 'f') fail = true;
            else if (c === 'v') verbose = true;
            else if (c === 'k') { /* insecure */ }
            else if (c === 'o') { outFile = a.slice(k + 1) || args[++i]; break; }
            else if ('XHdA'.includes(c)) { if (!a.slice(k + 1)) i++; break; }
          }
          continue;
        }
        url = a;
      }
      if (!url) { ctx.err.write("curl: try 'curl --help' or 'curl --manual' for more information\n"); return 2; }
      const r = fetch(ctx, url);
      if (r.err) { if (!silent || showErr) ctx.err.write(r.msg + '\n'); return r.err; }
      const { res, h, u } = r;
      if (verbose) {
        ctx.err.write(`*   Trying ${h.ip}:80...\n* Connected to ${u.host} (${h.ip}) port 80 (#0)\n> GET ${u.path} HTTP/1.1\n> Host: ${u.host}\n> User-Agent: curl/7.88.1\n> Accept: */*\n>\n< HTTP/1.1 ${res.status} ${res.status === 200 ? 'OK' : 'Not Found'}\n`);
      }
      const len = res.binary ? 2048 : U.utf8len(res.body);
      const headers = `HTTP/1.1 ${res.status} ${res.status === 200 ? 'OK' : 'Not Found'}\r\nServer: ${ctx.world.sys.web}\r\nDate: ${new Date(LA.now()).toUTCString()}\r\nContent-Type: ${res.type || 'text/plain'}; charset=utf-8\r\nContent-Length: ${len}\r\n\r\n`;
      if (head) { ctx.print(headers.replace(/\r/g, '')); return 0; }
      if (fail && res.status >= 400) { if (!silent || showErr) ctx.err.write(`curl: (22) The requested URL returned error: ${res.status}\n`); return 22; }
      if (remoteName && !outFile) outFile = VFS.basename(u.path) || 'index.html';
      if (outFile) {
        try {
          const abs = ctx.abs(outFile);
          if (res.binary) ctx.fs.writeFile(abs, '', { user: ctx.user, umask: ctx.shell.umask, binary: res.binary });
          else ctx.fs.writeFile(abs, res.body, { user: ctx.user, umask: ctx.shell.umask });
        } catch (e) { ctx.err.write(`curl: (23) Failure writing output to destination\n`); return 23; }
        if (!silent) ctx.err.write(`  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current\n                                 Dload  Upload   Total   Spent    Left  Speed\n100 ${U.padL(len, 5)}  100 ${U.padL(len, 5)}    0     0   ${U.padL(Math.round(len / 1.2) + 'k', 5)}      0 --:--:-- --:--:-- --:--:-- ${U.padL(Math.round(len / 1.2) + 'k', 5)}\n`);
        if (ctx.game) ctx.game.onDownload(ctx.abs(outFile), url);
        return 0;
      }
      if (include) ctx.print(headers.replace(/\r/g, ''));
      if (res.binary) {
        if (ctx.isTTY) { ctx.err.write('Warning: Binary output can mess up your terminal. Use "--output -" to tell\nWarning: curl to output it to your terminal anyway, or consider "--output\nWarning: <FILE>" to save to a file.\n'); return 23; }
        ctx.print(U.garbage(42, 200));
        return 0;
      }
      ctx.print(res.body);
      if (ctx.game) ctx.game.onCurl(url, res);
      return 0;
    },
  });

  def('wget', {
    async run(ctx) {
      const args = ctx.args;
      let out = null, quiet = false, url = null;
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-O' || a === '--output-document') out = args[++i];
        else if (/^-O./.test(a)) out = a.slice(2);
        else if (a === '-q' || a === '--quiet') quiet = true;
        else if (a.startsWith('-')) continue;
        else url = a;
      }
      if (!url) { ctx.err.write("wget: missing URL\nUsage: wget [OPTION]... [URL]...\n\nTry `wget --help' for more options.\n"); return 1; }
      const stamp = () => U.stamp(LA.now());
      const r = fetch(ctx, url);
      const u = parseUrl(url);
      const full = u ? `${u.scheme}://${u.host}${u.path}` : url;
      if (!quiet) ctx.err.write(`--${stamp()}--  ${full}\n`);
      if (r.err === 6) { if (!quiet) ctx.err.write(`Resolving ${u.host} (${u.host})... failed: Name or service not known.\nwget: unable to resolve host address ‘${u.host}’\n`); return 4; }
      if (r.err) { if (!quiet) ctx.err.write(`Connecting to ${u.host}... failed: Connection refused.\n`); return 4; }
      const { res, h } = r;
      if (!quiet) {
        ctx.err.write(`Resolving ${u.host} (${u.host})... ${h.ip}\nConnecting to ${u.host} (${u.host})|${h.ip}|:80... connected.\nHTTP request sent, awaiting response... `);
        await ctx.sleep(150);
      }
      if (res.status !== 200) { if (!quiet) ctx.err.write(`${res.status} Not Found\n${stamp()} ERROR ${res.status}: Not Found.\n\n`); return 8; }
      const len = res.binary ? 2048 : U.utf8len(res.body);
      let name = out || VFS.basename(u.path) || 'index.html';
      if (!out) { let k = 1; const base = name; while (ctx.fs.tryGet(ctx.abs(name), ctx.user)) name = `${base}.${k++}`; }
      if (!quiet) ctx.err.write(`200 OK\nLength: ${len} (${U.human(len)}) [${res.type || 'text/plain'}]\nSaving to: ‘${name}’\n\n`);
      try {
        if (name === '-') { ctx.print(res.body); return 0; }
        const abs = ctx.abs(name);
        if (res.binary) ctx.fs.writeFile(abs, '', { user: ctx.user, umask: ctx.shell.umask, binary: res.binary });
        else ctx.fs.writeFile(abs, res.body, { user: ctx.user, umask: ctx.shell.umask });
      } catch (e) { ctx.err.write(`${name}: ${e.message}\n\nCannot write to ‘${name}’ (${e.message}).\n`); return 3; }
      if (!quiet) {
        await ctx.sleep(200);
        ctx.err.write(`${U.padR(name, 20)} 100%[===================>]  ${U.padL(U.human(len), 6)}  --.-KB/s    in 0s      \n\n${stamp()} (${(Math.random() * 80 + 20).toFixed(1)} MB/s) - ‘${name}’ saved [${len}/${len}]\n\n`);
      }
      if (ctx.game) ctx.game.onDownload(ctx.abs(name), url);
      return 0;
    },
  });

  /* ---------- ssh / scp ---------- */
  async function sshConnect(ctx, spec, opts = {}) {
    const m = spec.match(/^(?:([^@]+)@)?(.+)$/);
    const ruser = opts.user || m[1] || ctx.user;
    const hostName = m[2];
    const world = ctx.world;
    const h = world.resolve(hostName, ctx.host);
    if (!h) { ctx.err.write(`ssh: Could not resolve hostname ${hostName}: Name or service not known\n`); return { code: 255 }; }
    if (!h.up) { ctx.err.write(`ssh: connect to host ${h.ip} port 22: No route to host\n`); return { code: 255 }; }
    const remote = world.hosts[h.hostKey];
    if (!remote || !h.ssh) { ctx.err.write(`ssh: connect to host ${hostName} port 22: Connection refused\n`); return { code: 255 }; }
    const home = ctx.shell.home;
    const kh = VFS.join(home, '.ssh/known_hosts');
    const known = ctx.fs.tryGet(kh, ctx.user);
    const knownText = known ? ctx.fs.contentOf(known) : '';
    /* the key this host presents; known_hosts remembers it per name */
    const hostKey = `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${U.b64encode(h.ip + ':' + (h.hostKey || '')).replace(/=/g, '')}`;
    const entry = knownText.split('\n').find((l) => l.split(' ')[0].split(',').includes(hostName));
    /* (saves from older versions remembered keys in a shorter form; accept those for the same address) */
    const legacy = entry && (entry.split(' ')[2] || '').startsWith('AAAAC3NzaC1lZDI1NTE5AAAAI' + U.b64encode(h.ip).replace(/=/g, ''));
    if (entry && !legacy && entry.split(' ').slice(1, 3).join(' ') !== hostKey) {
      ctx.err.write(`@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
IT IS POSSIBLE THAT SOMEONE IS DOING SOMETHING NASTY!
Someone could be eavesdropping on you right now (man-in-the-middle attack)!
It is also possible that a host key has just been changed.
The fingerprint for the ED25519 key sent by the remote host is
${LA.hostFingerprint(h.ip)}.
Offending ED25519 key in ${kh}
Host key for ${hostName} has changed and you have requested strict checking.
Host key verification failed.
`);
      return { code: 255 };
    }
    if (!entry) {
      ctx.err.write(`The authenticity of host '${hostName} (${h.ip})' can't be established.\nED25519 key fingerprint is ${LA.hostFingerprint(h.ip)}.\nThis key is not known by any other names.\n`);
      let ans = await ctx.ui.prompt('Are you sure you want to continue connecting (yes/no/[fingerprint])? ', { signal: ctx.signal });
      while (ans !== null && !/^(yes|no)$/i.test(ans.trim()) && ans.trim() !== LA.hostFingerprint(h.ip)) ans = await ctx.ui.prompt("Please type 'yes', 'no' or the fingerprint: ", { signal: ctx.signal });
      if (ans === null || /^no$/i.test(ans.trim())) { ctx.err.write('Host key verification failed.\n'); return { code: 255 }; }
      try {
        if (!ctx.fs.tryGet(VFS.join(home, '.ssh'), ctx.user)) ctx.fs.mkdir(VFS.join(home, '.ssh'), { user: ctx.user, mode: 0o700, umask: 0 });
        ctx.fs.writeFile(kh, `${hostName} ${hostKey}\n`, { user: ctx.user, append: true, umask: 0o077 });
      } catch (e) { /* ignore */ }
      ctx.err.write(`Warning: Permanently added '${hostName}' (ED25519) to the list of known hosts.\n`);
    }
    const ru = remote.users.get(ruser);
    let ok = false;
    if (ru) {
      const pubNode = ctx.fs.tryGet(VFS.join(home, '.ssh/id_ed25519.pub'), ctx.user);
      const privNode = ctx.fs.tryGet(VFS.join(home, '.ssh/id_ed25519'), ctx.user);
      const ak = remote.fs.tryGet(VFS.join(ru.home, '.ssh/authorized_keys'));
      /* a locked password («usermod -L», «passwd -l») doesn't stop a key login — that needs the key removed */
      if (pubNode && privNode && ak) {
        const key = ctx.fs.contentOf(pubNode).trim().split(/\s+/).slice(0, 2).join(' ');
        ok = remote.fs.contentOf(ak).split('\n').some((l) => l.trim().split(/\s+/).slice(0, 2).join(' ') === key);
      }
    }
    if (!ok) {
      for (let t = 0; t < 3 && !ok; t++) {
        const pw = await ctx.ui.prompt(`${ruser}@${hostName}'s password: `, { hidden: true, signal: ctx.signal });
        if (pw === null) return { code: 255 };
        if (ru && !ru.locked && world.checkPassword(ruser, pw, remote)) ok = true;
        else if (t < 2) ctx.err.write('Permission denied, please try again.\n');
      }
      if (!ok) { ctx.err.write(`${ruser}@${hostName}: Permission denied (publickey,password).\n`); return { code: 255 }; }
    }
    return { ok: true, remote, ruser, hostName, h };
  }
  LA.sshConnect = sshConnect;

  def('ssh', {
    async run(ctx) {
      const args = ctx.args.slice();
      let user = null, target = null;
      const cmd = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (target === null) {
          if (a === '-p' || a === '-i' || a === '-o' || a === '-F') { i++; continue; }
          if (a === '-l') { user = args[++i]; continue; }
          if (a.startsWith('-')) continue;
          target = a;
        } else cmd.push(a);
      }
      if (!target) { ctx.err.write('usage: ssh [-46AaCfGgKkMNnqsTtVvXxYy] [-B bind_interface] [-b bind_address]\n           [-c cipher_spec] [-D [bind_address:]port] [-E log_file]\n           [-i identity_file] [-l login_name] [-p port] destination [command [argument ...]]\n'); return 255; }
      const c = await sshConnect(ctx, target, { user });
      if (!c.ok) return c.code;
      if (ctx.game) ctx.game.onSsh(c.hostName, c.ruser);
      if (cmd.length) {
        const sh = new LA.Shell({ host: c.remote, user: c.ruser, ui: ctx.ui, game: ctx.game, world: ctx.world, cwd: c.remote.users.get(c.ruser).home, interactive: false, spawn: false, recRoot: ctx.shell.recRoot, signal: ctx.signal });
        try { return await sh.execList(LA.parse(cmd.join(' '), null), ctx.io); }
        catch (e) { if (e instanceof LA.ExitSignal) return e.code; ctx.err.write(`bash: ${e.message}\n`); return 1; }
      }
      const banner = ctx.world.motd(c.remote, c.ruser);
      if (banner) ctx.print(banner);
      const code = await ctx.ui.pushShell({ user: c.ruser, login: true, host: c.remote, from: ctx.shell, remote: true, fromIp: ctx.host.ip });
      ctx.println(`Connection to ${c.hostName} closed.`);
      return code || 0;
    },
  });

  def('scp', {
    async run(ctx) {
      const args = ctx.args.filter((a) => !/^-[rpqCv]+$/.test(a));
      const recursive = ctx.args.some((a) => /^-[a-zA-Z]*r/.test(a));
      const quiet = ctx.args.some((a) => /^-[a-zA-Z]*q/.test(a));
      const clean = [];
      for (let i = 0; i < args.length; i++) { if (args[i] === '-P' || args[i] === '-i') { i++; continue; } clean.push(args[i]); }
      if (clean.length < 2) { ctx.err.write('usage: scp [-346ABCOpqRrsTv] [-c cipher] [-D sftp_server_path] [-F ssh_config]\n           [-i identity_file] [-J destination] [-l limit] [-o ssh_option]\n           [-P port] [-S program] [-X sftp_option] source ... target\n'); return 1; }
      const parse = (s) => { const m = s.match(/^(?:([^@/:]+)@)?([^/:]+):(.*)$/); return m ? { user: m[1], host: m[2], path: m[3] } : { path: s }; };
      const dst = parse(clean.pop());
      const endpoints = {};
      const open = async (spec) => {
        if (!spec.host) return { fs: ctx.fs, user: ctx.user, cwd: ctx.cwd };
        const key = (spec.user || ctx.user) + '@' + spec.host;
        if (!endpoints[key]) {
          const c = await sshConnect(ctx, key, { quiet: true });
          if (!c.ok) return null;
          endpoints[key] = { fs: c.remote.fs, user: c.ruser, cwd: c.remote.users.get(c.ruser).home };
        }
        return endpoints[key];
      };
      const dEnd = await open(dst);
      if (!dEnd) return 1;
      let st = 0;
      for (const s of clean.map(parse)) {
        const sEnd = await open(s);
        if (!sEnd) return 1;
        const sAbs = VFS.normalize(s.path || '.', sEnd.cwd);
        let node;
        try { node = sEnd.fs.get(sAbs, sEnd.user); }
        catch (e) { ctx.err.write(`scp: ${s.path}: ${e.message}\n`); st = 1; continue; }
        let dAbs = VFS.normalize(dst.path || '.', dEnd.cwd);
        const dnode = dEnd.fs.tryGet(dAbs, dEnd.user);
        if (dnode && dnode.type === 'dir') dAbs = VFS.join(dAbs, VFS.basename(sAbs));
        const copy = (srcNode, from, to) => {
          if (srcNode.type === 'dir') {
            if (!recursive) { ctx.err.write(`scp: ${from}: not a regular file\n`); st = 1; return; }
            if (!dEnd.fs.tryGet(to, dEnd.user)) dEnd.fs.mkdir(to, { user: dEnd.user, umask: 0o022 });
            for (const [n, c] of sEnd.fs.readdir(from, sEnd.user)) copy(c, VFS.join(from, n), VFS.join(to, n));
            return;
          }
          if (!sEnd.fs.can(srcNode, sEnd.user, 4)) { ctx.err.write(`scp: ${from}: Permission denied\n`); st = 1; return; }
          try {
            if (srcNode.format) dEnd.fs.writeFile(to, '', { user: dEnd.user, umask: 0o022, binary: { format: srcNode.format, data: JSON.parse(JSON.stringify(srcNode.data)) } });
            else dEnd.fs.writeFile(to, sEnd.fs.contentOf(srcNode), { user: dEnd.user, umask: 0o022 });
            if (!quiet) ctx.println(`${U.padR(VFS.basename(from), 45)} 100% ${U.padL(U.human(srcNode.size), 5)} ${U.padL((Math.random() * 900 + 100).toFixed(1), 6)}KB/s   00:00`);
            if (ctx.game) ctx.game.onScp(from, to, s.host || null, dst.host || null);
          } catch (e) { ctx.err.write(`scp: ${to}: ${e.message}\n`); st = 1; }
        };
        copy(node, sAbs, dAbs);
      }
      return st;
    },
  });

  /* ---------- interfaces & sockets ---------- */
  def('ip', {
    run(ctx) {
      const args = ctx.args.filter((a) => !a.startsWith('-'));
      const brief = ctx.args.includes('-br') || ctx.args.includes('-brief');
      const obj = args[0] || '';
      const ip = ctx.host.ip;
      const mac = ctx.host.mac || '52:54:00:1f:91:07';
      /* a host may describe its own interfaces and routes; otherwise it has one eth0 on a /24 */
      const net24 = ip.replace(/\.\d+$/, '');
      const ifaces = ctx.host.ifaces || [{ name: 'eth0', ip, prefix: 24, mac, up: true, brd: net24 + '.255' }];
      const routes = ctx.host.routes || [`default via ${net24}.1 dev eth0 proto dhcp src ${ip} metric 100 `, `${net24}.0/24 dev eth0 proto kernel scope link src ${ip} metric 100 `];
      const v6 = (m) => 'fe80::' + m.split(':').slice(3).join('').replace(/^(..)(..)(..)$/, '$1ff:fe$2:$3').replace(/^0+/, '') + '/64';
      if (!obj) { ctx.err.write('Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\nwhere  OBJECT := { address | link | route | neigh | ... }\n'); return 1; }
      const flags = (f) => (f.up ? (f.p2p ? '<POINTOPOINT,MULTICAST,NOARP,UP,LOWER_UP>' : '<BROADCAST,MULTICAST,UP,LOWER_UP>') : (f.p2p ? '<POINTOPOINT,MULTICAST,NOARP>' : '<BROADCAST,MULTICAST>'));
      const state = (f) => (f.up ? 'UP' : 'DOWN');
      if ('address'.startsWith(obj) || obj === 'a' || obj === 'addr') {
        if (brief) {
          ctx.println(`lo               UNKNOWN        127.0.0.1/8 ::1/128 `);
          for (const f of ifaces) ctx.println(`${U.padR(f.name, 16)} ${U.padR(state(f), 14)} ${f.up || f.keepAddr ? `${f.ip}/${f.prefix}` : ''} `);
          return 0;
        }
        let out = `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host noprefixroute
       valid_lft forever preferred_lft forever`;
        ifaces.forEach((f, i) => {
          out += `\n${i + 2}: ${f.name}: ${flags(f)} mtu ${f.mtu || 1500} qdisc ${f.up ? 'fq_codel' : 'noop'} state ${state(f)} group default qlen ${f.p2p ? 500 : 1000}`;
          out += f.p2p ? `\n    link/none ` : `\n    link/ether ${f.mac} brd ff:ff:ff:ff:ff:ff`;
          if (f.up || f.keepAddr) {
            out += `\n    inet ${f.ip}/${f.prefix} ${f.brd ? `brd ${f.brd} ` : ''}scope global ${f.p2p ? '' : 'dynamic '}${f.name}\n       valid_lft ${f.p2p ? 'forever' : '85974sec'} preferred_lft ${f.p2p ? 'forever' : '85974sec'}`;
            if (!f.p2p) out += `\n    inet6 ${v6(f.mac)} scope link\n       valid_lft forever preferred_lft forever`;
          }
        });
        ctx.println(out);
        if (ctx.game) ctx.game.noteIp();
        return 0;
      }
      if ('route'.startsWith(obj) || obj === 'r') { ctx.println(routes.join('\n')); if (ctx.game) ctx.game.note('route', {}); return 0; }
      if ('link'.startsWith(obj) || obj === 'l') {
        let out = `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default qlen 1000\n    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00`;
        ifaces.forEach((f, i) => { out += `\n${i + 2}: ${f.name}: ${flags(f)} mtu ${f.mtu || 1500} qdisc ${f.up ? 'fq_codel' : 'noop'} state ${state(f)} mode DEFAULT group default qlen 1000\n    ${f.p2p ? 'link/none ' : `link/ether ${f.mac} brd ff:ff:ff:ff:ff:ff`}`; });
        ctx.println(out);
        return 0;
      }
      if ('neighbour'.startsWith(obj) || obj === 'n') { ctx.println(ctx.host.neigh || `${net24}.1 dev eth0 lladdr 52:54:00:00:00:01 REACHABLE`); return 0; }
      ctx.err.write(`Object "${obj}" is unknown, try "ip help".\n`);
      return 1;
    },
  });

  def('ifconfig', {
    run(ctx) {
      ctx.println(`eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet ${ctx.host.ip}  netmask 255.255.255.0  broadcast 10.0.0.255
        inet6 fe80::5054:ff:fe1f:9107  prefixlen 64  scopeid 0x20<link>
        ether ${ctx.host.mac || '52:54:00:1f:91:07'}  txqueuelen 1000  (Ethernet)
        RX packets 104233  bytes 98234113 (93.6 MiB)
        TX packets 61822  bytes 8211931 (7.8 MiB)

lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536
        inet 127.0.0.1  netmask 255.0.0.0
        inet6 ::1  prefixlen 128  scopeid 0x10<host>
        loop  txqueuelen 1000  (Local Loopback)
`);
      return 0;
    },
  });

  function socketsFor(ctx) {
    return ctx.world.sockets.filter((s) => s.host === ctx.host.name);
  }
  def('ss', {
    run(ctx) {
      const f = ctx.args.filter((a) => a.startsWith('-')).join('').replace(/-/g, '');
      const tcp = f.includes('t'), udp = f.includes('u');
      const listen = f.includes('l'), all = f.includes('a'), proc = f.includes('p');
      let list = socketsFor(ctx);
      if (tcp || udp) list = list.filter((s) => (tcp && s.proto === 'tcp') || (udp && s.proto === 'udp'));
      if (listen) list = list.filter((s) => s.state === 'LISTEN' || s.state === 'UNCONN');
      else if (!all) list = list.filter((s) => s.state === 'ESTAB');
      const rows = [['Netid', 'State', 'Recv-Q', 'Send-Q', 'Local Address:Port', 'Peer Address:Port', 'Process']];
      for (const s of list) {
        let p = '';
        if (proc && (ctx.user === 'root' || s.user === ctx.user)) p = `users:(("${s.comm}",pid=${s.pid},fd=${s.fd || 3}))`;
        rows.push([s.proto, s.state, '0', s.state === 'LISTEN' ? '128' : '0', s.local, s.peer, p]);
      }
      const w = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
      for (const r of rows) ctx.println(r.map((c, i) => (i === 4 || i === 5 ? U.padL(c, w[i]) : U.padR(c, w[i]))).join(' ').replace(/\s+$/, ''));
      if (proc && ctx.user !== 'root' && list.some((s) => s.user !== ctx.user)) ctx.err.write(LA.paint(LA.ansi.gray, '(Not all processes could be identified; non-owned process info will not be shown — try sudo.)') + '\n');
      if (ctx.game) ctx.game.noteSockets(ctx.user === 'root' && proc);
      return 0;
    },
  });

  def('netstat', {
    run(ctx) {
      const f = ctx.args.join('').replace(/-/g, '');
      const listen = f.includes('l'), proc = f.includes('p');
      let list = socketsFor(ctx).filter((s) => (listen ? s.state === 'LISTEN' || s.state === 'UNCONN' : true));
      if (f.includes('t') && !f.includes('u')) list = list.filter((s) => s.proto === 'tcp');
      ctx.println(listen ? 'Active Internet connections (only servers)' : 'Active Internet connections (servers and established)');
      ctx.println(`Proto Recv-Q Send-Q Local Address           Foreign Address         State      ${proc ? ' PID/Program name' : ''}`);
      for (const s of list) {
        const st = s.state === 'ESTAB' ? 'ESTABLISHED' : s.state === 'UNCONN' ? '' : 'LISTEN';
        const p = proc ? (ctx.user === 'root' || s.user === ctx.user ? `${s.pid}/${s.comm}` : '-') : '';
        ctx.println(`${U.padR(s.proto, 5)} ${U.padL('0', 6)} ${U.padL('0', 6)} ${U.padR(s.local, 23)} ${U.padR(s.peer, 23)} ${U.padR(st, 11)} ${p}`);
      }
      if (ctx.game) ctx.game.noteSockets(ctx.user === 'root' && proc);
      return 0;
    },
  });

  /* ---------- DNS ---------- */
  def('dig', {
    run(ctx) {
      const short = ctx.args.includes('+short');
      let type = 'A', name = null, reverse = false;
      for (let i = 0; i < ctx.args.length; i++) {
        const a = ctx.args[i];
        if (a.startsWith('+') || a.startsWith('@')) continue;
        if (a === '-x') { reverse = true; continue; }
        if (a === '-t') { type = (ctx.args[++i] || 'A').toUpperCase(); continue; }
        if (/^(A|AAAA|MX|TXT|NS|CNAME|PTR|ANY)$/i.test(a) && name !== null) { type = a.toUpperCase(); continue; }
        if (/^(A|AAAA|MX|TXT|NS|CNAME|PTR)$/i.test(a) && name === null && ctx.args.length > 1) { type = a.toUpperCase(); continue; }
        name = a;
      }
      if (!name) name = '.';
      const answers = ctx.world.dns(name, reverse ? 'PTR' : type);
      const fq = reverse ? name.split('.').reverse().join('.') + '.in-addr.arpa.' : name.replace(/\.?$/, '.');
      if (ctx.game) ctx.game.onDns(name, answers);
      if (short) { for (const a of answers) ctx.println(a.data); return 0; }
      const status = answers.length ? 'NOERROR' : 'NXDOMAIN';
      let s = `\n; <<>> DiG ${LA.distro(ctx.world).dig} <<>> ${ctx.args.join(' ')}\n;; global options: +cmd\n;; Got answer:\n;; ->>HEADER<<- opcode: QUERY, status: ${status}, id: ${4000 + Math.floor(Math.random() * 999)}\n;; flags: qr aa rd ra; QUERY: 1, ANSWER: ${answers.length}, AUTHORITY: ${answers.length ? 0 : 1}, ADDITIONAL: 1\n\n;; QUESTION SECTION:\n;${fq}\t\t\tIN\t${reverse ? 'PTR' : type}\n\n`;
      if (answers.length) {
        s += ';; ANSWER SECTION:\n';
        for (const a of answers) s += `${fq}\t3600\tIN\t${a.type}\t${a.data}\n`;
        s += '\n';
      } else { const dm = ctx.world.sys.domain; s += `;; AUTHORITY SECTION:\n${dm}.\t\t3600\tIN\tSOA\tns.${dm}. admin.${dm}. ${ctx.world.sys.build} 3600 600 86400 3600\n\n`; }
      s += `;; Query time: ${Math.floor(Math.random() * 3) + 1} msec\n;; SERVER: ${nameserver(ctx)}#53(${nameserver(ctx)}) (UDP)\n;; WHEN: ${U.dateString(new Date(LA.now()))}\n;; MSG SIZE  rcvd: ${48 + answers.length * 16}\n`;
      ctx.print(s);
      return 0;
    },
  });

  def('host', {
    run(ctx) {
      const name = ctx.args.find((a) => !a.startsWith('-'));
      if (!name) { ctx.err.write('Usage: host [-aCdilrTvVw] [-c class] [-N ndots] [-t type] [-W time]\n            [-R number] [-m flag] [-p port] hostname [server]\n'); return 1; }
      const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(name);
      const ans = ctx.world.dns(name, isIp ? 'PTR' : 'A');
      if (!ans.length) { ctx.println(`Host ${isIp ? name.split('.').reverse().join('.') + '.in-addr.arpa' : name} not found: 3(NXDOMAIN)`); return 1; }
      for (const a of ans) ctx.println(isIp ? `${name.split('.').reverse().join('.')}.in-addr.arpa domain name pointer ${a.data}` : `${a.name || name} has address ${a.data}`);
      if (ctx.game) ctx.game.onDns(name, ans);
      return 0;
    },
  });

  def('nslookup', {
    run(ctx) {
      const name = ctx.args.find((a) => !a.startsWith('-'));
      if (!name) { ctx.err.write('> (interactive mode is not supported here; try: nslookup HOSTNAME)\n'); return 1; }
      const ans = ctx.world.dns(name, 'A');
      ctx.println(`Server:\t\t${nameserver(ctx)}\nAddress:\t${nameserver(ctx)}#53\n`);
      if (!ans.length) { ctx.println(`** server can't find ${name}: NXDOMAIN\n`); return 1; }
      for (const a of ans) ctx.println(`Name:\t${a.name || name}\nAddress: ${a.data}\n`);
      if (ctx.game) ctx.game.onDns(name, ans);
      return 0;
    },
  });
})();
