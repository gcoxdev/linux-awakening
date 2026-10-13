#!/usr/bin/env node
/* Practice Range: every task template, on several random machines, must
   - build, with hints and an answer that renders every step (editor text, prompts, keys),
   - not count as solved after a stray «ls», and be solved by its own answer;
   and across the catalog:
   - common wrong attempts must NOT pass (empty files, deleted sources, wrong order, wrong target, echoed answers),
   - legitimate alternatives must pass,
   - mastery credits only commands actually used, and never for a revealed answer,
   - hints warn before giving the answer away; a session supports next, skip, retry, variant, topics, levels and resume.
   Usage: node test/practice.js [--verbose] [--only ID] [--seeds N] [--distro debian|fedora|arch|opensuse|all] */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !s.includes('/ui/') && !s.endsWith('main.js'));
for (const s of scripts) require(path.join(root, s));
const LA = globalThis.LA;
const P = LA.practice;
LA.timeScale = 0.001;

const argv = process.argv.slice(2);
const verbose = argv.includes('--verbose');
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const nSeeds = argv.includes('--seeds') ? +argv[argv.indexOf('--seeds') + 1] : 4;
const distroArg = argv.includes('--distro') ? argv[argv.indexOf('--distro') + 1] : 'debian';
const distros = distroArg === 'all' ? LA.DISTRO_ORDER : [distroArg];
const plain = (s) => LA.util.stripAnsi(s).replace(/[«»]/g, '');
let failures = 0, passed = 0;
function expect(label, ok, detail) {
  if (ok) { passed++; if (verbose) console.log('✓ ' + label); return; }
  failures++;
  console.error('✗ ' + label + (detail ? '\n  ' + String(detail).slice(-1800).replace(/\n/g, '\n  ') : ''));
}

/* a practice game sitting on one task */
async function gameOn(id, seed, user = 'kit', storage = null) {
  const view = new LA.HeadlessView();
  const game = new LA.PracticeGame(view, storage, 'practice');
  game.newGame(user);
  game.state.task = { id, seed, hint: 0, revealed: false, warned: false };
  game.buildTask(id, seed);
  try { await game.console.main.ready; } catch (e) { /* ignore */ }
  return { game, view };
}
const solutionOf = (game) => { const t = game.task.tpl; return typeof t.solution === 'function' ? t.solution(game.task.x, game) : t.solution; };
async function run(game, items) { await LA.runItems(game.console, items, game); await game.console.settle(); }
const items = (f, game) => (typeof f === 'function' ? f(game.task.x, game) : f);

