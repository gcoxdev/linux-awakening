/* Night Train, Chapter 10 — The Black Box (lsblk, dmesg, mount -o ro, df, du, sha256sum -c, cmp, diff, md5sum, cp -r) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const pack = LA.stories.nighttrain;
  const SNAP = '/mnt/recorder/snapshots';

  pack.add({
    n: 10, id: 'blackbox', title: 'The Black Box', place: 'mile 109 · Stellmark', clock: [1, 2, 58],
    unlocks: ['lsblk', 'dmesg', 'mount', 'df', 'du', 'sha256sum', 'cmp', 'diff', 'md5sum'],
    onStart(g) {
      const w = g.world, fs = g.fs;
      if (!w.devices.unplugged_recorder) return;
      w.devices.sdb1 = w.devices.unplugged_recorder;
      delete w.devices.unplugged_recorder;
      for (const b of ['sdb', 'sdb1']) fs.put('/dev/' + b, '', { special: 'block', mode: 0o660, group: 'disk', immutable: true });
      w.disks.push({ name: 'sdb', majmin: '8:16', rm: '1', size: '7.4G', parts: [{ name: 'sdb1', majmin: '8:17', size: '7.4G', fstype: 'vfat', label: 'RECORDER', uuid: '1847-0A1B' }] });
      const s = (LA.now() - w.bootTime) / 1000;
      for (const [d, msg] of [[0, 'usb 1-1: new high-speed USB device number 3 using xhci_hcd'], [0.2, 'usb 1-1: Product: MERIDIAN EVENT RECORDER'], [0.3, 'usb-storage 1-1:1.0: USB Mass Storage device detected'],
        [1.1, 'sd 1:0:0:0: [sdb] 15523840 512-byte logical blocks: (7.95 GB/7.40 GiB)'], [1.2, 'sd 1:0:0:0: [sdb] Attached SCSI removable disk'], [1.25, ' sdb: sdb1']]) w.dmesg.push({ s: s - 40 + d, msg });
    },
    intro: N`Stellmark. Four minutes at a platform under a mountain, snow falling past the lamps.

Rosa Beltrán — the driver, who until now has been a voice on the intercom saying *"Copy"* — comes down the train in a fleece and a headlamp, carrying a gray box the size of a paperback with a cable wrapped round it.

@Rosa: Event recorder. Every fifteen minutes since Calder. I've never had to pull one before. (She plugs it into the front of rack 7.) Don't break it.
@Vesna: Mount it **read-only**. Evidence you've written to isn't evidence any more.`,
    steps: [
      {
        say: N`A new disk has appeared. «lsblk» lists the block devices — disks and their partitions — and where each is mounted.`,
        goal: 'List the disks: «lsblk»',
        hints: ['Type «lsblk».'],
        check: (e) => !!e.ran('lsblk', (r) => /sdb/.test(r.out)),
        solve: ['lsblk'],
        done: N`«sda» — this server's own disk, mounted at «/». And «sdb», 7.4G, with one partition, «sdb1», mounted nowhere yet.`,
      },
      {
        say: N`The kernel narrates hardware arriving and leaving in its ring buffer. «dmesg» prints it; it needs root on this machine. Pipe it into «tail» for just the newest lines.`,
        goal: 'See what the kernel said about the new disk: «sudo dmesg | tail»',
        hints: ['Type «sudo dmesg | tail».'],
        check: (e) => !!e.ran('dmesg') && /sdb/.test(e.out()),
        solve: ['sudo dmesg | tail', '$PW'],
        done: N`«usb 1-1: Product: MERIDIAN EVENT RECORDER» ... «sdb: sdb1». That's it.`,
      },
      {
        say: N`To use a filesystem you **mount** it onto a directory. Root only. «-o ro» mounts it read-only. There's an empty directory waiting: «/mnt/recorder».`,
        goal: 'Mount it read-only: «sudo mount -o ro /dev/sdb1 /mnt/recorder»',
        hints: ['Type «sudo mount -o ro /dev/sdb1 /mnt/recorder».'],
        check: (e) => e.world.mounts.some((m) => m.path === '/mnt/recorder' && m.dev === '/dev/sdb1' && /^ro\b/.test(m.opts)),
        nudge: (e) => (e.world.mounts.some((m) => m.path === '/mnt/recorder' && !/^ro\b/.test(m.opts)) ? '@Vesna: That\'s mounted read-*write*. «sudo umount /mnt/recorder» and do it again with «-o ro». Evidence you could have changed isn\'t evidence.' : null),
        solve: ['sudo mount -o ro /dev/sdb1 /mnt/recorder', '$PW'],
        done: N`No message means it worked — Unix is quiet when things go right.`,
      },
      {
        say: N`Look inside.`,
        goal: 'List the snapshots: «ls /mnt/recorder/snapshots»',
        hints: ['Type «ls /mnt/recorder/snapshots».'],
        check: (e) => !!e.ran('ls', (r) => /0000/.test(r.out)),
        solve: ['ls /mnt/recorder/snapshots'],
        done: N`«0000  0015  0030  0100  2345». A copy of the door logs and the manifests at quarter to midnight, at midnight, at a quarter past...

@Vesna: Midnight. Rotation happens at 00:00:00, the recorder copies at 00:00:30, and he edited the log at 00:01:12. The midnight snapshot is from the forty-two seconds when the truth was still on disk.`,
      },
      {
        say: N`Before you copy anything off it, check there's room. «df -h» shows how full each mounted filesystem is, in human units.`,
        goal: 'Check free space: «df -h»',
        hints: ['Type «df -h».'],
        check: (e) => !!e.ran('df', (r) => e.has(r, 'h')),
        solve: ['df -h'],
        done: N`The recorder at «/mnt/recorder». And «/» — this server's disk — more than nine-tenths full.`,
      },
      {
        say: N`What's eating it? «du» measures how much space files and directories use; «-s» gives one total per argument, «-h» makes it readable.`,
        goal: 'Size up the camera recordings: «du -sh /var/lib/cctv/*»',
        hints: ['Type «du -sh /var/lib/cctv/*».'],
        check: (e) => !!e.tried('du', (r) => e.has(r, 's') && /cctv/.test(r.args.join(' '))),
        solve: ['du -sh /var/lib/cctv/*'],
        done: N`Four video cameras at about 4G each — the dining car, the lounge and both sleepers record continuously. The baggage car takes stills, and has the least of all. Nothing a few deletions at Port Isolde won't fix; nothing to worry about tonight.

:::lesson
«df» answers *how full is the disk?* · «du» answers *what is filling it?* Use them in that order.
:::`,
      },
      {
        say: N`Now the proof. At midnight, log rotation wrote the SHA-256 **checksum** — a fingerprint that changes completely if even one byte of the file changes — of each rotated log into «SHA256SUMS». «sha256sum -c» re-checks files against such a list.`,
        goal: 'Check the logs against their fingerprints: «cd /var/log/meridian», then «sha256sum -c SHA256SUMS»',
        hints: ['«cd /var/log/meridian»', 'then «sha256sum -c SHA256SUMS»'],
        check: (e) => !!e.tried('sha256sum', (r) => e.has(r, 'c') && /FAILED/.test(r.out)),
        solve: ['cd /var/log/meridian', 'sha256sum -c SHA256SUMS'],
        done: N`«doors.log.1: FAILED»
«doors.log.2.gz: OK»

The file on disk is not the file that was rotated at midnight.`,
      },
      {
        say: N`Which of the recorder's copies *is*? Fingerprint all of them at once and compare with the list.`,
        goal: 'Fingerprint every snapshot of the old log: «sha256sum /mnt/recorder/snapshots/*/doors.log.1», then «cat SHA256SUMS»',
        hints: ['«sha256sum /mnt/recorder/snapshots/*/doors.log.1»', 'then «cat SHA256SUMS» and compare the long numbers.'],
        check: (e) => e.stepRan('sha256sum') && e.didRead('/var/log/meridian/SHA256SUMS'),
        solve: ['sha256sum /mnt/recorder/snapshots/*/doors.log.1', 'cat SHA256SUMS'],
        done: N`The «0000» snapshot matches «SHA256SUMS» digit for digit. «0015», «0030» and «0100» all match each other — and match the tampered file on the server.

@Vesna: That's the whole case in two numbers. The midnight copy is the true one. Everything after a minute past twelve is his.`,
      },
      {
        say: N`«cmp» compares two files byte by byte and stops at the first difference.`,
        goal: 'Where do they first differ? «cmp /mnt/recorder/snapshots/0000/doors.log.1 doors.log.1»',
        hints: ['Type «cmp /mnt/recorder/snapshots/0000/doors.log.1 doors.log.1».'],
        check: (e) => !!e.tried('cmp', (r) => /differ/.test(r.out)),
        solve: ['cmp /mnt/recorder/snapshots/0000/doors.log.1 doors.log.1'],
        done: N`«differ: byte ..., line ...». Good for *whether*; useless for *what*.`,
      },
      {
        say: N`«diff» compares line by line and shows exactly what changed. Lines starting «<» exist only in the first file — the original. Lines starting «>» only in the second.`,
        goal: 'Show what was deleted: «diff /mnt/recorder/snapshots/0000/doors.log.1 doors.log.1»',
        hints: ['Type «diff /mnt/recorder/snapshots/0000/doors.log.1 doors.log.1».'],
        check: (e) => !!e.tried('diff', (r) => /0417/.test(r.out)),
        solve: ['diff /mnt/recorder/snapshots/0000/doors.log.1 doors.log.1'],
        done: N`:::art
< 23:05:12 0417 car2_baggage CLOSED
< 23:36:30 0417 car2_baggage OPEN
< 23:51:08 0417 car2_baggage CLOSED
< 23:53:20 0201 car8_mail OPEN
< 23:53:34 ---- car8_mail LOCKED
:::
Five lines. A header like «16d15» means *line 16 of the first file was **d**eleted; after it, the two files line up again at line 15 of the second*.

@Vesna: (very quietly) 23:36, he lets himself into the baggage car with the card Abel gave him and rattles the safe till it pages me. When I get there he's all apology — *heard the alarm, came to check, his employer would want to be sure the Atlas is still there.* After a vibration alarm the safe goes into fault-check mode, and fault-check wants the engineer's *own* password on its keypad, not just the PIN. So I type it. With him a foot behind me — and the keypad screen echoes every key as a star, so all he had to do was count and watch my fingers.
@Vesna: Then the Kessel sacks slide off their pile — he'd been sitting on them — and I turn round to stack them. Twenty seconds, with my back to an open safe. The case was flat and gray and on the shelf when I closed it. I didn't open the case. Why would I?
@Vesna: 23:51, we leave together. 23:53, he says he saw someone slip into the mail van. I open it with my card and go in to look, and the door swings shut behind me and locks, because that's what sealed doors do.
@Vesna: He even took out 23:05 — the end of the official inspection, perfectly innocent — just because it had his card number in it. Five lines. That's what I was worth to him.`,
        evidence: 'deleted',
      },
      {
        say: N`Keep the true copy, and fingerprint it the way the police will want it. Their form, Vesna says, still asks for **MD5** — an older, weaker checksum — so give them both. «cp -r» copies a whole directory.`,
        goal: 'Copy the midnight snapshot into your case and fingerprint it: «cp -r /mnt/recorder/snapshots/0000 ~/case/recorder-0000», then «md5sum ~/case/recorder-0000/*»',
        hints: ['«cp -r /mnt/recorder/snapshots/0000 ~/case/recorder-0000»', 'then «md5sum ~/case/recorder-0000/*»'],
        check: (e) => !!e.node(e.home + '/case/recorder-0000/doors.log.1') && e.stepRan('md5sum'),
        solve: ['cp -r /mnt/recorder/snapshots/0000 ~/case/recorder-0000', 'md5sum ~/case/recorder-0000/*'],
        done: N`Copies, with fingerprints, in a folder only you and the crew can read. Rule two, again.`,
      },
    ],
    outro: N`The train pulls out of Stellmark. Rosa goes back to her locomotive with a thermos of Amadou's coffee and the air of someone who wants to be told everything later.

@Vesna: The recorder has the camera, too. Hourly archives. He deleted the stills from the server — he didn't know there was anywhere else to delete them from.`,
  });
})();
