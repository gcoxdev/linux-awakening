/* Chapter 2 — Streets of Rootfall (ls flags, man, file, head, tail, less, tree, echo, date) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const LIB = '/usr/share/doc';
  const inLib = (e, r) => { const t = e.targets(r); return t.length ? t.includes(LIB) : e.cwd === LIB; };

  LA.story.add({
    n: 2, id: 'streets', title: 'Streets of Rootfall', place: 'The Great Library & the Chronicle', clock: [0, 15, 30],
    unlocks: ['man', 'less', 'head', 'tail', 'file', 'tree', 'echo', 'date'],
    intro: N`The streets of Rootfall are quieter than they should be.

A baker stands in the doorway of his shop in Old Town, staring at an empty shelf where his recipe books used to be. Two children on a bench are arguing about what day it is, and neither of them is sure.

The note from M. Fen said the Great Library is at «/usr/share/doc». One «cd», if you use the full, absolute path.`,
    steps: [
      {
        goal: 'Go to the Great Library: «cd /usr/share/doc»',
        hints: ['Use an absolute path — it starts with /.', 'Type: «cd /usr/share/doc»'],
        check: (e) => e.cwd === LIB,
        solve: ['cd /usr/share/doc'],
        done: N`:::art
     ___________________________________________________
    |  _____   _____   _____   _____   _____   _____   |
    | |     | |     | |     | |     | |     | |     |  |
    | | MAN | | DOC | |INFO | | ??? | |     | |     |  |
    | |_____| |_____| |_____| |_____| |_____| |_____|  |
    |      T H E   G R E A T   L I B R A R Y           |
    |__________________________________________________|
:::

Shelves climb into the dark. Somewhere, a page turns by itself. A tall woman with ink-stained fingers comes around a stack of books and stops dead.

@Mags: It *is* you. Seven years you came in here every Thursday, and you never once returned a book on time.
@Mags: Lethe has taken your memory — I can see it in your face. But habits live deeper than memories. Let's go and wake them up.`,
      },
      {
        say: N`@Mags: You're looking at my shelves like a tourist. Look at them like a librarian. «ls -l» — the **long** listing.`,
        goal: 'See the shelves in detail: «ls -l»',
        hints: ['A space, then a dash, then a lowercase L: «ls -l»'],
        check: (e) => !!e.ran('ls', (r) => e.has(r, 'l') && inLib(e, r)),
        solve: ['ls -l'],
        done: N`:::art
 -rw-r--r--  1  mags  mags  4211  Oct  5 09:12  catalog.txt
 '----+---'  |  '-+-' '-+-' '-+-' '-----+----'  '----+----'
  permissions|  owner group  size   last changed     name
          links
:::

:::lesson
The bits after the command name — like «-l» — are **options** (also called **flags** or **switches**). They change how a command behaves. Most start with a dash.
:::`,
      },
      {
        say: N`@Mags: Some books are shy. Their names begin with a dot, and «ls» politely hides them — unless you ask for **all** of them: «ls -a».`,
        goal: 'Show everything, hidden files too: «ls -a»',
        hints: ['Type: «ls -a»'],
        check: (e) => !!e.ran('ls', (r) => (e.has(r, 'a') || e.has(r, 'A')) && inLib(e, r)),
        solve: ['ls -a'],
        done: N`«.» and «..» — *here* and *the parent* — and something else. A directory called «.restricted_section».

@Mags: ...which you did *not* see. (She winks.)

:::lesson
Flags combine: «ls -la» is the same as «ls -l -a». Add «-h» for human-readable sizes — «ls -lah» shows 4.0K instead of 4096.
:::`,
      },
      {
        say: N`@Mags: Here's the secret every Operator learns eventually. Every command in Rootfall comes with its own **manual**, written by the people who built it. Ask for one: «man ls».
@Mags: Scroll with the arrow keys or Space. Search with «/» and a word. And when you're done, press **q** to leave.`,
        goal: 'Read the manual for ls: «man ls» (press q to quit it)',
        hints: ['Type «man ls». Inside the manual, press q to get back.'],
        check: (e) => !!e.event('man'),
        solve: ['man ls'],
        done: N`@Mags: **q** to quit. Remember that one forever. It works in «man», in «less», and in a dozen other places that trap people for hours.

:::lesson
In a hurry? «whatis tail» gives a one-line description. «man -k copy» searches every manual for a word.
:::`,
      },
      {
        say: N`@Mags: There's something on the returns cart with no label at all. Before you read an unknown thing, find out what it *is*: «file unlabeled».`,
        goal: 'Identify the mystery item: «file unlabeled»',
        hints: ['Type: «file unlabeled»'],
        check: (e) => !!e.ran('file', (r) => e.targets(r).some((t) => t.endsWith('/unlabeled'))),
        solve: ['file unlabeled'],
        done: N`*ASCII text* — just words. Safe to read.

:::lesson
Names can lie. «file» looks at what's actually *inside*: text, a script, an image, an archive, a program...
:::`,
      },
      {
        goal: 'Read it: «cat unlabeled»',
        hints: ['Type: «cat unlabeled»'],
        check: (e) => e.didRead(LIB + '/unlabeled'),
        solve: ['cat unlabeled'],
        done: N`Your handwriting. Of course it's your handwriting.

Mags reads it over your shoulder and smiles, a little sadly.`,
      },
      {
        say: N`@Mags: The catalog has sixty entries. You don't need all sixty. «head» shows the first ten lines of a file. «head -n 3» shows just the first three.`,
        goal: 'Show the first 3 lines of the catalog: «head -n 3 catalog.txt»',
        hints: ['«-n» means "number of lines". Type: «head -n 3 catalog.txt»'],
        check: (e) => !!e.ran('head', (r) => e.targets(r).some((t) => t.endsWith('/catalog.txt')) && (e.has(r, 'n') || r.args.some((a) => /^-\d+$/.test(a)))),
        solve: ['head -n 3 catalog.txt'],
        done: N`:::lesson
«head -n 3 file» — or the shortcut «head -3 file» — shows the first 3 lines.
:::`,
      },
      {
        say: N`@Mags: And «tail» shows the *end* of a file. In my experience, the end of a list is usually where the interesting things are.`,
        goal: 'Show the end of the catalog: «tail catalog.txt»',
        hints: ['Type: «tail catalog.txt»'],
        check: (e) => !!e.ran('tail', (r) => e.targets(r).some((t) => t.endsWith('/catalog.txt'))),
        solve: ['tail catalog.txt'],
        done: N`*On Forgetting — by {user}. CHECKED OUT (never returned).*

@Mags: Seven years overdue. You wrote a book about forgetting, and then you forgot it. Rootfall has a sense of humour.`,
      },
      {
        say: N`@Mags: Before you go, you should read the city's history. It's long — don't dump it all on the screen with «cat». Use «less», which lets you scroll a file a page at a time. Same keys as the manual. **q** to quit.`,
        goal: 'Read the history of Rootfall: «less rootfall_history.txt»',
        hints: ['Type: «less rootfall_history.txt». Space for next page, q to quit.'],
        check: (e) => e.didRead(LIB + '/rootfall_history.txt') && !!e.ran(['less', 'more']),
        solve: ['less rootfall_history.txt'],
        done: N`*Rootfall was founded in 1991.* For some reason, the number makes Tux puff out his chest.

:::lesson
«cat» dumps everything at once. «less» lets you scroll and search. («more» is its older, simpler cousin. Yes, really: *less is more*.)
:::`,
      },
      {
        say: N`@Mags: One last thing. Come and see the archive wing. «tree» draws a directory and everything inside it as a map.`,
        goal: 'Map the library: «tree»',
        hints: ['Just type «tree» while you are in the library.'],
        check: (e) => !!e.ran('tree'),
        solve: ['tree'],
        done: N`The map shows every shelf... and «archive/», completely empty.

@Mags: Every night something takes more. Last night it took the final shelf. I don't know who's doing this, Operator. But you used to know how to find out.`,
      },
      {
        say: N`@Mags: You'll need to *speak* to the city, not just listen. «echo» repeats whatever you tell it. Try it — say something you mean.
@Mags: Use quotes if your words have spaces or punctuation in them: «echo "I am {user}, and I am going to remember."»`,
        goal: 'Say something to the city with «echo»',
        hints: ['Type «echo» followed by your words in double quotes.', 'For example: «echo "I am {user}, and I am going to remember."»'],
        check: (e) => !!e.ran('echo', (r) => r.args.length > 0),
        solve: ['echo "I am {user}, and I am going to remember."'],
        done: N`The words hang on the screen. They feel truer for being printed.

:::lesson
**Quotes matter.** Double quotes «"..."» keep words together but still allow variables like «$HOME» inside. Single quotes «'...'» keep *everything* exactly as typed.
:::`,
      },
      {
        say: N`@Mags: And know what day it is. Half the city has lost track. «date».`,
        goal: 'Check the date: «date»',
        hints: ['Type: «date»'],
        check: (e) => !!e.ran('date'),
        solve: ['date'],
        done: N`@Mags: If you like your days in a grid, «cal» shows the whole month.

Your note said the Chronicle remembers everything — and the Chronicle lives at «/var/log».`,
      },
      {
        goal: 'Go to the Chronicle: «cd /var/log»',
        hints: ['Absolute path: «cd /var/log»'],
        check: (e) => e.cwd === '/var/log',
        solve: ['cd /var/log'],
        done: N`:::art
    _______________________________________________
   |  T H E   R O O T F A L L   C H R O N I C L E  |
   |_______________________________________________|
   | [syslog] [auth.log] [doors.log] [kern.log]    |
   |   "Every login. Every error. Every door."     |
   |_______________________________________________|
:::

Printing presses thump somewhere below. A man in shirtsleeves with ink up to his elbows looks you over.

@Hal: Hal Mercer, editor. Everything that happens in this city ends up written down here — every login, every error, every door opened. We're the city's memory.
@Hal: Or we were. Until the old editions started vanishing.`,
      },
      {
        say: N`@Hal: Want to know what happened last night? New entries are written at the *bottom* of a log. So: «tail -n 20 syslog» — the last twenty lines.`,
        goal: 'Read the latest news: «tail -n 20 syslog»',
        hints: ['Type: «tail -n 20 syslog»'],
        check: (e) => !!e.ran('tail', (r) => e.targets(r).some((t) => t === '/var/log/syslog') && /lethe\[\d+\]/.test(r.out)),
        nudge: (e) => (e.ran('tail', (r) => e.targets(r).some((t) => t === '/var/log/syslog') && !/lethe/.test(r.out)) ? "@Hal: That's not much of a story. Show me more of the end — twenty lines, say." : null),
        solve: ['tail -n 20 syslog'],
        done: N`There it is again. **lethe**. Every night at 03:00:

  «lethe[451]: sweep started (SAFE_MODE=no, QUARANTINE=/dev/null)»

@Hal: Lethe. You've heard that name before — it's all over your face. It runs every night at three, and every morning the city is lighter.
@Hal: City Hall keeps the permit for everything that runs in Rootfall. They'd know who installed it — and they'd have your address on file. But City Hall doesn't open until dawn.{logLesson}`,
      },
    ],
    outro: N`@Hal: You'll need somewhere to sleep. The Night Market at «/tmp» lets anyone pitch a stall. Just — don't leave anything precious there overnight.

Outside, the streetlamps flicker on, one district at a time.`,
  });
})();