/* ---- wrong attempts that must not be accepted (Debian) ---- */
const ZEROES = '0'.repeat(64);
const WRONG = [
  ['files-cp-r', ['rm -r ~/site'], 'deleting the source'],
  ['files-cp-r', ['mkdir ~/site-backup', 'cp ~/site/index.html ~/site-backup/'], 'a partial copy'],
  ['gzip-keep', ['touch ~/big.log.gz'], 'an empty .gz'],
  ['tar-extract', ['mkdir -p ~/deploy/app/lib', 'touch ~/deploy/app/lib/core.py'], 'an empty leaf instead of the archive'],
  ['files-mv-rename', ['rm ~/notes/todo.txt', 'touch ~/notes/done.txt'], 'losing the contents'],
  ['sha-create', ['cd ~/release', `echo "${ZEROES}  a.iso" > SHA256SUMS`, `echo "${ZEROES}  b.iso" >> SHA256SUMS`, `echo "${ZEROES}  c.iso" >> SHA256SUMS`], 'fake hashes'],
  ['sha-create', ['cd ~', 'sha256sum release/*.iso > release/SHA256SUMS'], 'names that don\'t resolve from ~/release'],
  ['cron-daily', ['echo "30 2 * * * /does/not/exist/backup.sh" | crontab -'], 'a nonexistent script'],
  ['cron-daily', ['echo "2 30 * * * /home/kit/backup.sh" | crontab -'], 'minute and hour swapped'],
  ['nav-tree', ['tree -L 2 /tmp'], 'the wrong directory'],
  ['nav-head', [(x) => `head -n ${x.n} ~/logs/server.log | tac`], 'the right lines in the wrong order'],
  ['disk-mount', ['ls ~', 'sudo mount -o ro /dev/sdb1 /mnt/usb', '$PW'], 'an unrelated listing before mounting'],
  ['disk-mount', ['sudo mount /dev/sdb1 /mnt/usb', '$PW', 'ls /mnt/usb'], 'mounted read-write'],
  ['net-curl', ['curl http://web.lab/status > /dev/null'], 'output thrown away'],
  ['nav-hidden', [(x) => `ls /tmp; echo ${x.code}`], 'an echoed answer'],
  ['nav-largest', [(x) => `echo ${x.biggest}`], 'an echoed answer'],
  ['tar-count', ['tar -tzf ~/pkg.tar.gz | wc -l'], 'counting folders too'],
  ['tar-list', ['tar -xzf ~/release.tar.gz', 'ls -R ~/release'], 'extracting instead of listing'],
  ['boss-deploy', [(x) => `mkdir -p ~/releases/${x.v}`, (x) => `tar -xzf ~/release-${x.v}.tar.gz -C ~/releases/${x.v}`, (x) => `chmod +x ~/releases/${x.v}/run.sh`, (x) => `rm -r ~/releases/${x.v}`, (x) => `ln -s ~/releases/${x.v} ~/current`], 'a symlink to a deleted release'],
  ['boss-backup', ['cd ~', (x) => `tar -czf ${x.name} project/README.md`, (x) => `echo "${ZEROES}  ${x.name}" > ${x.name}.sha256`, (x) => `scp ${x.name} ${x.name}.sha256 backup.lab:/srv/backups/`, { answer: 'yes' }], 'a partial tarball and a fake checksum'],
  ['sh-args', [(x) => `printf '#!/bin/bash\\n# uses $1\\necho "Hi ${x.n}!"\\n' > ~/greet.sh`, 'chmod +x ~/greet.sh', (x) => `~/greet.sh ${x.n}`], 'a hard-coded greeting'],
  ['heredoc', [(x) => `printf '%s\\n' '${x.lines[0]}' '${x.lines[1]}' '${x.lines[2]}' > ~/motd.txt`], 'no heredoc, though the task asks for one'],
  ['sh-for-files', ['mkdir -p ~/out', (x) => Array.from({ length: x.n }, (_, i) => `echo "${x.w} ${i + 1}" > ~/out/${x.w}${i + 1}.txt`).join('; ')], 'no loop, though the task asks for one'],
  ['files-mkdir-p', [(x) => `mkdir -p ~/${x.p}/src`, (x) => `mkdir ~/${x.p}/docs`, (x) => `mkdir ~/${x.p}/tests`], 'three commands for a one-command task'],
  ['boss-incident', ['df -h /'], 'df before the fix'],
  ['alias-persist', ["alias la='ls -A'", 'la'], 'an alias that won\'t survive a new shell'],
  ['find-locate-stale', [(x) => `find ~ -name ${x.name}`], 'find instead of fixing locate'],
  ['files-dotfiles', ['cp -r ~/proj/* ~/proj-copy/'], 'a glob that skips hidden files'],
  ['files-broken-link', ['rm ~/app/config.yml', 'cp ~/settings/app.yml ~/app/config.yml'], 'a copy instead of a link'],
  ['files-safe-rm', ['rm ~/work/*tmp*'], 'a glob that catches too much'],
  ['find-print0', ["find ~/docs -name '*.bak' | xargs rm"], 'names with spaces split by xargs'],
  ['pipes-split', ['~/bin/check.sh > ~/ok.txt 2>&1', 'touch ~/errors.txt'], 'both streams in one file'],
  ['sh-set-e', ["sed -i '/false/d' ~/deploy.sh", '~/deploy.sh'], 'deleting the failing step'],
  ['sh-guard', [{ edit: () => '#!/bin/bash\nif [ $# -eq 0 ]; then echo "usage: bak.sh FILE"; exit 1; fi\ncp $1 $1.bak\n' }, 'nano ~/bak.sh', 'chmod +x ~/bak.sh', '~/bak.sh ~/my\\ notes.txt'], 'unquoted $1'],
  ['perms-traverse', ['sudo chmod 777 /srv/handbook', '$PW', 'sudo chmod 666 /srv/handbook/welcome.txt'], 'giving everyone write access'],
  ['perms-setgid', ['sudo chgrp devs /srv/team', '$PW', 'sudo chmod 770 /srv/team'], 'no setgid bit'],
  ['proc-select', ['pkill worker'], 'stopping both workers'],
  ['shell-quotes', ['echo "$HOME is where the heart is"'], 'double quotes expand $HOME'],
  ['boss-restore', ['tar -tzf ~/backups/project-backup.tar.gz', 'tar -xzf ~/backups/project-backup.tar.gz -C ~'], 'extracting over today\'s edit'],
  ['boss-team', [(x) => `sudo mkdir ${x.d}`, '$PW', (x) => `sudo chgrp devs ${x.d}`, (x) => `sudo chmod 2777 ${x.d}`, (x) => `sudo -u alice touch ${x.d}/hello`], 'a folder anyone can enter'],
];
/* ---- legitimate alternatives that must be accepted (Debian) ---- */
const RIGHT = [
  ['nav-wc-lines', ["awk 'END {print NR}' ~/data/records.csv"]],
  ['nav-wc-lines', ['wc -l < ~/data/records.csv']],
  ['nav-head', [(x) => `sed -n '1,${x.n}p' ~/logs/server.log`]],
  ['sh-expr', [(x) => `echo $(( ${x.a} % ${x.b} ))`]],
  ['files-cp-r', ['cp -a ~/site ~/site-backup']],
  ['files-cp-r', ['mkdir ~/site-backup', 'cp -r ~/site/. ~/site-backup/']],
  ['sha-create', ['sha256sum ~/release/*.iso > ~/release/SHA256SUMS']],
  ['cron-daily', ['echo "30 02 * * * bash ~/backup.sh" | crontab -']],
  ['cron-every15', ['echo "0,15,30,45 * * * * $HOME/ping.sh" | crontab -']],
  ['cron-weekly', ['echo "0 6 * * mon /home/kit/report.sh" | crontab -']],
  ['tar-count', ["tar -tzf ~/pkg.tar.gz | grep -vc '/$'"]],
  ['zcat-grep', ['gzip -dc ~/old.log.gz | grep -c ERROR']],
  ['sys-hostname', ['cat /etc/hostname']],
  ['nav-tree', ['cd ~/site', 'tree -L 2']],
  ['gzip-keep', ['cp ~/big.log ~/copy.log', 'gzip ~/copy.log', 'mv ~/copy.log.gz ~/big.log.gz']],
  ['nav-wc-words', ['cat ~/essay.txt | wc -w']],
  ['files-dash', ['mv ~/inbox/-draft.txt ~/inbox/draft.txt']],
  ['files-dotfiles', ['cp -r ~/proj/. ~/proj-copy/']],
  ['files-broken-link', ['cd ~/app', 'rm config.yml', 'ln -s ~/settings/app.yml config.yml']],
  ['find-print0', ["find ~/docs -name '*.bak' -delete"]],
  ['find-print0', ["find ~/docs -name '*.bak' -exec rm {} +"]],
  ['perms-traverse', ['sudo chmod o+x /srv/handbook', '$PW']],
  ['perms-setgid', ['sudo chgrp devs /srv/team', '$PW', 'sudo chmod g+rwxs,o-rwx /srv/team']],
  ['proc-select', [(x) => `kill $(pgrep -f 'queue ${x.go}')`]],
  ['shell-quotes', ['echo "\\$HOME is where the heart is"']],
  ['boss-restore', ['tar -tzf ~/backups/project-backup.tar.gz', 'tar -xzkf ~/backups/project-backup.tar.gz -C ~']],
  ['sh-set-e', ["sed -i '1a set -euo pipefail' ~/deploy.sh", '~/deploy.sh']],
];

