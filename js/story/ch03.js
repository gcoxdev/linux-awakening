/* Chapter 3 — The Night Market (mkdir, touch, >, >>, nano, cp, mv, rm, rmdir, globs) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const CAMP = '/tmp/camp';
  const lines = (s) => (s || '').split('\n').filter((l) => l.trim() !== '').length;

  function ensureCamp(g) {
    const fs = g.fs, u = g.user;
    if (!fs.tryGet(CAMP)) { const n = fs.dir(CAMP); n.owner = u; n.group = u; n.mode = 0o755; }
  }
  function drop(g, rel, content) {
    const n = g.fs.put(CAMP + '/' + rel, content, { owner: g.user, group: g.user, mode: 0o644 });
    return n;
  }

  LA.story.add({
    n: 3, id: 'market', title: 'The Night Market', place: '/tmp',
    unlocks: ['mkdir', 'touch', 'cp', 'mv', 'rm', 'rmdir', 'nano'],
    intro: N`By the time you reach «/tmp», the Night Market is in full swing.

Lanterns hang from strings between the stalls. Traders sell lost umbrellas, half-remembered songs, maps of streets that may or may not exist. Everything here is temporary, and everyone here knows it.

A broad woman in a fisherman's sweater waves you over to an empty patch of cobbles.

@Ingrid: Ingrid Solberg. You look like someone who needs a roof and doesn't have one. Well — here, nobody does.`,
    steps: [
      {
        goal: 'Go to the Night Market: «cd /tmp»',
        hints: ['Type: «cd /tmp»'],
        check: (e) => e.cwd === '/tmp',
        solve: ['cd /tmp'],
        done: N`@Ingrid: Anyone can set up here. /tmp belongs to everybody. But read the notice board — at dawn the sweepers come, and everything goes.

:::lesson
**/tmp** is the city's scratch space: every user may create files there, and it is wiped clean regularly (often at every reboot).
:::`,
      },
      {
        say: N`@Ingrid: Make yourself a stall. «mkdir» *makes a directory*. Call it camp.`,
        goal: 'Make a directory for your stall: «mkdir camp»',
        hints: ['Type: «mkdir camp»'],
        check: (e) => { const n = e.node(CAMP); return !!n && n.type === 'dir'; },
        solve: ['mkdir camp'],
        done: N`A patch of cobbles with your name on it. Tux immediately claims a corner.`,
      },
      {
        say: N`@Ingrid: Now, every trader keeps a ledger. Step into your camp and make an empty file for your journal. «touch» creates an empty file if it doesn't exist yet.`,
        goal: 'Go into camp and create an empty journal: «cd camp» then «touch journal.txt»',
        hints: ['«cd camp» first.', 'Then: «touch journal.txt»'],
        check: (e) => { const n = e.node(CAMP + '/journal.txt'); return !!n && n.type === 'file'; },
        solve: ['cd camp', 'touch journal.txt'],
        done: N`:::lesson
«touch» creates an empty file — or, if the file already exists, just updates its timestamp. «ls -l» would show it with size 0.
:::`,
      },
      {
        say: N`@Ingrid: An empty ledger is no use to anyone. Write your first entry. The «>» sign sends a command's output *into a file* instead of onto the screen:
«echo "Day 1: woke up in room 307." > journal.txt»`,
        goal: 'Write a first line into the journal with «echo ... > journal.txt»',
        hints: ['«echo» prints text; «>» redirects it into a file.', 'Type: «echo "Day 1: woke up in room 307." > journal.txt»'],
        check: (e) => lines(e.read(CAMP + '/journal.txt')) >= 1,
        solve: ['echo "Day 1: woke up in room 307." > journal.txt'],
        done: N`:::lesson
**Redirection.** «>» writes output into a file.
**Careful:** «>» *replaces* the whole file every time. Whatever was there before is gone.
:::`,
      },
      {
        say: N`@Ingrid: To add a line without wiping the first one, use two arrows: «>>» *appends*.`,
        goal: 'Append a second line with «>>»',
        hints: ['Same as before, but «>>» instead of «>».', 'Type: «echo "Tux is my penguin. Apparently." >> journal.txt»'],
        check: (e) => lines(e.read(CAMP + '/journal.txt')) >= 2,
        nudge: (e) => (e.line.includes('>') && !e.line.includes('>>') && lines(e.read(CAMP + '/journal.txt')) < 2 ? '@Ingrid: Ha — you overwrote it. One «>» replaces; two «>>» append. Try again.' : null),
        solve: ['echo "Tux is my penguin. Apparently." >> journal.txt'],
        done: N`«cat journal.txt» would now show both lines, one after another.`,
      },
      {
        say: N`@Ingrid: Writing one line at a time is for prisoners. Use a proper editor: «nano journal.txt».
@Ingrid: Type whatever you like. Then **Ctrl+O** and **Enter** to save ("write Out"), and **Ctrl+X** to exit.`,
        goal: 'Open the journal in nano, add at least one more line, save (Ctrl+O, Enter) and exit (Ctrl+X)',
        hints: ['Type «nano journal.txt». Add a line at the bottom.', 'Save with Ctrl+O then Enter. Exit with Ctrl+X.', 'If Ctrl+X asks "Save modified buffer?", press Y, then Enter.'],
        check: (e) => !!e.ran('nano') && lines(e.read(CAMP + '/journal.txt')) >= 3,
        nudge: (e) => (e.ran('nano') && lines(e.read(CAMP + '/journal.txt')) < 3 ? '@Ingrid: Nothing saved, by the look of it. Add a line, then Ctrl+O and Enter before Ctrl+X.' : null),
        solve: [{ edit: (c) => c + 'Mags thinks I wrote a book. I believe her.\n' }, 'nano journal.txt'],
        done: N`:::lesson
**nano** is a friendly editor: its shortcuts are listed at the bottom («^» means Ctrl). Some people prefer **vim**, which is more powerful and famously hard to leave. (Hint for the brave: **Esc**, then «:q».)
:::`,
      },
      {
        say: N`@Ingrid: Here — every Operator needs a map. Copy the one from my stall. «cp» copies: first what, then where. A single dot means *right here*.`,
        goal: 'Copy Ingrid\'s map into your camp: «cp ../ingrid_stall/map.txt .»',
        hints: ['«cp SOURCE DESTINATION». The source is in the stall next door: «../ingrid_stall/map.txt».', 'Type: «cp ../ingrid_stall/map.txt .» (note the final dot!)'],
        check: (e) => !!e.node(CAMP + '/map.txt'),
        solve: ['cp ../ingrid_stall/map.txt .'],
        done: N`:::lesson
«cp SOURCE DEST» copies a file. If DEST is a directory, the copy goes inside it with the same name.
:::`,
      },
      {
        setup: (g) => {
          ensureCamp(g);
          for (const [k, v] of Object.entries(LA.FRAGMENTS)) drop(g, k, v);
          drop(g, 'junk1.tmp', 'a broken lantern\n');
          drop(g, 'junk2.tmp', 'three left socks\n');
          drop(g, 'junk3.tmp', 'a map of a street that does not exist\n');
          drop(g, 'receipt.txt', `NIGHT MARKET — STALL 9 — RECEIPT
--------------------------------
Sold to:  "H."  (wore a hood; paid in other people's memories)
Items:    1 x copy of a key   (marked: wren@lighthouse)
          1 x copy of a key   (marked: operator)
          1 x tin of blank paint
Note from the stallholder, added later, underlined twice:
          never selling keys again.  — I.
`);
        },
        say: N`Ingrid hesitates, then tips a crate out onto your stall: crumpled papers, scraps, junk.

@Ingrid: These fell out of your pockets when they carried you past the market three nights ago. I kept them. Didn't know why.
@Ingrid: Get organised. «mkdir -p» makes a whole path of directories in one go, parents and all.`,
        goal: 'Make a nested directory: «mkdir -p memories/fragments»',
        hints: ['«-p» creates any missing parent directories too.', 'Type: «mkdir -p memories/fragments»'],
        check: (e) => { const n = e.node(CAMP + '/memories/fragments'); return !!n && n.type === 'dir'; },
        solve: ['mkdir -p memories/fragments'],
        done: N`Run «ls» and look at what Ingrid tipped out: three «.mem» files, some «.tmp» junk, and a receipt.`,
      },
      {
        say: N`@Ingrid: Now move all the fragments in one go. The star is a **wildcard**: «*.mem» means *every name ending in .mem*.`,
        goal: 'Move every .mem file into the fragments folder: «mv *.mem memories/fragments/»',
        hints: ['«mv» moves things. «*.mem» matches all three fragment files.', 'Type: «mv *.mem memories/fragments/»'],
        check: (e) => Object.keys(LA.FRAGMENTS).every((f) => e.node(CAMP + '/memories/fragments/' + f)) && !Object.keys(LA.FRAGMENTS).some((f) => e.node(CAMP + '/' + f)),
        solve: ['mv *.mem memories/fragments/'],
        done: N`:::lesson
**Wildcards** (also called *globs*) are expanded by the shell before the command runs:
«*» matches anything, «?» matches exactly one character, «[abc]» matches one of a, b or c.
So «mv *.mem dir/» really runs «mv frag_a.mem frag_b.mem frag_c.mem dir/».
:::`,
      },
      {
        say: N`@Ingrid: The «.tmp» ones are rubbish. Get rid of them. «rm» removes files — and in Rootfall there is no recycle bin. Gone is gone.`,
        goal: 'Delete the junk: «rm junk*.tmp»',
        hints: ['«junk*.tmp» matches junk1.tmp, junk2.tmp and junk3.tmp.', 'Type: «rm junk*.tmp»'],
        check: (e) => !['junk1.tmp', 'junk2.tmp', 'junk3.tmp'].some((f) => e.node(CAMP + '/' + f)),
        solve: ['rm junk*.tmp'],
        done: N`:::lesson
«rm» is permanent. When in doubt, «rm -i» asks before every deletion — and «ls junk*.tmp» first shows you exactly what a wildcard will match.
:::`,
      },
      {
        say: N`That receipt looks important. Give it a better name. «mv» doesn't only move things; moving a file to a new name *renames* it.`,
        goal: 'Rename the receipt: «mv receipt.txt clue.txt»',
        hints: ['Type: «mv receipt.txt clue.txt»'],
        check: (e) => !!e.node(CAMP + '/clue.txt') && !e.node(CAMP + '/receipt.txt'),
        solve: ['mv receipt.txt clue.txt'],
        done: N`Renamed.`,
      },
      {
        goal: 'Read the clue: «cat clue.txt»',
        hints: ['Type: «cat clue.txt»'],
        check: (e) => e.didRead(CAMP + '/clue.txt'),
        solve: ['cat clue.txt'],
        done: N`Ingrid has gone very still.

@Ingrid: That's my handwriting. Stall 9 was mine. He paid well, and I didn't ask what the keys opened. I've been sick about it ever since.
@Ingrid: Copies of the Lighthouse key — and *yours*. Whoever "H." is, he walked out of my stall with the keys to your life.`,
      },
      {
        say: N`@Ingrid: Read your fragments. All of them at once — «cat» understands wildcards too.`,
        goal: 'Read every fragment at once: «cat memories/fragments/*»',
        hints: ['The wildcard «*» matches every file in the folder.', 'Type: «cat memories/fragments/*»'],
        check: (e) => ['frag_a', 'frag_b', 'frag_c'].every((f) => e.didRead(new RegExp('/fragments/' + f + '\\.mem$'))),
        solve: ['cat memories/fragments/*'],
        done: N`The words swim. *The cron fires at three.* *He has my key.* *The Undercroft.*

For a moment you're somewhere else: a cold stone room, a disk humming, your own hands typing very fast...

...and then it's gone, and you're back in the market, and Tux is pressing his whole weight against your ankle.`,
      },
      {
        setup: (g) => {
          ensureCamp(g);
          const fs = g.fs;
          if (!fs.tryGet(CAMP + '/crate')) { const d = fs.dir(CAMP + '/crate'); d.owner = g.user; d.group = g.user; }
          if (!fs.tryGet(CAMP + '/old_tent')) { const d = fs.dir(CAMP + '/old_tent'); d.owner = g.user; d.group = g.user; }
          fs.put(CAMP + '/old_tent/poles.txt', 'four tent poles, one bent\n', { owner: g.user, group: g.user });
          fs.put(CAMP + '/old_tent/canvas.txt', 'a patched canvas that smells of rain\n', { owner: g.user, group: g.user });
        },
        say: N`@Ingrid: Dawn's coming. Pack up what you don't need. That empty crate first — «rmdir» removes an *empty* directory.`,
        goal: 'Remove the empty crate: «rmdir crate»',
        hints: ['Type: «rmdir crate»'],
        check: (e) => !e.node(CAMP + '/crate'),
        solve: ['rmdir crate'],
        done: N`Folded flat.`,
      },
      {
        say: N`@Ingrid: The old tent isn't empty — try «rmdir» on it and it will refuse. To remove a directory *and everything inside it*, use «rm -r» (r for recursive).`,
        goal: 'Remove the old tent and its contents: «rm -r old_tent»',
        hints: ['«rmdir» only removes empty directories.', 'Type: «rm -r old_tent»'],
        check: (e) => !e.node(CAMP + '/old_tent'),
        solve: ['rm -r old_tent'],
        done: N`:::lesson
«rm -r» deletes a whole tree. «rm -rf» does it without asking and without complaining. Those four letters have ended more careers than any virus. Always look before you leap: «ls» it first.
:::`,
      },
      {
        say: N`@Ingrid: Now listen to me. At dawn, the sweepers clear *all* of /tmp. If you want your memories to survive, put a copy somewhere the sweepers never go: «/var/tmp».
@Ingrid: To copy a whole directory, «cp» needs «-r» as well.`,
        goal: 'Save your memories somewhere safe: «cp -r memories /var/tmp/»',
        hints: ['«cp -r» copies directories with everything inside.', 'Type: «cp -r memories /var/tmp/»'],
        check: (e) => Object.keys(LA.FRAGMENTS).every((f) => e.node('/var/tmp/memories/fragments/' + f)),
        solve: ['cp -r memories /var/tmp/'],
        done: N`@Ingrid: Good. /var/tmp survives the sweep. You're learning.`,
      },
    ],
    onEnd(g) {
      // the dawn sweep: Lethe clears the player's things out of /tmp
      const fs = g.fs;
      const tmp = fs.get('/tmp');
      for (const [name, node] of [...tmp.children]) {
        if (node.owner === g.user) { tmp.children.delete(name); }
      }
      for (const sh of g.console.stack) {
        if (sh.cwd === '/tmp' || sh.cwd.startsWith('/tmp/')) { sh.cwd = '/tmp'; sh.setVar('PWD', '/tmp'); }
      }
    },
    outro: N`You sleep curled around Tux under a borrowed blanket.

At 03:00 the lanterns gutter all at once. A cold wind moves through the market — not a real wind; something *underneath* the wind — and when you wake, your camp is gone. The journal, the map, the cobbles with your name on them: swept into nothing.

Ingrid presses a mug of something hot into your hands.

@Ingrid: Told you. But /var/tmp still has your fragments — the sweepers never go there.
@Ingrid: Morning, Operator. City Hall's open. Go and find out who you are.`,
  });
})();
