/* Chapter 10 — The Undercroft (sha256sum, tar, gzip/gunzip/zcat, zip/unzip, base64) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const U = LA.util;

  LA.story.add({
    n: 10, id: 'undercroft', title: 'The Undercroft', place: '/mnt/backup', clock: [1, 20, 0],
    unlocks: ['tar', 'gzip', 'gunzip', 'zcat', 'unzip', 'sha256sum', 'base64', 'umount'],
    onStart(g) {
      if (!g.world.mounts.some((m) => m.dev === '/dev/sdb1')) { LA.stories.rootfall.plugBackup(g); g.world.mount('/dev/sdb1', '/mnt/backup', true); }
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
        setup: (g) => {
          if (!g.fs.tryGet('/var/tmp/evidence.txt')) g.fs.put('/var/tmp/evidence.txt', 'user=hollow door=/home/' + g.user + ' action=chmod:000\n', { owner: g.user, group: g.user });
        },
        say: N`At the top of the stairs Mara stops you.

@Mara: Everything down there is compressed. Learn how it works on something small first, where nothing matters if you get it wrong. Take Hal's evidence file:
«gzip /var/tmp/evidence.txt»  — squeezes it, replacing it with «evidence.txt.gz»
«zcat /var/tmp/evidence.txt.gz | head -3» — reads it without unpacking
«gunzip /var/tmp/evidence.txt.gz» — back to normal`,
        goal: 'Practice on a small file: «gzip» it, read it with «zcat», then «gunzip» it',
        hints: ['Three commands, in order: «gzip /var/tmp/evidence.txt», «zcat /var/tmp/evidence.txt.gz | head -3», «gunzip /var/tmp/evidence.txt.gz»'],
        check: (e) => e.stepRan('gzip') && e.stepRan('zcat') && e.stepRan('gunzip') && !!e.node('/var/tmp/evidence.txt'),
        nudge: (e) => (e.stepRan('gunzip') && !e.stepRan('zcat') ? 'Back to compressed and peek inside first: «gzip» it again, then «zcat» it, then «gunzip».' : null),
        solve: ['gzip /var/tmp/evidence.txt', 'zcat /var/tmp/evidence.txt.gz | head -3', 'gunzip /var/tmp/evidence.txt.gz'],
        done: N`:::lesson
«gzip FILE» → FILE.gz (the original is replaced; «-k» keeps it) · «gunzip FILE.gz» or «gzip -d» undoes it · «zcat» reads without unpacking. Logs are often rotated into «.gz» files: «zcat syslog.2.gz | grep error» is an everyday move.
:::`,
      },
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
        check: (e) => !!e.ran('sha256sum', (r) => e.has(r, 'c') && /memories\.tar\.gz: OK/.test(r.out)),
        solve: ['sha256sum -c SHA256SUMS'],
        done: N`«memories.tar.gz: OK»
«tux.png: OK»

Both files match the fingerprints you recorded that night. Nothing has changed them since — or, to be exact, nobody changed them *without also rewriting the list*, and the list sits on a disk that was unplugged from the city the whole time.

:::lesson
A matching checksum proves the file is identical to the one that was fingerprinted. It can't prove who made it: keep the list somewhere an attacker can't reach, or get it from a trusted source. Download something important? Compare its checksum with the one the publisher lists. «sha256sum file» prints a fingerprint; «sha256sum -c LIST» verifies a list of them. («md5sum» is the older, weaker version.)
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
        say: N`Don't unpack anything *here*: the Undercroft is your pristine copy, and the moment you start changing files on it, it stops being a reliable backup. Extract into your home instead: **x** = extract, **v** = verbose (show each file), and «-C ~» = change to your home directory first.`,
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
        say: N`One thing in memory 08 won't leave you alone. You *stopped* Lethe at 02:22. Something started it again before three — and you know from the Clockworks what it was. Find the moment it happened, in the city's own log: search «/var/log/syslog» for «02:58».`,
        goal: 'Find what restarted Lethe that night: search syslog for 02:58',
        hints: ['grep searches a file for text: «grep 02:58 /var/log/syslog»'],
        check: (e) => !!e.ran('grep', (r) => /\(hollow\) CMD/.test(r.out)),
        solve: ['grep 02:58 /var/log/syslog'],
        done: N`«CRON[...]: (hollow) CMD (sudo -n /usr/bin/systemctl start lethe)» — the same line, every night, with the rule he'd planted in «/etc/sudoers.d» doing the rest. On *that* night, two minutes after it ran, you were standing at the edge of the Void.

You didn't fail because you were careless. You failed because you checked the places you knew, and he was somewhere you didn't think to look. You know to look there now.`,
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
        say: N`You're done with the Undercroft. **Unmount** it before Juno takes the disk back to her drawer — «umount» (no *n*: an old Unix spelling). It refuses while any shell is standing inside it, so make sure you're not.`,
        goal: 'Close the Undercroft: «sudo umount /mnt/backup»',
        hints: ['Type: «sudo umount /mnt/backup»', 'If it says "target is busy", «cd ~» first.'],
        check: (e) => !e.world.mounts.some((m) => m.dev === '/dev/sdb1'),
        solve: ['cd ~', 'sudo umount /mnt/backup', '$PW'],
        done: N`Juno unplugs it, bags it, and puts it in her coat. Off the city again, where nothing can touch it.`,
      },
      {
        setup: (g) => {
          const u = g.user;
          const entries = [
            { path: 'hollow_key.pub', type: 'file', mode: 0o644, owner: 'mara', group: 'mara', mtime: LA.now() - 3600000, content: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIH0ll0wH0ll0wH0ll0wN0b0dyH3r3AtA11xQz7Wp2Lk hollow@nowhere\n' },
            { path: 'note.b64', type: 'file', mode: 0o644, owner: 'mara', group: 'mara', mtime: LA.now() - 3600000, content: U.b64encode('This key is in Wren\'s authorized_keys on the Lighthouse — and in YOURS.\nWhoever holds it can walk in as either of you. Take it out. Both places.\n— M.\n') + '\n' },
            { path: 'README.txt', type: 'file', mode: 0o644, owner: 'mara', group: 'mara', mtime: LA.now() - 3600000, content: 'From Mara. Pulled off the Lighthouse. The note is base64 because the Lighthouse mail relay only carries plain ASCII and mangles everything else. (It hides nothing. I know.)\n' },
          ];
          g.fs.put(g.home + '/inbox/evidence.zip', '', { owner: u, group: u, format: 'zip', data: { entries } });
        },
        say: N`When you climb back up, there's a parcel in your inbox — «~/inbox/evidence.zip» — with Mara's handwriting on the label. «.zip» is the archive format the rest of the world uses: «unzip» opens it.`,
        goal: 'Open Mara\'s parcel: «cd ~/inbox» then «unzip evidence.zip»',
        hints: ['Type: «cd ~/inbox» then «unzip evidence.zip»'],
        check: (e) => !!e.node(e.home + '/inbox/hollow_key.pub'),
        solve: ['cd ~/inbox', 'unzip evidence.zip'],
        done: N`«hollow_key.pub» — a public SSH key, labeled «hollow@nowhere» (a label anyone could type). «note.b64» — a note written in a jumble of letters and digits. And a README.`,
      },
      {
        say: N`Mara's note is **base64**: a way of writing any data using only letters, digits, «+» and «/». It's not encryption — anyone can decode it with «base64 -d».`,
        goal: 'Decode Mara\'s note: «base64 -d note.b64»',
        hints: ['Type: «base64 -d note.b64»'],
        check: (e) => !!e.ran('base64', (r) => e.has(r, 'd') && /authorized_keys/.test(r.out)),
        solve: ['base64 -d note.b64'],
        done: N`*This key is in Wren's authorized_keys on the Lighthouse — and in YOURS. Whoever holds it can walk in as either of you. Take it out. Both places.*

:::lesson
**base64** turns any data into plain, safe text (for email, URLs, configs) and back. It hides nothing from anyone who knows to decode it — never mistake it for security.
:::

:::lesson
How the key trick works: **authorized_keys** lists *public* keys. Anyone holding the matching *private* key may log in as that account, no password asked. A public key is harmless to share — but adding one to someone's authorized_keys hands its owner a permanent door. That's what Hollow did while he was logged in as you.
:::`,
      },
      {
        say: N`Start with your own door. Keep every line *except* Hollow's: «grep -v» prints the lines that **don't** match. Write the result to a temporary file, and only if that worked, move it into place:
«grep -v hollow ~/.ssh/authorized_keys > ~/keys.tmp && mv ~/keys.tmp ~/.ssh/authorized_keys»`,
        goal: 'Remove hollow\'s key from your own authorized_keys (grep -v into a temp file, then mv)',
        hints: ['Never redirect a file into itself — «> same-file» empties it before grep reads it. Go via a temporary file.', 'Type: «grep -v hollow ~/.ssh/authorized_keys > ~/keys.tmp && mv ~/keys.tmp ~/.ssh/authorized_keys»', 'If your own key line went missing too, it\'s in «~/.ssh/id_ed25519.pub»: «cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys»'],
        check: (e) => { const t = e.read(e.home + '/.ssh/authorized_keys') || ''; return !t.includes('hollow') && t.includes(e.game.user + '@rootfall'); },
        solve: ['grep -v hollow ~/.ssh/authorized_keys > ~/keys.tmp && mv ~/keys.tmp ~/.ssh/authorized_keys'],
        done: N`«cat ~/.ssh/authorized_keys» shows one line now: your own key. And since you changed your password with Mara, the rumor Ingrid sold is worthless too. Your door is yours.`,
      },
    ],
    outro: N`So that's how he got in: a stolen copy of Wren's key to reach the Lighthouse, a password everyone could guess to reach you — and then his own key, planted in both places so he'd never need either again.

One door closed. Wren's is still open.`,
  });
})();