async function main() {
  catalog();
  for (const d of distros) { LA.distroId = d; await forDistro(d); }
  if (!only) {
    LA.distroId = 'debian';
    await attempts();
    await credit();
    await hints();
    await generators();
    await session();
  }
  console.log(failures ? `\n${failures} practice check(s) failed (${passed} passed)` : `practice: ${passed} checks · ${distros.map((d) => `${d} ${P.tasksFor(d).length} tasks/${P.allCommands(d).length} commands`).join(' · ')} × ${nSeeds} machines OK`);
  process.exit(failures ? 1 : 0);
}

function catalog() {
  expect('LA.stories.practice.Game is the practice game', LA.stories.practice.Game === LA.PracticeGame);
  const ids = new Set();
  for (const t of P.tasks) {
    expect(`unique task id ${t.id}`, !ids.has(t.id));
    ids.add(t.id);
    expect(`${t.id}: known topic`, P.TOPICS.some((x) => x[0] === t.topic), t.topic);
    expect(`${t.id}: has a solution`, !!t.solution);
    expect(`${t.id}: has a check`, !!(t.check || t.parts));
    expect(`${t.id}: has at least one hint before the answer`, Array.isArray(t.hints) && t.hints.length > 0);
  }
}

async function forDistro(distro) {
  const tasks = only ? P.tasksFor(distro).filter((t) => t.id === only) : P.tasksFor(distro);
  for (const t of tasks) {
    for (let s = 1; s <= nSeeds; s++) {
      const seed = s * 7919 + t.id.length;
      let g;
      try { g = await gameOn(t.id, seed); } catch (err) { expect(`${distro} ${t.id}#${seed}: builds`, false, err.stack); break; }
      const { game, view } = g;
      const label = `${distro} ${t.id}#${seed}`;
      expect(`${label}: built as ${distro}`, game.world.distro === distro, game.world.distro);
      const sol = solutionOf(game);
      /* the rendered answer shows every step a learner has to take */
      const shown = P.renderSolution(sol, (x) => game.fmt(x)).join('\n');
      for (const it of sol) {
        if (it && it.ctrlc) expect(`${label}: answer shows Ctrl+C`, /Ctrl\+C/.test(shown), shown);
        if (it && it.nowait) expect(`${label}: answer shows ${it.nowait}`, shown.includes(game.fmt(it.nowait)), shown);
        if (it && it.edit) expect(`${label}: answer shows the file to write`, /make the file read/.test(shown) && /Ctrl\+O/.test(shown), shown);
        if (it && typeof it === 'object' && 'answer' in it) expect(`${label}: answer shows what to type at the prompt`, shown.includes(String(it.answer)), shown);
      }
      await run(game, ['ls']);
      expect(`${label}: not solved by «ls»`, !game.task.solved, plain(view.out));
      if (game.task.solved) continue;
      try { await run(game, sol); } catch (err) { expect(`${label}: solution runs`, false, err.stack); continue; }
      expect(`${label}: solved by its solution`, game.task.solved && game.state.stats.solved === 1, `${JSON.stringify(game.task.x).slice(0, 300)}\n${sol.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('\n')}\n----\n${plain(view.out).slice(-1500)}`);
      if (!game.task.solved) continue;
      expect(`${label}: earned XP`, game.state.xp > 0, plain(view.out));
      expect(`${label}: waits for «next»`, game.task.tpl.id === t.id && /«?next»?/.test(plain(view.out)));
      const credited = Object.keys(game.state.mastery);
      expect(`${label}: credits commands that were run`, credited.length > 0 && credited.every((c) => P.allCommands(distro).includes(c)), credited.join(' '));
    }
  }
  if (!only) {
    /* every command the stories teach gets practiced */
    const taught = new Set();
    for (const id of Object.keys(LA.stories)) for (const ch of LA.stories[id].chapters || []) for (const c of ch.unlocks || []) taught.add(LA.isPmCmd(c) ? LA.distro(distro).pm : c);
    const practiced = new Set(P.allCommands(distro));
    const ignore = new Set(['help', 'hint', 'goal', 'objective', 'story', 'progress', 'notebook', 'clear', 'exit', 'logout', 'reset', 'man']);
    const missing = [...taught].filter((c) => !practiced.has(c) && !ignore.has(c));
    expect(`${distro}: every taught command is practiced`, !missing.length, missing.join(' '));
  }
}

