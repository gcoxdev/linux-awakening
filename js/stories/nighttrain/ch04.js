/* Night Train, Chapter 4 — Needles (grep, find, locate, sort, uniq, which, whereis, the first pipe) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const pack = LA.stories.nighttrain;
  const LOG1 = '/var/log/meridian/doors.log.1';

  pack.add({
    n: 4, id: 'needles', title: 'Needles', place: 'mile 53 · Varn Forest', clock: [1, 0, 58],
    unlocks: ['grep', 'find', 'locate', 'sort', 'uniq', 'which', 'whereis'],
    intro: N`Pine forest on both sides now, close enough to touch. The train is quiet in the way that means nobody is sleeping.

There's too much log to read line by line. Time to stop reading and start *searching*.`,
    steps: [
      {
        say: N`«grep PATTERN FILE» prints only the lines of FILE that contain PATTERN. Pull out every door Vesna's card opened in the last hour.`,
        goal: 'Find Vesna\'s card in the old log: «grep 0201 /var/log/meridian/doors.log.1»',
        hints: ['Type «grep 0201 /var/log/meridian/doors.log.1».'],
        check: (e) => !!e.ran('grep', (r) => r.args.includes('0201') && e.targets(r).includes(LOG1)),
        solve: ['grep 0201 /var/log/meridian/doors.log.1'],
        done: N`Her whole walk, nothing else: forward to the baggage car by 23:42:55, back again from 23:51, the staff car at 23:52:55. Ten lines instead of more than a hundred.`,
      },
      {
        say: N`The staff car's other door leads to the mail van — sealed by customs at Calder, refrigerated, opens only at Kessel. Nobody should have touched it. Check. You can give «grep» more than one file at once.`,
        goal: 'Search the door log and the system log for the mail van: «grep car8 /var/log/meridian/doors.log.1 /var/log/syslog»',
        hints: ['Type «grep car8 /var/log/meridian/doors.log.1 /var/log/syslog».'],
        check: (e) => !!e.tried('grep', (r) => r.args.includes('car8') && /seal mode/.test(r.out)),
        solve: ['grep car8 /var/log/meridian/doors.log.1 /var/log/syslog'],
        done: N`From «doors.log.1»: nothing at all. From the system log:

«doord[602]: car8_mail: door closed, seal mode: LOCKED» — at **23:53:34**.

The door controller says the mail van's door closed thirty-nine seconds after Vesna reached the staff car. The door log, which records every door on the train, says nothing happened. One of them is lying, and it isn't the program.{logLesson}`,
      },
      {
        say: N`Same log, different question. Her name might be in there too — but a log could write it «Vesna», «vesna» or «VESNA». «-i» makes grep **ignore case**.`,
        goal: 'Search the system log for her name, any case: «grep -i vesna /var/log/syslog»',
        hints: ['Type «grep -i vesna /var/log/syslog».'],
        check: (e) => !!e.ran('grep', (r) => e.has(r, 'i') && /vesna/i.test(r.args.join(' ')) && /Accepted/.test(r.out)),
        solve: ['grep -i vesna /var/log/syslog'],
        done: N`«23:58:40 sshd: Accepted publickey for vesna from 10.8.0.12»
«00:09:55 sshd: session closed for user vesna»

@June: 10.8.0.12 — that's in the hosts file. «vesna-laptop». So she's *fine*? She logged in. Six minutes after she disappeared, she sat down somewhere and used her laptop for eleven minutes.
@Abel: ...Or somebody did.`,
      },
      {
        say: N`The baggage car camera takes a still every two minutes. Where are they kept? «locate» searches a database of every file name on the system — instant, because it doesn't walk the disk.`,
        goal: 'Find where the stills live: «locate frame-2328»',
        hints: ['Type «locate frame-2328».'],
        check: (e) => !!e.ran('locate', (r) => /frame-2328/.test(r.out)),
        solve: ['locate frame-2328'],
        done: N`«/var/lib/cctv/car2/frame-2328.jpg»`,
      },
      {
        say: N`«find» walks the disk itself and tests every file it meets — by name, age, size, owner and more. Quote the pattern so the shell doesn't expand the «*» before find sees it.`,
        goal: 'List every still from the 23:00 hour: «find /var/lib/cctv/car2 -name \'frame-23*\'»',
        hints: ["Type «find /var/lib/cctv/car2 -name 'frame-23*'»."],
        check: (e) => !!e.ran('find', (r) => r.args.includes('-name') && /frame-2328/.test(r.out)),
        solve: ["find /var/lib/cctv/car2 -name 'frame-23*'"],
        done: N`«frame-2300» ... «frame-2326», «frame-2328». And then nothing until midnight.

Thirty minutes of baggage car — from 23:30 to 23:58, the half hour the Atlas disappeared — gone from the disk.`,
      },
      {
        say: N`Now the question that matters. At midnight, log rotation wrote a fingerprint of «doors.log.1» into «SHA256SUMS». A rotated log is history: nothing should ever touch it again. «find -newer FILE» lists files modified *more recently* than FILE.`,
        goal: 'What changed after the checksums were written? «find /var/log/meridian -newer /var/log/meridian/SHA256SUMS»',
        hints: ['Type «find /var/log/meridian -newer /var/log/meridian/SHA256SUMS».'],
        check: (e) => !!e.ran('find', (r) => r.args.includes('-newer') && /doors\.log\.1/.test(r.out)),
        solve: ['find /var/log/meridian -newer /var/log/meridian/SHA256SUMS'],
        done: N`«doors.log» changes all the time — it's the live log. «recorder.log» and «cctv.log» are still being written to.

But «/var/log/meridian/doors.log.1» is on the list. Somebody **edited the old door log after midnight**.

@June: Rule four. Logs don't lie. *People who edit logs do.*`,
        evidence: 'edited',
      },
      {
        say: N`Which doors in that edited hour were busiest — and which are suspiciously quiet? Join commands with a **pipe**, «|»: it feeds the output of one command into the next.
«grep -o» prints only the part of each line that matched. «sort» puts the door names in order, so «uniq -c» can count each run of identical lines.`,
        goal: 'Count openings per car: «grep -o \'car[0-9]_[a-z_]*\' /var/log/meridian/doors.log.1 | sort | uniq -c»',
        hints: ["Type «grep -o 'car[0-9]_[a-z_]*' /var/log/meridian/doors.log.1 | sort | uniq -c».", '«uniq» only merges *adjacent* identical lines — that\'s why «sort» goes first.'],
        check: (e) => e.pipe && !!e.ran('uniq', (r) => e.has(r, 'c')) && !!e.ran('sort'),
        solve: ["grep -o 'car[0-9]_[a-z_]*' /var/log/meridian/doors.log.1 | sort | uniq -c"],
        done: N`«1 car2_baggage». One opening in an hour, and it was Vesna's. Yet someone was in that car at 23:38 rattling the safe hard enough to set off a sensor — before she ever arrived.

Ghosts don't trip vibration sensors. Whoever it was didn't need to open a door the log remembers. Or the log forgot.`,
      },
      {
        say: N`Vesna wrote a tool called «safectl». «which» shows where a command lives — the first match on your «$PATH».`,
        goal: 'Find the tool with «which safectl», then run «safectl log»',
        hints: ['«which safectl»', 'then «safectl log»'],
        check: (e) => e.stepRan('which') && !!e.stepEvent('script', (ev) => /safectl$/.test(ev.path)),
        solve: ['which safectl', 'safectl log'],
        done: N`«/usr/local/bin/safectl» — a little shell script. Its log says the safe was opened at **23:44:12 by card 0201**, Vesna's, and closed at 23:47:40. Every opening has a «token=...» — a jumble of letters you can't read yet.

So Vesna opened the safe twenty-eight minutes before the Atlas was found missing.
@Abel: (very quietly) She wouldn't.`,
      },
      {
        say: N`One more thing to know: where the door controller lives. «whereis» finds a command's program *and* its manual pages in the usual places.`,
        goal: 'Find the door controller: «whereis doord»',
        hints: ['Type «whereis doord».'],
        check: (e) => !!e.ran('whereis', (r) => r.args.includes('doord')),
        solve: ['whereis doord'],
        done: N`«doord: /usr/sbin/doord». The thing that sealed the mail van at 23:53:34. You'll be needing it.`,
      },
    ],
    outro: N`@June: So. Somebody followed Vesna to the staff car. The mail van door closed. Somebody logged in as her six minutes later. And somebody edited the door log and deleted half an hour of camera.
@Abel: Or Vesna did all of that herself.
@June: She wrote «logs don't lie» on your *README*. She wouldn't edit one. That's like a dentist eating sugar.`,
  });
})();
