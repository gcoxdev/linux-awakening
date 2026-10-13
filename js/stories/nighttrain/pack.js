/* Night Train — a sleeper train, a stolen atlas, a missing engineer and one terminal. Story pack definition. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const A = LA.ansi;

  const SECRET_PATHS = {
    '/srv/meridian/cars/car3_dining/.stew': 'stew',
    '/srv/meridian/cars/.car9/manifest.txt': 'ghost_car',
  };
  /* reading these files puts something in the case file, even when no step asks for it */
  const EVIDENCE_PATHS = {
    '/srv/meridian/cars/car4_lounge/smoke.log': 'alibi',
    '/srv/meridian/cars/car5_sleeper_a/lost_property.txt': 'coat',
    '/var/lib/.maint/tidy.sh': 'checklist',
  };

  const pack = LA.defineStory('nighttrain', {
    title: 'Night Train',
    tagline: 'A priceless atlas vanished at midnight. So did your mentor.',
    blurb: 'A fast-moving mystery on a sleeper train, with fourteen stops until the border.',
    pace: 'Fast pace',
    accent: '#fbbf24',
    cardArt: String.raw`  ____________   ____________   ____________
 |[] [] [] [] | |[] [] [] [] | |  MERIDIAN  |>
 '-o--o----o-o' '-o--o----o-o' '-o-o---o-o-'
=================================================`,
    hostname: 'meridian',
    startCwd: (u) => '/home/' + u,
    startClock: [1, 0, 14],
    companion: 'June',
    speakers: {
      abel: '#93c5fd', june: '#fbbf24', vesna: '#5eead4', rosa: '#fca5a5', amadou: '#fdba74', ottilie: '#c4b5fd',
      marsh: '#cbd5e1', constance: '#f9a8d4', holm: '#86efac', you: '#a3e635', pa: '#fde047',
    },
    reserved: ['root', 'vesna', 'abel', 'rosa', 'amadou', 'kiosk', 'maint', 'june', 'marsh', 'daemon', 'bin', 'sys', 'man', 'mail', 'nobody', 'syslog', 'sshd', 'cctv', 'crew', 'sudo', 'adm', 'users', 'meridian'],
    boot: {
      lines: [
        ['MERIDIAN ONBOARD SYSTEMS — rack 7, staff car', 'fg-k2'],
        ['Train ............................... 1N47 Calder → Port Isolde', ''],
        ['Position ............................ mile 25, climbing', ''],
        ['Doors ............................... 23 locked, 9 closed', ''],
        ['Radio link .......................... NO SIGNAL (mountains)', ''],
        ['Baggage car safe .................... ', ''],
      ],
      error: 'ALARM: CONTENTS MISMATCH — 00:12',
      banner: ['NIGHT', 'TRAIN'],
      tagline: 'a mystery in fourteen stops',
    },
    nameIntro: `Someone is hammering on the door of your bunk.

@Abel: Engineer. Engineer! Up. Now. I'm sorry — I know it's your first night. What's your name again? I want it right for the report.

:::lesson
Type your name and press **Enter**. It becomes your **username** on the train's server, so keep it simple: lowercase letters and digits, starting with a letter (2–16 characters).
:::`,
    namePrompt: 'your name:',
    nameWait: 'Abel waits, pen raised. (Type a name, then press Enter.)',
    nameTaken: (n) => `"${n}" is already on the crew list. Choose another name.`,
    nameRules: 'The crew system is old: lowercase letters and digits only, starting with a letter, 2–16 characters. Try again.',
    savedLabel: 'A saved journey',
    scope: 'The Meridian is built on {distroFull}: Bash, GNU tools, systemd and {pm}. Other systems — and macOS — differ in details.',

    secrets: {
      choo_choo: ['All Aboard', 'Ran the steam locomotive'],
      ghost_car: ['The Ninth Car', 'Found the car that isn\'t on the timetable'],
      stew: ['Family Recipe', 'Read Amadou\'s grandmother\'s stew'],
      guestbook: ['Wish You Were Here', 'Signed the lounge guestbook'],
      whistle: ['Two Short, One Long', 'Asked Rosa for the whistle'],
      fortune: ['Fortune Cookie', 'Opened a fortune cookie in the dining car'],
      moo: ['Super Cow Powers', 'Heard the cow'],
      vim_exit: ['Escape Artist', 'Got out of vim alive'],
      nice_try: ['Emergency Brake', 'Tried to delete the whole train'],
      fork_bomb: ['Runaway Train', 'Typed the forbidden fork bomb'],
      sandwich: ['Okay.', 'Made root make you a sandwich'],
      neofetch: ['Show-off', 'Ran neofetch'],
      dns_txt: ['The Train\'s Own Record', 'Read the Meridian\'s TXT record'],
      robots: ['Staff Only', 'Read what the auction house told robots not to'],
    },
    collect: {
      label: 'Evidence', noun: 'evidence', tag: '◆ Evidence', banner: 'ADDED TO THE CASE FILE',
      items: {
        decoy: 'The Decoy in the Safe',
        fault: 'The 23:38 Fault',
        witness: 'A Man in a Gray Coat',
        edited: 'Edited After Midnight',
        card0417: 'Card 0417',
        history: 'Commands She Never Typed',
        alibi: 'A Cigarette in the Lounge',
        deleted: 'The Deleted Lines',
        frame: 'Frame 23:44',
        coat: 'The Coat in A-car',
        impostor: 'The Real Escort',
        checklist: 'His Checklist',
        sack: 'Mail Sack K-27',
      },
    },

    hintSpeaker: () => 'June',
    flavor: {
      rmGuard: 'June grabs your wrist before you can press Enter.',
      rmGuardWhy: 'the train runs on it',
      rmRoot: 'June yanks the keyboard cable out of the rack, then plugs it back in, glaring.\nrm: operation canceled. "You don\'t pull the emergency brake to see what happens," she says.',
      killSelf: 'June puts her hand flat over the keyboard. "That\'s your own shell. Kill it and you\'re logged out of the whole train."',
      forkBomb: 'June reads it, goes pale, and deletes it character by character.',
      emacs: '(June: "Vesna says Emacs is a fine operating system lacking a decent editor. Use nano.")',
      sl: '(June: "You mean ls. Though… sl is a real program. A steam locomotive. Just saying.")',
      vimHelp: 'June hisses',
      topExit: 'June shakes her head. "Log out of the train? Now? Absolutely not."',
      outside: `@June: (June taps the window. Nothing out there but mountains.) No signal until we're out of the Merrow Tunnel. The train is its own little world till then.`,
      done: `@June: You don't need me any more. You never really did. (She means it as a compliment.) Try «help», or «man» anything.`,
      moreSecrets: 'somewhere on the train',
      epilogueTitle: 'Port Isolde', epiloguePlace: 'The night is over.',
      rewinding: 'Running the night back…',
      replayNote: 'The train will be put back exactly as it was at the start of that chapter.',
      welcomeBack: 'Welcome back aboard, {user}. The Meridian is in Port Isolde and the night is over — everything is unlocked. Explore freely.',
      dropped: (r) => `Your connection to ${r.host} dropped while you were away — you're back on meridian. Reconnect with «ssh ${r.user}@${r.host}» to carry on there.`,
      neofetchLine: '\x1b[1;36mTrain\x1b[0m: 1N47 Calder → Port Isolde (on time, somehow)',
    },
    badPassword(g) {
      if (g.state.flags.pwChanged) return `@June: (whispering) You changed it. It's «{pw}». I watched. Sorry. Vesna says never let anyone watch.`;
      return `@June: Your password's in Vesna's README, isn't it? «cat ~/README_FIRST.txt». Everyone puts passwords in READMEs. That's why she tells you to change it.`;
    },
    notFound(g, name) {
      const msgs = {
        whistle: () => { g.secret('whistle'); return `${LA.paint(A.byellow, 'PAAAP — PAP — PAAAAAAP')}\nFrom the locomotive, Rosa obliges: two short, one long. Somewhere in sleeper B, a baby starts crying. Abel closes his eyes.\n`; },
        june: () => 'June looks up. "What? I\'m helping."\n',
        marsh: () => `bash: marsh: command not found\n${LA.paint(A.gray, '(June: "Not yet.")')}\n`,
        tickets: () => 'Abel, without looking up: "Tickets were checked at Calder, Engineer."\n',
      };
      return msgs[name] ? msgs[name]() : null;
    },
    onRead(g, abs) {
      if (SECRET_PATHS[abs]) g.secret(SECRET_PATHS[abs]);
      if (EVIDENCE_PATHS[abs]) g.collect(EVIDENCE_PATHS[abs]);
    },
    onCd(g, abs) {
      if (abs === '/srv/meridian/cars/.car9' || abs.startsWith('/srv/meridian/cars/.car9/')) g.secret('ghost_car');
    },
    /* as the night goes on, the server keeps writing: bring recorder.log up to the current time */
    onChapter(g) {
      const n = g.fs.tryGet('/var/log/meridian/recorder.log');
      if (!n || !pack.recorderLines) return;
      const T = pack.nightClock(g.world.flags.night);
      let text = pack.recorderLines(T, LA.now());
      if (LA.now() > T(3, 0, 30)) text += `${LA.util.strftime('%H:%M:%S', new Date(T(3, 0, 30)))} recorder-sync: ssh: connect to host loco-recorder: No route to host (recorder unplugged?)\n`;
      n.content = text;
    },
    /* signing the lounge guestbook (any way you like) */
    onLine(g) {
      const n = g.fs.tryGet('/srv/meridian/cars/car4_lounge/guestbook.txt');
      if (!n) return;
      const len = n.content.length;
      if (g.state.flags.guestbook === undefined) g.state.flags.guestbook = len;
      else if (len > g.state.flags.guestbook) g.secret('guestbook');
    },
    onUrl(g, url) { if (/\/staff/.test(url)) g.secret('robots'); },
    onDns(g, name, answers) { if (/meridian/i.test(name) && answers.some((a) => a.type === 'TXT')) g.secret('dns_txt'); },
  });
})();
