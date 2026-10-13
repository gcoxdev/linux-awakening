# Chapter curriculum

[Back to the README](../README.md) · [Playing guide](playing.md)

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
