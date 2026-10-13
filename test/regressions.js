#!/usr/bin/env node
/* Regression scenarios from the story assessment. Plays the story headlessly,
   skipping the optional memory reads, and at selected steps forks the game
   (via save/load) to try a mistake or a shortcut that must NOT be accepted —
   or a repair that must be.
   Usage: node test/regressions.js [--verbose] */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !s.includes('/ui/') && !s.endsWith('main.js'));
for (const s of scripts) require(path.join(root, s));
const LA = globalThis.LA;
LA.timeScale = 0.001;

const verbose = process.argv.includes('--verbose');
const plain = (s) => LA.util.stripAnsi(s).replace(/[«»]/g, '');
let failures = 0;
function expect(label, ok, detail) {
  if (ok) { if (verbose) console.log('✓ ' + label); return; }
  failures++;
  console.error('✗ ' + label + (detail ? '\n  ' + String(detail).slice(-1500).replace(/\n/g, '\n  ') : ''));
}

/* fork the game through a save/load round trip and try some commands on the copy */
async function fork(game, { reconnect = true } = {}) {
  const view = new LA.HeadlessView();
  const copy = new LA.Game(view);
  LA.game = game; // world events go to LA.game; keep them on the main run
  copy.loadFrom(JSON.parse(JSON.stringify(game.serialize())));
  if (reconnect && copy.droppedRemote) { await copy.console.submit(`ssh ${copy.droppedRemote.user}@${copy.droppedRemote.host}`); copy.droppedRemote = null; }
  view.out = '';
  const pos = () => `${copy.state.ch}:${copy.state.step}`;
  const before = pos();
  return {
    game: copy, view,
    async run(items) {
      LA.game = copy;
      try { await LA.runItems(copy.console, items, copy); } finally { LA.game = game; }
      return { advanced: pos() !== before, out: plain(view.out) };
    },
  };
}

const at = (game, n, goal) => game.curChapter().n === n && plain(game.fmt(game.curStep().goal)).includes(goal);

