/* Night Train, Chapter 12 — Clockwork (for, basename, bc, seq, printf, a script with $1, if/test, read, realpath, dirname) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const pack = LA.stories.nighttrain;
  const SCRIPT = String.raw`#!/bin/bash
# timeline.sh CARD - every door a card opened tonight, from the copies we trust
cd "$(dirname "$(realpath "$0")")" || exit 1
card=$1
if [ -z "$card" ]; then
    read -p "card: " card
fi
for log in evidence/doors.log.2 recorder-0000/doors.log.1 /var/log/meridian/doors.log; do
    printf '== %s (%s) ==\n' "$(basename "$log")" "$(dirname "$log")"
    if [ ! -r "$log" ]; then
        echo "   (cannot read $log)"
        continue
    fi
    grep " $card " "$log" || echo "   (no entries)"
done
`;
  pack.TIMELINE_SCRIPT = SCRIPT;
  const scriptPath = (e) => e.home + '/case/timeline.sh';

  pack.add({
    n: 12, id: 'clockwork', title: 'Clockwork', place: 'km 199 · the Merrow Tunnel', clock: [1, 3, 33],
    unlocks: ['basename', 'bc', 'seq', 'printf', 'test', 'read', 'realpath', 'dirname'],
    intro: N`The Merrow Tunnel swallows the train. Three and a half kilometres of rock overhead, the windows suddenly mirrors, the noise doubled. No radio in here — no radio anywhere until the far end.

@Vesna: Twenty minutes of tunnel. Enough to learn to make the computer do the boring parts. A **script** is just commands in a file. Everything you've typed tonight could have been a script.`,
    steps: [
      {
        say: N`Start at the prompt. A **for** loop runs the same commands once for each item in a list; «$car» holds the current item. «basename» strips a path down to its last part.`,
        goal: 'Name every car: «for car in /srv/meridian/cars/*; do basename "$car"; done»',
        hints: ['Type it exactly, semicolons and all: «for car in /srv/meridian/cars/*; do basename "$car"; done»', 'If you press Enter too early you\'ll get a «>» prompt — bash is waiting for the rest. Keep typing, or Ctrl+C to start over.'],
        check: (e) => /\bfor\b[\s\S]*\bdo\b[\s\S]*\bdone\b/.test(e.line) && !!e.ran('basename'),
        solve: ['for car in /srv/meridian/cars/*; do basename "$car"; done'],
        done: N`:::art
for car in /srv/meridian/cars/*     <- for each path the glob matches, put it in $car...
do
    basename "$car"                 <- ...and run this
done
:::`,
      },
      {
        say: N`@Rosa: (on the intercom) Out of the tunnel at 03:52. Then thirty-seven kilometres to Kessel, and I'm doing sixty-four. You can work out when we arrive. I'm busy.
The shell's own arithmetic, «$(( ))», only does whole numbers. «bc» is a calculator that can do decimals; «scale=1» asks for one decimal place.`,
        goal: 'Minutes from the tunnel to Kessel: «echo "scale=1; 37 * 60 / 64" | bc»',
        hints: ['Type «echo "scale=1; 37 * 60 / 64" | bc».'],
        check: (e) => !!e.ran('bc', (r) => /^34\.6/.test(r.out.trim())),
        solve: ['echo "scale=1; 37 * 60 / 64" | bc'],
        done: N`«34.6». Tunnel at 03:52, plus thirty-five minutes: **Kessel at about 04:27**, a quarter of an hour early. Rosa is in a hurry.

(«echo $(( 37 * 60 / 64 ))» would say «34» — the shell throws the fraction away.)`,
      },
      {
        say: N`«seq» counts. «$( )» — **command substitution** — puts a command's output in the middle of another command. Together: loop over the A-car cabins and count how often each cabin door opened in the true midnight log.`,
        goal: 'Count A-car cabin doors: «for n in $(seq 1 8); do grep -c "cabin_A$n " ~/case/recorder-0000/doors.log.1; done»',
        hints: ['Type «for n in $(seq 1 8); do grep -c "cabin_A$n " ~/case/recorder-0000/doors.log.1; done»'],
        check: (e) => !!e.ran('seq') && /\bfor\b/.test(e.line),
        solve: ['for n in $(seq 1 8); do grep -c "cabin_A$n " ~/case/recorder-0000/doors.log.1; done'],
        done: N`Eight numbers, one per cabin — and a «0» for A6, which is empty. Loops plus «seq» do in one line what would take eight commands.`,
      },
      {
        say: N`«echo» prints what it's given. «printf» prints it *formatted*: «%-6s» means *a string, padded to six characters, left-aligned*; «\n» ends the line. The format repeats until the arguments run out.`,
        goal: 'Print a tidy table: «printf \'%-6s %s\\n\' 0201 Vesna 0417 Marsh»',
        hints: ["Type «printf '%-6s %s\\n' 0201 Vesna 0417 Marsh»."],
        check: (e) => !!e.ran('printf', (r) => /0417\s+Marsh/.test(r.out)),
        solve: ["printf '%-6s %s\\n' 0201 Vesna 0417 Marsh"],
        done: N`:::art
0201   Vesna
0417   Marsh
:::`,
      },
      {
        say: N`One thing to understand before writing a script: every command reports an **exit status** when it finishes, and «$?» holds the last one. «0» means success. «grep» uses it to say *what kind* of answer it has: «0» found something, «1» found nothing, «2» couldn't even read the file.`,
        goal: 'See all three: «grep 0417 ~/case/recorder-0000/doors.log.1; echo $?», then «grep 9999 ~/case/recorder-0000/doors.log.1; echo $?», then «grep 0417 /nowhere.log; echo $?»',
        hints: ['Three lines, each a grep followed by «; echo $?».', '«grep 0417 ~/case/recorder-0000/doors.log.1; echo $?» → 0 · «grep 9999 ...; echo $?» → 1 · «grep 0417 /nowhere.log; echo $?» → 2'],
        check: (e) => {
          const m = e.line.match(/;\s*echo\s+\$\?\s*$/) && e.tried('grep');
          if (m) { const st = e.out().trim().split('\n').pop(); if (['0', '1', '2'].includes(st)) e.mem['s' + st] = true; }
          return !!(e.mem.s0 && e.mem.s1 && e.mem.s2);
        },
        solve: ['grep 0417 ~/case/recorder-0000/doors.log.1; echo $?', 'grep 9999 ~/case/recorder-0000/doors.log.1; echo $?', 'grep 0417 /nowhere.log; echo $?'],
        done: N`«0», «1», «2». *Found*, *not found*, *couldn't look*. A script that treats the last two the same will one day tell a police inspector that a door was never opened, when really it never read the log.`,
      },
      {
        say: N`Now the real thing. Vesna dictates; you type it into «nano ~/case/timeline.sh»:

:::art
#!/bin/bash
# timeline.sh CARD - every door a card opened tonight, from the copies we trust
cd "$(dirname "$(realpath "$0")")" || exit 1
card=$1
if [ -z "$card" ]; then
    read -p "card: " card
fi
for log in evidence/doors.log.2 recorder-0000/doors.log.1 /var/log/meridian/doors.log; do
    printf '== %s (%s) ==\n' "$(basename "$log")" "$(dirname "$log")"
    if [ ! -r "$log" ]; then
        echo "   (cannot read $log)"
        continue
    fi
    grep " $card " "$log" || echo "   (no entries)"
done
:::
@Vesna: Line one, the **shebang**: which program runs this file. «$1» is the first argument you give the script. «[ -z "$card" ]» is a **test**: *is it empty?* — and if it is, «read» asks for one. The «cd» line moves into the folder the script lives in, wherever you run it from. We'll come back to that.`,
        goal: 'Write the script: «nano ~/case/timeline.sh» (save with Ctrl+O, Enter; exit with Ctrl+X)',
        hints: ['«nano ~/case/timeline.sh», type it in, Ctrl+O, Enter, Ctrl+X.', 'It must start with «#!/bin/bash» and contain the for loop with grep.'],
        check: (e) => { const t = e.read(scriptPath(e)) || ''; return /^#!/.test(t) && /\bfor\b/.test(t) && /grep/.test(t) && /\$card|\$1/.test(t); },
        solve: [{ edit: () => SCRIPT }, 'nano ~/case/timeline.sh'],
        done: N`Fifteen lines. Vesna reads them over your shoulder and nods once, which from her is a standing ovation.`,
      },
      {
        say: N`Run it. The simplest way is to hand the file to «bash» — go into the case folder first.`,
        goal: 'Run it for Marsh\'s escort card: «cd ~/case», then «bash timeline.sh 0417»',
        hints: ['«cd ~/case»', 'then «bash timeline.sh 0417»'],
        check: (e) => !!e.ran('bash', (r) => r.args.some((a) => /timeline\.sh$/.test(a))) && /0417 car2_baggage/.test(e.out()),
        solve: ['cd ~/case', 'bash timeline.sh 0417'],
        done: N`«== doors.log.2 (evidence) ==» 22:52:03 — the official inspection.
«== doors.log.1 (recorder-0000) ==» 23:05:12 closing up after it, then **23:36:30 OPEN** and **23:51:08 CLOSED**.
«== doors.log (/var/log/meridian) ==» «(no entries)» — he hasn't used it since midnight.

Those two endings are different on purpose. «(no entries)» means *we read the log and he isn't in it*; «(cannot read ...)» would mean *we don't know*. Never let a script report the second as the first.

His whole night, from the copies he didn't know about.`,
      },
      {
        say: N`To run it like a real command — «./timeline.sh» — it needs the execute bit. Then try it without an argument: the «if» will notice, and «read» will ask you for a card. Give it Vesna's.`,
        goal: '«chmod +x timeline.sh», then «./timeline.sh» and answer «0201» at the prompt',
        hints: ['«chmod +x timeline.sh»', '«./timeline.sh» — no argument — then type «0201» when it asks.'],
        check: (e) => !!e.stepEvent('script', (ev) => /timeline\.sh$/.test(ev.path)) && /0201 car8_mail/.test(e.out()),
        solve: ['chmod +x timeline.sh', { nowait: './timeline.sh' }, { answer: '0201' }],
        done: N`«card: 0201» — and there it is in the true log: «23:53:20 0201 car8_mail OPEN».

@Vesna: The last door I opened tonight. I'd like that one framed.`,
      },
      {
        say: N`That first «cd» line is a classic. «$0» is the path the script was started by; «realpath» turns any path into the full, absolute one; «dirname» strips the last part off a path. Together: *the directory this script lives in*. Try the pieces by hand.`,
        goal: 'Run «realpath timeline.sh», then «dirname /home/{user}/case/timeline.sh»',
        hints: ['«realpath timeline.sh»', 'then «dirname /home/{user}/case/timeline.sh»'],
        check: (e) => e.stepRan('realpath') && e.stepRan('dirname'),
        solve: ['realpath timeline.sh', 'dirname /home/{user}/case/timeline.sh'],
        done: N`«/home/{user}/case/timeline.sh», then «/home/{user}/case». So the script can be run from anywhere — «/tmp», your home, a cron job — and still find «evidence/» and «recorder-0000/» next to itself.`,
      },
      {
        say: N`Save both timelines for the police — his card and hers. «&&» runs the next command only if the one before it succeeded, and «test -s FILE» succeeds only if FILE exists and isn't empty — the same check as «[ -s FILE ]».`,
        goal: 'Save Marsh\'s timeline with a check — «./timeline.sh 0417 > timeline_0417.txt && test -s timeline_0417.txt && echo saved» — then Vesna\'s the same way, as «timeline_0201.txt»',
        hints: ['Type «./timeline.sh 0417 > timeline_0417.txt && test -s timeline_0417.txt && echo saved»', 'Then the same with 0201: «./timeline.sh 0201 > timeline_0201.txt && test -s timeline_0201.txt && echo saved»'],
        check: (e) => /0417/.test(e.read(e.home + '/case/timeline_0417.txt') || '') && /0201/.test(e.read(e.home + '/case/timeline_0201.txt') || '') && e.stepRan('test'),
        solve: ['./timeline.sh 0417 > timeline_0417.txt && test -s timeline_0417.txt && echo saved', './timeline.sh 0201 > timeline_0201.txt && test -s timeline_0201.txt && echo saved'],
        done: N`«saved».

:::lesson
Every command finishes with an **exit status**: «0» for success, anything else for failure («echo $?» shows the last one). «&&» runs the next command only on success, «||» only on failure, «;» regardless. «if» and «test» are built on the same idea.
:::`,
      },
    ],
    outro: N`The tunnel walls fall away all at once. Moonlight on snow, a valley full of mist, and — on the far side of it, faint and orange — the lights of Kessel Junction.

In the corner of the rack, a small green LED you hadn't noticed was dark comes on: **radio0**.`,
  });
})();