async function attempts() {
  for (const [id, steps, why] of WRONG) {
    for (const seed of [11, 12]) {
      const { game, view } = await gameOn(id, seed);
      await run(game, steps.map((s) => items(s, game)));
      expect(`wrong attempt rejected — ${id}: ${why}`, !game.task.solved, plain(view.out).slice(-1200));
    }
  }
  for (const [id, steps] of RIGHT) {
    for (const seed of [11, 12]) {
      const { game, view } = await gameOn(id, seed);
      await run(game, steps.map((s) => items(s, game)));
      expect(`alternative accepted — ${id}: ${steps.map((s) => (typeof s === 'function' ? s(game.task.x) : s)).join(' ; ')}`, game.task.solved, plain(view.out).slice(-1200));
    }
  }
  /* multi-step tasks: a condition that comes undone un-ticks */
  const { game } = await gameOn('boss-deploy', 5);
  const x = game.task.x;
  await run(game, [`mkdir -p ~/releases/${x.v}`, `tar -xzf ~/release-${x.v}.tar.gz -C ~/releases/${x.v}`]);
  expect('boss-deploy: unpacking ticks the first part', game.task.parts[0]);
  await run(game, [`rm -r ~/releases/${x.v}`]);
  expect('boss-deploy: deleting the release un-ticks it', !game.task.parts[0]);
}

