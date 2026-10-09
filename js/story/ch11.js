/* Chapter 11 — The Undercroft (sha256sum, tar, gzip/gunzip/zcat, zip/unzip, base64) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const U = LA.util;

  LA.story.add({
    n: 11, id: 'undercroft', title: 'The Undercroft', place: '/mnt/backup',
    unlocks: ['tar', 'gzip', 'gunzip', 'zcat', 'zip', 'unzip', 'sha256sum', 'md5sum', 'base64'],
    onStart(g) {
      if (!g.world.mounts.some((m) => m.dev === '/dev/sdb1')) g.world.mount('/dev/sdb1', '/mnt/backup');
    },
    intro: N`The stairs to the Undercroft go down further than the city should allow.

:::art
        ___________________________________
       |  T H E   U N D E R C R O F T      |
       |   /mnt/backup  ·  /dev/sdb1       |
       |___________________________________|
        |  ___      ___      ___      ___  |
        | |   |    |   |    |   |    |   | |
        | |___|    |___|    |___|    |___| |
     ___|_________________________________|___
:::

The air is cold and smells of old disks. Your own handwriting is on a label by the door: *If found, return to the Operator.*`,
    steps: [
      {
        goal: 'Go down into the Undercroft and look around: «cd /mnt/backup» then «ls -lh»',
        hints: ['Two commands: «cd /mnt/backup» then «ls -lh»'],
        check: (e) => e.cwd === '/mnt/backup' && !!e.ran('ls'),
        solve: ['cd /mnt/backup', 'ls -lh'],
        done: N`«memories.tar.gz», a few kilobytes of everything you were. «SHA256SUMS». «README.txt». «tux.png». And «lost+found», which every ext4 disk has and nobody ever looks in.`,
      },
      {
        goal: 'Read the note you left: «cat README.txt»',
        hints: ['Type: «cat README.txt»'],
        check: (e) => e.didRead('/mnt/backup/README.txt'),
        solve: ['cat README.txt'],
        done: N`*VERIFY BEFORE YOU TRUST ANYTHING.* Even down here you didn't trust anyone. Not even yourself.`,
      },
      {
        say: N`A **checksum** is a file's fingerprint: change a single byte and the fingerprint changes completely. «SHA256SUMS» holds the fingerprints you recorded when you made the backup. «sha256sum -c» recomputes them and compares.`,
        goal: 'Verify the backup is untouched: «sha256sum -c SHA256SUMS»',
        hints: ['Type: «sha256sum -c SHA256SUMS»'],
        check: (e) => !!e.ran('sha256sum', (r) => e.has(r, 'c')),
        solve: ['sha256sum -c SHA256SUMS'],
        done: N`«memories.tar.gz: OK»
«tux.png: OK»

Nobody has touched them. Hollow never found the Undercroft.

:::lesson
Download something important? Compare its checksum with the one the publisher lists. «sha256sum file» prints a fingerprint; «sha256sum -c LIST» verifies a list of them. («md5sum» is the older, weaker version.)
:::`,
      },
      {
        say: N`«.tar.gz» means two things wrapped around each other: **tar** bundles many files into one, and **gzip** squeezes it smaller. Before you unpack anything, look inside. tar's options are a little word: **t** = list (table), **z** = it's gzipped, **f** = the archive file comes next.`,
        goal: 'List what\'s inside the archive: «tar -tzf memories.tar.gz»',
        hints: ['Type: «tar -tzf memories.tar.gz» — the f must come last, right before the file name.'],
        check: (e) => !!e.ran('tar', (r) => e.has(r, 't') || /^t/.test(r.args[0] || '')),
        solve: ['tar -tzf memories.tar.gz'],
        done: N`«memories/memory_05.txt» through «memory_08.txt», and a file called «remember_this.txt».`,
      },
      {
        say: N`You can't unpack into the Undercroft — it's for keeping, not for living. Extract into your home instead: **x** = extract, **v** = verbose (show each file), and «-C ~» = change to your home directory first.`,
        goal: 'Unpack the archive into your home: «tar -xzvf memories.tar.gz -C ~»',
        hints: ['Type: «tar -xzvf memories.tar.gz -C ~»'],
        check: (e) => !!e.node(e.home + '/memories/memory_05.txt'),
        solve: ['tar -xzvf memories.tar.gz -C ~'],
        done: N`:::lesson
tar in one breath: «c» create · «x» extract · «t» list · «z» gzip · «v» verbose · «f FILE» archive file · «-C DIR» work in DIR.
«tar -czvf out.tar.gz folder/» packs; «tar -xzvf out.tar.gz» unpacks.
:::`,
      },
      {
        say: N`Four memories are waiting in «~/memories». Read them. Take your time.`,
        goal: 'Read memories 05 to 08: «cat ~/memories/memory_0*»',
        hints: ['A wildcard reads them all in order: «cat ~/memories/memory_0*» (or «less» them one by one).'],
        check: (e) => ['memory_05', 'memory_06', 'memory_07', 'memory_08'].every((m) => e.game.state.memories.includes(m)),
        solve: ['cat ~/memories/memory_0*'],
        done: N`You sit on the cold floor of the Undercroft for a long time.

Hollow, coming in through the Lighthouse night after night. Lethe, built in four nights to sweep up after him. The config rewritten from your own account, with your own guessable password. A backup made at 02:35, fragments stuffed into pockets at 02:40, and a one-way ticket to the Docks.

*Start with pwd.*

Tux climbs into your lap. He's never been a lap penguin. He is one now.`,
      },
      {
        say: N`Never again with only one copy. Make a fresh backup of everything you've recovered — this time **c** for create:
«cd ~»
«tar -czvf memories_backup.tar.gz memories»`,
        goal: 'Create your own archive: «tar -czvf memories_backup.tar.gz memories» (in your home)',
        hints: ['Go home first: «cd ~»', 'Then: «tar -czvf memories_backup.tar.gz memories»'],
        check: (e) => { const n = e.node(e.home + '/memories_backup.tar.gz'); return !!n && n.format === 'gzip'; },
        solve: ['cd ~', 'tar -czvf memories_backup.tar.gz memories'],
        done: N`A new archive, with your name on it, in a place you can reach.`,
      },
      {
        setup: (g) => {
          const p = g.home + '/restored.txt';
          if (!g.fs.tryGet(p)) g.fs.put(p, '=== restored memories ===\n' + Object.values(LA.FRAGMENTS).join(''), { owner: g.user, group: g.user });
        },
        say: N`«gzip» works on single files too. Squeeze your restored fragments, peek inside without unpacking, then put them back:
«gzip ~/restored.txt»  — replaces it with «restored.txt.gz»
«zcat ~/restored.txt.gz» — prints the contents, still compressed on disk
«gunzip ~/restored.txt.gz» — back to normal`,
        goal: 'Compress with «gzip», read with «zcat», decompress with «gunzip»',
        hints: ['Three commands, in order: «gzip ~/restored.txt», «zcat ~/restored.txt.gz», «gunzip ~/restored.txt.gz»'],
        check: (e) => e.stepRan('gzip') && e.stepRan('gunzip') && !!e.node(e.home + '/restored.txt'),
        solve: ['gzip ~/restored.txt', 'zcat ~/restored.txt.gz', 'gunzip ~/restored.txt.gz'],
        done: N`:::lesson
«gzip FILE» → FILE.gz (the original is replaced; «-k» keeps it) · «gunzip FILE.gz» or «gzip -d» undoes it · «zcat» reads without unpacking. Logs are often rotated into «.gz» files: «zcat syslog.2.gz | grep error» is an everyday move.
:::`,
      },
      {
        setup: (g) => {
          const u = g.user;
          const entries = [
            { path: 'hollow_key.pub', type: 'file', mode: 0o644, owner: 'mara', group: 'mara', mtime: LA.now() - 3600000, content: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIH0ll0wH0ll0wH0ll0wN0b0dyH3r3AtA11xQz7Wp2Lk hollow@nowhere\n' },
            { path: 'note.b64', type: 'file', mode: 0o644, owner: 'mara', group: 'mara', mtime: LA.now() - 3600000, content: U.b64encode('This key is in Wren\'s authorized_keys on the Lighthouse — and in YOURS.\nWhoever holds it can walk in as either of you. Take it out. Both places.\n— M.\n') + '\n' },
            { path: 'README.txt', type: 'file', mode: 0o644, owner: 'mara', group: 'mara', mtime: LA.now() - 3600000, content: 'From Mara. Found on the Lighthouse logs. The note is base64, because I am paranoid now.\n' },
          ];
          g.fs.put(g.home + '/inbox/evidence.zip', '', { owner: u, group: u, format: 'zip', data: { entries } });
        },
        say: N`When you climb back up, there's a parcel in your inbox — «~/inbox/evidence.zip» — with Mara's handwriting on the label. «.zip» is the archive format the rest of the world uses: «unzip» opens it.`,
        goal: 'Open Mara\'s parcel: «cd ~/inbox» then «unzip evidence.zip»',
        hints: ['Type: «cd ~/inbox» then «unzip evidence.zip»'],
        check: (e) => !!e.node(e.home + '/inbox/hollow_key.pub'),
        solve: ['cd ~/inbox', 'unzip evidence.zip'],
        done: N`«hollow_key.pub» — a public SSH key, signed «hollow@nowhere». «note.b64» — a note written in a jumble of letters and digits. And a README.`,
      },
      {
        say: N`Mara's note is **base64**: a way of writing any data using only letters, digits, «+» and «/». It's not encryption — anyone can decode it with «base64 -d».`,
        goal: 'Decode Mara\'s note: «base64 -d note.b64»',
        hints: ['Type: «base64 -d note.b64»'],
        check: (e) => !!e.ran('base64', (r) => e.has(r, 'd')),
        solve: ['base64 -d note.b64'],
        done: N`*This key is in Wren's authorized_keys on the Lighthouse — and in YOURS. Whoever holds it can walk in as either of you. Take it out. Both places.*

:::lesson
**base64** turns binary into safe text (for email, URLs, configs) and back. It hides nothing from anyone who knows to decode it — never mistake it for security.
:::`,
      },
    ],
    outro: N`So that's how he gets in. A stolen key, accepted on the Lighthouse, and on your own front door.

Time to visit the keeper.`,
  });
})();
