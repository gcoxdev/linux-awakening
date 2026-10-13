/* Night Train, Chapter 2 — Reading the Train (date, tree, head, tail, wc, man, less, apropos, whatis, file) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const pack = LA.stories.nighttrain;
  const LOG = '/var/log/meridian';
  const PAX = '/srv/meridian/manifest/passengers.csv';

  pack.add({
    n: 2, id: 'reading', title: 'Reading the Train', place: 'mile 36 · Ashford Viaduct', clock: [1, 0, 27],
    unlocks: ['date', 'tree', 'head', 'tail', 'wc', 'man', 'less', 'apropos', 'whatis', 'file'],
    intro: N`The Meridian rolls onto the Ashford Viaduct, and for a minute there's nothing outside the window at all — just black air, and a river three hundred feet down.

@June: Every door on this train writes down who opened it. With the time. To the second. Did you know that?
@June: ...You did know that. You're the engineer.

Vesna's rule three: *if something is strange, write down the time.*`,
    steps: [
      {
        say: N`Start with the time. «date» prints the system's date and time.`,
        goal: 'Check the time: «date»',
        hints: ['Type «date».'],
        check: (e) => !!e.ran('date'),
        solve: ['date'],
        done: N`Twenty-something past midnight. Kessel Junction — the border, and the police — is at 04:40.`,
      },
      {
        say: N`Get the shape of the train before you dig. «tree» draws a directory and everything below it.`,
        goal: 'Draw the train\'s directory tree: «tree /srv/meridian»',
        hints: ['Type «tree /srv/meridian».'],
        check: (e) => !!e.ran('tree', (r) => e.targets(r).includes('/srv/meridian')),
        solve: ['tree /srv/meridian'],
        done: N`Eight cars, a manifest, a timetable, a PA system. Smaller than it felt from the bunk.`,
      },
      {
        say: N`Who's aboard? The manifest is a CSV — comma-separated values, one passenger per line. «head» shows the first lines of a file; «-n 5» says how many.`,
        goal: 'Show the first 5 lines of the passenger list: «head -n 5 /srv/meridian/manifest/passengers.csv»',
        hints: ['Type «head -n 5 /srv/meridian/manifest/passengers.csv».', 'Without «-n 5», head shows ten lines.'],
        check: (e) => !!e.ran('head', (r) => e.targets(r).includes(PAX) && /A3,Lucien Marsh/.test(r.out)),
        nudge: (e) => (e.ran('head', (r) => e.targets(r).includes(PAX) && !/A3,/.test(r.out)) ? '@June: That\'s not even as far as cabin A3. Five lines.' : null),
        solve: ['head -n 5 /srv/meridian/manifest/passengers.csv'],
        done: N`«cabin,name,card,boarded,destination» — the first line is a **header** naming the columns. Then «A3,Lucien Marsh,1103,...» — the helpful insurance man, two doors from the conservator.`,
      },
      {
        say: N`How many? «wc» counts lines, words and bytes; «-l» counts only lines.`,
        goal: 'Count the lines in the passenger list: «wc -l /srv/meridian/manifest/passengers.csv»',
        hints: ['Type «wc -l /srv/meridian/manifest/passengers.csv».'],
        check: (e) => !!e.ran('wc', (r) => e.has(r, 'l') && e.targets(r).includes(PAX)),
        solve: ['wc -l /srv/meridian/manifest/passengers.csv'],
        done: N`Nineteen lines. Minus the header: **18 passengers**, plus five crew. Twenty-three people in eight cars, and one of them has the Atlas.`,
      },
      {
        say: N`Now the doors. New lines are added at the *bottom* of a log, so «tail» — the last ten lines — is the newest news.`,
        goal: 'See the latest door events: «tail /var/log/meridian/doors.log»',
        hints: ['Type «tail /var/log/meridian/doors.log».'],
        check: (e) => !!e.ran('tail', (r) => e.targets(r).includes(LOG + '/doors.log')),
        solve: ['tail /var/log/meridian/doors.log'],
        done: N`«00:12:05 0101 car2_baggage OPEN» — Abel, with Dr. Brandt, finding the timetable.

Each line is *time · card · door · action*. Cards starting «01» and «02» are crew; «11» and «12» are passenger cabins.`,
      },
      {
        say: N`That log only starts at midnight. At midnight the old one was renamed «doors.log.1» and a fresh one begun — that's called **log rotation**. Tonight's interesting hour is in «doors.log.1».
How far back can «tail» reach? Ask its **manual**: «man tail». Scroll with the arrow keys or Space, and press «q» to quit.`,
        goal: 'Read the manual for tail: «man tail» (q to quit)',
        hints: ['Type «man tail». Press q when you\'ve read enough.'],
        check: (e) => !!e.event('man', (ev) => ev.name === 'tail'),
        solve: ['man tail'],
        done: N`«-n NUM» — output the last NUM lines instead of ten. Every command has a manual. Engineers who say they don't read them are lying.`,
      },
      {
        say: N`Use it: the last thirty lines of the hour before midnight.`,
        goal: 'Show the last 30 lines of the old log: «tail -n 30 /var/log/meridian/doors.log.1»',
        hints: ['Type «tail -n 30 /var/log/meridian/doors.log.1».'],
        check: (e) => !!e.ran('tail', (r) => e.targets(r).includes(LOG + '/doors.log.1') && /0201 car7_staff/.test(r.out)),
        solve: ['tail -n 30 /var/log/meridian/doors.log.1'],
        done: N`There she is. Card «0201» — Vesna — walking back through the train from 23:51: dining car, lounge, sleeper A, sleeper B...

«23:52:55 0201 car7_staff OPEN»

The staff car. *This* car. And then nothing. Not another door, all night.`,
      },
      {
        say: N`Thirty lines is a keyhole. «less» opens a whole file in a pager you can move around in: arrows and Space to scroll, «/» followed by a word to search, «n» for the next match, «q» to quit. Search it for her card.`,
        goal: 'Open the whole hour in a pager: «less /var/log/meridian/doors.log.1» (try searching with /0201)',
        hints: ['Type «less /var/log/meridian/doors.log.1». Inside, type /0201 and Enter to search. q quits.'],
        check: (e) => !!e.ran('less', (r) => e.targets(r).includes(LOG + '/doors.log.1')),
        solve: ['less /var/log/meridian/doors.log.1'],
        done: N`:::lesson
«less» keys: **Space** / **b** page down and up · **g** / **G** top and bottom · **/word** search · **n** next match · **q** quit. «man» uses the same pager.
:::`,
      },
      {
        say: N`@June: Can the computer tell if someone *changed* a file? Like, compare two of them? What's that command called?
