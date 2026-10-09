/* Chapter 9 — The Clockworks (systemctl, journalctl, crontab, lsblk, mount) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;

  LA.story.add({
    n: 9, id: 'clockworks', title: 'The Clockworks', place: '/etc/systemd & /var/spool/cron',
    unlocks: ['systemctl', 'journalctl', 'crontab', 'lsblk', 'mount', 'umount', 'dmesg', 'watch'],
    onStart(g) {
      const s = g.world.services.lethe;
      if (s && !s.active) g.world.startService('lethe');
      if (s) s.enabled = true;
    },
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
        say: N`Ask the service manager about Lethe: «systemctl status lethe».`,
        goal: 'Inspect the Lethe service: «systemctl status lethe»',
        hints: ['Type: «systemctl status lethe»'],
        check: (e) => !!e.tried('systemctl', (r) => r.args.includes('status') && r.args.some((a) => /^lethe/.test(a))),
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
        check: (e) => !!e.ran('journalctl', (r) => r.args.some((a) => /lethe/.test(a))),
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
        check: (e) => !!e.ran('crontab', (r) => e.has(r, 'l') && r.args.includes('hollow')),
        solve: ['sudo crontab -l -u hollow', '$PW'],
        done: N`«58 2 * * * /usr/bin/systemctl start lethe»
«*/5 * * * * /tmp/.hollow/beacon --phone-home 10.0.0.66»

Two minutes before three, every night, Hollow's alarm clock starts Lethe — even if someone stopped it. And every five minutes («*/5»), the beacon you killed would have been reborn.`,
      },
      {
        say: N`Remove it. «crontab -r» deletes a crontab entirely.`,
        goal: 'Delete hollow\'s crontab: «sudo crontab -r -u hollow»',
        hints: ['Type: «sudo crontab -r -u hollow»'],
        check: (e) => !e.exists('/var/spool/cron/crontabs/hollow'),
        solve: ['sudo crontab -r -u hollow', '$PW'],
        done: N`One gear in the Clockworks stops forever.

:::lesson
«crontab -e» edits your crontab (in $EDITOR) · «-l» lists it · «-r» removes it. Careful: «-r» sits right next to «-e» on the keyboard and does not ask "are you sure?".
:::`,
      },
      {
        say: N`Now — your backups. The tip said the Undercroft disk is called **sdb**. «lsblk» lists every disk and partition attached to the city.`,
        goal: 'List the city\'s disks: «lsblk»',
        hints: ['Type: «lsblk»'],
        check: (e) => !!e.ran('lsblk'),
        solve: ['lsblk'],
        done: N`«sda» — 20G, the city itself, mounted at «/».
«sdb» — 2G, with one partition, «sdb1»... and nothing in the MOUNTPOINTS column.

The Undercroft is attached, but nobody has opened the door.`,
      },
      {
        say: N`A disk's files only appear once it's **mounted** — attached to a directory somewhere in the tree. Your history showed the exact incantation. Mounting is root's business.`,
        goal: 'Open the Undercroft: «sudo mount /dev/sdb1 /mnt/backup»',
        hints: ['«mount DEVICE DIRECTORY». The device is /dev/sdb1, the mount point /mnt/backup.', 'Type: «sudo mount /dev/sdb1 /mnt/backup»'],
        check: (e) => e.world.mounts.some((m) => m.dev === '/dev/sdb1'),
        solve: ['sudo mount /dev/sdb1 /mnt/backup', '$PW'],
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
    outro: N`Lethe is asleep, and it will stay asleep. Tonight, at three o'clock, for the first time in days, nothing in Rootfall will be forgotten.

But your memories are still packed away below the city, and your «~/scripts» folder holds something you never finished: «restore.sh».

You've got some spellwork to do.`,
  });
})();
