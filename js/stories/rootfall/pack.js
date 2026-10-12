/* Rootfall — a city that is a filesystem, and an Operator who has forgotten it. Story pack definition. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const A = LA.ansi;

  const MEMORY_PATHS = { '/root/bea_card.txt': 'memory_09' };
  const SECRET_PATHS = {
    '/hospital/floor3/room307/.under_pillow': 'under_pillow',
    '/hospital/floor3/room309/mr_finch.txt': 'finch',
    '/usr/share/doc/.restricted_section/forbidden_index.txt': 'restricted',
    '/var/.hollow/plan.txt': 'hollow_plan',
    '/dev/null': 'void',
  };

  const pack = LA.defineStory('rootfall', {
    title: 'Rootfall',
    tagline: 'Wake in a city that is a filesystem — and find out who made it forget.',
    blurb: 'You wake in St. Inode\'s Hospital with no memory, in a city whose streets are directories. A slow, gentle mystery with a penguin, a stolen password and a sweeper that erases more than it should.',
    pace: 'Gentle pace · thorough lessons',
    cardArt: String.raw`        _    |~|     ___         _
  ____ | |___| |____|   |__ /\  | |___
 | [] || [] [] [] [] |[]| [] ||[]|| [] |
=============== ROOTFALL ================`,
    saveKey: 'linux-awakening-save',
    hostname: 'rootfall',
    startCwd: () => '/hospital/floor3/room307',
    startClock: [0, 11, 40],
    companion: 'Tux',
    speakers: { ines: '#7dd3fc', tux: '#e2e8f0', mags: '#c4b5fd', hal: '#fca5a5', ingrid: '#fdba74', osei: '#86efac', mara: '#f9a8d4', juno: '#fde047', wren: '#5eead4', you: '#a3e635', bea: '#cbd5e1', hollow: '#ef4444' },
    reserved: ['root', 'hollow', 'mara', 'wren', 'ines', 'mags', 'hal', 'osei', 'ingrid', 'juno', 'finch', 'daemon', 'bin', 'sys', 'man', 'mail', 'nobody', 'syslog', 'sshd', 'guest', 'operators', 'users', 'sudo', 'adm', 'staff'],
    boot: {
      lines: [
        ['ROOTFALL BIOS v1991.10   (c) Kernel Works Integrated', 'fg-k2'],
        ['Memory test ........................ 2034688K OK', ''],
        ['Detecting drives ................... sda (20G)  sdb (2G)', ''],
        ['Loading kernel 6.1.0-rootfall ...... ok', ''],
        ['Mounting / (ext4) .................. ok', ''],
        ['Starting systemd ................... ok', ''],
        ['Checking user memories ............. ', ''],
      ],
      error: 'ERROR: no memories found',
      banner: ['ROOTFALL'],
      tagline: 'a city that forgot itself',
    },
    nameIntro: `Somewhere very far away, a voice.

@Voice: ...can you hear me? Don't try to move. You've been asleep a long time.
@Voice: Can you tell me your name?

:::lesson
Type your name and press **Enter**. It becomes your **username** in Rootfall, so keep it simple: lowercase letters and digits, starting with a letter (2–16 characters).
:::`,
    namePrompt: 'your name:',
    nameWait: 'The voice waits. (Type a name, then press Enter.)',
    nameTaken: (n) => `"${n}" already belongs to someone in Rootfall. Choose another name.`,
    nameRules: 'Rootfall\'s register is old-fashioned: lowercase letters and digits only, starting with a letter, 2–16 characters. Try again.',
    savedLabel: 'A saved city',
    scope: 'Rootfall is built on {distroFull}: Bash, GNU tools, systemd and {pm}. Other systems — and macOS — differ in details.',

    secrets: {
      under_pillow: ['Under the Pillow', 'Found the note you left yourself'],
      finch: ['Talking to Walls', 'Listened to Mr. Finch'],
      restricted: ['The Restricted Section', 'Peeked behind the Library\'s hidden door'],
      arcade: ['Insert Coin', 'Found the hidden arcade'],
      choo_choo: ['Choo Choo', 'Rode the steam locomotive'],
      moo: ['Super Cow Powers', 'Heard the cow'],
      fortune: ['Fortune Favours the Curious', 'Opened a fortune cookie'],
      vim_exit: ['Escape Artist', 'Got out of vim alive'],
      nice_try: ['Nice Try', 'Tried to delete the whole city'],
      fork_bomb: ['Bomb Squad', 'Typed the forbidden fork bomb'],
      sandwich: ['Okay.', 'Made root make you a sandwich'],
      xyzzy: ['A Hollow Voice', 'Spoke the magic word'],
      void: ['Staring into the Void', 'Read from /dev/null'],
      dns_txt: ['The Penguin\'s Record', 'Found Tux\'s DNS record'],
      robots: ['Not a Robot', 'Read what robots were told not to'],
      pet_tux: ['Good Penguin', 'Gave Tux the attention he deserves'],
      hollow_plan: ['Know Thy Enemy', 'Read Hollow\'s plan'],
      neofetch: ['Show-off', 'Ran neofetch'],
      matrix: ['Follow the White Penguin', 'Saw the matrix'],
    },
    collect: {
      label: 'Memories', noun: 'memory', tag: '✦ Memory', banner: 'MEMORY RECOVERED',
      items: {
        memory_01: 'The Apprentice', memory_02: 'The Lighthouse, Twice', memory_03: 'The Egg at the Docks',
        memory_04: 'The Keys', memory_05: 'First Sign', memory_06: 'Hollow', memory_07: 'Lethe', memory_08: 'The Bridge', memory_09: 'The Void',
      },
    },

    hintSpeaker: (g) => (g.state.ch > 0 || g.state.step >= 9 ? 'Tux' : 'Ines'),
    flavor: {
      rmGuard: 'Tux plants himself on the Enter key and refuses to move.',
      rmGuardWhy: 'the city stands on it',
      rmRoot: 'Tux launches himself across the keyboard and the command dies mid-keystroke.\nrm: operation cancelled by a very brave penguin',
      killSelf: 'Tux grabs your sleeve. Killing your own shell would log you out of Rootfall entirely. Let\'s not.',
      forkBomb: 'Tux seizes the power cable in his beak and glares at you.',
      emacs: '(Tux shudders. Some wars are best not restarted. Try nano.)',
      sl: '(Tux snickers. Did you mean ls?)',
      vimHelp: 'Tux whispers',
      topExit: "Tux plants himself on the keyboard. There's nowhere to log out to, Operator — Rootfall needs you.",
      outside: `@Tux: (Tux shakes his head slowly.) Rootfall has no road to the outside world, {user}. Only the Lighthouse looks out.`,
      done: `@Tux: (Tux shrugs magnificently.) You're on your own now — and you're ready. Try «help» or «man» anything.`,
      moreSecrets: 'hidden around Rootfall',
      epilogueTitle: 'The Operator', epiloguePlace: 'Rootfall remembers.',
      rewinding: 'Rewinding Rootfall…',
      replayNote: 'The city will be rebuilt as it was at the start of that chapter.',
      welcomeBack: 'Welcome back to Rootfall, {user}. The city remembers you now. Everything is unlocked — explore freely.',
      dropped: (r) => `Your connection to the ${r.host === 'lighthouse' ? 'Lighthouse' : r.host} dropped while you were away — you're back on rootfall. Reconnect with «ssh ${r.user}@${r.host}» to carry on there.`,
    },
    badPassword(g) {
      if (g.state.flags.pwChanged) return `@Tux: (Tux leans in and whispers. You changed it with Mara: it's «{pw}».)`;
      return `@Tux: (Tux taps the sticky note with his beak. Then he taps his own chest, very pointedly. Then he points at the year the city was founded.)`;
    },
    notFound(g, name, argv) {
      const msgs = {
        xyzzy: () => { g.secret('xyzzy'); return 'A hollow voice says "Fool."\n'; },
        plugh: () => 'A hollow voice says "Fool."\n',
        pet: () => {
          if (argv && /tux|penguin/i.test(argv.slice(1).join(' '))) {
            g.secret('pet_tux');
            return LA.paint(A.byellow, '  ♥  ♥  ♥') + '\n' + 'Tux leans into your hand and makes a sound like a very small, very happy kettle.\n';
          }
          return 'bash: pet: command not found\n';
        },
        tux: () => 'Tux looks up at the sound of his name, then back at you, expectantly.\n(He would like a fish. He would always like a fish.)\n',
        hollow: () => `bash: hollow: command not found\n${LA.paint(A.gray, '(The name tastes like ash.)')}\n`,
      };
      return msgs[name] ? msgs[name]() : null;
    },
    onRead(g, abs) {
      let base = abs.replace(/^.*\//, '').replace(/\.txt$/, '');
      if (MEMORY_PATHS[abs]) base = MEMORY_PATHS[abs];
      else if (!/^memory_0[1-8]$/.test(base)) base = null;
      if (base && g.collect(base)) {
        g.state.flags['read_' + base + '_ch'] = g.state.ch;
        if (LA.MEMORY_FLASH && LA.MEMORY_FLASH[base]) g.notices.push(LA.MEMORY_FLASH[base](g));
      }
      if (SECRET_PATHS[abs]) g.secret(SECRET_PATHS[abs]);
    },
    onCd(g, abs) {
      if (abs === '/opt/.arcade' || abs.startsWith('/opt/.arcade/')) g.secret('arcade');
      if (abs.startsWith('/usr/share/doc/.restricted_section')) g.secret('restricted');
    },
    onUrl(g, url) { if (/keeper-only/.test(url)) g.secret('robots'); },
    onDns(g, name, answers) { if (/tux/i.test(name) && answers.some((a) => a.type === 'TXT')) g.secret('dns_txt'); },
  });

  /* Juno brings the Undercroft disk back and plugs it in */
  pack.plugBackup = (g) => {
    const w = g.world;
    if (!w.devices.unplugged_backup) return;
    w.devices.sdb1 = w.devices.unplugged_backup;
    delete w.devices.unplugged_backup;
    for (const b of ['sdb', 'sdb1']) g.fs.put('/dev/' + b, '', { special: 'block', mode: 0o660, group: 'disk', immutable: true });
    w.disks.push({ name: 'sdb', majmin: '8:16', rm: '1', size: '2G', parts: [{ name: 'sdb1', majmin: '8:17', size: '2G', fstype: 'ext4', label: 'UNDERCROFT', uuid: 'b4ck0p00-dead-beef-0000-und3rcr0ft01' }] });
    const s = (LA.now() - w.bootTime) / 1000;
    for (const [d, msg] of [[0, 'usb 2-1: new high-speed USB device number 3 using xhci_hcd'], [1.0, 'sd 2:0:0:0: [sdb] 4194304 512-byte logical blocks: (2.15 GB/2.00 GiB)'], [1.01, 'sd 2:0:0:0: [sdb] Attached SCSI removable disk'], [1.05, ' sdb: sdb1']]) w.dmesg.push({ s: s - 20 + d, msg });
  };

  /* the chapter files of this story register themselves with LA.story.add */
  LA.story = pack;
})();
