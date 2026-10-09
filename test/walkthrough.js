#!/usr/bin/env node
/* Plays Linux Awakening from start to finish, headlessly, using each step's
   solution lines, and fails loudly if any step's check does not pass.
   Usage: node test/walkthrough.js [--verbose] [--from N] */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !s.includes('/ui/') && !s.endsWith('main.js'));
for (const s of scripts) require(path.join(root, s));
const LA = globalThis.LA;

const verbose = process.argv.includes('--verbose');
const noise = process.argv.includes('--noise');
LA.timeScale = 0.001;

function memStorage() {
  const m = new Map();
  return { get: (k) => m.get(k) || null, set: (k, v) => m.set(k, v), remove: (k) => m.delete(k) };
}

async function main() {
  const storage = memStorage();
  const view = new LA.HeadlessView();
  view.write = function (s) { this.out += s; };
  if (process.argv.includes('--dump')) view.narrate = function (m) { this.out += '\n' + m.split('\n').map((l) => '§ ' + l).join('\n') + '\n'; return Promise.resolve(); };
  let game = new LA.Game(view, storage);
  game.newGame('kit');
  await game.start();
  const t0 = Date.now();
  let steps = 0;
  let reloaded = false;
  while (!game.state.done) {
    const ch = game.curChapter();
    const step = game.curStep();
    const key = `ch${ch.n} step ${game.state.step + 1}/${ch.steps.length}`;
    const before = view.out.length;
    if (noise) {
      const NOISE = ['hint', 'goal', 'help', 'head nofile.txt', 'nosuchcmd', 'progress', 'cd..', 'story', 'notebook', 'xyzzy', 'ls /nonexistent', 'gerp', 'cd /nowhere', 'man nosuchpage', 'pet tux'];
      for (let k = 0; k < 3; k++) await game.console.submit(NOISE[Math.floor(Math.random() * NOISE.length)]);
      if (game.curStep() !== step) { console.error(`✗ noise completed ${key} by accident`); process.exit(1); }
    }
    await LA.runItems(game.console, step.solve || [], game);
    if (game.curChapter() === ch && game.curStep() === step && !game.state.done) {
      console.error(`\n✗ FAILED at ${key}: ${step.goal}`);
      console.error('--- output since step start ---');
      console.error(view.out.slice(before).slice(-3000));
      process.exit(1);
    }
    steps++;
    if (verbose) console.log(`✓ ${key}  ${LA.util.stripAnsi(game.fmt(step.goal)).replace(/[«»]/g, '')}`);
    // halfway through, prove that save/load works and the game can continue
    if (!reloaded && ch.n === 7 && game.state.step === 3) {
      reloaded = true;
      const data = JSON.parse(storage.get('linux-awakening-save'));
      const g2 = new LA.Game(view, storage);
      g2.loadFrom(data);
      game = g2;
      await game.resume();
      if (verbose) console.log('  ↻ save/load round-trip OK (' + (JSON.stringify(data).length / 1024).toFixed(0) + ' KB)');
    }
  }
  const s = game.state;
  const dumpIdx = process.argv.indexOf('--dump');
  if (dumpIdx > 0) fs.writeFileSync(process.argv[dumpIdx + 1], LA.util.stripAnsi(view.out));
  console.log(`\n✓ Completed all ${LA.story.chapters.length} chapters, ${steps} steps in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`  memories ${s.memories.length}/9 · secrets ${s.secrets.length}/${Object.keys(LA.SECRETS).length} · commands ${s.stats.commands}`);
  const taught = new Set(LA.story.chapters.flatMap((c) => c.unlocks));
  console.log(`  commands taught: ${taught.size}`);
  if (s.memories.length < 9) { console.error('✗ expected all 9 memories to be recovered by the walkthrough'); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(1); });