async function credit() {
  const cases = [
    ['uniq-count-ips', ['cut -d" " -f1 ~/logs/access.log | sort -u | wc -l'], ['cut', 'sort', 'wc'], ['uniq', 'awk']],
    ['proc-kill', [(x) => `pkill ${x.name}`], ['pkill'], ['kill', 'pgrep']],
    ['net-dns', [(x) => `dig +short ${x.h}`], ['dig'], ['host']],
    ['sh-for-files', [(x) => `mkdir -p ~/out; for i in $(seq 1 ${x.n}); do echo "${x.w} $i" > ~/out/${x.w}$i.txt; done`], ['seq'], ['touch']],
  ];
  for (const [id, steps, want, not] of cases) {
    const { game } = await gameOn(id, 21);
    await run(game, ['ls ~'].concat(steps.map((s) => items(s, game))));
    const m = game.state.mastery;
    expect(`credit — ${id}: ${want.join(', ')} credited`, game.task.solved && want.every((c) => m[c] === 1), JSON.stringify(m));
    expect(`credit — ${id}: ${not.join(', ')} not credited`, not.every((c) => !m[c]), JSON.stringify(m));
    expect(`credit — ${id}: an incidental «ls» isn't credited`, !m.ls, JSON.stringify(m));
  }
  /* an answer that was shown: participation, not mastery */
  const { game, view } = await gameOn('net-dns', 22);
  await run(game, ['solution']);
  await run(game, solutionOf(game));
  const st = game.state;
  expect('assisted: solved, no XP', game.task.solved && st.xp === 0, plain(view.out).slice(-600));
  expect('assisted: no mastery, but recorded as tried', !st.mastery.dig && st.assistedUse.dig === 1 && P.masteryLevel(st, 'dig') === 1, JSON.stringify([st.mastery, st.assistedUse]));
  expect('assisted: not counted toward topic badges', !st.topicSolved.net && !st.independent['net-dns']);
  expect('assisted: scheduled for review', st.review.some((r) => r.id === 'net-dns'));
  /* mastery needs repetition across different tasks */
  const fake = { mastery: { grep: 9 }, masteryTasks: { grep: ['a', 'b'] }, assistedUse: {} };
  expect('mastery needs three different tasks', P.masteryLevel(fake, 'grep') === 2);
  fake.masteryTasks.grep.push('c');
  expect('…and then it is mastered', P.masteryLevel(fake, 'grep') === 3);
}