You don't know either. When you don't know a command's name, «apropos» searches every manual's one-line description for a word. «whatis» gives the one-line description of a command you've found.`,
        goal: 'Search the manuals: «apropos compare», then «whatis cmp»',
        hints: ['«apropos compare» lists commands whose description mentions "compare".', 'Then «whatis cmp».'],
        check: (e) => e.stepRan('apropos') && e.stepRan('whatis'),
        solve: ['apropos compare', 'whatis cmp'],
        done: N`«cmp» compares two files byte by byte; «diff» compares them line by line. You'll want both before the night is out.

@June: I'm writing those down too.`,
      },
      {
        say: N`Back in the baggage car there were two files you didn't open: «decoy.jpg» and «certificate». Names lie — anyone can call a file anything. «file» looks *inside* and tells you what it really is. A «*» means *every file here*.`,
        goal: 'Identify every file in the baggage car: «file /srv/meridian/cars/car2_baggage/*»',
        hints: ['Type «file /srv/meridian/cars/car2_baggage/*».'],
        check: (e) => !!e.ran('file', (r) => /JPEG/.test(r.out) && /PDF/.test(r.out)),
        solve: ['file /srv/meridian/cars/car2_baggage/*'],
        done: N`«certificate: PDF document» — the Atlas's provenance, no extension needed.
«decoy.jpg: JPEG image data ... comment: "Photographed by O. Brandt 00:13..."» — photos carry text inside them, and «file» reads it out.`,
      },
    ],
    outro: N`@Abel: Hallin Junction at 01:38. The doors stay shut. Nobody gets off this train until there's a policeman on the platform.
@Abel: The staff car, you said. Her card stopped at *our* car. She'd have walked straight past your bunk.

You were asleep. You didn't hear a thing.`,
  });
})();
