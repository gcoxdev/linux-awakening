#!/usr/bin/env node
/* Plays Linux Awakening from start to finish, headlessly, using each step's
   solution lines, and fails loudly if any step's check does not pass.
   Usage: node test/walkthrough.js [--story ID] [--distro debian|fedora|arch|opensuse] [--verbose] [--noise] [--dump FILE] */
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
const storyArg = process.argv.indexOf('--story');
const storyId = storyArg > 0 ? process.argv[storyArg + 1] : 'rootfall';
const distroArg = process.argv.indexOf('--distro');
LA.distroId = distroArg > 0 ? process.argv[distroArg + 1] : 'debian';
if (!LA.DISTROS[LA.distroId]) { console.error(`unknown distro ${LA.distroId}`); process.exit(1); }
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
  let game = new LA.Game(view, storage, storyId);
  const pack = game.pack;
  game.newGame('kit');
  await game.start();
  const t0 = Date.now();
  let steps = 0;
  let reloaded = false;
  /* every command the player runs, anywhere in the story (including inside their scripts). A non-zero exit still
     counts — «diff» and «cmp» exit 1 when files differ — but not "command not found" or "permission denied" */
  const used = new Set();
  const ALIAS = { '[': 'test', '[[': 'test', htop: 'top' };
  const track = (g) => {
    const orig = g.afterLine.bind(g);
    g.afterLine = function (evt) { for (const r of evt.recs) if (r.status !== 126 && r.status !== 127) used.add(ALIAS[r.name] || r.name); return orig(evt); };
    /* ssh exits with the remote shell's last status, so count the connection itself */
    const onSsh = g.onSsh.bind(g);
    g.onSsh = (...a) => { used.add('ssh'); return onSsh(...a); };
    const spawn = g.world.spawn.bind(g.world);
    g.world.spawn = (o) => { if (o.job && o.comm) used.add(o.comm); return spawn(o); };
  };
  track(game);
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
      const data = JSON.parse(storage.get(game.saveKey));
      const g2 = new LA.Game(view, storage, storyId);
      g2.loadFrom(data);
      game = g2;
      track(game);
      await game.resume();
      if (verbose) console.log('  ↻ save/load round-trip OK (' + (JSON.stringify(data).length / 1024).toFixed(0) + ' KB)');
    }
  }
  const s = game.state;
  const dumpIdx = process.argv.indexOf('--dump');
  if (dumpIdx > 0) fs.writeFileSync(process.argv[dumpIdx + 1], LA.util.stripAnsi(view.out));
  const items = Object.keys(pack.collect.items).length;
  if (game.distroId !== LA.distroId || game.world.distro !== LA.distroId) { console.error(`✗ the game is running ${game.world.distro}, not ${LA.distroId}`); process.exit(1); }
  console.log(`\n✓ ${pack.title} (${LA.distro(LA.distroId).label}): completed all ${pack.chapters.length} chapters, ${steps} steps in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`  ${pack.collect.label.toLowerCase()} ${s.memories.length}/${items} · secrets ${s.secrets.length}/${Object.keys(game.secrets).length} · commands ${s.stats.commands}`);
  const taught = new Set(pack.chapters.flatMap((c) => c.unlocks).map((c) => game.cmdLabel(c)));
  console.log(`  commands in the notebook: ${taught.size}`);
  /* the boot screen's title must be drawable: every letter needs a glyph in the banner font */
  require(path.join(root, 'js/ui/render.js'));
  const undrawable = [...(pack.boot.banner || []).join('')].filter((ch) => ch !== ' ' && !LA.banner(ch).trim());
  if (undrawable.length) { console.error(`✗ the title banner has no glyph for: ${[...new Set(undrawable)].join(' ')}`); process.exit(1); }
  const unused = [...taught].filter((c) => !used.has(c));
  if (unused.length) { console.error(`✗ in the notebook but never used in a step: ${unused.join(' ')}`); process.exit(1); }
  console.log(`  every notebook command is used in the story`);
  if (s.memories.length < items) { console.error(`✗ expected all ${items} ${pack.collect.label.toLowerCase()} to be found by the walkthrough`); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(1); });
