/* Practice Range — tasks: the awkward cases. Odd file names, hidden files, broken links, keeping what must be
   kept, separating streams, failing scripts, effective permissions, picking the right process, and restoring
   from a backup. Each checks the result you were asked for, and the obvious-but-wrong route doesn't pass. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const P = LA.practice;
  const T = P.task;
  const VFS = LA.VFS;
  const { snap, hasTree, sameSet, shownPaths } = P.h;
  const DAY = 86400000;

  /* ===================== files ===================== */
  T({
    id: 'files-dash', topic: 'files', level: 2, cmds: ['mv'], title: 'A name that looks like an option',
    setup(t) { const body = `draft ${t.word()} ${t.int(1, 99)}\n`; t.file('~/inbox/-draft.txt', body); return { body }; },
    prompt: 'Someone saved a file called «-draft.txt» in «~/inbox». Rename it to «draft.txt» (same folder, same contents).',
    check: (e, x) => e.text('~/inbox/draft.txt') === x.body && !e.file('~/inbox/-draft.txt'),
    nudge: (e) => (e.tried('mv', (r) => /invalid option|unrecognized option/.test(r.out) || r.status !== 0) ? 'mv read «-draft.txt» as options. Tell it where the options end, or make the name not start with «-».' : null),
    hints: ['Anything starting with «-» looks like an option to a command.', '«--» means "no more options after this"; a path like «./-draft.txt» also works.', '«cd ~/inbox && mv -- -draft.txt draft.txt»'],
    solution: ['cd ~/inbox', 'mv -- -draft.txt draft.txt'],
    why: '«--» works with almost every command: «rm -- -f», «grep -- -v file». Scripts use it whenever a name could start with a dash.',
  });
  T({
    id: 'files-dotfiles', topic: 'files', level: 2, cmds: ['cp'], title: 'Hidden files too',
    setup(t) { for (const f of ['app.py', 'README.md', '.env', '.gitignore', 'conf/.secrets']) t.file('~/proj/' + f, `${f} ${t.word()}\n`); t.dir('~/proj-copy'); return { files: snap(t, '~/proj') }; },
    prompt: 'Copy *everything* in «~/proj» — hidden files and subfolders included — into the existing empty folder «~/proj-copy».',
    check: (e, x) => hasTree(e, '~/proj-copy', x.files) && hasTree(e, '~/proj', x.files),
    feedback: (e, x) => { const miss = Object.keys(x.files).filter((f) => e.text('~/proj-copy/' + f) !== x.files[f]); return miss.length ? `Missing from the copy: ${miss.join(', ')}. («*» doesn't match names starting with a dot.)` : null; },
    hints: ['The glob «*» skips hidden files.', 'Copy the folder\'s contents rather than its visible names: «SOURCE/.» means "everything in SOURCE".', '«cp -a ~/proj/. ~/proj-copy/»'],
    solution: ['cp -a ~/proj/. ~/proj-copy/'],
    why: '«ls -A» shows hidden files; «cp -a dir/. dest/» copies all of them, with permissions and timestamps.',
  });
  T({
    id: 'files-broken-link', topic: 'files', level: 3, cmds: ['ln', 'readlink'], title: 'Mend a broken link',
    setup(t) { const body = `listen: ${t.int(1000, 9999)}\n`; t.file('~/settings/app.yml', body); t.dir('~/app'); t.fs.link(t.p('~/app/config.yml'), '../conf/app.yml'); return { body }; },
    prompt: '«~/app/config.yml» is a symbolic link that points nowhere any more. The real file is now «~/settings/app.yml». Make the link work again.',
    check: (e, x) => { const n = e.file('~/app/config.yml'); return !!n && n.type === 'link' && e.text('~/app/config.yml') === x.body; },
    nudge: (e) => { const n = e.file('~/app/config.yml'); return n && n.type === 'file' ? 'That\'s a copy, not a link — when the settings change, the copy won\'t. Make it a symbolic link.' : null; },
    hints: ['«ls -l» shows where a link points; a broken one points at a path that doesn\'t exist.', 'A relative target is resolved from the link\'s own folder, not from where you are.', '«ln -sfn ../settings/app.yml ~/app/config.yml» — «-f» replaces the old link.'],
    solution: ['ln -sfn ../settings/app.yml ~/app/config.yml', 'cat ~/app/config.yml'],
  });
  T({
    id: 'files-safe-rm', topic: 'files', level: 2, cmds: ['rm', 'ls'], title: 'Delete exactly these',
    setup(t) {
      const tmp = t.pickN(['session', 'upload', 'render', 'cache', 'thumb', 'lock'], 4).map((n) => `${n}${t.int(1, 99)}.tmp`);
      const keep = ['template.txt', 'notes.tmpl', 'backup.tmp.bak', 'tmp-plan.md'];
      for (const f of tmp.concat(keep)) t.file('~/work/' + f, `${f}\n`);
      return { tmp, keep };
    },
    prompt: 'Delete every file in «~/work» whose name *ends* in «.tmp» — and nothing else. Look before you delete.',
    check: (e, x) => x.tmp.every((f) => !e.file('~/work/' + f)) && x.keep.every((f) => e.file('~/work/' + f)),
    feedback: (e, x) => { const lost = x.keep.filter((f) => !e.file('~/work/' + f)); return lost.length ? `Deleted by mistake: ${lost.join(', ')} — «retry» to get them back.` : null; },
    hints: ['Preview a glob with «ls» first: it shows exactly what «rm» would get.', '«*.tmp» matches names that end in «.tmp»; «*tmp*» would match far more.', '«ls ~/work/*.tmp», then «rm ~/work/*.tmp»'],
    solution: ['ls ~/work/*.tmp', 'rm ~/work/*.tmp'],
    why: 'Run the glob with «ls» (or «echo») before «rm» — the shell expands it the same way both times.',
  });
  T({
    id: 'files-restore', topic: 'files', level: 2, cmds: ['cp', 'diff'], title: 'Undo an overwrite',
    setup(t) { const good = Array.from({ length: 5 }, () => `${t.word()}: ${t.int(1, 999)}`).join('\n') + '\n'; t.file('~/backups/report.txt.bak', good); t.file('~/report.txt', 'oops\n'); return { good }; },
    prompt: '«~/report.txt» was overwritten by accident and now just says «oops». Last night\'s copy is «~/backups/report.txt.bak». Put the report back — and keep the backup.',
    check: (e, x) => e.text('~/report.txt') === x.good && e.text('~/backups/report.txt.bak') === x.good,
    hints: ['Copy, don\'t move: the backup should still be there afterwards.', '«cp ~/backups/report.txt.bak ~/report.txt», then «diff» them to be sure.'],
    solution: ['cp ~/backups/report.txt.bak ~/report.txt', 'diff ~/backups/report.txt.bak ~/report.txt'],
    why: '«cp -i» and «mv -i» ask before overwriting — and «set -o noclobber» makes the shell refuse to «>» over an existing file.',
  });

  /* ===================== finding ===================== */
  T({
    id: 'find-combined', topic: 'find', level: 3, cmds: ['find'], title: 'Old files of bob\'s',
    setup(t) {
      const want = [];
      const mk = (name, owner, days) => { const p = `/srv/shared/${name}`; t.file(p, 'x\n', { owner, group: owner, mtime: t.now - days * DAY }); return p; };
      for (let i = 0; i < 3; i++) want.push(mk(`bob-old-${t.word()}${i}.txt`, 'bob', t.int(40, 300)));
      mk(`bob-new-${t.word()}.txt`, 'bob', t.int(1, 20));
      mk(`alice-old-${t.word()}.txt`, 'alice', t.int(40, 300));
      mk(`alice-new-${t.word()}.txt`, 'alice', t.int(1, 20));
      return { want };
    },
    prompt: 'List the files under «/srv/shared» that belong to «bob» *and* haven\'t been modified for more than 30 days.',
    check: (e, x) => sameSet(shownPaths(e), x.want),
    hints: ['find tests can be combined: next to each other they all have to be true.', '«-user NAME» matches the owner; «-mtime +30» means more than 30 days ago.', '«find /srv/shared -type f -user bob -mtime +30»'],
    solution: ['find /srv/shared -type f -user bob -mtime +30'],
  });
  T({
    id: 'find-prune', topic: 'find', level: 3, cmds: ['find', 'grep', 'wc'], title: 'Everywhere except there',
    setup(t) {
      const n = t.int(3, 7), skip = t.int(5, 12);
      for (let i = 0; i < n; i++) t.file(`~/project/${t.pick(['src', 'logs', 'tests'])}/run${i}.log`, 'x\n');
      for (let i = 0; i < skip; i++) t.file(`~/project/node_modules/pkg${i}/install.log`, 'x\n');
      return { n, all: n + skip };
    },
    prompt: 'How many «.log» files are under «~/project» if you leave out everything inside «node_modules»?',
    check: (e, x) => e.answer(x.n, { exact: true }),
    nudge: (e, x) => (e.answer(x.all, { exact: true }) ? `${x.all} includes node_modules — leave that folder out.` : null),
    hints: ['«-not -path \'*/node_modules/*\'» drops matches under that folder; «-prune» skips descending into it at all.', '«find ~/project -name node_modules -prune -o -name \'*.log\' -print | wc -l»'],
    solution: ["find ~/project -name node_modules -prune -o -name '*.log' -print | wc -l"],
  });
  T({
    id: 'find-print0', topic: 'pipes', level: 3, cmds: ['find', 'xargs', 'rm'], title: 'Names with spaces',
    setup(t) {
      const bak = ['old notes.bak', 'q3 report.bak', 'plain.bak', 'my photos list.bak'].map((n) => `~/docs/${t.pick(['', 'archive/', 'misc/'])}${n}`);
      for (const p of bak) t.file(p, 'x\n');
      const keep = ['~/docs/notes.txt', '~/docs/archive/report.txt', '~/docs/old notes'];
      for (const p of keep) t.file(p, 'x\n');
      return { bak, keep };
    },
    prompt: 'Delete every «.bak» file under «~/docs» (in any subfolder). Some names contain spaces — make sure they go too, and nothing else does.',
    check: (e, x) => x.bak.every((p) => !e.file(p)) && x.keep.every((p) => e.file(p)),
    nudge: (e, x) => (e.used('xargs') && x.bak.some((p) => e.file(p)) ? 'Plain «xargs» splits names at spaces. «find -print0 | xargs -0» passes them whole — or let find do it with «-delete».' : null),
    hints: ['«xargs» splits its input at spaces, so «old notes.bak» becomes two names.', '«find … -print0 | xargs -0 rm» separates names with a null byte instead — or use «find … -delete».', "«find ~/docs -name '*.bak' -print0 | xargs -0 rm»"],
    solution: ["find ~/docs -name '*.bak' -print0 | xargs -0 rm"],
  });

  /* ===================== streams and failures ===================== */
  T({
    id: 'pipes-split', topic: 'pipes', level: 2, cmds: ['bash'], title: 'Good news and bad news, separately',
    setup(t) {
      const ok = t.pickN(['web', 'db', 'cache', 'mail', 'dns'], 3), bad = ['backup', 'metrics'].slice(0, t.int(1, 2));
      t.file('~/bin/check.sh', `#!/bin/bash\n${ok.map((s) => `echo "OK ${s}"`).join('\n')}\n${bad.map((s) => `echo "FAIL ${s}" >&2`).join('\n')}\n`, { mode: 0o755 });
      return { ok: ok.map((s) => `OK ${s}`).join('\n') + '\n', bad: bad.map((s) => `FAIL ${s}`).join('\n') + '\n' };
    },
    prompt: 'Run «~/bin/check.sh». Save what it prints normally to «~/ok.txt» and its error messages to «~/errors.txt» — each in its own file.',
    check: (e, x) => e.text('~/ok.txt') === x.ok && e.text('~/errors.txt') === x.bad,
    feedback: (e, x) => (e.text('~/ok.txt') && /FAIL/.test(e.text('~/ok.txt')) ? 'The errors ended up in ok.txt too — «2>&1» merges the streams; here you want them apart.' : null),
    hints: ['Normal output is stream 1 (stdout), errors are stream 2 (stderr).', '«>» redirects stdout; «2>» redirects stderr.', '«~/bin/check.sh > ~/ok.txt 2> ~/errors.txt»'],
    solution: ['~/bin/check.sh > ~/ok.txt 2> ~/errors.txt'],
  });
  T({
    id: 'sh-set-e', topic: 'script', level: 3, cmds: ['set', 'bash'], title: 'Stop at the first failure',
    setup(t) {
      t.file('~/deploy.sh', '#!/bin/bash\necho "step 1: build"\nfalse  # the tests fail\necho "step 2: upload"\necho "DEPLOYED"\n', { mode: 0o755 });
    },
    prompt: '«~/deploy.sh» has a step that fails, yet it carries on and prints «DEPLOYED». Make the script stop at the first failing command (keep all its steps), and run it.',
    check: async (e) => {
      const src = e.text('~/deploy.sh') || '';
      if (!/step 2: upload/.test(src) || !/DEPLOYED/.test(src) || !/false/.test(src)) return false;
      if (!e.out().includes('step 1') || e.out().includes('DEPLOYED')) return false;
      const r = await e.game.trial('~/deploy.sh');
      return r.status !== 0 && !r.out.includes('DEPLOYED');
    },
    hints: ['A script ignores failures unless you tell it not to.', '«set -e» near the top makes bash exit as soon as a command fails. («set -euo pipefail» is the strict version many people use.)', "«sed -i '2i set -e' ~/deploy.sh», then «~/deploy.sh»"],
    solution: ["sed -i '2i set -e' ~/deploy.sh", '~/deploy.sh'],
    why: 'With «set -o pipefail» a pipeline fails if any part of it does, not just the last command. Commands tested by «if», «while», «&&» and «||» don\'t trigger set -e.',
  });
  T({
    id: 'sh-guard', topic: 'script', level: 3, cmds: ['bash', 'cp', 'test'], title: 'A script that checks its input',
    setup(t) { t.file('~/my notes.txt', 'remember the milk\n'); },
    prompt: 'Write an executable script «~/bak.sh FILE» that copies FILE to FILE.bak. With no argument it must print «usage: bak.sh FILE» and exit with status 1. It must work for names with spaces — try «~/bak.sh ~/my\\ notes.txt».',
    check: async (e) => {
      if (!(e.mode('~/bak.sh') & 0o100) || !e.file('~/my notes.txt.bak')) return false;
      const none = await e.game.trial('~/bak.sh');
      if (none.status !== 1 || !/usage: bak\.sh FILE/.test(none.out)) return false;
      const other = await e.game.trial('echo hi > "/tmp/a b"; ~/bak.sh "/tmp/a b"');
      return other.status === 0 && !!other.fs.tryGet('/tmp/a b.bak');
    },
    feedback: () => 'Try both cases yourself: «~/bak.sh» on its own (then «echo $?»), and «~/bak.sh "/tmp/a b"» for a name with a space.',
    hints: ['«$#» is the number of arguments; «[ $# -eq 0 ]» tests for none. «exit 1» ends the script with status 1.', 'Quote «"$1"» everywhere, or a space splits the name in two.', `Script body: «if [ $# -eq 0 ]; then echo "usage: bak.sh FILE"; exit 1; fi» then «cp "$1" "$1.bak"»`],
    solution: [{ edit: () => '#!/bin/bash\nif [ $# -eq 0 ]; then\n    echo "usage: bak.sh FILE"\n    exit 1\nfi\ncp "$1" "$1.bak"\n' }, 'nano ~/bak.sh', 'chmod +x ~/bak.sh', '~/bak.sh ~/my\\ notes.txt'],
  });

  /* ===================== permissions ===================== */
  T({
    id: 'perms-traverse', topic: 'perms', level: 2, cmds: ['chmod', 'sudo'], title: 'Can see it, can\'t open it',
    setup(t) { t.dir('/srv/handbook', { mode: 0o744 }); t.file('/srv/handbook/welcome.txt', 'Welcome to the team!\n', { mode: 0o644 }); },
    prompt: 'Bob can list the names in «/srv/handbook», but «cat /srv/handbook/welcome.txt» gives him «Permission denied». Fix it so everyone can open the files — without giving anyone else write access.',
    check: (e) => { const d = e.file('/srv/handbook'), f = e.file('/srv/handbook/welcome.txt'); return e.fs.can(d, 'bob', 1) && e.fs.can(f, 'bob', 4) && !(d.mode & 0o022) && !(f.mode & 0o022); },
    feedback: (e) => (e.mode('/srv/handbook') & 0o022 ? 'Bob can get in now — but so can anyone\'s writes. Take write access away from group and others.' : null),
    hints: ['On a directory, «r» lets you list names; «x» lets you go in and open what\'s inside.', 'The folder belongs to root, so changing it needs sudo.', '«sudo chmod o+x /srv/handbook» (or «755»). Check with «sudo -u bob cat /srv/handbook/welcome.txt».'],
    solution: ['sudo chmod 755 /srv/handbook', '$PW', 'sudo -u bob cat /srv/handbook/welcome.txt'],
  });
  T({
    id: 'perms-setgid', topic: 'perms', level: 3, cmds: ['chgrp', 'chmod', 'sudo'], title: 'A folder the team shares',
    setup(t) { t.dir('/srv/team', { owner: 'root', group: 'root', mode: 0o755 }); },
    prompt: 'Make «/srv/team» a shared folder for the «devs» group: devs can create files there, outsiders can\'t get in, and every new file automatically belongs to «devs».',
    check: (e) => { const d = e.file('/srv/team'); return d.group === 'devs' && (d.mode & 0o2000) !== 0 && (d.mode & 0o070) === 0o070 && (d.mode & 0o007) === 0; },
    feedback: (e) => { const d = e.file('/srv/team'); return d.group !== 'devs' ? 'The folder still belongs to the group «' + d.group + '».' : !(d.mode & 0o2000) ? 'New files would still get their creator\'s group — that\'s what the setgid bit on a folder changes.' : (d.mode & 0o007) ? 'Outsiders can still get in.' : 'Devs need read, write and enter (rwx).'; },
    hints: ['«chgrp» changes a folder\'s group; it needs sudo here.', 'The setgid bit («g+s», or a leading 2 in octal) on a folder makes new files inside take the folder\'s group.', '«sudo chgrp devs /srv/team && sudo chmod 2770 /srv/team»'],
    solution: ['sudo chgrp devs /srv/team', '$PW', 'sudo chmod 2770 /srv/team', 'ls -ld /srv/team'],
    why: '«ls -l» shows the setgid bit as an «s» where the group\'s «x» would be: «drwxrws---».',
  });

  /* ===================== processes ===================== */
  T({
    id: 'proc-select', topic: 'procs', level: 2, cmds: ['pgrep', 'pkill', 'kill'], title: 'The right one of two',
    setup(t) {
      const [stay, go] = t.shuffle(['emails', 'reports', 'invoices']).slice(0, 2);
      const a = t.proc({ user: t.user, comm: 'worker', args: `worker --queue ${stay}`, cpu: 3.1, stat: 'S' });
      const b = t.proc({ user: t.user, comm: 'worker', args: `worker --queue ${go}`, cpu: 71.4, stat: 'R' });
      return { stay, go, keep: a, kill: b };
    },
    prompt: (x) => `Two processes are both called «worker». Stop the one working on the «${x.go}» queue — and only that one.`,
    check: (e, x) => !e.world.proc(x.kill) && !!e.world.proc(x.keep),
    feedback: (e, x) => (!e.world.proc(x.keep) ? `The «${x.stay}» worker was stopped too — «retry» and pick by the full command line.` : null),
    hints: ['Both have the same name, so «pkill worker» would get both. The difference is in their arguments.', '«pgrep -af worker» shows each PID with its full command line; «-f» matches against that line.', (x) => `«pkill -f 'queue ${x.go}'» — or «kill» the PID that «pgrep -af worker» shows.`],
    solution: (x) => ['pgrep -af worker', `pkill -f 'queue ${x.go}'`],
  });

  /* ===================== your shell ===================== */
  T({
    id: 'shell-export', topic: 'shell', level: 2, cmds: ['export'], title: 'Why can\'t my script see it?',
    setup(t) { const v = t.pick(['staging', 'canary', 'blue']); t.file('~/show-env.sh', '#!/bin/bash\necho "deploying to: $TARGET"\n', { mode: 0o755 }); t.game.console.main.setVar('TARGET', v, false); return { v }; },
    prompt: (x) => `This shell has «TARGET=${x.v}» set, but «~/show-env.sh» prints «deploying to:» with nothing after it. Make the script see the variable, then run it.`,
    check: (e, x) => !!e.event('script', (ev) => /show-env\.sh$/.test(ev.path)) && e.out().includes(`deploying to: ${x.v}`),
    hints: ['A plain shell variable stays in this shell. Programs you start only get *exported* ones.', '«export TARGET» (or «export TARGET=…»), then run the script again.'],
    solution: ['export TARGET', '~/show-env.sh'],
    why: '«env» lists only exported variables; «set» lists them all. «TARGET=x ./script» exports it to that one command only.',
  });
  T({
    id: 'shell-quotes', topic: 'shell', level: 1, cmds: ['echo'], title: 'A literal dollar sign',
    prompt: 'Print exactly this text, dollar sign and all: «$HOME is where the heart is»',
    check: (e) => e.shownLines({ any: true }).includes('$HOME is where the heart is'),
    nudge: (e) => (e.out().includes(e.home + ' is where') ? 'Double quotes still expand «$HOME». Single quotes keep everything literal.' : null),
    hints: ['Inside double quotes the shell still replaces «$NAME» with its value.', "«echo '$HOME is where the heart is'» — single quotes keep it literal (or escape it: «\\$HOME»)."],
    solution: ["echo '$HOME is where the heart is'"],
  });

  /* ===================== getting help ===================== */
  T({
    id: 'help-discover', topic: 'help', level: 2, cmds: ['apropos', 'tac'], title: 'Find a tool you don\'t know',
    setup(t) { const lines = Array.from({ length: 6 }, (_, i) => `${i + 1}: ${t.word()}`); t.file('~/events.log', lines); return { want: lines.slice().reverse() }; },
    prompt: 'There\'s a standard command that prints a file\'s lines in reverse order — last line first. Find it by searching the manual descriptions for «reverse», then use it to print «~/events.log» newest-last-line first.',
    check: (e, x) => e.attempted(['apropos', 'man', 'whatis']) && e.shownLines().length === x.want.length && e.shownLines().every((l, i) => l === x.want[i]),
    hints: ['«apropos WORD» (or «man -k WORD») searches every manual page\'s one-line description.', '«apropos reverse» — then pick the one about lines, not characters.'],
    solution: ['apropos reverse', 'tac ~/events.log'],
    why: '«apropos» is how you find a command when you only know what you want it to do.',
  });

  /* ===================== boss scenarios ===================== */
  T({
    id: 'boss-restore', topic: 'archive', level: 4, cmds: ['tar', 'diff'], title: 'Boss: restore what was lost',
    setup(t) {
      const files = { 'project/main.py': `print("${t.word()}")\n`, 'project/util.py': `# util ${t.int(1, 99)}\n`, 'project/data/seed.csv': `id,${t.word()}\n1,2\n`, 'project/notes.md': `# notes v1\n${t.word()}\n` };
      const entries = [{ path: 'project/', type: 'dir' }, { path: 'project/data/', type: 'dir' }].concat(Object.entries(files).map(([path, content]) => ({ path, type: 'file', content }))).map((x) => Object.assign({ mode: x.type === 'dir' ? 0o755 : 0o644, owner: t.user, group: t.user, mtime: t.now - 2 * DAY }, x));
      t.file('~/backups/project-backup.tar.gz', '', { format: 'gzip', data: { name: 'project-backup.tar', inner: { format: 'tar', data: { entries } } } });
      /* today: two files deleted by accident, and the notes edited since the backup */
      const lost = t.pickN(['project/main.py', 'project/util.py', 'project/data/seed.csv'], 2);
      const notes = `# notes v2 — edited today\n${t.word()} ${t.word()}\n`;
      for (const [p, c] of Object.entries(files)) if (!lost.includes(p)) t.file('~/' + p, p === 'project/notes.md' ? notes : c);
      return { files, lost, notes };
    },
    prompt: 'Two files in «~/project» were deleted by accident. «~/backups/project-backup.tar.gz» is from two days ago. Restore what was lost:',
    parts: [
      { text: 'look inside the backup first (list it)', check: (e) => !!e.ran('tar', (r) => /t/.test(r.args.join(' ').replace(/--?[a-z]*[^t-]/g, '')) && r.out.includes('project/')) },
      { text: 'bring back the missing files, exactly as backed up', state: true, check: (e, x) => x.lost.every((p) => e.text('~/' + p) === x.files[p]) },
      { text: 'without losing today\'s edit to «notes.md»', state: true, check: (e, x) => e.text('~/project/notes.md') === x.notes },
    ],
    feedback: (e, x) => (e.text('~/project/notes.md') !== x.notes ? 'notes.md was overwritten with the old version — «retry» and extract only what\'s missing (or use «-k» to keep existing files).' : null),
    hints: ['Extracting the whole archive over the project would overwrite notes.md with its old version.', 'You can name the members to extract: «tar -xzf ARCHIVE -C ~ project/FILE …» — or add «-k» to keep files that already exist.', 'Or unpack to a scratch folder («mkdir /tmp/r && tar -xzf … -C /tmp/r») and copy across just what\'s missing.'],
    solution: (x) => ['tar -tzf ~/backups/project-backup.tar.gz', `tar -xzf ~/backups/project-backup.tar.gz -C ~ ${x.lost.join(' ')}`, 'ls -R ~/project'],
    why: 'Restore into a scratch directory first when you\'re unsure, then compare with «diff -r» before copying anything back.',
  });
  T({
    id: 'boss-team', topic: 'perms', level: 4, cmds: ['mkdir', 'chgrp', 'chmod', 'sudo'], title: 'Boss: a project folder for the devs',
    setup(t) { return { d: '/srv/' + t.pick(['atlas', 'orion', 'vega']) }; },
    prompt: (x) => `Set up «${x.d}» for the «devs» group (you and alice are in it; bob isn't):`,
    parts: [
      { text: (x) => `create «${x.d}», belonging to the group «devs»`, state: true, check: (e, x) => { const d = e.file(x.d); return !!d && d.type === 'dir' && d.group === 'devs'; } },
      { text: 'devs can create files there; everyone else gets nothing', state: true, check: (e, x) => { const d = e.file(x.d); return !!d && e.fs.can(d, 'alice', 2) && e.fs.can(d, 'alice', 1) && !e.fs.can(d, 'bob', 1) && !e.fs.can(d, 'bob', 4); } },
      { text: 'new files inside belong to «devs» automatically', state: true, check: (e, x) => { const d = e.file(x.d); return !!d && (d.mode & 0o2000) !== 0; } },
      { text: 'prove it: as alice, create a file there', check: (e, x) => { const d = e.file(x.d); return !!d && [...d.children.values()].some((n) => n.owner === 'alice' && n.group === 'devs'); } },
    ],
    hints: ['Create it with sudo, then hand the group over with «chgrp».', '«2770»: setgid (2), rwx for the owner and the group, nothing for others.', (x) => `«sudo -u alice touch ${x.d}/hello» tests it as alice.`],
    solution: (x) => [`sudo mkdir ${x.d}`, '$PW', `sudo chgrp devs ${x.d}`, `sudo chmod 2770 ${x.d}`, `sudo -u alice touch ${x.d}/hello`, `ls -l ${x.d}`],
  });
})();
