/* Linux Awakening — the ordinary Linux machine underneath a story (Debian, Fedora, Arch or openSUSE flavoured): accounts, the directory
   skeleton, /usr/bin, /dev, the usual /etc files, and the daemons every server runs.
   A story's world builder calls LA.baseSystem() and then adds its own people, files and secrets.
   (Rootfall predates this helper and builds its own skeleton by hand.) */
(function () {
  'use strict';
  const LA = globalThis.LA;

  /* builtins that also exist as programs in /usr/bin */
  const AS_BINARY = ['echo', 'pwd', 'printf', 'kill', 'test', '[', 'true', 'false'];
  /* programs that only appear once their package is installed, or that belong to one story */
  const NOT_INSTALLED = ['htop', 'cowsay', 'fortune', 'sl', 'neofetch', 'cmatrix', 'fail2ban-client', 'beacon', 'kw0rker', 'lethe', 'xyzzy', 'pet', 'make', 'vim', 'vi', 'emacs'];
  const SBIN = new Set(['useradd', 'userdel', 'usermod', 'chsh']);

  /**
   * o.host     { name, fqdn, ip, mac }
   * o.people   { name: { uid, gid, home, shell, gecos } }   human accounts (groups of the same name are created)
   * o.groups   { name: { gid, members } }                   extra groups; sudo/adm/users members via o.members
   * o.members  { sudo: [...], adm: [...], users: [...] }
   * o.os       { pretty, id, version, url }
   * o.old      mtime for files that came with the system
   * o.dirs     extra top-level directories
   */
  LA.baseSystem = function baseSystem(w, o) {
    const old = o.old;
    const M = o.members || {};
    const users = {
      root: { uid: 0, gid: 0, home: '/root', shell: '/bin/bash', gecos: 'root' },
      daemon: { uid: 1, gid: 1, home: '/usr/sbin', shell: '/usr/sbin/nologin', gecos: 'daemon' },
      bin: { uid: 2, gid: 2, home: '/bin', shell: '/usr/sbin/nologin', gecos: 'bin' },
      sys: { uid: 3, gid: 3, home: '/dev', shell: '/usr/sbin/nologin', gecos: 'sys' },
      man: { uid: 6, gid: 12, home: '/var/cache/man', shell: '/usr/sbin/nologin', gecos: 'man' },
      mail: { uid: 8, gid: 8, home: '/var/mail', shell: '/usr/sbin/nologin', gecos: 'mail' },
      'www-data': { uid: 33, gid: 33, home: '/var/www', shell: '/usr/sbin/nologin', gecos: 'www-data' },
      syslog: { uid: 104, gid: 110, home: '/nonexistent', shell: '/usr/sbin/nologin', gecos: '' },
      sshd: { uid: 105, gid: 65534, home: '/run/sshd', shell: '/usr/sbin/nologin', gecos: '' },
      nobody: { uid: 65534, gid: 65534, home: '/nonexistent', shell: '/usr/sbin/nologin', gecos: 'nobody', order: 900 },
    };
    const groups = {
      root: { gid: 0, members: [] }, daemon: { gid: 1, members: [] }, bin: { gid: 2, members: [] }, sys: { gid: 3, members: [] },
      adm: { gid: 4, members: ['syslog'].concat(M.adm || []) }, tty: { gid: 5, members: [] }, disk: { gid: 6, members: [] }, mail: { gid: 8, members: [] },
      man: { gid: 12, members: [] }, sudo: { gid: 27, members: (M.sudo || []).slice() }, 'www-data': { gid: 33, members: [] }, shadow: { gid: 42, members: [] },
      utmp: { gid: 43, members: [] }, users: { gid: 100, members: (M.users || []).slice() }, 'systemd-journal': { gid: 101, members: [] },
      crontab: { gid: 107, members: [] }, syslog: { gid: 110, members: [] }, nogroup: { gid: 65534, members: [] },
    };
    for (const [n, p] of Object.entries(o.people || {})) { users[n] = p; if (!groups[n]) groups[n] = { gid: p.gid, members: [] }; }
    Object.assign(groups, o.groups || {});
    const DI = LA.distro(w);
    const DM = LA.daemons(w);
    LA.adaptGroups(groups, w.distro);
    const accounts = new LA.Users({ users, groups });
    const root = new LA.Node('dir', '/', { mtime: old });
    const fs = new LA.VFS(root, accounts);
    const H = o.host;
    w.mainName = H.name;
    w.hosts[H.name] = { name: H.name, fqdn: H.fqdn, ip: H.ip, mac: H.mac, users: accounts, fs };

    const D = (p, x = {}) => fs.dir(p, Object.assign({ mtime: old }, x));
    const F = (p, c, x = {}) => fs.put(p, c, Object.assign({ mtime: old }, x));

    /* the skeleton */
    for (const d of ['/boot', '/dev', '/etc', '/home', '/media', '/mnt', '/opt', '/proc', '/run', '/srv', '/sys', '/usr', '/var'].concat(o.dirs || [])) D(d, { immutable: true });
    D('/root', { mode: 0o700, immutable: true });
    D('/tmp', { mode: 0o1777, pinned: true });
    root.immutable = true;
    fs.link('/bin', 'usr/bin'); fs.link('/sbin', 'usr/sbin'); fs.link('/lib', 'usr/lib'); fs.link('/lib64', 'usr/lib64');
    for (const n of ['bin', 'sbin', 'lib', 'lib64']) root.children.get(n).immutable = true;
    for (const d of ['/usr/bin', '/usr/sbin', '/usr/lib', '/usr/lib64', '/usr/share', '/usr/share/man', '/usr/share/doc', '/usr/games', '/var/log', '/var/lib', '/var/spool', '/var/spool/cron', '/var/cache', '/var/mail', '/etc/systemd', '/etc/systemd/system']) D(d, { immutable: true });
    /* cronie's spool is /var/spool/cron itself, root-only; Debian's is a sticky, group-crontab subdirectory */
    if (LA.cronSpool(w) === '/var/spool/cron') fs.get('/var/spool/cron').mode = 0o700;
    else D(LA.cronSpool(w), { mode: 0o1730, group: 'crontab' });
    D('/var/tmp', { mode: 0o1777, pinned: true });
    D('/usr/local/bin'); D('/usr/local/sbin');
    D('/run/sshd', { mode: 0o755 });
    D('/sys/class'); D('/sys/kernel');
    D('/etc/systemd/system/multi-user.target.wants');

    /* programs */
    const skip = new Set(NOT_INSTALLED.concat(o.skipCmds || []));
    for (const name of Object.keys(LA.commands)) {
      const c = LA.commands[name];
      if (c.builtin && !AS_BINARY.includes(name)) continue;
      if (c.meta || skip.has(name) || LA.foreignCmd(name, w.distro)) continue;
      F(`${SBIN.has(name) ? '/usr/sbin' : '/usr/bin'}/${name}`, '', { format: 'elf', data: { cmd: name }, mode: 0o755, immutable: true });
    }
    for (const n of ['vim', 'vi', 'make']) F(`/usr/bin/${n}`, '', { format: 'elf', data: { cmd: n }, mode: 0o755, immutable: true });
    F('/usr/sbin/sshd', '', { format: 'elf', data: { cmd: 'sshd' }, mode: 0o755 });
    F(DM.cron.bin, '', { format: 'elf', data: { cmd: 'cron' }, mode: 0o755 });
    F('/usr/lib/libc.so.6', '', { format: 'so', data: { lib: 'libc' }, mode: 0o755 });
    const OS = LA.storyOS(w, o.os);
    F('/usr/lib/os-release', LA.osRelease(w.distro, OS));
    F(`/boot/vmlinuz-${w.sys.kernel}`, '', { format: 'elf', data: { kernel: true }, mode: 0o600, size: 7811264 });
    F('/boot/grub/grub.cfg', `# GRUB configuration\nset default=0\nset timeout=5\nmenuentry "${OS.pretty}" {\n    linux /boot/vmlinuz-${w.sys.kernel} root=/dev/sda1 ro quiet\n}\n`, { mode: 0o444 });

    /* devices */
    const dev = (n, special, mode, group) => F('/dev/' + n, '', { special, mode, group: group || 'root', mtime: w.bootTime, immutable: true });
    dev('null', 'null', 0o666); dev('zero', 'zero', 0o666); dev('random', 'random', 0o666); dev('urandom', 'random', 0o666);
    dev('tty', 'tty', 0o666, 'tty'); dev('console', 'tty', 0o600);
    for (const b of ['sda', 'sda1', 'sda2'].concat(o.blockDevices || [])) dev(b, 'block', 0o660, 'disk');
    fs.dir('/dev/pts', { mtime: w.bootTime });
    fs.link('/dev/stdin', '/proc/self/fd/0'); fs.link('/dev/stdout', '/proc/self/fd/1'); fs.link('/dev/stderr', '/proc/self/fd/2');

    /* /etc */
    const E = (p, c, x = {}) => F('/etc/' + p, c, x);
    E('passwd', ''); E('group', ''); E('shadow', '', { mode: 0o640, group: 'shadow' });
    E('hostname', H.name + '\n');
    E('hosts', `127.0.0.1\tlocalhost\n127.0.1.1\t${H.name} ${H.fqdn}\n${o.hosts || ''}\n# The following lines are desirable for IPv6 capable hosts\n::1     localhost ip6-localhost ip6-loopback\n`);
    E('resolv.conf', `nameserver ${o.dns || H.ip.replace(/\.\d+$/, '.1')}\nsearch ${w.sys.domain}\n`);
    E('motd', o.motd || `\nThe programs included with ${OS.pretty} are free software.\n\n`);
    E('issue', `${OS.pretty} \\n \\l\n\n`);
    fs.link('/etc/os-release', '../usr/lib/os-release');
    E('fstab', o.fstab || '# /etc/fstab: static file system information.\n#\n# <file system>  <mount point>  <type>  <options>          <dump>  <pass>\n/dev/sda1        /              ext4    errors=remount-ro  0       1\n/dev/sda2        none           swap    sw                 0       0\n');
    E('crontab', '# /etc/crontab: system-wide crontab\nSHELL=/bin/sh\nPATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin\n\n# m h dom mon dow user  command\n17 *  * * *  root  cd / && run-parts --report /etc/cron.hourly\n25 6  * * *  root  test -x /usr/sbin/anacron || run-parts --report /etc/cron.daily\n');
    D('/etc/cron.d'); D('/etc/cron.daily'); D('/etc/cron.hourly');
    E('cron.d/e2scrub_all', '30 3 * * 0 root test -e /run/systemd/system || SERVICE_MODE=1 /usr/lib/x86_64-linux-gnu/e2fsprogs/e2scrub_all_cron\n');
    E('ssh/sshd_config', '# sshd configuration\nPort 22\nPermitRootLogin no\nPubkeyAuthentication yes\nPasswordAuthentication yes\nAuthorizedKeysFile .ssh/authorized_keys\n');
    E('bash.bashrc', '# System-wide .bashrc file for interactive bash(1) shells.\n[ -z "$PS1" ] && return\nshopt -s checkwinsize\n');
    E('profile', '# /etc/profile: system-wide .profile file for the Bourne shell\nif [ "$(id -u)" -eq 0 ]; then\n  PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"\nelse\n  PATH="/usr/local/bin:/usr/bin:/bin:/usr/games"\nfi\nexport PATH\n');
    for (const [p, c] of Object.entries(LA.repoFiles(w, w.sys.mirror, w.sys.security))) F(p, c);
    E('sudoers', '# /etc/sudoers\nDefaults\tenv_reset\nDefaults\tsecure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"\nroot\tALL=(ALL:ALL) ALL\n' + LA.sudoersAdmin(w), { mode: 0o440 });
    E('shells', '# /etc/shells: valid login shells\n/bin/sh\n/bin/bash\n/usr/bin/bash\n/bin/rbash\n');
    E('timezone', (o.timezone || 'Etc/UTC') + '\n');

    /* the daemons every server runs */
    const P = (x) => w.spawn(Object.assign({ start: w.bootTime + 2000, host: H.name }, x));
    P({ pid: 1, ppid: 0, user: 'root', comm: 'systemd', args: '/sbin/init', stat: 'Ss', cpu: 0, mem: 0.6, vsz: 167744, rss: 11892, cputime: 4 });
    P({ pid: 2, ppid: 0, user: 'root', comm: 'kthreadd', args: '[kthreadd]', stat: 'S', vsz: 0, rss: 0 });
    P({ pid: 3, ppid: 2, user: 'root', comm: 'rcu_gp', args: '[rcu_gp]', stat: 'I<', vsz: 0, rss: 0 });
    P({ pid: 13, ppid: 2, user: 'root', comm: 'ksoftirqd/0', args: '[ksoftirqd/0]', stat: 'S', vsz: 0, rss: 0 });
    P({ pid: 41, ppid: 2, user: 'root', comm: 'kworker/0:2-events', args: '[kworker/0:2-events]', stat: 'I', vsz: 0, rss: 0 });
    P({ pid: 180, user: 'root', comm: 'systemd-journal', args: '/lib/systemd/systemd-journald', stat: 'Ss', mem: 0.9, vsz: 49260, rss: 17512, service: 'systemd-journald' });
    P({ pid: 205, user: 'root', comm: 'systemd-udevd', args: '/lib/systemd/systemd-udevd', stat: 'Ss', vsz: 25632, rss: 6320 });
    P({ pid: 290, user: 'root', comm: 'dhclient', args: '/sbin/dhclient -4 -v -i -pf /run/dhclient.eth0.pid eth0', stat: 'Ss', vsz: 7600, rss: 2400 });
    P({ pid: 312, user: 'root', comm: DM.cron.comm, args: DM.cron.exec, stat: 'Ss', vsz: 6684, rss: 2760, service: DM.cron.unit });
    P({ pid: 340, user: 'root', comm: 'sshd', args: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups', stat: 'Ss', vsz: 15428, rss: 9216, service: DM.ssh.unit });
    P({ pid: 401, user: 'syslog', comm: 'rsyslogd', args: '/usr/sbin/rsyslogd -n -iNONE', stat: 'Ssl', vsz: 222400, rss: 5888, service: 'rsyslog' });
    P({ pid: 455, user: 'root', comm: 'agetty', args: '/sbin/agetty -o -p -- \\u --noclear - linux', tty: 'tty1', stat: 'Ss+', vsz: 5880, rss: 1960 });
    const svc = (name, x) => { w.services[name] = Object.assign({ active: true, enabled: true, since: w.bootTime + 3000, restart: 'on-failure', user: 'root' }, x); };
    svc(DM.cron.unit, { desc: DM.cron.desc, unit: `${DM.unitDir}/${DM.cron.unit}.service`, mainPid: 312, comm: DM.cron.comm, exec: DM.cron.exec, memory: '1.1M', cpuStr: '1.920s' });
    svc(DM.ssh.unit, { desc: DM.ssh.desc, unit: `${DM.unitDir}/${DM.ssh.unit}.service`, mainPid: 340, comm: 'sshd', exec: 'sshd: /usr/sbin/sshd -D', memory: '6.4M', cpuStr: '2.402s' });
    svc('rsyslog', { desc: 'System Logging Service', unit: '/lib/systemd/system/rsyslog.service', mainPid: 401, comm: 'rsyslogd', exec: '/usr/sbin/rsyslogd -n -iNONE', memory: '3.1M', cpuStr: '9.004s' });
    svc('systemd-journald', { desc: 'Journal Service', unit: '/lib/systemd/system/systemd-journald.service', mainPid: 180, comm: 'systemd-journald', exec: '/lib/systemd/systemd-journald', memory: '17.0M', cpuStr: '12.18s' });
    w.log(H.name, 'systemd', 1, `Started ${DM.cron.unit}.service - ${DM.cron.desc}.`, DM.cron.unit, true, w.bootTime + 3000);
    w.log(H.name, 'systemd', 1, `Started ${DM.ssh.unit}.service - ${DM.ssh.desc}.`, DM.ssh.unit, true, w.bootTime + 3100);
    w.sockets = [
      { proto: 'udp', state: 'UNCONN', local: '0.0.0.0:68', peer: '0.0.0.0:*', pid: 290, comm: 'dhclient', user: 'root', host: H.name, static: true },
      { proto: 'tcp', state: 'LISTEN', local: '0.0.0.0:22', peer: '0.0.0.0:*', pid: 340, comm: 'sshd', user: 'root', host: H.name, static: true },
      { proto: 'tcp', state: 'LISTEN', local: '[::]:22', peer: '[::]:*', pid: 340, comm: 'sshd', user: 'root', host: H.name, static: true },
    ];
    w.mounts = [
      { dev: '/dev/sda1', path: '/', type: 'ext4', opts: 'rw,relatime,errors=remount-ro' },
      { dev: 'proc', path: '/proc', type: 'proc', opts: 'rw,nosuid,nodev,noexec,relatime' },
      { dev: 'sysfs', path: '/sys', type: 'sysfs', opts: 'rw,nosuid,nodev,noexec,relatime' },
      { dev: 'udev', path: '/dev', type: 'devtmpfs', opts: 'rw,nosuid,relatime,size=1003456k,mode=755' },
      { dev: 'tmpfs', path: '/run', type: 'tmpfs', opts: 'rw,nosuid,nodev,noexec,relatime,size=203448k,mode=755' },
      { dev: 'tmpfs', path: '/tmp', type: 'tmpfs', opts: 'rw,nosuid,nodev' },
    ];
    w.dmesg = [
      { s: 0, msg: `Linux version ${w.sys.kernel} (builder@${H.name}) (${DI.gcc}) #1 SMP PREEMPT_DYNAMIC ${w.sys.build}` },
      { s: 0, msg: `Command line: BOOT_IMAGE=/boot/vmlinuz-${w.sys.kernel} root=/dev/sda1 ro quiet` },
      { s: 0.213, msg: 'Memory: 2034688K available' },
      { s: 1.044, msg: 'sd 0:0:0:0: [sda] 62914560 512-byte logical blocks: (32.2 GB/30.0 GiB)' },
      { s: 1.051, msg: ' sda: sda1 sda2' },
      { s: 2.881, msg: 'EXT4-fs (sda1): mounted filesystem with ordered data mode. Quota mode: none.' },
    ];
    return { fs, root, users: accounts, D, F, E, P, svc };
  };

  /* after building: a directory's mtime is the newest thing inside it, as if the files had really been written */
  LA.settleMtimes = function settle(n, buildStart, old) {
    if (n.type !== 'dir') return n.mtime;
    let t = 0;
    for (const c of n.children.values()) t = Math.max(t, settle(c, buildStart, old));
    if (n.mtime > buildStart - 1000) n.mtime = t || old;
    return n.mtime;
  };
})();