async function hints() {
  const { game, view } = await gameOn('proc-jobs', 31);
  const n = game.task.tpl.hints.length;
  for (let i = 0; i < n; i++) await run(game, ['hint']);
  expect('hints: clues don\'t reveal the answer', !game.state.task.revealed);
  await run(game, ['hint']);
  expect('hints: a warning comes before the answer', !game.state.task.revealed && game.state.task.warned && /no XP/.test(plain(view.out)), plain(view.out).slice(-500));
  view.out = '';
  await run(game, ['hint']);
  const out = plain(view.out);
  expect('hints: then the answer, complete', game.state.task.revealed && /sleep 300 &/.test(out) && /jobs/.test(out) && /\bfg\b/.test(out) && /Ctrl\+C/.test(out), out);
  /* hints alone cost no XP */
  const g2 = (await gameOn('nav-wc-lines', 32)).game;
  await run(g2, ['hint']);
  await run(g2, solutionOf(g2));
  expect('hints: a hint costs no XP', g2.task.solved && g2.state.xp === P.XP[g2.task.tpl.level], String(g2.state.xp));
  /* «check» reports progress without solving or revealing */
  const g3 = await gameOn('boss-deploy', 33);
  const x = g3.game.task.x;
  await run(g3.game, [`mkdir -p ~/releases/${x.v}`, `tar -xzf ~/release-${x.v}.tar.gz -C ~/releases/${x.v}`]);
  g3.view.out = '';
  await run(g3.game, ['check']);
  expect('check: shows done and missing parts', /✓ unpack/.test(plain(g3.view.out)) && /○ make/.test(plain(g3.view.out)) && !g3.game.state.task.revealed, plain(g3.view.out));
}

async function generators() {
  /* zero results and other boundaries */
  let zero = null;
  for (let s = 1; s < 400 && !zero; s++) { const g = await gameOn('sh-expr', s); if (g.game.task.x.want === 0) zero = g; }
  expect('generators: found an sh-expr with remainder 0', !!zero);
  if (zero) { await run(zero.game, solutionOf(zero.game)); expect('generators: «expr» printing 0 (exit status 1) still solves', zero.game.task.solved); }
  for (let s = 1; s <= 300; s++) {
    const { game } = await gameOn('sed-delete', s);
    if (game.world.main.fs.contentOf(game.world.main.fs.get(game.home + '/config.ini')) === game.task.x.want) { expect(`generators: sed-delete seed ${s} has comments to delete`, false); break; }
  }
  /* player names that are also generated names */
  for (const user of ['carol', 'dave', 'heidi']) {
    for (let s = 1; s <= 12; s++) {
      const { game } = await gameOn('user-add', s, user);
      if (game.task.x.u === user || game.world.main.users.exists(game.task.x.u)) { expect(`generators: user-add for player ${user} picks a free name`, false, game.task.x.u); break; }
    }
  }
  /* every task, as a player called carol */
  for (const t of P.tasksFor('debian')) {
    const { game, view } = await gameOn(t.id, 41, 'carol');
    await run(game, ['ls']);
    if (game.task.solved) { expect(`as carol: ${t.id} not solved by «ls»`, false); continue; }
    await run(game, solutionOf(game));
    expect(`as carol: ${t.id} solved by its solution`, game.task.solved, plain(view.out).slice(-800));
  }
}

