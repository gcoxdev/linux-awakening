# Linux Awakening

Interactive stories that teach the Linux command line. Each story runs on its own simulated Linux machine, and every command you type really happens there: files appear, processes die, services restart, logs grow. You learn the shell by needing it.

Open the app and choose a story:

| | **Rootfall** | **Night Train** |
|---|---|---|
| Premise | You wake in a hospital with no memory, in a city whose streets are directories. Someone made the city forget. | First night as the systems engineer on a sleeper train. A priceless atlas vanishes from the safe, your mentor vanishes with it, and the border is four hours away. |
| Pace | Gentle, with thorough lessons | Fast, more hands-on |
| Chapters · steps | 13 · 181 | 14 · 157 |
| Commands in the notebook | 90 | 121 |
| Collectibles | 9 memories, 19 secrets | 13 pieces of evidence, 14 secrets |

Both cover the same ground, from `pwd` to pipelines, permissions, processes, systemd and cron, disks, archives, shell scripts, SSH and user accounts. **Every command that appears in a story's notebook is used in at least one required step**, and the test suite enforces that. Other commands still work if you type them; they just aren't drilled.

There is also the **Practice Range**: no story, just an endless supply of practical tasks (over 200 task types across 14 topics, about 125 commands, randomised for every attempt). See [Practice Range](#practice-range) below.

## Choose your Linux

Most of the command line is the same on every distribution: Bash, GNU coreutils, systemd, `ip`, `ssh`, `tar`, permissions. What differs is mostly packaging and a few defaults. The front page asks which family you use or want to learn, and builds every machine that way. Debian/Ubuntu is the default.

| | Debian / Ubuntu | Fedora / RHEL | Arch Linux | openSUSE |
|---|---|---|---|---|
| Package manager | `apt`, `apt-cache`, `dpkg` | `dnf` (`yum`), `rpm` | `pacman` | `zypper`, `rpm` |
| Install | `sudo apt update` → `sudo apt install htop` | `sudo dnf install htop` (asks `[y/N]`) | `sudo pacman -Syu` → `sudo pacman -S htop` | `sudo zypper refresh` → `sudo zypper in htop` |
| Which package owns a file | `dpkg -S` | `rpm -qf` | `pacman -Qo` | `rpm -qf` |
| Admins' group | `sudo` (gid 27) | `wheel` (gid 10) | `wheel` (gid 998) | `wheel` |
| Default prompt | `you@host:~$` | `[you@host ~]$` | `[you@host ~]$` | `you@host:~>` |
| System log | `/var/log/syslog`, `auth.log` | journal; RHEL also `/var/log/messages`, `secure` | journal only | journal only |
| Crontabs | `/var/spool/cron/crontabs/` | `/var/spool/cron/` | `/var/spool/cron/` | `/var/spool/cron/tabs/` |

Each machine has only its own distro's package tools. Typing another distro's (say `apt` on Arch) gives `command not found`, plus a pointer to the right tool. The package names follow each distro (`dnsutils` vs `bind-utils` vs `bind`, for example), and so do `/etc/os-release`, the repository files (`sources.list`, `yum.repos.d`, `pacman.conf`/`mirrorlist`, `zypp/repos.d`), the cron and ssh unit names, and the package log.

In the stories, the package-manager steps (Rootfall's fail2ban, Night Train's htop), the admin-group steps and all the narration follow your distro. Each story's notebook lists your distro's tool in place of `apt`. The story machines keep Debian-style `/var/log/syslog` and `auth.log` files on every distro, because the plots revolve around them. The step that first opens the system log says where those messages live on your distro instead (the journal on Fedora, Arch and openSUSE). The Practice Range has no plot to protect, so its machines are faithful: on Arch and openSUSE there is no syslog file at all.

A saved game keeps the distro it was started on. To switch, start over after choosing another distro, or link straight to one with `?distro=arch` (or `fedora`, `opensuse`, `debian`).

**Scope:** macOS and the BSDs differ in more than packaging, and aren't simulated. On openSUSE, sudo is set up the way the installer does it when root has no password: members of `wheel` give their own password.

## Running it

There is no build step and nothing to install. Open `index.html` in a modern browser, or serve the folder:

```bash
python3 -m http.server 8000      # then visit http://localhost:8000
```

The front page lists the stories; `index.html?story=rootfall`, `?story=nighttrain` or `?story=practice` goes straight to one (add `&distro=arch` to pick the distro too). Progress saves automatically to `localStorage`, separately for each story. The side panel lets you replay any chapter you've reached, change the text speed and font size, toggle the CRT effect, turn on free play (every command unlocked), or go back to the list of stories.

## Playing

- Type commands at the prompt and press **Enter**. The current goal is always shown in the terminal and in the side panel.
- `hint` asks your companion (Tux in Rootfall, June in Night Train) for a nudge. Typing it again gives a more specific hint. `goal` repeats the objective, `story` replays the scene, `progress` shows your chapters, collectibles and secrets, and `notebook` lists every command you've learned.
- `man <command>` works for every command. Click any command in the notebook to open its manual.
- Keys: ↑/↓ for history, **Tab** for completion (press it twice to list options), **Ctrl+R** for reverse search, **Ctrl+C** to cancel, **Ctrl+D** to end input or exit a shell, **Ctrl+L** to clear, and **Ctrl+A/E/U/K** for line editing.
- Commands from later chapters aren't available yet; trying one tells you which chapter brings it.

## Practice Range

Each task asks for something useful, such as "which IP made the most requests?", "make this key private", "schedule this script for Mondays at 06:00", "unpack this release and point `current` at it", or "kill whatever is eating the CPU". You do it any way you like. The task is checked after every command, against the machine's state and what actually appeared on screen, so `echo 42` doesn't count as an answer. The machine is rebuilt for every task, and file contents, names and numbers are randomised, so a task is never quite the same twice. Your command history carries over between tasks.

- **Topics:** getting around, files and folders, finding things, text processing, pipes and redirection, permissions and users, processes, services/cron/disks, archives and checksums, shell scripting, networking, software and packages, your shell (env, aliases, PATH), and getting help.
- **Your distro:** the package tasks (install, remove, search, query, which package owns a file, list its files, upgrade, repositories, `os-release`, granting admin rights) use whichever package manager your distro has. A few tasks exist on only one family: `apt-cache policy`, `dnf provides`, `pacman -Qe`, and zypper's short forms.
- **Difficulty:** ★ single commands, up to ★★★★ "boss" tasks that take several steps (an incident, a deploy, an off-site backup, an intruder account). Difficulty rises automatically with your rank; you can also pin it.
- **Scoring:** XP per task (10/20/35/60 by difficulty). Each hint costs 20% (down to a floor of 30%), and a streak of tasks solved without seeing the answer adds up to +50%. Ranks run from Intern to Greybeard. There are 24 badges, and every command in the notebook shows how well you've mastered it (unused, used, practised, mastered).
- **Controls:** `task` shows the task again, `hint` gives a hint (the last one is the answer and forfeits the XP), `skip` deals a different task (ends the streak), `solution` shows an answer, `topic [name]` picks a topic, `level 1-4|auto` sets the difficulty, and `progress` shows your stats. The side panel has the same controls.

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

## Curriculum

### Night Train

| # | Chapter | Commands & concepts |
|---|---------|---------------------|
| 1 | The Missing Engineer | `pwd ls cd cat whoami hostname clear`, absolute and relative paths, `.` `..` `~`, hidden files |
| 2 | Reading the Train | `date tree head tail wc man less apropos whatis file`, log rotation |
| 3 | The Case File | `mkdir -p cp mv touch echo nano rm rmdir`, `>` vs `>>`, globs, quoting names with spaces |
| 4 | Needles | `grep (-i -c -o) find (-name -newer) locate sort uniq which whereis`, the first pipe |
| 5 | Cross-Reference | `column cut awk tr tee tac paste xargs`, stdin/stdout/stderr, `<`, `2>/dev/null` |
| 6 | Locked Doors | `ls -l`, `id groups sudo stat chmod chown chgrp umask su passwd` |
| 7 | Ghost in the Shell | `history env export printenv unset alias type unalias source bash ln -s readlink last who w`, `.profile` and `.bashrc` |
| 8 | Signs of Life | `uptime top ps pgrep kill killall`, `&`, `sleep jobs fg` |
| 9 | The Mail Van | `systemctl journalctl pkill crontab watch`, `sudo tee` vs `sudo … >`, `free uname`, your distro's package manager |
| 10 | The Black Box | `lsblk dmesg mount -o ro df du sha256sum -c cmp diff md5sum`, `cp -r` |
| 11 | Frames | `tar (t/x/z/f/-C) strings base64 zcat gunzip gzip -k zip unzip umount` |
| 12 | Clockwork | exit status and `$?`, scripts: shebang, `$1`, `if [ ]`, `for`, `$( )`, `seq printf bc basename dirname realpath read test`, telling "none" from "couldn't read" |
| 13 | Out of the Tunnel | `ip a/r ping dig host curl wget ssh scp ss`, routes, checking a host key against a trusted list |
| 14 | Kessel Junction | `w`, preserving evidence before deletion, `pkill -u`, `usermod -L userdel -r`, `/etc/group`, `awk` with patterns and `END`, `sed` (preview, `-i`, `/re/d`), revoking a stolen key, `nl`; finale: fingerprint, package, deliver and verify the case with no commands given |

### Rootfall

| # | Chapter | Place | Commands & concepts |
|---|---------|-------|---------------------|
| 1 | Wake | St. Inode's Hospital | `pwd ls cd cat whoami`, absolute vs relative paths, `.` and `..` |
| 2 | Streets of Rootfall | Library & Chronicle | `ls -l/-a/-h`, `man less head tail file tree echo date`, quoting |
| 3 | The Night Market | `/tmp` | `mkdir (-p) touch cp (-r) mv rm (-r) rmdir nano`, `>` vs `>>`, globs, `/tmp` vs `/var/tmp` |
| 4 | City Hall | `/etc` | `grep (-i -n -r -v -c) find (-name -type) wc sort uniq which type`, `/etc/passwd` |
| 5 | Rivers of Text | `/var/log` | pipes, stdin/stdout/stderr, `2>/dev/null`, `<`, `cut awk tr tee rev xargs`, `sort | uniq -c | sort -rn` |
| 6 | Locks & Keys | `/home` | permission bits, `chmod` (symbolic & octal), `chown chgrp id stat sudo passwd` |
| 7 | Home | `~` | `history`, `!!`, env vars, `$PATH`, `export env alias unalias source`, `.bashrc`, `ln -s`, `who` |
| 8 | The Power Station | `/proc` | `ps top kill` + signals, `pgrep pkill killall`, `& jobs fg sleep`, `uptime free df du uname` |
| 9 | The Clockworks | systemd & cron | `systemctl journalctl crontab`, user crontabs and `/etc/sudoers.d`, `lsblk mount -o ro` |
| 10 | The Undercroft | `/mnt/backup` | `sha256sum -c tar gzip gunzip zcat unzip base64 umount`, reading logs for evidence |
| 11 | Spellwork | `~/scripts` | `&& || ;`, exit status, shebang, `$1`, `for while if [ ]`, `$( )`, `$(( ))`, `seq test`, your own command on `PATH`, `diff` |
| 12 | The Lighthouse | another machine | `ip ping dig ss curl wget ssh scp`, your distro's package manager, host key fingerprints, SSH keys |
| 13 | Root | the Spire | `sed (s///, -i, -e)`, `/etc/group` and the `sudo`/`wheel` group, `find -user/-nouser/-delete`, `userdel -r`, `sudo -i` |

## How it works

All of this runs client-side in plain JavaScript, with no dependencies and no build.

- **`js/core/`**: the simulation engine, which has no DOM code.
  - `vfs.js` is a filesystem with real Unix semantics: owner/group/other permission bits, the sticky bit, symlinks, hard links, mounts (read-only mounts refuse every write, even root's), and an immutable flag.
  - `parse.js` is a bash tokenizer and recursive-descent parser: quoting, heredocs, redirections, `| && || ; &`, `if/for/while/until/case`, functions, subshells, `[[ ]]` and aliases.
  - `shell.js` handles expansion and execution: variables and `${...}` operators, `$(...)`, `$((...))`, brace expansion, globbing, tilde, field splitting, redirections including `2>&1`, pipelines, job control, functions, scripts with shebangs, and `$PATH` lookup that respects permissions.
  - `console.js` routes input between nested shells (`ssh`, `sudo -i`, `su`, `bash`), password prompts and stdin reads. New shells read their startup files like bash does: login shells `~/.profile`, other interactive shells `~/.bashrc`, scripts neither.
- **`js/cmd/`**: about 190 commands, each a small reimplementation that aims to match GNU behaviour, output format and error messages. It includes a working `sed`, a real `awk` interpreter, `find` with `-exec`, and LCS-based `diff`. `pkg.js` holds the package managers: apt, apt-cache and dpkg; dnf/yum and rpm; pacman; and zypper. They share one package database per machine and each speaks its own dialect.
- **`js/world/`**: the machine underneath any story. `world.js` simulates processes, signals, systemd services and restart policies, mounts, packages, the network and `/proc`. `base.js` builds an ordinary Debian-like system — accounts, the directory skeleton, `/usr/bin`, `/dev`, the usual `/etc` files and daemons — for a story to furnish. `distros.js` describes the four distro families: package tools and names, admin group, prompt, os-release, log paths, cron spool, unit names and repository files. It also expands the `{pm}`, `{admin}` and `{pkg:install htop}` tokens that story text uses.
- **`js/story/engine.js`**: steps, checks, hints, unlocks, collectibles and secrets, save/load, and chapter replay. It knows nothing about any particular story.
- **`js/stories/<id>/`**: one folder per story. `pack.js` registers the story with `LA.defineStory()` and gives its voice: title, cast colours, boot screen, secrets, collectibles, hint companion, and its own wording for engine messages. `world.js` builds its machine (and any other hosts). `chNN.js` are the chapters. In Rootfall, chapter order comes from each chapter's `n` rather than the file name: `ch11.js` is chapter 10 and `ch10.js` is chapter 11.
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

## Tests

```bash
npm test                                             # everything below
node test/walkthrough.js [--story nighttrain] -v     # plays a whole story headlessly from each step's solution
node test/walkthrough.js [--story nighttrain] --noise  # same, with wrong/irrelevant commands typed before every step
node test/commands.js -v                             # ~117 shell-behaviour checks against real-bash expectations + Rootfall's secrets
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

The practice suite builds every task on several random machines. It checks that a stray `ls` doesn't solve a task, that the reference solution does, and that XP is awarded. It also checks that every command either story teaches is practised by some task, and plays a session with hints, skips, topic and level changes, and a save and resume.

Night Train's suite also checks that no log on the train mentions an event later than the moment the story starts, and that the evidence finally delivered to the police contains the whole case.

They then check that the ending tells the truth about what was found.
