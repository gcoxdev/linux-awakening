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
    neofetch: { version: '7.1.0-4', desc: 'Shows Linux System Information with Distribution Logo', cmds: ['neofetch'], size: '83.9 kB' },
    htop: { version: '3.2.2-2', desc: 'interactive processes viewer', cmds: ['htop'], size: '152 kB' },
    cowsay: { version: '3.03+dfsg2-8', desc: 'configurable talking cow', cmds: ['cowsay'], games: true, size: '18.6 kB' },
    'fortune-mod': { version: '1:1.99.1-7.3', desc: 'provides fortune cookies on demand', cmds: ['fortune'], games: true, size: '39.4 kB' },
    sl: { version: '5.02-1', desc: 'Correct you if you type `sl\' by mistake', cmds: ['sl'], games: true, size: '12.5 kB' },
    cmatrix: { version: '2.0-3', desc: 'simulates the display from "The Matrix"', cmds: ['cmatrix'], size: '17.4 kB' },
    fail2ban: { version: '1.0.2-2', desc: 'ban hosts that cause multiple authentication errors', cmds: ['fail2ban-client'], size: '386 kB', long: 'Monitors log files (e.g. /var/log/auth.log) and temporarily or persistently bans failure-prone addresses.' },
  };
  const DEFAULT_SYS = {
    os: 'Rootfall GNU/Linux 1991', kernel: '6.1.0-rootfall', build: '1991', tz: 'RFT', domain: 'rootfall',
    cpu: 'Kernel Works KW-1991', vendor: 'RootfallIntegrated', mirror: 'mirror.lighthouse.rootfall', security: 'security.lighthouse.rootfall',
    packager: 'Rootfall Packagers <pkg@lighthouse.rootfall>', web: 'lighthouse/1.0', rootSizeKb: 19480400, rootUsedKb: 7123456, grows: ['/var/log/lethe.log'],
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
      /* which Linux this machine is (LA.distroId is the choice for new worlds; a save brings its own) */
      this.distro = LA.distroId || 'debian';
      this.packages = { installed: INITIAL_PKGS.map((n) => LA.pkgName(n, this.distro)).filter(Boolean), available: LA.packageDB(this.distro, PKG) };
      this.dmesg = [];
      this.bootTime = LA.now() - (3 * 86400 + 2 * 3600 + 15 * 60) * 1000;
      this.flags = {};
      this.username = 'operator';
      this.story = null;
      this.mainName = 'rootfall';
      /* what kind of machine this is: shown by uname, /proc, motd, apt and friends */
      this.sys = Object.assign({}, DEFAULT_SYS);
      this.devStats = {};
      this.fstabList = null;
    }

    get main() { return this.hosts[this.mainName]; }
    get rootfall() { return this.main; }
    get pack() { return LA.storyFor(this.story); }
    /* story-specific callbacks (a process dying, a service starting) live in the story pack */
    hook(name) { return this.hooks[name] || (this.pack && this.pack.worldHooks && this.pack.worldHooks[name]) || null; }

    /* ---------- processes ---------- */
    peekPid() { return this.nextPid; }
    spawn(o) {
      const pid = o.pid || this.nextPid++;
      const p = Object.assign({
        pid, ppid: 1, user: 'root', comm: 'bash', args: null, tty: '?', stat: 'S', start: LA.now(),
        cpu: 0, mem: 0.1, vsz: 8000 + Math.floor(Math.random() * 4000), rss: 4000 + Math.floor(Math.random() * 2000), cputime: 0, host: this.mainName,
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
        this.log(this.mainName, 'kernel', null, `${p.comm}[${p.pid}]: ignored signal ${sig}`, 'kernel', true);
        return true;
      }
      this.reap(pid);
      if (p.abort) p.abort();
      if (p.onKill && this.hook(p.onKill)) this.hook(p.onKill).call(this, p, sig);
      if (LA.game) LA.game.onProcKilled(p, sig);
      return true;
    }

    /* busy services (and busy processes) push the load average and memory up */
    busy() {
      let load = 0, mem = 0;
      for (const s of Object.values(this.services)) if (s.active && s.load) { load += s.load; mem += s.memKb || 0; }
      for (const p of this.procs) if (p.host === this.mainName && p.cpu >= 20) { load += p.cpu / 100; mem += p.rss || 0; }
      return { load, mem };
    }
    load() {
      const base = 0.08 + this.busy().load;
      return [base, base * 0.9, base * 0.75].map((x) => (x + Math.random() * 0.05).toFixed(2));
    }
    memory() {
      const total = 2034688;
      const used = 845120 + Math.floor(Math.random() * 20000) + this.busy().mem;
      const cache = 729600;
      return { total, used, free: total - used - cache, shared: 1036, cache, avail: total - used, swap: 1048572 };
    }
    dfRows() {
      const rows = [
        { fs: 'udev', type: 'devtmpfs', size: 1003456, used: 0, mount: '/dev' },
        { fs: 'tmpfs', type: 'tmpfs', size: 203448, used: 1036, mount: '/run' },
        { fs: '/dev/sda1', type: 'ext4', size: this.sys.rootSizeKb, used: Math.min(this.sys.rootSizeKb, this.sys.rootUsedKb + Math.floor(this.grownBytes() / 1024)), mount: '/' },
        { fs: 'tmpfs', type: 'tmpfs', size: 1017224, used: 0, mount: '/dev/shm' },
        { fs: 'tmpfs', type: 'tmpfs', size: 1017224, used: 48, mount: '/tmp' },
      ];
      for (const m of this.mounts) {
        const key = m.dev.replace(/^\/dev\//, '');
        if (!this.devices[key]) continue;
        const st = this.devStats[key] || { size: 2031440, used: 412332 };
        rows.push({ fs: m.dev, type: m.type || 'ext4', size: st.size, used: st.used, mount: m.path });
      }
      return rows;
    }
    /* bytes in the paths that make the root disk fill up (and empty again when they are deleted) */
    grownBytes() {
      const fs = this.main && this.main.fs;
      if (!fs) return 0;
      let total = 0;
      for (const p of this.sys.grows || []) {
        const n = fs.tryGet(p);
        if (!n) continue;
        if (n.type !== 'dir') { total += n.size || 0; continue; }
        for (const [, c] of fs.iterate(p, 'root', {})) if (c.type === 'file') total += c.size || 0;
      }
      return total;
    }

    /* ---------- journal ---------- */
    log(host, ident, pid, msg, unit, quiet, t) {
      this.journal.push({ t: t || LA.now(), host, ident, pid, msg, unit: unit || ident });
      if (this.journal.length > 600) this.journal.splice(0, this.journal.length - 600);
    }
    logAuth(line) {
      const fs = this.main.fs;
      const n = fs.tryGet('/var/log/auth.log') || fs.tryGet('/var/log/secure');
      if (n) n.content += `${U.syslogDate(LA.now())} ${this.mainName} ${line}\n`;
      this.log(this.mainName, 'sudo', null, line.replace(/^sudo: /, ''), 'sudo', true);
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
      out += `     Active: ${s.active ? c('\x1b[1;32m', 'active (running)') : 'inactive (dead)'} since ${U.DAY[new Date(since).getDay()]} ${U.stamp(since)} ${this.sys.tz}; ${agoStr}\n`;
      if (s.active) {
        const p = this.proc(s.mainPid);
        out += `   Main PID: ${s.mainPid} (${s.comm})\n      Tasks: 1 (limit: 2283)\n     Memory: ${s.memory || '13.2M'}\n        CPU: ${s.cpuStr || '41min 3.112s'}\n     CGroup: /system.slice/${u}.service\n             └─${s.mainPid} ${p ? p.args || p.comm : s.exec}\n`;
      }
      const recent = this.journal.filter((e) => e.unit === u).slice(-6);
      if (recent.length) out += '\n' + recent.map((e) => `${U.syslogDate(e.t)} ${e.host || this.mainName} ${e.ident}${e.pid ? `[${e.pid}]` : ''}: ${e.msg}`).join('\n') + '\n';
      return out;
    }
    startService(u) {
      const s = this.services[u];
      if (s.active) return;
      const pid = this.spawn({ user: s.user || 'root', comm: s.comm, args: s.exec, tty: '?', stat: 'Ss', cpu: s.cpu || 0.3, mem: 0.6, host: this.mainName, service: u, onKill: 'serviceDied' });
      s.mainPid = pid;
      s.active = true;
      s.since = LA.now();
      this.log(this.mainName, 'systemd', 1, `Started ${u}.service - ${s.desc}.`, u);
      if (s.onStart && this.hook(s.onStart)) this.hook(s.onStart).call(this, s, pid);
      this.syncSockets();
    }
    stopService(u) {
      const s = this.services[u];
      if (!s.active) return;
      this.log(this.mainName, 'systemd', 1, `Stopping ${u}.service - ${s.desc}...`, u);
      this.reap(s.mainPid);
      s.active = false;
      s.since = LA.now();
      this.log(this.mainName, 'systemd', 1, `${u}.service: Deactivated successfully.`, u);
      this.log(this.mainName, 'systemd', 1, `Stopped ${u}.service - ${s.desc}.`, u);
      if (s.onStop && this.hook(s.onStop)) this.hook(s.onStop).call(this, s);
      this.syncSockets();
    }
    serviceAction(u, verb, now) {
      const s = this.services[u];
      const fs = this.main.fs;
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
    /* the administrators: «sudo» on Debian, «wheel» elsewhere (both lines are in each distro's sudoers) */
    isSudoer(user, host) { const u = (host || this.main).users; return u.inGroup(user, 'sudo') || u.inGroup(user, 'wheel'); }
    sudoValid(user) { return this.sudoStamps[user] && LA.now() - this.sudoStamps[user] < 15 * 60000; }
    touchSudo(user) { this.sudoStamps[user] = LA.now(); }
    resetSudo(user) { delete this.sudoStamps[user]; }
    checkPassword(user, pw, host) {
      const h = host || this.main;
      const tbl = this.passwords[h.name] || {};
      const u = h.users.get(user);
      if (!u || u.locked) return false;
      return tbl[user] !== undefined && tbl[user] === pw;
    }
    setPassword(user, pw, host) {
      const h = host || this.main;
      this.passwords[h.name] = this.passwords[h.name] || {};
      this.passwords[h.name][user] = pw;
      this.resetSudo(user);
      this.syncAccounts(h);
    }
    syncAccounts(host) {
      const h = host || this.main;
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
      return this.fstabList || [{ dev: '/dev/sda1', path: '/' }, { dev: '/dev/sdb1', path: '/mnt/backup' }];
    }
    mount(dev, dir, ro) {
      const fs = this.main.fs;
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
      root.readonly = !!ro;
      root.name = ph.name;
      root.parent = ph.parent;
      ph.mount = root;
      this.mounts.push({ dev, path: d, type: 'ext4', opts: ro ? 'ro,relatime' : 'rw,relatime' });
      const fstype = (this.devStats[key] && this.devStats[key].type) || 'ext4';
      this.mounts[this.mounts.length - 1].type = fstype;
      const msg = fstype === 'vfat' ? `FAT-fs (${key}): Volume was not properly unmounted. Some data may be corrupt. Please run fsck.` : `EXT4-fs (${key}): mounted filesystem ${ro ? 'read-only ' : ''}with ordered data mode. Quota mode: none.`;
      this.dmesg.push({ s: (LA.now() - this.bootTime) / 1000, msg });
      this.log(this.mainName, 'kernel', null, msg, 'kernel');
      return null;
    }
    umount(target, shells) {
      const m = this.mounts.find((x) => x.path === target || x.dev === target);
      if (!m) return `umount: ${target}: not mounted.\n`;
      if (m.path === '/') return 'umount: /: target is busy.\n';
      if ((shells || []).some((s) => s.cwd === m.path || s.cwd.startsWith(m.path + '/'))) return `umount: ${m.path}: target is busy.\n`;
      const fs = this.main.fs;
      const w = fs.walk(VFS.dirname(m.path), 'root', true);
      const ph = w.node.children.get(VFS.basename(m.path));
      if (ph) delete ph.mount;
      this.mounts = this.mounts.filter((x) => x !== m);
      return null;
    }

    /* ---------- the locate database ---------- */
    updatedb() {
      const paths = [];
      for (const [p] of this.main.fs.iterate('/', 'root', { skip: (x) => LA.UPDATEDB_PRUNE.includes(x) })) if (p !== '/') paths.push(p);
      this.locateDb = { time: LA.now(), paths };
    }

    /* ---------- packages ---------- */
    installPackage(n) {
      const p = this.packages.available[n];
      if (!this.packages.installed.includes(n)) this.packages.installed.push(n);
      const fs = this.main.fs;
      for (const c of p.cmds) fs.put(`${p.games && this.distro === 'debian' ? '/usr/games' : '/usr/bin'}/${c}`, '', { format: 'elf', data: { cmd: c }, mode: 0o755 });
      if (n === 'fail2ban') {
        fs.put('/etc/fail2ban/jail.local', '[sshd]\nenabled  = true\nport     = ssh\nlogpath  = /var/log/auth.log\nmaxretry = 3\nbantime  = 1h\n');
        this.services.fail2ban = { desc: 'Fail2Ban Service', unit: '/lib/systemd/system/fail2ban.service', active: false, enabled: true, comm: 'fail2ban-server', exec: '/usr/bin/python3 /usr/bin/fail2ban-server -xf start', cpu: 0.2 };
        this.startService('fail2ban');
        this.log(this.mainName, 'fail2ban-server', this.services.fail2ban.mainPid, 'Server ready', 'fail2ban');
      }
    }
    removePackage(n) {
      const p = this.packages.available[n];
      this.packages.installed = this.packages.installed.filter((x) => x !== n);
      for (const c of p.cmds) this.main.fs.remove(`${p.games && this.distro === 'debian' ? '/usr/games' : '/usr/bin'}/${c}`);
      if (n === 'fail2ban' && this.services.fail2ban) { this.stopService('fail2ban'); delete this.services.fail2ban; }
    }

    /* ---------- network ---------- */
    resolve(name, fromHost) {
      const n = String(name).toLowerCase().replace(/\.$/, '');
      if (n === 'localhost' || n === '127.0.0.1' || n === (fromHost && fromHost.name)) {
        const self = fromHost || this.main;
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
      if (!r) return { status: 404, type: 'text/html', body: `<html>\n<head><title>404 Not Found</title></head>\n<body>\n<center><h1>404 Not Found</h1></center>\n<hr><center>${this.sys.web}</center>\n</body>\n</html>\n` };
      return { status: 200, type: r.type || 'text/plain', body: typeof r.body === 'function' ? r.body(this) : r.body, binary: r.binary };
    }
    motd(host, user) {
      const fs = host.fs;
      const m = fs.tryGet('/etc/motd');
      const last = this.wtmp.filter((w) => w.host === host.name && w.user === user).sort((a, b) => b.at - a.at)[0];
      const lastLine = last ? `Last login: ${U.dateString(new Date(last.at)).replace(' ' + this.sys.tz, '')} from ${last.from}\n` : '';
      return `Linux ${host.name} ${this.sys.kernel} #1 SMP PREEMPT_DYNAMIC x86_64\n` + (m ? fs.contentOf(m) : '') + lastLine;
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
      const host = this.main;
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
      for (const p of this.procs.filter((x) => x.host === this.mainName)) {
        const d = add(procDir, String(p.pid), '', { dir: true, owner: p.user });
        add(d, 'cmdline', (p.args || p.comm).replace(/ /g, '\u0000') + '\n', { owner: p.user });
        add(d, 'comm', p.comm + '\n', { owner: p.user });
        add(d, 'status', `Name:\t${p.comm}\nState:\t${p.stat[0]} (${p.stat[0] === 'R' ? 'running' : p.stat[0] === 'T' ? 'stopped' : 'sleeping'})\nPid:\t${p.pid}\nPPid:\t${p.ppid}\nUid:\t${host.users.uid(p.user) ?? 0}\nVmRSS:\t${p.rss} kB\nThreads:\t1\n`, { owner: p.user });
        add(d, 'environ', (p.environ || `HOME=${(host.users.get(p.user) || {}).home || '/'}\u0000USER=${p.user}\u0000`) + '\n', { owner: p.user, mode: 0o400 });
        add(d, 'cwd', '', { owner: p.user, mode: 0o777 });
      }
      add(procDir, 'uptime', `${((LA.now() - this.bootTime) / 1000).toFixed(2)} ${((LA.now() - this.bootTime) / 1000 * 0.9).toFixed(2)}\n`);
      add(procDir, 'loadavg', `${this.load().join(' ')} 1/${this.procs.length} ${this.nextPid}\n`);
      const S = this.sys;
      add(procDir, 'version', `Linux version ${S.kernel} (builder@${this.mainName}) (${LA.distro(this).gcc}, GNU ld (GNU Binutils) 2.44) #1 SMP PREEMPT_DYNAMIC ${S.build}\n`);
      const cpu = (i) => `processor\t: ${i}\nvendor_id\t: ${S.vendor}\nmodel name\t: ${S.cpu} @ 2.40GHz\ncpu MHz\t\t: 2400.000\ncache size\t: 4096 KB\ncores\t\t: 2\n`;
      add(procDir, 'cpuinfo', cpu(0) + '\n' + cpu(1));
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
        v: 1, story: this.story, mainName: this.mainName, sys: this.sys, devStats: this.devStats, fstabList: this.fstabList, hosts, devices,
        procs: this.procs.filter((p) => !p.shell && !p.transient && !p.job), nextPid: this.nextPid,
        services: this.services, journal: this.journal, sessions: this.sessions.filter((s) => !s.player), wtmp: this.wtmp,
        sockets: this.sockets, mounts: this.mounts, disks: this.disks, passwords: this.passwords,
        installed: this.packages.installed, dmesg: this.dmesg, bootTime: this.bootTime, flags: this.flags, username: this.username,
        aptUpdated: !!this.aptUpdated, distro: this.distro, locateDb: this.locateDb || null,
      };
    }
    static deserialize(o) {
      const w = new World();
      w.username = o.username;
      w.distro = o.distro || 'debian';
      w.story = o.story || 'rootfall';
      w.mainName = o.mainName || 'rootfall';
      if (o.sys) w.sys = Object.assign({}, DEFAULT_SYS, o.sys);
      w.devStats = o.devStats || {};
      w.fstabList = o.fstabList || null;
      for (const [k, h] of Object.entries(o.hosts)) {
        const users = new LA.Users(h.users);
        const fs = new VFS(VFS.deserialize(h.fs), users);
        w.hosts[k] = { name: h.name, fqdn: h.fqdn, ip: h.ip, mac: h.mac, users, fs };
      }
      for (const [k, r] of Object.entries(o.devices || {})) w.devices[k] = VFS.deserialize(r);
      Object.assign(w, {
        procs: o.procs, nextPid: o.nextPid, services: o.services, journal: o.journal, sessions: o.sessions, wtmp: o.wtmp,
        sockets: o.sockets, disks: o.disks, passwords: o.passwords, dmesg: o.dmesg, bootTime: o.bootTime, flags: o.flags || {},
        aptUpdated: o.aptUpdated, locateDb: o.locateDb || null,
      });
      w.packages.available = LA.packageDB(w.distro, Object.assign({}, PKG, w.sys.extraPkgs || {}));
      w.packages.installed = o.installed;
      w.mounts = [];
      for (const m of o.mounts) {
        if (w.devices[m.dev.replace(/^\/dev\//, '')]) w.mount(m.dev, m.path, m.opts.startsWith('ro'));
        else w.mounts.push(m);
      }
      w.dmesg = o.dmesg;
      if (w.pack.worldStatic) w.pack.worldStatic(w);
      return w;
    }
  }

  World.prototype.hooks = {
    serviceDied(p, sig) {
      const u = p.service;
      const s = this.services[u];
      if (!s || s.mainPid !== p.pid) return;
      const sname = Object.keys(LA.SIGNALS || {}).find((k) => LA.SIGNALS[k] === sig) || String(sig);
      this.log(this.mainName, 'systemd', 1, `${u}.service: Main process exited, code=killed, status=${sig}/${sname}`, u);
      this.log(this.mainName, 'systemd', 1, `${u}.service: Failed with result 'signal'.`, u);
      s.active = false;
      if (s.restart === 'always' && s.enabled !== null) {
        s.restarts = (s.restarts || 0) + 1;
        this.log(this.mainName, 'systemd', 1, `${u}.service: Scheduled restart job, restart counter is at ${s.restarts}.`, u);
        this.log(this.mainName, 'systemd', 1, `Stopped ${u}.service - ${s.desc}.`, u);
        this.startService(u);
      }
      this.syncSockets();
    },
    socketOwnerDied() { this.syncSockets(); },
  };

  LA.World = World;
  LA.PKG = PKG;
})();
