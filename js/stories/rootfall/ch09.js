/* Chapter 9 — The Clockworks (systemctl, journalctl, crontab, lsblk, mount) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;

  LA.story.add({
    n: 9, id: 'clockworks', title: 'The Clockworks', place: '/etc/systemd & /var/spool/cron', clock: [1, 18, 45],
    unlocks: ['systemctl', 'journalctl', 'crontab', 'lsblk', 'mount'],
    intro: N`The Clockworks fill the attic of City Hall: a cathedral of gears, chains and pendulums, all ticking out of step with one another.

:::art
        .-------.          .-----.
       /  12     \   ,--. /  9    \     T H E
      | 9   o   3 |-(  )-| o   3  |    C L O C K W O R K S
       \    6    / '--'  \   6   /
        '-------'    ||   '-----'      systemd keeps the services.
          || ||      ||     ||         cron keeps the time.
       ===================================
:::

Every service in Rootfall is wound and minded here. And Lethe's gear is turning faster than all the rest.`,
    steps: [
      {
        goal: 'Climb up to the Clockworks: «cd /etc/systemd/system»',
        hints: ['Type: «cd /etc/systemd/system»'],
        check: (e) => e.cwd === '/etc/systemd/system',
        solve: ['cd /etc/systemd/system'],
        done: N`Unit files hang from the gears like tags on keys: one per service the city runs. One of them is «lethe.service».`,
      },
      {
        say: N`Ask the service manager about Lethe: «systemctl status lethe».`,
        goal: 'Inspect the Lethe service: «systemctl status lethe»',
        hints: ['Type: «systemctl status lethe»'],
        check: (e) => !!e.tried('systemctl', (r) => r.args.includes('status') && r.args.some((a) => /^lethe/.test(a)) && /Loaded:/.test(r.out)),
        solve: ['systemctl status lethe'],
        done: N`«Loaded: loaded (/etc/systemd/system/lethe.service; **enabled**)»
«Active: **active (running)**»

:::lesson
**enabled** means "start automatically at boot". **active** means "running right now". They're separate switches — a service can be one without the other.
:::`,
      },
      {
        say: N`The status mentions a unit file. Read it — it's the instructions systemd follows.`,
        goal: 'Read the unit file: «cat /etc/systemd/system/lethe.service»',
        hints: ['Type: «cat /etc/systemd/system/lethe.service»'],
        check: (e) => e.didRead('/etc/systemd/system/lethe.service'),
        solve: ['cat /etc/systemd/system/lethe.service'],
        done: N`«Restart=always»

That's why it came back. Whenever Lethe dies, for any reason, systemd immediately starts a new one. You wrote that line yourself, to make Lethe reliable.

Reliable.`,
      },
      {
        say: N`systemd keeps a diary of everything its services say — the **journal**. Read Lethe's last twenty entries: «journalctl -u lethe -n 20».`,
        goal: 'Read Lethe\'s journal: «journalctl -u lethe -n 20»',
        hints: ['«-u» picks the unit (service), «-n» the number of lines.', 'Type: «journalctl -u lethe -n 20»'],
        check: (e) => !!e.ran('journalctl', (r) => r.args.some((a) => /lethe/.test(a)) && /lethe/.test(r.out)),
        solve: ['journalctl -u lethe -n 20'],
        done: N`«config reloaded (inotify: /etc/lethe/lethe.conf changed by uid 0)»
«WARNING: SAFE_MODE is OFF. Files will be destroyed, not quarantined.»
«Main process exited, code=killed... Scheduled restart job...»  — your «killall» from the Power Station.

:::lesson
«journalctl -u UNIT» filters by service · «-n 20» last 20 lines · «-f» follows live · «-r» newest first. «systemctl status» shows the last few lines too.
:::`,
      },
      {
        say: N`Stop it — properly, this time, through systemd. Stopping a service is a root job.`,
        goal: 'Stop the Lethe service: «sudo systemctl stop lethe»',
        hints: ['Type: «sudo systemctl stop lethe»'],
        check: (e) => !e.world.services.lethe.active,
        solve: ['sudo systemctl stop lethe', '$PW'],
        done: N`The Lethe gear grinds to a halt. For the first time in days, the Clockworks sound almost peaceful.`,
      },
      {
        say: N`Stopped isn't the same as disabled — at the next boot, it would start again. Disable it too.`,
        goal: 'Keep Lethe from starting at boot: «sudo systemctl disable lethe»',
        hints: ['Type: «sudo systemctl disable lethe»'],
        check: (e) => !e.world.services.lethe.enabled,
        solve: ['sudo systemctl disable lethe', '$PW'],
        done: N`«Removed "/etc/systemd/system/multi-user.target.wants/lethe.service".»

:::lesson
«systemctl start/stop» — right now. «systemctl enable/disable» — at boot. «enable --now» does both at once. «systemctl list-units» lists every service.
:::`,
      },
      {
        say: N`systemd minds services; **cron** minds time. Every user can have a **crontab** — a list of commands with times to run them. Look at yours.`,
        goal: 'List your own scheduled jobs: «crontab -l»',
        hints: ['Type: «crontab -l»'],
        check: (e) => !!e.tried('crontab', (r) => e.has(r, 'l') && !r.args.includes('-u')),
        solve: ['crontab -l'],
        done: N`«0 6 * * * /home/{user}/scripts/backup.sh»

:::art
   .------------- minute       (0-59)
   | .----------- hour         (0-23)
   | | .--------- day of month (1-31)
   | | | .------- month        (1-12)
   | | | | .----- day of week  (0-6, Sunday = 0)
   | | | | |
   0 6 * * *   /home/{user}/scripts/backup.sh
:::

Every morning at 06:00, your backup script. «*» means *every*. So that's how you kept backups.`,
      },
      {
        say: N`Juno's question: what keeps *restarting* Lethe at night, even if someone stops it? Look at Hollow's crontab. Reading another user's crontab is root-only — and needs «-u».`,
        goal: 'Read hollow\'s crontab: «sudo crontab -l -u hollow»',
        hints: ['Type: «sudo crontab -l -u hollow»'],
        check: (e) => !!e.ran('crontab', (r) => e.has(r, 'l') && r.args.includes('hollow') && /systemctl start lethe/.test(r.out)),
        solve: ['sudo crontab -l -u hollow', '$PW'],
        done: N`«58 2 * * * sudo -n /usr/bin/systemctl start lethe»
«*/5 * * * * /tmp/.hollow/beacon --phone-home 10.0.0.66»

