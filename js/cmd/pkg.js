/* Linux Awakening — package managers: apt/apt-get/apt-cache/dpkg (Debian, Ubuntu), dnf/yum/rpm (Fedora,
   RHEL), pacman (Arch) and zypper/rpm (openSUSE). They share one package database per machine
   (world.packages); each front end speaks its own dialect, output and errors.
   Only the distro's own tools are installed in /usr/bin (see LA.foreignCmd). */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const U = LA.util;
  const A = LA.ansi;
  const def = LA.def;

  /* ---------------- the shared model ---------------- */
  /* which files each package owns (Debian names; LA.pkgName maps them) */
  const FILES = {
    coreutils: ['ls', 'cat', 'cp', 'mv', 'rm', 'mkdir', 'rmdir', 'touch', 'chmod', 'chown', 'chgrp', 'ln', 'pwd', 'echo', 'head', 'tail', 'wc', 'sort', 'uniq', 'cut', 'tr', 'date', 'df', 'du', 'stat', 'basename', 'dirname', 'realpath', 'readlink', 'sha256sum', 'md5sum', 'base64', 'tee', 'env', 'printenv', 'id', 'whoami', 'groups', 'seq', 'expr', 'tac', 'nl', 'paste', 'uname', 'sleep', 'true', 'false', 'test', 'yes', 'shuf', 'split', 'comm', 'printf'].map((c) => '/usr/bin/' + c),
    bash: ['/usr/bin/bash', '/etc/bash.bashrc', '/usr/share/man/man1/bash.1.gz'],
    grep: ['/usr/bin/grep', '/usr/bin/egrep', '/usr/bin/fgrep'],
    sed: ['/usr/bin/sed'],
    gawk: ['/usr/bin/gawk', '/usr/bin/awk'],
    tar: ['/usr/bin/tar'],
    gzip: ['/usr/bin/gzip', '/usr/bin/gunzip', '/usr/bin/zcat', '/usr/bin/zgrep'],
    zip: ['/usr/bin/zip'],
    unzip: ['/usr/bin/unzip'],
    nano: ['/usr/bin/nano', '/etc/nanorc'],
    vim: ['/usr/bin/vim', '/usr/bin/vi'],
    curl: ['/usr/bin/curl'],
    wget: ['/usr/bin/wget'],
    'openssh-client': ['/usr/bin/ssh', '/usr/bin/scp', '/usr/bin/ssh-keygen', '/etc/ssh/ssh_config'],
    'openssh-server': ['/usr/sbin/sshd', '/etc/ssh/sshd_config'],
    tree: ['/usr/bin/tree'],
    less: ['/usr/bin/less'],
    'man-db': ['/usr/bin/man', '/usr/bin/apropos', '/usr/bin/whatis'],
    procps: ['/usr/bin/ps', '/usr/bin/top', '/usr/bin/free', '/usr/bin/pgrep', '/usr/bin/pkill', '/usr/bin/uptime', '/usr/bin/watch', '/usr/bin/w'],
    iproute2: ['/usr/bin/ip', '/usr/bin/ss'],
    dnsutils: ['/usr/bin/dig', '/usr/bin/host', '/usr/bin/nslookup'],
    sudo: ['/usr/bin/sudo', '/etc/sudoers'],
    cron: ['/usr/bin/crontab'],
    bc: ['/usr/bin/bc'],
  };
  /* a package's files on this machine */
  function filesOf(world, name) {
    const id = world.distro;
    const P = world.packages.available[name];
    if (!P) return [];
    const canon = Object.keys(FILES).find((k) => LA.pkgName(k, id) === name);
    let files = canon ? FILES[canon].slice() : [];
    if (id === 'arch' && name === 'openssh') files = files.concat(FILES['openssh-server']);
    if (canon === 'cron') files.push(LA.daemons(world).cron.bin);
    for (const c of P.cmds || []) files.push(`${P.games && id === 'debian' ? '/usr/games' : '/usr/bin'}/${c}`);
    files.push(`/usr/share/doc/${name}/copyright`);
    return [...new Set(files)];
  }
  function ownerOf(world, path) {
    for (const n of world.packages.installed) if (filesOf(world, n).includes(path)) return n;
    return null;
  }
  const kib = (p) => { const m = String((p && p.size) || '420 kB').match(/([\d.]+)\s*(kB|MB)/); return m ? (m[2] === 'MB' ? parseFloat(m[1]) * 1024 : parseFloat(m[1])) : 420; };
  const installed = (world, n) => world.packages.installed.includes(n);
  function doInstall(ctx, n) {
    ctx.world.installPackage(n);
    if (ctx.game) ctx.game.onInstall(n);
  }
  function refreshed(ctx) { ctx.world.aptUpdated = true; ctx.world.pkgRefreshed = true; }
  /* split «-Syu» / «--needed» style arguments into flags and operands */
  function split(args) {
    const flags = [], ops = [];
    for (const a of args) (a.startsWith('-') && a !== '-' ? flags : ops).push(a);
    return { flags, ops };
  }
  async function confirm(ctx, text, defYes) {
    const ans = await ctx.ui.prompt(text, { signal: ctx.signal });
    if (ans === null) return false;
    const a = ans.trim().toLowerCase();
    return a === '' ? defYes : /^y(es)?$/.test(a);
  }
  const say = async (ctx, s, ms = 90) => { ctx.println(s); await ctx.sleep(ms); };
  const mib = (k) => (k / 1024).toFixed(2) + ' MiB';
  const paint = (ctx, code, s) => (ctx.isTTY ? code + s + A.reset : s);

  /* ================= Debian: apt, apt-get, apt-cache, dpkg ================= */
  def('apt', {
    async run(ctx) {
      const args = ctx.args.filter((a) => !/^-(y|-yes|q|qq)$/.test(a));
      const verb = args[0];
      const world = ctx.world;
      const P = world.packages;
      const S = world.sys;
      const lockErr = () => {
        ctx.err.write('E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?\n');
        return 100;
      };
      switch (verb) {
        case undefined: case 'help':
          ctx.println('apt 2.6.1 (amd64)\nUsage: apt [options] command\n\nMost used commands:\n  list - list packages based on package names\n  search - search in package descriptions\n  show - show package details\n  install - install packages\n  remove - remove packages\n  update - update list of available packages\n  upgrade - upgrade the system by installing/upgrading packages\n\n                                        This APT has Super Cow Powers.');
          return 0;
        case 'moo':
          ctx.println('                 (__) \n                 (oo) \n           /------\\/ \n          / |    ||   \n         *  /\\---/\\ \n            ~~   ~~   \n..."Have you mooed today?"...');
          if (ctx.game) ctx.game.secret('moo');
          return 0;
        case 'update':
          if (ctx.user !== 'root') {
            ctx.err.write('Reading package lists... Done\nE: Could not open lock file /var/lib/apt/lists/lock - open (13: Permission denied)\nE: Unable to lock directory /var/lib/apt/lists/\n');
            return 100;
          }
          await say(ctx, `Hit:1 http://${S.mirror}/debian bookworm InRelease`, 120);
          await say(ctx, `Get:2 http://${S.mirror}/debian bookworm-updates InRelease [52.1 kB]`, 120);
          await say(ctx, `Get:3 http://${S.security} bookworm-security InRelease [48.0 kB]`, 120);
          await say(ctx, 'Fetched 100 kB in 1s (98.3 kB/s)');
          await say(ctx, 'Reading package lists... Done');
          await say(ctx, 'Building dependency tree... Done');
          await say(ctx, 'Reading state information... Done');
          ctx.println('All packages are up to date.');
          refreshed(ctx);
          return 0;
        case 'upgrade': case 'full-upgrade': case 'dist-upgrade':
          if (ctx.user !== 'root') return lockErr();
          await say(ctx, 'Reading package lists... Done');
          await say(ctx, 'Building dependency tree... Done');
          await say(ctx, 'Calculating upgrade... Done');
          ctx.println('0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.');
          world.pkgUpgraded = true;
          return 0;
        case 'search': {
          const term = (args[1] || '').toLowerCase();
          if (!term) { ctx.err.write('E: You must give at least one search pattern\n'); return 100; }
          ctx.println('Sorting... Done\nFull Text Search... Done');
          for (const [name, p] of Object.entries(P.available).sort()) {
            if (name.includes(term) || p.desc.toLowerCase().includes(term)) {
              ctx.println(`${paint(ctx, A.green, name)}/stable ${p.version} amd64${installed(world, name) ? ' [installed]' : ''}\n  ${p.desc}\n`);
            }
          }
          return 0;
        }
        case 'list': {
          const inst = args.includes('--installed');
          const pat = args.slice(1).find((a) => !a.startsWith('-'));
          ctx.println('Listing... Done');
          for (const [name, p] of Object.entries(P.available).sort()) {
            if (inst && !installed(world, name)) continue;
            if (pat && !new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$').test(name)) continue;
            ctx.println(`${paint(ctx, A.green, name)}/stable${inst ? ',now' : ''} ${p.version} amd64${installed(world, name) ? ' [installed]' : ''}`);
          }
          return 0;
        }
        case 'show': {
          const p = P.available[args[1]];
          if (!p) { ctx.err.write(`N: Unable to locate package ${args[1]}\nE: No packages found\n`); return 100; }
          ctx.println(`Package: ${args[1]}\nVersion: ${p.version}\nPriority: optional\nSection: ${p.section || 'utils'}\nMaintainer: ${S.packager}\nInstalled-Size: ${p.size || '512 kB'}\nDescription: ${p.desc}\n${p.long ? ' ' + p.long + '\n' : ''}`);
          return 0;
        }
        case 'install': case 'reinstall': {
          const names = args.slice(1).filter((a) => !a.startsWith('-'));
          if (!names.length) { ctx.err.write('E: No packages specified\n'); return 100; }
          if (ctx.user !== 'root') return lockErr();
          await say(ctx, 'Reading package lists... Done');
          await say(ctx, 'Building dependency tree... Done');
          await say(ctx, 'Reading state information... Done');
          for (const n of names) if (!P.available[n]) { ctx.err.write(`E: Unable to locate package ${n}\n`); return 100; }
          const todo = names.filter((n) => !installed(world, n) || verb === 'reinstall');
          for (const n of names.filter((x) => !todo.includes(x))) ctx.println(`${n} is already the newest version (${P.available[n].version}).`);
          if (!todo.length) { ctx.println('0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.'); return 0; }
          ctx.println('The following NEW packages will be installed:\n  ' + todo.join(' '));
          ctx.println(`0 upgraded, ${todo.length} newly installed, 0 to remove and 0 not upgraded.`);
          let i = 1;
          for (const n of todo) await say(ctx, `Get:${i++} http://${S.mirror}/debian bookworm/main amd64 ${n} amd64 ${P.available[n].version} [${P.available[n].size || '120 kB'}]`, 200);
          for (const n of todo) {
            await say(ctx, `Selecting previously unselected package ${n}.`);
            await say(ctx, `Unpacking ${n} (${P.available[n].version}) ...`);
            await say(ctx, `Setting up ${n} (${P.available[n].version}) ...`);
            doInstall(ctx, n);
          }
          ctx.println('Processing triggers for man-db (2.11.2-2) ...');
          return 0;
        }
        case 'remove': case 'purge': case 'autoremove': {
          if (ctx.user !== 'root') return lockErr();
          const names = args.slice(1).filter((a) => !a.startsWith('-'));
          if (verb === 'autoremove' && !names.length) { await say(ctx, 'Reading package lists... Done'); ctx.println('0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.'); return 0; }
          for (const n of names) {
            if (!P.available[n]) { ctx.err.write(`E: Unable to locate package ${n}\n`); return 100; }
            if (!installed(world, n)) { ctx.println(`Package '${n}' is not installed, so not removed`); continue; }
            if (P.available[n].essential) { ctx.err.write('E: Removing essential system-critical packages is not permitted. This might break the system.\n'); return 100; }
            await say(ctx, `Removing ${n} (${P.available[n].version}) ...`);
            if (verb === 'purge') await say(ctx, `Purging configuration files for ${n} (${P.available[n].version}) ...`);
            world.removePackage(n);
          }
          return 0;
        }
        default:
          ctx.err.write(`E: Invalid operation ${verb}\n`);
          return 100;
      }
    },
  });
  LA.commands['apt-get'] = LA.commands.apt;

  def('apt-cache', {
    run(ctx) {
      const [verb, arg] = ctx.args;
      const P = ctx.world.packages;
      if (verb === 'search') {
        if (!arg) { ctx.err.write('E: You must give at least one search pattern\n'); return 100; }
        for (const [n, p] of Object.entries(P.available).sort()) if (n.includes(arg.toLowerCase()) || p.desc.toLowerCase().includes(arg.toLowerCase())) ctx.println(`${n} - ${p.desc}`);
        return 0;
      }
      if (verb === 'show' || verb === 'policy') {
        const p = P.available[arg];
        if (!p) { ctx.err.write(`N: Unable to locate package ${arg}\nE: No packages found\n`); return 100; }
        if (verb === 'show') { ctx.println(`Package: ${arg}\nVersion: ${p.version}\nInstalled-Size: ${p.size || '512 kB'}\nDescription: ${p.desc}\n`); return 0; }
        ctx.println(`${arg}:\n  Installed: ${installed(ctx.world, arg) ? p.version : '(none)'}\n  Candidate: ${p.version}\n  Version table:\n     ${p.version} 500\n        500 http://${ctx.world.sys.mirror}/debian bookworm/main amd64 Packages`);
        return 0;
      }
      ctx.err.write('Usage: apt-cache [options] command\n  search - search the package list for a regex pattern\n  show - show a readable record for the package\n  policy - show policy settings\n');
      return verb ? 100 : 0;
    },
  });

  def('dpkg', {
    run(ctx) {
      const w = ctx.world;
      const P = w.packages;
      const [op, ...rest] = ctx.args;
      const list = (pats) => {
        const names = Object.keys(P.available).filter((n) => installed(w, n)).sort();
        const sel = pats.length ? names.filter((n) => pats.some((p) => new RegExp('^' + p.replace(/\*/g, '.*') + '$').test(n))) : names;
        if (!sel.length) { ctx.err.write(`dpkg-query: no packages found matching ${pats.join(' ')}\n`); return 1; }
        ctx.println('Desired=Unknown/Install/Remove/Purge/Hold\n| Status=Not/Inst/Conf-files/Unpacked/halF-conf/Half-inst/trig-aWait/Trig-pend\n|/ Err?=(none)/Reinst-required (Status,Err: uppercase=bad)\n||/ Name           Version        Architecture Description\n+++-==============-==============-============-=================================');
        for (const n of sel) ctx.println(`ii  ${U.padR(n, 14)} ${U.padR(P.available[n].version, 14)} amd64        ${P.available[n].desc}`);
        return 0;
      };
      switch (op) {
        case '-l': case '--list': return list(rest);
        case '-L': case '--listfiles': {
          if (!rest[0]) { ctx.err.write('dpkg-query: --listfiles needs at least one package name argument\n'); return 1; }
          if (!installed(w, rest[0])) { ctx.err.write(`dpkg-query: package '${rest[0]}' is not installed\nUse dpkg --contents (= dpkg-deb --contents) to list archive files contents.\n`); return 1; }
          ctx.println('/.\n' + filesOf(w, rest[0]).join('\n'));
          return 0;
        }
        case '-S': case '--search': {
          const f = rest[0] ? ctx.abs(rest[0]) : '';
          if (!f) { ctx.err.write('dpkg-query: --search needs at least one file name pattern argument\n'); return 1; }
          const o = ownerOf(w, f) || ownerOf(w, f.replace(/^\/bin\//, '/usr/bin/'));
          if (!o) { ctx.err.write(`dpkg-query: no path found matching pattern ${rest[0]}\n`); return 1; }
          ctx.println(`${o}: ${f}`);
          return 0;
        }
        case '-s': case '--status': {
          const p = P.available[rest[0]];
          if (!p || !installed(w, rest[0])) { ctx.err.write(`dpkg-query: package '${rest[0]}' is not installed and no information is available\n`); return 1; }
          ctx.println(`Package: ${rest[0]}\nStatus: install ok installed\nPriority: optional\nSection: ${p.section || 'utils'}\nInstalled-Size: ${Math.round(kib(p))}\nArchitecture: amd64\nVersion: ${p.version}\nDescription: ${p.desc}`);
          return 0;
        }
        case '-i': case '--install':
          if (ctx.user !== 'root') { ctx.err.write('dpkg: error: requested operation requires superuser privilege\n'); return 2; }
          ctx.err.write(`dpkg: error: cannot access archive '${rest[0] || ''}': No such file or directory\n`);
          return 2;
        case '--version':
          ctx.println('Debian \'dpkg\' package management program version 1.21.22 (amd64).');
          return 0;
        default:
          ctx.err.write('dpkg: error: need an action option\n\nType dpkg --help for help about installing and deinstalling packages [*];\nUse \'apt\' or \'aptitude\' for user-friendly package management;\nType dpkg -Dhelp for a list of dpkg debug flag values;\nType dpkg --force-help for a list of forcing options;\nType dpkg-deb --help for help about manipulating *.deb files;\n');
          return 2;
      }
    },
  });

  /* ================= RPM: shared by Fedora and openSUSE ================= */
  const nevra = (n, p) => `${n}-${p.version}.${p.noarch ? 'noarch' : 'x86_64'}`;
  def('rpm', {
    run(ctx) {
      const w = ctx.world;
      const P = w.packages;
      const { flags, ops } = split(ctx.args);
      const f = flags.join('').replace(/-/g, '');
      if (f === 'version' || ctx.args.includes('--version')) { ctx.println('RPM version 4.20.1'); return 0; }
      if (f.startsWith('e') || ctx.args.includes('--erase')) {
        if (ctx.user !== 'root') { ctx.err.write(`error: can't create transaction lock on /usr/lib/sysimage/rpm/.rpm.lock (Permission denied)\n`); return 1; }
        for (const n of ops) {
          if (!installed(w, n)) { ctx.err.write(`error: package ${n} is not installed\n`); return 1; }
          if (P.available[n].essential) { ctx.err.write(`error: Failed dependencies:\n\t${n} is needed by (installed) systemd\n`); return 1; }
          w.removePackage(n);
        }
        return 0;
      }
      if (f.startsWith('i') || f.startsWith('U')) {
        if (ctx.user !== 'root') { ctx.err.write(`error: can't create transaction lock on /usr/lib/sysimage/rpm/.rpm.lock (Permission denied)\n`); return 1; }
        ctx.err.write(`error: open of ${ops[0] || ''} failed: No such file or directory\n`);
        return 1;
      }
      if (!f.startsWith('q')) { ctx.err.write('rpm: no operation specified\nTry rpm --help for more information.\n'); return 1; }
      const all = f.includes('a');
      if (f.includes('f')) {
        let st = 0;
        for (const x of ops) {
          const abs = ctx.abs(x);
          const o = ownerOf(w, abs);
          if (o) ctx.println(nevra(o, P.available[o]));
          else if (!ctx.fs.tryGet(abs)) { ctx.err.write(`error: file ${abs}: No such file or directory\n`); st = 1; } else { ctx.println(`file ${abs} is not owned by any package`); st = 1; }
        }
        return st;
      }
      const names = all ? w.packages.installed.slice().sort() : ops;
      if (!names.length) { ctx.err.write('rpm: no arguments given for query\n'); return 1; }
      let st = 0;
      for (const n of names) {
        const p = P.available[n];
        if (!p || !installed(w, n)) { ctx.println(`package ${n} is not installed`); st = 1; continue; }
        if (f.includes('l')) { ctx.println(filesOf(w, n).join('\n')); continue; }
        if (f.includes('i')) {
          ctx.println(`Name        : ${n}\nVersion     : ${p.version.split('-')[0]}\nRelease     : ${p.version.split('-').slice(1).join('-')}\nArchitecture: x86_64\nSize        : ${Math.round(kib(p) * 1024)}\nSummary     : ${p.desc}\nDescription :\n${p.long || p.desc}.`);
          continue;
        }
        ctx.println(nevra(n, p));
      }
      return st;
    },
  });

  /* ================= Fedora / RHEL: dnf (and yum) ================= */
  def('dnf', {
    async run(ctx) {
      const w = ctx.world;
      const P = w.packages;
      const D = LA.distro(w);
      const { flags, ops } = split(ctx.args);
      const yes = flags.some((x) => x === '-y' || x === '--assumeyes');
      const verb = ops.shift();
      const rel = D.version || '42';
      const needRoot = () => { ctx.err.write('This command has to be run with superuser privileges (under the root user on most systems).\n'); return 1; };
      const loadRepos = async () => {
        if (w.pkgRefreshed) return;
        await say(ctx, 'Updating and loading repositories:');
        await say(ctx, ` Fedora ${rel} - x86_64                            100% |  12.1 MiB/s |  35.2 MiB |  00m03s`, 200);
        await say(ctx, ` Fedora ${rel} - x86_64 - Updates                  100% |   9.8 MiB/s |  12.0 MiB |  00m01s`, 150);
        await say(ctx, 'Repositories loaded.');
        refreshed(ctx);
      };
      const match = (term) => Object.entries(P.available).filter(([n, p]) => n.includes(term) || p.desc.toLowerCase().includes(term)).sort();
      switch (verb) {
        case undefined: case 'help':
          ctx.println('Usage:\n  dnf [GLOBAL OPTIONS] <COMMAND> ...\n\nSoftware Management Commands:\n  install          Install software\n  upgrade          Upgrade software\n  remove           Remove (uninstall) software\n  search           Search for software\n  info             Provide detailed information about installed or available packages\n  list             List installed or available packages\n  provides         Find what package provides the given value\n  makecache        Generate the metadata cache\n  history          Manage transaction history');
          return verb ? 0 : 1;
        case 'makecache':
          if (ctx.user !== 'root') {
            ctx.println('Updating and loading repositories:');
            ctx.println('Repositories loaded.');
            ctx.println('Metadata cache created.');
            return 0;
          }
          w.pkgRefreshed = false;
          await loadRepos();
          ctx.println('Metadata cache created.');
          return 0;
        case 'check-update': case 'check-upgrade':
          await loadRepos();
          return 0;
        case 'search': {
          const term = (ops[0] || '').toLowerCase();
          if (!term) { ctx.err.write('Missing positional argument "patterns" for command "search"\n'); return 2; }
          await loadRepos();
          const m = match(term);
          if (!m.length) { ctx.println(`No matches found.`); return 0; }
          ctx.println(`Matched fields: name, summary`);
          for (const [n, p] of m) ctx.println(` ${paint(ctx, A.bold, n)}.x86_64\t${p.desc}`);
          return 0;
        }
        case 'list': {
          const inst = flags.includes('--installed') || ops[0] === 'installed';
          const avail = flags.includes('--available') || ops[0] === 'available';
          const rows = Object.entries(P.available).sort().filter(([n]) => (inst ? installed(w, n) : avail ? !installed(w, n) : true));
          if (!inst) await loadRepos();
          if (inst || !avail) {
            ctx.println('Installed packages');
            for (const [n, p] of rows.filter(([x]) => installed(w, x))) ctx.println(`${U.padR(n + '.x86_64', 26)} ${U.padR(p.version, 20)} <unknown>`);
          }
          if (!inst) {
            ctx.println('\nAvailable packages');
            for (const [n, p] of rows.filter(([x]) => !installed(w, x))) ctx.println(`${U.padR(n + '.x86_64', 26)} ${U.padR(p.version, 20)} ${p.cmds.length ? 'fedora' : 'updates'}`);
          }
          return 0;
        }
        case 'info': {
          const n = ops[0];
          const p = P.available[n];
          if (!p) { ctx.err.write(`No matching packages to list\n`); return 1; }
          if (!installed(w, n)) await loadRepos();
          ctx.println(`${installed(w, n) ? 'Installed' : 'Available'} packages\nName            : ${n}\nEpoch           : 0\nVersion         : ${p.version.split('-')[0]}\nRelease         : ${p.version.split('-').slice(1).join('-')}\nArchitecture    : x86_64\nInstalled size  : ${kib(p).toFixed(1)} KiB\nRepository      : ${installed(w, n) ? '@System' : 'fedora'}\nSummary         : ${p.desc}\nDescription     : ${p.long || p.desc + '.'}`);
          return 0;
        }
        case 'provides': case 'whatprovides': {
          const q = ops[0] || '';
          const path = q.startsWith('/') ? q : '/usr/bin/' + q;
          await loadRepos();
          const hit = Object.keys(P.available).find((n) => filesOf(w, n).includes(path));
          if (!hit) { ctx.err.write(`No matches found. If searching for a file, try specifying the full path or using a wildcard prefix ("*/") at the beginning.\n`); return 1; }
          const p = P.available[hit];
          ctx.println(`${nevra(hit, p)} : ${p.desc}\nRepo         : ${installed(w, hit) ? '@System' : 'fedora'}\nMatched From :\nFilename     : ${path}`);
          return 0;
        }
        case 'repolist':
          ctx.println(`repo id                 repo name\nfedora                  Fedora ${rel} - x86_64\nupdates                 Fedora ${rel} - x86_64 - Updates`);
          return 0;
        case 'history':
          ctx.println('ID Command line                Date and time       Action(s) Altered\n 1 dnf install @server-product 2026-01-12 09:14:02                 412');
          return 0;
        case 'install': case 'in': case 'reinstall': {
          if (!ops.length) { ctx.err.write('Missing positional argument "specs" for command "install"\n'); return 2; }
          if (ctx.user !== 'root') return needRoot();
          await loadRepos();
          const bad = ops.filter((n) => !P.available[n]);
          if (bad.length) {
            ctx.err.write(`Failed to resolve the transaction:\nNo match for argument: ${bad[0]}\nYou can try to add to command line:\n  --skip-unavailable to skip unavailable packages\n`);
            return 1;
          }
          for (const n of ops.filter((x) => installed(w, x) && verb !== 'reinstall')) ctx.println(`Package "${nevra(n, P.available[n])}" is already installed.`);
          const todo = ops.filter((n) => !installed(w, n) || verb === 'reinstall');
          if (!todo.length) { ctx.println('\nNothing to do.'); return 0; }
          const size = todo.reduce((a, n) => a + kib(P.available[n]), 0);
          ctx.println(`Package                    Arch     Version                Repository      Size\n${verb === 'reinstall' ? 'Reinstalling' : 'Installing'}:`);
          for (const n of todo) ctx.println(` ${U.padR(n, 26)} x86_64   ${U.padR(P.available[n].version, 22)} fedora   ${U.padL(kib(P.available[n]).toFixed(1), 6)} KiB`);
          ctx.println(`\nTransaction Summary:\n ${verb === 'reinstall' ? 'Reinstalling' : 'Installing'}:        ${todo.length} package${todo.length > 1 ? 's' : ''}\n\nTotal size of inbound packages is ${Math.round(size * 0.4)} KiB. Need to download ${Math.round(size * 0.4)} KiB.\nAfter this operation, ${Math.round(size)} KiB extra will be used (install ${Math.round(size)} KiB, remove 0 B).`);
          if (!yes && !(await confirm(ctx, 'Is this ok [y/N]: ', false))) { ctx.err.write('Operation aborted by the user.\n'); return 1; }
          let i = 1;
          for (const n of todo) await say(ctx, `[${i++}/${todo.length * 2}] ${nevra(n, P.available[n])}.rpm  100% | 1.2 MiB/s | ${Math.round(kib(P.available[n]) * 0.4)} KiB |  00m00s`, 150);
          ctx.println('Running transaction');
          for (const n of todo) { await say(ctx, `[${i++}/${todo.length * 2}] Installing ${nevra(n, P.available[n])}  100% | ${kib(P.available[n]).toFixed(1)} KiB`, 120); doInstall(ctx, n); }
          ctx.println('Complete!');
          return 0;
        }
        case 'remove': case 'rm': case 'erase': case 'autoremove': {
          if (ctx.user !== 'root') return needRoot();
          if (verb === 'autoremove' && !ops.length) { ctx.println('Nothing to do.'); return 0; }
          if (!ops.length) { ctx.err.write('Missing positional argument "specs" for command "remove"\n'); return 2; }
          const todo = ops.filter((n) => installed(w, n));
          for (const n of ops.filter((x) => !installed(w, x))) ctx.err.write(`No packages to remove for argument: ${n}\n`);
          if (!todo.length) { ctx.println('\nNothing to do.'); return 0; }
          const ess = todo.find((n) => P.available[n].essential);
          if (ess) { ctx.err.write(`Failed to resolve the transaction:\nProblem: The operation would result in removing the following protected packages: ${ess}\n`); return 1; }
          ctx.println('Package                    Arch     Version                Repository      Size\nRemoving:');
          for (const n of todo) ctx.println(` ${U.padR(n, 26)} x86_64   ${U.padR(P.available[n].version, 22)} fedora   ${U.padL(kib(P.available[n]).toFixed(1), 6)} KiB`);
          ctx.println(`\nTransaction Summary:\n Removing:          ${todo.length} package${todo.length > 1 ? 's' : ''}`);
          if (!yes && !(await confirm(ctx, 'Is this ok [y/N]: ', false))) { ctx.err.write('Operation aborted by the user.\n'); return 1; }
          ctx.println('Running transaction');
          let i = 1;
          for (const n of todo) { await say(ctx, `[${i++}/${todo.length}] Removing ${nevra(n, P.available[n])}  100%`); w.removePackage(n); }
          ctx.println('Complete!');
          return 0;
        }
        case 'upgrade': case 'update': case 'distro-sync':
          if (ctx.user !== 'root') return needRoot();
          await loadRepos();
          ctx.println('Nothing to do.');
          w.pkgUpgraded = true;
          return 0;
        case 'clean':
          ctx.println('Removed 24 files, 13 directories (total of 47 MiB). 0 errors occurred.');
          w.pkgRefreshed = false;
          return 0;
        default:
          ctx.err.write(`Unknown argument "${verb}" for command "dnf". Add "--help" for more information about the arguments.\n`);
          return 2;
      }
    },
  });
  LA.commands.yum = LA.commands.dnf;

  /* ================= Arch: pacman ================= */
  def('pacman', {
    async run(ctx) {
      const w = ctx.world;
      const P = w.packages;
      const { flags, ops } = split(ctx.args);
      const LONG = { '--sync': 'S', '--remove': 'R', '--query': 'Q', '--refresh': 'y', '--sysupgrade': 'u', '--search': 's', '--info': 'i', '--list': 'l', '--owns': 'o', '--recursive': 's', '--nosave': 'n', '--explicit': 'e', '--deps': 'd', '--unrequired': 't', '--upgrades': 'u' };
      let letters = '';
      for (const x of flags) {
        if (x.startsWith('--')) { if (LONG[x]) letters += LONG[x]; continue; }
        letters += x.slice(1);
      }
      const noconfirm = flags.includes('--noconfirm');
      const needed = flags.includes('--needed');
      const op = (letters.match(/[SRQUFDTV]/) || [])[0];
      const has = (c) => letters.replace(op, '').includes(c);
      const notRoot = () => { ctx.err.write('error: you cannot perform this operation unless you are root.\n'); return 1; };
      /* the classic Arch easter egg: «ILoveCandy» in /etc/pacman.conf turns progress bars into Pac-Man */
      const conf = ctx.fs.tryGet('/etc/pacman.conf');
      const options = conf ? (ctx.fs.contentOf(conf).split(/^\s*\[/m).find((sec) => /^options\]/.test(sec)) || '') : '';
      const candy = /^\s*ILoveCandy\b/m.test(options);
      const bar = (label) => {
        const w0 = 22;
        if (!candy) return `${U.padR(label, 50)} [${'#'.repeat(w0)}] 100%`;
        return `${U.padR(label, 50)} [${'-'.repeat(w0 - 1)}C] 100%`;
      };
      const ver = (n) => `${n}-${P.available[n].version}`;
      if (!op) {
        if (ctx.args.includes('--version') || ctx.args.includes('-V')) { ctx.println(' .--.                  Pacman v7.0.0 - libalpm v15.0.0\n/ _.-\' .-.  .-.  .-.   Copyright (C) 2006-2024 Pacman Development Team\n\\  \'-. \'-\'  \'-\'  \'-\'   Copyright (C) 2002-2006 Judd Vinet\n \'--\''); return 0; }
        ctx.err.write('error: no operation specified (use -h for help)\n');
        return 1;
      }
      const repoOf = (p) => (p.cmds && p.cmds.length ? 'extra' : 'core');
      if (op === 'S') {
        if (has('s')) {
          const term = (ops[0] || '').toLowerCase();
          let any = false;
          for (const [n, p] of Object.entries(P.available).sort()) {
            if (term && !n.includes(term) && !p.desc.toLowerCase().includes(term)) continue;
            any = true;
            ctx.println(`${paint(ctx, A.magenta, repoOf(p) + '/')}${paint(ctx, A.bold, n)} ${paint(ctx, A.green, p.version)}${installed(w, n) ? paint(ctx, A.cyan, ' [installed]') : ''}\n    ${p.desc}`);
          }
          return any ? 0 : 1;
        }
        if (has('i')) {
          let st = 0;
          for (const n of ops) {
            const p = P.available[n];
            if (!p) { ctx.err.write(`error: package '${n}' was not found\n`); st = 1; continue; }
            ctx.println(`Repository      : ${repoOf(p)}\nName            : ${n}\nVersion         : ${p.version}\nDescription     : ${p.desc}\nArchitecture    : x86_64\nInstalled Size  : ${kib(p).toFixed(2)} KiB\nPackager        : Arch Linux packagers\n`);
          }
          return st;
        }
        if (has('y') || has('u') || ops.length) { if (ctx.user !== 'root') return notRoot(); }
        if (has('y')) {
          await say(ctx, ':: Synchronizing package databases...');
          await say(ctx, ' core                 117.4 KiB   587 KiB/s 00:00 [######################] 100%', 200);
          await say(ctx, ' extra                  7.8 MiB  9.71 MiB/s 00:01 [######################] 100%', 200);
          refreshed(ctx);
        }
        if (has('u')) {
          await say(ctx, ':: Starting full system upgrade...');
          if (has('y')) w.pkgUpgraded = true;
          if (!ops.length) { ctx.println(' there is nothing to do'); return 0; }
        }
        if (!ops.length) return 0;
        const bad = ops.filter((n) => !P.available[n]);
        if (bad.length) { for (const n of bad) ctx.err.write(`error: target not found: ${n}\n`); return 1; }
        let todo = ops;
        for (const n of ops.filter((x) => installed(w, x))) ctx.err.write(needed ? `warning: ${ver(n)} is up to date -- skipping\n` : `warning: ${ver(n)} is up to date -- reinstalling\n`);
        if (needed) todo = ops.filter((n) => !installed(w, n));
        if (!todo.length) { ctx.println(' there is nothing to do'); return 0; }
        const size = todo.reduce((a, n) => a + kib(P.available[n]), 0);
        ctx.println('resolving dependencies...\nlooking for conflicting packages...\n');
        ctx.println(`Packages (${todo.length}) ${todo.map(ver).join('  ')}\n\nTotal Download Size:   ${mib(size * 0.4)}\nTotal Installed Size:  ${mib(size)}\n`);
        if (!noconfirm && !(await confirm(ctx, ':: Proceed with installation? [Y/n] ', true))) return 1;
        await say(ctx, ':: Retrieving packages...');
        for (const n of todo) await say(ctx, ` ${ver(n)}-x86_64 downloading...`, 150);
        for (const label of ['checking keys in keyring', 'checking package integrity', 'loading package files', 'checking for file conflicts']) ctx.println(bar(`(${todo.length}/${todo.length}) ${label}`));
        ctx.println(':: Processing package changes...');
        todo.forEach((n, i) => { ctx.println(bar(`(${i + 1}/${todo.length}) installing ${n}`)); doInstall(ctx, n); });
        ctx.println(':: Running post-transaction hooks...\n(1/1) Arming ConditionNeedsUpdate...');
        return 0;
      }
      if (op === 'R') {
        if (!ops.length) { ctx.err.write('error: no targets specified (use -h for help)\n'); return 1; }
        if (ctx.user !== 'root') return notRoot();
        const bad = ops.filter((n) => !installed(w, n));
        if (bad.length) { for (const n of bad) ctx.err.write(`error: target not found: ${n}\n`); return 1; }
        const ess = ops.find((n) => P.available[n].essential);
        if (ess) { ctx.err.write(`checking dependencies...\nerror: failed to prepare transaction (could not satisfy dependencies)\n:: removing ${ess} breaks dependency '${ess}' required by base\n`); return 1; }
        const size = ops.reduce((a, n) => a + kib(P.available[n]), 0);
        ctx.println(`checking dependencies...\n\nPackages (${ops.length}) ${ops.map(ver).join('  ')}\n\nTotal Removed Size:  ${mib(size)}\n`);
        if (!noconfirm && !(await confirm(ctx, ':: Do you want to remove these packages? [Y/n] ', true))) return 1;
        ctx.println(':: Processing package changes...');
        ops.forEach((n, i) => { ctx.println(bar(`(${i + 1}/${ops.length}) removing ${n}`)); w.removePackage(n); });
        return 0;
      }
      if (op === 'Q') {
        const inst = w.packages.installed.filter((n) => P.available[n]).sort();
        if (has('o')) {
          if (!ops.length) { ctx.err.write('error: no file was specified for --owns\n'); return 1; }
          let st = 0;
          for (const x of ops) {
            const abs = x.includes('/') ? ctx.abs(x) : (ctx.shell.findExecutable(x, ctx.user) || {}).path || x;
            const o = ownerOf(w, abs.replace(/^\/bin\//, '/usr/bin/').replace(/^\/usr\/sbin\//, '/usr/sbin/'));
            if (o) ctx.println(`${abs} is owned by ${o} ${P.available[o].version}`);
            else if (!ctx.fs.tryGet(abs)) { ctx.err.write(`error: failed to find '${x}' in PATH: No such file or directory\n`); st = 1; } else { ctx.err.write(`error: No package owns ${abs}\n`); st = 1; }
          }
          return st;
        }
        if (has('s')) {
          const term = (ops[0] || '').toLowerCase();
          const hits = inst.filter((n) => n.includes(term) || P.available[n].desc.toLowerCase().includes(term));
          for (const n of hits) ctx.println(`${paint(ctx, A.magenta, 'local/')}${paint(ctx, A.bold, n)} ${paint(ctx, A.green, P.available[n].version)}\n    ${P.available[n].desc}`);
          return hits.length ? 0 : 1;
        }
        let names = ops.length ? ops : inst;
        if (has('e') && !ops.length) names = inst.filter((n) => P.available[n].cmds.length);
        if (has('d') && has('t') && !ops.length) return 1;
        let st = 0;
        for (const n of names) {
          const p = P.available[n];
          if (!p || !installed(w, n)) { ctx.err.write(`error: package '${n}' was not found\n`); st = 1; continue; }
          if (has('l')) { for (const f of filesOf(w, n)) ctx.println(`${n} ${f}`); continue; }
          if (has('i')) { ctx.println(`Name            : ${n}\nVersion         : ${p.version}\nDescription     : ${p.desc}\nArchitecture    : x86_64\nInstalled Size  : ${kib(p).toFixed(2)} KiB\nInstall Reason  : ${p.cmds.length ? 'Explicitly installed' : 'Installed as a dependency for another package'}\n`); continue; }
          ctx.println(`${has('q') ? n : `${paint(ctx, A.bold, n)} ${paint(ctx, A.green, p.version)}`}`);
        }
        return st;
      }
      ctx.err.write(`error: invalid option '-${op}'\n`);
      return 1;
    },
  });

  /* ================= openSUSE: zypper ================= */
  def('zypper', {
    async run(ctx) {
      const w = ctx.world;
      const P = w.packages;
      const { flags, ops } = split(ctx.args);
      const yes = flags.some((x) => ['-y', '--no-confirm', '-n', '--non-interactive'].includes(x));
      const verb = ops.shift();
      const notRoot = (what) => { ctx.err.write(what === 'refresh' ? 'Root privileges are required for refreshing system repositories.\n' : 'Root privileges are required to run this command.\n'); return 5; };
      const loading = async () => { await say(ctx, 'Loading repository data...'); await say(ctx, 'Reading installed packages...'); };
      const ALIAS = { ref: 'refresh', in: 'install', rm: 'remove', se: 'search', if: 'info', up: 'update', dup: 'dist-upgrade', lr: 'repos', lu: 'list-updates', pa: 'packages', ve: 'verify' };
      const v = ALIAS[verb] || verb;
      const table = (rows) => {
        const wN = Math.max(4, ...rows.map((r) => r[1].length)), wS = Math.max(7, ...rows.map((r) => r[2].length));
        ctx.println(`S  | ${U.padR('Name', wN)} | ${U.padR('Summary', wS)} | Type\n---+-${'-'.repeat(wN)}-+-${'-'.repeat(wS)}-+--------`);
        for (const r of rows) ctx.println(`${U.padR(r[0], 2)} | ${U.padR(r[1], wN)} | ${U.padR(r[2], wS)} | package`);
      };
      switch (v) {
        case undefined: case 'help':
          ctx.println('  Usage:\n\tzypper [--global-options] <command> [--command-options] [arguments]\n\n  Software Management:\n\tinstall, in\t\tInstall packages.\n\tremove, rm\t\tRemove packages.\n\tverify, ve\t\tVerify integrity of package dependencies.\n\n  Update Management:\n\tupdate, up\t\tUpdate installed packages with newer versions.\n\tdist-upgrade, dup\tPerform a distribution upgrade.\n\n  Querying:\n\tsearch, se\t\tSearch for packages matching a pattern.\n\tinfo, if\t\tShow full information for specified packages.\n\n  Repository Management:\n\trepos, lr\t\tList all defined repositories.\n\trefresh, ref\t\tRefresh all repositories.');
          return 0;
        case 'moo':
          ctx.println('\n   \\|/          (__)\n        `\\------(oo)\n          ||    (__)\n          ||w--||     \\|/\n      \\|/\n');
          if (ctx.game) ctx.game.secret('moo');
          return 0;
        case 'refresh':
          if (ctx.user !== 'root') return notRoot('refresh');
          await say(ctx, "Retrieving repository 'Main Repository (OSS)' metadata ..................[done]", 200);
          await say(ctx, "Building repository 'Main Repository (OSS)' cache .......................[done]", 120);
          await say(ctx, "Retrieving repository 'Main Update Repository' metadata .................[done]", 150);
          await say(ctx, "Building repository 'Main Update Repository' cache ......................[done]", 120);
          ctx.println('All repositories have been refreshed.');
          refreshed(ctx);
          return 0;
        case 'repos':
          ctx.println('#  | Alias       | Name                   | Enabled | GPG Check | Refresh\n---+-------------+------------------------+---------+-----------+--------\n 1 | repo-oss    | Main Repository (OSS)  | Yes     | (r ) Yes  | Yes\n 2 | repo-update | Main Update Repository | Yes     | (r ) Yes  | Yes');
          return 0;
        case 'search': case 'packages': {
          const instOnly = flags.includes('-i') || flags.includes('--installed-only');
          const term = (ops[0] || '').toLowerCase();
          await loading();
          ctx.println('');
          const rows = Object.entries(P.available).sort().filter(([n, p]) => (!term || n.includes(term) || p.desc.toLowerCase().includes(term)) && (!instOnly || installed(w, n)))
            .map(([n, p]) => [installed(w, n) ? (p.cmds.length ? 'i+' : 'i') : '', n, p.desc]);
          if (!rows.length) { ctx.println('No matching items found.'); return 104; }
          table(rows);
          return 0;
        }
        case 'info': {
          await loading();
          let st = 0;
          for (const n of ops) {
            const p = P.available[n];
            if (!p) { ctx.println(`package '${n}' not found.`); st = 104; continue; }
            ctx.println(`\nInformation for package ${n}:\n${'-'.repeat(24 + n.length)}\nRepository     : Main Repository (OSS)\nName           : ${n}\nVersion        : ${p.version}\nArch           : x86_64\nVendor         : openSUSE\nInstalled Size : ${kib(p).toFixed(1)} KiB\nInstalled      : ${installed(w, n) ? 'Yes' : 'No'}\nStatus         : ${installed(w, n) ? 'up-to-date' : 'not installed'}\nSummary        : ${p.desc}\nDescription    :\n    ${p.long || p.desc + '.'}`);
          }
          return st;
        }
        case 'install': {
          if (!ops.length) { ctx.err.write('Too few arguments.\nAt least one package name is required.\n'); return 1; }
          if (ctx.user !== 'root') return notRoot();
          await loading();
          await say(ctx, 'Resolving package dependencies...');
          const bad = ops.filter((n) => !P.available[n]);
          if (bad.length) { ctx.println(`Package '${bad[0]}' not found.`); return 104; }
          for (const n of ops.filter((x) => installed(w, x))) ctx.println(`'${n}' is already installed.\nNo update candidate for '${n}-${P.available[n].version}.x86_64'. The highest available version is already installed.`);
          const todo = ops.filter((n) => !installed(w, n));
          if (!todo.length) { ctx.println('Nothing to do.'); return 0; }
          const size = todo.reduce((a, n) => a + kib(P.available[n]), 0);
          ctx.println(`\nThe following ${todo.length > 1 ? `${todo.length} NEW packages are` : 'NEW package is'} going to be installed:\n  ${todo.join(' ')}\n\n${todo.length} new package${todo.length > 1 ? 's' : ''} to install.\n\nPackage download size:    ${Math.round(size * 0.4)} KiB\n\nPackage install size change:\n              |      ${Math.round(size)} KiB  required by packages that will be installed\n   ${Math.round(size)} KiB    |  -      0 B    released by packages that will be removed\n`);
          if (!yes && !(await confirm(ctx, 'Continue? [y/n/v/...? shows all options] (y): ', true))) return 1;
          let i = 1;
          for (const n of todo) await say(ctx, `Retrieving: ${n}-${P.available[n].version}.x86_64 (Main Repository (OSS))     (${i++}/${todo.length}), ${Math.round(kib(P.available[n]) * 0.4)}.0 KiB`, 150);
          ctx.println('\nChecking for file conflicts: ..............................................[done]');
          i = 1;
          for (const n of todo) { await say(ctx, `(${i++}/${todo.length}) Installing: ${n}-${P.available[n].version}.x86_64 .................................[done]`); doInstall(ctx, n); }
          ctx.println('Running post-transaction scripts .........................................[done]');
          return 0;
        }
        case 'remove': {
          if (!ops.length) { ctx.err.write('Too few arguments.\nAt least one package name is required.\n'); return 1; }
          if (ctx.user !== 'root') return notRoot();
          await loading();
          await say(ctx, 'Resolving package dependencies...');
          const todo = ops.filter((n) => installed(w, n));
          for (const n of ops.filter((x) => !installed(w, x))) ctx.println(`'${n}' not found in package names. Trying capabilities.\nNo provider of '${n}' found.`);
          if (!todo.length) { ctx.println('Nothing to do.'); return 104; }
          const ess = todo.find((n) => P.available[n].essential);
          if (ess) { ctx.err.write(`Problem: the to be deleted package ${ess} is a protected package\n`); return 4; }
          ctx.println(`\nThe following ${todo.length > 1 ? `${todo.length} packages are` : 'package is'} going to be REMOVED:\n  ${todo.join(' ')}\n\n${todo.length} package${todo.length > 1 ? 's' : ''} to remove.`);
          if (!yes && !(await confirm(ctx, 'Continue? [y/n/v/...? shows all options] (y): ', true))) return 1;
          let i = 1;
          for (const n of todo) { await say(ctx, `(${i++}/${todo.length}) Removing ${n}-${P.available[n].version}.x86_64 ..................................[done]`); w.removePackage(n); }
          return 0;
        }
        case 'update': case 'dist-upgrade': case 'list-updates':
          if (v !== 'list-updates' && ctx.user !== 'root') return notRoot();
          await loading();
          if (v === 'dist-upgrade') ctx.println('Computing distribution upgrade...');
          ctx.println('Nothing to do.');
          if (v !== 'list-updates') w.pkgUpgraded = true;
          return 0;
        default:
          ctx.err.write(`Unknown command '${verb}'\n\nType 'zypper help' to get a list of global options and commands.\n`);
          return 1;
      }
    },
  });
})();
