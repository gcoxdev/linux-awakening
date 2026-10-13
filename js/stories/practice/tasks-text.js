/* Practice Range — tasks: text processing, pipes & redirection. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const P = LA.practice;
  const T = P.task;
  const pack = LA.stories.practice;
  const { sameSet, shownPaths } = P.h;
  const eqLines = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const LOG = '~/logs/app.log';
  const ACCESS = '~/logs/access.log';
  const STAFF = '~/staff.csv';
  const appLog = (t, n) => { const l = pack.gen.appLog(t, n || t.int(60, 120)); t.file(LOG, l.map((x) => x.text)); return l; };
  const accessLog = (t, n) => { const l = pack.gen.access(t, n || t.int(80, 160)); t.file(ACCESS, l.map((x) => x.text)); return l; };
  const staff = (t, n) => { const rows = pack.gen.people(t, n || t.int(12, 20)); t.file(STAFF, ['name,dept,salary,city,age'].concat(rows.map((r) => `${r.name},${r.dept},${r.salary},${r.city},${r.age}`))); return rows; };

  /* ===================== grep ===================== */
  T({
    id: 'grep-basic', topic: 'text', level: 1, cmds: ['grep'], title: 'Show me the errors',
    setup(t) { const l = appLog(t); return { want: l.filter((x) => x.text.includes('ERROR')).map((x) => x.text) }; },
    prompt: 'Show every line of «~/logs/app.log» that contains «ERROR».',
    check: (e, x) => sameSet(e.shownLines(), x.want),
    hints: ['«grep PATTERN FILE».'],
    solution: ['grep ERROR ~/logs/app.log'],
  });
  T({
    id: 'grep-count', topic: 'text', level: 1, cmds: ['grep'], title: 'How many warnings?',
    setup(t) { const l = appLog(t); return { n: l.filter((x) => x.lvl === 'WARN').length }; },
    prompt: 'How many lines in «~/logs/app.log» are warnings («WARN»)? Print the count.',
    check: (e, x) => e.answer(x.n),
    hints: ['«grep -c» counts matching lines instead of printing them.'],
    solution: ['grep -c WARN ~/logs/app.log'],
  });
  T({
    id: 'grep-i', topic: 'text', level: 1, cmds: ['grep'], title: 'Any capitalisation',
    setup(t) { const w = t.word(); const lines = []; let n = 0; for (let i = 0; i < 30; i++) { const hit = t.chance(0.3); const form = t.pick([w, w.toUpperCase(), w[0].toUpperCase() + w.slice(1)]); lines.push(hit ? `the ${form} report, part ${i}` : `nothing to see on line ${i}`); if (hit) n++; } if (!n) { lines.push(`the ${w} report`); } t.file('~/notes.txt', lines); return { w, want: lines.filter((l) => l.toLowerCase().includes(w)) }; },
    prompt: (x) => `Show every line in «~/notes.txt» that mentions «${x.w}» — in any mix of upper and lower case.`,
    check: (e, x) => sameSet(e.shownLines(), x.want),
    hints: ['«grep -i» ignores case.'],
    solution: (x) => [`grep -i ${x.w} ~/notes.txt`],
  });
  T({
    id: 'grep-v', topic: 'text', level: 2, cmds: ['grep'], title: 'Everything but the noise',
    setup(t) { const l = appLog(t, 50); return { want: l.filter((x) => !x.text.includes('DEBUG')).map((x) => x.text) }; },
    prompt: 'Show every line of «~/logs/app.log» *except* the «DEBUG» ones.',
    check: (e, x) => sameSet(e.shownLines(), x.want),
    hints: ['«grep -v» inverts the match.'],
    solution: ['grep -v DEBUG ~/logs/app.log'],
  });
  T({
    id: 'grep-n', topic: 'text', level: 1, cmds: ['grep'], title: 'Which line was it?',
    setup(t) { const w = t.word() + t.int(10, 99); const lines = Array.from({ length: 40 }, () => `${t.word()} ${t.word()} ${t.word()}`); const n = t.int(5, 38); lines[n - 1] = `the password hint is ${w}`; t.file('~/poem.txt', lines); return { w, n }; },
    prompt: (x) => `Which line number of «~/poem.txt» contains «${x.w}»? Show it with its line number.`,
    check: (e, x) => e.shownLines().some((l) => l.startsWith(`${x.n}:`) || l.split(/\s+/)[0] === String(x.n)),
    hints: ['«grep -n» prints line numbers.'],
    solution: (x) => [`grep -n ${x.w} ~/poem.txt`],
  });
  T({
    id: 'grep-rl', topic: 'text', level: 2, cmds: ['grep'], title: 'Files that mention TODO',
    setup(t) { const want = []; for (const f of ['main.py', 'util.py', 'api/routes.py', 'api/models.py', 'tests/test_api.py', 'README.md']) { const hit = t.chance(0.5); const p = '~/src/' + f; t.file(p, `# ${f}\n${hit ? '# TODO: fix this\n' : ''}print("ok")\n`); if (hit) want.push(t.p(p)); } if (!want.length) { t.file('~/src/todo.py', '# TODO: everything\n'); want.push(t.p('~/src/todo.py')); } return { want }; },
    prompt: 'Which files under «~/src» (any subfolder) contain «TODO»? List just the file names, not the matching lines.',
    check: (e, x) => sameSet([...new Set(shownPaths(e))], x.want),
    hints: ['«-r» searches recursively; «-l» lists matching file names only.'],
    solution: ['grep -rl TODO ~/src'],
  });
  T({
    id: 'grep-w', topic: 'text', level: 2, cmds: ['grep'], title: 'The whole word',
    setup(t) { const lines = []; let n = 0; for (let i = 0; i < 30; i++) { const k = t.pick(['cat', 'catalog', 'concatenate', 'the cat sat', 'cat food', 'scatter']); lines.push(`${i}: ${k}`); if (/\bcat\b/.test(k)) n++; } t.file('~/words.txt', lines); return { n }; },
    prompt: 'How many lines of «~/words.txt» contain the word «cat» as a *whole word* — not «catalog» or «scatter»?',
    check: (e, x) => e.answer(x.n),
    hints: ['«grep -w» matches whole words only; combine it with «-c».'],
    solution: ['grep -cw cat ~/words.txt'],
  });
  T({
    id: 'grep-E', topic: 'text', level: 2, cmds: ['grep'], title: 'This or that',
    setup(t) { const l = appLog(t); return { want: l.filter((x) => x.lvl === 'ERROR' || x.lvl === 'WARN').map((x) => x.text) }; },
    prompt: 'Show every line of «~/logs/app.log» that contains either «ERROR» or «WARN», in one grep.',
    check: (e, x) => sameSet(e.shownLines(), x.want) && e.used('grep'),
    hints: ['Extended regular expressions: «grep -E» lets «|» mean "or". Quote the pattern.', "«grep -E 'ERROR|WARN' ~/logs/app.log»"],
    solution: ["grep -E 'ERROR|WARN' ~/logs/app.log"],
    why: 'Without -E, write it as «grep -e ERROR -e WARN» or «grep \'ERROR\\|WARN\'».',
  });
  T({
    id: 'grep-context', topic: 'text', level: 3, cmds: ['grep'], title: 'What happened just before?',
    setup(t) { const l = appLog(t, 50); const i = t.int(10, 40); l[i].text = l[i].text.replace(/\] .*/, '] kernel: PANIC — out of memory'); t.file(LOG, l.map((x) => x.text)); return { want: l.slice(i - 2, i + 1).map((x) => x.text) }; },
    prompt: 'Find the line containing «PANIC» in «~/logs/app.log», and show it together with the 2 lines just before it.',
    check: (e, x) => eqLines(e.shownLines(), x.want),
    hints: ['«grep -B N» shows N lines Before each match («-A» after, «-C» both).'],
    solution: ['grep -B 2 PANIC ~/logs/app.log'],
  });

  /* ===================== sort, uniq, cut, tr, … ===================== */
  T({
    id: 'sort-n-r', topic: 'text', level: 1, cmds: ['sort'], title: 'High scores',
    setup(t) { const rows = Array.from({ length: 10 }, () => `${t.int(1, 999)} ${t.name()}`); t.file('~/scores.txt', rows); return { want: rows.slice().sort((a, b) => parseInt(b, 10) - parseInt(a, 10)) }; },
    prompt: 'Show «~/scores.txt» sorted by score, highest first. (Each line is «SCORE NAME».)',
    check: (e, x) => { const l = e.shownLines(); return l.length === x.want.length && l.every((v, i) => parseInt(v, 10) === parseInt(x.want[i], 10)); },
    hints: ['«-n» sorts numerically, «-r» reverses.'],
    solution: ['sort -nr ~/scores.txt'],
  });
  T({
    id: 'sort-k', topic: 'text', level: 2, cmds: ['sort'], title: 'Sort by a column',
    setup(t) { const rows = staff(t); return { want: rows.slice().sort((a, b) => a.salary - b.salary).map((r) => r.name) }; },
    prompt: 'Show the people in «~/staff.csv» sorted by salary (the 3rd comma-separated field), lowest first. Leave the header out, or let it float to the top — either is fine.',
    check: (e, x) => { const names = e.shownLines().map((l) => l.split(',')[0]).filter((n) => n !== 'name'); return names.length === x.want.length && names.every((n, i) => n === x.want[i]); },
    hints: ['«-t,» sets the separator, «-k3» sorts on field 3, «-n» numerically.', "«tail -n +2 ~/staff.csv | sort -t, -k3 -n»"],
    solution: ['tail -n +2 ~/staff.csv | sort -t, -k3 -n'],
    why: '«tail -n +2» prints from line 2 onward — a neat way to drop a header.',
  });
  T({
    id: 'uniq-count-ips', topic: 'text', level: 2, cmds: ['sort', 'uniq', 'cut', 'awk'], title: 'How many visitors?',
    setup(t) { const l = accessLog(t); return { n: new Set(l.map((x) => x.ip)).size }; },
    prompt: 'How many *different* IP addresses appear in «~/logs/access.log»? (The IP is the first field of each line.)',
    check: (e, x) => e.answer(x.n),
    hints: ['Pull out the first field («cut -d\' \' -f1» or «awk \'{print $1}\'»), get the unique values, count them.', "«cut -d' ' -f1 ~/logs/access.log | sort -u | wc -l»"],
    solution: ["cut -d' ' -f1 ~/logs/access.log | sort -u | wc -l"],
  });
  T({
    id: 'uniq-top-ip', topic: 'text', level: 3, cmds: ['sort', 'uniq', 'head'], title: 'Who\'s hammering the server?',
    setup(t) { const l = accessLog(t, 150); const c = {}; for (const x of l) c[x.ip] = (c[x.ip] || 0) + 1; const top = Object.entries(c).sort((a, b) => b[1] - a[1]); if (top[1] && top[0][1] === top[1][1]) { l.push(...Array.from({ length: 3 }, () => ({ text: l.find((y) => y.ip === top[0][0]).text }))); t.file(ACCESS, l.map((x) => x.text)); } return { ip: top[0][0] }; },
    prompt: 'Which IP address made the most requests in «~/logs/access.log»? Show it with its count, at the top of your output.',
    check: (e, x) => { const l = e.shownLines(); return l.length > 0 && l.length <= 5 && l[0].split(/\s+/).includes(x.ip); },
    hints: ['The classic pipeline: extract → sort → uniq -c → sort -rn → head.', "«cut -d' ' -f1 ~/logs/access.log | sort | uniq -c | sort -rn | head -n 3»"],
    solution: ["cut -d' ' -f1 ~/logs/access.log | sort | uniq -c | sort -rn | head -n 3"],
    why: '«sort | uniq -c | sort -rn | head» answers "what\'s most common?" for anything: IPs, URLs, error messages, words.',
  });
  T({
    id: 'uniq-d', topic: 'text', level: 2, cmds: ['sort', 'uniq'], title: 'Duplicates',
    setup(t) { const names = t.pickN(['ada', 'alan', 'grace', 'linus', 'ken', 'hedy', 'tim', 'radia', 'john', 'barbara'], 8); const dups = names.slice(0, t.int(2, 3)); t.file('~/signups.txt', t.shuffle(names.concat(dups))); return { want: dups }; },
    prompt: 'Some people signed up twice. List only the names that appear more than once in «~/signups.txt».',
    check: (e, x) => sameSet(e.shownLines(), x.want),
    hints: ['«uniq -d» prints only duplicated lines — but uniq needs sorted input.'],
    solution: ['sort ~/signups.txt | uniq -d'],
  });
  T({
    id: 'cut-passwd', topic: 'text', level: 1, cmds: ['cut'], title: 'Just the usernames',
    prompt: 'Print only the usernames from «/etc/passwd» — the first field of each line (fields are separated by «:»).',
    check: (e) => { const want = e.fs.contentOf(e.fs.get('/etc/passwd')).split('\n').filter(Boolean).map((l) => l.split(':')[0]); return sameSet(e.shownLines(), want); },
    hints: ['«cut -d: -f1».'],
    solution: ['cut -d: -f1 /etc/passwd'],
  });
  T({
    id: 'cut-chars', topic: 'text', level: 2, cmds: ['cut'], title: 'Country codes',
    setup(t) { const rows = Array.from({ length: 10 }, () => `${t.pick(['GBR', 'NOR', 'KEN', 'PER', 'JPN', 'EST'])}-${t.int(10000, 99999)}`); t.file('~/codes.txt', rows); return { want: rows.map((r) => r.slice(0, 3)) }; },
    prompt: 'Each line of «~/codes.txt» starts with a 3-letter country code. Print just those first 3 characters of every line.',
    check: (e, x) => eqLines(e.shownLines(), x.want),
    hints: ['«cut -c1-3» cuts by character position.'],
    solution: ['cut -c1-3 ~/codes.txt'],
  });
  T({
    id: 'tr-lower', topic: 'text', level: 1, cmds: ['tr'], title: 'Stop shouting',
    setup(t) { const lines = Array.from({ length: 5 }, () => `${t.word()} ${t.word()} ${t.word()}!`.toUpperCase()); t.file('~/shout.txt', lines); return { want: lines.map((l) => l.toLowerCase()).join('\n') + '\n' }; },
    prompt: 'Convert «~/shout.txt» to lowercase and save the result as «~/quiet.txt».',
    check: (e, x) => e.text('~/quiet.txt') === x.want,
    hints: ["«tr 'A-Z' 'a-z'» translates characters; it only reads standard input, so feed it the file with «<»."],
    solution: ["tr 'A-Z' 'a-z' < ~/shout.txt > ~/quiet.txt"],
  });
  T({
    id: 'tr-delete', topic: 'text', level: 2, cmds: ['tr'], title: 'Strip the digits',
    setup(t) { const lines = Array.from({ length: 5 }, () => `${t.word()}${t.int(1, 99)} ${t.int(100, 999)}${t.word()}`); t.file('~/messy.txt', lines); return { want: lines.map((l) => l.replace(/[0-9]/g, '')).join('\n') + '\n' }; },
    prompt: 'Remove every digit from «~/messy.txt» and save the result as «~/clean.txt».',
    check: (e, x) => e.text('~/clean.txt') === x.want,
    hints: ["«tr -d '0-9'» deletes characters."],
    solution: ["tr -d '0-9' < ~/messy.txt > ~/clean.txt"],
  });
  T({
    id: 'tr-squeeze', topic: 'text', level: 2, cmds: ['tr'], title: 'Too many spaces',
    setup(t) { const lines = Array.from({ length: 5 }, () => [t.word(), t.word(), t.word()].join(' '.repeat(t.int(2, 6)))); t.file('~/spaced.txt', lines); return { want: lines.map((l) => l.replace(/ +/g, ' ')) }; },
    prompt: 'Print «~/spaced.txt» with every run of several spaces squeezed down to a single space.',
    check: (e, x) => eqLines(e.shownLines(), x.want),
    hints: ["«tr -s ' '» squeezes repeats."],
    solution: ["tr -s ' ' < ~/spaced.txt"],
  });
  T({
    id: 'sed-replace', topic: 'text', level: 2, cmds: ['sed'], title: 'Upgrade the links',
    setup(t) { const lines = Array.from({ length: 6 }, () => `link=http://${t.word()}.example.com/${t.word()} mirror=http://${t.word()}.example.org`); t.file('~/site.conf', lines); return { want: lines.map((l) => l.replace(/http:\/\//g, 'https://')).join('\n') + '\n' }; },
    prompt: 'In «~/site.conf», change every «http://» to «https://» — all of them, even when there are two on a line — editing the file in place.',
    check: (e, x) => e.text('~/site.conf') === x.want,
    nudge: (e) => (/http:\/\//.test(e.text('~/site.conf') || '') && /https:\/\//.test(e.text('~/site.conf') || '') ? 'Some lines still have «http://». Without «g», «s///» only changes the first match on each line.' : null),
    hints: ['«sed -i \'s/OLD/NEW/g\' FILE» — «g» means every match on the line. Use «|» as the delimiter so you don\'t have to escape the slashes.', "«sed -i 's|http://|https://|g' ~/site.conf»"],
    solution: ["sed -i 's|http://|https://|g' ~/site.conf"],
  });
  T({
    id: 'sed-range', topic: 'text', level: 2, cmds: ['sed'], title: 'A range of lines',
    setup(t) { const lines = Array.from({ length: 40 }, (_, i) => `line ${i + 1}: ${t.word()}`); const a = t.int(3, 20), b = a + t.int(2, 6); t.file('~/book.txt', lines); return { a, b, want: lines.slice(a - 1, b) }; },
    prompt: (x) => `Print only lines ${x.a} to ${x.b} of «~/book.txt».`,
    check: (e, x) => eqLines(e.shownLines(), x.want),
    hints: [(x) => `«sed -n '${x.a},${x.b}p' FILE» — «-n» turns off normal printing, «p» prints the range.`],
    solution: (x) => [`sed -n '${x.a},${x.b}p' ~/book.txt`],
  });
  T({
    id: 'sed-delete', topic: 'text', level: 2, cmds: ['sed'], title: 'Strip the comments',
    setup(t) { const lines = []; for (let i = 0; i < 12; i++) lines.push(t.chance(0.4) ? `# ${t.word()} ${t.word()}` : `${t.word()}=${t.int(1, 99)}`); /* always something to delete, and something to keep */ lines[t.int(0, 3)] = `# ${t.word()} settings`; lines[t.int(6, 11)] = `# ${t.word()} ${t.word()}`; lines[4] = `${t.word()}=${t.int(1, 99)}`; t.file('~/config.ini', lines); return { want: lines.filter((l) => !l.startsWith('#')).join('\n') + '\n' }; },
    prompt: 'Delete every comment line (lines starting with «#») from «~/config.ini», editing it in place.',
    check: (e, x) => e.text('~/config.ini') === x.want,
    hints: ["«sed -i '/^#/d' FILE» — «/regex/d» deletes matching lines; «^» anchors to the start."],
    solution: ["sed -i '/^#/d' ~/config.ini"],
    why: '«grep -v \'^#\' file > new» does it too, but needs a temporary file — never redirect a file into itself.',
  });
  T({
    id: 'awk-cols', topic: 'text', level: 1, cmds: ['awk'], title: 'Columns two and four',
    setup(t) { const rows = Array.from({ length: 8 }, () => [t.int(1, 99), t.word(), t.pick(['ok', 'fail']), t.int(100, 999)]); t.file('~/data.txt', rows.map((r) => r.join(' '))); return { want: rows.map((r) => `${r[1]} ${r[3]}`) }; },
    prompt: 'Print the 2nd and 4th columns of «~/data.txt» (columns are separated by spaces).',
    check: (e, x) => eqLines(e.shownLines().map((l) => l.replace(/\s+/g, ' ')), x.want),
    hints: ["«awk '{print $2, $4}' FILE»."],
    solution: ["awk '{print $2, $4}' ~/data.txt"],
  });
  T({
    id: 'awk-sum', topic: 'text', level: 3, cmds: ['awk'], title: 'Bytes served',
    setup(t) { const l = accessLog(t); return { n: l.reduce((a, x) => a + x.bytes, 0) }; },
    prompt: 'What is the total of the bytes-sent column (the 10th field) in «~/logs/access.log»?',
    check: (e, x) => e.answer(x.n),
    hints: ["awk can add up a column: «awk '{sum += $10} END {print sum}' FILE»"],
    solution: ["awk '{sum += $10} END {print sum}' ~/logs/access.log"],
    why: 'For big totals awk may print 1.2e+06; «END {printf \"%d\\n\", sum}» forces a whole number.',
  });
  T({
    id: 'awk-filter', topic: 'text', level: 2, cmds: ['awk'], title: 'High earners',
    setup(t) { const rows = staff(t); const limit = t.pick([80000, 90000, 100000]); let want = rows.filter((r) => r.salary > limit).map((r) => r.name); if (!want.length) { rows[0].salary = limit + 5000; t.file(STAFF, ['name,dept,salary,city,age'].concat(rows.map((r) => `${r.name},${r.dept},${r.salary},${r.city},${r.age}`))); want = [rows[0].name]; } return { limit, want }; },
    prompt: (x) => `Print the names of everyone in «~/staff.csv» whose salary (field 3) is more than ${x.limit}.`,
    check: (e, x) => sameSet(e.shownLines(), x.want),
    hints: ['«-F,» makes awk split on commas; «$3 > N» is a condition, «{print $1}» the action.', 'Careful with the header line: awk compares the word «salary» with a number as *text*, and it wins. Skip line 1 with «NR > 1».', (x) => `«awk -F, 'NR > 1 && $3 > ${x.limit} {print $1}' ~/staff.csv»`],
    solution: (x) => [`awk -F, 'NR > 1 && $3 > ${x.limit} {print $1}' ~/staff.csv`],
  });
  T({
    id: 'awk-dept-count', topic: 'text', level: 3, cmds: ['awk', 'cut', 'sort', 'uniq'], title: 'Headcount per department',
    setup(t) { const rows = staff(t, 18); const c = {}; for (const r of rows) c[r.dept] = (c[r.dept] || 0) + 1; return { c }; },
    prompt: 'How many people work in each department in «~/staff.csv»? Show each department with its count.',
    check: (e, x) => Object.entries(x.c).every(([d, n]) => e.shownLines().some((l) => l.split(/[\s,:]+/).includes(d) && l.split(/[\s,:]+/).includes(String(n)))),
    hints: ['Field 2 is the department. Drop the header, cut out field 2, then sort | uniq -c.', "«tail -n +2 ~/staff.csv | cut -d, -f2 | sort | uniq -c»"],
    solution: ['tail -n +2 ~/staff.csv | cut -d, -f2 | sort | uniq -c'],
    why: "In awk: «awk -F, 'NR>1 {c[$2]++} END {for (d in c) print d, c[d]}' staff.csv» — an associative array.",
  });
  T({
    id: 'diff-u', topic: 'text', level: 2, cmds: ['diff'], title: 'What changed?',
    setup(t) { const a = Array.from({ length: 8 }, () => `${t.word()}=${t.int(1, 99)}`); const b = a.slice(); const i = t.int(1, 6); b[i] = `${b[i].split('=')[0]}=${t.int(100, 999)}`; t.file('~/v1.conf', a); t.file('~/v2.conf', b); return { line: b[i] }; },
    prompt: 'Compare «~/v1.conf» with «~/v2.conf» and show what changed, in the unified format code reviews use.',
    check: (e, x) => !!e.tried('diff', (r) => e.has(r, 'u')) && e.out().includes('+' + x.line),
    hints: ['«diff -u OLD NEW» — lines starting «-» were removed, «+» were added.'],
    solution: ['diff -u ~/v1.conf ~/v2.conf'],
  });
  T({
    id: 'paste-join', topic: 'text', level: 2, cmds: ['paste'], title: 'Side by side',
    setup(t) { const names = t.pickN(['ada', 'alan', 'grace', 'linus', 'ken', 'hedy'], 5); const phones = names.map(() => `555-${t.int(1000, 9999)}`); t.file('~/names.txt', names); t.file('~/phones.txt', phones); return { want: names.map((n, i) => `${n},${phones[i]}`) }; },
    prompt: 'Join «~/names.txt» and «~/phones.txt» line by line into «name,phone» pairs, and save them as «~/contacts.csv».',
    check: (e, x) => (e.text('~/contacts.csv') || '') === x.want.join('\n') + '\n',
    hints: ['«paste» glues files side by side; «-d,» uses a comma instead of a tab.'],
    solution: ['paste -d, ~/names.txt ~/phones.txt > ~/contacts.csv'],
  });
  T({
    id: 'column-t', topic: 'text', level: 1, cmds: ['column'], title: 'A readable table',
    setup(t) { staff(t, 8); },
    prompt: 'Show «~/staff.csv» as a neatly aligned table.',
    check: (e) => !!e.ran('column', (r) => e.has(r, 't')),
    hints: ['«column -t -s,» lines up comma-separated columns.'],
    solution: ['column -t -s, ~/staff.csv'],
  });
  T({
    id: 'tac-rev', topic: 'text', level: 1, cmds: ['tac'], title: 'Newest first',
    setup(t) { const l = appLog(t, 20).map((x) => x.text); return { want: l.slice().reverse() }; },
    prompt: 'Print «~/logs/app.log» upside down — last line first.',
    check: (e, x) => eqLines(e.shownLines(), x.want),
    hints: ['«tac» is «cat» backwards.'],
    solution: ['tac ~/logs/app.log'],
  });
  T({
    id: 'rev-lines', topic: 'text', level: 1, cmds: ['rev'], title: 'Mirror writing',
    setup(t) { const lines = Array.from({ length: 3 }, () => `${t.word()} ${t.word()}`); t.file('~/mirror.txt', lines.map((l) => [...l].reverse().join(''))); return { want: lines }; },
    prompt: '«~/mirror.txt» was written backwards. Print it the right way round.',
    check: (e, x) => eqLines(e.shownLines(), x.want),
    hints: ['«rev» reverses each line.'],
    solution: ['rev ~/mirror.txt'],
  });
  T({
    id: 'nl-number', topic: 'text', level: 1, cmds: ['nl'], title: 'Number the lines',
    setup(t) { t.file('~/steps.txt', ['open the valve', '', 'wait ten seconds', 'close the valve', '', 'write it down']); },
    prompt: 'Print «~/steps.txt» with each non-empty line numbered (empty lines unnumbered).',
    check: (e) => !!e.ran('nl'),
    hints: ['«nl» numbers non-empty lines by default.'],
    solution: ['nl ~/steps.txt'],
  });
  T({
    id: 'head-c-bytes', topic: 'text', level: 2, cmds: ['head'], title: 'The first bytes',
    setup(t) { const s = Array.from({ length: 10 }, () => t.word()).join(''); t.file('~/blob.txt', s + '\n'); const n = t.int(5, 12); return { n, want: s.slice(0, n) }; },
    prompt: (x) => `Print just the first ${x.n} characters (bytes) of «~/blob.txt».`,
    check: (e, x) => e.out().startsWith(x.want) && e.out().replace(/\n$/, '').length === x.n,
    hints: ['«head -c N».'],
    solution: (x) => [`head -c ${x.n} ~/blob.txt`],
  });

  /* ===================== pipes & redirection ===================== */
  T({
    id: 'pipe-count', topic: 'pipes', level: 1, cmds: ['grep', 'wc'], title: 'Count through a pipe',
    setup(t) { const l = appLog(t); const svc = t.pick(['auth', 'api', 'billing', 'search']); return { svc, n: l.filter((x) => x.lvl === 'ERROR' && x.svc === svc).length }; },
    prompt: (x) => `How many ERROR lines in «~/logs/app.log» come from the «${x.svc}» service? (Lines look like «... [ERROR] ${x.svc}: ...».)`,
    check: (e, x) => e.answer(x.n) && e.pipe,
    hints: ['Filter twice with a pipe: once for ERROR, once for the service name, then count.', (x) => `«grep ERROR ~/logs/app.log | grep '${x.svc}:' | wc -l»`],
    solution: (x) => [`grep ERROR ~/logs/app.log | grep '${x.svc}:' | wc -l`],
  });
  T({
    id: 'redir-save', topic: 'pipes', level: 1, cmds: ['ls'], title: 'Save the listing',
    prompt: 'Save a listing of the files in «/etc» into «~/etc-list.txt» (rather than printing it).',
    check: (e) => { const t = e.text('~/etc-list.txt') || ''; return /passwd/.test(t) && /hosts/.test(t); },
    hints: ['«>» sends a command\'s output into a file.'],
    solution: ['ls /etc > ~/etc-list.txt'],
  });
  T({
    id: 'redir-both', topic: 'pipes', level: 2, cmds: ['bash'], title: 'Capture everything',
    setup(t) { const ok = `step ${t.int(1, 9)} done`, bad = `warning: ${t.word()} missing`; t.file('~/build.sh', `#!/bin/bash\necho "${ok}"\necho "${bad}" >&2\necho "build finished"\n`, { mode: 0o755 }); return { ok, bad }; },
    prompt: 'Run «~/build.sh» and save *both* its normal output and its error messages into «~/build.log».',
    check: (e, x) => { const t = e.text('~/build.log') || ''; return t.includes(x.ok) && t.includes(x.bad); },
    nudge: (e, x) => { const t = e.text('~/build.log') || ''; return t.includes(x.ok) && !t.includes(x.bad) ? 'The errors went to the screen, not the file: «>» only redirects stream 1. Add «2>&1» after it.' : null; },
    hints: ['«>» redirects stdout only; «2>&1» sends stderr to the same place.', '«~/build.sh > ~/build.log 2>&1» (or «&> ~/build.log»)'],
    solution: ['~/build.sh > ~/build.log 2>&1'],
    why: 'Order matters: «> file 2>&1» works; «2>&1 > file» sends errors to the screen.',
  });
  T({
    id: 'tee-both', topic: 'pipes', level: 2, cmds: ['tee', 'sort'], title: 'See it and save it',
    setup(t) { const names = t.pickN(['delta', 'alpha', 'charlie', 'bravo', 'echo', 'foxtrot'], 5); t.file('~/unsorted.txt', names); return { want: names.slice().sort().join('\n') + '\n' }; },
    prompt: 'Sort «~/unsorted.txt», showing the result on screen *and* saving it to «~/sorted.txt» in the same command.',
    check: (e, x) => e.text('~/sorted.txt') === x.want && e.used('tee'),
    hints: ['«tee FILE» copies its input to a file and passes it on.'],
    solution: ['sort ~/unsorted.txt | tee ~/sorted.txt'],
  });
  T({
    id: 'xargs-rm', topic: 'pipes', level: 2, cmds: ['xargs', 'rm'], title: 'Delete from a list',
    setup(t) { const del = Array.from({ length: t.int(3, 5) }, (_, i) => `~/tmp/old${i}.dat`); const keep = ['~/tmp/keep.dat']; for (const f of del.concat(keep)) t.file(f, 'x\n'); t.file('~/to-delete.txt', del.map((f) => t.p(f))); return { del, keep }; },
    prompt: '«~/to-delete.txt» lists files, one per line. Delete exactly those files.',
    check: (e, x) => x.del.every((f) => !e.file(f)) && x.keep.every((f) => e.file(f)),
    hints: ['«xargs» turns lines of input into arguments for a command.', '«xargs rm < ~/to-delete.txt» or «cat ~/to-delete.txt | xargs rm»'],
    solution: ['cat ~/to-delete.txt | xargs rm'],
  });
  T({
    id: 'xargs-wc', topic: 'pipes', level: 3, cmds: ['find', 'xargs', 'wc'], title: 'Lines in every document',
    setup(t) { let total = 0; for (const d of ['', 'a/', 'b/c/']) for (let i = 0; i < 2; i++) { const n = t.int(3, 30); total += n; t.file(`~/docs/${d}doc${i}.txt`, Array.from({ length: n }, () => t.word())); } t.file('~/docs/skip.md', 'x\n'); return { total }; },
    prompt: 'What is the total number of lines across every «.txt» file under «~/docs» (any depth)? Use find to get the files and hand them to wc.',
    check: (e, x) => e.answer(x.total) && e.used('wc'),
    hints: ["«find ~/docs -name '*.txt' | xargs wc -l» — the last line is the total."],
    solution: ["find ~/docs -name '*.txt' | xargs wc -l"],
    why: 'For names with spaces: «find ... -print0 | xargs -0 wc -l».',
  });
  T({
    id: 'subst-date-dir', topic: 'pipes', level: 2, cmds: ['mkdir', 'date'], title: 'A folder named for today',
    prompt: 'Create a directory inside «~/backups» named after today\'s date in YYYY-MM-DD form — without typing the date yourself.',
    check: (e) => { const n = e.file('~/backups/' + LA.util.strftime('%F', new Date(LA.now()))); return !!n && n.type === 'dir' && e.used('date'); },
    hints: ['«$(command)» puts a command\'s output into your line.', '«mkdir -p ~/backups/$(date +%F)»'],
    solution: ['mkdir -p ~/backups/$(date +%F)'],
  });
  T({
    id: 'stdin-wc', topic: 'pipes', level: 1, cmds: ['wc'], title: 'Just the number',
    setup(t) { const n = t.int(20, 90); t.file('~/list.txt', Array.from({ length: n }, () => t.word())); return { n }; },
    prompt: 'Print the number of lines in «~/list.txt» — just the number, without the file name after it.',
    check: (e, x) => e.answer(x.n, { exact: true }),
    hints: ['When wc reads standard input it has no file name to print.', '«wc -l < ~/list.txt»'],
    solution: ['wc -l < ~/list.txt'],
  });
  T({
    id: 'heredoc', topic: 'pipes', level: 2, cmds: ['cat'], title: 'A file from a heredoc',
    setup(t) { return { lines: [`Welcome to ${t.word()}!`, `Maintenance: ${t.pick(['Sunday', 'Monday', 'Friday'])} 02:00`, 'Questions: ops@lab'] }; },
    prompt: (x) => `Create «~/motd.txt» containing exactly these three lines, using a heredoc («cat > file << EOF»):\n«${x.lines[0]}»\n«${x.lines[1]}»\n«${x.lines[2]}»`,
    check: (e, x) => e.text('~/motd.txt') === x.lines.join('\n') + '\n' && e.typed(/<<-?\s*['"]?\w+/),
    nudge: (e, x) => (e.text('~/motd.txt') === x.lines.join('\n') + '\n' && !e.typed(/<<-?\s*['"]?\w+/) ? 'Right contents — now do it with a heredoc, as the task asks: «cat > ~/motd.txt << EOF», the lines, then «EOF».' : null),
    hints: ['Type «cat > ~/motd.txt << EOF», press Enter, type the lines, and finish with a line that just says «EOF».'],
    solution: (x) => [`cat > ~/motd.txt << 'EOF'\n${x.lines.join('\n')}\nEOF`],
  });
  T({
    id: 'and-chain', topic: 'pipes', level: 1, cmds: ['mkdir', 'cd'], title: 'Only if it worked',
    setup(t) { return { d: t.word() + '-' + t.int(1, 99) }; },
    prompt: (x) => `In one line: create «~/${x.d}» and, *only if that worked*, change into it.`,
    check: (e, x) => e.cwd === e.p('~/' + x.d) && /&&/.test(e.line),
    hints: ['«&&» runs the second command only if the first succeeded.'],
    solution: (x) => [`mkdir ~/${x.d} && cd ~/${x.d}`],
    why: '«||» runs the second only if the first *failed*; «;» runs it regardless.',
  });
  T({
    id: 'pipe-top-ext', topic: 'pipes', level: 4, cmds: ['find', 'sed', 'sort', 'uniq', 'head'], title: 'Boss: what\'s filling the media folder?',
    setup(t) { const exts = ['jpg', 'png', 'mp4', 'mp3', 'pdf', 'txt']; const c = {}; for (let i = 0; i < 40; i++) { const x = t.pick(exts.concat(['jpg', 'jpg', 'mp4'])); c[x] = (c[x] || 0) + 1; t.file(`~/media/${t.pick(['a', 'b', 'c/d'])}/f${i}.${x}`, 'x\n'); } const top = Object.entries(c).sort((a, b) => b[1] - a[1]); if (top[1] && top[0][1] === top[1][1]) { t.file('~/media/extra.' + top[0][0], 'x\n'); top[0][1]++; } return { ext: top[0][0], n: top[0][1] }; },
    prompt: 'Which file extension is most common under «~/media» (all subfolders)? Show the extensions with their counts, most common first.',
    check: (e, x) => { const l = e.shownLines(); return l.length > 0 && l[0].split(/\s+/).includes(String(x.n)) && l[0].includes(x.ext); },
    hints: ['List the files, keep only what follows the last dot, then count.', "«find ~/media -type f | sed 's/.*\\.//' | sort | uniq -c | sort -rn»"],
    solution: ["find ~/media -type f | sed 's/.*\\.//' | sort | uniq -c | sort -rn"],
  });
  T({
    id: 'boss-errors-report', topic: 'pipes', level: 4, cmds: ['grep', 'awk', 'sort', 'uniq'], title: 'Boss: an error report',
    setup(t) { const l = appLog(t, 150); const c = {}; for (const x of l) if (x.lvl === 'ERROR') c[x.svc] = (c[x.svc] || 0) + 1; return { c }; },
    prompt: 'Write «~/errors.txt»: one line per service with its number of ERROR lines in «~/logs/app.log», most errors first. (The service name is the word before the colon.)',
    check: (e, x) => { const lines = (e.text('~/errors.txt') || '').split('\n').filter(Boolean); if (lines.length !== Object.keys(x.c).length) return false; const nums = lines.map((l) => parseInt(l.trim(), 10) || parseInt(l.trim().split(/\s+/).pop(), 10)); return Object.entries(x.c).every(([s, n]) => lines.some((l) => l.includes(s) && l.split(/[\s:]+/).includes(String(n)))) && nums.every((v, i) => i === 0 || v <= nums[i - 1]); },
    hints: ['Grep the errors, pull out the service name (awk field 4, minus the colon), count, sort.', "«grep ERROR ~/logs/app.log | awk '{print $4}' | tr -d : | sort | uniq -c | sort -rn > ~/errors.txt»"],
    solution: ["grep ERROR ~/logs/app.log | awk '{print $4}' | tr -d : | sort | uniq -c | sort -rn > ~/errors.txt"],
  });
})();
