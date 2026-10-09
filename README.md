# Linux Awakening

An interactive story that teaches the Linux command line. You wake up in a hospital in **Rootfall**, a city that *is* a Linux filesystem. You don't remember who you are, and you get your memory back the same way you'd learn a shell: one command at a time.

You start with `pwd`. By the end you're reading logs with pipelines, fixing configs with `sed`, finding UID-0 accounts with `awk`, killing processes, managing systemd services and cron, mounting disks, unpacking archives, and SSHing into another machine. That's **131 commands across 13 chapters and 168 guided steps**.

## Running it

There is no build step and nothing to install. Open `index.html` in a modern browser.

You can also serve it locally:

```bash
python3 -m http.server 8000      # then visit http://localhost:8000
```

Progress saves automatically to `localStorage`. The panel lets you replay any chapter you've already reached, change the text speed and font size, toggle the CRT effect, or turn on free play, which unlocks every command.

## Playing

- Type commands at the prompt and press **Enter**. The current goal is always shown in the terminal and in the side panel.
- `hint` asks Tux (your penguin) for a nudge. Typing it again gives a more specific hint. `goal` repeats the objective, `story` replays the scene, `progress` shows your chapters, memories and secrets, and `notebook` lists every command you've learned.
- `man <command>` works for every command. Click any command in the Notebook to open its manual.
- Keys: ↑/↓ for history, **Tab** for completion (press it twice to list options), **Ctrl+R** for reverse search, **Ctrl+C** to cancel, **Ctrl+D** to end input or exit a shell, **Ctrl+L** to clear, and **Ctrl+A/E/U/K** for line editing.
- Commands from later chapters are "on the tip of your tongue": they tell you which chapter unlocks them.
- There are 9 memories and 19 secrets to find. The memories are scattered through the city. The secrets reward curiosity: hidden dotfiles, classic Unix jokes, and a few other surprises.

## Curriculum

| # | Chapter | Place | Commands & concepts |
|---|---------|-------|---------------------|
| 1 | Wake | St. Inode's Hospital | `pwd ls cd cat whoami clear`, absolute vs relative paths, `.` and `..` |
| 2 | Streets of Rootfall | Library & Chronicle | `ls -l/-a/-h`, `man less more head tail file tree echo date cal whatis apropos`, quoting |
| 3 | The Night Market | `/tmp` | `mkdir (-p) touch cp (-r) mv rm (-r) rmdir nano`, `>` vs `>>`, globs `* ? []`, `/tmp` vs `/var/tmp` |
| 4 | City Hall | `/etc` | `grep (-i -n -r -v -c) find (-name -type) wc sort uniq which type whereis locate`, `/etc/passwd` |
| 5 | Rivers of Text | `/var/log` | pipes, stdin/stdout/stderr, `2>/dev/null`, `<`, `cut tr tee rev tac paste column xargs`, `sort | uniq -c | sort -rn` |
| 6 | Locks & Keys | `/home` | permission bits, `chmod` (symbolic & octal), `chown chgrp id groups stat umask sudo su passwd` |
| 7 | Home | `~` | `history`, `!!`, env vars, `$PATH`, `export unset env printenv alias unalias source`, `.bashrc`, `type`, `ln -s`, `who w last` |
| 8 | The Power Station | `/proc` | `ps (aux) top kill` + signals, `pgrep pkill killall`, `& jobs fg bg sleep nohup`, `uptime free df du uname` |
| 9 | The Clockworks | systemd & cron | `systemctl` (status/start/stop/enable/disable), `journalctl`, `crontab` syntax, `lsblk mount umount dmesg watch` |
| 10 | Spellwork | `~/scripts` | `&& || ;`, exit status, shebang, `chmod +x`, `./`, `$1 $#`, `for while if [ ]`, `$( )`, `$(( ))`, `seq read test expr bc printf basename dirname realpath`, `PATH` |
| 11 | The Undercroft | `/mnt/backup` | `sha256sum -c md5sum tar (c/x/t/z/v/f/-C) gzip gunzip zcat zip unzip base64` |
| 12 | The Lighthouse | another machine | `ip ifconfig ping dig host nslookup ss netstat curl wget ssh scp apt`, SSH keys and `authorized_keys` |
| 13 | Root | the Spire | `diff (-u) cmp sed (s///, -i, /re/d) awk (-F, fields, END) nl`, `find -user -delete/-exec`, `userdel usermod`, UID 0 |

## How it works

All of this runs client-side in plain JavaScript, with no dependencies and no build.

- **`js/core/`**: the simulation engine, which has no DOM code.
  - `vfs.js` is a filesystem with real Unix semantics. It has owner/group/other permission bits, the sticky bit, symlinks, hard links, mounts, and an immutable flag.
  - `parse.js` is a bash tokenizer and recursive-descent parser. It handles quoting, heredocs, redirections, `| && || ; &`, `if/for/while/until/case`, functions, subshells, `[[ ]]` and aliases.
  - `shell.js` handles expansion and execution: variables and `${...}` operators, `$(...)`, `$((...))`, brace expansion, globbing, tilde, field splitting, redirections including `2>&1`, pipelines, job control, functions, scripts with shebangs, and `$PATH` lookup that respects permissions.
  - `console.js` routes input between nested shells (`ssh`, `sudo -i`, `su`), password prompts and stdin reads.
- **`js/cmd/`**: about 185 commands, each a small reimplementation that aims to match GNU behavior, output format and error messages. It includes a working `sed`, a real `awk` interpreter (patterns, arrays, user functions, printf), `find` with `-exec`, and LCS-based `diff`.
- **`js/world/`**: the city itself. `content.js` builds every file, log, user, process, service, socket and DNS record, including a second host (the Lighthouse) for `ssh`/`scp`. `world.js` simulates processes, signals, systemd restart policies, mounts, packages and `/proc`.
- **`js/story/`**: `engine.js` handles steps, checks, hints, unlocks, memories and secrets, save/load, and chapter replay. `ch01.js` to `ch13.js` contain the narrative.
- **`js/ui/`**: the browser terminal with typewriter narration, the `less`/`man` pager, `nano`, a modal `vim`, a live `top`, and the side panel.

### Story step format

```js
{
  say:   'narration shown when the step begins (supports @Speaker: lines, «code», :::lesson / :::art blocks)',
  goal:  'one-line objective',
  hints: ['gentle', 'more specific', 'the exact command'],
  check: (e) => e.cwd === '/tmp' && !!e.ran('ls', (r) => e.has(r, 'l')),   // checked after every command
  done:  'narration on success',
  solve: ['cd /tmp', 'ls -l'],   // the reference solution (used by tests and chapter replay)
  setup: (game) => { /* optional world changes when the step starts */ },
}
```

Checks inspect the world's state and what actually ran, not the literal text the player typed. Any reasonable way to reach the goal counts.

## Tests

```bash
npm test                              # both suites below
node test/walkthrough.js --verbose    # plays the whole game headlessly using each step's solution
node test/walkthrough.js --noise      # same, but with wrong/irrelevant commands typed before every step
node test/commands.js -v              # ~117 shell-behaviour checks against real-bash expectations + all 19 secrets
```

The walkthrough runs all 168 steps in about a second. It also does a save → load round-trip partway through.
