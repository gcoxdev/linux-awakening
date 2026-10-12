/* Practice Range — tasks: getting around, files & folders, finding things, getting help. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const P = LA.practice;
  const T = P.task;
  const U = LA.util;
  const VFS = LA.VFS;
  const pack = LA.stories.practice;

  /* helpers shared by the checks */
  const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  /* lines shown on screen, read as paths relative to where the command ran */
  const shownPaths = (e) => e.shownLines().map((l) => VFS.normalize(l.replace(/^\.\//, ''), e.cwd));
  P.h = { sameSet, shownPaths };

  /* ===================== getting around ===================== */
  T({
    id: 'nav-whoami', topic: 'nav', level: 1, cmds: ['whoami', 'pwd'], title: 'Who and where',
    setup(t) { t.dir('~/' + t.word()); },
    prompt: 'Two quick questions for the machine: which user are you logged in as, and which directory are you in?',
    parts: [
      { text: 'print your username', check: (e) => !!e.ran(['whoami', 'id']) },
      { text: 'print your current directory', check: (e) => !!e.ran('pwd') },
    ],
    solution: ['whoami', 'pwd'],
    why: 'Worth checking before anything destructive — especially after «sudo -i» or «su», when the answer may have changed.',
  });
  T({
    id: 'nav-deep-cd', topic: 'nav', level: 1, cmds: ['cd', 'pwd'], title: 'Into the depths',
    setup(t) { const a = t.word(), b = t.word() + '-' + t.int(1, 9); t.dir(`~/projects/${a}/src/${b}`); t.dir(`~/projects/${a}/docs`); return { path: `~/projects/${a}/src/${b}` }; },
    prompt: (x) => `Go into the directory «${x.path}», then print your working directory to prove you're there.`,
    check: (e, x) => e.cwd === e.p(x.path) && !!e.ran('pwd'),
    hints: ['«cd» changes directory; «pwd» prints where you are.'],
    solution: (x) => [`cd ${x.path}`, 'pwd'],
    why: '«cd» with no argument (or «cd ~») always takes you home; «cd -» takes you back to the previous directory.',
  });
  T({
    id: 'nav-cd-back', topic: 'nav', level: 1, cmds: ['cd'], title: 'There and back again',
    prompt: 'Go to «/var/log», then to «/etc», then jump straight back to «/var/log» using the shortest command there is.',
    parts: [
      { text: 'cd to /var/log', check: (e) => e.cwd === '/var/log' },
      { text: 'cd to /etc', check: (e) => e.cwd === '/etc' },
      { text: 'jump back with «cd -»', check: (e) => e.cwd === '/var/log' && /^\s*cd\s+-\s*$/.test(e.line) },
    ],
    solution: ['cd /var/log', 'cd /etc', 'cd -'],
    why: '«cd -» swaps you with your previous directory — handy when you bounce between two places.',
  });
  T({
    id: 'nav-hidden', topic: 'nav', level: 1, cmds: ['ls', 'cat'], title: 'Hidden in plain sight',
    setup(t) { const code = `${t.word().toUpperCase()}-${t.int(1000, 9999)}`; const name = '.' + t.word() + '_key'; for (const f of ['readme.txt', 'list.md', 'todo.txt']) t.file('~/vault/' + f, 'nothing here\n'); t.file('~/vault/' + name, code + '\n'); return { code, name }; },
    prompt: 'There\'s a hidden file in «~/vault». Print what\'s inside it.',
    check: (e, x) => e.answer(x.code),
    hints: ['Hidden files start with a dot, and plain «ls» skips them.', '«ls -a ~/vault» shows everything.'],
    solution: (x) => ['ls -a ~/vault', `cat ~/vault/${x.name}`],
    why: '«ls -a» shows all files, «ls -A» all except «.» and «..».',
  });
  T({
    id: 'nav-largest', topic: 'nav', level: 2, cmds: ['ls'], title: 'The biggest file',
    setup(t) {
      const names = t.pickN(['movie.mkv', 'backup.img', 'photos.zip', 'notes.txt', 'song.flac', 'report.pdf', 'dataset.csv', 'game.iso'], 6);
      const sizes = t.shuffle([1200, 48000, 920000, 3400000, 12500000, 640000].map((s) => s + t.int(0, 999)));
      names.forEach((n, i) => t.file('~/downloads/' + n, '', { size: sizes[i] }));
      return { biggest: names[sizes.indexOf(Math.max(...sizes))] };
    },
    prompt: 'Which file in «~/downloads» is the largest? Make it the first file listed on your screen.',
    check: (e, x) => { const l = e.shownLines().filter((s) => !/^total /.test(s)); if (!l.length) return false; const tk = l[0].split(/\s+/); return tk[0] === x.biggest || tk[tk.length - 1] === x.biggest; },
    hints: ['«ls» has an option that sorts by size.', '«ls -lS» sorts largest first; add «-h» for human-readable sizes.'],
    solution: ['ls -lhS ~/downloads'],
    why: '«ls -S» sorts by size, «ls -t» by time, «-r» reverses either. «-h» prints 12M instead of 12582912.',
  });
  T({
    id: 'nav-newest', topic: 'nav', level: 2, cmds: ['ls'], title: 'What just arrived?',
    setup(t) {
      const names = t.pickN(['invoice.pdf', 'photo.jpg', 'memo.txt', 'slides.pptx', 'data.json', 'scan.png', 'letter.doc'], 5);
      let age = 0;
      names.forEach((n) => { age += t.int(2, 9) * 3600000; t.file('~/inbox/' + n, 'x\n', { mtime: t.now - age }); });
      return { newest: names[0] };
    },
    prompt: 'Which file in «~/inbox» was modified most recently? Make it the first file listed on your screen.',
    check: (e, x) => { const l = e.shownLines().filter((s) => !/^total /.test(s)); if (!l.length) return false; const tk = l[0].split(/\s+/); return tk[0] === x.newest || tk[tk.length - 1] === x.newest; },
    hints: ['«ls -t» sorts by modification time, newest first.'],
    solution: ['ls -lt ~/inbox'],
    why: '«ls -lt» is the classic "what changed recently?" view. «ls -ltr» puts the newest at the bottom, nearest your prompt.',
  });
  T({
    id: 'nav-head', topic: 'nav', level: 1, cmds: ['head'], title: 'Just the top',
    setup(t) { const n = t.int(3, 8); const lines = pack.gen.appLog(t, 40).map((l) => l.text); t.file('~/logs/server.log', lines); return { n, want: lines.slice(0, n) }; },
    prompt: (x) => `Show only the first ${x.n} lines of «~/logs/server.log».`,
    check: (e, x) => sameSet(e.shownLines(), x.want) && e.shownLines().length === x.n,
    hints: ['«head -n N FILE».'],
    solution: (x) => [`head -n ${x.n} ~/logs/server.log`],
    why: '«head» shows the start of a file (10 lines by default); «head -c 100» shows the first 100 bytes.',
  });
  T({
    id: 'nav-tail', topic: 'nav', level: 1, cmds: ['tail'], title: 'Latest entries',
    setup(t) { const n = t.int(3, 8); const lines = pack.gen.appLog(t, 40).map((l) => l.text); t.file('~/logs/server.log', lines); return { n, want: lines.slice(-n) }; },
    prompt: (x) => `Logs grow at the bottom. Show the last ${x.n} lines of «~/logs/server.log».`,
    check: (e, x) => sameSet(e.shownLines(), x.want) && e.shownLines().length === x.n,
    hints: ['«tail -n N FILE».'],
    solution: (x) => [`tail -n ${x.n} ~/logs/server.log`],
    why: '«tail -f FILE» keeps following a log as it grows — press Ctrl+C to stop.',
  });
  T({
    id: 'nav-line-n', topic: 'nav', level: 2, cmds: ['head', 'tail', 'sed'], title: 'One exact line',
    setup(t) { const lines = Array.from({ length: 60 }, (_, i) => `${i + 1}. ${t.word()} ${t.word()} ${t.int(100, 999)}`); const n = t.int(12, 55); t.file('~/book.txt', lines); return { n, want: lines[n - 1] }; },
    prompt: (x) => `Print line ${x.n} of «~/book.txt» — and only that line.`,
    check: (e, x) => { const l = e.shownLines(); return l.length === 1 && l[0] === x.want; },
    hints: ['Take the first N lines, then the last one of those.', (x) => `«head -n ${x.n} ~/book.txt | tail -n 1» — or «sed -n '${x.n}p' ~/book.txt».`],
    solution: (x) => [`sed -n '${x.n}p' ~/book.txt`],
    why: '«head -n N | tail -n 1» works everywhere; «sed -n \'Np\'» says it in one command.',
  });
  T({
    id: 'nav-wc-lines', topic: 'nav', level: 1, cmds: ['wc'], title: 'How long is it?',
    setup(t) { const n = t.int(30, 400); t.file('~/data/records.csv', Array.from({ length: n }, () => `${t.int(1, 9999)},${t.word()},${t.int(1, 99)}`)); return { n }; },
    prompt: 'How many lines are in «~/data/records.csv»? Get the computer to count them.',
    check: (e, x) => e.answer(x.n) && e.used('wc'),
    hints: ['«wc» counts lines, words and bytes; «-l» counts just lines.'],
    solution: ['wc -l ~/data/records.csv'],
    why: '«wc -l» counts lines, «-w» words, «-c» bytes. With «<» (wc -l < file) it prints just the number.',
  });
  T({
    id: 'nav-wc-words', topic: 'nav', level: 1, cmds: ['wc'], title: 'Word count',
    setup(t) { const words = Array.from({ length: t.int(40, 160) }, () => t.word()); const lines = []; for (let i = 0; i < words.length; i += t.int(5, 12)) lines.push(words.slice(i, i + 9).join(' ')); const text = lines.join('\n') + '\n'; t.file('~/essay.txt', text); return { n: text.split(/\s+/).filter(Boolean).length }; },
    prompt: 'How many words are in «~/essay.txt»?',
    check: (e, x) => e.answer(x.n) && e.used('wc'),
    hints: ['«wc -w».'],
    solution: ['wc -w ~/essay.txt'],
  });
  T({
    id: 'nav-file-type', topic: 'nav', level: 2, cmds: ['file'], title: 'What is this, really?',
    setup(t) {
      const names = t.shuffle(['blob', 'data', 'thing', 'x1', 'output']).slice(0, 4);
      t.file('~/mystery/' + names[0], '', { format: 'jpeg', data: { comment: 'holiday', size: '800x600' }, size: 82000 });
      t.file('~/mystery/' + names[1], 'just some text\n');
      t.file('~/mystery/' + names[2], '#!/bin/bash\necho hi\n');
      t.file('~/mystery/' + names[3], '', { format: 'gzip', data: { name: 'x', inner: { content: 'x\n' } } });
      return { img: names[0] };
    },
    prompt: 'None of the files in «~/mystery» has an extension. One of them is a JPEG image. Ask the system what each file really is, so the image shows up on screen.',
    check: (e, x) => e.used('file') && e.shownLines().some((l) => l.startsWith(x.img + ':') || l.includes('/' + x.img + ':')) && /JPEG/.test(e.out()),
    hints: ['«file» looks inside a file instead of trusting its name.', '«file ~/mystery/*»'],
    solution: ['file ~/mystery/*'],
    why: 'Linux doesn\'t need extensions. «file» reads the first bytes (the "magic number") to identify the format.',
  });
  T({
    id: 'nav-less', topic: 'nav', level: 1, cmds: ['less'], title: 'A pager',
    setup(t) { t.file('~/manual.txt', Array.from({ length: 200 }, (_, i) => `section ${i}: ${t.word()} ${t.word()}`)); },
    prompt: 'Open «~/manual.txt» in a pager you can scroll, search it for «section 150» (type «/section 150» and Enter), then quit with «q».',
    check: (e) => !!e.ran('less', (r) => e.targets(r).includes(e.p('~/manual.txt'))),
    hints: ['«less FILE» — Space/arrows scroll, «/word» searches, «n» next match, «q» quits.'],
    solution: ['less ~/manual.txt'],
    why: '«less» is how «man» shows manuals too: «/» search, «g»/«G» top and bottom, «q» quit.',
  });
  T({
    id: 'nav-cat-n', topic: 'nav', level: 1, cmds: ['cat', 'nl'], title: 'Numbered lines',
    setup(t) { t.file('~/deploy.sh', ['#!/bin/bash', 'set -e', 'cd /opt/app', 'git pull', 'systemctl restart app', 'echo done']); },
    prompt: 'Show «~/deploy.sh» with a line number in front of every line.',
    check: (e) => (!!e.ran('cat', (r) => e.has(r, 'n')) || !!e.ran('nl')) && /\b6\b/.test(e.out()),
    hints: ['«cat -n» numbers every line; «nl» numbers the non-empty ones.'],
    solution: ['cat -n ~/deploy.sh'],
  });
  T({
    id: 'nav-tree', topic: 'nav', level: 1, cmds: ['tree'], title: 'The shape of things',
    setup(t) { for (const d of ['src/lib/util', 'src/app', 'docs/api', 'tests/unit/deep']) t.dir('~/site/' + d); t.file('~/site/src/app/main.js', '//\n'); },
    prompt: 'Draw the directory tree of «~/site», but only two levels deep.',
    check: (e) => !!e.ran('tree', (r) => r.args.includes('-L') && r.args.includes('2')),
    hints: ['«tree» draws directories; «-L N» limits the depth.'],
    solution: ['tree -L 2 ~/site'],
    why: '«tree -d» shows only directories; «tree -a» includes hidden ones.',
  });
  T({
    id: 'nav-stat-octal', topic: 'nav', level: 2, cmds: ['stat'], title: 'Permissions as a number',
    setup(t) { const m = t.pick([0o640, 0o600, 0o755, 0o750, 0o644, 0o700]); t.file('~/secret.cfg', 'x=1\n', { mode: m }); return { m: m.toString(8) }; },
    prompt: 'What are the permissions of «~/secret.cfg» as an octal number (like «644»)? Print just that number.',
    check: (e, x) => e.answer(x.m, { exact: true }) && e.used('stat'),
    hints: ['«stat» shows everything about a file; «-c» picks one field.', '«stat -c %a ~/secret.cfg»'],
    solution: ['stat -c %a ~/secret.cfg'],
    why: '«stat -c» takes a format: %a octal mode, %U owner, %s size, %y modification time.',
  });
  T({
    id: 'nav-du', topic: 'nav', level: 2, cmds: ['du', 'sort'], title: 'Where did the space go?',
    setup(t) {
      const dirs = t.pickN(['videos', 'music', 'cache', 'archive', 'scratch', 'models'], 4);
      const big = dirs[t.int(0, 3)];
      dirs.forEach((d) => { for (let i = 0; i < 3; i++) t.file(`~/storage/${d}/f${i}.bin`, '', { size: (d === big ? 90000000 : 4000000) + t.int(0, 3000000) }); });
      return { big };
    },
    prompt: 'Which directory inside «~/storage» uses the most space? Show the sizes so that one is on screen.',
    check: (e, x) => e.used('du') && e.shownLines().some((l) => l.endsWith('/' + x.big) || l.split(/\s+/).pop() === x.big),
    hints: ['«du -s» gives one total per argument; «-h» makes it readable.', '«du -sh ~/storage/* | sort -h»'],
    solution: ['du -sh ~/storage/* | sort -h'],
    why: '«du -sh * | sort -h» is the everyday "what\'s big in here?" command. «sort -h» understands 4K, 12M, 3G.',
  });
  T({
    id: 'nav-df', topic: 'nav', level: 1, cmds: ['df'], title: 'How full is the disk?',
    prompt: 'Show how much space is used and free on every mounted filesystem, in human-readable units.',
    check: (e) => !!e.ran('df', (r) => e.has(r, 'h')),
    hints: ['«df -h».'],
    solution: ['df -h'],
    why: '«df» answers "how full?"; «du» answers "what\'s using it?".',
  });
  T({
    id: 'nav-date-fmt', topic: 'nav', level: 2, cmds: ['date'], title: 'A date for a filename',
    prompt: 'Print today\'s date in the format YYYY-MM-DD (for example 2026-03-14) — the format you\'d use in a filename.',
    check: (e) => e.answer(U.strftime('%F', new Date(LA.now())), { exact: true }) && e.used('date'),
    hints: ['«date +FORMAT» — %Y year, %m month, %d day.', '«date +%F» is a shortcut for %Y-%m-%d.'],
    solution: ['date +%F'],
    why: '«tar -czf backup-$(date +%F).tar.gz dir» makes a dated backup in one go.',
  });

  /* ===================== files & folders ===================== */
  T({
    id: 'files-mkdir-p', topic: 'files', level: 1, cmds: ['mkdir'], title: 'Scaffolding',
    setup(t) { return { p: t.word() }; },
    prompt: (x) => `Create this structure in one command: «~/${x.p}/src», «~/${x.p}/docs» and «~/${x.p}/tests».`,
    check: (e, x) => ['src', 'docs', 'tests'].every((d) => { const n = e.file(`~/${x.p}/${d}`); return n && n.type === 'dir'; }),
    hints: ['«mkdir -p» creates missing parents.', (x) => `Brace expansion writes the three paths for you: «mkdir -p ~/${x.p}/{src,docs,tests}»`],
    solution: (x) => [`mkdir -p ~/${x.p}/{src,docs,tests}`],
    why: '«{a,b,c}» is brace expansion: the shell turns «x/{a,b}» into «x/a x/b» before the command runs.',
  });
  T({
    id: 'files-touch-seq', topic: 'files', level: 2, cmds: ['touch'], title: 'A week of files',
    setup(t) { return { n: t.int(5, 9) }; },
    prompt: (x) => `Create empty files «day1.txt» to «day${x.n}.txt» in a new folder «~/journal».`,
    check: (e, x) => Array.from({ length: x.n }, (_, i) => e.file(`~/journal/day${i + 1}.txt`)).every((n) => n && n.type === 'file'),
    hints: ['«mkdir ~/journal» first.', (x) => `«touch ~/journal/day{1..${x.n}}.txt» — «{1..N}» counts for you.`],
    solution: (x) => ['mkdir -p ~/journal', `touch ~/journal/day{1..${x.n}}.txt`],
  });
  T({
    id: 'files-cp-bak', topic: 'files', level: 1, cmds: ['cp'], title: 'Backup before editing',
    setup(t) { t.file('~/config/app.conf', `port=${t.int(3000, 9000)}\nworkers=${t.int(2, 16)}\n`); },
    prompt: 'Before you edit «~/config/app.conf», make a copy of it called «app.conf.bak» in the same folder.',
    check: (e) => { const a = e.text('~/config/app.conf'); return !!a && e.text('~/config/app.conf.bak') === a; },
    hints: ['«cp SOURCE DEST».'],
    solution: ['cp ~/config/app.conf ~/config/app.conf.bak'],
    why: 'Shortcut: «cp file{,.bak}» expands to «cp file file.bak».',
  });
  T({
    id: 'files-cp-r', topic: 'files', level: 1, cmds: ['cp'], title: 'Copy a whole tree',
    setup(t) { const files = ['index.html', 'css/site.css', 'js/app.js', 'img/logo.png']; files.forEach((f) => t.file('~/site/' + f, `/* ${f} */\n`)); return { files }; },
    prompt: 'Make a complete copy of the folder «~/site», subfolders and all, called «~/site-backup».',
    check: (e, x) => x.files.every((f) => e.text('~/site-backup/' + f) === e.text('~/site/' + f)),
    hints: ['Plain «cp» refuses directories; «-r» copies recursively.'],
    solution: ['cp -r ~/site ~/site-backup'],
    why: '«cp -a» also keeps permissions and timestamps — what you want for backups.',
  });
  T({
    id: 'files-mv-rename', topic: 'files', level: 1, cmds: ['mv'], title: 'Rename',
    setup(t) { t.file('~/notes/todo.txt', '- buy milk\n'); },
    prompt: 'Rename «~/notes/todo.txt» to «done.txt».',
    check: (e) => !!e.file('~/notes/done.txt') && !e.file('~/notes/todo.txt'),
    hints: ['Renaming is moving to a new name: «mv OLD NEW».'],
    solution: ['mv ~/notes/todo.txt ~/notes/done.txt'],
  });
  T({
    id: 'files-mv-glob', topic: 'files', level: 2, cmds: ['mv', 'mkdir'], title: 'Sort the downloads',
    setup(t) { const jpg = t.pickN(['beach', 'cat', 'party', 'sunset', 'dog', 'mountain'], 4).map((n) => n + '.jpg'); const other = ['report.pdf', 'song.mp3', 'notes.txt']; for (const f of jpg.concat(other)) t.file('~/downloads/' + f, 'x\n'); return { jpg, other }; },
    prompt: 'Move every «.jpg» file from «~/downloads» into a new folder «~/pictures». Leave everything else where it is.',
    check: (e, x) => x.jpg.every((f) => e.file('~/pictures/' + f) && !e.file('~/downloads/' + f)) && x.other.every((f) => e.file('~/downloads/' + f)),
    hints: ['Make the folder first, then use a glob: «*.jpg».', '«mkdir ~/pictures && mv ~/downloads/*.jpg ~/pictures/»'],
    solution: ['mkdir ~/pictures', 'mv ~/downloads/*.jpg ~/pictures/'],
  });
  T({
    id: 'files-rm-glob', topic: 'files', level: 1, cmds: ['rm'], title: 'Clean the build',
    setup(t) { const tmp = Array.from({ length: t.int(3, 6) }, (_, i) => `obj${i}.tmp`); const keep = ['main.c', 'Makefile', 'README']; for (const f of tmp.concat(keep)) t.file('~/build/' + f, 'x\n'); return { tmp, keep }; },
    prompt: 'Delete every «.tmp» file in «~/build». Keep everything else.',
    check: (e, x) => x.tmp.every((f) => !e.file('~/build/' + f)) && x.keep.every((f) => e.file('~/build/' + f)),
    hints: ['«rm» with a glob. Check with «ls» first if you\'re nervous.'],
    solution: ['rm ~/build/*.tmp'],
    why: 'A good habit: run «ls ~/build/*.tmp» first to see exactly what the glob matches, then swap «ls» for «rm».',
  });
  T({
    id: 'files-rm-r', topic: 'files', level: 1, cmds: ['rm'], title: 'Remove a whole project',
    setup(t) { for (const f of ['a/b/c.txt', 'a/d.txt', 'e.txt', 'f/g/h/i.txt']) t.file('~/old_project/' + f, 'x\n'); t.file('~/keep.txt', 'keep me\n'); },
    prompt: 'Delete the directory «~/old_project» and everything in it (and nothing else).',
    check: (e) => !e.file('~/old_project') && !!e.file('~/keep.txt'),
    hints: ['«rm -r» removes directories recursively.'],
    solution: ['rm -r ~/old_project'],
    why: '«rm -r» has no undo and no wastebasket. «rm -ri» asks before each deletion.',
  });
  T({
    id: 'files-rmdir', topic: 'files', level: 2, cmds: ['rmdir'], title: 'Only the empty ones',
    setup(t) { const empty = t.pickN(['old', 'tmp', 'unused', 'later'], 2); const full = t.pickN(['photos', 'docs', 'music'], 2); for (const d of empty) t.dir('~/clutter/' + d); for (const d of full) t.file(`~/clutter/${d}/keep.txt`, 'x\n'); return { empty, full }; },
    prompt: 'Remove the empty directories inside «~/clutter», but none that still contain files.',
    check: (e, x) => x.empty.every((d) => !e.file('~/clutter/' + d)) && x.full.every((d) => e.file('~/clutter/' + d)),
    hints: ['«rmdir» only removes empty directories — it refuses the others, which is exactly what you want here.', '«rmdir ~/clutter/*» (the errors about non-empty ones are fine).'],
    solution: ['rmdir ~/clutter/*'],
  });
  T({
    id: 'files-ln-current', topic: 'files', level: 2, cmds: ['ln'], title: 'Point at the release',
    setup(t) { const v = `${t.int(1, 4)}.${t.int(0, 9)}.${t.int(0, 9)}`; t.file(`~/releases/v${v}/run.sh`, '#!/bin/bash\n'); t.file('~/releases/v0.9.0/run.sh', '#!/bin/bash\n'); return { v }; },
    prompt: (x) => `Create a symbolic link «~/current» that points to «~/releases/v${x.v}».`,
    check: (e, x) => { const n = e.file('~/current'); return !!n && n.type === 'link' && VFS.normalize(n.target, e.home) === e.p(`~/releases/v${x.v}`); },
    hints: ['«ln -s TARGET LINKNAME» — target first.'],
    solution: (x) => [`ln -s ~/releases/v${x.v} ~/current`],
    why: 'Deploys often work this way: switch «current» to a new release in one step, and back again if it breaks («ln -sfn»).',
  });
  T({
    id: 'files-readlink', topic: 'files', level: 1, cmds: ['readlink'], title: 'Where does it point?',
    setup(t) { const tgt = `/opt/tools-${t.int(10, 99)}/bin/${t.word()}`; t.fs.link(t.p('~/latest'), tgt); return { tgt }; },
    prompt: '«~/latest» is a symbolic link. Print where it points.',
    check: (e, x) => e.answer(x.tgt),
    hints: ['«readlink LINK» — or look at «ls -l».'],
    solution: ['readlink ~/latest'],
  });
  T({
    id: 'files-spaces', topic: 'files', level: 2, cmds: ['mv'], title: 'Names with spaces',
    setup(t) { t.file('~/My Documents/report final v2.txt', 'Q3\n'); },
    prompt: 'Rename «~/My Documents/report final v2.txt» to «report.txt» (same folder).',
    check: (e) => !!e.file('~/My Documents/report.txt') && !e.file('~/My Documents/report final v2.txt'),
    hints: ['Spaces split arguments. Quote the names — but leave «~» outside the quotes.', '«mv ~/"My Documents/report final v2.txt" ~/"My Documents/report.txt"»'],
    solution: ['mv ~/"My Documents/report final v2.txt" ~/"My Documents/report.txt"'],
    why: 'Tab completion adds the backslashes for you: type «~/My» and press Tab.',
  });
  T({
    id: 'files-echo-new', topic: 'files', level: 1, cmds: ['echo'], title: 'Write a file',
    setup(t) { return { name: t.name() }; },
    prompt: (x) => `Create «~/hello.txt» containing exactly one line: «Hello, ${x.name}!»`,
    check: (e, x) => e.text('~/hello.txt') === `Hello, ${x.name}!\n`,
    hints: ['«echo TEXT > FILE» — quote the text.'],
    solution: (x) => [`echo "Hello, ${x.name}!" > ~/hello.txt`],
    why: 'In double quotes, «!» can trigger history expansion in an interactive bash; single quotes are safest for literal text.',
  });
  T({
    id: 'files-append', topic: 'files', level: 1, cmds: ['echo'], title: 'Add, don\'t replace',
    setup(t) { const lines = Array.from({ length: t.int(2, 4) }, () => `- ${t.word()}`); t.file('~/todo.txt', lines); return { lines, add: `- ${t.word()} ${t.word()}` }; },
    prompt: (x) => `Add the line «${x.add}» to the end of «~/todo.txt», keeping what's already there.`,
    check: (e, x) => e.text('~/todo.txt') === x.lines.concat([x.add]).join('\n') + '\n',
    nudge: (e, x) => (e.text('~/todo.txt') === x.add + '\n' ? 'Oops — «>» replaced the file. Recreate it, or skip; next time use «>>».' : null),
    hints: ['«>>» appends; «>» would wipe the file first.'],
    solution: (x) => [`echo "${x.add}" >> ~/todo.txt`],
  });
  T({
    id: 'files-nano', topic: 'files', level: 1, cmds: ['nano'], title: 'Edit a setting',
    setup(t) { const port = t.pick([8080, 3000, 5000]); const want = t.pick([9090, 8443, 4000]); t.file('~/app.conf', `host=0.0.0.0\nport=${port}\nworkers=4\n`); return { port, want }; },
    prompt: (x) => `Open «~/app.conf» in an editor and change «port=${x.port}» to «port=${x.want}». Leave the other lines alone.`,
    check: (e, x) => e.text('~/app.conf') === `host=0.0.0.0\nport=${x.want}\nworkers=4\n`,
    hints: ['«nano ~/app.conf», edit, then Ctrl+O, Enter to save and Ctrl+X to exit.'],
    solution: (x) => [{ edit: (c) => c.replace(`port=${x.port}`, `port=${x.want}`) }, 'nano ~/app.conf'],
    why: 'In nano: Ctrl+W searches, Ctrl+K cuts a line, Ctrl+U pastes it. (For a scripted change, «sed -i» does the same.)',
  });
  T({
    id: 'files-basename', topic: 'files', level: 1, cmds: ['basename', 'dirname'], title: 'Pick a path apart',
    setup(t) { const p = `/var/log/${t.word()}/${t.word()}.log`; return { p, base: p.split('/').pop(), dir: p.replace(/\/[^/]+$/, '') }; },
    prompt: (x) => `For the path «${x.p}», print just the file name, then just the directory part.`,
    parts: [
      { text: (x) => `the file name («${x.base}»)`, check: (e, x) => !!e.ran('basename') && e.answer(x.base) },
      { text: 'the directory part', check: (e, x) => !!e.ran('dirname') && e.answer(x.dir) },
    ],
    solution: (x) => [`basename ${x.p}`, `dirname ${x.p}`],
    why: '«basename file.txt .txt» also strips a suffix — handy for renaming in loops.',
  });
  T({
    id: 'files-realpath', topic: 'files', level: 2, cmds: ['realpath'], title: 'The real path',
    setup(t) { const a = t.word(), b = t.word(); t.file(`~/${b}/notes.txt`, 'x\n'); t.dir(`~/${a}/deep`); return { messy: `~/${a}/deep/../../${b}/./notes.txt`, clean: `/home/${t.user}/${b}/notes.txt` }; },
    prompt: (x) => `Print the absolute, cleaned-up path of «${x.messy}».`,
    check: (e, x) => e.answer(x.clean),
    hints: ['«realpath» resolves «.», «..» and symlinks.'],
    solution: (x) => [`realpath ${x.messy}`],
  });
  T({
    id: 'files-glob-conf', topic: 'files', level: 1, cmds: ['ls'], title: 'Only .conf files',
    prompt: 'List only the files directly in «/etc» whose names end in «.conf».',
    check: (e) => !!e.ran('ls', (r) => r.args.filter((a) => !a.startsWith('-')).length >= 2 && r.args.filter((a) => !a.startsWith('-')).every((a) => a.endsWith('.conf'))),
    hints: ['A glob: «*.conf».'],
    solution: ['ls /etc/*.conf'],
    why: 'The shell expands the glob before «ls» runs — «ls» just receives a list of names.',
  });

  /* ===================== finding things ===================== */
  T({
    id: 'find-name', topic: 'find', level: 1, cmds: ['find'], title: 'Every log file',
    setup(t) {
      const want = [];
      for (const d of t.pickN(['api', 'web', 'worker', 'db', 'cron'], 4)) {
        for (const f of [t.word() + '.log', 'notes.txt']) { const p = `~/projects/${d}/${t.chance(0.5) ? 'logs/' : ''}${f}`; t.file(p, 'x\n'); if (f.endsWith('.log')) want.push(t.p(p)); }
      }
      return { want };
    },
    prompt: 'Find every file whose name ends in «.log» anywhere under «~/projects», and list their paths.',
    check: (e, x) => e.used('find') && sameSet([...new Set(shownPaths(e))], x.want),
    hints: ['«find WHERE -name PATTERN» — quote the pattern.', '«find ~/projects -name \'*.log\'»'],
    solution: ["find ~/projects -name '*.log'"],
    why: 'Quote the pattern so the shell passes «*.log» to find instead of expanding it in the current directory.',
  });
  T({
    id: 'find-type-d', topic: 'find', level: 2, cmds: ['find'], title: 'Every cache folder',
    setup(t) { const want = []; for (const p of ['a/cache', 'b/c/cache', 'd/cache', 'e/f/g/cache']) { t.dir('~/tree/' + p); want.push(t.p('~/tree/' + p)); } t.file('~/tree/x/cache', 'not a directory\n'); return { want }; },
    prompt: 'Under «~/tree», find every *directory* named «cache» (there\'s a file called cache too — leave it out).',
    check: (e, x) => e.used('find', (r) => r.args.includes('-type')) && sameSet([...new Set(shownPaths(e))], x.want),
    hints: ['«-type d» matches directories, «-type f» files.', '«find ~/tree -type d -name cache»'],
    solution: ['find ~/tree -type d -name cache'],
  });
  T({
    id: 'find-size', topic: 'find', level: 2, cmds: ['find'], title: 'Big files',
    setup(t) { const want = []; for (let i = 0; i < 8; i++) { const big = t.chance(0.4) || (i === 7 && !want.length); const p = `~/data/${t.word()}${i}.bin`; t.file(p, '', { size: big ? t.int(2, 60) * 1048576 : t.int(1, 900) * 1024 }); if (big) want.push(t.p(p)); } return { want }; },
    prompt: 'List every file under «~/data» larger than 1 MB.',
    check: (e, x) => e.used('find', (r) => r.args.includes('-size')) && sameSet([...new Set(shownPaths(e))], x.want),
    hints: ['«-size +1M» means "more than 1 MiB".'],
    solution: ['find ~/data -size +1M'],
    why: '«-size +100k», «-size -5M», «-size +1G». Combine with «-type f» to skip directories.',
  });
  T({
    id: 'find-mtime', topic: 'find', level: 2, cmds: ['find'], title: 'Recently changed',
    setup(t) { const want = []; for (let i = 0; i < 8; i++) { const days = t.pick([0.2, 0.5, 1.4, 3.5, 6, 12, 30]); const p = `~/reports/r${i}-${t.word()}.txt`; t.file(p, 'x\n', { mtime: t.now - days * 86400000 }); if (days < 2) want.push(t.p(p)); } if (!want.length) { t.file('~/reports/today.txt', 'x\n', { mtime: t.now - 3600000 }); want.push(t.p('~/reports/today.txt')); } return { want }; },
    prompt: 'Which files under «~/reports» were modified in the last 2 days? List them.',
    check: (e, x) => e.used('find', (r) => r.args.includes('-mtime') || r.args.includes('-mmin') || r.args.includes('-newer')) && sameSet([...new Set(shownPaths(e).filter((p) => p !== e.p('~/reports')))], x.want),
    hints: ['«-mtime -2» means "modified less than 2 days ago". Add «-type f» to leave out the directory itself.'],
    solution: ['find ~/reports -type f -mtime -2'],
  });
  T({
    id: 'find-empty-delete', topic: 'find', level: 2, cmds: ['find'], title: 'Sweep up empty files',
    setup(t) { const empty = [], full = []; for (let i = 0; i < 9; i++) { const p = `~/scratch/${t.pick(['a', 'b', 'c'])}/f${i}.txt`; const isEmpty = t.chance(0.5); t.file(p, isEmpty ? '' : 'data\n'); (isEmpty ? empty : full).push(p); } if (!empty.length) { t.file('~/scratch/z.txt', ''); empty.push('~/scratch/z.txt'); } return { empty, full }; },
    prompt: 'Delete every *empty file* under «~/scratch» — in one «find» command.',
    check: (e, x) => x.empty.every((p) => !e.file(p)) && x.full.every((p) => e.file(p)) && e.used('find'),
    hints: ['«-empty» matches empty files and directories; «-type f» keeps it to files; «-delete» deletes what matched.', 'Run it without «-delete» first to see the list.'],
    solution: ['find ~/scratch -type f -empty -delete'],
    why: 'Always run a find without «-delete» first and read the list. Then add «-delete».',
  });
  T({
    id: 'find-exec-chmod', topic: 'find', level: 3, cmds: ['find', 'chmod'], title: 'Make every script executable',
    setup(t) { const sh = []; for (const d of ['', 'deploy/', 'tools/db/', 'ci/']) { const p = `~/scripts/${d}${t.word()}.sh`; t.file(p, '#!/bin/bash\necho hi\n', { mode: 0o644 }); sh.push(p); } t.file('~/scripts/README.md', '# scripts\n', { mode: 0o644 }); return { sh }; },
    prompt: 'Every «.sh» file under «~/scripts» (in any subfolder) should be executable. Fix them all with one command. The README should stay non-executable.',
    check: (e, x) => x.sh.every((p) => (e.mode(p) & 0o100) !== 0) && (e.mode('~/scripts/README.md') & 0o111) === 0,
    hints: ['find can run a command on each match: «-exec CMD {} \\;» (or «{} +» to batch them).', "«find ~/scripts -name '*.sh' -exec chmod +x {} +»"],
    solution: ["find ~/scripts -name '*.sh' -exec chmod +x {} +"],
    why: '«-exec cmd {} \\;» runs once per file; «-exec cmd {} +» passes many files to one command — faster.',
  });
  T({
    id: 'find-user', topic: 'find', level: 2, cmds: ['find'], title: 'Whose files are these?',
    setup(t) { const want = []; for (let i = 0; i < 7; i++) { const owner = t.pick(['bob', 'alice', 'root']); const p = `/srv/shared/${t.word()}-${i}.dat`; t.file(p, 'x\n', { owner, group: owner }); if (owner === 'bob') want.push(p); } if (!want.length) { t.file('/srv/shared/b.dat', 'x\n', { owner: 'bob', group: 'bob' }); want.push('/srv/shared/b.dat'); } return { want }; },
    prompt: 'List every file under «/srv/shared» that belongs to the user «bob».',
    check: (e, x) => e.used('find', (r) => r.args.includes('-user')) && sameSet([...new Set(shownPaths(e))], x.want),
    hints: ['«-user NAME» matches by owner.'],
    solution: ['find /srv/shared -user bob'],
  });
  T({
    id: 'find-count-py', topic: 'find', level: 2, cmds: ['find', 'wc'], title: 'Count the source files',
    setup(t) { let n = 0; for (const d of ['', 'core/', 'core/util/', 'api/', 'tests/']) for (let i = 0; i < t.int(1, 5); i++) { const py = t.chance(0.7); t.file(`/opt/app/src/${d}${t.word()}${i}.${py ? 'py' : 'txt'}`, '#\n'); if (py) n++; } return { n }; },
    prompt: 'How many «.py» files are there under «/opt/app/src», counting all subfolders?',
    check: (e, x) => e.answer(x.n) && e.used('find'),
    hints: ['find lists them, one per line — so count the lines.', "«find /opt/app/src -name '*.py' | wc -l»"],
    solution: ["find /opt/app/src -name '*.py' | wc -l"],
  });
  T({
    id: 'find-iname', topic: 'find', level: 2, cmds: ['find'], title: 'Whatever the case',
    setup(t) { const want = []; for (const n of ['Photo.JPG', 'photo.jpg', 'PHOTO2.Jpg', 'notes.txt', 'img.jpeg']) { const p = `~/camera/${n}`; t.file(p, 'x\n'); if (/\.jpg$/i.test(n)) want.push(t.p(p)); } return { want }; },
    prompt: 'Find every file in «~/camera» ending in «.jpg» — in any mix of upper and lower case.',
    check: (e, x) => e.used('find', (r) => r.args.includes('-iname')) && sameSet([...new Set(shownPaths(e))], x.want),
    hints: ['«-iname» is «-name» that ignores case.'],
    solution: ["find ~/camera -iname '*.jpg'"],
  });
  T({
    id: 'find-locate', topic: 'find', level: 1, cmds: ['locate'], title: 'Find it fast',
    setup(t) { const d = t.pick(['/etc/nginx', '/opt/web/conf', '/usr/local/etc/nginx']); t.file(d + '/nginx.conf', 'worker_processes auto;\n'); return { want: d + '/nginx.conf' }; },
    prompt: 'Where on this system is the file «nginx.conf»? Use the database-backed search to find it instantly.',
    check: (e, x) => e.answer(x.want) && e.used('locate'),
    hints: ['«locate NAME» searches a prebuilt database of file names.'],
    solution: ['locate nginx.conf'],
    why: '«locate» is instant but can be out of date («sudo updatedb» refreshes it). «find» is slower but always current.',
  });
  T({
    id: 'find-which', topic: 'find', level: 1, cmds: ['which'], title: 'Where is that program?',
    setup(t) { const c = t.pick(['tar', 'grep', 'ssh', 'curl', 'awk', 'sed']); return { c }; },
    prompt: (x) => `Which file actually runs when you type «${x.c}»? Print its full path.`,
    check: (e, x) => e.answer('/usr/bin/' + x.c) && e.used(['which', 'type', 'command']),
    hints: ['«which NAME» searches your $PATH.'],
    solution: (x) => [`which ${x.c}`],
  });
  T({
    id: 'find-type', topic: 'find', level: 1, cmds: ['type'], title: 'Builtin or program?',
    setup(t) { return { c: t.pick(['cd', 'echo', 'pwd', 'export', 'alias']) }; },
    prompt: (x) => `Is «${x.c}» a separate program, or built into the shell? Ask the shell.`,
    check: (e, x) => !!e.ran('type', (r) => r.args.includes(x.c)),
    hints: ['«type NAME» says whether a name is an alias, a builtin, a function or a file.'],
    solution: (x) => [`type ${x.c}`],
    why: '«cd» must be a builtin: a separate program couldn\'t change your shell\'s current directory.',
  });
  T({
    id: 'find-whereis', topic: 'find', level: 1, cmds: ['whereis'], title: 'Program and manual',
    prompt: 'Show where both the program and the manual page for «grep» live.',
    check: (e) => !!e.ran('whereis', (r) => r.args.includes('grep')),
    hints: ['«whereis NAME».'],
    solution: ['whereis grep'],
  });
  T({
    id: 'find-hidden-errors', topic: 'find', level: 3, cmds: ['find'], title: 'Find it, quietly',
    setup(t) { const d = t.pick(['/var/lib/misc', '/srv/old', '/opt/legacy/data']); t.file(d + '/flag.txt', 'FOUND\n'); t.dir('/var/private', { mode: 0o700 }); return { want: d + '/flag.txt' }; },
    prompt: 'Somewhere on this machine is a file called «flag.txt». Search the whole filesystem for it — without a screenful of «Permission denied» errors.',
    check: (e, x) => e.answer(x.want) && /2>\s*\/dev\/null/.test(e.line),
    hints: ['Errors go to stream 2. Send them to «/dev/null».', '«find / -name flag.txt 2>/dev/null»'],
    solution: ['find / -name flag.txt 2>/dev/null'],
    why: '«2>/dev/null» throws away errors; «2>&1» merges them into the normal output instead.',
  });

  /* ===================== getting help ===================== */
  T({
    id: 'help-man-sort', topic: 'help', level: 2, cmds: ['man', 'sort'], title: 'Read the manual',
    setup(t) { const nums = Array.from({ length: 9 }, () => t.int(1, 500)); t.file('~/nums.txt', nums.map(String)); return { want: nums.slice().sort((a, b) => a - b).map(String) }; },
    prompt: 'Plain «sort» puts «100» before «20». Use the manual (or «--help») to find the option that sorts by numeric value, then sort «~/nums.txt» numerically.',
    check: (e, x) => { const l = e.shownLines(); return l.length === x.want.length && l.every((v, i) => v === x.want[i]) && (e.used('man') || /--help/.test(e.game.taskRecs.map((r) => r.args.join(' ')).join(' ')) || e.stepEvent('man')); },
    hints: ['«man sort» — then type «/numeric» to search.', '«sort -n ~/nums.txt»'],
    solution: ['man sort', 'sort -n ~/nums.txt'],
    why: '«man CMD», «CMD --help» and «man -k WORD» (or «apropos WORD») are how professionals learn options — nobody remembers them all.',
  });
  T({
    id: 'help-apropos', topic: 'help', level: 2, cmds: ['apropos', 'cmp'], title: 'Find the right tool',
    setup(t) { t.file('~/a.bin', 'HEADER-1234-' + t.word() + '\n'); t.file('~/b.bin', 'HEADER-1234-' + t.word() + 'X\n'); },
    prompt: 'You need a command that compares two files *byte by byte*, but you don\'t know its name. Search the manual descriptions for it, then use it on «~/a.bin» and «~/b.bin».',
    check: (e) => (e.used(['apropos', 'whatis']) || e.used('man', (r) => r.args.includes('-k'))) && !!e.tried('cmp'),
    hints: ['«apropos KEYWORD» (same as «man -k») searches every manual\'s one-line description.', '«apropos compare», then «cmp ~/a.bin ~/b.bin».'],
    solution: ['apropos compare', 'cmp ~/a.bin ~/b.bin'],
  });
  T({
    id: 'help-whatis', topic: 'help', level: 1, cmds: ['whatis'], title: 'One-line answers',
    setup(t) { return { c: t.pick(['tac', 'rev', 'nl', 'paste', 'column', 'tee']) }; },
    prompt: (x) => `What does «${x.c}» do? Get the one-line description from the manual database.`,
    check: (e, x) => !!e.ran('whatis', (r) => r.args.includes(x.c)),
    hints: ['«whatis NAME».'],
    solution: (x) => [`whatis ${x.c}`],
  });
  T({
    id: 'help-dashdash', topic: 'help', level: 1, cmds: [], title: 'Built-in help',
    setup(t) { return { c: t.pick(['cp', 'mv', 'ls', 'rm', 'mkdir']) }; },
    prompt: (x) => `Show the quick built-in help for «${x.c}» (not the full manual).`,
    check: (e, x) => !!e.tried(x.c, (r) => r.args.includes('--help')),
    hints: ['Most GNU commands accept «--help».'],
    solution: (x) => [`${x.c} --help`],
  });
})();
