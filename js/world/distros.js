/* Linux Awakening — the Linux distributions a machine can be built as.
   Almost everything (Bash, GNU coreutils, systemd, the kernel) is the same everywhere; what differs
   is the package manager and its package names, the administrators' group, the default prompt, where
   the system log goes, and the branding in /etc/os-release. A world records its distro in
   `world.distro`; commands and stories ask LA.distro(world) for the profile. */
(function () {
  'use strict';
  const LA = globalThis.LA;

  const COLOR = { user: '\\[\\e[1;32m\\]', root: '\\[\\e[1;31m\\]', dir: '\\[\\e[1;34m\\]', off: '\\[\\e[0m\\]' };

  const DISTROS = {
    debian: {
      id: 'debian', label: 'Debian / Ubuntu', short: 'Debian', family: 'Debian, Ubuntu, Linux Mint, Pop!_OS, Raspberry Pi OS',
      osName: 'Debian GNU/Linux', osId: 'debian', version: '12', codename: 'bookworm', pretty: 'Debian GNU/Linux 12 (bookworm)', like: 'debian',
      admin: 'sudo', adminGid: 27,
      pm: 'apt', pmCmds: ['apt', 'apt-get', 'apt-cache', 'dpkg'], lowPm: 'dpkg', pkgFormat: '.deb',
      logs: { syslog: '/var/log/syslog', auth: '/var/log/auth.log' },
      prompt: 'debian', cronUnit: 'cron', sshUnit: 'ssh',
      gcc: 'gcc (Debian 12.2.0-14) 12.2.0', dig: '9.18.28-1~deb12u2-Debian',
      blurb: 'apt and dpkg · the «sudo» group · /var/log/syslog',
      pkg: {
        refresh: 'sudo apt update', install: (p) => `sudo apt install ${p}`, remove: (p) => `sudo apt remove ${p}`,
        search: (w) => `apt search ${w}`, list: 'apt list --installed', upgrade: 'sudo apt upgrade', info: (p) => `apt show ${p}`,
        query: (p) => `dpkg -l ${p}`, owner: (f) => `dpkg -S ${f}`, files: (p) => `dpkg -L ${p}`, repos: 'cat /etc/apt/sources.list',
        lesson: '«apt update» refreshes the package lists · «apt install PKG» installs · «apt remove PKG» removes · «apt search WORD» finds · «apt list --installed» shows what you have. Under apt sits «dpkg», which handles the «.deb» files themselves. Installing and removing need root.',
        refreshWhy: '«apt update» refreshes the list of what\'s available, «apt install» installs.',
      },
      logNote: '',
    },
    fedora: {
      id: 'fedora', label: 'Fedora / RHEL', short: 'Fedora', family: 'Fedora, RHEL, Rocky Linux, AlmaLinux, CentOS Stream',
      osName: 'Fedora Linux', osId: 'fedora', version: '42', codename: '', pretty: 'Fedora Linux 42 (Server Edition)', like: '',
      admin: 'wheel', adminGid: 10,
      pm: 'dnf', pmCmds: ['dnf', 'yum', 'rpm'], lowPm: 'rpm', pkgFormat: '.rpm', pkgSuffix: '.fc42',
      logs: { syslog: '/var/log/messages', auth: '/var/log/secure' },
      prompt: 'redhat', cronUnit: 'crond', sshUnit: 'sshd',
      gcc: 'gcc (GCC) 15.0.1 20250329 (Red Hat 15.0.1-0)', dig: '9.18.33',
      blurb: 'dnf (yum) and rpm · the «wheel» group · /var/log/messages',
      pkg: {
        refresh: 'sudo dnf makecache', install: (p) => `sudo dnf install ${p}`, remove: (p) => `sudo dnf remove ${p}`,
        search: (w) => `dnf search ${w}`, list: 'dnf list --installed', upgrade: 'sudo dnf upgrade', info: (p) => `dnf info ${p}`,
        query: (p) => `rpm -q ${p}`, owner: (f) => `rpm -qf ${f}`, files: (p) => `rpm -ql ${p}`, repos: 'dnf repolist',
        lesson: '«dnf install PKG» installs (it refreshes its metadata by itself when it\'s stale; «dnf makecache» forces it) · «dnf remove PKG» removes · «dnf search WORD» finds · «dnf list --installed» shows what you have · «dnf upgrade» updates everything. «yum» is the older name and still works. Under dnf sits «rpm», which handles the «.rpm» files: «rpm -q PKG», «rpm -qf FILE». Installing and removing need root.',
        refreshWhy: '«dnf makecache» refreshes the list of what\'s available, «dnf install» installs (and asks first — answer «y»).',
      },
      logNote: 'On Fedora this file doesn\'t exist out of the box: logs live in the systemd journal (read with «journalctl»). RHEL, Rocky and Alma also run rsyslog, which writes «/var/log/messages» and, for logins, «/var/log/secure». This machine\'s rsyslog is set up the Debian way, with «syslog» and «auth.log».',
    },
    arch: {
      id: 'arch', label: 'Arch Linux', short: 'Arch', family: 'Arch Linux, Manjaro, EndeavourOS, CachyOS',
      osName: 'Arch Linux', osId: 'arch', version: '', codename: '', pretty: 'Arch Linux', like: '', build: 'rolling',
      admin: 'wheel', adminGid: 998,
      pm: 'pacman', pmCmds: ['pacman'], lowPm: 'pacman', pkgFormat: '.pkg.tar.zst',
      logs: { syslog: null, auth: null },
      prompt: 'redhat', cronUnit: 'cronie', sshUnit: 'sshd',
      gcc: 'gcc (GCC) 15.1.1 20250425', dig: '9.20.9',
      blurb: 'pacman · the «wheel» group · logs in the journal',
      pkg: {
        refresh: 'sudo pacman -Syu', install: (p) => `sudo pacman -S ${p}`, remove: (p) => `sudo pacman -Rs ${p}`,
        search: (w) => `pacman -Ss ${w}`, list: 'pacman -Q', upgrade: 'sudo pacman -Syu', info: (p) => `pacman -Si ${p}`,
        query: (p) => `pacman -Q ${p}`, owner: (f) => `pacman -Qo ${f}`, files: (p) => `pacman -Ql ${p}`, repos: 'cat /etc/pacman.d/mirrorlist',
        lesson: '«pacman -Syu» syncs the package databases and upgrades everything (on Arch, always together — never «-Sy» on its own) · «pacman -S PKG» installs · «pacman -Rs PKG» removes it and the dependencies nothing else needs · «pacman -Ss WORD» searches · «pacman -Q» lists what\'s installed, «-Qi PKG» details, «-Qo FILE» which package owns a file. Installing and removing need root.',
        refreshWhy: '«pacman -Syu» syncs the package databases and brings everything up to date, «pacman -S» installs (and asks first — Enter says yes).',
      },
      logNote: 'Stock Arch Linux has no «/var/log/syslog»: everything goes to the systemd journal, read with «journalctl» («journalctl -b» this boot, «-u UNIT» one service, «-f» follow). This machine also runs a syslog daemon that writes Debian-style files.',
    },
    opensuse: {
      id: 'opensuse', label: 'openSUSE', short: 'openSUSE', family: 'openSUSE Tumbleweed and Leap, SUSE Linux Enterprise',
      osName: 'openSUSE Tumbleweed', osId: 'opensuse-tumbleweed', version: '20260301', codename: '', pretty: 'openSUSE Tumbleweed', like: 'opensuse suse',
      admin: 'wheel', adminGid: 10,
      pm: 'zypper', pmCmds: ['zypper', 'rpm'], lowPm: 'rpm', pkgFormat: '.rpm',
      logs: { syslog: null, auth: null },
      prompt: 'suse', cronUnit: 'cron', sshUnit: 'sshd',
      gcc: 'gcc (SUSE Linux) 15.1.1 20250418', dig: '9.20.9',
      blurb: 'zypper and rpm · the «wheel» group · logs in the journal',
      pkg: {
        refresh: 'sudo zypper refresh', install: (p) => `sudo zypper install ${p}`, remove: (p) => `sudo zypper remove ${p}`,
        search: (w) => `zypper search ${w}`, list: 'zypper search --installed-only', upgrade: 'sudo zypper dup', info: (p) => `zypper info ${p}`,
        query: (p) => `rpm -q ${p}`, owner: (f) => `rpm -qf ${f}`, files: (p) => `rpm -ql ${p}`, repos: 'zypper repos',
        lesson: '«zypper refresh» (or «ref») refreshes the repositories · «zypper install PKG» («in») installs · «zypper remove PKG» («rm») removes · «zypper search WORD» («se») finds, «se -i» shows what\'s installed · «zypper dup» upgrades a Tumbleweed system («zypper update» on Leap). Under zypper sits «rpm»: «rpm -q PKG», «rpm -qf FILE». Installing and removing need root.',
        refreshWhy: '«zypper refresh» refreshes the repositories, «zypper install» installs (and asks first — Enter says yes).',
      },
      logNote: 'openSUSE keeps its logs in the systemd journal by default — there\'s no «/var/log/syslog» unless you install rsyslog — so you\'d read them with «journalctl». This machine also runs a syslog daemon that writes Debian-style files.',
    },
  };
  /* where the «moo» secret hides: apt and zypper moo; elsewhere, the cow is in the repositories (cowsay) */
  DISTROS.debian.eggHint = 'Some say if you ask the package manager nicely, it moos.';
  DISTROS.opensuse.eggHint = 'Some say if you ask the package manager nicely, it moos.';
  DISTROS.arch.eggHint = 'Some say there is a cow somewhere in the package repositories. (And that pacman has a sweet tooth.)';
  DISTROS.fedora.eggHint = 'Some say there is a cow somewhere in the package repositories.';

  /* the sudo setup this simulator uses for openSUSE: members of wheel give their own password,
     as with openSUSE's «sudo-policy-wheel-auth-self» (the installer's choice when root has no password) */
  DISTROS.opensuse.sudoNote = 'wheel members authenticate with their own password (sudo-policy-wheel-auth-self)';

  LA.DISTROS = DISTROS;
  LA.DISTRO_ORDER = ['debian', 'fedora', 'arch', 'opensuse'];
  /* the distro new worlds are built as (the menu sets it; a saved game restores its own) */
  LA.distroId = 'debian';
  LA.distro = (x) => {
    const id = typeof x === 'string' ? x : x && x.distro ? x.distro : LA.distroId;
    return DISTROS[id] || DISTROS.debian;
  };

  /* package-manager commands, and the distros that ship them */
  const PM_OWNERS = { apt: ['debian'], 'apt-get': ['debian'], 'apt-cache': ['debian'], dpkg: ['debian'], dnf: ['fedora'], yum: ['fedora'], rpm: ['fedora', 'opensuse'], pacman: ['arch'], zypper: ['opensuse'] };
  LA.PM_OWNERS = PM_OWNERS;
  /* a command that belongs to another distro's package manager (so isn't installed here) */
  LA.foreignCmd = (name, id) => !!PM_OWNERS[name] && !PM_OWNERS[name].includes(id || LA.distroId);
  /* every package-manager command (for the curriculum: they all teach "the package manager") */
  LA.isPmCmd = (name) => !!PM_OWNERS[name];

  /* the administrators' group: Debian's «sudo», everyone else's «wheel». Renames in place, keeping order. */
  LA.adaptGroups = (groups, id) => {
    const d = LA.distro(id);
    if (d.admin === 'sudo' || !groups.sudo) return groups;
    const out = {};
    for (const [k, v] of Object.entries(groups)) {
      if (k === 'sudo') out.wheel = Object.assign({}, v, { gid: d.adminGid });
      else out[k] = v;
    }
    for (const k of Object.keys(groups)) delete groups[k];
    return Object.assign(groups, out);
  };

  /* the default bash prompt each distro ships (in color) */
  LA.distroPS1 = (id, root) => {
    const d = LA.distro(id);
    const u = root ? COLOR.root : COLOR.user;
    if (d.prompt === 'redhat') return `[${u}\\u@\\h${COLOR.off} ${COLOR.dir}\\W${COLOR.off}]\\$ `;
    if (d.prompt === 'suse') return root ? `${u}\\h${COLOR.off}:${COLOR.dir}\\w${COLOR.off} # ` : `${u}\\u@\\h${COLOR.off}:${COLOR.dir}\\w${COLOR.off}> `;
    return `${u}\\u@\\h${COLOR.off}:${COLOR.dir}\\w${COLOR.off}\\$ `;
  };

  /* /etc/os-release for a machine of this distro, under the story's own name */
  LA.osRelease = (id, os) => {
    const d = LA.distro(id);
    const like = [d.osId.replace(/-.*/, ''), d.like].filter(Boolean).join(' ').split(' ').filter((x, i, a) => a.indexOf(x) === i).join(' ');
    return `PRETTY_NAME="${os.pretty}"\nNAME="${os.name || os.pretty}"\n${os.version ? `VERSION_ID="${os.version}"\n` : ''}${d.build ? `BUILD_ID=${d.build}\n` : ''}ID=${os.id}\nID_LIKE="${like}"\n${os.url ? `HOME_URL="${os.url}"\n` : ''}`;
  };

  /* where «crontab» keeps each user's table: Debian's cron vs cronie (Fedora, Arch) vs openSUSE's cronie */
  const SPOOL = { debian: '/var/spool/cron/crontabs', fedora: '/var/spool/cron', arch: '/var/spool/cron', opensuse: '/var/spool/cron/tabs' };
  LA.cronSpool = (x) => SPOOL[LA.distro(x).id];

  /* the two daemons every server runs, as each distro packages them */
  const DAEMONS = {
    debian: { cron: { unit: 'cron', comm: 'cron', bin: '/usr/sbin/cron', exec: '/usr/sbin/cron -f', desc: 'Regular background program processing daemon' }, ssh: { unit: 'ssh', desc: 'OpenBSD Secure Shell server' }, unitDir: '/lib/systemd/system' },
    fedora: { cron: { unit: 'crond', comm: 'crond', bin: '/usr/sbin/crond', exec: '/usr/sbin/crond -n', desc: 'Command Scheduler' }, ssh: { unit: 'sshd', desc: 'OpenSSH server daemon' }, unitDir: '/usr/lib/systemd/system' },
    arch: { cron: { unit: 'cronie', comm: 'crond', bin: '/usr/bin/crond', exec: '/usr/bin/crond -n', desc: 'Command Scheduler' }, ssh: { unit: 'sshd', desc: 'OpenSSH Daemon' }, unitDir: '/usr/lib/systemd/system' },
    opensuse: { cron: { unit: 'cron', comm: 'cron', bin: '/usr/sbin/cron', exec: '/usr/sbin/cron -n', desc: 'Command Scheduler' }, ssh: { unit: 'sshd', desc: 'OpenSSH Daemon' }, unitDir: '/usr/lib/systemd/system' },
  };
  LA.daemons = (x) => DAEMONS[LA.distro(x).id];

  /* the package manager's own log and state directory */
  LA.pkgLog = (x, entries) => {
    const d = LA.distro(x);
    const U = LA.util;
    if (d.id === 'debian') return { dir: '/var/lib/dpkg', path: '/var/log/dpkg.log', text: entries.map((e) => `${U.stamp(e.at)} install ${e.pkg}:amd64 <none> ${e.version}\n${U.stamp(e.at)} status installed ${e.pkg}:amd64 ${e.version}\n`).join('') };
    if (d.id === 'arch') return { dir: '/var/lib/pacman', path: '/var/log/pacman.log', text: entries.map((e) => `[${U.strftime('%Y-%m-%dT%H:%M:%S%z', new Date(e.at)).replace(/(\d\d)(\d\d)$/, '$1$2')}] [ALPM] installed ${e.pkg} (${e.version})\n`).join('') };
    if (d.id === 'opensuse') return { dir: '/var/lib/rpm', path: '/var/log/zypp/history', text: entries.map((e) => `${U.strftime('%F %T', new Date(e.at))}|install|${e.pkg}|${e.version}|x86_64|root@localhost|repo-oss|\n`).join('') };
    return { dir: '/var/lib/rpm', path: '/var/log/dnf.rpm.log', text: entries.map((e) => `${U.strftime('%Y-%m-%dT%H:%M:%S%z', new Date(e.at))} SUBDEBUG Installed: ${e.pkg}-${e.version}.x86_64\n`).join('') };
  };

  /* repository configuration files */
  LA.repoFiles = (x, mirror, security) => {
    const d = LA.distro(x);
    if (d.id === 'debian') return { '/etc/apt/sources.list': `deb http://${mirror}/debian bookworm main\ndeb http://${security} bookworm-security main\n` };
    if (d.id === 'arch') return {
      '/etc/pacman.conf': '#\n# /etc/pacman.conf\n#\n# See the pacman.conf(5) manpage for option and repository directives\n\n[options]\nHoldPkg     = pacman glibc\nArchitecture = auto\n#Color\nCheckSpace\nParallelDownloads = 5\nSigLevel    = Required DatabaseOptional\nLocalFileSigLevel = Optional\n\n[core]\nInclude = /etc/pacman.d/mirrorlist\n\n[extra]\nInclude = /etc/pacman.d/mirrorlist\n',
      '/etc/pacman.d/mirrorlist': `##\n## Arch Linux repository mirrorlist\n##\nServer = http://${mirror}/archlinux/$repo/os/$arch\n`,
    };
    if (d.id === 'opensuse') return {
      '/etc/zypp/repos.d/repo-oss.repo': `[repo-oss]\nname=Main Repository (OSS)\nenabled=1\nautorefresh=1\nbaseurl=http://${mirror}/tumbleweed/repo/oss/\ntype=rpm-md\nkeeppackages=0\n`,
      '/etc/zypp/repos.d/repo-update.repo': `[repo-update]\nname=Main Update Repository\nenabled=1\nautorefresh=1\nbaseurl=http://${mirror}/update/tumbleweed/\ntype=rpm-md\n`,
    };
    return {
      '/etc/yum.repos.d/fedora.repo': `[fedora]\nname=Fedora $releasever - $basearch\nbaseurl=http://${mirror}/fedora/releases/$releasever/Everything/$basearch/os/\nenabled=1\ngpgcheck=1\n`,
      '/etc/yum.repos.d/fedora-updates.repo': `[updates]\nname=Fedora $releasever - $basearch - Updates\nbaseurl=http://${mirror}/fedora/updates/$releasever/Everything/$basearch/\nenabled=1\ngpgcheck=1\n`,
      '/etc/dnf/dnf.conf': '[main]\ngpgcheck=True\ninstallonly_limit=3\nclean_requirements_on_remove=True\nbest=False\nskip_if_unavailable=True\n',
    };
  };

  /* a story's own OS, built on this distro: «Meridian Onboard GNU/Linux 12 (bookworm)» becomes «... (Arch-based)» */
  LA.storyOS = (x, os) => {
    const d = LA.distro(x);
    if (d.id === 'debian') return os;
    return Object.assign({}, os, { pretty: os.pretty.replace(/\s*\([^)]*\)\s*$/, '') + ` (${d.short}-based)` });
  };

  /* the sudoers line that makes the admin group admins */
  LA.sudoersAdmin = (x) => `%${LA.distro(x).admin}\tALL=(ALL:ALL) ALL\n`;

  /* story text: {pm}, {pkg:install htop}, {admin}, {distro}, {logNote}, ... */
  LA.distroText = (s, id) => {
    if (!s || s.indexOf('{') < 0) return s;
    const d = LA.distro(id);
    return s.replace(/\{pkg:(\w+)(?: ([^}]+))?\}/g, (m, verb, arg) => {
      const v = d.pkg[verb];
      if (v === undefined) return m;
      return typeof v === 'function' ? v(arg) : v;
    }).replace(/\{(pm|lowPm|admin|adminGid|distro|distroFull|distroFamily|logNote|logLesson|pkgFormat|eggHint)\}/g, (m, k) => {
      if (k === 'distro') return d.short;
      if (k === 'distroFull') return d.label;
      if (k === 'distroFamily') return d.family;
      if (k === 'logLesson') return d.logNote ? `\n:::lesson\n${d.logNote}\n:::` : '';
      return String(d[k]);
    });
  };

  /* the package database as this distro names and versions it */
  const RENAME = {
    fedora: { dnsutils: 'bind-utils', 'openssh-client': 'openssh-clients', procps: 'procps-ng', cron: 'cronie', iproute2: 'iproute', vim: 'vim-enhanced' },
    arch: { dnsutils: 'bind', 'openssh-client': 'openssh', 'openssh-server': null, procps: 'procps-ng', cron: 'cronie' },
    opensuse: { dnsutils: 'bind-utils', 'openssh-client': 'openssh-clients', cron: 'cronie', 'fortune-mod': 'fortune' },
  };
  const upstream = (v) => v.replace(/^\d+:/, '').replace(/[-~+].*$/, '');
  LA.packageDB = (id, pkgs) => {
    const d = LA.distro(id);
    if (d.id === 'debian') return Object.assign({}, pkgs);
    const ren = RENAME[d.id] || {};
    const out = {};
    for (const [name, p] of Object.entries(pkgs)) {
      const n = name in ren ? ren[name] : name;
      if (!n) continue;
      const up = upstream(p.version);
      const version = p.native ? p.version : d.id === 'fedora' ? `${up}-1${d.pkgSuffix}` : d.id === 'arch' ? `${up}-1` : `${up}-1.1`;
      out[n] = Object.assign({}, p, { version, repo: p.repo || (p.cmds.length ? 'extra' : 'core') });
    }
    return out;
  };
  /* a Debian package name as this distro calls it (null if it has no such package) */
  LA.pkgName = (name, id) => {
    const ren = RENAME[LA.distro(id).id] || {};
    return name in ren ? ren[name] : name;
  };
})();
