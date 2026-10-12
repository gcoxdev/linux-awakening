/* Chapter 11 — Spellwork (&&, ||, scripts, shebang, chmod +x, $1, for, if/test, while, $(( )), PATH) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const VFS = LA.VFS;

  function findScript(e, name) {
    for (const p of [e.home + '/scripts/' + name, e.home + '/' + name]) { const n = e.node(p); if (n && n.type === 'file') return p; }
    return null;
  }
  const RESTORE_LOOP = 'count=0\nfor f in "$SRC"/*.mem; do\n    cat "$f" >> "$OUT"\n    count=$((count+1))\ndone';

  LA.story.add({
    n: 11, id: 'spellwork', title: 'Spellwork', place: '~/scripts', clock: [1, 21, 30],
    unlocks: ['bash', 'test', 'seq', 'diff'],
    intro: N`Back home, with your memories back in a folder where they belong, Mara clears the dinner table and spreads out your old notebooks.

@Mara: There's something I haven't told you. Lethe took my memories folder too, that first night. I woke up scared and didn't know why. All I had left were scraps I'd scribbled on whatever was to hand. I've copied them to «/var/tmp/mara». I can't make them make sense.

@Mara: You know what you were really good at? Not typing commands. *Writing them down* so the city could type them for you. Scripts. You called it spellwork.
@Mara: A script is just a text file full of commands — but with variables, loops and decisions, it becomes something that thinks. Your old «restore.sh» was meant for exactly this. Let's get you writing spells again.`,
    steps: [
      {
        say: N`@Mara: First, chaining. «&&» means *and then, if that worked*: the second command only runs if the first one succeeded.
«cd ~/scripts && ls»`,
        goal: 'Go to your scripts folder and list it, in one line: «cd ~/scripts && ls»',
        hints: ['Type: «cd ~/scripts && ls»'],
        check: (e) => e.cwd === e.home + '/scripts' && /&&/.test(e.line),
        solve: ['cd ~/scripts && ls'],
        done: N`«README  backup.sh  restore.sh»

:::lesson
Every command finishes with an **exit status**: «0» means success, anything else means failure. «echo $?» shows the last one. «&&» runs the next command only on success, «||» only on failure, and «;» runs it regardless.
:::`,
      },
      {
        say: N`@Mara: And «||» is the opposite: *or else*. It runs the second command only if the first one **failed**. Try to walk into the Spire:
«cd /root || echo "The Spire is sealed."»`,
        goal: 'Try the Spire, with a fallback: «cd /root || echo "The Spire is sealed."»',
        hints: ["Type: «cd /root || echo 'The Spire is sealed.'»"],
        check: (e) => /\|\|/.test(e.line) && !!e.ran('echo'),
        solve: ["cd /root || echo 'The Spire is sealed.'"],
        done: N`Permission denied — and then, because that failed, your message.`,
      },
      {
        say: N`@Mara: Now your first script. Make a new file called «hello.sh» with nano, containing exactly these two lines:

:::art
#!/bin/bash
echo "Hello, $USER"
:::

@Mara: That first line is the **shebang** — «#!» followed by the program that should run the rest of the file.`,
        goal: 'Create hello.sh in ~/scripts with a #!/bin/bash line and an echo',
        hints: ['Type «nano hello.sh», type the two lines, then Ctrl+O, Enter, Ctrl+X.', 'Line 1: «#!/bin/bash»   Line 2: «echo "Hello, $USER"»'],
        check: (e) => { const p = findScript(e, 'hello.sh'); const t = p && e.read(p); return !!t && /^#!/.test(t) && /echo/.test(t); },
        solve: [{ edit: () => '#!/bin/bash\necho "Hello, $USER"\n' }, 'nano hello.sh'],
        done: N`A small spell. Now cast it.`,
      },
      {
        say: N`@Mara: The simplest way to run a script is to hand it to bash: «bash hello.sh».`,
        goal: 'Run your script with bash: «bash hello.sh»',
        hints: ['Type: «bash hello.sh»'],
        check: (e) => !!e.ran('bash', (r) => r.args.some((a) => /hello\.sh$/.test(a))),
        solve: ['bash hello.sh'],
        done: N`«Hello, {user}» — «$USER» was replaced by your name when the script ran.`,
      },
      {
        say: N`@Mara: Real commands don't need «bash» in front. To run a script directly, it must be **executable** — give it the x permission — and, because your current directory isn't in «$PATH», you call it with «./» in front:
«chmod +x hello.sh»
«./hello.sh»`,
        goal: 'Make it executable and run it directly: «chmod +x hello.sh» then «./hello.sh»',
        hints: ['First «chmod +x hello.sh»', 'Then «./hello.sh» — dot slash means "the one right here"'],
        check: (e) => /^\s*\.\/hello\.sh/.test(e.line) && e.status === 0,
        nudge: (e) => (/^\s*\.\/hello\.sh/.test(e.line) && e.status === 126 ? '@Mara: Permission denied — it isn\'t executable yet. «chmod +x hello.sh» first.' : null),
        solve: ['chmod +x hello.sh', './hello.sh'],
        done: N`:::lesson
«./hello.sh» = run the file *hello.sh in this directory*. Without «./» the shell would only search «$PATH» and say "command not found". The shebang line tells the system which interpreter to use.
:::`,
      },
      {
        say: N`@Mara: Scripts can take **arguments**. Inside, «$1» is the first word after the script's name, «$2» the second, «$#» how many there were.
@Mara: Make «greet.sh» with a shebang and «echo "Welcome back, $1"», make it executable, then run «./greet.sh Mara».`,
        goal: 'Write greet.sh using $1, make it executable, and run «./greet.sh Mara»',
        hints: ['Create it: «nano greet.sh» with two lines: «#!/bin/bash» and «echo "Welcome back, $1"»', '«chmod +x greet.sh»', 'Then: «./greet.sh Mara»'],
        check: (e) => /greet\.sh/.test(e.line) && e.status === 0 && !!e.event('script', (ev) => /greet\.sh$/.test(ev.path)) && /Mara/.test(e.out()),
        solve: [{ edit: () => '#!/bin/bash\necho "Welcome back, $1"\n' }, 'nano greet.sh', 'chmod +x greet.sh', './greet.sh Mara'],
        done: N`«Welcome back, Mara»

@Mara: ...Welcome back yourself.`,
      },
      {
        say: N`@Mara: Loops. A **for** loop repeats commands once for each item in a list. You can type one straight into the prompt:
«for i in 1 2 3; do echo "fragment $i"; done»`,
        goal: 'Run a for loop: «for i in 1 2 3; do echo "fragment $i"; done»',
        hints: ['Type it exactly, semicolons and all: «for i in 1 2 3; do echo "fragment $i"; done»', 'If you press Enter early you\'ll see a «>» prompt — bash is waiting for the rest. Keep typing, or press Ctrl+C to start over.'],
        check: (e) => /\bfor\b[\s\S]*\bdo\b[\s\S]*\bdone\b/.test(e.line) && !!e.ran('echo'),
        solve: ['for i in 1 2 3; do echo "fragment $i"; done'],
        done: N`:::art
   for i in 1 2 3      <- for each item, put it in $i...
   do
       echo "fragment $i"   <- ...and run this
   done
:::`,
      },
      {
        say: N`@Mara: Writing «1 2 3» by hand gets old. «seq» generates number sequences, and «$( )» — **command substitution** — drops a command's output right into your line:
«for n in $(seq 1 5); do echo "Day $n"; done»`,
        goal: 'Loop over $(seq 1 5)',
        hints: ['Type: «for n in $(seq 1 5); do echo "Day $n"; done»'],
        check: (e) => /\bfor\b/.test(e.line) && /\$\(\s*seq/.test(e.line) && !!e.ran('seq'),
        solve: ['for n in $(seq 1 5); do echo "Day $n"; done'],
        done: N`:::lesson
«$(command)» runs the command and puts its output in its place. «echo "Today is $(date +%A)"» — try it sometime. «for f in *.txt» loops over files, too.
:::`,
      },
      {
        say: N`@Mara: Decisions. «if» runs a command and checks whether it succeeded. Usually that command is a **test**, written in square brackets — and the spaces inside the brackets matter. «-f» asks "is this a file?":
«if [ -f ~/diary.txt ]; then echo "diary safe"; else echo "diary gone"; fi»`,
        goal: 'Make a decision with if [ -f ... ]',
        hints: ['Type: «if [ -f ~/diary.txt ]; then echo "diary safe"; else echo "diary gone"; fi»', 'Spaces after «[» and before «]» are required.'],
        check: (e) => /\bif\b[\s\S]*\[[\s\S]*\bfi\b/.test(e.line) && !!e.ran('echo'),
        solve: ['if [ -f ~/diary.txt ]; then echo "diary safe"; else echo "diary gone"; fi'],
        done: N`:::lesson
Tests: «-f FILE» is a file · «-d DIR» is a directory · «-e PATH» exists · «-z "$S"» string is empty · «"$A" = "$B"» strings equal · «$X -eq 3» numbers equal (also «-ne -lt -le -gt -ge»). «man test» has the rest.
:::`,
      },
      {
        say: N`@Mara: And **while** loops keep going as long as a test succeeds. «$(( ))» does arithmetic:
«n=3; while [ $n -gt 0 ]; do echo $n; n=$((n-1)); done; echo "liftoff"»`,
        goal: 'Count down with a while loop and $(( ))',
        hints: ['Type: «n=3; while [ $n -gt 0 ]; do echo $n; n=$((n-1)); done; echo "liftoff"»'],
        /* the loop must really have run: at least three numbers echoed by a while, not the words typed in quotes */
        check: (e) => {
          const bare = e.line.replace(/'[^']*'|"(?:\\.|[^"])*"/g, '""');
          const counted = e.recs.filter((r) => r.name === 'echo' && /^\d+$/.test(r.args.join(' ').trim())).length;
          return /\bwhile\b/.test(bare) && /\$\(\(/.test(bare) && counted >= 3;
        },
        solve: ['n=3; while [ $n -gt 0 ]; do echo $n; n=$((n-1)); done; echo "liftoff"'],
        done: N`3... 2... 1... liftoff.

Tux, who has been watching from the radiator, claps his flippers together once.`,
      },
      {
        setup: (g) => {
          const fs = g.fs, u = g.user;
          const dir = '/var/tmp/camp/memories/fragments';
          for (const d of ['/var/tmp/camp', '/var/tmp/camp/memories', dir]) if (!fs.tryGet(d)) fs.dir(d, { owner: u });
          for (const [k, v] of Object.entries(LA.FRAGMENTS)) if (!fs.tryGet(dir + '/' + k)) fs.put(dir + '/' + k, v, { owner: u, group: u });
          const rs = g.home + '/scripts/restore.sh';
          if (!fs.tryGet(rs)) fs.put(rs, '#!/bin/bash\nSRC=$1\nOUT=$2\necho "=== restored memories ===" > "$OUT"\n# TODO: loop over every .mem file in $SRC\n#       and append (>>) each one\'s contents to $OUT\n# TODO: print how many fragments were restored\necho "done."\n', { owner: u, group: u });
          if (!fs.tryGet('/var/tmp/mara')) {
            fs.dir('/var/tmp/mara', { owner: 'mara', mode: 0o755 });
            const scraps = {
              '1_knock.mem': '...02:40, three nights ago. a knock. you, white as paper, Tux under your arm.\nyou said you had to go to the Docks and you would not say why...\n',
              '2_sdb.mem': '...you said: "if I am not back by four, mount the Undercroft. sdb1."\nI said "what is sdb1". you laughed. you never laugh at four in the morning...\n',
              '3_morning.mem': '...morning. I could not remember why I was frightened, only that I was.\nI wrote you letters - backwards, in rot13 - because something in this city\nreads everything, and I did not want it reading those...\n',
            };
            for (const [k, v] of Object.entries(scraps)) fs.put('/var/tmp/mara/' + k, v, { owner: 'mara', group: 'mara', mode: 0o644 });
          }
        },
        say: N`@Mara: Now the real thing. Your unfinished spell: «restore.sh». It takes a folder of memory fragments and stitches them, in order, into one file. Look at it first: «cat restore.sh».
@Mara: The TODOs are where you stopped. Replace them with a for loop that appends («>>») every «.mem» file to «$OUT», counting as it goes. Then make it executable and test it on fragments you already know — the ones from your camp:
«./restore.sh /var/tmp/camp/memories/fragments ~/restored.txt»`,
        goal: 'Finish the loop in restore.sh, then test it: «./restore.sh /var/tmp/camp/memories/fragments ~/restored.txt»',
        hints: [
          'Open it with «nano restore.sh». Delete the TODO comments and write a loop in their place.',
          'The loop: «for f in "$SRC"/*.mem; do ... done» — inside it, «cat "$f" >> "$OUT"».',
          `The complete replacement for the TODOs:\n${RESTORE_LOOP}\necho "restored $count fragments"`,
          'Then «chmod +x restore.sh» and «./restore.sh /var/tmp/camp/memories/fragments ~/restored.txt»',
        ],
        check: (e) => {
          const script = e.read(e.home + '/scripts/restore.sh') || '';
          const out = e.read(e.home + '/restored.txt') || '';
          return /\b(for|while)\b/.test(script) && !/#\s*TODO/.test(script) && !!e.event('script', (ev) => /restore(\.sh)?$/.test(ev.path))
            && out.includes('cron fires at three') && out.includes('diff does not lie') && out.includes('Undercroft');
        },
        nudge: (e) => {
          const script = e.read(e.home + '/scripts/restore.sh') || '';
          if (/#\s*TODO/.test(script) && /restored\.txt/.test(e.line)) return "@Mara: You've combined the files, sure — but the spell itself still has its TODOs. The point is a script that works on *any* folder. Finish the loop in «restore.sh», then run it.";
          return null;
        },
        solve: [
          { edit: (c) => c.replace(/# TODO: loop[^\n]*\n#[^\n]*\n/, RESTORE_LOOP + '\n').replace(/# TODO: print[^\n]*\n/, 'echo "restored $count fragments"\n') },
          'nano restore.sh', 'chmod +x restore.sh', './restore.sh /var/tmp/camp/memories/fragments ~/restored.txt',
        ],
        done: N`«restored 3 fragments»

The three scraps from your pockets, stitched together in order. Nothing new — and that's the point: you tested your spell on something whose answer you already knew. Now it can be trusted with something you don't.

:::lesson
Always quote variables that hold file names: «"$f"», «"$OUT"». Without quotes, a name containing spaces would split into several words — the most common shell-script bug there is.
:::`,
      },
      {
        say: N`@Mara: Now mine. Same spell, different folder — that's the whole reason to write a script.`,
        goal: 'Restore Mara\'s scraps: run restore.sh on /var/tmp/mara, writing to ~/mara_restored.txt',
        hints: ['Same script, new arguments: «./restore.sh /var/tmp/mara ~/mara_restored.txt»', 'Then read the result: «cat ~/mara_restored.txt»'],
        check: (e) => /Tux under your arm/.test(e.read(e.home + '/mara_restored.txt') || '') && !!e.event('script', (ev) => /restore(\.sh)?$/.test(ev.path)),
        solve: ['./restore.sh /var/tmp/mara ~/mara_restored.txt'],
        done: N`«restored 3 fragments». Mara reads them over your shoulder, and goes very quiet.

*02:40, three nights ago. A knock. You, white as paper, Tux under your arm.*
*"If I am not back by four, mount the Undercroft. sdb1."*
*I wrote you letters — backwards, in ROT13 — because something in this city reads everything.*

@Mara: You came to *me*. You told me exactly what to do, and Lethe took it at three o'clock along with everything else. I've been sending you clues I didn't know I knew.
@Mara: ...Thank you for putting me back together. Even this much.`,
      },
      {
        say: N`@Mara: One more. A spell you have to type «./scripts/restore.sh» to cast isn't finished. Make it a real command: a «bin» folder of your own, a copy of the script in it — check the copy with «diff», which prints nothing when two files are identical — and that folder at the front of your «$PATH».
«mkdir -p ~/bin»
«cp restore.sh ~/bin/restore»
«diff restore.sh ~/bin/restore && echo identical»
«export PATH="$HOME/bin:$PATH"»
@Mara: Then prove it: go somewhere else and just type «restore» with a folder and an output file.`,
        goal: 'Install restore into ~/bin, add ~/bin to your PATH, and run «restore» by name from outside ~/scripts',
        hints: ['mkdir -p ~/bin · cp restore.sh ~/bin/restore · diff restore.sh ~/bin/restore · export PATH="$HOME/bin:$PATH"', 'Then for example: «cd ~» and «restore /var/tmp/mara /tmp/test.txt»', 'If the shell says "command not found", check «echo $PATH» starts with your bin directory, and that ~/bin/restore is executable («which restore» will find it once both are true).'],
        check: (e) => /^\s*restore\b/.test(e.line) && e.status === 0 && !!e.event('script', (ev) => ev.path === e.home + '/bin/restore'),
        solve: ['mkdir -p ~/bin', 'cp restore.sh ~/bin/restore', 'diff restore.sh ~/bin/restore && echo identical', 'export PATH="$HOME/bin:$PATH"', 'cd ~', 'restore /var/tmp/mara /tmp/check.txt'],
        done: N`Your own command, found through your PATH like any of the Toolsmiths' tools. (Your «~/.profile» already adds «~/bin» to the PATH at every login, so it'll still be there tomorrow.)`,
      },
    ],
    outro: N`Late, the radiator ticking, Mara asleep on your sofa with her scraps in a neat file at last.

One door is still open: the one Hollow planted at the Lighthouse. And Wren has been trying to reach you.`,
  });
})();