Two minutes before three, every night, Hollow's alarm clock starts Lethe — even if someone stopped it. And every five minutes («*/5»), the beacon you killed would have been reborn.

The three o'clock sweep was yours: you wrote Lethe to clear «/tmp» at 03:00. This line never was. Someone else's alarm, set two minutes earlier, to wake your broom after you'd put it away.

That's it. That's what happened that night. You stopped Lethe at 02:22 and searched «/etc/cron.d» and «/etc/crontab» — the *system's* schedules. You never looked at the *users'* crontabs in «/var/spool/cron». At 02:58, this line started Lethe again while you stood at the Docks.

:::lesson
Cron jobs live in two places: system-wide («/etc/crontab», «/etc/cron.d/») and per user («crontab -l», stored under «/var/spool/cron/»). When something keeps coming back, check both.
:::`,
      },
      {
        say: N`@Juno: Hang on. A user's cron job runs *as that user*. Hollow's an ordinary account — he can't start a system service on his own, and cron can't type a sudo password for him. Look at that line again: «sudo -n». *Non-interactive*: run as root, and fail rather than ask for a password. That only works if a sudo rule says he needs none.
Extra sudo rules usually live as small files in «/etc/sudoers.d». Only root may read them.`,
        goal: 'Find the rule that lets him: «sudo grep -r hollow /etc/sudoers.d»',
        hints: ['Type: «sudo grep -r hollow /etc/sudoers.d»'],
        check: (e) => !!e.ran('grep', (r) => /NOPASSWD/.test(r.out)),
        solve: ['sudo grep -r hollow /etc/sudoers.d', '$PW'],
        done: N`«/etc/sudoers.d/90-lethe-watchdog: hollow ALL=(root) NOPASSWD: /usr/bin/systemctl start lethe»

Named like housekeeping. Narrow enough that nobody would look twice: one command, as root, no password. That's all he needed — that one line, and the crontab entry that used it.
@Juno: And «auth.log» will say who wrote it. (It does: your account, at 01:57 that night.)`,
      },
      {
        say: N`Remove it. A sudo rule is just a file.`,
        goal: 'Delete the rule: «sudo rm /etc/sudoers.d/90-lethe-watchdog»',
        hints: ['Type: «sudo rm /etc/sudoers.d/90-lethe-watchdog»'],
        check: (e) => !e.exists('/etc/sudoers.d/90-lethe-watchdog'),
        solve: ['sudo rm /etc/sudoers.d/90-lethe-watchdog', '$PW'],
        done: N`Now even if someone puts the crontab back, it would fail at 02:58 with «sudo: a password is required».

