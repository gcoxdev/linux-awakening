#!/usr/bin/env node
/* Night Train: mistakes that must not be accepted, repairs that must, the network staying dark
   until the tunnel, an ending that tells the truth about missing evidence — and every secret.
   Plays the story headlessly without the optional evidence reads, and at chosen steps forks the
   game through save/load to try things on the copy.
   Usage: node test/nighttrain.js [--verbose] */
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

async function fork(game) {
  const view = new LA.HeadlessView();
  const copy = new LA.Game(view);
  LA.game = game;
  copy.loadFrom(JSON.parse(JSON.stringify(game.serialize())));
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
const OPTIONAL = /smoke\.log|lost_property/;

async function main() {
  const view = new LA.HeadlessView();
  const game = new LA.Game(view, null, 'nighttrain');
  game.newGame('kit');
  await game.start();
  const seen = new Set();
  const once = (k) => (seen.has(k) ? false : seen.add(k));

  /* nothing on the server records an event later than the moment the story starts */
  {
    const T = game.pack.nightClock(game.world.flags.night);
    const now = LA.now();
    const late = [];
    for (const f of ['/var/log/meridian/doors.log', '/var/log/meridian/doors.log.1', '/var/log/meridian/cctv.log', '/var/log/meridian/recorder.log', '/var/log/meridian/SHA256SUMS']) {
      for (const line of (game.fs.contentOf(game.fs.get(f)) || '').split('\n')) {
        const m = line.match(/^(\d\d):(\d\d):(\d\d)/);
        if (m && T(+m[1], +m[2], +m[3]) > now) late.push(f + ': ' + line);
      }
    }
    for (const f of ['/var/log/syslog', '/var/log/auth.log']) {
      for (const line of game.fs.contentOf(game.fs.get(f)).split('\n')) {
        const m = line.match(/^(\w{3}) +(\d+) (\d\d):(\d\d):(\d\d)/);
        if (!m) continue;
        const t = new Date(`${m[1]} ${m[2]} ${new Date(now).getFullYear()} ${m[3]}:${m[4]}:${m[5]}`).getTime();
        if (t > now + 1000) late.push(f + ': ' + line);
      }
    }
    expect('ch1: no log mentions an event after the story has started', !late.length, late.join('\n'));
    const snaps = [...game.world.devices.unplugged_recorder.children.get('snapshots').children.keys()].sort();
    expect('the recorder holds every 15-minute snapshot up to its collection', game.pack.SNAPSHOTS.every((x) => snaps.includes(x)), snaps.join(' '));
  }

  while (!game.state.done) {
    if (at(game, 2, 'first 5 lines') && once('head0')) {
      const f = await fork(game);
      const r = await f.run(['head -n 0 /srv/meridian/manifest/passengers.csv']);
      expect('ch2: «head -n 0» shows nothing and does not advance', !r.advanced, r.out);
    }
    if (at(game, 3, 'Copy the old door log') && once('touch')) {
      const f = await fork(game);
      const r = await f.run(['touch ~/case/evidence/doors.log.1']);
      expect('ch3: an empty file is not a copy of the log', !r.advanced && /empty/.test(r.out), r.out);
    }
    if (at(game, 6, 'Hand the case to the crew') && once('chgrp')) {
      const f = await fork(game);
      const r = await f.run(['chgrp crew ~/case']);
      expect('ch6: «chgrp» without «-R» leaves the files behind and does not advance', !r.advanced && /-R/.test(r.out), r.out);
    }
    if (at(game, 7, 'shortcut to the logs') && once('ln')) {
      const f = await fork(game);
      const r = await f.run(['ln -s /var/log ~/logs', 'readlink ~/logs']);
      expect('ch7: a link to the wrong place does not count', !r.advanced, r.out);
    }
    if (at(game, 8, 'Bring your sleep back') && once('fgreload')) {
      const f = await fork(game); // a reload: background jobs don't survive it
      const r = await f.run(['fg']);
      expect('ch8: «fg» with no job (after a reload) does not count, and says how to recover', !r.advanced && /sleep 1234 &/.test(r.out), r.out);
      const r2 = await f.run(['sleep 1234 &', { nowait: 'fg' }, { ctrlc: true }]);
      expect('ch8: starting the job again and foregrounding it does', r2.advanced, r2.out);
    }
    if (at(game, 9, 'Watch the stills count') && once('watch')) {
      const f = await fork(game);
      const r = await f.run(['watch']);
      expect('ch9: a bare «watch» (usage error) does not count', !r.advanced, r.out);
    }
    if (at(game, 10, 'Mount it read-only') && once('ro')) {
      const f = await fork(game);
      const r = await f.run(['sudo mount /dev/sdb1 /mnt/recorder', '$PW']);
      expect('ch10: a read-write mount does not count', !r.advanced && /read-\*write\*|read-write/.test(r.out), r.out);
      const g2 = await fork(game);
      await g2.run(['sudo mount -o ro /dev/sdb1 /mnt/recorder', '$PW']);
      const w = await g2.run(['echo changed | sudo tee /mnt/recorder/README.TXT', '$PW', 'sudo rm /mnt/recorder/README.TXT', 'sudo touch /mnt/recorder/new']);
      expect('ch10: a read-only mount refuses writes, even from root', /Read-only file system/.test(w.out) && /LOCOMOTIVE EVENT RECORDER/.test(g2.game.world.devices.sdb1.children.get('README.TXT').content), w.out);
      const g3 = await fork(g2.game);
      const w2 = await g3.run(['sudo touch /mnt/recorder/new2', '$PW']);
      expect('ch10: …and still does after a save and reload', /Read-only file system/.test(w2.out), w2.out);
      const c = await g3.run(['cp /mnt/recorder/README.TXT /tmp/']);
      expect('ch10: copying evidence off a read-only mount still works', !!g3.game.fs.tryGet('/tmp/README.TXT'), c.out);
    }
    if (at(game, 13, 'Check Kessel') && once('hostkey')) {
      const f = await fork(game);
      await f.run(['ssh {user}@kessel', { answer: 'yes' }, 'exit']);
      const kh = f.game.fs.get(f.game.home + '/.ssh/known_hosts');
      kh.content = kh.content.replace(/AAAAC3NzaC1lZDI1NTE5AAAAI\S+/, 'AAAAC3NzaC1lZDI1NTE5AAAAIsomethingelse');
      const r = await f.run(['ssh {user}@kessel']);
      expect('ch13: a changed host key is refused with a warning', /REMOTE HOST IDENTIFICATION HAS CHANGED/.test(r.out) && f.game.console.active.host.name === 'meridian', r.out);
    }
    if (at(game, 14, 'Throw him out') && once('child')) {
      const f = await fork(game);
      await f.run(['sudo kill 3102', '$PW']);
      expect('ch14: killing a child process does not end his whole session', f.game.world.sessions.some((x) => x.user === 'maint'));
    }
    if (at(game, 14, 'Fingerprint every file') && once('manifest')) {
      const f = await fork(game);
      const r = await f.run(['cd ~/case', 'find . -type f -exec sha256sum {} + > SHA256SUMS']);
      expect('ch14: a manifest that fingerprints itself is not accepted', !r.advanced && /fingerprinted itself/.test(r.out), r.out);
    }
    if (at(game, 2, 'latest door events') && once('radio')) {
      const f = await fork(game);
      f.game.setFreeplay(true);
      const r = await f.run(['ping -c 2 kessel', 'curl http://auction.isolde/']);
      expect('ch2: the outside world is unreachable before the tunnel', /Unreachable|No route|Could not resolve|unreachable/i.test(r.out) && !/bytes from/.test(r.out), r.out);
      const r2 = await f.run(['ls /dev/sdb1']);
      expect('ch2: the recorder is not plugged in yet', /No such file/.test(r2.out), r2.out);
    }
    if (at(game, 3, 'Append') && once('clobber')) {
      const f = await fork(game);
      const r = await f.run(['echo "23:52 Vesna enters the staff car." > ~/case/timeline.txt']);
      expect('ch3: «>» instead of «>>» does not advance, and June notices', !r.advanced && /That was one arrow/.test(r.out), r.out);
    }
    if (at(game, 6, 'Lock down your case folder') && once('chmod')) {
      const f = await fork(game);
      const r = await f.run(['chmod 777 ~/case']);
      expect('ch6: the wrong mode is not accepted', !r.advanced, r.out);
    }
    if (at(game, 9, 'Start the door controller') && once('hold')) {
      const f = await fork(game);
      await f.run(['sudo systemctl enable --now doord', '$PW']);
      expect('ch9: hold.sh stops doord again while it is alive', !f.game.world.services.doord.active);
    }
    if (at(game, 9, 'Release the mail van') && once('door')) {
      const f = await fork(game);
      const r1 = await f.run(['echo OPEN > /srv/meridian/cars/car8_mail/door']);
      expect('ch9: «echo OPEN > door» is refused and does not free Vesna', !r1.advanced && /Permission denied/.test(r1.out), r1.out);
      const r2 = await f.run(['sudo echo OPEN > /srv/meridian/cars/car8_mail/door', '$PW']);
      expect('ch9: «sudo echo OPEN > door» is refused too, and the nudge explains why', !r2.advanced && /before sudo/.test(r2.out), r2.out);
      const r3 = await f.run(['sudo systemctl stop doord', '$PW', 'echo OPEN | sudo tee /srv/meridian/cars/car8_mail/door', '$PW']);
      expect('ch9: an OPEN written while doord is down does not count', !r3.advanced && /nothing is listening/.test(r3.out), r3.out);
    }
    if (at(game, 9, 'Remove the 02:55 job') && once('cron')) {
      const f = await fork(game);
      const r = await f.run(['sudo crontab -r', '$PW']);
      expect('ch9: «crontab -r» wipes the recorder sync too, and is not accepted', !r.advanced && /recorder sync/.test(r.out), r.out);
    }
    if (at(game, 13, 'Read the police note') && once('remote')) {
      const f = await fork(game);
      expect('ch13: a save made on kessel loads back on meridian', f.game.console.active.host.name === 'meridian');
      const r = await f.run([]);
      void r;
      const v = new LA.HeadlessView();
      f.game.view = v; f.game.console.view = v;
      LA.game = f.game; await f.game.resume(); LA.game = game;
      expect('ch13: resuming explains the dropped connection', /dropped while you were away/.test(plain(v.out)), plain(v.out));
    }
    if (at(game, 14, 'Throw him out') && once('userdel')) {
      const f = await fork(game);
      const r = await f.run(['sudo userdel -r maint', '$PW']);
      expect('ch14: userdel refuses while he is still logged in', /currently used by process/.test(r.out) && f.game.world.main.users.exists('maint'), r.out);
    }
    const step = game.curStep();
    const items = (step.solve || []).filter((x) => typeof x !== 'string' || !OPTIONAL.test(x));
    await LA.runItems(game.console, items, game);
    if (!game.state.done && game.curStep() === step) { console.error('✗ stuck at ' + game.curChapter().n + ' ' + step.goal); process.exit(1); }
  }
  /* the access he used is closed, and what the police hold is the whole case */
  expect('the stolen laptop key is revoked', !/vesna-laptop/.test(game.fs.contentOf(game.fs.get('/home/vesna/.ssh/authorized_keys'))));
  const inbox = game.world.hosts.kessel.fs.tryGet('/srv/police/inbox/evidence.zip');
  const names = inbox ? inbox.data.entries.map((x) => x.path) : [];
  expect('the final packet on kessel holds the report, both timelines, his checklist and the manifest', ['case/report.txt', 'case/timeline_0201.txt', 'case/timeline_0417.txt', 'case/evidence/tidy.sh', 'case/evidence/maint_auth.txt', 'case/SHA256SUMS'].every((n) => names.includes(n)), names.join(' '));
  const missed = Object.keys(game.pack.collect.items).filter((k) => !game.state.memories.includes(k));
  expect('finished without the optional evidence', missed.length === 2 && missed.includes('alibi') && missed.includes('coat'), missed.join(','));
  const end = plain(view.out.slice(-6000));
  expect('the ending admits to the missing evidence', /2 more pieces of evidence you never found/.test(end) && /smoke detector/.test(end), end);
  expect('the commendation reports the real count', /Evidence found: 11\/13/.test(end), end);

  /* replaying a chapter must not award the optional evidence this player never found */
  {
    const f = await fork(game);
    LA.game = f.game; await f.game.jumpTo(9); LA.game = game;
    expect('replay keeps only earned evidence (no free alibi or coat)', !f.game.state.memories.includes('alibi') && !f.game.state.memories.includes('coat') && f.game.state.memories.includes('sack'), f.game.state.memories.join(','));
  }
  /* a browser that can't save says so */
  {
    const v = new LA.HeadlessView();
    const toasts = [];
    v.toast = (t) => toasts.push(t);
    const g = new LA.Game(v, { get: () => null, set: () => false, remove() {} }, 'nighttrain');
    g.newGame('kit'); g.save(); g.save();
    expect('a failed save is reported once, and remembered', g.saveOk === false && toasts.length === 1 && /could not be saved/.test(toasts[0]), toasts.join(' | '));
  }

  /* every secret, in free play after the end */
  const run = async (cmd) => { await LA.runItems(game.console, [cmd, '$PW'], game); };
  game.world.flags.radio = true;
  game.pack.worldStatic(game.world);
  for (const c of [
    'sudo apt install sl fortune-mod neofetch', 'sl', 'fortune', 'neofetch', 'apt moo',
    'cd /srv/meridian/cars/.car9 && cat manifest.txt; cd ~', 'cat /srv/meridian/cars/car3_dining/.stew',
    'echo "Thank you, Rosa. - kit" >> /srv/meridian/cars/car4_lounge/guestbook.txt', 'whistle', 'vim /tmp/v.txt',
    'sudo rm -rf /', ':(){ :|:& };:', 'sudo make me a sandwich', 'dig TXT meridian.rail', 'curl http://auction.isolde/robots.txt; curl http://auction.isolde/staff/',
  ]) await run(c);
  const missing = Object.keys(game.pack.secrets).filter((k) => !game.state.secrets.includes(k));
  expect(`all ${Object.keys(game.pack.secrets).length} secrets can be found`, !missing.length, 'missing: ' + missing.join(', '));
  expect('the train survived «sudo rm -rf /»', !!game.fs.tryGet('/srv/meridian/manifest/mail.csv'));

  if (failures) { console.error(`\n✗ ${failures} Night Train check(s) failed`); process.exit(1); }
  console.log('✓ Night Train scenarios passed (evidence 11/13 without the optional reads, all secrets reachable)');
}

main().catch((e) => { console.error(e); process.exit(1); });
