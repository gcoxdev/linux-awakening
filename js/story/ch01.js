/* Chapter 1 — Wake (pwd, ls, cd, cat, whoami, clear) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const R307 = '/hospital/floor3/room307';

  LA.story.add({
    n: 1, id: 'wake', title: 'Wake', place: "St. Inode's Hospital",
    unlocks: ['pwd', 'ls', 'cd', 'cat', 'whoami', 'clear'],
    intro: N`White.

Then a ceiling. Then the slow, patient beep of a machine that seems to be counting for you.

You are lying in a narrow bed. Your head feels like an empty drawer: you can sense the shape of the space where your memories should be, but there is nothing inside.

A nurse with silver-rimmed glasses leans into view.

@Ines: Easy. You're safe. You're at St. Inode's Hospital. They found you at the edge of the Void three nights ago.
@Ines: You remembered your name when you came round — that's a good start. The rest will come back. The trick is to orient yourself. Start small.
@Ines: In Rootfall you talk to the city through this terminal. First, ask it where you are. The word is «pwd».

:::lesson
**pwd** means *print working directory*. It tells you which place — which **directory** — you are standing in right now.
Type «pwd» and press **Enter**.
:::`,
    steps: [
      {
        goal: 'Ask the city where you are: type «pwd» and press Enter.',
        hints: ['Type the three letters «pwd» and press Enter.', 'Just type: «pwd»'],
        check: (e) => !!e.ran('pwd'),
        solve: ['pwd'],
        done: N`@Ines: There. That line is your **path**. Read it from left to right:

:::art
   /  hospital  /  floor3  /  room307
   |     |           |          '-- this room
   |     |           '------------- the third floor
   |     '------------------------- St. Inode's Hospital
   '------------------------------- the root of the whole city
:::

@Ines: Every place in Rootfall has an address like that. Each «/» is a doorway from one place into the next.`,
      },
      {
        say: N`@Ines: Now look around you. «ls» *lists* everything in the place you're standing.`,
        goal: 'Look around the room: «ls»',
        hints: ['Type «ls» (that\'s a lowercase L, then s).', 'Type: «ls»'],
        check: (e) => !!e.ran('ls'),
        solve: ['ls'],
        done: N`A chart clipped to the foot of the bed. A window. A small cabinet.

:::lesson
In the output of «ls», **directories** — places you can step into — are shown in **blue**. Everything else is a **file**: something you can read.
:::

@Ines: That chart is yours. Read it with «cat». It's short for *concatenate*, but everybody just uses it to print a file to the screen.`,
      },
      {
        goal: 'Read your chart: «cat chart.txt»',
        hints: ['«cat» followed by the name of a file prints that file.', 'Names must match exactly, including the «.txt». Type: «cat chart.txt»'],
        check: (e) => e.didRead(R307 + '/chart.txt'),
        nudge: (e) => (e.tried('cat') && !e.ran('cat') ? '@Ines: Careful — the name has to match *exactly*, «.txt» and all. Try «cat chart.txt».' : null),
        solve: ['cat chart.txt'],
        done: N`@Ines: Lethe? That means nothing to me either. It's an old word. The river of forgetting, in some story or other.

Something cold moves at the back of your mind, and then it's gone.

@Ines: The chart says your name is {user}. Names on paper can be wrong, though. Ask the city who it thinks you are: «whoami».`,
      },
      {
        goal: 'Ask the city who you are: «whoami»',
        hints: ['One word, all lowercase: «whoami»'],
        check: (e) => !!e.ran('whoami'),
        solve: ['whoami'],
        done: N`**{user}.** The city agrees with the chart. At least one thing hasn't been forgotten.

@Ines: Your belongings are in the cabinet. To step *into* a directory, use «cd» — *change directory*. Like this: «cd cabinet»`,
      },
      {
        goal: 'Step into the cabinet: «cd cabinet»',
        hints: ['«cd» followed by a directory name moves you into it.', 'Type: «cd cabinet»'],
        check: (e) => e.cwd === R307 + '/cabinet',
        solve: ['cd cabinet'],
        done: N`The cabinet door creaks open.

:::lesson
Notice your **prompt** — the text before your cursor — changed. It always shows where you are, so you never have to guess.
:::`,
      },
      {
        say: N`@Ines: Go on. Have a look at what you came in with.`,
        goal: 'Look inside with «ls», then read «wallet.txt» with «cat»',
        hints: ['First «ls» to see what is here.', 'Then: «cat wallet.txt»'],
        check: (e) => e.didRead(R307 + '/cabinet/wallet.txt'),
        solve: ['ls', 'cat wallet.txt'],
        done: N`*City Operator.*

The words land like a key turning in a lock you didn't know you had. You don't remember the job — but your hands do. They want a keyboard.

The address on the card is water-damaged. Only «/h» survived.

@Ines: Operator? *The* Operator? Half the city has been looking for you... Well. Doctor's orders still apply: one thing at a time.

:::lesson
There's also a «coat_pocket.txt» in here, if you're curious. Exploring is always allowed in Rootfall — curiosity is how Operators are made.
:::`,
      },
      {
        say: N`@Ines: To go back out, use «cd ..» — two dots mean **the parent directory**: the place that contains the one you're in.`,
        goal: 'Go back up into the room: «cd ..»',
        hints: ['There is a space between «cd» and «..»', 'Type: «cd ..»'],
        check: (e) => e.cwd === R307 && !!e.ran('cd'),
        solve: ['cd ..'],
        done: N`:::lesson
«..» always means *one level up*. A single dot «.» means *right here*. You'll use both constantly.
:::`,
      },
      {
        say: N`@Ines: Good. Now out into the hallway — that's one more level up. Then take a look around.`,
        goal: 'Step out to the hallway (/hospital/floor3) and look around with «ls»',
        hints: ['The hallway is the parent of this room: «cd ..»', 'Then «ls» to look around.'],
        check: (e) => e.cwd === '/hospital/floor3' && !!e.ran('ls'),
        solve: ['cd ..', 'ls'],
        done: N`A long, quiet corridor. Doors marked 301 to 309, a supply closet, and the nurses' station at the far end.

@Ines (from down the hall): Over here! Your discharge papers are at the nurses' station.

:::lesson
Screen getting crowded? «clear» wipes it clean. (So does **Ctrl+L**.)
:::`,
      },
      {
        goal: 'Go into «nurses_station» and read «discharge_note.txt»',
        hints: ['«cd nurses_station», then «ls».', 'Then: «cat discharge_note.txt»'],
        check: (e) => e.didRead('/hospital/floor3/nurses_station/discharge_note.txt'),
        solve: ['cd nurses_station', 'cat discharge_note.txt'],
        done: N`:::lesson
You can chain directories in one path. «cd ../../lobby» means: up one level (to floor3), up again (to hospital), then into «lobby».
:::

@Ines: Off you go. And — be careful out there. The nights have been strange.`,
      },
      {
        goal: 'Take the stairs to the lobby in a single move: «cd ../../lobby»',
        hints: ['Two levels up, then into lobby — all in one path.', 'Type: «cd ../../lobby»'],
        check: (e) => e.cwd === '/hospital/lobby',
        solve: ['cd ../../lobby'],
        done: N`The lobby smells of floor polish and rain. Near the revolving door, on a pile of newspapers, sits a small penguin. He is watching you with enormous patience.

:::art
        .--.
       |o_o |
       |:_/ |
      //   \ \
     (|     | )
    /'\_   _/'\
    \___)=(___/
:::

He hops down, waddles over, and leans against your leg as if he has been waiting for exactly this.

@Ines (over the intercom): Oh! That's Tux. He came in with you, actually — wouldn't let the dock workers carry you anywhere without him. Bit Dr. Halloran.
@Ines (over the intercom): He's yours, I think. If you get stuck, type «hint» — he has a way of nudging people in the right direction.`,
      },
      {
        say: N`Ines said someone left something for you at the front desk.`,
        goal: 'Find the note waiting for you at the «front_desk» and read it',
        hints: ['Look around the lobby with «ls». The front desk is a directory.', '«cd front_desk», then «ls», then «cat» the note.', 'You can read a file inside a directory without walking in: «cat front_desk/note_for_307.txt»'],
        check: (e) => e.didRead('/hospital/lobby/front_desk/note_for_307.txt'),
        solve: ['ls', 'cat front_desk/note_for_307.txt'],
        done: N`*M. Fen.* The name tugs at something — the smell of old paper, a voice saying *read the manual first*.

:::lesson
A path that starts with «/» is **absolute**: it works from anywhere, because it starts at the root.
A path *without* a leading «/» is **relative**: it starts from where you are now.
«/usr/share/doc» is absolute. «front_desk/note_for_307.txt» is relative.
:::`,
      },
      {
        goal: 'Step out into the city: go to the root with «cd /», then look around with «ls»',
        hints: ['The root of the whole city is just a single slash.', 'Type «cd /» and then «ls».'],
        check: (e) => e.cwd === '/' && !!e.ran('ls'),
        solve: ['cd /', 'ls'],
        done: N`The revolving door spins you out into Rootfall.

:::art
                       R O O T F A L L
                              /
    .------.-------.------.------.------.------.------.------.
   /etc  /home   /usr   /var   /tmp   /dev   /proc  /mnt   /root
   City  Homes   Old    The    Night  The    Power  Under- The
   Hall          Town   Chron- Market Docks  Sta-   croft  Spire
                   |    icle                 tion
          /usr/share/doc  <- the Great Library
:::

Every district of the city hangs from this one point: «/», the **root**. Tux surveys it all like a small, proud landlord.`,
      },
      {
        say: N`As the door swung shut behind you, Ines called out one last thing:

@Ines: Oh — and if you ever get lost, type «cd» with nothing after it. It always takes you **home**. Wherever home turns out to be.`,
        goal: 'Try to go home: type «cd» on its own',
        hints: ['Just the two letters, nothing else: «cd»'],
        check: (e) => e.recs.some((r) => r.name === 'cd' && r.status !== 0 && (r.args.length === 0 || ['~', '~/', e.home].includes(r.args[0]))),
        solve: ['cd'],
        done: N`*Permission denied.*

The city knows exactly where your home is. It just won't let you in.

Tux stares at the words on the screen for a long time. Then he looks up at you, and for the first time he seems worried.`,
      },
    ],
    outro: N`Somewhere across the city, a bell rings noon. You have a name, a job you don't remember, a penguin, and a locked door.

It's a start.`,
  });
})();
