/* Chapter 4 — City Hall (grep, find, wc, sort, uniq, which, type, whereis, locate) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const on = (e, r, suffix) => e.targets(r).some((t) => t.endsWith(suffix));

  LA.story.add({
    n: 4, id: 'cityhall', title: 'City Hall', place: '/etc',
    unlocks: ['grep', 'find', 'wc', 'sort', 'uniq', 'which', 'whereis', 'type', 'locate'],
    intro: N`City Hall squats at the top of «/etc» behind a row of columns that have seen better centuries.

:::art
        _____________________________________
       /                                     \
      /       C I T Y   H A L L   ( /etc )    \
     /_________________________________________\
      |  |    |  |    |  |    |  |    |  |    |
      |  |    |  |    |  |    |  |    |  |    |
      |  |    |  |    |  |    |  |    |  |    |
    __|__|____|__|____|__|____|__|____|__|____|__
:::

Inside, a clerk in half-moon spectacles is stamping documents with real enthusiasm.`,
    steps: [
      {
        goal: 'Enter City Hall: «cd /etc»',
        hints: ['Type: «cd /etc»'],
        check: (e) => e.cwd === '/etc',
        solve: ['cd /etc'],
        done: N`@Osei: Osei Bramble, clerk of records. Everything this city *is* gets written down here: who lives where, which services run, which doors open.
@Osei: The register of every citizen is a file called «passwd». Don't let the name fool you — there are no passwords in it anymore. Those moved to «/etc/shadow», which only root may read.

:::lesson
**/etc** holds a Linux system's configuration: plain text files you can read (and, as root, edit).
:::`,
      },
      {
        say: N`@Osei: How many accounts are registered? Don't count by hand. «wc» counts — and «wc -l» counts *lines*.`,
        goal: 'Count the lines in the citizen register: «wc -l passwd»',
        hints: ['Type: «wc -l passwd»'],
        check: (e) => !!e.ran('wc', (r) => e.has(r, 'l') && on(e, r, '/etc/passwd')),
        solve: ['wc -l passwd'],
        done: N`:::lesson
«wc» = *word count*. «-l» lines, «-w» words, «-c» bytes. Every line of «passwd» is one account.
:::`,
      },
      {
        say: N`@Osei: Now find *your* entry. «grep» searches for lines matching a pattern and prints only those: «grep {user} passwd».`,
        goal: 'Find yourself in the register: «grep {user} passwd»',
        hints: ['«grep PATTERN FILE» prints the lines of FILE that contain PATTERN.', 'Type: «grep {user} passwd»'],
        check: (e) => !!e.ran('grep', (r) => on(e, r, '/etc/passwd') && r.out.includes(e.game.user + ':')),
        solve: ['grep {user} passwd'],
        done: N`:::art
 {user}:x:1000:1000:{User},,,City Operator:/home/{user}:/bin/bash
   |    |  |    |          |                     |          '- login shell
   |    |  |    |          |                     '- home directory
   |    |  |    |          '- full name & description
   |    |  |    '- group id (gid)
   |    |  '- user id (uid)
   |    '- password: kept in /etc/shadow
   '- username
:::

«/home/{user}». Your home. You knew that — your fingers knew it.`,
      },
      {
        say: N`@Osei: Lethe, you say? Every daemon in Rootfall needs a permit. The register is «city/permits.txt». Mind you, my predecessors were sloppy with capital letters — use «-i» to ignore case.`,
        goal: 'Search the permits for lethe, ignoring case: «grep -i lethe city/permits.txt»',
        hints: ['«-i» makes grep ignore upper/lower case.', 'Type: «grep -i lethe city/permits.txt»'],
        check: (e) => !!e.ran('grep', (r) => e.has(r, 'i') && /lethe/i.test(r.args.join(' ')) && on(e, r, 'permits.txt')),
        solve: ['grep -i lethe city/permits.txt'],
        done: N`*PERMIT 0451 — Lethe nightly sweeper — filed by: {user} — APPROVED.*

You built Lethe.

@Osei: Approved it myself. Big stamp. Very proud of that stamp. Look — that second line's different. An *amendment*.`,
      },
      {
        say: N`@Osei: Which lines exactly mention permit 0451? «-n» prints line numbers alongside each match.`,
        goal: 'Find permit 0451 with line numbers: «grep -n 0451 city/permits.txt»',
        hints: ['Type: «grep -n 0451 city/permits.txt»'],
        check: (e) => !!e.ran('grep', (r) => e.has(r, 'n') && r.args.includes('0451')),
        solve: ['grep -n 0451 city/permits.txt'],
        done: N`*AMENDMENT 0451-B — LETHE: expand TARGETS — filed by: hollow — NOT REVIEWED, filed after hours.*

@Osei: Hollow. There's no citizen called Hollow. I'd know — I stamped every one of them.`,
      },
      {
        say: N`@Osei: Then let's search *every* drawer in City Hall for the word lethe. «grep -r» searches recursively, through a whole directory tree. Some drawers are locked; ignore their complaints.`,
        goal: 'Search all of /etc for lethe: «grep -r lethe /etc»',
        hints: ['«-r» = recursive. Give grep a directory instead of a file.', 'Type: «grep -r lethe /etc»'],
        check: (e) => !!e.tried('grep', (r) => (e.has(r, 'r') || e.has(r, 'R')) && /lethe/i.test(r.args.join(' '))),
        solve: ['grep -r lethe /etc'],
        done: N`Hits in «/etc/lethe/lethe.conf» and «/etc/systemd/system/lethe.service» — plus a few angry *Permission denied* lines from drawers only root may open. (The permit itself says «Lethe» with a capital L, so it slipped through; «grep -ri» would have caught it too.)

:::lesson
Useful grep flags: «-i» ignore case · «-n» line numbers · «-r» recursive · «-v» invert (lines that *don't* match) · «-c» count matches · «-l» just file names · «-w» whole words.
:::`,
      },
      {
        say: N`@Osei: grep looks *inside* files. To search for files by their *name*, you want «find». And — this is strange — people keep reporting odd files turning up around the city. Files called «memory_» something.
@Osei: «find / -name 'memory_*'» will search the entire city. Quote the pattern, so the shell doesn't try to expand the star itself.`,
        goal: 'Search the whole city for memory files: «find / -name \'memory_*\'»',
        hints: ['«find WHERE -name PATTERN». WHERE is «/», the whole city.', "Type: «find / -name 'memory_*'»"],
        check: (e) => !!e.tried('find', (r) => r.args.includes('-name') && r.args.some((a) => /memory/.test(a))),
        solve: ["find / -name 'memory_*'", 'cat /hospital/basement/lost_and_found/memory_01.txt', 'cat /usr/share/doc/.restricted_section/memory_02.txt', 'cat /opt/.arcade/memory_03.txt'],
        done: N`Memories. *Your* memories, scattered across the city like dropped coins: one in the hospital basement, one in the library's restricted section, one somewhere under «/opt» in a place that doesn't even appear on maps...

...and more behind doors that wouldn't open for find.

@Tux: (Tux looks at the list, then at you, then at the list again. He seems to think you should go and collect them. Reading one with «cat» brings it back.)

:::lesson
Those «Permission denied» lines are noise printed on a separate channel. In the next chapter you'll learn to silence them.
:::`,
      },
      {
        say: N`@Osei: find can filter by type, too: «-type f» for regular files, «-type d» for directories. What actually lives in «/etc/lethe»?`,
        goal: 'List only the files in /etc/lethe: «find /etc/lethe -type f»',
        hints: ['Type: «find /etc/lethe -type f»'],
        check: (e) => !!e.tried('find', (r) => r.args.includes('-type')),
        solve: ['find /etc/lethe -type f'],
        done: N`One file: «lethe.conf». The thing that tells Lethe what to sweep.

:::lesson
find can test almost anything: «-name», «-iname», «-type», «-size +1M», «-user hollow», «-mtime -2» (changed in the last two days)... and act on what it finds with «-delete» or «-exec».
:::`,
      },
      {
        say: N`@Osei: Here's something else odd. The night guard writes down a name every time someone passes his desk: «city/visitors.log». It's a mess. Put it in order with «sort».`,
        goal: 'Sort the visitors\' book: «sort city/visitors.log»',
        hints: ['Type: «sort city/visitors.log»'],
        check: (e) => !!e.ran('sort', (r) => on(e, r, 'visitors.log')),
        solve: ['sort city/visitors.log'],
        done: N`Sorted. Now all the repeated names sit next to each other...`,
      },
      {
        say: N`@Osei: «uniq» squashes *adjacent* duplicate lines into one — that's why we sort first. With «-c» it counts them, too.
@Osei: Save the sorted list on the spare desk I've lent you, then count:
«sort city/visitors.log > city/desk/sorted.txt»
«uniq -c city/desk/sorted.txt»`,
        goal: 'Count each visitor: sort into city/desk/sorted.txt, then «uniq -c» it',
        hints: ['Two commands. First: «sort city/visitors.log > city/desk/sorted.txt»', 'Then: «uniq -c city/desk/sorted.txt»'],
        check: (e) => !!e.ran('uniq', (r) => e.has(r, 'c')),
        solve: ['sort city/visitors.log > city/desk/sorted.txt', 'uniq -c city/desk/sorted.txt'],
        done: N`*7 hollow.*

@Osei: Seven times! In one night! And not once did he sign in at the front desk.

:::lesson
«sort | uniq -c» is one of the great idioms: *how many of each?* You'll see it again very soon.
:::`,
      },
      {
        say: N`@Osei: One last lesson, free of charge. Commands are files too — they have to live *somewhere*. «which grep» tells you where.
@Osei: But some commands aren't files at all; they're built right into the shell. «type cd» tells you what kind of thing a command really is.`,
        goal: 'Investigate commands themselves: «which grep» and «type cd»',
        hints: ['Two commands: «which grep» then «type cd».'],
        check: (e) => e.stepRan('which') && e.stepRan('type'),
        solve: ['which grep', 'type cd'],
        done: N`«/usr/bin/grep» — a file in the Toolsmiths' quarter. «cd is a shell builtin» — part of the shell itself.

:::lesson
When you type a command, the shell checks: is it an **alias**? A **builtin**? Otherwise it searches the directories listed in «$PATH» for a file with that name. «which» shows the file; «type» shows the whole truth.
:::`,
      },
    ],
    outro: N`@Osei: Your home is «/home/{user}», and someone called Hollow has been doing things after hours in my City Hall.
@Osei: If he's been anywhere, the Chronicle will have the details. Hal keeps everything. Go back to «/var/log» — and this time don't just *read* the logs. Interrogate them.`,
  });
})();
