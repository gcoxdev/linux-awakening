/* Practice Range — the machine (rebuilt for every task) and the toolkit task templates use to furnish it. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const U = LA.util;
  const R = String.raw;
  const pack = LA.stories.practice;
  const HOUR = 3600000, DAY = 24 * HOUR;

  /* ---------------- random data ---------------- */
  const FIRST = ['ada', 'alan', 'grace', 'linus', 'margaret', 'dennis', 'ken', 'barbara', 'radia', 'tim', 'katherine', 'edsger', 'frances', 'john', 'hedy', 'claude', 'anita', 'vint', 'shafi', 'leslie'];
  const LAST = ['lovelace', 'turing', 'hopper', 'torvalds', 'hamilton', 'ritchie', 'thompson', 'liskov', 'perlman', 'lee', 'johnson', 'dijkstra', 'allen', 'mccarthy', 'lamarr', 'shannon', 'borg', 'cerf', 'goldwasser', 'lamport'];
  const DEPTS = ['engineering', 'sales', 'support', 'finance', 'design', 'ops'];
  const CITIES = ['Lisbon', 'Oslo', 'Nairobi', 'Lima', 'Osaka', 'Tallinn', 'Accra', 'Hanoi'];
  const WORDS = ['apple', 'river', 'falcon', 'copper', 'lantern', 'meadow', 'harbor', 'violet', 'summit', 'ember', 'quartz', 'willow', 'cobalt', 'thistle', 'maple', 'orbit', 'pepper', 'raven', 'saffron', 'tundra', 'cedar', 'delta', 'glacier', 'juniper'];
  const SERVICES = ['api', 'auth', 'billing', 'search', 'mailer', 'cache', 'worker', 'gateway'];
  const PATHS = ['/', '/index.html', '/about', '/login', '/api/users', '/api/orders', '/static/app.js', '/static/style.css', '/favicon.ico', '/admin', '/wp-login.php', '/robots.txt'];
  const AGENTS = ['Mozilla/5.0 (X11; Linux x86_64)', 'curl/8.4.0', 'Mozilla/5.0 (Macintosh)', 'python-requests/2.31', 'Googlebot/2.1'];
  pack.WORDS = WORDS;

  function makeRng(seed) {
    const r = U.rng(seed);
    const api = {
      r,
      int: (a, b) => a + Math.floor(r() * (b - a + 1)),
      pick: (arr) => arr[Math.floor(r() * arr.length)],
      shuffle: (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
      word: () => api.pick(WORDS),
      name: () => api.pick(FIRST),
      fullName: () => `${api.pick(FIRST)} ${api.pick(LAST)}`,
      ip: () => `${api.pick([10, 172, 192, 203])}.${api.int(0, 255)}.${api.int(0, 255)}.${api.int(1, 254)}`,
      chance: (p) => r() < p,
    };
    api.pickN = (arr, n) => api.shuffle(arr).slice(0, n);
    return api;
  }

  /* generators that return lines (and the facts a task needs to check answers) */
  pack.gen = {
    appLog(t, n, o = {}) {
      const levels = o.levels || ['INFO', 'INFO', 'INFO', 'WARN', 'ERROR', 'DEBUG'];
      let time = (o.start || t.now - 6 * HOUR);
      const lines = [];
      for (let i = 0; i < n; i++) {
        time += t.int(5, 90) * 1000;
        const lvl = t.pick(levels);
        const svc = t.pick(o.services || SERVICES);
        const msg = lvl === 'ERROR' ? t.pick(['connection refused', 'timeout after 30s', 'disk quota exceeded', 'invalid token', 'null pointer in handler']) : lvl === 'WARN' ? t.pick(['slow query (2.3s)', 'retrying request', 'cache miss storm', 'deprecated endpoint used']) : t.pick(['request served', 'user logged in', 'job finished', 'config reloaded', 'healthcheck ok']);
        lines.push({ time, lvl, svc, msg, text: `${U.strftime('%F %T', new Date(time))} [${lvl}] ${svc}: ${msg}` });
      }
      return lines;
    },
    access(t, n) {
      const ips = Array.from({ length: t.int(5, 9) }, () => t.ip());
      const hot = t.pick(ips);
      const lines = [];
      let time = t.now - 3 * HOUR;
      for (let i = 0; i < n; i++) {
        time += t.int(2, 40) * 1000;
        const ip = t.chance(0.3) ? hot : t.pick(ips);
        const path = t.pick(PATHS);
        const status = path === '/admin' || path === '/wp-login.php' ? t.pick([403, 404]) : t.pick([200, 200, 200, 200, 304, 404, 500]);
        const bytes = status === 304 ? 0 : t.int(120, 48000);
        lines.push({ ip, path, status, bytes, text: `${ip} - - [${U.strftime('%d/%b/%Y:%H:%M:%S', new Date(time))} +0000] "GET ${path} HTTP/1.1" ${status} ${bytes} "-" "${t.pick(AGENTS)}"` });
      }
      return lines;
    },
    people(t, n) {
      const used = new Set();
      const rows = [];
      while (rows.length < n) {
        const name = `${t.pick(FIRST)}_${t.pick(LAST)}`;
        if (used.has(name)) continue;
        used.add(name);
        /* distinct salaries, so «sorted by salary» has exactly one right answer */
        let salary;
        do salary = t.int(38, 140) * 1000; while (rows.some((r) => r.salary === salary));
        rows.push({ name, dept: t.pick(DEPTS), city: t.pick(CITIES), salary, age: t.int(22, 64) });
      }
      return rows;
    },
  };

  /* ---------------- the machine ---------------- */
  pack.buildWorld = function buildWorld(u, seed) {
    const w = new LA.World();
    const now = LA.now();
    const old = now - 300 * DAY;
    w.username = u;
    w.bootTime = now - 2 * DAY - 5 * HOUR;
    w.flags.seed = seed || 1;
    Object.assign(w.sys, {
      os: 'Range Linux 12', kernel: '6.1.0-range', build: '2026', tz: 'UTC', domain: 'lab',
      cpu: 'Practice Range PR-2', vendor: 'RangeSystems', mirror: 'mirror.lab', security: 'security.lab',
      packager: 'Range Maintainers <pkg@lab>', web: 'nginx/1.22.1', rootSizeKb: 20480000, rootUsedKb: 6200000, grows: ['/var/log', '/home'],
    });
    const B = LA.baseSystem(w, {
      old,
      host: { name: 'range', fqdn: 'range.lab', ip: '10.0.5.2', mac: '52:54:00:5a:00:02' },
      os: { pretty: 'Range Linux 12 (bookworm)', name: 'Range Linux', id: 'range', version: '12' },
      people: {
        [u]: { uid: 1000, gid: 1000, home: '/home/' + u, shell: '/bin/bash', gecos: `${u},,,` },
        alice: { uid: 1001, gid: 1001, home: '/home/alice', shell: '/bin/bash', gecos: 'Alice Ng,,,developer' },
        bob: { uid: 1002, gid: 1002, home: '/home/bob', shell: '/bin/bash', gecos: 'Bob Okoro,,,support' },
        deploy: { uid: 1003, gid: 1003, home: '/home/deploy', shell: '/bin/bash', gecos: 'deploy bot,,,' },
      },
      groups: { devs: { gid: 1500, members: [u, 'alice'] }, ops: { gid: 1501, members: ['bob'] } },
      members: { sudo: [u], adm: [u], users: [u, 'alice', 'bob', 'deploy'] },
      hosts: '10.0.5.10\tweb web.lab\n10.0.5.20\tbackup backup.lab',
      dns: '10.0.5.1',
      motd: `\n  PRACTICE RANGE — a scratch machine. Break anything; it's rebuilt for every task.\n\n`,
      blockDevices: ['sdb', 'sdb1'],
    });
    const { fs, D, F, P, svc } = B;
    w.passwords.range = { [u]: 'practice', alice: 'alice123', bob: 'bob123', deploy: Math.random().toString(36), root: Math.random().toString(36) };
    const home = '/home/' + u;
    D(home, { owner: u, group: u, mode: 0o755 });
    const Y = (p, c, o = {}) => F(home + '/' + p, c, Object.assign({ owner: u, group: u, mode: 0o644, mtime: now - DAY }, o));
    Y('.bashrc', R`# ~/.bashrc
case $- in
    *i*) ;;
      *) return;;
esac
HISTCONTROL=ignoreboth
PS1='${LA.distroPS1(w.distro)}'
alias ls='ls --color=auto'
alias grep='grep --color=auto'
`);
    Y('.profile', '# ~/.profile\nif [ -n "$BASH_VERSION" ]; then\n    if [ -f "$HOME/.bashrc" ]; then\n        . "$HOME/.bashrc"\n    fi\nfi\nif [ -d "$HOME/bin" ] ; then\n    PATH="$HOME/bin:$PATH"\nfi\n');
    D(home + '/.ssh', { owner: u, group: u, mode: 0o700 });
    const KEY = `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPr4ct1c3R4ng3K3yF0rThePl4y3rQx ${u}@range`;
    Y('.ssh/id_ed25519', '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\nUHJhY3RpY2VSYW5nZVBsYXllcktleQ==\n-----END OPENSSH PRIVATE KEY-----\n', { mode: 0o600 });
    Y('.ssh/id_ed25519.pub', KEY + '\n');
    for (const n of ['alice', 'bob', 'deploy']) D('/home/' + n, { owner: n, group: n, mode: 0o750 });
    F('/home/alice/notes.txt', 'remember: the staging password rotates on mondays\n', { owner: 'alice', group: 'alice', mode: 0o600 });

    /* a small web server, an app, some logs */
    D('/srv/www', { owner: 'www-data', group: 'www-data' });
    F('/srv/www/index.html', '<!DOCTYPE html>\n<html><head><title>range.lab</title></head>\n<body><h1>It works</h1></body></html>\n', { owner: 'www-data', group: 'www-data' });
    D('/var/log/nginx', { owner: 'root', group: 'adm', mode: 0o755 });
    D('/opt/app'); D('/opt/app/src'); D('/opt/app/logs');
    F('/opt/app/README.md', '# app\nA tiny service. Start it with `./run.sh`.\n');
    F('/etc/app.conf', '# app configuration\nport=8080\nworkers=4\nlog_level=info\ncache=on\n');
    for (const b of ['nginx', 'backupd', 'metricsd']) F('/usr/sbin/' + b, '', { format: 'elf', data: { cmd: b }, mode: 0o755 });
    for (const [name, desc, active, enabled, pid] of [['nginx', 'A high performance web server', true, true, 600], ['metrics', 'Metrics collector', true, true, 640], ['backup', 'Nightly backup agent', false, false, null]]) {
      F(`/etc/systemd/system/${name}.service`, `[Unit]\nDescription=${desc}\n\n[Service]\nExecStart=/usr/sbin/${name === 'metrics' ? 'metricsd' : name === 'backup' ? 'backupd' : 'nginx -g daemon off;'}\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n`);
      if (enabled) fs.link(`/etc/systemd/system/multi-user.target.wants/${name}.service`, `/etc/systemd/system/${name}.service`);
      if (pid) P({ pid, user: name === 'nginx' ? 'root' : 'root', comm: name === 'metrics' ? 'metricsd' : name, args: name === 'nginx' ? 'nginx: master process /usr/sbin/nginx' : '/usr/sbin/metricsd', stat: 'Ss', service: name, onKill: 'serviceDied' });
      svc(name, { desc, unit: `/etc/systemd/system/${name}.service`, active, enabled, mainPid: pid, comm: name === 'metrics' ? 'metricsd' : name === 'backup' ? 'backupd' : 'nginx', exec: name === 'nginx' ? 'nginx: master process /usr/sbin/nginx' : `/usr/sbin/${name}d`, memory: '6.1M', cpuStr: '1.204s' });
      w.log('range', 'systemd', 1, active ? `Started ${name}.service - ${desc}.` : `${name}.service: Deactivated successfully.`, name, true, w.bootTime + 4000);
    }
    P({ pid: 601, ppid: 600, user: 'www-data', comm: 'nginx', args: 'nginx: worker process', stat: 'S' });
    w.sockets.push({ proto: 'tcp', state: 'LISTEN', local: '0.0.0.0:80', peer: '0.0.0.0:*', pid: 600, comm: 'nginx', user: 'root', host: 'range', static: true });
    w.nextPid = 2400;
    /* text log files only where the distro has a syslog daemon by default; Arch and openSUSE log to the journal alone */
    const LOGS = LA.distro(w).logs;
    if (LOGS.syslog) F(LOGS.syslog, `${U.syslogDate(w.bootTime)} range kernel: Linux version 6.1.0-range\n${U.syslogDate(w.bootTime + 4000)} range systemd[1]: Started nginx.service - A high performance web server.\n`, w.distro === 'debian' ? { owner: 'syslog', group: 'adm', mode: 0o640 } : { mode: 0o600 });
    if (LOGS.auth) F(LOGS.auth, '', w.distro === 'debian' ? { owner: 'syslog', group: 'adm', mode: 0o640 } : { mode: 0o600 });
    D('/mnt/usb'); D('/backup', { mode: 0o755 });

    /* a USB stick, plugged in but not mounted */
    const stick = new LA.Node('dir', 'usb', { mode: 0o755, mtime: now - 3 * DAY });
    const sfs = new LA.VFS(stick, fs.users);
    sfs.put('/photos/beach.jpg', '', { format: 'jpeg', data: { comment: 'beach, 2026', size: '4000x3000' }, mode: 0o644, size: 2400000 });
    sfs.put('/photos/cat.jpg', '', { format: 'jpeg', data: { comment: 'the cat', size: '3000x2000' }, mode: 0o644, size: 1800000 });
    sfs.put('/report.txt', 'Q3 report — draft\nrevenue up 4%\n', { mode: 0o644 });
    w.devices.sdb1 = stick;
    w.devStats.sdb1 = { size: 15360000, used: 4300000, type: 'vfat' };
    w.disks = [
      { name: 'sda', majmin: '8:0', rm: '0', size: '20G', parts: [{ name: 'sda1', majmin: '8:1', size: '19G', fstype: 'ext4', uuid: 'aaaa-range-root', fixedMount: '/' }, { name: 'sda2', majmin: '8:2', size: '1G', fstype: 'swap', uuid: 'bbbb-range-swap', fixedMount: '[SWAP]' }] },
      { name: 'sdb', majmin: '8:16', rm: '1', size: '14.6G', parts: [{ name: 'sdb1', majmin: '8:17', size: '14.6G', fstype: 'vfat', label: 'USBSTICK', uuid: 'C0DE-1234' }] },
    ];
    w.dmesg.push({ s: 7200.1, msg: 'usb 1-1: new high-speed USB device number 2 using xhci_hcd' }, { s: 7201.2, msg: 'sd 1:0:0:0: [sdb] 30720000 512-byte logical blocks: (15.7 GB/14.6 GiB)' }, { s: 7201.3, msg: ' sdb: sdb1' });

    /* two more machines on the lab network */
    const mkHost = (name, ip, fqdn) => {
      const users = new LA.Users({
        users: { root: { uid: 0, gid: 0, home: '/root', shell: '/bin/bash', gecos: 'root' }, [u]: { uid: 1000, gid: 1000, home: '/home/' + u, shell: '/bin/bash', gecos: u } },
        groups: { root: { gid: 0, members: [] }, [u]: { gid: 1000, members: [] } },
      });
      const root = new LA.Node('dir', '/', { mtime: old });
      const hfs = new LA.VFS(root, users);
      for (const d of ['/etc', '/home', '/usr', '/usr/bin', '/var', '/var/log', '/tmp', '/root', '/srv']) hfs.dir(d, { mode: d === '/tmp' ? 0o1777 : d === '/root' ? 0o700 : 0o755, immutable: true });
      for (const n of Object.keys(LA.commands)) {
        const c = LA.commands[n];
        if ((c.builtin && !['echo', 'pwd', 'printf', 'kill', 'test', '[', 'true', 'false'].includes(n)) || c.meta || LA.foreignCmd(n, w.distro)) continue;
        hfs.put('/usr/bin/' + n, '', { format: 'elf', data: { cmd: n }, mode: 0o755, mtime: old });
      }
      hfs.link('/bin', 'usr/bin');
      hfs.put('/etc/hostname', name + '\n'); hfs.put('/etc/passwd', ''); hfs.put('/etc/group', ''); hfs.put('/etc/shadow', '', { mode: 0o640 });
      hfs.put('/etc/motd', `\n  ${fqdn}\n\n`);
      hfs.dir('/home/' + u, { owner: u, group: u, mode: 0o755 });
      hfs.dir('/home/' + u + '/.ssh', { owner: u, group: u, mode: 0o700 });
      hfs.put('/home/' + u + '/.ssh/authorized_keys', KEY + '\n', { owner: u, group: u, mode: 0o600 });
      w.hosts[name] = { name, fqdn, ip, mac: '52:54:00:5a:00:' + ip.split('.').pop(), users, fs: hfs };
      w.passwords[name] = { [u]: 'practice', root: Math.random().toString(36) };
      return hfs;
    };
    const bfs = mkHost('backup', '10.0.5.20', 'backup.lab');
    bfs.dir('/srv/backups', { owner: u, group: u, mode: 0o755 });
    bfs.put('/srv/backups/README', 'Put backups here. Keep the last seven.\n', { owner: u, group: u });
    mkHost('web', '10.0.5.10', 'web.lab');
    w.syncAccounts(w.hosts.backup); w.syncAccounts(w.hosts.web); w.syncAccounts(w.hosts.range);
    w.http = { web: {} };
    w.syncAccounts(w.hosts.range);
    pack.worldStatic(w);
    return w;
  };

  pack.worldStatic = function (w) {
    w.net = [
      { names: ['range', 'range.lab'], ip: '10.0.5.2', up: true, latency: 0.04, hostKey: 'range', ptr: 'range.lab' },
      { names: ['gateway', 'gateway.lab'], ip: '10.0.5.1', up: true, latency: 0.4, ptr: 'gateway.lab' },
      { names: ['web', 'web.lab'], ip: '10.0.5.10', up: true, latency: 0.9, http: true, ssh: true, hostKey: 'web', ptr: 'web.lab' },
      { names: ['backup', 'backup.lab'], ip: '10.0.5.20', up: true, latency: 1.3, ssh: true, hostKey: 'backup', ptr: 'backup.lab' },
      { names: ['deb.lab', 'security.lab'], ip: '10.0.5.30', up: true, latency: 1.1, ptr: 'deb.lab' },
      { names: [], ip: '10.0.5.99', up: false },
    ];
    w.txt = { 'range.lab': 'practice=yes; break=anything', 'web.lab': 'owner=ops@lab' };
    if (!w.http) w.http = { web: {} };
  };

  /* ---------------- the toolkit a task's setup() gets ---------------- */
  pack.toolkit = function (game, seed) {
    const w = game.world, fs = w.main.fs, u = game.user, home = game.home;
    const t = Object.assign(makeRng(seed), { game, world: w, fs, user: u, home, now: LA.now() });
    const exp = (p) => String(p).replace(/^~(?=\/|$)/, home);
    const own = (p) => (p.startsWith(home) ? { owner: u, group: u } : {});
    t.p = exp;
    /* folders the template didn't mention, under the player's home, belong to the player */
    const parents = (abs) => { if (!abs.startsWith(home + '/')) return; let d = abs; const made = []; while ((d = LA.VFS.dirname(d)) !== home && !fs.tryGet(d)) made.unshift(d); for (const x of made) fs.dir(x, { owner: u, group: u, mode: 0o755 }); };
    t.dir = (p, o = {}) => { parents(exp(p)); return fs.dir(exp(p), Object.assign({ mode: 0o755 }, own(exp(p)), o)); };
    t.file = (p, content, o = {}) => {
      const abs = exp(p);
      parents(abs);
      return fs.put(abs, Array.isArray(content) ? content.join('\n') + '\n' : content, Object.assign({ mode: 0o644, mtime: t.now - t.int(1, 72) * HOUR }, own(abs), o));
    };
    t.bin = (p, cmd) => fs.put(exp(p), '', { format: 'elf', data: { cmd }, mode: 0o755 });
    t.proc = (o) => w.spawn(Object.assign({ host: w.mainName, start: t.now - t.int(2, 300) * 60000, stat: 'S', ppid: 1 }, o));
    t.session = (o) => w.addSession(Object.assign({ host: w.mainName, at: t.now - 40 * 60000, idle: '1:02m', what: '-bash' }, o));
    t.service = (name, o = {}) => {
      const pid = o.active ? w.spawn({ user: 'root', comm: o.comm || name, args: o.exec || `/usr/sbin/${name}`, stat: 'Ss', service: name, onKill: 'serviceDied', host: w.mainName }) : null;
      fs.put(`/etc/systemd/system/${name}.service`, `[Unit]\nDescription=${o.desc || name}\n\n[Service]\nExecStart=${o.exec || '/usr/sbin/' + name}\n\n[Install]\nWantedBy=multi-user.target\n`);
      w.services[name] = Object.assign({ desc: o.desc || name, unit: `/etc/systemd/system/${name}.service`, active: !!o.active, enabled: !!o.enabled, mainPid: pid, comm: o.comm || name, exec: o.exec || `/usr/sbin/${name}`, user: 'root', since: t.now - 3600000, restart: 'on-failure', memory: '3.0M', cpuStr: '0.5s' }, o.extra || {});
      if (o.enabled) fs.link(`/etc/systemd/system/multi-user.target.wants/${name}.service`, `/etc/systemd/system/${name}.service`);
      for (const line of o.journal || []) w.log(w.mainName, o.comm || name, pid || 777, line, name, true, t.now - t.int(5, 50) * 60000);
      return pid;
    };
    t.account = (name, o = {}) => {
      const users = fs.users;
      const uid = o.uid || 1100 + Object.keys(users.users).length;
      users.users[name] = { uid, gid: uid, home: o.home || '/home/' + name, shell: o.shell || '/bin/bash', gecos: o.gecos || '' };
      users.groups[name] = { gid: uid, members: [] };
      for (const g of o.groups || []) if (users.groups[g]) users.groups[g].members.push(name);
      if (o.mkhome !== false) fs.dir(o.home || '/home/' + name, { owner: name, group: name, mode: 0o750 });
      w.passwords.range[name] = o.password || Math.random().toString(36);
      return uid;
    };
    t.cron = (who, text) => fs.put(LA.cronSpool(w) + '/' + who, text, { owner: who, group: 'crontab', mode: 0o600 });
    t.http = (path, body, type) => { w.http.web[path] = { body, type: type || 'text/plain' }; };
    t.remote = (host, p, content, o = {}) => w.hosts[host].fs.put(p.replace(/^~/, '/home/' + u), content, Object.assign({ owner: u, group: u, mode: 0o644 }, o));
    t.finish = () => { w.syncAccounts(w.hosts.range); };
    return t;
  };
})();
