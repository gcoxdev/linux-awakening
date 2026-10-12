#!/usr/bin/env node
/* Practice Range: every task template, on several random machines, must
   - not count as solved before the player does anything (or after a trivial «ls»),
   - be solved by its own reference solution.
   Also checks that every command the stories teach is practised somewhere.
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
let failures = 0;
function expect(label, ok, detail) {
  if (ok) { if (verbose) console.log('✓ ' + label); return; }
  failures++;
  console.error('✗ ' + label + (detail ? '\n  ' + String(detail).slice(-1800).replace(/\n/g, '\n  ') : ''));
}

/* a practice game sitting on one task, which stops after solving it instead of dealing the next */
function gameOn(id, seed) {
  const view = new LA.HeadlessView();
  const game = new LA.PracticeGame(view, null, 'practice');
  game.newGame('kit');
  game.state.task = { id, seed, hint: 0, revealed: false };
  game.buildTask(id, seed);
  game.solvedCount = 0;
  game.nextTask = async () => { game.solvedCount++; };
  return { game, view };
}

async function main() {
  for (const d of distros) { LA.distroId = d; await forDistro(d); }
  console.log(failures ? `\n${failures} practice check(s) failed` : `practice: ${distros.map((d) => `${d} ${P.tasksFor(d).length} tasks/${P.allCommands(d).length} commands`).join(' · ')} × ${nSeeds} machines OK`);
  process.exit(failures ? 1 : 0);
}

async function forDistro(distro) {
  expect('LA.stories.practice.Game is the practice game', LA.stories.practice.Game === LA.PracticeGame);
  const ids = new Set();
  for (const t of P.tasks) { expect(`unique task id ${t.id}`, !ids.has(t.id)); ids.add(t.id); }
  for (const t of P.tasks) {
    expect(`${t.id}: known topic`, P.TOPICS.some((x) => x[0] === t.topic), t.topic);
    expect(`${t.id}: has a solution`, !!t.solution);
    expect(`${t.id}: has a check`, !!(t.check || t.parts));
  }

  const tasks = only ? P.tasksFor(distro).filter((t) => t.id === only) : P.tasksFor(distro);
  for (const t of tasks) {
    for (let s = 1; s <= nSeeds; s++) {
      const seed = s * 7919 + t.id.length;
      let g;
      try { g = gameOn(t.id, seed); } catch (err) { expect(`${distro} ${t.id}#${seed}: builds`, false, err.stack); break; }
      const { game, view } = g;
      try { await game.console.main.ready; } catch (e) { /* ignore */ }
      /* a trivial command must not solve it */
      await LA.runItems(game.console, ['ls'], game);
      expect(`${distro} ${t.id}#${seed}: built as ${distro}`, game.world.distro === distro, game.world.distro);
      expect(`${distro} ${t.id}#${seed}: not solved by «ls»`, !game.task.solved, plain(view.out));
      if (game.task.solved) continue;
      /* the reference solution must */
      const sol = typeof t.solution === 'function' ? t.solution(game.task.x, game) : t.solution;
      try { await LA.runItems(game.console, sol, game); } catch (err) { expect(`${distro} ${t.id}#${seed}: solution runs`, false, err.stack); continue; }
      await game.console.settle();
      expect(`${distro} ${t.id}#${seed}: solved by its solution`, game.task.solved && game.solvedCount === 1, `${JSON.stringify(game.task.x)}\n${sol.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('\n')}\n----\n${plain(view.out).slice(-1500)}`);
      if (game.task.solved) expect(`${distro} ${t.id}#${seed}: earned XP`, game.state.xp > 0, plain(view.out));
    }
  }

  if (!only) {
    /* every command the stories teach gets practised */
    const taught = new Set();
    for (const id of Object.keys(LA.stories)) for (const ch of LA.stories[id].chapters || []) for (const c of ch.unlocks || []) taught.add(LA.isPmCmd(c) ? LA.distro(distro).pm : c);
    const practised = new Set(P.allCommands(distro));
    const ignore = new Set(['help', 'hint', 'goal', 'objective', 'story', 'progress', 'notebook', 'clear', 'exit', 'logout', 'reset', 'man']);
    const missing = [...taught].filter((c) => !practised.has(c) && !ignore.has(c));
    expect('every taught command is practised', !missing.length, missing.join(' '));

    /* a whole session: start, solve a few, hint, skip, save and resume */
    const view = new LA.HeadlessView();
    const store = {};
    const storage = { get: (k) => store[k], set: (k, v) => { store[k] = v; return true; } };
    const game = new LA.PracticeGame(view, storage, 'practice');
    game.newGame('kit');
    await game.start();
    expect('session: a task is dealt', !!game.task && /SOLVED|★/.test(plain(view.out)), plain(view.out));
    for (let i = 0; i < 5; i++) {
      const tpl = game.task.tpl;
      const sol = typeof tpl.solution === 'function' ? tpl.solution(game.task.x, game) : tpl.solution;
      await LA.runItems(game.console, sol, game);
      await game.console.settle();
    }
    expect('session: five tasks solved', game.state.stats.solved >= 5, plain(view.out).slice(-2000));
    expect('session: XP and a streak', game.state.xp > 0 && game.state.streak >= 5, JSON.stringify(game.state));
    expect('session: the first badge', game.state.badges.includes('first') && game.state.badges.includes('streak5'));
    await LA.runItems(game.console, ['hint', 'hint', 'hint', 'hint', 'hint'], game);
    expect('session: hints counted', game.state.stats.hints >= 1);
    const before = game.state.task.id + game.state.task.seed;
    await LA.runItems(game.console, ['skip'], game);
    expect('session: skip deals a new task and resets the streak', game.state.task.id + game.state.task.seed !== before && game.state.streak === 0);
    await LA.runItems(game.console, ['topic archive'], game);
    expect('session: topic changes the task', game.task.tpl.topic === 'archive', game.task.tpl.id);
    await LA.runItems(game.console, ['progress', 'notebook', 'help', 'task', 'level 2'], game);
    expect('session: level 2', game.task.tpl.level === 2 && game.task.tpl.topic === 'archive');
    /* resume from the save */
    const v2 = new LA.HeadlessView();
    const g2 = new LA.PracticeGame(v2, storage, 'practice');
    expect('session: loads', g2.load());
    await g2.resume();
    expect('session: resumes on the same task', g2.task && g2.task.tpl.id === game.task.tpl.id && JSON.stringify(g2.task.x) === JSON.stringify(game.task.x), plain(v2.out));
  }

}
main().catch((e) => { console.error(e); process.exit(1); });