:::lesson
«sudo -l» lists what *you* may run as root; «sudo -l -U NAME» does it for another user. When someone ordinary can do something extraordinary, look for a rule in «/etc/sudoers» or «/etc/sudoers.d/». Edit those with «visudo», which refuses to save a broken file.
:::`,
      },
      {
        say: N`Remove it. «crontab -r» deletes a crontab entirely.`,
        goal: 'Delete hollow\'s crontab: «sudo crontab -r -u hollow»',
        hints: ['Type: «sudo crontab -r -u hollow»'],
        check: (e) => !e.exists(LA.cronSpool(e.world) + '/hollow'),
        solve: ['sudo crontab -r -u hollow', '$PW'],
        done: N`One gear in the Clockworks stops forever.

:::lesson
«crontab -e» edits your crontab (in $EDITOR) · «-l» lists it · «-r» removes it. Careful: «-r» sits right next to «-e» on the keyboard and does not ask "are you sure?".
:::`,
      },
      {
        setup: (g) => LA.stories.rootfall.plugBackup(g),
        say: N`Now — your backups. The tip said the Undercroft disk is called **sdb**. But it isn't in the city at all.

@Juno: (holding up a gray disk in an anti-static bag) You gave me this at twenty to three that night. Said *keep it in your drawer, off the city, whatever happens*. Then you walked off toward the Docks.
She plugs it in. «lsblk» lists every disk and partition attached to the city.`,
        goal: 'List the city\'s disks: «lsblk»',
        hints: ['Type: «lsblk»'],
        check: (e) => !!e.ran('lsblk'),
        solve: ['lsblk'],
        done: N`«sda» — 20G, the city itself, mounted at «/».
«sdb» — 2G, with one partition, «sdb1»... and nothing in the MOUNTPOINTS column.

The Undercroft is attached again for the first time in three nights. Nobody has opened the door.`,
      },
      {
        say: N`A disk's files only appear once it's **mounted** — attached to a directory somewhere in the tree. Your history showed the incantation. Mounting is root's business.
@Juno: Read-only, though. If that disk is your evidence, nothing on this city gets to write to it — not even you. «-o ro».`,
        goal: 'Open the Undercroft, read-only: «sudo mount -o ro /dev/sdb1 /mnt/backup»',
        hints: ['«mount -o ro DEVICE DIRECTORY». The device is /dev/sdb1, the mount point /mnt/backup.', 'Type: «sudo mount -o ro /dev/sdb1 /mnt/backup»'],
        check: (e) => e.world.mounts.some((m) => m.dev === '/dev/sdb1' && /^ro\b/.test(m.opts)),
        nudge: (e) => (e.world.mounts.some((m) => m.dev === '/dev/sdb1' && !/^ro\b/.test(m.opts)) ? '@Juno: That\'s read-*write*. «sudo umount /mnt/backup» and mount it again with «-o ro».' : null),
        solve: ['sudo mount -o ro /dev/sdb1 /mnt/backup', '$PW'],
        done: N`Far below the city, something heavy turns over and settles. A door you had forgotten swings open.

:::lesson
«mount» with no arguments lists everything mounted · «umount /mnt/backup» detaches it (note: *umount*, no n) · «df -h» shows mounted filesystems and their space · «/etc/fstab» lists filesystems to mount at boot.
:::`,
      },
      {
        goal: 'Look inside the Undercroft: «ls -l /mnt/backup»',
        hints: ['Type: «ls -l /mnt/backup»'],
        check: (e) => !!e.ran('ls', (r) => e.targets(r).includes('/mnt/backup') || (r.cwd === '/mnt/backup' && !e.targets(r).length)),
        solve: ['ls -l /mnt/backup'],
        done: N`«memories.tar.gz». «SHA256SUMS». «README.txt». «tux.png».

Tux presses his beak against the screen at the last one.`,
      },
    ],
    outro: N`Lethe is stopped, disabled, and its alarm clock is gone. Unless Hollow has another way back in, three o'clock tonight will pass without a sweep.

That *unless* sits in your stomach. Juno is watching the Power Station; Mara is combing the logs for any login she doesn't recognize. For now, the city is safe enough to breathe.

And below the city, the Undercroft door stands open. Whatever you saved down there that night is waiting.`,
  });
})();
