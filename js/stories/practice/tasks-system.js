/* Practice Range — tasks: permissions & users, processes, services/cron/disks, archives & checksums. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const P = LA.practice;
  const T = P.task;
  const U = LA.util;
  const pack = LA.stories.practice;
  const { sameSet } = P.h;

  /* ===================== permissions & users ===================== */
  T({
    id: 'perm-exec', topic: 'perms', level: 1, cmds: ['chmod'], title: 'Make it runnable',
    setup(t) { const w = t.word(); t.file('~/bin/greet.sh', `#!/bin/bash\necho "hello from ${w}"\n`, { mode: 0o644 }); return { w }; },
    prompt: '«~/bin/greet.sh» refuses to run («Permission denied»). Make it executable, then run it.',
    check: (e, x) => (e.mode('~/bin/greet.sh') & 0o100) !== 0 && !!e.event('script', (ev) => /greet\.sh$/.test(ev.path)) && e.out().includes('hello from ' + x.w),
    hints: ['«chmod +x FILE» adds execute permission.', 'Then run it with its path: «~/bin/greet.sh».'],
    solution: ['chmod +x ~/bin/greet.sh', '~/bin/greet.sh'],
  });
  T({
    id: 'perm-600', topic: 'perms', level: 1, cmds: ['chmod'], title: 'A private key',
    setup(t) { t.file('~/.ssh/deploy_key', '-----BEGIN OPENSSH PRIVATE KEY-----\nxxxx\n-----END OPENSSH PRIVATE KEY-----\n', { mode: 0o644 }); },
    prompt: 'SSH refuses to use «~/.ssh/deploy_key» because others can read it. Make it readable and writable by you only — nobody else gets anything.',
    check: (e) => e.mode('~/.ssh/deploy_key') === 0o600,
    hints: ['In octal: owner rw = 6, group 0, others 0.'],
    solution: ['chmod 600 ~/.ssh/deploy_key'],
    why: '4 = read, 2 = write, 1 = execute, added up per digit: owner, group, others. 600 = rw-------.',
  });
  T({
    id: 'perm-symbolic', topic: 'perms', level: 2, cmds: ['chmod'], title: 'Take away write access',
    setup(t) { const files = Array.from({ length: 4 }, (_, i) => `~/shared/report${i}.txt`); for (const f of files) t.file(f, 'x\n', { mode: 0o666 }); return { files }; },
    prompt: 'Everyone can write to the files in «~/shared». Remove write permission for the *group and others* on all of them — and leave everything else as it is.',
    check: (e, x) => x.files.every((f) => e.mode(f) === 0o644),
    hints: ['Symbolic mode: «chmod go-w FILES» — g group, o others, «-w» remove write.'],
    solution: ['chmod go-w ~/shared/*'],
  });
  T({
    id: 'perm-dir-750', topic: 'perms', level: 2, cmds: ['chmod'], title: 'A team folder',
    setup(t) { t.dir('~/team', { mode: 0o777 }); t.file('~/team/plan.txt', 'x\n'); },
    prompt: 'Set «~/team» so that you can do anything, your group can list and enter it (but not create files), and others can do nothing.',
    check: (e) => e.mode('~/team') === 0o750,
    hints: ['For a directory, «x» means "may enter" and «r» means "may list". rwx r-x --- = 7 5 0.'],
    solution: ['chmod 750 ~/team'],
  });
  T({
    id: 'perm-chown', topic: 'perms', level: 2, cmds: ['chown', 'sudo'], title: 'Hand it over',
    setup(t) { t.file('/srv/handover/project.tar', 'x\n', { owner: t.user, group: t.user }); t.dir('/srv/handover', { owner: t.user, group: t.user }); },
    prompt: 'Make «alice» the owner of «/srv/handover/project.tar» (her group too).',
    check: (e) => { const n = e.file('/srv/handover/project.tar'); return n.owner === 'alice' && n.group === 'alice'; },
    hints: ['Only root can give files away: «sudo chown USER:GROUP FILE». Your password is «practice».'],
    solution: ['sudo chown alice:alice /srv/handover/project.tar', '$PW'],
  });
  T({
    id: 'perm-chgrp-r', topic: 'perms', level: 2, cmds: ['chgrp'], title: 'Share with the devs',
    setup(t) { for (const f of ['a.py', 'lib/b.py', 'lib/c.py']) t.file('~/code/' + f, '#\n'); },
    prompt: 'Give the whole «~/code» folder, and everything in it, to the group «devs».',
    check: (e) => { for (const [, n] of e.fs.iterate(e.p('~/code'), 'root', {})) if (n.group !== 'devs') return false; return true; },
    hints: ['«chgrp -R GROUP DIR» — «-R» goes into every subfolder.'],
    solution: ['chgrp -R devs ~/code'],
  });
  T({
    id: 'perm-umask', topic: 'perms', level: 3, cmds: ['umask', 'touch'], title: 'Private by default',
    prompt: 'Set your umask so that new files are created readable and writable *only by you* (600), then create «~/secret.txt» to prove it.',
    check: (e) => e.mode('~/secret.txt') === 0o600 && (e.shell.umask & 0o077) === 0o077,
    hints: ['The umask lists the permission bits to take *away* from new files. Files start from 666.', '«umask 077», then «touch ~/secret.txt», then «ls -l ~/secret.txt».'],
    solution: ['umask 077', 'touch ~/secret.txt'],
  });
  T({
    id: 'perm-groups', topic: 'perms', level: 1, cmds: ['id', 'groups'], title: 'What groups?',
    prompt: 'Which groups is the user «bob» in? Ask the system.',
    check: (e) => (!!e.ran('groups', (r) => r.args.includes('bob')) || !!e.ran('id', (r) => r.args.includes('bob'))) && /ops/.test(e.out()),
    hints: ['«groups USER» or «id USER».'],
    solution: ['groups bob'],
  });
  T({
    id: 'perm-sudo-read', topic: 'perms', level: 1, cmds: ['sudo', 'cat'], title: 'Root only',
    setup(t) { const code = `${t.word()}-${t.int(100, 999)}`; t.file('/root/flag.txt', code + '\n', { mode: 0o600 }); return { code }; },
    prompt: 'Print the contents of «/root/flag.txt». Only root can read it.',
    check: (e, x) => e.answer(x.code),
    hints: ['«sudo» runs one command as root. Your password is «practice».'],
    solution: ['sudo cat /root/flag.txt', '$PW'],
  });
  T({
    id: 'perm-sudo-l', topic: 'perms', level: 1, cmds: ['sudo'], title: 'What may I do?',
    prompt: 'List what you are allowed to run with sudo.',
    check: (e) => !!e.ran('sudo', (r) => r.args.includes('-l')),
    hints: ['«sudo -l».'],
    solution: ['sudo -l', '$PW'],
  });
  T({
    id: 'perm-su', topic: 'perms', level: 2, cmds: ['su'], title: 'As someone else',
    setup(t) { return { w: t.word() }; },
    prompt: (x) => `Switch to the user «alice» (her password is «alice123»), create «/home/alice/${x.w}.txt» *as her*, then return to your own account.`,
    check: (e, x) => { const n = e.file(`/home/alice/${x.w}.txt`); return !!n && n.owner === 'alice' && e.user === e.game.user; },
    nudge: (e, x) => (e.user === 'alice' && e.file(`/home/alice/${x.w}.txt`) ? 'Done as alice — now «exit» back to yourself.' : null),
    hints: ['«su - alice» (the «-» gives you her full login), then «touch», then «exit».'],
    solution: (x) => ['su - alice', { answer: 'alice123' }, `touch /home/alice/${x.w}.txt`, 'exit'],
  });
  T({
    id: 'user-add', topic: 'perms', level: 2, cmds: ['useradd', 'sudo'], title: 'A new colleague',
    setup(t) { const free = ['carol', 'dave', 'erin', 'frank', 'grace2', 'heidi'].filter((n) => !t.world.main.users.exists(n)); return { u: t.pick(free) }; },
    prompt: (x) => `Create a user account «${x.u}» with a home directory at «/home/${x.u}».`,
    check: (e, x) => e.world.main.users.exists(x.u) && !!e.file(`/home/${x.u}`),
    hints: ['«sudo useradd -m NAME» — «-m» makes the home directory.'],
    solution: (x) => [`sudo useradd -m ${x.u}`, '$PW'],
  });
  T({
    id: 'user-mod-group', topic: 'perms', level: 2, cmds: ['usermod', 'sudo'], title: 'Join the devs',
    prompt: 'Add «bob» to the «devs» group, without removing him from the groups he\'s already in.',
    check: (e) => e.world.main.users.inGroup('bob', 'devs') && e.world.main.users.inGroup('bob', 'ops'),
    hints: ['«usermod -aG GROUP USER» — «-a» appends; without it, «-G» replaces all his groups.'],
    solution: ['sudo usermod -aG devs bob', '$PW'],
    why: 'Forgetting «-a» is a classic way to lock someone out of everything else they could do.',
  });
  T({
    id: 'user-del', topic: 'perms', level: 2, cmds: ['userdel', 'sudo'], title: 'Remove an old account',
    setup(t) { t.account('tempuser'); t.file('/home/tempuser/stuff.txt', 'x\n', { owner: 'tempuser', group: 'tempuser' }); },
    prompt: 'The account «tempuser» is no longer needed. Delete it, along with its home directory.',
    check: (e) => !e.world.main.users.exists('tempuser') && !e.file('/home/tempuser'),
    hints: ['«sudo userdel -r NAME» — «-r» removes the home directory too.'],
    solution: ['sudo userdel -r tempuser', '$PW'],
  });
  T({
    id: 'user-passwd', topic: 'perms', level: 1, cmds: ['passwd'], title: 'New password',
    setup(t) { return { pw: `${t.word()}-${t.word()}-${t.int(10, 99)}` }; },
    prompt: (x) => `Change your own password to «${x.pw}». (Your current one is «practice».)`,
    check: (e, x) => e.game.password() === x.pw,
    hints: ['«passwd» asks for the current password, then the new one twice. Nothing appears as you type.'],
    solution: (x) => ['passwd', '$PW', { answer: x.pw }, { answer: x.pw }],
  });
  T({
    id: 'who-logged-in', topic: 'perms', level: 1, cmds: ['who'], title: 'Who else is here?',
    setup(t) { const users = t.pickN(['alice', 'bob', 'deploy'], 2); users.forEach((u, i) => t.session({ user: u, tty: `pts/${i + 3}`, from: `10.0.5.${t.int(30, 90)}` })); return { users }; },
    prompt: 'Who else is logged in to this machine right now?',
    check: (e, x) => !!e.ran(['who', 'w', 'users']) && x.users.every((u) => e.out().includes(u)),
    hints: ['«who» lists sessions; «w» adds what each one is doing.'],
    solution: ['who'],
  });
  T({
    id: 'w-what', topic: 'perms', level: 2, cmds: ['w'], title: 'What are they running?',
    setup(t) { const what = t.pick(['vim deploy.yml', 'top', 'journalctl -f', 'htop', 'python3 train.py']); t.session({ user: 'alice', tty: 'pts/4', from: '10.0.5.44', what }); return { what }; },
    prompt: 'What program is «alice» running in her login session right now?',
    check: (e, x) => !!e.ran('w') && e.out().includes(x.what),
    hints: ['«w» shows each session\'s current command in the WHAT column.'],
    solution: ['w'],
  });
  T({
    id: 'last-login', topic: 'perms', level: 2, cmds: ['last'], title: 'Recent logins',
    setup(t) { const day = t.int(1, 5); t.world.wtmp.push({ user: 'bob', tty: 'pts/2', from: '10.0.5.77', at: t.now - day * 86400000, host: 'range', out: '- 18:02  (00:41)' }); },
    prompt: 'Show the recent login history for the user «bob» — when and from where.',
    check: (e) => !!e.ran('last', (r) => r.args.includes('bob')) || (!!e.ran('last') && e.out().includes('10.0.5.77')),
    hints: ['«last USER».'],
    solution: ['last bob'],
  });

  /* ===================== processes ===================== */
  const runaway = (t, comm, o = {}) => t.proc(Object.assign({ user: t.user, comm, args: o.args || `/usr/local/bin/${comm} --threads 8`, cpu: o.cpu || 97.5, mem: o.mem || 3.2, stat: 'R', cputime: 4000 }, o));
  T({
    id: 'proc-pgrep', topic: 'procs', level: 1, cmds: ['pgrep', 'ps'], title: 'Find the PID',
    setup(t) { const name = t.pick(['indexer', 'syncd', 'thumbnailer', 'crawler']); const pid = runaway(t, name, { cpu: 4.1 }); return { name, pid }; },
    prompt: (x) => `What is the process ID (PID) of the process called «${x.name}»?`,
    check: (e, x) => e.answer(x.pid),
    hints: ['«pgrep NAME» prints matching PIDs; «ps aux | grep NAME» shows more detail.'],
    solution: (x) => [`pgrep ${x.name}`],
  });
  T({
    id: 'proc-kill', topic: 'procs', level: 1, cmds: ['kill', 'pgrep'], title: 'Stop the CPU hog',
    setup(t) { const name = t.pick(['cryptominer', 'runaway', 'busyloop', 'spinner']); const pid = runaway(t, name); return { name, pid }; },
    prompt: (x) => `A process called «${x.name}» (it's yours) is eating a whole CPU. Stop it.`,
    check: (e, x) => !e.world.proc(x.pid),
    hints: ['Find its PID with «pgrep», then «kill PID». Or «pkill NAME» in one go.'],
    solution: (x) => [`pkill ${x.name}`],
    why: '«kill PID» sends TERM, a polite request. Only if that fails, «kill -9 PID» (KILL), which can\'t be refused.',
  });
  T({
    id: 'proc-kill9', topic: 'procs', level: 2, cmds: ['kill'], title: 'It won\'t die',
    setup(t) { const pid = runaway(t, 'stubborn', { ignoreTERM: true }); return { pid }; },
    prompt: (x) => `Process «stubborn» (PID ${x.pid}) ignores a normal «kill». Get rid of it anyway.`,
    check: (e, x) => !e.world.proc(x.pid),
    hints: ['Signal 9, KILL, cannot be ignored: «kill -9 PID».'],
    solution: (x) => [`kill -9 ${x.pid}`],
  });
  T({
    id: 'proc-pkill-user', topic: 'procs', level: 2, cmds: ['pkill', 'sudo'], title: 'Everything bob is running',
    setup(t) { const pids = ['sleep 900', 'python3 job.py', 'tail -f app.log'].map((a) => t.proc({ user: 'bob', comm: a.split(' ')[0], args: a, tty: 'pts/5' })); return { pids }; },
    prompt: 'Bob left a pile of processes running. Stop *all* of bob\'s processes — ideally with one command that picks them by owner.',
    check: (e) => !e.world.procs.some((p) => p.user === 'bob'),
    hints: ['«pkill -u USER» matches by owner; other people\'s processes need sudo.'],
    solution: ['sudo pkill -u bob', '$PW'],
  });
  T({
    id: 'proc-killall', topic: 'procs', level: 2, cmds: ['killall'], title: 'All of them, by name',
    setup(t) { const pids = Array.from({ length: t.int(3, 5) }, () => runaway(t, 'worker', { args: 'worker --queue default', cpu: 12 })); return { pids }; },
    prompt: 'There are several copies of a process called «worker» running. Stop every one of them by name.',
    check: (e) => !e.world.procs.some((p) => p.comm === 'worker'),
    hints: ['«killall NAME» signals every process with exactly that name.'],
    solution: ['killall worker'],
  });
  T({
    id: 'proc-top-cpu', topic: 'procs', level: 3, cmds: ['ps', 'sort', 'head'], title: 'The busiest process',
    setup(t) { const name = t.pick(['ffmpeg', 'make', 'java', 'node']); runaway(t, name, { cpu: 88.4 }); runaway(t, 'helper', { cpu: 12.1 }); return { name }; },
    prompt: 'Which process is using the most CPU? Show a list sorted by CPU use with it at the top — no more than a few lines.',
    check: (e, x) => { const l = e.shownLines(); return l.length <= 4 && l.some((s) => s.includes(x.name)) && e.used(['ps', 'top']); },
    hints: ['«ps aux» shows %CPU in column 3. Sort on it, numerically, biggest first, and keep the top.', '«ps aux | sort -k3 -rn | head -n 3»'],
    solution: ['ps aux | sort -k3 -rn | head -n 3'],
    why: 'Or interactively: «top» (press «P» to sort by CPU, «M» by memory, «q» to quit).',
  });
  T({
    id: 'proc-top', topic: 'procs', level: 1, cmds: ['top'], title: 'The live view',
    prompt: 'Open the live process monitor, look at the busiest processes, and quit it.',
    check: (e) => !!e.stepEvent('top'),
    hints: ['«top» (q to quit).'],
    solution: ['top'],
  });
  T({
    id: 'proc-jobs', topic: 'procs', level: 2, cmds: ['sleep', 'jobs', 'fg'], title: 'Background and back',
    prompt: 'Start «sleep 300» in the background, list your jobs, then bring it to the foreground and stop it with Ctrl+C.',
    parts: [
      { text: 'start «sleep 300» in the background', check: (e) => e.world.procs.some((p) => p.job && /sleep 300/.test(p.args || '')) },
      { text: 'list your jobs', check: (e) => !!e.ran('jobs', (r) => /sleep 300/.test(r.out)) },
      { text: 'bring it back with «fg» and Ctrl+C', check: (e) => !!e.tried('fg', (r) => r.status === 0 || r.status === 130) },
    ],
    hints: ['A «&» at the end of a command runs it in the background.', '«jobs» lists background jobs; «fg» brings the latest back to the foreground, where Ctrl+C can stop it.'],
    solution: ['sleep 300 &', 'jobs', { nowait: 'fg' }, { ctrlc: true }],
    why: '«&» runs in the background; «jobs» lists; «fg %N» brings job N back; Ctrl+C interrupts the foreground job.',
  });
  T({
    id: 'sys-uptime', topic: 'procs', level: 1, cmds: ['uptime'], title: 'How long has it been up?',
    prompt: 'How long has this machine been running, and what\'s its load average?',
    check: (e) => !!e.ran('uptime'),
    hints: ['«uptime».'],
    solution: ['uptime'],
  });
  T({
    id: 'sys-free', topic: 'procs', level: 1, cmds: ['free'], title: 'Memory',
    prompt: 'How much memory is used and available? Show it in human-readable units.',
    check: (e) => !!e.ran('free', (r) => e.has(r, 'h')),
    hints: ['«free -h».'],
    solution: ['free -h'],
    why: 'Look at "available", not "free": Linux uses spare memory as disk cache and gives it back when needed.',
  });
  T({
    id: 'sys-uname', topic: 'procs', level: 1, cmds: ['uname'], title: 'Which kernel?',
    prompt: 'Print the release of the Linux kernel this machine is running — just that.',
    check: (e) => e.answer('6.1.0-range', { exact: true }),
    hints: ['«uname -r» (and «uname -a» for everything).'],
    solution: ['uname -r'],
  });
  T({
    id: 'sys-watch', topic: 'procs', level: 2, cmds: ['watch'], title: 'Keep an eye on it',
    setup(t) { t.dir('~/incoming'); },
    prompt: 'Re-run «ls ~/incoming» every 2 seconds so you\'d see new files arrive. Stop with Ctrl+C.',
    check: (e) => !!e.tried('watch', (r) => r.args.includes('2') && r.args.some((a) => /incoming/.test(a))),
    hints: ['«watch -n 2 COMMAND».'],
    solution: [{ nowait: 'watch -n 2 ls ~/incoming' }, { ctrlc: true }],
  });

  /* ===================== services, cron, disks ===================== */
  T({
    id: 'svc-status', topic: 'system', level: 1, cmds: ['systemctl'], title: 'Is it running?',
    prompt: 'Is the «nginx» service running? Check its status.',
    check: (e) => !!e.tried('systemctl', (r) => r.args.includes('status') && r.args.some((a) => /^nginx/.test(a))),
    hints: ['«systemctl status NAME».'],
    solution: ['systemctl status nginx'],
  });
  T({
    id: 'svc-start-enable', topic: 'system', level: 2, cmds: ['systemctl', 'sudo'], title: 'Start it, and keep it started',
    prompt: 'The «backup» service is stopped and won\'t start at boot. Start it now *and* make it start at boot.',
    check: (e) => e.world.services.backup.active && e.world.services.backup.enabled,
    hints: ['«start» starts it now; «enable» makes it start at boot. «enable --now» does both.'],
    solution: ['sudo systemctl enable --now backup', '$PW'],
  });
  T({
    id: 'svc-stop-disable', topic: 'system', level: 2, cmds: ['systemctl', 'sudo'], title: 'Switch it off for good',
    prompt: 'Stop the «metrics» service and make sure it won\'t start again at the next boot.',
    check: (e) => !e.world.services.metrics.active && !e.world.services.metrics.enabled,
    hints: ['«sudo systemctl disable --now metrics».'],
    solution: ['sudo systemctl disable --now metrics', '$PW'],
  });
  T({
    id: 'svc-restart', topic: 'system', level: 1, cmds: ['systemctl', 'sudo'], title: 'Turn it off and on again',
    setup(t) { return { since: t.world.services.nginx.since }; },
    prompt: 'You changed nginx\'s configuration. Restart the «nginx» service so it takes effect.',
    check: (e, x) => e.world.services.nginx.active && e.world.services.nginx.since > x.since && !!e.ran('systemctl', (r) => r.args.includes('restart') || r.args.includes('reload')),
    hints: ['«sudo systemctl restart nginx».'],
    solution: ['sudo systemctl restart nginx', '$PW'],
  });
  T({
    id: 'svc-journal', topic: 'system', level: 2, cmds: ['journalctl'], title: 'Why does it keep failing?',
    setup(t) { const why = t.pick(['database password rejected', 'port 8443 already in use', 'certificate expired', 'cannot open /var/lib/pay/state']); t.service('payments', { active: false, enabled: true, journal: ['Starting payments...', `fatal: ${why}`, 'payments.service: Failed with result \'exit-code\'.'] }); return { why }; },
    prompt: 'The «payments» service keeps failing to start. Read *its* log messages to find out why.',
    check: (e, x) => !!e.ran('journalctl', (r) => r.args.some((a) => /payments/.test(a))) && e.out().includes(x.why),
    hints: ['«journalctl -u UNIT» shows one service\'s log. «-n 20» limits it to the last 20 lines.'],
    solution: ['journalctl -u payments'],
  });
  /* a job in your crontab that runs SCRIPT on the schedule WHEN accepts */
  const cronHas = (e, when, script) => P.h.cronJobs(e).some((j) => when(j) && P.h.runsScript(e, j.cmd, script));
  const every = (f, n) => f === '*/' + n || f === '0-59/' + n || f === Array.from({ length: 60 / n }, (_, i) => i * n).join(',');
  const cronFeedback = (script) => (e) => { const jobs = P.h.cronJobs(e); if (!jobs.length) return 'Your crontab is empty — «crontab -l» shows it.'; if (!jobs.some((j) => P.h.runsScript(e, j.cmd, script))) return `None of your jobs runs «${e.p(script)}» — check the path (cron doesn't know your current directory).`; return 'The job runs the right script, but not at the right time — read the five fields again: minute, hour, day of month, month, day of week.'; };
  T({
    id: 'cron-daily', topic: 'system', level: 2, cmds: ['crontab'], title: 'Every night at 02:30',
    setup(t) { t.file('~/backup.sh', '#!/bin/bash\ntar -czf /backup/home.tgz ~\n', { mode: 0o755 }); },
    prompt: 'Schedule «/home/{user}/backup.sh» to run every day at 02:30, using your crontab.',
    check: (e) => cronHas(e, (j) => P.h.num(j.min) === 30 && P.h.num(j.hour) === 2 && j.dom === '*' && j.mon === '*' && j.dow === '*', '~/backup.sh'),
    feedback: cronFeedback('~/backup.sh'),
    hints: ['A crontab line is «MIN HOUR DAY MONTH WEEKDAY COMMAND», and the command needs its full path.', 'Write the line into a file and install it: «echo "30 2 * * * /home/{user}/backup.sh" | crontab -» — or use «crontab -e».'],
    solution: ['echo "30 2 * * * /home/{user}/backup.sh" > /tmp/cron.txt', 'crontab /tmp/cron.txt'],
    why: '«crontab FILE» replaces your whole crontab with FILE; «crontab -e» edits it; «crontab -l» shows it.',
  });
  T({
    id: 'cron-weekly', topic: 'system', level: 3, cmds: ['crontab'], title: 'Monday mornings',
    setup(t) { t.file('~/report.sh', '#!/bin/bash\necho report\n', { mode: 0o755 }); },
    prompt: 'Schedule «/home/{user}/report.sh» to run every Monday at 06:00.',
    check: (e) => cronHas(e, (j) => P.h.num(j.min) === 0 && P.h.num(j.hour) === 6 && j.dom === '*' && j.mon === '*' && /^(1|mon)$/i.test(j.dow), '~/report.sh'),
    feedback: cronFeedback('~/report.sh'),
    hints: ['Day of week is the 5th field: 0 or 7 is Sunday, 1 is Monday.', '«echo "0 6 * * 1 /home/{user}/report.sh" | crontab -»'],
    solution: ['echo "0 6 * * 1 /home/{user}/report.sh" > /tmp/cron.txt', 'crontab /tmp/cron.txt'],
  });
  T({
    id: 'cron-every15', topic: 'system', level: 3, cmds: ['crontab'], title: 'Every quarter of an hour',
    setup(t) { t.file('~/ping.sh', '#!/bin/bash\nping -c 1 web.lab\n', { mode: 0o755 }); },
    prompt: 'Schedule «/home/{user}/ping.sh» to run every 15 minutes, all day, every day.',
    check: (e) => cronHas(e, (j) => every(j.min, 15) && j.hour === '*' && j.dom === '*' && j.mon === '*' && j.dow === '*', '~/ping.sh'),
    feedback: cronFeedback('~/ping.sh'),
    hints: ['«*/15» in the minute field means "every 15 minutes".', '«echo "*/15 * * * * /home/{user}/ping.sh" | crontab -»'],
    solution: ['echo "*/15 * * * * /home/{user}/ping.sh" > /tmp/cron.txt', 'crontab /tmp/cron.txt'],
  });
  T({
    id: 'cron-list', topic: 'system', level: 1, cmds: ['crontab'], title: 'What\'s scheduled?',
    setup(t) { const h = t.int(1, 5), m = t.pick([0, 15, 30, 45]); t.cron(t.user, `# m h dom mon dow command\n${m} ${h} * * * /home/${t.user}/cleanup.sh\n`); return { h, m }; },
    prompt: 'Show your own scheduled cron jobs.',
    check: (e) => !!e.ran('crontab', (r) => e.has(r, 'l')),
    hints: ['«crontab -l».'],
    solution: ['crontab -l'],
  });
  T({
    id: 'disk-lsblk', topic: 'system', level: 1, cmds: ['lsblk'], title: 'What disks are there?',
    prompt: 'A USB stick has been plugged in. List the block devices to see it and its size.',
    check: (e) => !!e.ran('lsblk', (r) => /sdb/.test(r.out)),
    hints: ['«lsblk» (add «-f» for filesystems and labels).'],
    solution: ['lsblk'],
  });
  T({
    id: 'disk-mount', topic: 'system', level: 2, cmds: ['mount', 'sudo'], title: 'Open the USB stick',
    prompt: 'Mount the USB stick\'s partition «/dev/sdb1» on «/mnt/usb», read-only, then list what\'s on it.',
    check: (e) => e.world.mounts.some((m) => m.path === '/mnt/usb' && /^ro\b/.test(m.opts)) && e.used('ls', (r) => /report\.txt/.test(r.out) && /photos/.test(r.out)),
    feedback: (e) => (!e.world.mounts.some((m) => m.path === '/mnt/usb') ? 'Nothing is mounted on «/mnt/usb» yet.' : !e.world.mounts.some((m) => m.path === '/mnt/usb' && /^ro\b/.test(m.opts)) ? 'It\'s mounted read-write. Unmount it and mount it again with «-o ro».' : 'Mounted read-only — now list «/mnt/usb».'),
    hints: ['«mount -o ro DEVICE DIR» mounts read-only; it needs root.', '«sudo mount -o ro /dev/sdb1 /mnt/usb», then «ls /mnt/usb».'],
    solution: ['sudo mount -o ro /dev/sdb1 /mnt/usb', '$PW', 'ls /mnt/usb'],
    why: 'Read-only is the safe way to look at a disk you don\'t trust, or one that holds evidence: nothing you do can change it.',
  });
  T({
    id: 'disk-umount', topic: 'system', level: 2, cmds: ['umount', 'sudo'], title: 'Safely remove',
    setup(t) { t.world.mount('/dev/sdb1', '/mnt/usb', false); },
    prompt: 'The USB stick is mounted on «/mnt/usb». Unmount it so it can be pulled out safely.',
    check: (e) => !e.world.mounts.some((m) => m.path === '/mnt/usb'),
    hints: ['«sudo umount /mnt/usb» — and make sure your shell isn\'t standing inside it.'],
    solution: ['cd ~', 'sudo umount /mnt/usb', '$PW'],
  });
  T({
    id: 'disk-dmesg', topic: 'system', level: 2, cmds: ['dmesg', 'sudo'], title: 'What did the kernel say?',
    prompt: 'Show the kernel\'s most recent messages, to see what it said when the USB stick was plugged in.',
    check: (e) => !!e.ran('dmesg') && /sdb/.test(e.out()),
    hints: ['«sudo dmesg | tail».'],
    solution: ['sudo dmesg | tail', '$PW'],
  });
  /* ===================== packages: whichever manager this distro uses ===================== */
  const D = (x) => LA.distro(x);
  const pkgCmds = (e) => { const d = e.game.distro; return [...new Set([d.pm, d.lowPm].concat(d.pmCmds))]; };
  T({
    id: 'pkg-install', topic: 'pkg', level: 2, cmds: ['PM', 'sudo'], title: 'Install a package',
    setup(t) { return { p: t.pick(['htop', 'cowsay', 'sl', 'neofetch']) }; },
    prompt: (x) => `Install the package «${x.p}».`,
    check: (e, x) => e.world.packages.installed.includes(x.p),
    hints: ['This machine\'s package manager is «{pm}». Installing needs root. {pkg:refreshWhy}', (x) => `«{pkg:refresh}», then «{pkg:install ${x.p}}».`],
    solution: (x) => ['{pkg:refresh}', '$PW', `{pkg:install ${x.p}}`, '$PW', { answer: 'y' }],
    why: 'Package managers fetch software from your distro\'s repositories, check its signature, install its dependencies, and remember every file so it can be removed cleanly later.',
  });
  T({
    id: 'pkg-search', topic: 'pkg', level: 1, cmds: ['PM'], title: 'Search the repositories',
    setup(t) { return { name: LA.pkgName('fortune-mod', t.world.distro) }; },
    prompt: 'Search the package repositories for anything to do with «fortune».',
    check: (e, x) => e.attempted(pkgCmds(e)) && e.out().includes(x.name),
    hints: ['«{pkg:search fortune}». Searching doesn\'t need root.'],
    solution: ['{pkg:search fortune}'],
  });
  T({
    id: 'pkg-remove', topic: 'pkg', level: 2, cmds: ['PM', 'sudo'], title: 'Remove a package',
    setup(t) { const p = t.pick(['cowsay', 'sl', 'cmatrix']); t.world.installPackage(p); return { p }; },
    prompt: (x) => `Somebody installed «${x.p}» on this server. Remove the package.`,
    check: (e, x) => !e.world.packages.installed.includes(x.p),
    hints: [(x) => `«{pkg:remove ${x.p}}».`],
    solution: (x) => [`{pkg:remove ${x.p}}`, '$PW', { answer: 'y' }],
    why: 'Removing through the package manager takes every file the package installed — deleting the program by hand leaves the rest behind and confuses the package database.',
  });
  T({
    id: 'pkg-query', topic: 'pkg', level: 1, cmds: ['LOWPM'], title: 'Is it installed?',
    setup(t) { const p = t.pick(['nano', 'curl', 'tree', 'htop', 'sl']); const inst = t.world.packages.installed.includes(p); return { p, inst }; },
    prompt: (x) => `Is the package «${x.p}» installed? Ask the package database (not «which»).`,
    check: (e, x) => e.attempted(pkgCmds(e), (r) => r.args.includes(x.p) || e.pipe) && (x.inst ? e.out().includes(x.p) : true),
    hints: [(x) => `«{pkg:query ${x.p}}» — the low-level tool, «{lowPm}», answers straight from the database.`],
    solution: (x) => [`{pkg:query ${x.p}}`],
  });
  T({
    id: 'pkg-owner', topic: 'pkg', level: 2, cmds: ['LOWPM'], title: 'Who owns this file?',
    setup(t) { const [f, p] = t.pick([['/usr/bin/dig', 'dnsutils'], ['/usr/bin/ssh', 'openssh-client'], ['/usr/bin/crontab', 'cron'], ['/usr/bin/ip', 'iproute2'], ['/usr/bin/free', 'procps'], ['/usr/bin/awk', 'gawk']]); return { f, name: LA.pkgName(p, t.world.distro) }; },
    prompt: (x) => `Which package installed «${x.f}»?`,
    check: (e, x) => e.attempted(pkgCmds(e)) && e.out().includes(x.name),
    hints: [(x) => `«{pkg:owner ${x.f}}».`],
    solution: (x) => [`{pkg:owner ${x.f}}`],
    why: 'Handy when you find a strange file, or need the package that provides a command on another machine.',
  });
  T({
    id: 'pkg-files', topic: 'pkg', level: 2, cmds: ['LOWPM'], title: 'What did it install?',
    setup(t) { return { p: t.pick(['nano', 'tree', 'curl', 'less', 'bc']) }; },
    prompt: (x) => `List every file the «${x.p}» package installed.`,
    check: (e, x) => e.attempted(pkgCmds(e)) && e.out().includes('/usr/bin/' + x.p),
    hints: [(x) => `«{pkg:files ${x.p}}».`],
    solution: (x) => [`{pkg:files ${x.p}}`],
  });
  T({
    id: 'pkg-info', topic: 'pkg', level: 1, cmds: ['PM'], title: 'Which version?',
    setup(t) { const p = t.pick(['htop', 'cowsay', 'neofetch', 'fail2ban']); return { p, v: t.world.packages.available[p].version }; },
    prompt: (x) => `What version of «${x.p}» is available? Show the package's details.`,
    check: (e, x) => e.attempted(pkgCmds(e)) && e.out().includes(x.v.replace(/^\d+:/, '').split('-')[0]),
    hints: [(x) => `«{pkg:info ${x.p}}».`],
    solution: (x) => [`{pkg:info ${x.p}}`],
  });
  T({
    id: 'pkg-upgrade', topic: 'pkg', level: 2, cmds: ['PM', 'sudo'], title: 'Patch everything',
    prompt: 'Bring every installed package up to date.',
    check: (e) => !!e.world.pkgUpgraded,
    hints: ['Refresh first, then upgrade: «{pkg:refresh}», «{pkg:upgrade}».'],
    solution: ['{pkg:refresh}', '$PW', '{pkg:upgrade}', '$PW', { answer: 'y' }],
    why: 'Security fixes arrive as package updates — most break-ins use holes that already had a patch.',
  });
  T({
    id: 'pkg-repos', topic: 'pkg', level: 1, cmds: ['cat'], title: 'Where do packages come from?',
    prompt: 'Where does this machine download its packages from? Show its repository configuration.',
    check: (e) => e.out().includes('mirror.lab') || !!e.tried(['zypper', 'dnf', 'yum'], (r) => /^(repos|lr|repolist)$/.test(r.args.find((a) => !a.startsWith('-')) || '')),
    hints: ['«{pkg:repos}».'],
    solution: ['{pkg:repos}'],
  });
  T({
    id: 'distro-which', topic: 'pkg', level: 1, cmds: ['cat'], title: 'Which Linux is this?',
    prompt: 'Which Linux distribution is this machine based on? Read the standard file that describes the OS.',
    check: (e) => /^ID(_LIKE)?=/m.test(e.out()),
    hints: ['«cat /etc/os-release».'],
    solution: ['cat /etc/os-release'],
    why: '«ID» and «ID_LIKE» tell you the family — debian/ubuntu → apt, fedora/rhel → dnf, arch → pacman, suse → zypper — which is what install scripts check too.',
  });
  T({
    id: 'admin-grant', topic: 'perms', level: 2, cmds: ['usermod', 'sudo'], title: 'Make bob an admin',
    prompt: 'Give «bob» the right to use sudo, by adding him to the administrators\' group. He must keep his other groups.',
    check: (e) => e.world.isSudoer('bob') && e.world.main.users.inGroup('bob', 'ops'),
    hints: ['Look for the «%group» line in «/etc/sudoers» (it needs sudo to read). On this machine the admins\' group is «{admin}».', '«sudo usermod -aG {admin} bob».'],
    solution: ['sudo usermod -aG {admin} bob', '$PW'],
    why: 'Debian and Ubuntu call the admins\' group «sudo»; Fedora, RHEL, Arch and openSUSE call it «wheel».',
  });
  /* tools only one family has */
  T({
    id: 'apt-policy', topic: 'pkg', level: 2, distros: ['debian'], cmds: ['apt-cache'], title: 'Installed, or just available?',
    setup(t) { const p = t.pick(['htop', 'cowsay', 'sl']); return { p, v: t.world.packages.available[p].version }; },
    prompt: (x) => `Show in one go whether «${x.p}» is installed and which version would be installed, using apt's cache tool.`,
    check: (e, x) => !!e.ran('apt-cache', (r) => r.args.includes('policy') && r.args.includes(x.p)),
    hints: [(x) => `«apt-cache policy ${x.p}» — «Installed:» and «Candidate:».`],
    solution: (x) => [`apt-cache policy ${x.p}`],
  });
  T({
    id: 'dnf-provides', topic: 'pkg', level: 2, distros: ['fedora'], cmds: ['dnf'], title: 'Which package has that command?',
    setup(t) { return { c: t.pick(['cowsay', 'htop', 'cmatrix']) }; },
    prompt: (x) => `«${x.c}» isn't installed here. Without installing anything, find out which package provides it.`,
    check: (e, x) => !!e.ran(['dnf', 'yum'], (r) => /provides/.test(r.args.join(' '))) && e.out().includes(x.c + '-'),
    hints: [(x) => `«dnf provides ${x.c}» (or «dnf provides /usr/bin/${x.c}»).`],
    solution: (x) => [`dnf provides ${x.c}`],
  });
  T({
    id: 'pacman-explicit', topic: 'pkg', level: 2, distros: ['arch'], cmds: ['pacman'], title: 'What did *I* install?',
    setup(t) { for (const p of t.pickN(['htop', 'cowsay', 'neofetch'], 2)) t.world.installPackage(p); },
    prompt: 'List only the packages that were installed explicitly — not the ones pulled in as dependencies.',
    check: (e) => !!e.ran('pacman', (r) => r.args.some((a) => /^-Q\w*e/.test(a)) || (r.args.includes('--query') && r.args.includes('--explicit'))),
    hints: ['«pacman -Qe» — «Q» queries the local database, «e» means explicitly installed.'],
    solution: ['pacman -Qe'],
    why: '«pacman -Qdt» lists orphans — dependencies nothing needs any more — and «sudo pacman -Rns $(pacman -Qdtq)» removes them.',
  });
  T({
    id: 'zypper-info', topic: 'pkg', level: 2, distros: ['opensuse'], cmds: ['zypper'], title: 'The short forms',
    setup(t) { return { p: t.pick(['htop', 'cowsay', 'sl']) }; },
    prompt: (x) => `zypper has two-letter short forms for its commands. Use the short form of «search» to find «${x.p}».`,
    check: (e, x) => !!e.ran('zypper', (r) => r.args.includes('se') && r.args.includes(x.p)),
    hints: ['«se» is search, «in» install, «rm» remove, «ref» refresh, «lr» list repos.', (x) => `«zypper se ${x.p}»`],
    solution: (x) => [`zypper se ${x.p}`],
  });
  T({
    id: 'sys-hostname', topic: 'system', level: 1, cmds: ['hostname'], title: 'Which machine is this?',
    prompt: 'Print this machine\'s hostname.',
    check: (e) => e.answer('range', { exact: true }),
    hints: ['«hostname».'],
    solution: ['hostname'],
  });

  /* ===================== archives & checksums ===================== */
  T({
    id: 'tar-create', topic: 'archive', level: 2, cmds: ['tar'], title: 'Pack it up',
    setup(t) { for (const f of ['index.html', 'css/site.css', 'js/app.js']) t.file('~/site/' + f, `/* ${f} */\n`); },
    prompt: 'Create a gzip-compressed tar archive «~/site.tar.gz» containing the folder «~/site».',
    check: (e) => { const n = e.file('~/site.tar.gz'); return !!n && n.format === 'gzip' && n.data.inner && n.data.inner.format === 'tar' && n.data.inner.data.entries.some((x) => /site\/js\/app\.js$/.test(x.path)); },
    hints: ['«tar -czf ARCHIVE DIR» — c create, z gzip, f file.', 'Run it from your home so the paths start with «site/»: «cd ~ && tar -czf site.tar.gz site»'],
    solution: ['cd ~', 'tar -czf site.tar.gz site'],
  });
  T({
    id: 'tar-list', topic: 'archive', level: 1, cmds: ['tar'], title: 'Look before you unpack',
    setup(t) { const n = t.int(3, 6); const entries = [{ path: 'release/', type: 'dir' }].concat(Array.from({ length: n }, (_, i) => ({ path: `release/file${i}.txt`, type: 'file', content: 'x\n' }))).map((x) => Object.assign({ mode: x.type === 'dir' ? 0o755 : 0o644, owner: t.user, group: t.user, mtime: t.now }, x)); t.file('~/release.tar.gz', '', { format: 'gzip', data: { name: 'release.tar', inner: { format: 'tar', data: { entries } } } }); return { n }; },
    prompt: 'List what\'s inside «~/release.tar.gz» without extracting it.',
    check: (e, x) => !!e.ran('tar', (r) => r.toTerm && /release\/file0\.txt/.test(r.out) && new RegExp(`release/file${x.n - 1}\\.txt`).test(r.out)) && !e.file('~/release'),
    hints: ['«t» lists an archive\'s contents; «z» reads gzip; «f» names the file.', '«tar -tzf ~/release.tar.gz»'],
    solution: ['tar -tzf ~/release.tar.gz'],
    why: 'Always look first: an archive that unpacks loose files (no top folder) will scatter them all over your current directory.',
  });
  T({
    id: 'tar-count', topic: 'archive', level: 2, cmds: ['tar', 'grep', 'wc'], title: 'How many files inside?',
    setup(t) {
      const n = t.int(3, 8);
      const sub = t.chance(0.5) ? 'docs/' : 'lib/';
      const files = Array.from({ length: n }, (_, i) => `pkg/${i % 2 ? sub : ''}${t.word()}${i}.txt`);
      const entries = [{ path: 'pkg/', type: 'dir' }, { path: 'pkg/' + sub, type: 'dir' }].concat(files.map((p) => ({ path: p, type: 'file', content: 'x\n' }))).map((x) => Object.assign({ mode: x.type === 'dir' ? 0o755 : 0o644, owner: t.user, group: t.user, mtime: t.now }, x));
      t.file('~/pkg.tar.gz', '', { format: 'gzip', data: { name: 'pkg.tar', inner: { format: 'tar', data: { entries } } } });
      return { n, all: entries.length };
    },
    prompt: 'How many *files* — not folders — are inside «~/pkg.tar.gz»? Print the count, without extracting anything.',
    check: (e, x) => e.answer(x.n, { exact: true }) && !e.file('~/pkg'),
    nudge: (e, x) => (e.answer(x.all, { exact: true }) ? `${x.all} counts the folders too — in a tar listing, folder entries end with «/».` : null),
    hints: ['«tar -tzf» lists every entry, folders included; folder entries end with «/».', '«tar -tzf ~/pkg.tar.gz | grep -v \'/$\' | wc -l»'],
    solution: ["tar -tzf ~/pkg.tar.gz | grep -v '/$' | wc -l"],
  });
  T({
    id: 'tar-extract', topic: 'archive', level: 2, cmds: ['tar'], title: 'Unpack it somewhere specific',
    setup(t) { const entries = ['app/run.sh', 'app/README', 'app/lib/core.py'].map((p) => ({ path: p, type: 'file', mode: 0o644, owner: t.user, group: t.user, mtime: t.now, content: `# ${p} ${t.word()}\n` })); t.file('~/app.tar.gz', '', { format: 'gzip', data: { name: 'app.tar', inner: { format: 'tar', data: { entries } } } }); const files = {}; for (const x of entries) files[x.path] = x.content; return { files }; },
    prompt: 'Extract everything in «~/app.tar.gz» into the directory «~/deploy» (create it first).',
    check: (e, x) => P.h.hasTree(e, '~/deploy', x.files),
    feedback: (e, x) => { const miss = Object.keys(x.files).filter((f) => e.text('~/deploy/' + f) !== x.files[f]); return miss.length ? `Not there yet, or not the archive's contents: ${miss.map((m) => '~/deploy/' + m).join(', ')}.` : null; },
    hints: ['«-x» extracts; «-C DIR» extracts into DIR.', '«mkdir -p ~/deploy && tar -xzf ~/app.tar.gz -C ~/deploy»'],
    solution: ['mkdir -p ~/deploy', 'tar -xzf ~/app.tar.gz -C ~/deploy'],
  });
  T({
    id: 'gzip-keep', topic: 'archive', level: 1, cmds: ['gzip'], title: 'Compress, but keep the original',
    setup(t) { const body = pack.gen.appLog(t, 80).map((x) => x.text).join('\n') + '\n'; t.file('~/big.log', body); return { body }; },
    prompt: 'Compress «~/big.log» with gzip into «~/big.log.gz», but keep the original file too.',
    check: (e, x) => e.text('~/big.log') === x.body && P.h.gunzipped(e.file('~/big.log.gz')) === x.body,
    feedback: (e, x) => (e.file('~/big.log.gz') && P.h.gunzipped(e.file('~/big.log.gz')) !== x.body ? '«big.log.gz» exists, but it isn\'t a gzip of «big.log».' : !e.file('~/big.log') ? 'The original is gone — «retry» to start again.' : null),
    hints: ['Plain «gzip FILE» replaces the file with FILE.gz.', '«gzip -k» keeps the original.'],
    solution: ['gzip -k ~/big.log'],
  });
  T({
    id: 'gunzip', topic: 'archive', level: 1, cmds: ['gunzip'], title: 'Decompress',
    setup(t) { t.file('~/data.csv.gz', '', { format: 'gzip', data: { name: 'data.csv', inner: { content: 'id,value\n1,2\n' } } }); },
    prompt: 'Decompress «~/data.csv.gz» back into «~/data.csv».',
    check: (e) => e.text('~/data.csv') === 'id,value\n1,2\n',
    hints: ['«gunzip FILE.gz» (or «gzip -d»).'],
    solution: ['gunzip ~/data.csv.gz'],
  });
  T({
    id: 'zcat-grep', topic: 'archive', level: 2, cmds: ['zcat', 'grep'], title: 'Search a compressed log',
    setup(t) { const l = pack.gen.appLog(t, 90); t.file('~/old.log.gz', '', { format: 'gzip', data: { name: 'old.log', inner: { content: l.map((x) => x.text).join('\n') + '\n' } } }); return { n: l.filter((x) => x.lvl === 'ERROR').length }; },
    prompt: 'How many ERROR lines are in «~/old.log.gz»? Don\'t decompress it to disk.',
    check: (e, x) => e.answer(x.n) && !e.file('~/old.log'),
    hints: ['«zcat» prints a compressed file without unpacking it.', '«zcat ~/old.log.gz | grep -c ERROR»'],
    solution: ['zcat ~/old.log.gz | grep -c ERROR'],
  });
  T({
    id: 'zip-create', topic: 'archive', level: 2, cmds: ['zip'], title: 'A zip for Windows users',
    setup(t) { for (const f of ['a.txt', 'b.txt', 'sub/c.txt']) t.file('~/share/' + f, 'x\n'); },
    prompt: 'Create «~/share.zip» containing the «~/share» folder and everything in it.',
    check: (e) => { const n = e.file('~/share.zip'); return !!n && n.format === 'zip' && n.data.entries.some((x) => /share\/sub\/c\.txt$/.test(x.path)); },
    hints: ['«zip -r ARCHIVE DIR» (from your home directory).'],
    solution: ['cd ~', 'zip -r share.zip share'],
  });
  T({
    id: 'unzip-l', topic: 'archive', level: 1, cmds: ['unzip'], title: 'What\'s in the zip?',
    setup(t) { const entries = ['photos/1.jpg', 'photos/2.jpg', 'notes.txt'].map((p) => ({ path: p, type: 'file', mode: 0o644, content: 'x\n' })); t.file('~/download.zip', '', { format: 'zip', data: { entries } }); },
    prompt: 'List the contents of «~/download.zip» without extracting anything.',
    check: (e) => !!e.ran('unzip', (r) => e.has(r, 'l')),
    hints: ['«unzip -l».'],
    solution: ['unzip -l ~/download.zip'],
  });
  T({
    id: 'sha-verify', topic: 'archive', level: 2, cmds: ['sha256sum'], title: 'Which download is corrupt?',
    setup(t) { const names = ['image.iso', 'tools.tar.gz', 'drivers.zip', 'firmware.bin']; const sums = []; const bad = t.pick(names); for (const n of names) { const c = `${n} ${t.word()} ${t.int(1, 1e6)}\n`; t.file('~/downloads/' + n, n === bad ? c + 'corrupted\n' : c); sums.push(`${LA.util.sha256(c)}  ${n}`); } t.file('~/downloads/SHA256SUMS', sums); return { bad }; },
    prompt: '«~/downloads» has a «SHA256SUMS» file listing the correct checksums. Check every download against it — which one is corrupt?',
    check: (e, x) => !!e.tried('sha256sum', (r) => e.has(r, 'c')) && e.out().includes(`${x.bad}: FAILED`),
    hints: ['«sha256sum -c LIST» verifies files against a checksum list — run it inside the folder.', '«cd ~/downloads && sha256sum -c SHA256SUMS»'],
    solution: ['cd ~/downloads', 'sha256sum -c SHA256SUMS'],
  });
  T({
    id: 'sha-create', topic: 'archive', level: 2, cmds: ['sha256sum'], title: 'Publish checksums',
    setup(t) { for (const n of ['a.iso', 'b.iso', 'c.iso']) t.file('~/release/' + n, `${n} ${t.int(1, 1e6)}\n`); },
    prompt: 'Write the SHA-256 checksums of every «.iso» file in «~/release» into «~/release/SHA256SUMS», so that «sha256sum -c SHA256SUMS» run inside «~/release» verifies them.',
    /* recompute: each listed hash must be the real hash of the file its name points to, seen from ~/release */
    check: (e) => {
      const lines = (e.text('~/release/SHA256SUMS') || '').split('\n').map((l) => l.match(/^([0-9a-f]{64})\s+\*?(.+)$/)).filter(Boolean);
      const ok = (iso) => lines.some((m) => { const n = e.follow(LA.VFS.normalize(m[2], e.p('~/release'))); return n && n === e.follow('~/release/' + iso) && m[1] === U.sha256(LA.hashContent(n, e.fs)); });
      return ['a.iso', 'b.iso', 'c.iso'].every(ok);
    },
    feedback: () => 'Check it the way others will: «cd ~/release && sha256sum -c SHA256SUMS». Every line should say OK.',
    hints: ['«sha256sum FILES > LIST».', 'Run it inside the folder, so the names in the list are relative: «cd ~/release && sha256sum *.iso > SHA256SUMS»'],
    solution: ['cd ~/release', 'sha256sum *.iso > SHA256SUMS'],
    why: 'Names in a checksum list are relative to where you ran sha256sum — so the list only verifies from the same place.',
  });
  T({
    id: 'md5', topic: 'archive', level: 1, cmds: ['md5sum'], title: 'An MD5 checksum',
    setup(t) { const c = `${t.word()} ${t.int(1, 1e6)}\n`; t.file('~/package.deb', c); return { h: LA.util.md5(c) }; },
    prompt: 'A mirror lists MD5 checksums only. Print the MD5 checksum of «~/package.deb».',
    check: (e, x) => e.out().includes(x.h),
    hints: ['«md5sum FILE».'],
    solution: ['md5sum ~/package.deb'],
    why: 'MD5 is fine for spotting accidental corruption, but not against deliberate tampering — prefer sha256sum.',
  });
  T({
    id: 'b64-decode', topic: 'archive', level: 1, cmds: ['base64'], title: 'Decode it',
    setup(t) { const msg = `the ${t.word()} is in the ${t.word()}`; t.file('~/message.b64', LA.util.b64encode(msg) + '\n'); return { msg }; },
    prompt: '«~/message.b64» is base64-encoded. Decode it and print the message.',
    check: (e, x) => e.out().includes(x.msg) && e.used('base64'),
    hints: ['«base64 -d FILE».'],
    solution: ['base64 -d ~/message.b64'],
  });
  T({
    id: 'b64-encode', topic: 'archive', level: 2, cmds: ['base64', 'echo'], title: 'Encode it',
    setup(t) { const s = `${t.word()}:${t.word()}${t.int(10, 99)}`; return { s, want: LA.util.b64encode(s) }; },
    prompt: (x) => `Print the base64 encoding of the text «${x.s}» — with no newline included in what gets encoded.`,
    check: (e, x) => e.answer(x.want) && e.used('base64'),
    nudge: (e, x) => (e.used('base64') && e.out().includes(LA.util.b64encode(x.s + '\n')) ? 'That encoded a trailing newline too («echo» adds one). Use «echo -n» or «printf».' : null),
    hints: ['«echo -n TEXT | base64» — «-n» stops echo adding a newline.'],
    solution: (x) => [`echo -n '${x.s}' | base64`],
  });
  T({
    id: 'strings-fw', topic: 'archive', level: 2, cmds: ['strings', 'grep'], title: 'A version hidden in a binary',
    setup(t) { const v = `${t.int(1, 9)}.${t.int(0, 30)}.${t.int(0, 99)}`; t.file('~/firmware.bin', '', { format: 'elf', data: { cmd: 'fw', banner: 'BOOTLOADER OK', version: `FW_VERSION=${v}`, build: 'gcc 12.2' }, size: 512000 }); return { v }; },
    prompt: '«~/firmware.bin» is a binary file. Find the firmware version string hidden inside it («FW_VERSION=...»).',
    check: (e, x) => e.out().includes(`FW_VERSION=${x.v}`) && e.used('strings'),
    hints: ['«strings FILE» prints readable text found inside binary files; pipe it to grep.'],
    solution: ['strings ~/firmware.bin | grep FW_VERSION'],
  });
  T({
    id: 'boss-backup', topic: 'archive', level: 4, cmds: ['tar', 'date', 'sha256sum', 'scp'], title: 'Boss: an off-site backup',
    setup(t) { for (const f of ['src/main.py', 'src/util.py', 'README.md']) t.file('~/project/' + f, `# ${f} ${t.word()} ${t.int(1, 999)}\n`); return { name: `project-${U.strftime('%F', new Date(LA.now()))}.tar.gz`, files: P.h.snap(t, '~/project'), fp: LA.hostFingerprint('10.0.5.20') }; },
    prompt: (x) => 'Back up «~/project» off-site, in a form that can be verified and restored:',
    parts: [
      /* the archive really contains the project: every file, every byte */
      { text: (x) => `make a gzip tarball of ~/project named «${x.name}» in your home`, state: true, check: (e, x) => { const a = P.h.archived(e.file('~/' + x.name)); return !!a && e.file('~/' + x.name).format === 'gzip' && Object.entries(x.files).every(([rel, c]) => a['project/' + rel] === c); } },
      /* the checksum is the tarball's real one */
      { text: (x) => `write its SHA-256 checksum to «~/${x.name}.sha256»`, state: true, check: (e, x) => { const m = (e.text(`~/${x.name}.sha256`) || '').match(/^([0-9a-f]{64})\s+\*?(\S+)/); const n = e.follow('~/' + x.name); return !!m && !!n && m[1] === U.sha256(LA.hashContent(n, e.fs)) && LA.VFS.basename(m[2]) === x.name; } },
      /* and the remote copies are those files */
      { text: 'copy both files to «backup.lab:/srv/backups/»', state: true, check: (e, x) => { const b = e.world.hosts.backup.fs; const r = b.tryGet('/srv/backups/' + x.name), l = e.follow('~/' + x.name); const rs = b.tryGet(`/srv/backups/${x.name}.sha256`); return !!r && !!l && JSON.stringify(r.data) === JSON.stringify(l.data) && !!rs && b.contentOf(rs) === e.text(`~/${x.name}.sha256`); } },
    ],
    feedback: (e, x) => { const a = P.h.archived(e.file('~/' + x.name)); if (e.file('~/' + x.name) && !a) return 'The tarball isn\'t a tar archive inside gzip — use «tar -czf».'; if (a) { const miss = Object.keys(x.files).filter((r) => a['project/' + r] !== x.files[r]); if (miss.length) return `The tarball should hold the project as «project/…»; missing: ${miss.join(', ')}. Run tar from your home directory.`; } return null; },
    hints: ['Run tar from your home, so paths inside start with «project/».', '«sha256sum FILE > FILE.sha256» writes a checksum file that «sha256sum -c» can check later.', '«scp FILE1 FILE2 HOST:DIR» copies several files; check the host key against «~/lab-hostkeys.txt».'],
    solution: (x) => ['cd ~', 'tar -czf project-$(date +%F).tar.gz project', `sha256sum ${x.name} > ${x.name}.sha256`, `scp ${x.name} ${x.name}.sha256 backup.lab:/srv/backups/`, { answer: x.fp }],
    why: 'A backup you haven\'t verified is a hope. On the far side, «sha256sum -c» against the checksum proves the copy arrived intact; restoring it somewhere scratch proves it\'s complete.',
  });
})();
