/* Night Train, Chapter 7 — Ghost in the Shell (history, last, who, w, env, export, printenv, unset, alias, type, unalias, source, ln, readlink) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const pack = LA.stories.nighttrain;
  const DOORS = "alias doors='tail -n 5 /var/log/meridian/doors.log'";

  pack.add({
    n: 7, id: 'ghost', title: 'Ghost in the Shell', place: 'km 140 · climbing to Brennholt', clock: [1, 1, 55],
    unlocks: ['history', 'last', 'who', 'w', 'env', 'export', 'printenv', 'unset', 'alias', 'type', 'unalias', 'source', 'bash', 'ln', 'readlink'],
    intro: N`The train is climbing now, hard, the engine note deeper, the windows beginning to fog at the corners. Brennholt Pass — the summit, nineteen hundred metres up — is half an hour away.

@June: You've been typing everything out longhand for two hours. Vesna would be *appalled*.

Fair. Before you go into Vesna's account, set your shell up for a long night: the shortcuts, variables and startup files every engineer tunes on day one.`,
    steps: [
      {
        say: N`Your own first. «history» lists the commands you've typed, numbered.`,
        goal: 'Show your command history: «history»',
        hints: ['Type «history».'],
        check: (e) => !!e.ran('history'),
        solve: ['history'],
        done: N`:::lesson
«!!» repeats the last command · «!42» repeats number 42 · **Ctrl+R** searches backwards as you type. «sudo !!» — *that again, but as root* — is the most-typed shortcut in history.
:::`,
      },
      {
        say: N`You're going to be working fast from here, so set up your shell. Every program you start inherits a set of **environment variables** — settings like «HOME», «USER» and «PATH». «env» lists them.`,
        goal: 'Look at your environment: «env»',
        hints: ['Type «env».'],
        check: (e) => !!e.ran('env'),
        solve: ['env'],
        done: N`«HOME=/home/{user}», «USER={user}», «SHELL=/bin/bash», «PATH=/usr/local/bin:/usr/bin:...» — the list of directories searched, in order, when you type a command name.`,
      },
      {
        say: N`Several tools you'll need tonight open an editor, and they ask the variable «EDITOR» which one. Set it, and **export** it so programs you start can see it. «printenv NAME» shows one variable.`,
        goal: 'Set your editor: «export EDITOR=nano», then check it: «printenv EDITOR»',
        hints: ['«export EDITOR=nano» — no spaces around the «=».', 'Then «printenv EDITOR».'],
        check: (e) => { const v = e.shell.vars.get('EDITOR'); return !!v && v.v === 'nano' && !!v.x && e.stepRan('printenv'); },
        solve: ['export EDITOR=nano', 'printenv EDITOR'],
        done: N`«nano». Without «export», «EDITOR» would be a plain shell variable that only this shell could see.`,
      },
      {
        setup: (g) => { g.shell.setVar('JUNE_WAS_HERE', 'yes', true); },
        say: N`@June: (innocently) Run «printenv» again.
There's a new one: «JUNE_WAS_HERE=yes». «unset» removes a variable.`,
        goal: 'Remove June\'s variable: «unset JUNE_WAS_HERE»',
        hints: ['Type «unset JUNE_WAS_HERE».'],
        check: (e) => !e.shell.vars.has('JUNE_WAS_HERE'),
        solve: ['unset JUNE_WAS_HERE'],
        done: N`@June: Rude.`,
      },
      {
        say: N`When your login shell started, it read «~/.profile», which reads «~/.bashrc» — and that defines a few **aliases**: short names that expand into longer commands. Aliases can surprise you. «type» says what a name really is — alias, builtin, or program. Check «ls», then «unalias» it to get the plain program back.`,
        goal: 'Run «type ls», then «unalias ls»',
        hints: ['«type ls» — it will say ls is aliased.', 'Then «unalias ls».'],
        check: (e) => e.stepRan('type') && e.stepRan('unalias') && !e.shell.aliases.ls,
        solve: ['type ls', 'unalias ls'],
        done: N`«ls is aliased to 'ls --color=auto'». Gone now — «ls» is «/usr/bin/ls» again, until the next shell reads «~/.bashrc» and puts the alias back.`,
      },
      {
        say: N`Make one of your own. You're going to check the door log a hundred times tonight.`,
        goal: 'Make a shortcut, then use it: «alias doors=\'tail -n 5 /var/log/meridian/doors.log\'», then «doors»',
        hints: ["«alias doors='tail -n 5 /var/log/meridian/doors.log'» — quotes around the whole command.", 'Then just «doors».'],
        check: (e) => !!e.shell.aliases.doors && /^\s*doors\b/.test(e.line) && !!e.ran('tail'),
        solve: [DOORS, 'doors'],
        done: N`Five lines, four keystrokes.`,
      },
      {
        say: N`Aliases die with the shell. To keep «doors» for good, append it to «~/.bashrc» — the file every interactive bash reads when it starts — and «source» the file to load it into *this* shell now.`,
        goal: 'Make it permanent: «echo "alias doors=\'tail -n 5 /var/log/meridian/doors.log\'" >> ~/.bashrc», then «source ~/.bashrc»',
        hints: [`Type: «echo "${DOORS}" >> ~/.bashrc»`, 'Then «source ~/.bashrc».'],
        check: (e) => /alias doors=/.test(e.read(e.home + '/.bashrc') || '') && !!e.stepEvent('source', (ev) => ev.path === e.home + '/.bashrc'),
        solve: [`echo "${DOORS}" >> ~/.bashrc`, 'source ~/.bashrc'],
        done: N`Loaded. (And «ls» has its alias back: «source» ran every line of «.bashrc», not just yours.)`,
      },
      {
        say: N`Prove it survives. «bash» on its own starts a brand-new interactive shell inside this one, which reads «~/.bashrc» as it starts. Ask it about «doors», then «exit» back.`,
        goal: 'Check a new shell knows your alias: «bash», then «type doors», then «exit»',
        hints: ['«bash» — your prompt looks the same, but it\'s a new shell.', '«type doors» should say it is aliased.', 'Then «exit» to return.'],
        check: (e) => {
          if (e.ran('type', (r) => /doors is aliased/.test(r.out)) && e.shell !== e.game.shell) e.mem.fresh = true;
          return !!e.mem.fresh && e.shell === e.game.shell;
        },
        nudge: (e) => (e.shell === e.game.shell && e.ran('type', (r) => /doors/.test(r.out)) && !e.mem.fresh ? 'That\'s still your old shell — start a new one with «bash» first, then ask it.' : null),
        solve: ['bash', 'type doors', 'exit'],
        done: N`«doors is aliased to 'tail -n 5 /var/log/meridian/doors.log'» — in a shell that never saw you type it. That's what the file is for.

:::lesson
**Login** shells (a console login, «ssh», «su -», «sudo -i») read «~/.profile», which usually reads «~/.bashrc». Other **interactive** shells read «~/.bashrc» directly. Scripts read neither — which is why a script can't rely on your aliases.
:::`,
      },
      {
        say: N`One more. A **symbolic link** is a signpost: a tiny file that points at another path. «ln -s TARGET NAME» makes one. «readlink» shows where a link points.`,
        goal: 'Make a shortcut to the logs: «ln -s /var/log/meridian ~/logs», then «readlink ~/logs»',
        hints: ['«ln -s /var/log/meridian ~/logs» — target first, then the link\'s name.', 'Then «readlink ~/logs».'],
        check: (e) => { const n = e.node(e.home + '/logs'); return !!n && n.type === 'link' && n.target.replace(/\/+$/, '') === '/var/log/meridian' && e.stepRan('readlink'); },
        nudge: (e) => { const n = e.node(e.home + '/logs'); return n && n.type === 'link' && n.target.replace(/\/+$/, '') !== '/var/log/meridian' ? `@June: Your link points at «${n.target}». Remove it with «rm ~/logs» and try again: target first, then the name.` : null; },
        solve: ['ln -s /var/log/meridian ~/logs', 'readlink ~/logs'],
        done: N`«/var/log/meridian». «cd ~/logs» now takes you straight there. «ls -l» shows links as «logs -> /var/log/meridian».`,
      },
      {
        say: N`Now: somebody used Vesna's account between 23:58 and 00:09. Bash keeps the commands each user typed in «~/.bash_history». Hers is in her home: «~vesna/.bash_history». (A «~» followed by a name means *that user's* home.)`,
        goal: 'Read the commands typed as Vesna: «sudo cat ~vesna/.bash_history»',
        hints: ['Type «sudo cat ~vesna/.bash_history». (Or «sudo cat /home/vesna/.bash_history».)'],
        check: (e) => e.didRead('/home/vesna/.bash_history'),
        solve: ['sudo cat ~vesna/.bash_history', '$PW'],
        done: N`The first few lines are her: a «tail» of the doors, a check on the cameras, her notes. Then the hand changes:

«sudo sed -i '/0417/d; /car8_mail/d' doors.log.1» — delete every line with card 0417, and every line about the mail van.
«sudo rm /var/lib/cctv/car2/frame-233*.jpg ...» — half an hour of camera, gone.
«sudo passwd vesna» — and now she can't get back into her own account.
«sudo useradd -m -d /var/lib/.maint -s /bin/bash -G sudo maint» — a brand-new account, with root powers, hidden in a dot-directory.
«sudo nohup /tmp/.t/hold.sh &» · «sudo systemctl stop doord» · «sudo crontab -e» · «sudo nano /srv/meridian/manifest/mail.csv»

@June: She'd never type «useradd» in a hurry at midnight. She'd make a *ticket* for it. And she'd never call anything «maint».`,
        evidence: 'history',
      },
      {
        say: N`Every login is recorded too. «last» lists them, newest first.`,
        goal: 'Who has logged in tonight? «last»',
        hints: ['Type «last».'],
        check: (e) => !!e.ran('last', (r) => /vesna/.test(r.out)),
        solve: ['last'],
        done: N`«vesna   pts/2   10.8.0.12   ... 23:58 - 00:09 (00:11)»

Eleven minutes, from her laptop, starting six minutes after a man in a grey coat followed her into the staff car. And above it, still open — a login on a terminal called «ttyS3».`,
      },
      {
        say: N`«who» shows who is logged in *right now*.`,
        goal: 'Who is on the system now? «who»',
        hints: ['Type «who».'],
        check: (e) => !!e.ran('who', (r) => /ttyS3/.test(r.out)),
        solve: ['who'],
        done: N`You, on «pts/1». And «kiosk» on «ttyS3», since 00:11.

@Abel: ttyS3 is the parcel kiosk. It's a serial terminal. It is bolted to the wall... (he turns, slowly, to look at the sealed door at the end of the car) ...*inside the mail van*.`,
      },
      {
        say: N`«w» is «who» with more: how long each session has been idle, and what it's running.`,
        goal: 'What is the kiosk session doing? «w»',
        hints: ['Type «w».'],
        check: (e) => !!e.ran('w', (r) => /kiosk/.test(r.out)),
        solve: ['w'],
        done: N`«kiosk  ttyS3  ...  kioskmenu» — not a shell at all: the parcel kiosk's menu program, which logs in on its own. Somebody inside a sealed, refrigerated van has been at that kiosk for nearly two hours.

Abel is already at the van door, hauling on the handle. It doesn't move. The rules are in «/etc/meridian/doord.conf»: a sealed door opens from *outside* with a staff card, but once it's shut, the inside reader is dead and it only opens on a remote release from «doord». And «doord», according to that history, was stopped at 00:06.
@June: We need to talk to whoever's in there. Through the computer.
@June: (quieter) It's her. It's Vesna. I know it is.`,
      },
    ],
    outro: N`@Abel: (at the van door, his palm flat on the steel) It's four degrees in there. Four degrees, since before midnight.
@June: Then we'd better hurry.`,
  });
})();