async function main() {
  const view = new LA.HeadlessView();
  const game = new LA.Game(view);
  game.newGame('kit');
  await game.start();
  const seen = new Set();
  const once = (k) => (seen.has(k) ? false : seen.add(k));

  while (!game.state.done) {
    const ch = game.curChapter(), step = game.curStep();

    if (at(game, 2, 'latest news') && once('tail')) {
      const f = await fork(game);
      const r = await f.run(['tail -n 0 syslog']);
      expect('ch2: «tail -n 0 syslog» prints nothing and does not reveal Lethe', !r.advanced, r.out);
    }
    if (at(game, 4, 'Search the whole city') && once('find')) {
      const f = await fork(game);
      const r = await f.run(["find /does-not-exist -name 'memory_*'"]);
      expect('ch4: a find in a nonexistent directory does not reveal the memories', !r.advanced, r.out);
    }
    if (at(game, 6, 'Make the diary yours') && once('bea')) {
      // the real run reads Bea's card early, so the finale must handle it
      const before = view.out.length;
      await LA.runItems(game.console, ['sudo cat /root/bea_card.txt', '$PW'], game);
      const out = plain(view.out.slice(before));
      expect('early Bea card read recovers memory 09', game.state.memories.includes('memory_09'), out);
      expect('early Bea card read gives only a partial flashback', /come back properly/.test(out) && !/The last thing you see is Tux/.test(out), out);
      expect('early Bea card read does not advance the step', game.curStep() === step, out);
    }
    if (at(game, 8, '') && once('nodisk')) {
      const f = await fork(game);
      f.game.setFreeplay(true);
      const r = await f.run(['ls /dev/sdb1', 'lsblk']);
      expect('ch8: the Undercroft disk is not attached before Juno brings it', /No such file/.test(r.out) && !/sdb/.test(r.out.split('lsblk').pop()), r.out);
    }
    if (at(game, 9, 'read-only') && once('rwmount')) {
      const f = await fork(game);
      const r = await f.run(['sudo mount /dev/sdb1 /mnt/backup', '$PW']);
      expect('ch9: a read-write mount of the evidence disk does not count', !r.advanced, r.out);
    }
    if (at(game, 9, 'Find the rule') && once('sudoers')) {
      expect('ch9: the crontab job relies on a planted passwordless sudo rule', /NOPASSWD: \/usr\/bin\/systemctl start lethe/.test(game.fs.contentOf(game.fs.get('/etc/sudoers.d/90-lethe-watchdog'))) && /sudo -n/.test(game.fs.contentOf(game.fs.get('/var/spool/cron/crontabs/hollow'))));
    }
    if (at(game, 10, 'Practice on a small file') && once('zcat')) {
      const f = await fork(game);
      const r = await f.run(['gzip /var/tmp/evidence.txt', 'gunzip /var/tmp/evidence.txt.gz']);
      expect('ch10: compressing and decompressing without looking inside (no zcat) does not count', !r.advanced, r.out);
    }
    if (at(game, 11, 'Count down') && once('loop')) {
      const f = await fork(game);
      const r = await f.run(["echo 'while $(( ))'"]);
      expect('ch11: quoting the words of a loop is not running one', !r.advanced, r.out);
    }
    if (at(game, 12, 'Strip hollow') && once('keys')) {
      const f = await fork(game);
      const r = await f.run(['head -n 1 ~/.ssh/authorized_keys > keys.tmp && mv keys.tmp ~/.ssh/authorized_keys']);
      expect('ch12: removing trusted keys along with hollow\'s is not a clean removal', !r.advanced && /trusts/.test(r.out), r.out);
    }
    if (at(game, 7, 'Create the alias') && once('rmrf')) {
      const f = await fork(game);
      const r = await f.run(['sudo rm -rf /*', '$PW', 'rm -rf ~']);
      const intact = ['/etc/lethe/lethe.conf', '/etc/passwd', f.game.home + '/diary.txt', '/usr/share/doc'].every((p) => f.game.fs.tryGet(p));
      expect('ch7: «sudo rm -rf /*» and «rm -rf ~» are stopped before anything is deleted', intact && /Tux plants himself/.test(r.out), r.out);
      expect('ch7: Hollow\'s plan does not exist before the last chapter', !f.game.fs.tryGet('/var/.hollow/plan.txt'));
    }
    if (ch.id === 'root' && game.state.step === 0 && once('plan')) {
      expect('ch13: Hollow\'s plan is in his nest when the last chapter starts', !!game.fs.tryGet('/var/.hollow/plan.txt'));
    }
    if (at(game, 7, 'Create the alias') && once('poison')) {
      const f = await fork(game);
      await f.run(["grep -v 'nothing to remember' ~/.bashrc > ~/bashrc.tmp && mv ~/bashrc.tmp ~/.bashrc"]);
      const r = await f.run(["alias ll='ls -la'", 'll', `echo "alias ll='ls -la'" >> ~/.bashrc`, 'source ~/.bashrc']);
      const goal = plain(f.game.fmt(f.game.curStep().goal));
      expect('ch7: removing the poisoned alias early skips the cat/type steps', !/Read a file|what cat really is/.test(goal) && /is clean/.test(r.out), goal + '\n' + r.out);
    }
    if (ch.id === 'spellwork' && plain(step.goal).includes('Finish the loop') && once('capstone')) {
      const f = await fork(game);
      const r = await f.run(['cat /var/tmp/camp/memories/fragments/*.mem > ~/restored.txt']);
      expect('ch11: concatenating the fragments by hand does not complete the scripting capstone', !r.advanced, r.out);
      expect('ch11: …and Mara explains why', /still has its TODOs/.test(r.out), r.out);
    }
    if (ch.id === 'lighthouse' && plain(step.goal).includes('Strip hollow') && once('keys')) {
      const f = await fork(game);
      const lfs = f.game.world.hosts.lighthouse.fs;
      const keys = () => lfs.contentOf(lfs.get('/home/wren/.ssh/authorized_keys'));
      let r = await f.run(['grep -v hollow ~/.ssh/authorized_keys > ~/.ssh/authorized_keys']);
      expect('ch12: redirecting authorized_keys into itself empties it and does not advance', !r.advanced && keys().trim() === '', r.out);
      expect('ch12: the nudge points to the keys.trusted repair', /keys\.trusted/.test(r.out), r.out);
      r = await f.run(['cp ~/keys.trusted ~/.ssh/authorized_keys']);
      expect('ch12: restoring from keys.trusted completes the step', r.advanced && !keys().includes('hollow') && keys().includes('ssh-ed25519'), r.out);

      const g = await fork(game, { reconnect: false });
      expect('ch12: a save made on the Lighthouse loads back on rootfall', g.game.console.active.host.name === 'rootfall');
      LA.game = g.game; await g.game.resume(); LA.game = game;
      const out = plain(g.view.out);
      expect('ch12: resuming explains the dropped connection and how to reconnect', /dropped while you were away/.test(out) && /ssh wren@lighthouse/.test(out), out);
    }

    // play on, leaving out the optional memory reads
    const items = (step.solve || []).filter((x) => typeof x !== 'string' || !/^cat .*memory_0[1-4]\.txt$/.test(x));
    await LA.runItems(game.console, items, game);
    if (!game.state.done && game.curStep() === step) {
      console.error(`✗ stuck at ch${ch.n} «${plain(step.goal)}»\n` + plain(view.out).slice(-2000));
      process.exit(1);
    }
  }

  const out = plain(view.out);
  const n = game.state.memories.length;
  expect('finished with optional memories missing', n < 9, n);
  expect('the ending does not claim nine memories when fewer were found', !/Nine memories\. All of them yours again/.test(out) && new RegExp(`${n} of nine memories`).test(out), out.slice(-3000));
  expect('the certificate reports the real memory count', out.includes(`Memories recovered: ${n}/9`));
  expect('the finale gives the full flashback to a Bea card read early', /read these words before/.test(out) && /The last thing you see is Tux/.test(out));
  expect('all hollow-owned files are gone at the end', ![...game.fs.iterate('/', 'root', { skip: (x) => x === '/proc' })].some(([p, nd]) => nd.owner === 'hollow' && !p.startsWith('/proc')));

  {
    const f = await fork(game, { reconnect: false });
    LA.game = f.game; await f.game.jumpTo(5); LA.game = game;
    expect('replaying a chapter does not award memories the player never found', f.game.state.memories.length === n, f.game.state.memories.join(','));
  }

  if (failures) { console.error(`\n✗ ${failures} regression check(s) failed`); process.exit(1); }
  console.log(`✓ All regression scenarios passed (memories ${n}/9 without the optional reads)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
