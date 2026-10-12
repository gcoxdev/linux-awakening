/* Night Train, Chapter 5 — Cross-Reference (column, cut, awk, tr, <, 2>/dev/null, tee, tac, paste, xargs) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const pack = LA.stories.nighttrain;
  const CARDS = '/etc/meridian/cards.csv';

  pack.add({
    n: 5, id: 'crossref', title: 'Cross-Reference', place: 'km 103 · Lake Varn', clock: [1, 1, 16],
    unlocks: ['column', 'cut', 'awk', 'tr', 'tee', 'tac', 'paste', 'xargs'],
    intro: N`The lake goes by on the left, flat and black, with a single lit farmhouse on the far shore.

The door log has had lines cut out of it. You can't read what isn't there — but you can work out *whose* lines are missing, by laying the log next to everything else the train knows. Every keycard ever issued for this journey is in «/etc/meridian/cards.csv».`,
    steps: [
      {
        say: N`CSV files are miserable to read raw. «column -t» lines text up into a table; «-s,» says the columns are separated by commas.`,
        goal: 'Read the passenger list as a table: «column -t -s, /srv/meridian/manifest/passengers.csv»',
        hints: ['Type «column -t -s, /srv/meridian/manifest/passengers.csv».'],
        check: (e) => !!e.ran('column', (r) => e.has(r, 't')),
        solve: ['column -t -s, /srv/meridian/manifest/passengers.csv'],
        done: N`Much better. A3, Lucien Marsh. A5, Dr Ottilie Brandt. B11, Constance Fairley — a journalist, Abel says. B14, Rosalind and June Castellanos.`,
      },
      {
        say: N`Now the cards. You don't need every column. «cut» slices them out: «-d,» sets the delimiter, «-f1,2,3» picks fields one to three.`,
        goal: 'Show card, holder and role: «cut -d, -f1,2,3 /etc/meridian/cards.csv»',
        hints: ['Type «cut -d, -f1,2,3 /etc/meridian/cards.csv».'],
        check: (e) => !!e.ran('cut', (r) => e.has(r, 'd') && e.has(r, 'f') && e.targets(r).some((t) => t === CARDS)),
        solve: ['cut -d, -f1,2,3 /etc/meridian/cards.csv'],
        done: N`Four crew cards — Abel, Rosa, Amadou, Vesna — and yours. Eighteen passenger cards. And one temporary card that is neither: «0417,MARSH L (ARDEN MUTUAL),ESCORT-TEMP».`,
      },
      {
        say: N`Which cards actually opened a door in the edited hour? The card is the *second* field of every line. «awk» splits each line into fields — «$1», «$2», ... — on spaces by default. Print field two, then «sort -u» sorts and keeps one of each.`,
        goal: 'List the cards seen in the old log: «awk \'{print $2}\' /var/log/meridian/doors.log.1 | sort -u»',
        hints: ["Type «awk '{print $2}' /var/log/meridian/doors.log.1 | sort -u».", 'The single quotes stop the shell from treating $2 as one of its own variables.'],
        check: (e) => e.pipe && !!e.ran('awk') && /0201/.test(e.out()),
        solve: ["awk '{print $2}' /var/log/meridian/doors.log.1 | sort -u"],
        done: N`«0103» (Amadou), «0201» (Vesna), and passenger cards. No «0417».

An escort card, issued for one door only — the baggage car — that didn't open that door once in the hour the thing it was escorting walked out of it.`,
      },
      {
        say: N`Ask the registry about it directly.`,
        goal: 'Look up card 0417: «grep 0417 /etc/meridian/cards.csv»',
        hints: ['Type «grep 0417 /etc/meridian/cards.csv».'],
        check: (e) => !!e.ran('grep', (r) => r.args.includes('0417') && /ESCORT/.test(r.out)),
        solve: ['grep 0417 /etc/meridian/cards.csv'],
        done: N`«0417,MARSH L (ARDEN MUTUAL),ESCORT-TEMP,car2,... 22:41»

Issued at 22:41, forty-nine minutes before departure. To Mr Marsh. Very calm. Very helpful.`,
        evidence: 'card0417',
      },
      {
        say: N`@June: Try «grep marsh» on it. Small letters.
You do. Nothing: the registry shouts in capitals. «grep -i» would fix that, but there's an older trick worth knowing. «tr» *translates* characters — «tr 'A-Z' 'a-z'» turns capitals into small letters. It only reads its input, so feed it the file with «<».`,
        goal: 'Lower-case the registry and search it: «tr \'A-Z\' \'a-z\' < /etc/meridian/cards.csv | grep marsh»',
        hints: ["Type «tr 'A-Z' 'a-z' < /etc/meridian/cards.csv | grep marsh».", '«<» feeds a file into a command\'s standard input.'],
        check: (e) => !!e.ran('tr') && /marsh/.test(e.out()),
        solve: ["tr 'A-Z' 'a-z' < /etc/meridian/cards.csv | grep marsh"],
        done: N`Two cards: «1103» for cabin A3, and «0417» for the baggage car.

:::lesson
Every program has three streams: **stdin** (0, input), **stdout** (1, output) and **stderr** (2, errors). «<» feeds a file to stdin, «>» sends stdout to a file, «|» connects one program's stdout to the next one's stdin.
:::`,
      },
      {
        say: N`Where *else* does 0417 turn up? «grep -r» searches whole directory trees. Some of them you aren't allowed into, and grep will complain on **stderr**. «2>» redirects stream 2, and «/dev/null» swallows whatever it's given.`,
        goal: 'Search /etc, /srv and /home for 0417, hiding the errors: «grep -r 0417 /etc /srv /home 2>/dev/null»',
        hints: ['Type «grep -r 0417 /etc /srv /home 2>/dev/null». No space between 2 and >.'],
        check: (e) => /2>\s*\/dev\/null/.test(e.line) && !!e.tried('grep', (r) => e.has(r, 'r') && r.args.includes('0417')),
        solve: ['grep -r 0417 /etc /srv /home 2>/dev/null'],
        done: N`Clean results. And one you hadn't seen — Abel's own note, «/home/abel/cards_issued.txt»:

*«22:41 0417 L. MARSH, Arden Mutual — escort for the Halvard Atlas (said Mr P. Vos was taken ill; produced a letter on Arden paper signed "P. Vos")»*

@Abel: He had a letter. It looked right. They always look right.`,
      },
      {
        say: N`Keep it. «tee» is a T-junction for a pipe: it writes what passes through into a file *and* lets it carry on to the screen.`,
        goal: 'Save the 0417 lines as evidence: «grep -rh 0417 /etc/meridian /home/abel 2>/dev/null | tee ~/case/evidence/card0417.txt»',
        hints: ['Type «grep -rh 0417 /etc/meridian /home/abel 2>/dev/null | tee ~/case/evidence/card0417.txt».', '«-h» leaves the file names off each line.'],
        check: (e) => /0417/.test(e.read(e.home + '/case/evidence/card0417.txt') || ''),
        solve: ['grep -rh 0417 /etc/meridian /home/abel 2>/dev/null | tee ~/case/evidence/card0417.txt'],
        done: N`On screen and on disk.`,
      },
      {
        say: N`One more card to follow: «1103», Mr Marsh's own cabin card. Read his movements newest-first. «tac» is «cat» backwards — it prints a file's lines in reverse order.`,
        goal: 'Marsh\'s cabin card, newest first: «tac /var/log/meridian/doors.log.1 | grep 1103»',
        hints: ['Type «tac /var/log/meridian/doors.log.1 | grep 1103».'],
        check: (e) => !!e.ran('tac') && /1103 cabin_A3/.test(e.out()),
        solve: ['tac /var/log/meridian/doors.log.1 | grep 1103'],
        done: N`«23:54:40 1103 cabin_A3 OPEN» — back into his cabin a minute after the mail van sealed itself.
«23:36:02 1103 car3_dining OPEN» · «23:35:40 1103 car4_lounge OPEN» — walking *forward*, toward the baggage car, at 23:35. Then nothing for eighteen minutes.

Back from where? The log doesn't say. Someone made sure it wouldn't.`,
      },
      {
        setup: (g) => {
          const o = { owner: g.user, group: g.user };
          g.fs.put(g.home + '/case/june_times.txt', '23:48\n23:52\n23:52\n23:54\n', o);
          g.fs.put(g.home + '/case/june_people.txt', 'lady in a red scarf, going into the lounge\nlady in an orange jacket (Vesna?), going back\ntall man, grey coat, right behind her\nsomeone came out of the staff end, fast, in shirtsleeves\n', o);
        },
        say: N`June has been busy. She wrote down everyone she saw in the corridor, in two lists — times in «~/case/june_times.txt», people in «~/case/june_people.txt» — "because that's how my notebook is laid out". «paste» glues files together side by side, line by line.`,
        goal: 'Put June\'s lists side by side: «paste ~/case/june_times.txt ~/case/june_people.txt»',
        hints: ['Type «paste ~/case/june_times.txt ~/case/june_people.txt».'],
        check: (e) => !!e.ran('paste', (r) => /grey coat/.test(r.out)),
        solve: ['cat /srv/meridian/cars/car4_lounge/smoke.log', 'paste ~/case/june_times.txt ~/case/june_people.txt'],
        done: N`«23:54  someone came out of the staff end, fast, in shirtsleeves»

@June: Shirtsleeves. The grey coat went *in* with Vesna and came out without her and without the coat. Where's the coat?
@June: Also, the red scarf lady went into the lounge at 23:48. I bet she was smoking. Grandmother says journalists always are. (The lounge has a smoke detector. It probably writes things down too.)`,
      },
      {
        say: N`Which doors on the train are locked right now? Each car has a «door» file, and the shell can list them all with a glob. But «grep -l» wants file *names* as arguments, not text on stdin. «xargs» turns lines of input into arguments for another command.`,
        goal: 'List the locked doors: «ls /srv/meridian/cars/*/door | xargs grep -l LOCKED»',
        hints: ['Type «ls /srv/meridian/cars/*/door | xargs grep -l LOCKED».', '«grep -l» prints just the names of files that match.'],
        check: (e) => !!e.ran('xargs') && /car8_mail/.test(e.out()),
        solve: ['ls /srv/meridian/cars/*/door | xargs grep -l LOCKED'],
        done: N`The locomotive, the baggage car, the staff car — staff-only, as they should be. And «car8_mail»: locked since 23:53:34, refrigerated to four degrees, sealed until Kessel.

You look at the door at the end of the staff car. The one with the customs seal on it. Abel looks at it too.`,
      },
    ],
    outro: N`@Abel: That van is sealed by customs. A staff card opens it from outside — the customs men insist on that, for fires — but once it shuts, it locks itself, and the reader *inside* is dead until doord releases it, or the customs key turns at Kessel. I checked the tamper seal myself at half past ten.
@June: At half past ten. Was the *door* shut at 23:53?

Abel doesn't answer.`,
  });
})();
