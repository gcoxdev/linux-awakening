/* Night Train, Chapter 3 — The Case File (mkdir, cp, mv, touch, echo, >, >>, nano, rm, rmdir, globs) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const pack = LA.stories.nighttrain;
  const PA = '/srv/meridian/pa/announce';

  pack.add({
    n: 3, id: 'casefile', title: 'The Case File', place: 'km 70 · Ashford', clock: [1, 0, 41],
    unlocks: ['mkdir', 'cp', 'mv', 'touch', 'echo', 'nano', 'rm', 'rmdir'],
    intro: N`Vesna's rule two: *never work on the only copy of anything.* Whoever edits logs on this train hasn't finished — and you'd like to have copies before they come back for more.

@June: Are we making a case file? Like detectives? Can it have my statement in it? I'm a witness. I *saw* someone.`,
    steps: [
      {
        say: N`A case file is a directory. «mkdir» makes one; «-p» makes any missing parents too, so «mkdir -p ~/case/evidence» builds «case» *and* «evidence» inside it in one go.`,
        goal: 'Make your case folders: «mkdir -p ~/case/evidence»',
        hints: ['Type «mkdir -p ~/case/evidence».'],
        check: (e) => { const n = e.node(e.home + '/case/evidence'); return !!n && n.type === 'dir'; },
        solve: ['mkdir -p ~/case/evidence'],
        done: N`«~/case/evidence» — empty, for now.`,
      },
      {
        say: N`Copy the hour before midnight into it. «cp SOURCE DESTINATION» copies a file; if the destination is a directory, the copy keeps its name.`,
        goal: 'Copy the old door log: «cp /var/log/meridian/doors.log.1 ~/case/evidence/»',
        hints: ['Type «cp /var/log/meridian/doors.log.1 ~/case/evidence/».'],
        check: (e) => { const c = e.read(e.home + '/case/evidence/doors.log.1'); return !!c && c === e.read('/var/log/meridian/doors.log.1'); },
        nudge: (e) => (e.node(e.home + '/case/evidence/doors.log.1') && !e.read(e.home + '/case/evidence/doors.log.1') ? '@June: That file\'s *empty*. It has to be a copy of the real log — «cp».' : null),
        solve: ['cp /var/log/meridian/doors.log.1 ~/case/evidence/'],
        done: N`A copy no one else knows about. Rule two, obeyed.`,
      },
      {
        say: N`Now everything in the baggage car at once. The shell expands «*» into every file name in the directory *before* «cp» even runs — that's a **glob**.`,
        goal: 'Copy all the baggage car\'s files: «cp /srv/meridian/cars/car2_baggage/* ~/case/evidence/»',
        hints: ['Type «cp /srv/meridian/cars/car2_baggage/* ~/case/evidence/».'],
        check: (e) => ['safe.log', 'status', 'decoy.jpg'].every((f) => e.node(e.home + '/case/evidence/' + f)),
        solve: ['cp /srv/meridian/cars/car2_baggage/* ~/case/evidence/'],
        done: (g) => N`Six files copied. Not seven: «*» doesn't match names that start with a dot, so «.fault_ticket» stayed behind. Globs, like «ls», leave hidden files alone unless you ask for them by name.

:::lesson
Globs: «*» any characters · «?» exactly one character · «[0-9]» one character from a set. «doors.log.?» would match «doors.log.1» and «doors.log.2» but not «doors.log».
:::`,
      },
      {
        say: N`«status» isn't a useful name in a folder full of evidence. «mv» *moves* a file — and moving it to a new name in the same place is how you rename things.`,
        goal: 'Rename it: «mv ~/case/evidence/status ~/case/evidence/car2_status.txt»',
        hints: ['Type «mv ~/case/evidence/status ~/case/evidence/car2_status.txt».'],
        check: (e) => !!e.node(e.home + '/case/evidence/car2_status.txt') && !e.node(e.home + '/case/evidence/status'),
        solve: ['mv ~/case/evidence/status ~/case/evidence/car2_status.txt'],
        done: N`Same file, better name.`,
      },
      {
        say: N`Start a timeline. «echo» prints whatever you give it, and «>» **redirects** that output into a file instead of the screen — creating the file, or *replacing* everything in it.`,
        goal: 'Start the timeline: «echo "23:38 safe alarm, Vesna paged" > ~/case/timeline.txt»',
        hints: ['Type it exactly, quotes included: «echo "23:38 safe alarm, Vesna paged" > ~/case/timeline.txt»'],
        check: (e) => /23:38/.test(e.read(e.home + '/case/timeline.txt') || ''),
        solve: ['echo "23:38 safe alarm, Vesna paged" > ~/case/timeline.txt'],
        done: N`One line written. The quotes keep the whole sentence together as one argument to «echo».`,
      },
      {
        say: N`Add the next line. Careful: another «>» would wipe the file and start over. «>>» **appends** to the end.`,
        goal: 'Append: «echo "23:52 Vesna enters the staff car. Nothing after." >> ~/case/timeline.txt»',
        hints: ['Two arrows: «>>». Type: «echo "23:52 Vesna enters the staff car. Nothing after." >> ~/case/timeline.txt»'],
        check: (e) => { const t = e.read(e.home + '/case/timeline.txt') || ''; return /23:38/.test(t) && /23:52/.test(t); },
        nudge: (e) => { const t = e.read(e.home + '/case/timeline.txt') || ''; return /23:52/.test(t) && !/23:38/.test(t) ? '@June: Your first line\'s gone. That was one arrow, not two. Put 23:38 back with «>» and then add 23:52 with «>>».' : null; },
        solve: ['echo "23:52 Vesna enters the staff car. Nothing after." >> ~/case/timeline.txt'],
        done: N`:::lesson
«>» replace · «>>» append · «cat file» to check. The single most common accident on any Linux system is a «>» where a «>>» was meant.
:::`,
      },
      {
        say: N`«touch» creates an empty file (or updates the time on an existing one). Make a place for names.`,
        goal: 'Create an empty suspects file: «touch ~/case/suspects.txt»',
        hints: ['Type «touch ~/case/suspects.txt».'],
        check: (e) => !!e.node(e.home + '/case/suspects.txt'),
        solve: ['touch ~/case/suspects.txt'],
        done: N`Empty. June looks at it meaningfully.`,
      },
      {
        say: N`@June: My statement. Write it down exactly. *"At 23:52 I went to the toilet in B-car. A tall man in a grey coat went past me toward the back of the train, behind a lady in an orange jacket. He didn't say sorry."*
«nano» is a simple text editor. Type the statement, then press **Ctrl+O** and **Enter** to save, and **Ctrl+X** to exit.`,
        goal: 'Write June\'s statement in «nano ~/case/witness_june.txt» — it must mention the grey coat',
        hints: ['Type «nano ~/case/witness_june.txt», then type the statement.', 'Save with Ctrl+O, then Enter. Leave with Ctrl+X.', 'The file must contain the words "grey coat".'],
        check: (e) => /grey/i.test(e.read(e.home + '/case/witness_june.txt') || ''),
        nudge: (e) => (e.ran('nano') && !e.node(e.home + '/case/witness_june.txt') ? '@June: You didn\'t save it! Ctrl+O, then Enter, *then* Ctrl+X.' : null),
        solve: [{ edit: () => 'At 23:52 I went to the toilet in B-car. A tall man in a grey coat went past me toward the back of the train, behind a lady in an orange jacket. He didn\'t say sorry.\n— June Castellanos, B14, age 12\n' }, 'nano ~/case/witness_june.txt'],
        done: N`@June: "Age 12." Put that in. They take you more seriously if you tell them, because then they're surprised.

An orange jacket — Vesna's hi-vis. And a tall man in a grey coat, following her toward the back of the train, toward the staff car, at the very minute her card opened its door.`,
        evidence: 'witness',
      },
      {
        say: N`@June: I want my own copy. Called «June statement.txt». With a space. That's my *name* for it.
The shell splits words at spaces, so «cp witness_june.txt June statement.txt» would mean *three* names. Quote a name with spaces in it, and the shell keeps it as one.`,
        goal: 'Copy June\'s statement to «~/case/June statement.txt» — quote the name: «cp ~/case/witness_june.txt ~/case/"June statement.txt"»',
        hints: ['The «~» isn\'t expanded inside quotes, so quote only the part with the space: «cp ~/case/witness_june.txt ~/case/"June statement.txt"»', 'A backslash before the space works too: «~/case/June\\ statement.txt».'],
        check: (e) => /grey/i.test(e.read(e.home + '/case/June statement.txt') || ''),
        nudge: (e) => (e.tried('cp') && !e.node(e.home + '/case/June statement.txt') ? '@June: That\'s not my file. The space split it in two. Put quotes round the name — but not round the «~».' : null),
        solve: ['cp ~/case/witness_june.txt ~/case/"June statement.txt"'],
        done: N`«ls ~/case» lists it as «'June statement.txt'» — with quotes, so you can tell it's one name.

:::lesson
Spaces separate words, so names containing them need **quotes** («"June statement.txt"») or a **backslash** before each space («June\ statement.txt»). Inside double quotes «$VAR» still works but «~» doesn't, so quote just the part that needs it.
:::`,
      },
      {
        setup: (g) => {
          const d = g.home + '/case/junes_stuff';
          if (!g.fs.tryGet(d)) g.fs.dir(d, { owner: g.user, group: g.user, mode: 0o755 });
          g.fs.put(d + '/doodle.txt', '   ____\n  |    |___   <- the meridian\n  \'-oo----oo\'\n', { owner: g.user, group: g.user });
        },
        say: N`While you were typing, June borrowed the keyboard and "helped": there's now a «~/case/junes_stuff» folder with a drawing of a train in it.
«rm» removes a file — for good; there's no wastebasket. «rmdir» removes a directory, but only an empty one.`,
        goal: 'Tidy up: «rm ~/case/junes_stuff/doodle.txt», then «rmdir ~/case/junes_stuff»',
        hints: ['First the file: «rm ~/case/junes_stuff/doodle.txt»', 'Then the now-empty folder: «rmdir ~/case/junes_stuff»'],
        check: (e) => !e.node(e.home + '/case/junes_stuff'),
        solve: ['rm ~/case/junes_stuff/doodle.txt', 'rmdir ~/case/junes_stuff'],
        done: N`@June: It was a *good* drawing.

:::lesson
«rmdir» refuses to remove a directory that still has something in it — a deliberate safety catch. «rm -r» removes a directory *and everything in it*, with no catch at all. Read the path twice before you press Enter.
:::`,
      },
      {
        setup: (g) => { const n = g.fs.tryGet(PA); if (n) n.content = ''; },
        say: N`@Abel: I want everyone in their cabin. Put it on the speakers.
The PA reads out whatever is written into «/srv/meridian/pa/announce». Redirect a sentence into it.`,
        goal: 'Make an announcement: «echo "Passengers are asked to stay in their cabins until further notice." > /srv/meridian/pa/announce»',
        hints: ['Type: «echo "Passengers are asked to stay in their cabins until further notice." > /srv/meridian/pa/announce»', 'Any polite sentence will do, as long as it goes into /srv/meridian/pa/announce.'],
        check: (e) => (e.read(PA) || '').trim().length > 10,
        solve: ['echo "Passengers are asked to stay in their cabins until further notice." > /srv/meridian/pa/announce'],
        done: (g) => `:::art
  ((( PA )))   ${(g.fs.contentOf(g.fs.get(PA)) || '').trim().replace(/[«»]/g, '')}
:::
Every speaker in the train says it at once, in a flat synthesised voice. Somewhere in sleeper A, a door that had been opening closes again.`,
      },
    ],
    outro: N`@June: A tall man in a grey coat. How many tall men are there on this train?
@Abel: Several. And none of them are going anywhere.`,
  });
})();
