#!/usr/bin/env node
/* Distros: the same machine built as Debian, Fedora, Arch and openSUSE. Each must have its own package
   manager (and not the others'), its admin group, prompt, os-release and cron spool; the package tools
   must install, remove, query and refuse like the real ones; and a save must come back as the same distro.
   Usage: node test/distros.js [--verbose] */
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
let failures = 0, passed = 0;
function expect(label, ok, detail) {
  if (ok) { passed++; if (verbose) console.log('✓ ' + label); return; }
  failures++;
  console.error('✗ ' + label + (detail ? '\n  ' + String(detail).slice(-1500).replace(/\n/g, '\n  ') : ''));
}

function memStorage() {
  const m = new Map();
  return { get: (k) => m.get(k) || null, set: (k, v) => m.set(k, v), remove: (k) => m.delete(k) };
}

/* a Rootfall game in free play, so every command is unlocked */
async function machine(distro, storage) {
  LA.distroId = distro;
  const view = new LA.HeadlessView();
  const game = new LA.Game(view, storage || null, 'rootfall');
  game.newGame('kit');
  game.silent = true;
  await game.start();
  game.silent = false;
  game.setFreeplay(true);
  await game.console.main.ready;
  const run = async (...items) => { view.out = ''; await LA.runItems(game.console, items, game); return plain(view.out); };
  return { game, view, run };
}

const EXPECT = {
  debian: { pm: 'apt', others: ['dnf', 'pacman', 'zypper', 'rpm'], admin: 'sudo', like: 'debian', prompt: /kit@rootfall:\S+\$ $/, dig: 'dnsutils', spool: '/var/spool/cron/crontabs' },
  fedora: { pm: 'dnf', others: ['apt', 'pacman', 'zypper', 'dpkg'], admin: 'wheel', like: 'fedora', prompt: /^\[kit@rootfall [^\]]+\]\$ $/, dig: 'bind-utils', spool: '/var/spool/cron' },
  arch: { pm: 'pacman', others: ['apt', 'dnf', 'zypper', 'rpm', 'dpkg'], admin: 'wheel', like: 'arch', prompt: /^\[kit@rootfall [^\]]+\]\$ $/, dig: 'bind', spool: '/var/spool/cron' },
  opensuse: { pm: 'zypper', others: ['apt', 'dnf', 'pacman', 'dpkg'], admin: 'wheel', like: 'opensuse suse', prompt: /kit@rootfall:\S+> $/, dig: 'bind-utils', spool: '/var/spool/cron/tabs' },
};

