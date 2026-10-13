# Development guide

[Back to the README](../README.md)

## How it works

All of this runs client-side in plain JavaScript, with no dependencies and no build.

- **`js/core/`**: the simulation engine, which has no DOM code.
  - `vfs.js` is a filesystem with real Unix semantics: owner/group/other permission bits, the sticky bit, symlinks, hard links, mounts (read-only mounts refuse every write, even root's), and an immutable flag.
  - `parse.js` is a bash tokenizer and recursive-descent parser: quoting, heredocs, redirections, `| && || ; &`, `if/for/while/until/case`, functions, subshells, `[[ ]]` and aliases.
  - `shell.js` handles expansion and execution: variables and `${...}` operators, `$(...)`, `$((...))`, brace expansion, globbing, tilde, field splitting, redirections including `2>&1`, pipelines, job control, functions, scripts with shebangs, and `$PATH` lookup that respects permissions.
  - `console.js` routes input between nested shells (`ssh`, `sudo -i`, `su`, `bash`), password prompts and stdin reads. New shells read their startup files like bash does: login shells `~/.profile`, other interactive shells `~/.bashrc`, scripts neither.
- **`js/cmd/`**: about 190 commands, each a small reimplementation that aims to match GNU behavior, output format and error messages. It includes a working `sed`, a real `awk` interpreter, `find` with `-exec`, and LCS-based `diff`. `pkg.js` holds the package managers: apt, apt-cache and dpkg; dnf/yum and rpm; pacman; and zypper. They share one package database per machine and each speaks its own dialect.
- **`js/world/`**: the machine underneath any story. `world.js` simulates processes, signals, systemd services and restart policies, mounts, packages, the network and `/proc`. `base.js` builds an ordinary Debian-like system — accounts, the directory skeleton, `/usr/bin`, `/dev`, the usual `/etc` files and daemons — for a story to furnish. `distros.js` describes the four distro families: package tools and names, admin group, prompt, os-release, log paths, cron spool, unit names and repository files. It also expands the `{pm}`, `{admin}` and `{pkg:install htop}` tokens that story text uses.
- **`js/story/engine.js`**: steps, checks, hints, unlocks, collectibles and secrets, save/load, and chapter replay. It knows nothing about any particular story.
- **`js/stories/<id>/`**: one folder per story. `pack.js` registers the story with `LA.defineStory()` and gives its voice: title, cast colors, boot screen, secrets, collectibles, hint companion, and its own wording for engine messages. `world.js` builds its machine (and any other hosts). `chNN.js` are the chapters. In Rootfall, chapter order comes from each chapter's `n` rather than the file name: `ch11.js` is chapter 10 and `ch10.js` is chapter 11.
- **`js/ui/`**: the browser terminal with typewriter narration, the `less`/`man` pager, `nano`, a modal `vim`, a live `top`, and the side panel. **`js/main.js`** is the story menu and boot sequence.

### Adding a story

Make `js/stories/<id>/` with a `pack.js` (`LA.defineStory('<id>', { title, tagline, blurb, hostname, startCwd, startClock, … })`), a `world.js` that sets `pack.buildWorld` (usually starting from `LA.baseSystem`) and `pack.worldStatic`, and chapters that call `pack.add({...})`. Add the script tags to `index.html`; the menu picks the story up automatically. Night Train is the cleanest example to copy.

### Story step format

```js
{
  say:      'narration shown when the step begins (supports @Speaker: lines, «code», :::lesson / :::art blocks)',
  goal:     'one-line objective',
  hints:    ['gentle', 'more specific', 'the exact command'],
  check:    (e) => e.cwd === '/tmp' && !!e.ran('ls', (r) => e.has(r, 'l')),   // checked after every command
  done:     'narration on success',
  solve:    ['cd /tmp', 'ls -l'],   // the reference solution (used by tests and chapter replay)
  setup:    (game) => { /* optional world changes when the step starts */ },
  skip:     (game) => false,        // optional: skip the step if the player already did it another way
  nudge:    (e) => null,            // optional: a comment on a near-miss, shown without advancing
  evidence: 'id',                   // optional: a collectible this step reveals
}
```

Checks inspect the world's state and what actually ran, not the literal text the player typed. Any reasonable way to reach the goal counts.

## Adding a practice task

Tasks live in `js/stories/practice/tasks-*.js`:


```js
T({ id: 'perm-600', topic: 'perms', level: 1, cmds: ['chmod'], title: 'A private key',
  setup(t) { t.file('~/.ssh/deploy_key', '...', { mode: 0o644 }); },   // t: seeded random + helpers to furnish the machine
  prompt: 'SSH refuses to use «~/.ssh/deploy_key» ...',
  check: (e) => e.mode('~/.ssh/deploy_key') === 0o600,                 // or parts: [{ text, check }, ...]
  hints: ['In octal: owner rw = 6, group 0, others 0.'],
  solution: ['chmod 600 ~/.ssh/deploy_key'],
  why: 'optional tip shown after solving' });
```

## Tests

```bash
npm test                                             # everything below
node test/walkthrough.js [--story nighttrain] -v     # plays a whole story headlessly from each step's solution
node test/walkthrough.js [--story nighttrain] --noise  # same, with wrong/irrelevant commands typed before every step
node test/commands.js -v                             # ~117 shell-behavior checks against real-bash expectations + Rootfall's secrets
node test/regressions.js --verbose                   # Rootfall: mistakes that must not be accepted, repairs that must
node test/nighttrain.js --verbose                    # Night Train: the same, plus every secret
node test/practice.js [--only ID] [--seeds N] [--distro all]  # Practice Range: every task on N random machines
node test/distros.js -v                              # each distro: its package tools (and not the others'), admin group, prompt, os-release, cron spool, saves
```

Both walkthroughs also take `--distro fedora|arch|opensuse`. `npm test` plays both stories on all four distros and runs the practice suite on each.

The walkthrough also round-trips a save partway through, and fails if any command in the story's notebook is never used in a step, or if the boot banner uses a letter the banner font can't draw.

The scenario suites replay each story without its optional collectibles. At chosen steps they fork the game through save/load and try things a real player might. Examples:
- an empty `tail`, or a `find` in a directory that doesn't exist;
- `>` where `>>` was meant;
- `sudo echo OPEN > door` instead of `echo OPEN | sudo tee door`;
- `crontab -r` instead of `crontab -e`;
- emptying a file with a self-redirect, then repairing it;
- saving and loading while logged in to another machine;
- empty or wrong work that used to pass: `head -n 0`, an empty `touch`ed "copy", `chgrp` without `-R`, a read-write mount of evidence, a symlink to the wrong place, quoted text instead of a loop, `gzip`/`gunzip` without `zcat`, and a key cleanup that deletes trusted keys;
- `fg` after a reload has dropped the background job; killing a child process instead of a session;
- a read-only mount written to by root (before and after a reload), a changed SSH host key, a browser that can't save;
- replaying a chapter, which must not award collectibles the player never found.

The practice suite builds every task on several random machines, on every distro, and for players with different names. It checks that a stray `ls` doesn't solve a task, that the reference answer does, and that the answer as shown to the learner includes every step (editor text, prompt answers, Ctrl+C). It runs about thirty common wrong attempts that must fail: an empty `.gz`, a deleted source, fake checksums, a cron job pointing nowhere, the right lines in the wrong order, a hard-coded script, a symlink to a deleted release, a glob that skips dotfiles, `xargs` splitting names at spaces. It also runs legitimate alternative routes that must pass. Further checks cover mastery credit and assisted completions, hints that warn before the answer, generator edge cases (a remainder of 0, name collisions), and a session with next, skip, retry, variant, topics, levels and a mid-task resume.

Night Train's suite also checks that no log on the train mentions an event later than the moment the story starts, and that the evidence finally delivered to the police contains the whole case.

They then check that the ending tells the truth about what was found.