async function session() {
  const store = {};
  const storage = { get: (k) => store[k], set: (k, v) => { store[k] = v; return true; }, remove: (k) => { delete store[k]; } };
  const view = new LA.HeadlessView();
  const game = new LA.PracticeGame(view, storage, 'practice');
  game.newGame('kit');
  await game.start();
  expect('session: a task is dealt', !!game.task && /★/.test(plain(view.out)), plain(view.out));
  for (let i = 0; i < 5; i++) {
    await run(game, solutionOf(game));
    expect(`session: task ${i + 1} solved and waiting`, game.task.solved, plain(view.out).slice(-800));
    await run(game, ['ls ~']);
    expect(`session: the machine stays after solving (${i + 1})`, game.task.solved);
    await run(game, ['next']);
  }
  expect('session: five tasks solved', game.state.stats.solved === 5, plain(view.out).slice(-2000));
  expect('session: XP, a streak and badges', game.state.xp > 0 && game.state.streak === 5 && game.state.badges.includes('first') && game.state.badges.includes('streak5'));
  const before = game.state.task.id + game.state.task.seed;
  await run(game, ['skip']);
  expect('session: skip deals a new task, keeps the streak, and schedules a review', game.state.task.id + game.state.task.seed !== before && game.state.streak === 5 && game.state.review.length === 1);
  await run(game, ['next']);
  expect('session: «next» refuses an unsolved task', game.state.stats.solved === 5);
  await run(game, ['topic archive']);
  expect('session: topic changes the task', game.task.tpl.topic === 'archive', game.task.tpl.id);
  await run(game, ['level 3']);
  expect('session: a level the topic doesn\'t have is refused', game.state.level === 0, plain(view.out).slice(-300));
  await run(game, ['progress', 'notebook', 'help', 'task', 'task list tar', 'level 2']);
  expect('session: level 2', game.task.tpl.level === 2 && game.task.tpl.topic === 'archive');
  await run(game, ['task boss-deploy']);
  expect('session: «task ID» starts that task', game.task.tpl.id === 'boss-deploy');
  const seed = game.state.task.seed;
  await run(game, ['retry']);
  expect('session: retry keeps the seed', game.task.tpl.id === 'boss-deploy' && game.state.task.seed === seed);
  await run(game, ['variant']);
  expect('session: variant changes the data', game.task.tpl.id === 'boss-deploy' && game.state.task.seed !== seed);
  /* resume mid-task: the files survive */
  const x = game.task.x;
  await run(game, [`mkdir -p ~/releases/${x.v}`, `tar -xzf ~/release-${x.v}.tar.gz -C ~/releases/${x.v}`, 'cd ~/releases', 'alias ll="ls -l"']);
  expect('session: part one done before saving', game.task.parts[0]);
  const v2 = new LA.HeadlessView();
  const g2 = new LA.PracticeGame(v2, storage, 'practice');
  expect('session: loads', g2.load());
  await g2.resume();
  expect('session: resumes the same attempt, files, parts and shell included', g2.task.tpl.id === 'boss-deploy' && JSON.stringify(g2.task.x) === JSON.stringify(x) && g2.task.parts[0] && !!g2.world.main.fs.tryGet(`${g2.home}/releases/${x.v}/run.sh`) && g2.console.main.cwd === `${g2.home}/releases` && !!g2.console.main.aliases.ll, plain(v2.out));
  await run(g2, [`chmod +x ~/releases/${x.v}/run.sh`, `ln -s ~/releases/${x.v} ~/current`]);
  expect('session: and can be finished after resuming', g2.task.solved, plain(v2.out).slice(-800));
  /* one profile per distro */
  LA.distroId = 'arch';
  const g3 = new LA.PracticeGame(new LA.HeadlessView(), storage, 'practice');
  expect('session: an Arch profile is separate from the Debian one', !g3.load() && g3.saveKey !== game.saveKey);
  LA.distroId = 'debian';
}

main().catch((e) => { console.error(e); process.exit(1); });
