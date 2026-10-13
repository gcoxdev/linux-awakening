/* Night Train, Chapter 1 — The Missing Engineer (pwd, ls, cd, cat, whoami, hostname, clear) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const pack = LA.stories.nighttrain;
  const CARS = '/srv/meridian/cars';

  pack.add({
    n: 1, id: 'missing', title: 'The Missing Engineer', place: 'mile 25 · the staff car', clock: [1, 0, 14],
    unlocks: ['pwd', 'ls', 'cd', 'cat', 'whoami', 'hostname', 'clear'],
    intro: N`The door slides open before you've finished sitting up. Abel Okonkwo, train manager, forty years on the Meridian, is in full uniform at a quarter past midnight, and he is not calm.

@Abel: The Halvard Atlas is gone. Dr. Brandt opened the safe for her hourly check at twelve minutes past and found a railway timetable, folded to size, in the case. And Vesna — Vesna isn't answering her page. She isn't anywhere I've looked.
@Abel: You're the only other person aboard who can read that machine. So read it.

He points at rack 7 — the server, humming at the end of the staff car — and the terminal waiting on the fold-down desk beside it.

A girl of about twelve in pajamas and an enormous cardigan is standing in the corridor behind him, holding a notebook.

@June: I'm June. B14. I can't sleep on trains, I know every station on this line, and I saw something. Can I watch?
@Abel: ...Fine. Don't touch anything.

:::art
   ____    ____    ____    ____    ____    ____    ____    ____
  |LOCO|==|BAGG|==|DINE|==|LNGE|==|SL A|==|SL B|==|STAF|==|MAIL|
  '-oo-'  '-oo-'  '-oo-'  '-oo-'  '-oo-'  '-oo-'  '-oo-'  '-oo-'
    1       2       3       4       5       6       7       8
           safe                                   you    sealed
:::`,
    steps: [
      {
        say: N`The terminal is open, cursor blinking. Vesna's first rule for any strange machine: work out where you are before you do anything. «pwd» — *print working directory* — tells you which directory you're standing in.`,
        goal: 'Find out where you are: «pwd»',
        hints: ['Type «pwd» and press Enter.'],
        check: (e) => !!e.ran('pwd'),
        solve: ['pwd'],
        done: N`«/home/{user}» — your **home directory**. Every user gets one; it's where you start.`,
      },
      {
        say: N`«ls» *lists* what's in the directory you're in.`,
        goal: 'See what is in your home directory: «ls»',
        hints: ['Type «ls».'],
        check: (e) => !!e.ran('ls', (r) => !e.ops(r).length) && e.cwd === e.home,
        solve: ['ls'],
        done: N`One file: «README_FIRST.txt». Vesna left it for you before your shift.`,
      },
      {
        say: N`«cat» prints a file onto the screen. Read what she left you.`,
        goal: 'Read Vesna\'s note: «cat README_FIRST.txt»',
        hints: ['Type «cat README_FIRST.txt». (Tab completes file names: type «cat R» and press Tab.)'],
        check: (e) => e.didRead(e.home + '/README_FIRST.txt'),
        solve: ['cat README_FIRST.txt'],
        done: N`@June: "Logs don't lie. People who edit logs do." That's good. I'm writing that down.

:::lesson
Press **Tab** to complete a file or command name, and **↑** to bring back a command you typed before. Real engineers type a lot less than you'd think.
:::`,
      },
      {
        say: N`Two more questions any engineer asks a machine they've just sat down at: *who am I on here?* and *which machine is this?* «whoami» answers the first, «hostname» the second.`,
        goal: 'Run «whoami», then «hostname»',
        hints: ['Two commands, one after the other: «whoami» then «hostname».'],
        check: (e) => e.stepRan('whoami') && e.stepRan('hostname'),
        solve: ['whoami', 'hostname'],
        done: N`«{user}» on «meridian». The whole train runs through this box: doors, cameras, the safe, the speakers.`,
      },
      {
        say: N`The README said the train itself lives in «/srv/meridian». A path that starts with «/» is **absolute**: it starts from the very top of the filesystem, so it works wherever you are. «cd» — *change directory* — takes you there.`,
        goal: 'Go to the train\'s directory: «cd /srv/meridian»',
        hints: ['Type «cd /srv/meridian».'],
        check: (e) => e.cwd === '/srv/meridian',
        solve: ['cd /srv/meridian'],
        done: N`:::art
/                     the root of everything
└── srv               data this server serves
    └── meridian      the train   <- you are here
:::`,
      },
      {
        say: N`Look around, then step into «cars». A path *without* a leading «/» is **relative**: it starts from where you are now.`,
        goal: 'List this directory with «ls», then go into it: «cd cars»',
        hints: ['First «ls» to see what\'s here.', 'Then «cd cars» — no slash at the front, because «cars» is right here.'],
        check: (e) => e.cwd === CARS && e.stepRan('ls'),
        solve: ['ls', 'cd cars'],
        done: N`«ls» here would show eight cars, front to back, one directory each.`,
      },
      {
        say: N`The baggage car is «car2_baggage». Go in and read its «status» file.`,
        goal: 'Go into the baggage car and read its status: «cd car2_baggage» then «cat status»',
        hints: ['«cd car2_baggage»', 'then «cat status»'],
        check: (e) => e.didRead(CARS + '/car2_baggage/status'),
        solve: ['cd car2_baggage', 'cat status'],
        done: N`*Atlas case present. Atlas missing. Inside the case: a railway timetable, folded to size, wrapped in tissue.*

@June: That's *our* timetable. This season's. He swapped it on the train.`,
        evidence: 'decoy',
      },
      {
        say: N`Plain «ls» skips files whose names start with a dot. Those are **hidden** files — usually settings, sometimes things people would rather you didn't notice. «ls -a» shows *all* of them. The «-a» is an **option**: a dash and a letter that changes what a command does.`,
        goal: 'List everything here, hidden files too: «ls -a»',
        hints: ['Type «ls -a».'],
        check: (e) => !!e.ran('ls', (r) => e.has(r, 'a') && /\.fault_ticket/.test(r.out)),
        solve: ['ls -a'],
        done: N`«.  ..  .fault_ticket  certificate  decoy.jpg  door  safe.log  status  temp»

«.» means *this directory* and «..» means *the one above it*. And then there's «.fault_ticket».`,
      },
      {
        say: N`Read it.`,
        goal: 'Read the hidden file: «cat .fault_ticket»',
        hints: ['Type «cat .fault_ticket» — the dot is part of the name.'],
        check: (e) => e.didRead(CARS + '/car2_baggage/.fault_ticket'),
        solve: ['cat .fault_ticket'],
        done: N`23:38 — the safe's vibration sensor goes off. The system pages card 0201: Vesna. She answers: *"on my way. probably the viaduct joints again."*

She walked to this car. Then, somewhere between here and anywhere else, she stopped existing.`,
        evidence: 'fault',
      },
      {
        say: N`If she came here, she'd have walked back toward the staff car afterwards. «..» is the directory above this one, so «../car7_staff» means *up one level, then into car7_staff* — the next car over, as far as paths are concerned.`,
        goal: 'Go to the staff car\'s directory in one step: «cd ../car7_staff»',
        hints: ['Type «cd ../car7_staff».'],
        check: (e) => e.cwd === CARS + '/car7_staff',
        solve: ['cd ../car7_staff'],
        done: N`From «/srv/meridian/cars/car2_baggage», «..» is «/srv/meridian/cars», and from there «car7_staff» is one step down.`,
      },
      {
        say: N`The screen is full of the train. «cd ~» takes you home from anywhere (the «~» means *your home directory*), and «clear» wipes the screen so you can think.`,
        goal: 'Go home with «cd ~», then «clear» the screen',
        hints: ['«cd ~» then «clear». (Ctrl+L also clears.)'],
        check: (e) => e.cwd === e.home && e.stepRan('clear'),
        solve: ['cd ~', 'clear'],
        done: N`A clean screen. A missing atlas, a missing engineer, and fifty miles of mountain before the next stop.`,
      },
    ],
    outro: N`@Abel: Dr. Brandt is in A5, trying not to be sick. The insurance man — Mr. Marsh, the escort — is sitting with her. Very calm about it all. Very helpful.
@Abel: Find me Vesna, Engineer.`,
  });
})();
