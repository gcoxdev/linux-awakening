/* Chapter 5 — Rivers of Text (pipes, stdin/stdout/stderr, cut, tr, tee, rev, xargs) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;

  LA.story.add({
    n: 5, id: 'pipes', title: 'Rivers of Text', place: 'The Chronicle archives',
    unlocks: ['tee', 'cut', 'tr', 'xargs', 'rev', 'tac', 'paste', 'column'],
    intro: N`Hal is waiting for you on the steps of the Chronicle with two coffees and no patience.

@Hal: Osei sent word. Hollow, is it? Good. A name is a thread, and I've got a building full of threads.
@Hal: But you can't *read* this place. The doors log alone has fifteen hundred lines. You have to make the text flow — pour it from one tool into the next until only the answer is left.

:::art
   cat file ──▶ grep ──▶ sort ──▶ uniq -c ──▶ sort -rn ──▶ head ──▶ the answer
:::`,
    steps: [
      {
        goal: 'Go back to the Chronicle: «cd /var/log»',
        hints: ['Type: «cd /var/log»'],
        check: (e) => e.cwd === '/var/log',
        solve: ['cd /var/log'],
        done: N`@Hal: «doors.log». Every time any door in Rootfall opens, a line gets written here: when, who, which door, what they did.`,
      },
      {
        say: N`@Hal: Lesson one. The **pipe** «|» takes the output of one command and pours it into the input of the next. So instead of reading fifteen hundred lines, count them:
«cat doors.log | wc -l»`,
        goal: 'Count the lines of doors.log through a pipe: «cat doors.log | wc -l»',
        hints: ['The pipe character «|» is usually Shift + backslash.', 'Type: «cat doors.log | wc -l»'],
        check: (e) => e.pipe && !!e.ran('wc', (r) => e.has(r, 'l')),
        solve: ['cat doors.log | wc -l'],
        done: N`:::art
                 stdout          stdin
   cat doors.log ───────▶  |  ───────▶  wc -l  ───▶  screen
:::

:::lesson
Every command has three standard streams: **stdin** (input, 0), **stdout** (normal output, 1) and **stderr** (errors, 2). A pipe connects one command's stdout to the next command's stdin. (Here «wc -l doors.log» would also work — but pipes let you chain *anything*.)
:::`,
      },
      {
        say: N`@Hal: Now ask a real question. Which doors were opened at *your* home recently? Filter with grep, then keep only the last few lines with tail:
«grep 'door=/home/{user}' doors.log | tail -n 5»`,
        goal: 'Who touched your door? «grep \'door=/home/{user}\' doors.log | tail -n 5»',
        hints: ['grep filters the lines; tail keeps the last five.', "Type: «grep 'door=/home/{user}' doors.log | tail -n 5»"],
        check: (e) => e.pipe && !!e.ran('grep', (r) => r.args.some((a) => a.includes('/home/' + e.game.user))) && !!e.ran('tail'),
        solve: ["grep 'door=/home/{user}' doors.log | tail -n 5"],
        done: N`«user=hollow door=/home/{user} action=chmod:000»

At 02:58, three nights ago, Hollow changed the lock on your door. *chmod 000* — no one may enter. Not even you.

Tux makes a noise you didn't know penguins could make.`,
      },
      {
        say: N`@Hal: Let's see who's been busiest. Each line has fields separated by spaces; the second field is the user. «cut» slices out columns: «-d» says what separates them, «-f» says which field you want.`,
        goal: 'Pull out just the user field: «cut -d\' \' -f2 doors.log | head»',
        hints: ["«-d' '» means the delimiter is a space (quoted, so the shell keeps it).", "Type: «cut -d' ' -f2 doors.log | head»"],
        check: (e) => !!e.ran('cut', (r) => e.has(r, 'd') && e.has(r, 'f')),
        solve: ["cut -d' ' -f2 doors.log | head"],
        done: N`A column of «user=...» values. Raw material.`,
      },
      {
        say: N`@Hal: Now, the classic. Every Operator has typed this a thousand times. *Who opens the most doors in Rootfall?*
«cut -d' ' -f2 doors.log | sort | uniq -c | sort -rn | head -n 5»`,
        goal: 'Rank the busiest users: cut | sort | uniq -c | sort -rn | head -n 5',
        hints: ['Build it up one pipe at a time if you like: cut, then add | sort, then | uniq -c ...', "«sort -rn» sorts numerically (-n), biggest first (-r).", "Type: «cut -d' ' -f2 doors.log | sort | uniq -c | sort -rn | head -n 5»"],
        check: (e) => !!e.ran('uniq', (r) => e.has(r, 'c')) && !!e.ran('sort', (r) => e.has(r, 'n') && e.has(r, 'r')),
        solve: ["cut -d' ' -f2 doors.log | sort | uniq -c | sort -rn | head -n 5"],
        done: N`«user=hollow» is near the top of the list — a person who isn't in the census has opened more doors in three nights than most citizens open in a month.

@Hal: There's your ghost.

:::lesson
«sort -n» sorts by **number** (so 10 comes after 9, not after 1). «-r» reverses. Pipelines like this one — *slice, sort, count, rank* — answer an astonishing number of questions.
:::`,
      },
      {
        say: N`@Hal: Search every log in the building for him: «grep -r hollow /var/log». Some of our archives are sealed, and they'll complain about it.`,
        goal: 'Search all the logs: «grep -r hollow /var/log»',
        hints: ['Type: «grep -r hollow /var/log»'],
        check: (e) => !!e.tried('grep', (r) => (e.has(r, 'r') || e.has(r, 'R')) && r.args.includes('hollow')),
        solve: ['grep -r hollow /var/log'],
        done: N`Useful lines — mixed with «Permission denied» noise from the sealed archives.

:::lesson
That noise comes out on **stderr** (stream 2), not stdout. Which means you can send it somewhere else on its own.
:::`,
      },
      {
        say: N`@Hal: Silence the complaints. «2>» redirects stream 2 — the errors. And «/dev/null» — the Void — swallows anything thrown into it.
«grep -r hollow /var/log 2>/dev/null»`,
        goal: 'Run the same search, throwing errors into the Void: add «2>/dev/null»',
        hints: ['No space between 2 and >.', 'Type: «grep -r hollow /var/log 2>/dev/null»'],
        check: (e) => /2>\s*\/dev\/null/.test(e.line) && !!e.tried('grep'),
        solve: ['grep -r hollow /var/log 2>/dev/null'],
        done: N`Clean. Just the evidence.

Tux stares at the words «/dev/null» and shivers. That's where they found you.

:::lesson
«>» sends stdout to a file · «2>» sends stderr · «2>&1» sends stderr wherever stdout is going · «&>» sends both. «/dev/null» discards whatever it is given.
:::`,
      },
      {
        say: N`@Hal: Keep the evidence. «tee» is a T-junction for pipes: it writes everything into a file *and* passes it along unchanged.
«grep hollow doors.log | tee /tmp/evidence.txt | wc -l»`,
        goal: 'Save Hollow\'s door records while counting them: use «tee /tmp/evidence.txt» in a pipe',
        hints: ["Type: «grep hollow doors.log | tee /tmp/evidence.txt | wc -l»"],
        check: (e) => /hollow/.test(e.read('/tmp/evidence.txt') || ''),
        solve: ['grep hollow doors.log | tee /tmp/evidence.txt | wc -l'],
        done: N`One copy saved to «/tmp/evidence.txt», and the count on screen.`,
      },
      {
        say: N`@Hal: Now — tips. Someone has been sending the Chronicle anonymous letters. The first one is all in capitals, like the writer was shouting.
@Hal: «tr» *translates* characters, but it only reads its input, never a file name. Feed it a file with «<»:
«tr 'A-Z' 'a-z' < chronicle/tips/shouting.txt»`,
        goal: 'Calm the shouting letter down: «tr \'A-Z\' \'a-z\' < chronicle/tips/shouting.txt»',
        hints: ['«<» feeds a file into a command\'s stdin.', "Type: «tr 'A-Z' 'a-z' < chronicle/tips/shouting.txt»"],
        check: (e) => !!e.ran('tr') && /</.test(e.line) && /shouting/.test(e.line),
        solve: ["tr 'A-Z' 'a-z' < chronicle/tips/shouting.txt"],
        done: N`*the one who calls himself hollow comes in through the lighthouse. he carries a copy of the keeper's key.*

The receipt from Ingrid's stall. *1 x copy of a key (marked: wren@lighthouse).*`,
      },
      {
        say: N`@Hal: The second tip is in the tipster's favourite cipher: ROT13. Every letter is shifted thirteen places along the alphabet. Shift it thirteen more and you're back where you started:
«tr 'A-Za-z' 'N-ZA-Mn-za-m' < chronicle/tips/cipher.txt»`,
        goal: 'Decode the ROT13 letter with «tr»',
        hints: ["Type: «tr 'A-Za-z' 'N-ZA-Mn-za-m' < chronicle/tips/cipher.txt»"],
        check: (e) => !!e.ran('tr', (r) => /Undercroft/.test(r.out)),
        solve: ["tr 'A-Za-z' 'N-ZA-Mn-za-m' < chronicle/tips/cipher.txt"],
        done: N`*The Operator kept BACKUPS beneath the city, in the Undercroft. The disk is called sdb. Nobody has mounted it since.*

Backups. Somewhere under the city, a copy of who you were.`,
      },
      {
        say: N`@Hal: And the last one is written backwards. Naturally. «rev» reverses every line.`,
        goal: 'Read the mirror letter: «rev chronicle/tips/mirror.txt»',
        hints: ['Type: «rev chronicle/tips/mirror.txt»'],
        check: (e) => !!e.ran('rev'),
        solve: ['rev chronicle/tips/mirror.txt'],
        done: N`*Your door was locked from the outside. But it is still YOUR door. You own it. Owners can always change the lock. — M.*

@Hal: "M." Someone who knows you. Someone who knows where you live.`,
      },
      {
        say: N`@Hal: One more trick before you go. The old archive editions are scattered files ending in «.old». Let's size them up.
@Hal: «xargs» takes a list of lines on its input and turns them into *arguments* for another command:
«find chronicle/archive -name '*.old' | xargs wc -l»`,
        goal: 'Count lines in every archive file: «find chronicle/archive -name \'*.old\' | xargs wc -l»',
        hints: ["find prints the paths; xargs hands them to wc as arguments.", "Type: «find chronicle/archive -name '*.old' | xargs wc -l»"],
        check: (e) => !!e.ran('xargs'),
        solve: ["find chronicle/archive -name '*.old' | xargs wc -l"],
        done: N`Five files, three hundred and nine lines of faded history. Everything else is gone.

:::lesson
A pipe sends text to a command's **stdin**. But many commands (like «wc», «rm», «cp») want file names as **arguments**. «xargs» bridges the two.
:::`,
      },
    ],
    outro: N`@Hal: So. Hollow changed the lock on your door at 02:58 three nights ago and walked away.
@Hal: But your tipster's right, Operator. It's still *your* door. Go home.`,
  });
})();
