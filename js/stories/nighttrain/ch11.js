/* Night Train, Chapter 11 — Frames (tar, strings, base64, zcat, gunzip, gzip, zip, unzip, umount) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const pack = LA.stories.nighttrain;
  const ARCH = '/mnt/recorder/cctv/car2-23.tar.gz';

  pack.add({
    n: 11, id: 'frames', title: 'Frames', place: 'km 188 · the Stellmark valley', clock: [1, 3, 14],
    unlocks: ['tar', 'strings', 'base64', 'zcat', 'gunzip', 'gzip', 'zip', 'unzip', 'umount'],
    intro: N`Vesna has stopped shivering. She's sitting on the bunk opposite the rack with her knees up, a second coffee, and her laptop-less hands moving restlessly as she watches you type.

@Vesna: The recorder takes the camera stills off the server once an hour and packs them into one file. «.tar.gz»: a **tar** archive — lots of files bundled into one — squeezed with **gzip**. Let's see what my baggage car saw.`,
    steps: [
      {
        say: N`Look before you unpack. «tar» options are letters: **t** list the contents, **z** it's gzipped, **f** the archive file comes next.`,
        goal: 'List the 23:00 archive: «tar -tzf /mnt/recorder/cctv/car2-23.tar.gz»',
        hints: ['Type «tar -tzf /mnt/recorder/cctv/car2-23.tar.gz».'],
        check: (e) => !!e.ran('tar', (r) => r.args.join(' ').includes('t') && /frame-2344/.test(r.out)),
        solve: ['tar -tzf /mnt/recorder/cctv/car2-23.tar.gz'],
        done: N`«car2/frame-2300.jpg» ... and this time the list doesn't stop at 23:28. «frame-2330», «frame-2336», «frame-2344», all the way to «frame-2358».`,
      },
      {
        say: N`Unpack it into your case. **x** extracts; «-C DIR» extracts into DIR instead of where you're standing.`,
        goal: 'Extract the stills: «mkdir -p ~/case/frames», then «tar -xzf /mnt/recorder/cctv/car2-23.tar.gz -C ~/case/frames»',
        hints: ['«mkdir -p ~/case/frames»', 'then «tar -xzf /mnt/recorder/cctv/car2-23.tar.gz -C ~/case/frames»'],
        check: (e) => !!e.node(e.home + '/case/frames/car2/frame-2344.jpg'),
        solve: ['mkdir -p ~/case/frames', 'tar -xzf /mnt/recorder/cctv/car2-23.tar.gz -C ~/case/frames'],
        done: N`:::lesson
tar in one breath: **c** create · **x** extract · **t** list · **z** gzip · **v** verbose · **f FILE** the archive · **-C DIR** work in DIR. «tar -czf out.tar.gz folder» makes one; «tar -xzf out.tar.gz» unpacks it.
:::`,
      },
      {
        say: N`You can't look at a picture in a terminal. But the camera writes a description into every still, and «strings» digs readable text out of any file — binary or not.`,
        goal: 'Read what the camera saw at 23:44: «strings ~/case/frames/car2/frame-2344.jpg»',
        hints: ['Type «strings ~/case/frames/car2/frame-2344.jpg».'],
        check: (e) => !!e.ran('strings', (r) => /grey overcoat/.test(r.out)),
        solve: ['strings ~/case/frames/car2/frame-2344.jpg'],
        done: N`«CAM2 23:44:12 baggage car - 2 persons: staff (orange hi-vis) at safe keypad, safe OPEN; adult male (grey overcoat) beside her, holding flat case»

@June: A flat case. You'd carry an atlas in a flat case.
@Vesna: You'd carry a *timetable* in a flat case, too. If you needed it to weigh about right.`,
        evidence: 'frame',
      },
      {
        say: N`Every safe opening in «safe.log» carries a «token». The safe writes it in **base64** — a way of spelling any data using only letters, digits, «+» and «/», so it survives being copied around. It isn't encryption: «base64 -d» decodes it.`,
        goal: 'Find the 23:44 opening with «grep 23:44 /srv/meridian/cars/car2_baggage/safe.log», then decode its token: «echo d2l0bmVzcz0wNDE3IHJlYXNvbj1mYXVsdC1jaGVjaw== | base64 -d»',
        hints: ['«grep 23:44 /srv/meridian/cars/car2_baggage/safe.log» shows the token.', 'Then «echo d2l0bmVzcz0wNDE3IHJlYXNvbj1mYXVsdC1jaGVjaw== | base64 -d»'],
        check: (e) => !!e.ran('base64', (r) => e.has(r, 'd') && /witness=0417/.test(r.out)),
        solve: ['grep 23:44 /srv/meridian/cars/car2_baggage/safe.log', 'echo d2l0bmVzcz0wNDE3IHJlYXNvbj1mYXVsdC1jaGVjaw== | base64 -d'],
        done: N`«witness=0417 reason=fault-check»

@Vesna: The safe asks for a witness card when it's opened outside an inspection. He tapped his. It's been sitting in the safe's own log all night, wearing a disguise a twelve-year-old could take off.
@June: I could have taken it off.`,
      },
      {
        say: N`The oldest door log, «doors.log.2.gz», covers 22:00 to 23:00 — boarding. It's gzipped. «zcat» prints a compressed file without unpacking it on disk.`,
        goal: 'Search the compressed log for the escort card: «zcat /var/log/meridian/doors.log.2.gz | grep 0417»',
        hints: ['Type «zcat /var/log/meridian/doors.log.2.gz | grep 0417».'],
        check: (e) => !!e.ran('zcat') && /0417/.test(e.out()),
        solve: ['zcat /var/log/meridian/doors.log.2.gz | grep 0417'],
        done: N`«22:52:03 0417 car2_baggage OPEN» — the official inspection before departure, with Abel and Dr Brandt. He knew exactly what that door and that safe looked like from the inside before the train ever left Calder.

He edited the hour that mattered and forgot the hour before it. People who edit logs always forget one.`,
      },
      {
        say: N`Your timeline script — Vesna says you're writing one next — will want that hour as plain text. Copy the archive into the case, then «gunzip» it, which decompresses it and removes the «.gz».`,
        goal: '«cp /var/log/meridian/doors.log.2.gz ~/case/evidence/», then «gunzip ~/case/evidence/doors.log.2.gz»',
        hints: ['«cp /var/log/meridian/doors.log.2.gz ~/case/evidence/»', 'then «gunzip ~/case/evidence/doors.log.2.gz»'],
        check: (e) => !!e.node(e.home + '/case/evidence/doors.log.2') && !e.node(e.home + '/case/evidence/doors.log.2.gz'),
        solve: ['cp /var/log/meridian/doors.log.2.gz ~/case/evidence/', 'gunzip ~/case/evidence/doors.log.2.gz'],
        done: N`«doors.log.2», plain text, in the case.`,
      },
      {
        say: N`Going the other way: «gzip» compresses a file. By default it *replaces* the original; «-k» keeps it. Logs shrink enormously — they're mostly repetition.`,
        goal: 'Make a compressed copy of the true log, keeping the original: «gzip -k ~/case/recorder-0000/doors.log.1»',
        hints: ['Type «gzip -k ~/case/recorder-0000/doors.log.1».'],
        check: (e) => !!e.node(e.home + '/case/recorder-0000/doors.log.1.gz') && !!e.node(e.home + '/case/recorder-0000/doors.log.1'),
        solve: ['gzip -k ~/case/recorder-0000/doors.log.1'],
        done: N`Both files now: «doors.log.1» and «doors.log.1.gz».`,
      },
      {
        say: N`The police at Kessel will want one file, in a format any computer opens: **zip**. «zip -r» zips a directory recursively. Do it from your home so the paths inside the zip start with «case/».`,
        goal: 'Package the case: «cd ~», then «zip -r evidence.zip case»',
        hints: ['«cd ~»', 'then «zip -r evidence.zip case»'],
        check: (e) => { const n = e.node(e.home + '/evidence.zip'); return !!n && n.format === 'zip' && n.data && n.data.entries.length > 10; },
        solve: ['cd ~', 'zip -r evidence.zip case'],
        done: N`«adding: case/ ... case/frames/car2/frame-2344.jpg ...» Everything you've found tonight, in one file.`,
      },
      {
        say: N`Check what you've made before you send it anywhere. «unzip -l» lists a zip's contents without extracting.`,
        goal: 'Check the package: «unzip -l evidence.zip»',
        hints: ['Type «unzip -l evidence.zip».'],
        check: (e) => !!e.ran('unzip', (r) => e.has(r, 'l')),
        solve: ['unzip -l evidence.zip'],
        done: N`Witness statement, timeline, the escort card, the true log and its fingerprints, the frames. A case.`,
      },
      {
        say: N`Done with the recorder. Unmount it before Rosa takes it back — «umount» (no *n*: it's an old Unix spelling). You can't unmount a filesystem while a shell is standing inside it.`,
        goal: 'Unmount the recorder: «sudo umount /mnt/recorder»',
        hints: ['Type «sudo umount /mnt/recorder».', 'If it says "target is busy", «cd ~» first.'],
        check: (e) => !e.world.mounts.some((m) => m.path === '/mnt/recorder'),
        solve: ['sudo umount /mnt/recorder', '$PW'],
        done: N`Safe to unplug.`,
      },
    ],
    outro: N`@Vesna: Everything we have, a policeman can open. But a policeman at five in the morning will want it told as a *story*: who, where, when, card by card. So we'll make the computer write the timeline. Then nobody can say we chose the bits that suited us.`,
  });
})();
