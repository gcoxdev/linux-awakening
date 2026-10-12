/* Night Train, Chapter 6 — Locked Doors (ls -l, id, groups, sudo, stat, chmod, chown, chgrp, umask, su, passwd) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const pack = LA.stories.nighttrain;

  pack.add({
    n: 6, id: 'locks', title: 'Locked Doors', place: 'km 121 · Hallin Junction', clock: [1, 1, 36],
    unlocks: ['id', 'groups', 'sudo', 'stat', 'chmod', 'chown', 'chgrp', 'umask', 'su', 'passwd'],
    intro: N`The Meridian slides into Hallin Junction and stops. A single platform lamp, a stationmaster in a greatcoat, a goods train asleep on the next track.

Abel stands at the vestibule with his arms folded. The doors stay shut. Three minutes later the train pulls out again with every passenger still aboard.

@June: It's him, isn't it. Marsh. The card nobody saw him use.
Probably. But *probably* doesn't stop a man stepping off at the border. What's still missing: where Vesna is, how he did it, where the Atlas has gone — and proof that will survive a police inspector at five in the morning.

If anyone on this train knew what Vesna was thinking tonight, it's Vesna. Her home directory is «/home/vesna».`,
    steps: [
      {
        say: N`«ls -l» — the *long* listing — shows who owns each file and who may do what with it.`,
        goal: 'Look at the home directories in detail: «ls -l /home»',
        hints: ['Type «ls -l /home».'],
        check: (e) => !!e.ran('ls', (r) => e.has(r, 'l') && e.targets(r).includes('/home')),
        solve: ['ls -l /home'],
        done: N`:::art
 d rwx --- ---   vesna  vesna   vesna
 |  |   |   |      |      |
 |  |   |   |      |      '-- group
 |  |   |   |      '--------- owner
 |  |   |   '---------------- everyone else: nothing
 |  |   '-------------------- the group: nothing
 |  '------------------------ the owner: read, write, enter
 '--------------------------- d = directory
:::
**r** read · **w** write · **x** execute (for a directory: *enter* it). Vesna's home: hers, and nobody else's.`,
      },
      {
        say: N`Try anyway.`,
        goal: 'Try to read her notes: «cat /home/vesna/notes.txt»',
        hints: ['Type «cat /home/vesna/notes.txt». It will fail — that is the point.'],
        check: (e) => !!e.tried('cat', (r) => r.status !== 0 && e.targets(r).includes('/home/vesna/notes.txt')),
        solve: ['cat /home/vesna/notes.txt'],
        done: N`«Permission denied». Exactly as it should be.`,
      },
      {
        say: N`What are *you* allowed to do? «id» shows your user and group numbers; «groups» lists just the group names.`,
        goal: 'Run «id», then «groups»',
        hints: ['«id» then «groups».'],
        check: (e) => e.stepRan('id') && e.stepRan('groups'),
        solve: ['id', 'groups'],
        done: N`«{user} adm {admin} users crew». The important one is «{admin}»: members may run a command *as root*, the account that may do anything, by putting «sudo» in front of it. It asks for *your* password, not root's. (Debian and Ubuntu call this group «sudo»; Fedora, Arch and openSUSE call it «wheel».)`,
      },
      {
        say: N`Vesna would want you to look. Your password is in her README.`,
        goal: 'Read her notes as root: «sudo cat /home/vesna/notes.txt»',
        hints: ['Type «sudo cat /home/vesna/notes.txt».', 'The password is in ~/README_FIRST.txt. Nothing appears while you type it — that\'s normal.'],
        check: (e) => e.didRead('/home/vesna/notes.txt'),
        solve: ['sudo cat /home/vesna/notes.txt', '$PW'],
        done: N`*"Marsh asked me three things before we left Calder: which car the Kessel mail sacks ride in. Whether the cameras record sound. Whether the train keeps any logs off this server. — I said no. That isn't true — the loco recorder does. Habit. Never tell strangers about backups."*

@June: There's a *backup*?
There's a backup. In the locomotive, at the far end of the train from here. Every fifteen minutes since Calder.`,
      },
      {
        say: N`«ls -l» shows one time per file. «stat» shows everything the filesystem knows about it, including exactly when its contents last changed.`,
        goal: 'Examine the edited log: «stat /var/log/meridian/doors.log.1»',
        hints: ['Type «stat /var/log/meridian/doors.log.1».'],
        check: (e) => !!e.ran('stat', (r) => e.targets(r).includes('/var/log/meridian/doors.log.1')),
        solve: ['stat /var/log/meridian/doors.log.1'],
        done: N`«Modify: ... 00:01:12». Rotated at midnight. Changed seventy-two seconds later — while Vesna's laptop was logged in, and Vesna was nowhere to be found.`,
      },
      {
        say: N`Your case folder is readable by everyone on this machine, and someone on this machine edits evidence. Change its **mode**. In numbers, each digit is one of owner, group, others: read is 4, write 2, execute 1, added up. So «750» is *owner: everything; group: read and enter; others: nothing*.`,
        goal: 'Lock down your case folder: «chmod 750 ~/case»',
        hints: ['Type «chmod 750 ~/case».', 'You can also write it with letters: «chmod o-rwx ~/case».'],
        check: (e) => { const n = e.node(e.home + '/case'); return !!n && (n.mode & 0o777) === 0o750; },
        solve: ['chmod 750 ~/case'],
        done: N`«drwxr-x---». You, and your group. Nobody else.`,
      },
      {
        say: N`Keep a copy of her notes in the file. But «sudo cp» runs «cp» as root, so the copy will belong to root, not you. «chown» changes a file's owner — and only root may give files away, so it needs sudo too. «{user}:» means *user {user}, and that user's own group*.`,
        goal: 'Copy her notes, then make the copy yours: «sudo cp /home/vesna/notes.txt ~/case/evidence/vesna_notes.txt» and «sudo chown {user}: ~/case/evidence/vesna_notes.txt»',
        hints: ['First «sudo cp /home/vesna/notes.txt ~/case/evidence/vesna_notes.txt»', 'Then «sudo chown {user}: ~/case/evidence/vesna_notes.txt»'],
        check: (e) => { const n = e.node(e.home + '/case/evidence/vesna_notes.txt'); return !!n && n.owner === e.game.user; },
        solve: ['sudo cp /home/vesna/notes.txt ~/case/evidence/vesna_notes.txt', '$PW', 'sudo chown {user}: ~/case/evidence/vesna_notes.txt', '$PW'],
        done: N`«-rw------- {user} {user} vesna_notes.txt». Yours now.`,
      },
      {
        say: N`Abel needs to be able to read the case. He's in the «crew» group, so give the files to that group. «chgrp» changes a file's group; «-R» does a whole directory, recursively.`,
        goal: 'Hand the case to the crew group: «chgrp -R crew ~/case»',
        hints: ['Type «chgrp -R crew ~/case».'],
        check: (e) => { for (const [, n] of e.fs.iterate(e.home + '/case', 'root', {})) if (n.group !== 'crew') return false; return true; },
        nudge: (e) => (e.ran('chgrp') && e.node(e.home + '/case').group === 'crew' ? '@June: The folder\'s crew now, but the files inside it aren\'t. «-R» does everything inside too.' : null),
        solve: ['chgrp -R crew ~/case'],
        done: N`Abel can go into «~/case» and read what's there — except Vesna's notes, which you left private. Groups are how teams share without sharing with everyone.`,
      },
      {
        say: N`New files get their permissions from your **umask** — the bits that are *taken away* from every file you create. Check yours, then tighten it so that from now on «others» get nothing at all.`,
        goal: 'Show your umask with «umask», then set it: «umask 027»',
        hints: ['«umask» on its own shows the current value («0022»).', 'Then «umask 027».'],
        check: (e) => e.shell.umask === 0o027,
        solve: ['umask', 'umask 027'],
        done: N`:::lesson
umask «022» → new files «644», folders «755» (others may read). umask «027» → files «640», folders «750» (others get nothing). It lasts for this shell; put it in «~/.bashrc» to keep it.
:::`,
      },
      {
        say: N`@Abel: I need the incident in my own log, in my account, timed. My hands aren't steady enough to type. Log in as me. The password is «platform-nine».
«su - abel» switches to Abel's account (the «-» gives you his full login: his home, his settings). Then add a line to *his* «~/incident.txt» — while you're him, «~» means «/home/abel» — and «exit» back to yourself.`,
        goal: 'As abel: «su - abel», then «echo "00:12 Atlas missing. Case opened 01:40." >> ~/incident.txt», then «exit»',
        hints: ['«su - abel» — his password is platform-nine.', 'Then: «echo "00:12 Atlas missing. Case opened 01:40." >> ~/incident.txt»', 'Then «exit» to become yourself again.'],
        check: (e) => e.user === e.game.user && /Atlas missing/.test(e.read('/home/abel/incident.txt') || '') && !!e.stepEvent('shellExit'),
        nudge: (e) => (e.user === 'abel' && /Atlas/.test(e.read('/home/abel/incident.txt') || '') ? 'Done as Abel. Now «exit» to get back to your own account.' : null),
        solve: ['su - abel', { answer: 'platform-nine' }, 'echo "00:12 Atlas missing. Case opened 01:40." >> ~/incident.txt', 'exit'],
        done: N`@Abel: Thank you. (He looks at the prompt, back to «{user}@meridian».) You should never have known my password, and in a minute I'm going to change it.`,
      },
      {
        say: N`And you should change yours. It's printed in a README, and somebody tonight has already used a stolen password once. «passwd» asks for the current one, then the new one twice.`,
        goal: 'Change your password: «passwd»',
        hints: ['Type «passwd». First your current password (from the README), then your new one, twice.', 'Nothing appears as you type passwords. That\'s normal.'],
        check: (e) => !!e.stepEvent('passwd', (ev) => ev.user === e.game.user),
        solve: ['passwd', '$PW', { answer: 'night-train-74' }, { answer: 'night-train-74' }],
        done: N`«passwd: password updated successfully». Vesna's rule zero, the one she never wrote down because she assumed nobody needed telling.`,
      },
    ],
    outro: N`@June: So now we know: there's a backup in the locomotive, and Marsh asked about it, and Vesna told him there wasn't one.
@June: She lied to him. On *purpose*. Even before anything happened, she didn't like him.`,
  });
})();
