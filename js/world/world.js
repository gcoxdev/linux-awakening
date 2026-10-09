/* Linux Awakening — the simulated machine(s): processes, services, network, accounts. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const U = LA.util;
  const VFS = LA.VFS;

  const PKG = {
    coreutils: { version: '9.1-1', desc: 'GNU core utilities', essential: true, cmds: [] },
    bash: { version: '5.2.15-2', desc: 'GNU Bourne Again SHell', essential: true, cmds: [] },
    grep: { version: '3.8-5', desc: 'GNU grep, egrep and fgrep', cmds: [] },
    sed: { version: '4.9-1', desc: 'GNU stream editor for filtering/transforming text', cmds: [] },
    gawk: { version: '1:5.2.1-2', desc: 'GNU awk, a pattern scanning and processing language', cmds: [] },
    tar: { version: '1.34+dfsg-1.2', desc: 'GNU version of the tar archiving utility', cmds: [] },
    gzip: { version: '1.12-1', desc: 'GNU compression utilities', cmds: [] },
    'zip': { version: '3.0-13', desc: 'Archiver for .zip files', cmds: [] },
    unzip: { version: '6.0-28', desc: 'De-archiver for .zip files', cmds: [] },
    nano: { version: '7.2-1', desc: 'small, friendly text editor inspired by Pico', cmds: [] },
    vim: { version: '2:9.0.1378-2', desc: 'Vi IMproved - enhanced vi editor', cmds: [] },
    curl: { version: '7.88.1-10', desc: 'command line tool for transferring data with URL syntax', cmds: [] },
    wget: { version: '1.21.3-1', desc: 'retrieves files from the web', cmds: [] },
    'openssh-client': { version: '1:9.2p1-2', desc: 'secure shell (SSH) client', cmds: [] },
    'openssh-server': { version: '1:9.2p1-2', desc: 'secure shell (SSH) server', cmds: [] },
    tree: { version: '2.1.0-1', desc: 'displays an indented directory tree, in color', cmds: [] },
    less: { version: '590-2', desc: 'pager program similar to more', cmds: [] },
    'man-db': { version: '2.11.2-2', desc: 'tools for reading manual pages', cmds: [] },
    procps: { version: '2:4.0.2-3', desc: '/proc file system utilities', cmds: [] },
    iproute2: { version: '6.1.0-3', desc: 'networking and traffic control tools', cmds: [] },
    dnsutils: { version: '1:9.18.19-1', desc: 'Clients provided with BIND 9', cmds: [] },
    sudo: { version: '1.9.13p3-1', desc: 'Provide limited super user privileges to specific users', cmds: [] },
    cron: { version: '3.0pl1-162', desc: 'process scheduling daemon', cmds: [] },
    bc: { version: '1.07.1-3', desc: 'GNU bc arbitrary precision calculator language', cmds: [] },
    lethe: { version: '3.0.3-rootfall', desc: 'nightly sweeper for temporary files and intruder droppings', section: 'admin', cmds: [] },
    neofetch: { version: '7.1.0-4', desc: 'Shows Linux System Information with Distribution Logo', cmds: ['neofetch'], size: '83.9 kB' },
    htop: { version: '3.2.2-2', desc: 'interactive processes viewer', cmds: ['htop'], size: '152 kB' },
    cowsay: { version: '3.03+dfsg2-8', desc: 'configurable talking cow', cmds: ['cowsay'], games: true, size: '18.6 kB' },
    'fortune-mod': { version: '1:1.99.1-7.3', desc: 'provides fortune cookies on demand', cmds: ['fortune'], games: true, size: '39.4 kB' },
    sl: { version: '5.02-1', desc: 'Correct you if you type `sl\' by mistake', cmds: ['sl'], games: true, size: '12.5 kB' },
    cmatrix: { version: '2.0-3', desc: 'simulates the display from "The Matrix"', cmds: ['cmatrix'], size: '17.4 kB' },
    fail2ban: { version: '1.0.2-2', desc: 'ban hosts that cause multiple authentication errors', cmds: ['fail2ban-client'], size: '386 kB', long: 'Monitors log files (e.g. /var/log/auth.log) and temporarily or persistently bans failure-prone addresses.' },
  };
  const INITIAL_PKGS = Object.keys(PKG).filter((k) => !PKG[k].cmds.length || ['coreutils'].includes(k));

  class World {
    constructor() {
      this.hosts = {};
      this.procs = [];
      this.nextPid = 2000;
      this.services = {};
      this.journal = [];
      this.sessions = [];
      this.wtmp = [];
      this.sockets = [];
      this.mounts = [];
      this.devices = {};
      this.disks = [];
      this.passwords = {};
      this.sudoStamps = {};
      this.packages = { installed: INITIAL_PKGS.slice(), available: PKG };
      this.dmesg = [];
      this.bootTime = LA.now() - (3 * 86400 + 2 * 3600 + 15 * 60) * 1000;
      this.flags = {};
      this.username = 'operator';
    }

    get rootfall() { return this.hosts.rootfall; }

    /* ---------- processes ---------- */
    peekPid() { return this.nextPid; }
    spawn(o) {
      const pid = o.pid || this.nextPid++;
      const p = Object.assign({
        pid, ppid: 1, user: 'root', comm: 'bash', args: null, tty: '?', stat: 'S', start: LA.now(),
        cpu: 0, mem: 0.1, vsz: 8000 + Math.floor(Math.random() * 4000), rss: 4000 + Math.floor(Math.random() * 2000), cputime: 0, host: 'rootfall',
      }, o, { pid });
      if (o.comm === 'bash' && !o.stat) p.stat = 'Ss+';
      this.procs.push(p);
      return pid;
    }
    transient(o) { const pid = this.spawn(Object.assign({ transient: true, stat: 'R+', cpu: 0 }, o)); return this.procs.find((p) => p.pid === pid); }
    reap(pid) { this.procs = this.procs.filter((p) => p.pid !== pid); }
    proc(pid) { return this.procs.find((p) => p.pid === pid); }

    signal(pid, sig, user, hostName, shell) {
      const p = this.procs.find((x) => x.pid === pid && x.host === hostName);
      if (!p) return 'ESRCH';
      if (user !== 'root' && p.user !== user) return 'EPERM';
      if (p.shell && shell && p.pid === shell.pid) return 'SELF';
      if (p.shell && !p.job) return 'SELF';
      if (pid === 1) return true;
      if (sig === 19 || sig === 20) { p.stat = 'T'; return true; }
      if (sig === 18) { p.stat = 'S'; return true; }
      if (sig === 10 || sig === 12 || sig === 17) return true;
      if (p.ignoreTERM && (sig === 15 || sig === 1 || sig === 2)) {
        this.log('rootfall', 'kernel', null, `${p.comm}[${p.pid}]: ignored signal ${sig}`, 'kernel', true);
        return true;
      }
      this.reap(pid);
      if (p.abort) p.abort();
      if (p.onKill && this.hooks[p.onKill]) this.hooks[p.onKill].call(this, p, sig);
      if (LA.game) LA.game.onProcKilled(p, sig);
      return true;
    }

    load() {
      const base = this.services.lethe && this.services.lethe.active ? 0.42 : 0.08;
      return [base, base * 0.9, base * 0.75].map((x) => (x + Math.random() * 0.05).toFixed(2));
    }
    memory() {
      const total = 2034688;
      const used = 845120 + Math.floor(Math.random() * 20000) + (this.services.lethe && this.services.lethe.active ? 61440 : 0);
      const cache = 729600;
      return { total, used, free: total - used - cache, shared: 1036, cache, avail: total - used, swap: 1048572 };
    }
    dfRows() {
      const rows = [
        { fs: 'udev', type: 'devtmpfs', size: 1003456, used: 0, mount: '/dev' },
        { fs: 'tmpfs', type: 'tmpfs', size: 203448, used: 1036, mount: '/run' },
        { fs: '/dev/sda1', type: 'ext4', size: 19480400, used: 7123456 + Math.floor(this.lethelogSize() / 1024), mount: '/' },
        { fs: 'tmpfs', type: 'tmpfs', size: 1017224, used: 0, mount: '/dev/shm' },
        { fs: 'tmpfs', type: 'tmpfs', size: 1017224, used: 48, mount: '/tmp' },
      ];
      for (const m of this.mounts) if (m.dev === '/dev/sdb1') rows.push({ fs: '/dev/sdb1', type: 'ext4', size: 2031440, used: 412332, mount: m.path });
      return rows;
    }
    lethelogSize() { const n = this.rootfall && this.rootfall.fs.tryGet('/var/log/lethe.log'); return n ? n.size : 0; }

    /* ---------- journal ---------- */
    log(host, ident, pid, msg, unit, quiet, t) {
      this.journal.push({ t: t || LA.now(), host, ident, pid, msg, unit: unit || ident });
      if (this.journal.length > 600) this.journal.splice(0, this.journal.length - 600);
    }
    logAuth(line) {
      const fs = this.rootfall.fs;
      const n = fs.tryGet('/var/log/auth.log');
      if (n) n.content += `${U.syslogDate(LA.now())} rootfall ${line}\n`;
      this.log('rootfall', 'sudo', null, line.replace(/^sudo: /, ''), 'sudo', true);
    }

    /* ---------- services ---------- */
    statusText(u, color) {
      const s = this.services[u];
      const c = (code, t) => (color ? code + t + '\x1b[0m' : t);
      const dot = s.active ? c('\x1b[1;32m', '●') : '○';
      const since = s.since || this.bootTime;
      const ago = LA.now() - since;
      const agoStr = ago > 86400000 ? `${Math.floor(ago / 86400000)} days ago` : ago > 3600000 ? `${Math.floor(ago / 3600000)}h ${Math.floor((ago % 3600000) / 60000)}min ago` : `${Math.max(1, Math.floor(ago / 60000))}min ago`;
      let out = `${dot} ${u}.service - ${s.desc}\n`;
      out += `     Loaded: loaded (${s.unit}; ${s.enabled ? 'enabled' : 'disabled'}; preset: enabled)\n`;
      out += `     Active: ${s.active ? c('\x1b[1;32m', 'active (running)') : 'inactive (dead)'} since ${U.DAY[new Date(since).getDay()]} ${U.stamp(since)} RFT; ${agoStr}\n`;
      if (s.active) {
        const p = this.proc(s.mainPid);
        out += `   Main PID: ${s.mainPid} (${s.comm})\n      Tasks: 1 (limit: 2283)\n     Memory: ${s.memory || '13.2M'}\n        CPU: ${s.cpuStr || '41min 3.112s'}\n     CGroup: /system.slice/${u}.service\n             └─${s.mainPid} ${p ? p.args || p.comm : s.exec}\n`;
      }
      const recent = this.journal.filter((e) => e.unit === u).slice(-6);
      if (recent.length) out += '\n' + recent.map((e) => `${U.syslogDate(e.t)} rootfall ${e.ident}${e.pid ? `[${e.pid}]` : ''}: ${e.msg}`).join('\n') + '\n';
      return out;
    }
    startService(u) {
      const s = this.services[u];
      if (s.active) return;
      const pid = this.spawn({ user: s.user || 'root', comm: s.comm, args: s.exec, tty: '?', stat: 'Ss', cpu: s.cpu || 0.3, mem: 0.6, host: 'rootfall', service: u, onKill: 'serviceDied' });
      s.mainPid = pid;
      s.active = true;
      s.since = LA.now();
      this.log('rootfall', 'systemd', 1, `Started ${u}.service - ${s.desc}.`, u);
      if (s.onStart && this.hooks[s.onStart]) this.hooks[s.onStart].call(this, s, pid);
      this.syncSockets();
    }
    stopService(u) {
      const s = this.services[u];
      if (!s.active) return;
      this.log('rootfall', 'systemd', 1, `Stopping ${u}.service - ${s.desc}...`, u);
      this.reap(s.mainPid);
      s.active = false;
      s.since = LA.now();
      this.log('rootfall', 'systemd', 1, `${u}.service: Deactivated successfully.`, u);
      this.log('rootfall', 'systemd', 1, `Stopped ${u}.service - ${s.desc}.`, u);
      this.syncSockets();
    }
    serviceAction(u, verb, now) {
      const s = this.services[u];
      const fs = this.rootfall.fs;
      const wants = `/etc/systemd/system/multi-user.target.wants/${u}.service`;
      switch (verb) {
        case 'start': this.startService(u); return '';
        case 'stop': this.stopService(u); return '';
        case 'restart': case 'reload': this.stopService(u); this.startService(u); return '';
        case 'enable':
          if (now) this.startService(u);
          if (s.enabled) return '';
          s.enabled = true;
          if (!fs.tryGet(wants, 'root', false)) fs.link(wants, s.unit);
          return `Created symlink ${wants} → ${s.unit}.\n`;
        case 'disable':
          if (now) this.stopService(u);
          if (!s.enabled) return '';
          s.enabled = false;
          fs.remove(wants);
          return `Removed "${wants}".\n`;
      }
      return '';
    }

    /* ---------- accounts ---------- */
    isSudoer(user, host) { return (host || this.rootfall).users.inGroup(user, 'sudo'); }
    sudoValid(user) { return this.sudoStamps[user] && LA.now() - this.sudoStamps[user] < 15 * 60000; }
    touchSudo(user) { this.sudoStamps[user] = LA.now(); }
    resetSudo(user) { delete this.sudoStamps[user]; }
    checkPassword(user, pw, host) {
      const h = host || this.rootfall;
      const tbl = this.passwords[h.name] || {};
      const u = h.users.get(user);
      if (!u || u.locked) return false;
      return tbl[user] !== undefined && tbl[user] === pw;
    }
    setPassword(user, pw, host) {
      const h = host || this.rootfall;
      this.passwords[h.name] = this.passwords[h.name] || {};
      this.passwords[h.name][user] = pw;
      this.resetSudo(user);
      this.syncAccounts(h);
    }
    syncAccounts(host) {
      const h = host || this.rootfall;
      const fs = h.fs;
      const users = h.users;
      const ulist = Object.entries(users.users).sort((a, b) => (a[1].order || a[1].uid) - (b[1].order || b[1].uid));
      const passwd = ulist.map(([n, u]) => `${n}:x:${u.uid}:${u.gid}:${u.gecos || ''}:${u.home}:${u.shell || '/bin/bash'}`).join('\n') + '\n';
      const shadow = ulist.map(([n, u]) => {
        const has = this.passwords[h.name] && this.passwords[h.name][n] !== undefined;
        const hash = has ? '$y$j9T$' + U.b64encode(U.sha256(n + (this.passwords[h.name][n] || ''))).slice(0, 22) + '$' + U.b64encode(U.md5(n)).slice(0, 20) : '*';
        return `${n}:${u.locked ? '!' : ''}${hash}:19634:0:99999:7:::`;
      }).join('\n') + '\n';
      const group = Object.entries(users.groups).sort((a, b) => a[1].gid - b[1].gid).map(([g, v]) => `${g}:x:${v.gid}:${v.members.join(',')}`).join('\n') + '\n';
      const set = (p, c) => { const n = fs.tryGet(p); if (n) n.content = c; };
      set('/etc/passwd', passwd);
      set('/etc/shadow', shadow);
      set('/etc/group', group);
    }

    /* ---------- disks ---------- */
    mountPointOf(dev) { const m = this.mounts.find((x) => x.dev === dev); return m ? m.path : null; }
    fstab() {
      return [{ dev: '/dev/sda1', path: '/' }, { dev: '/dev/sdb1', path: '/mnt/backup' }];
    }
    mount(dev, dir, ro) {
      const fs = this.rootfall.fs;
      const d = VFS.normalize(dir, '/');
      const key = dev.replace(/^\/dev\//, '');
      if (!this.devices[key]) return `mount: ${d}: special device ${dev} does not exist.\n       dmesg(1) may have more information after failed mount system call.\n`;
      const holder = (() => { try { return fs.walk(d, 'root', true).node; } catch (e) { return null; } })();
      if (!holder) return `mount: ${d}: mount point does not exist.\n       dmesg(1) may have more information after failed mount system call.\n`;
      if (this.mountPointOf(dev)) return `mount: ${d}: ${dev} already mounted on ${this.mountPointOf(dev)}.\n       dmesg(1) may have more information after failed mount system call.\n`;
      const w = fs.walk(VFS.dirname(d), 'root', true);
      const ph = w.node.children.get(VFS.basename(d));
      if (!ph || ph.type !== 'dir') return `mount: ${d}: mount point is not a directory.\n`;
      if (ph.mount) return `mount: ${d}: ${dev} already mounted or mount point busy.\n`;
      const root = this.devices[key];
      root.name = ph.name;
      root.parent = ph.parent;
      ph.mount = root;
      this.mounts.push({ dev, path: d, type: 'ext4', opts: ro ? 'ro,relatime' : 'rw,relatime' });
      this.dmesg.push({ s: (LA.now() - this.bootTime) / 1000, msg: `EXT4-fs (sdb1): mounted filesystem ${ro ? 'read-only ' : ''}with ordered data mode. Quota mode: none.` });
      this.log('rootfall', 'kernel', null, 'EXT4-fs (sdb1): mounted filesystem with ordered data mode. Quota mode: none.', 'kernel');
      return null;
    }
    umount(target, shells) {
      const m = this.mounts.find((x) => x.path === target || x.dev === target);
      if (!m) return `umount: ${target}: not mounted.\n`;
      if (m.path === '/') return 'umount: /: target is busy.\n';
      if ((shells || []).some((s) => s.cwd === m.path || s.cwd.startsWith(m.path + '/'))) return `umount: ${m.path}: target is busy.\n`;
      const fs = this.rootfall.fs;
      const w = fs.walk(VFS.dirname(m.path), 'root', true);
      const ph = w.node.children.get(VFS.basename(m.path));
      if (ph) delete ph.mount;
      this.mounts = this.mounts.filter((x) => x !== m);
      return null;
    }

    /* ---------- packages ---------- */
    installPackage(n) {
      const p = PKG[n];
      if (!this.packages.installed.includes(n)) this.packages.installed.push(n);
      const fs = this.rootfall.fs;
      for (const c of p.cmds) fs.put(`${p.games ? '/usr/games' : '/usr/bin'}/${c}`, '', { format: 'elf', data: { cmd: c }, mode: 0o755 });
      if (n === 'fail2ban') {
        fs.put('/etc/fail2ban/jail.local', '[sshd]\nenabled  = true\nport     = ssh\nlogpath  = /var/log/auth.log\nmaxretry = 3\nbantime  = 1h\n');
        this.services.fail2ban = { desc: 'Fail2Ban Service', unit: '/lib/systemd/system/fail2ban.service', active: false, enabled: true, comm: 'fail2ban-server', exec: '/usr/bin/python3 /usr/bin/fail2ban-server -xf start', cpu: 0.2 };
        this.startService('fail2ban');
        this.log('rootfall', 'fail2ban-server', this.services.fail2ban.mainPid, 'Server ready', 'fail2ban');
      }
    }
    removePackage(n) {
      const p = PKG[n];
      this.packages.installed = this.packages.installed.filter((x) => x !== n);
      for (const c of p.cmds) this.rootfall.fs.remove(`${p.games ? '/usr/games' : '/usr/bin'}/${c}`);
      if (n === 'fail2ban' && this.services.fail2ban) { this.stopService('fail2ban'); delete this.services.fail2ban; }
    }

    /* ---------- network ---------- */
    resolve(name, fromHost) {
      const n = String(name).toLowerCase().replace(/\.$/, '');
      if (n === 'localhost' || n === '127.0.0.1' || n === (fromHost && fromHost.name)) {
        const self = fromHost || this.rootfall;
        return { ip: n === 'localhost' || n === '127.0.0.1' ? '127.0.0.1' : self.ip, fqdn: n, up: true, latency: 0.03, hostKey: self.name, ssh: false, http: false };
      }
      for (const r of this.net) {
        if (r.names.includes(n) || r.ip === n) return Object.assign({ fqdn: r.fqdn || r.names[1] || r.names[0] || r.ip }, r);
      }
      if (/^10\.0\.0\.\d+$/.test(n)) return { ip: n, fqdn: n, up: false };
      return null;
    }
    dns(name, type) {
      const n = String(name).toLowerCase().replace(/\.$/, '');
      if (type === 'PTR') {
        const ip = n.replace(/\.in-addr\.arpa$/, '');
        const r = this.net.find((x) => x.ip === ip && x.ptr);
        return r ? [{ type: 'PTR', data: r.ptr + '.' }] : [];
      }
      if (type === 'TXT') { const t = (this.txt || {})[n]; return t ? [{ type: 'TXT', data: `"${t}"` }] : []; }
      const r = this.net.find((x) => x.names.includes(n));
      if (!r) return [];
      return [{ type: 'A', data: r.ip, name: r.names.includes(n) && n.includes('.') ? n : r.fqdn || r.names[1] || n }];
    }
    httpGet(h, path) {
      const site = this.http[h.hostKey] || {};
      const p = path.replace(/\/+$/, '') || '/';
      const r = site[p] || site[p + '/'];
      if (!r) return { status: 404, type: 'text/html', body: `<html>\n<head><title>404 Not Found</title></head>\n<body>\n<center><h1>404 Not Found</h1></center>\n<hr><center>lighthouse/1.0</center>\n</body>\n</html>\n` };
      return { status: 200, type: r.type || 'text/plain', body: typeof r.body === 'function' ? r.body(this) : r.body, binary: r.binary };
    }
    motd(host, user) {
      const fs = host.fs;
      const m = fs.tryGet('/etc/motd');
      const last = this.wtmp.filter((w) => w.host === host.name && w.user === user).sort((a, b) => b.at - a.at)[0];
      const lastLine = last ? `Last login: ${U.dateString(new Date(last.at)).replace(' RFT', '')} from ${last.from}\n` : '';
      return `Linux ${host.name} 6.1.0-rootfall #1 SMP PREEMPT_DYNAMIC x86_64\n` + (m ? fs.contentOf(m) : '') + lastLine;
    }
    addSession(o) { this.sessions.push(Object.assign({ at: LA.now() }, o)); this.wtmp.push(Object.assign({ at: LA.now() }, o)); }
    removeSession(pred) { this.sessions = this.sessions.filter((s) => !pred(s)); }

    syncSockets() {
      this.sockets = this.sockets.filter((s) => !s.pid || this.proc(s.pid) || s.static);
      if (this.services.fail2ban && this.services.fail2ban.active && !this.sockets.some((s) => s.comm === 'fail2ban-server')) {
        /* fail2ban has no listening socket; nothing to add */
      }
    }

    /* ---------- /proc ---------- */
    syncProc() {
      const host = this.rootfall;
      if (!host) return;
      const fs = host.fs;
      const procDir = fs.root.children.get('proc');
      if (!procDir) return;
      for (const [k, v] of [...procDir.children]) if (v.virtual) procDir.children.delete(k);
      const add = (parent, name, content, o = {}) => {
        const n = new LA.Node(o.dir ? 'dir' : 'file', name, { content, mode: o.mode || (o.dir ? 0o555 : 0o444), owner: o.owner || 'root', group: o.owner || 'root', mtime: this.bootTime });
        n.virtual = true;
        parent.children.set(name, n);
        n.parent = parent;
        return n;
      };
      for (const p of this.procs.filter((x) => x.host === 'rootfall')) {
        const d = add(procDir, String(p.pid), '', { dir: true, owner: p.user });
        add(d, 'cmdline', (p.args || p.comm).replace(/ /g, '\u0000') + '\n', { owner: p.user });
        add(d, 'comm', p.comm + '\n', { owner: p.user });
        add(d, 'status', `Name:\t${p.comm}\nState:\t${p.stat[0]} (${p.stat[0] === 'R' ? 'running' : p.stat[0] === 'T' ? 'stopped' : 'sleeping'})\nPid:\t${p.pid}\nPPid:\t${p.ppid}\nUid:\t${host.users.uid(p.user) ?? 0}\nVmRSS:\t${p.rss} kB\nThreads:\t1\n`, { owner: p.user });
        add(d, 'environ', (p.environ || `HOME=${(host.users.get(p.user) || {}).home || '/'}\u0000USER=${p.user}\u0000`) + '\n', { owner: p.user, mode: 0o400 });
        add(d, 'cwd', '', { owner: p.user, mode: 0o777 });
      }
      add(procDir, 'uptime', `${((LA.now() - this.bootTime) / 1000).toFixed(2)} ${((LA.now() - this.bootTime) / 1000 * 0.9).toFixed(2)}\n`);
      add(procDir, 'loadavg', `${this.load().join(' ')} 1/${this.procs.length} ${this.nextPid}\n`);
      add(procDir, 'version', 'Linux version 6.1.0-rootfall (operator@rootfall) (gcc (Debian 12.2.0-14) 12.2.0, GNU ld (GNU Binutils for Debian) 2.40) #1 SMP PREEMPT_DYNAMIC 1991\n');
      add(procDir, 'cpuinfo', 'processor\t: 0\nvendor_id\t: RootfallIntegrated\nmodel name\t: Kernel Works KW-1991 @ 2.40GHz\ncpu MHz\t\t: 2400.000\ncache size\t: 4096 KB\ncores\t\t: 2\n\nprocessor\t: 1\nvendor_id\t: RootfallIntegrated\nmodel name\t: Kernel Works KW-1991 @ 2.40GHz\ncpu MHz\t\t: 2400.000\ncache size\t: 4096 KB\ncores\t\t: 2\n');
      const m = this.memory();
      add(procDir, 'meminfo', `MemTotal:       ${m.total} kB\nMemFree:        ${m.free} kB\nMemAvailable:   ${m.avail} kB\nBuffers:          102400 kB\nCached:          ${m.cache - 102400} kB\nSwapTotal:      ${m.swap} kB\nSwapFree:       ${m.swap} kB\n`);
      add(procDir, 'mounts', this.mounts.map((x) => `${x.dev} ${x.path} ${x.type} ${x.opts} 0 0`).join('\n') + '\n');
      const self = add(procDir, 'self', '', { dir: true });
      void self;
    }

    tick() {
      for (const p of this.procs) p.cputime += p.cpu > 1 ? 0.7 : 0.01;
      this.syncProc();
    }

    /* ---------- save / load ---------- */
    serialize() {
      const hosts = {};
      for (const [k, h] of Object.entries(this.hosts)) {
        hosts[k] = { name: h.name, fqdn: h.fqdn, ip: h.ip, mac: h.mac, users: h.users.toJSON(), fs: VFS.serialize(h.fs.root) };
      }
      const devices = {};
      for (const [k, r] of Object.entries(this.devices)) devices[k] = VFS.serialize(r);
      return {
        v: 1, hosts, devices,
        procs: this.procs.filter((p) => !p.shell && !p.transient && !p.job), nextPid: this.nextPid,
        services: this.services, journal: this.journal, sessions: this.sessions.filter((s) => !s.player), wtmp: this.wtmp,
        sockets: this.sockets, mounts: this.mounts, disks: this.disks, passwords: this.passwords,
        installed: this.packages.installed, dmesg: this.dmesg, bootTime: this.bootTime, flags: this.flags, username: this.username,
        aptUpdated: !!this.aptUpdated,
      };
    }
    static deserialize(o) {
      const w = new World();
      w.username = o.username;
      for (const [k, h] of Object.entries(o.hosts)) {
        const users = new LA.Users(h.users);
        const fs = new VFS(VFS.deserialize(h.fs), users);
        w.hosts[k] = { name: h.name, fqdn: h.fqdn, ip: h.ip, mac: h.mac, users, fs };
      }
      for (const [k, r] of Object.entries(o.devices || {})) w.devices[k] = VFS.deserialize(r);
      Object.assign(w, {
        procs: o.procs, nextPid: o.nextPid, services: o.services, journal: o.journal, sessions: o.sessions, wtmp: o.wtmp,
        sockets: o.sockets, disks: o.disks, passwords: o.passwords, dmesg: o.dmesg, bootTime: o.bootTime, flags: o.flags || {},
        aptUpdated: o.aptUpdated,
      });
      w.packages.installed = o.installed;
      w.mounts = [];
      for (const m of o.mounts) {
        if (m.dev === '/dev/sdb1') w.mount(m.dev, m.path, m.opts.startsWith('ro'));
        else w.mounts.push(m);
      }
      w.dmesg = o.dmesg;
      LA.worldStatic(w);
      return w;
    }
  }

  World.prototype.hooks = {
    serviceDied(p, sig) {
      const u = p.service;
      const s = this.services[u];
      if (!s || s.mainPid !== p.pid) return;
      const sname = Object.keys(LA.SIGNALS || {}).find((k) => LA.SIGNALS[k] === sig) || String(sig);
      this.log('rootfall', 'systemd', 1, `${u}.service: Main process exited, code=killed, status=${sig}/${sname}`, u);
      this.log('rootfall', 'systemd', 1, `${u}.service: Failed with result 'signal'.`, u);
      s.active = false;
      if (s.restart === 'always' && s.enabled !== null) {
        s.restarts = (s.restarts || 0) + 1;
        this.log('rootfall', 'systemd', 1, `${u}.service: Scheduled restart job, restart counter is at ${s.restarts}.`, u);
        this.log('rootfall', 'systemd', 1, `Stopped ${u}.service - ${s.desc}.`, u);
        this.startService(u);
      }
      this.syncSockets();
    },
    hollowShellDied(p) {
      this.removeSession((s) => s.user === 'hollow');
      this.sockets = this.sockets.filter((s) => !(s.peer && s.peer.startsWith('10.0.0.66') && s.comm === 'sshd'));
      const w = this.wtmp.find((x) => x.user === 'hollow' && !x.out);
      if (w) w.out = `- ${U.strftime('%H:%M', new Date(LA.now()))}  (killed)`;
      this.syncSockets();
    },
    socketOwnerDied() { this.syncSockets(); },
    letheStarted(s, pid) {
      const fs = this.rootfall.fs;
      const conf = fs.tryGet('/etc/lethe/lethe.conf');
      const text = conf ? fs.contentOf(conf) : '';
      const get = (k) => { const m = text.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1] : '?'; };
      this.log('rootfall', 'lethe', pid, `Lethe 3.0.3 starting (conf=/etc/lethe/lethe.conf)`, 'lethe');
      this.log('rootfall', 'lethe', pid, `SAFE_MODE=${get('SAFE_MODE')} TARGETS=${get('TARGETS')} QUARANTINE=${get('QUARANTINE')}`, 'lethe');
      this.log('rootfall', 'lethe', pid, `next sweep scheduled for ${get('SCHEDULE')}`, 'lethe');
    },
  };

  LA.World = World;
  LA.PKG = PKG;
})();
