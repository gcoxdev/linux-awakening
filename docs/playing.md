# Playing guide

[Back to the README](../README.md) · [Chapter curriculum](curriculum.md)

## Playing

- Type commands at the prompt and press **Enter**. The current goal is always shown in the terminal and in the side panel.
- `hint` asks your companion (Tux in Rootfall, June in Night Train) for a nudge. Typing it again gives a more specific hint. `goal` repeats the objective, `story` replays the scene, `progress` shows your chapters, collectibles and secrets, and `notebook` lists every command you've learned.
- `man <command>` works for every command. Click any command in the notebook to open its manual.
- Keys: ↑/↓ for history, **Tab** for completion (press it twice to list options), **Ctrl+R** for reverse search, **Ctrl+C** to cancel, **Ctrl+D** to end input or exit a shell, **Ctrl+L** to clear, and **Ctrl+A/E/U/K** for line editing.
- Commands from later chapters aren't available yet; trying one tells you which chapter brings it.

## Practice Range

Each task asks for something useful, such as "which IP made the most requests?", "make this key private", "schedule this script for Mondays at 06:00", "restore the two files that were deleted without losing today's edit", or "stop only the worker on the reports queue". You do it any way you like, unless the task names a method (a loop, a heredoc, one command). The check looks at the result: the copy really holds every file, the checksum really is the file's hash, the cron job really points at the script, and an answer counts only if a command worked it out (`echo 42` doesn't). Scripts are also tried with other input in a copy of the machine. Each task gets a fresh machine with randomized names, contents and numbers. Some tasks vary a lot (different files, owners, edge cases); others are the same exercise with different values. Your command history carries over between tasks.

- **Topics:** getting around, files and folders, finding things, text processing, pipes and redirection, permissions and users, processes, services/cron/disks, archives and checksums, shell scripting, networking, software and packages, your shell (env, aliases, PATH), and getting help. `task list [word]` shows the whole library, and `task ID` starts any task.
- **The awkward cases:** names that start with `-` or contain spaces, hidden files, broken symlinks, deleting exactly the right set, stdout vs stderr, `set -e`, scripts that must handle missing or spaced arguments, directory traversal permissions, setgid team folders, picking one of two identical-looking processes, and a stale `locate` database. For each of these, the obvious-but-wrong route doesn't pass.
- **Your distro:** the package tasks (install, remove, search, query, which package owns a file, list its files, upgrade, repositories, `os-release`, granting admin rights) use whichever package manager your distro has. A few tasks exist on only one family: `apt-cache policy`, `dnf provides`, `pacman -Qe`, and zypper's short forms. Each distro keeps its own practice profile.
- **Difficulty:** ★ single commands, up to ★★★★ boss tasks that take several steps (an incident, a deploy, an off-site backup, a restore, a team folder, an intruder account). In a multi-step task, results that must hold (the release is unpacked, the link works) are rechecked every time and can come undone; things you did (you listed the archive) stay done. On "auto", harder levels open per topic as you solve easier tasks there yourself; `level N` pins a level the topic actually has.
- **Scoring:** XP per task (10/20/35/60 by difficulty), plus up to +50% for a streak of tasks solved without seeing the answer. Hints are free. Seeing the full answer means that task earns no XP, ends the streak, and brings the task back later with new data. There are seven ranks, from Intern to Graybeard, and 25 badges.
- **Mastery:** the notebook counts the commands you actually ran in the lines that solved a task, not the task's labels or incidental commands. "Tried" means you used a command (even with the answer shown). "Practiced" means three unaided uses. "Mastered" means six unaided uses across at least three different tasks.
- **Controls:** `task`, `hint`, `check` (what's done and what's missing), `solution`, `skip`, `next`, `retry` (same machine again), `variant` (same task, new data), `topic`, `level`, `progress`, `notebook`, and `next auto` to skip the pause after solving. The side panel has Next, Hint, Skip, Check, Retry and Answer buttons, a difficulty picker, the topic list and a notebook filter. `task` also prints the task ID and seed, so a check that seems wrong can be reproduced.
- **Saving:** your progress and the attempt in progress (files, finished parts, your shell) are saved, so you can close the tab mid-task.

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