async function main() {
  for (const d of LA.DISTRO_ORDER) {
    const X = EXPECT[d];
    const D = LA.distro(d);
    const { game, run } = await machine(d);
    const w = game.world;
    expect(`${d}: world and game agree`, w.distro === d && game.state.distro === d && game.distroId === d);
    expect(`${d}: its package manager is installed`, !!w.main.fs.tryGet('/usr/bin/' + X.pm));
    for (const o of X.others) {
      expect(`${d}: ${o} is not installed`, !w.main.fs.tryGet('/usr/bin/' + o));
      const out = await run(`${o} --version`);
      expect(`${d}: «${o}» says command not found and names ${D.pm}`, /command not found/.test(out) && (out.includes(D.pm + ' ') || out.includes(D.lowPm + ' ')), out);
    }
    let out = await run('cat /etc/os-release');
    expect(`${d}: os-release ID_LIKE`, out.includes(`ID_LIKE="${X.like}`), out);
    out = await run(`grep '^${X.admin}:' /etc/group`);
    expect(`${d}: the player is in ${X.admin}`, new RegExp(`^${X.admin}:x:${D.adminGid}:.*kit`, 'm').test(out), out);
    expect(`${d}: no stray admin group`, !w.main.users.groups[X.admin === 'sudo' ? 'wheel' : 'sudo']);
    out = await run('sudo grep % /etc/sudoers', '$PW');
    expect(`${d}: sudoers names ${X.admin}`, out.includes(`%${X.admin}`), out);
    expect(`${d}: prompt style`, X.prompt.test(plain(game.console.main.promptString())), game.console.main.promptString());
    out = await run('crontab -l');
    expect(`${d}: crontab lives in ${X.spool}`, !!w.main.fs.tryGet(`${X.spool}/kit`) && /\* \* \*/.test(out), out);
    out = await run(`echo '5 4 * * * /bin/true' | crontab -`, 'crontab -l');
    expect(`${d}: crontab - installs into the spool`, /5 4 \* \* \*/.test(w.main.fs.contentOf(w.main.fs.get(`${X.spool}/kit`))), out);
    out = await run('uname -a', 'cat /proc/version');
    expect(`${d}: /proc/version names the distro's compiler`, out.includes(D.gcc), out);

    /* the package manager, end to end */
    out = await run(game.fmt('{pkg:install cowsay}').replace(/^sudo /, ''));
    expect(`${d}: installing without root is refused`, !w.packages.installed.includes('cowsay') && /root|superuser|lock|Permission/i.test(out), out);
    if (d !== 'debian') {
      out = await run(game.fmt('{pkg:install cowsay}'), '$PW', { answer: 'n' });
      expect(`${d}: answering no aborts the install`, !w.packages.installed.includes('cowsay'), out);
    }
    out = await run(game.fmt('{pkg:install cowsay}'), '$PW', { answer: 'y' });
    expect(`${d}: install`, w.packages.installed.includes('cowsay') && !!w.main.fs.tryGet(d === 'debian' ? '/usr/games/cowsay' : '/usr/bin/cowsay'), out);
    out = await run('cowsay moo');
    expect(`${d}: the installed program runs`, /moo/.test(out) && !/not found/.test(out), out);
    out = await run(game.fmt('{pkg:install nosuchpkg}'), '$PW', { answer: 'y' });
    expect(`${d}: an unknown package is an error`, /not found|Unable to locate|No match/i.test(out), out);
    out = await run(game.fmt('{pkg:query cowsay}'));
    expect(`${d}: query an installed package`, /cowsay/.test(out) && !/not installed|not found/.test(out), out);
    out = await run(game.fmt('{pkg:query sl}'));
    expect(`${d}: query a missing package`, /not installed|not found|no packages/i.test(out), out);
    out = await run(game.fmt('{pkg:owner /usr/bin/dig}'));
    expect(`${d}: who owns /usr/bin/dig`, out.includes(X.dig), out);
    out = await run(game.fmt('{pkg:files nano}'));
    expect(`${d}: list a package's files`, out.includes('/usr/bin/nano'), out);
    out = await run(game.fmt('{pkg:search fortune}'));
    expect(`${d}: search`, out.includes(LA.pkgName('fortune-mod', d)), out);
    out = await run(game.fmt('{pkg:info htop}'));
    expect(`${d}: info`, /htop/.test(out) && /3\.2\.2/.test(out), out);
    out = await run(game.fmt('{pkg:list}'));
    expect(`${d}: list installed`, /cowsay/.test(out) && /bash/.test(out), out);
    out = await run(game.fmt('{pkg:refresh}'), '$PW', game.fmt('{pkg:upgrade}'), '$PW', { answer: 'y' });
    expect(`${d}: refresh and upgrade`, !!w.pkgUpgraded && !/error|Invalid/i.test(out), out);
    out = await run(game.fmt('{pkg:remove cowsay}'), '$PW', { answer: 'y' });
    expect(`${d}: remove`, !w.packages.installed.includes('cowsay') && !w.main.fs.tryGet('/usr/bin/cowsay') && !w.main.fs.tryGet('/usr/games/cowsay'), out);
    out = await run(game.fmt('{pkg:remove bash}'), '$PW', { answer: 'y' });
    expect(`${d}: an essential package can't be removed`, w.packages.installed.includes('bash'), out);
    out = await run(game.fmt('{pkg:repos}'));
    expect(`${d}: repository configuration`, /mirror\.lighthouse\.rootfall|repo-oss|fedora/.test(out), out);

    /* the cow: «cowsay» (installed above) finds it everywhere; apt and zypper also moo; pacman loves candy */
    expect(`${d}: the moo secret is reachable`, game.state.secrets.includes('moo') && Object.keys(game.secrets).length === Object.keys(game.pack.secrets).length);
    if (d === 'arch') {
      await run('sudo bash -c "echo ILoveCandy >> /etc/pacman.conf"', '$PW');
      out = await run('sudo pacman -S --noconfirm sl', '$PW');
      expect('arch: ILoveCandy outside [options] does nothing', !/C\] 100%/.test(out), out);
      await run("sudo sed -i 's/^#Color/Color\\nILoveCandy/' /etc/pacman.conf", '$PW');
      out = await run('sudo pacman -S --noconfirm sl', '$PW');
      expect('arch: ILoveCandy in [options] turns the progress bars into Pac-Man', /C\] 100%/.test(out), out);
    } else if (d !== 'fedora') {
      out = await run(`${D.pm} moo`);
      expect(`${d}: ${D.pm} moo`, /\(oo\)/.test(out), out);
    }

    /* distro-specific story text */
    expect(`${d}: story tokens`, game.fmt('{pm} {admin} {pkg:install htop}') === `${D.pm} ${D.admin} ${D.pkg.install('htop')}`);
    const NT = (await machine(d)).game;
    void NT;
  }

  /* a save comes back as the same distro, whatever the menu now says; chapter replay rebuilds it too */
  const storage = memStorage();
  const { game } = await machine('arch', storage);
  game.save();
  LA.distroId = 'debian';
  const g2 = new LA.Game(new LA.HeadlessView(), storage, 'rootfall');
  expect('a saved Arch game loads', g2.load());
  expect('…as Arch', g2.world.distro === 'arch' && g2.distroId === 'arch' && LA.distroId === 'arch');
  await g2.jumpTo(2);
  expect('…and chapter replay rebuilds Arch', g2.world.distro === 'arch' && !!g2.world.main.fs.tryGet('/usr/bin/pacman') && !g2.world.main.fs.tryGet('/usr/bin/apt'));

  /* the Practice Range keeps its distro across tasks and saves */
  LA.distroId = 'fedora';
  const pst = memStorage();
  const pg = new LA.PracticeGame(new LA.HeadlessView(), pst, 'practice');
  pg.newGame('kit');
  await pg.start();
  await pg.nextTask('pkg-install');
  expect('practice: a Fedora range', pg.world.distro === 'fedora' && pg.state.distro === 'fedora');
  const sol = pg.task.tpl.solution(pg.task.x, pg);
  await LA.runItems(pg.console, sol, pg);
  expect('practice: the package task is solved with dnf', pg.state.stats.solved === 1 && pg.world.distro === 'fedora', plain(pg.view.out).slice(-800));
  /* each distro has its own practice profile */
  LA.distroId = 'debian';
  expect('practice: the Debian profile is separate', !new LA.PracticeGame(new LA.HeadlessView(), pst, 'practice').load());
  LA.distroId = 'fedora';
  const pg2 = new LA.PracticeGame(new LA.HeadlessView(), pst, 'practice');
  expect('practice: the Fedora profile loads', pg2.load());
  expect('practice: still Fedora after loading', pg2.world.distro === 'fedora' && pg2.state.stats.solved === 1);
  expect('practice: Fedora has dnf-provides but not apt-policy', P_has(pg2, 'dnf-provides') && !P_has(pg2, 'apt-policy'));

  console.log(failures ? `\n${failures} distro check(s) failed (${passed} passed)` : `distros: ${passed} checks passed across ${LA.DISTRO_ORDER.join(', ')}`);
  process.exit(failures ? 1 : 0);
}
function P_has(g, id) { return LA.practice.tasksFor(g.distroId).some((t) => t.id === id); }
main().catch((e) => { console.error(e); process.exit(1); });
