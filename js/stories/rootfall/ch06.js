/* Chapter 6 — Locks & Keys (permissions, chmod, chown, chgrp, sudo, id, stat, passwd) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;

  LA.story.add({
    n: 6, id: 'keys', title: 'Locks & Keys', place: 'The Residential Quarter (/home)', clock: [1, 12, 30],
    unlocks: ['chmod', 'chown', 'chgrp', 'sudo', 'id', 'stat', 'passwd'],
    intro: N`The Residential Quarter is a street of tall narrow houses, each with a name painted over the door.

One of them is yours. Tux knows which one before you do: he waddles straight to it and stands on the step, waiting, as if he's done it a thousand times.`,
    steps: [
      {
        goal: 'Go to /home and inspect every door: «cd /home» then «ls -l»',
        hints: ['Two commands: «cd /home» then «ls -l»'],
        check: (e) => e.cwd === '/home' && !!e.ran('ls', (r) => e.has(r, 'l')),
        solve: ['cd /home', 'ls -l'],
        done: N`:::art
   d rwx r-x r-x
   | '+' '+' '+'
   |  |   |   '--- others: everyone else
   |  |   '------- group: members of the file's group
   |  '----------- user: the owner
   '-------------- type: d = directory, - = file, l = link

   r = read (4)     w = write (2)     x = execute / enter (1)
:::

Mara's door: «drwxr-x---». The guest house: «drwxr-xr-x».
Yours: «d---------». No reading, no writing, no entering. For anyone.`,
      },
      {
        say: N`Who *are* you, as far as the city's locks are concerned? «id» shows your user id and every group you belong to.`,
        goal: 'Check your identity: «id»',
        hints: ['Type: «id»'],
        check: (e) => !!e.ran('id'),
        solve: ['id'],
        done: N`uid 1000, and a list of groups — including one called **sudo**. Remember that.

:::lesson
Permissions are checked in order: if you are the **owner**, the user bits apply; otherwise if you're in the file's **group**, the group bits apply; otherwise the **others** bits apply.
:::`,
      },
      {
        say: N`Look closer at your door. «stat» shows everything the filesystem knows about a file or directory.`,
        goal: 'Examine your door: «stat {user}»',
        hints: ['You are in /home, so the name is enough: «stat {user}»'],
        check: (e) => !!e.ran('stat', (r) => e.targets(r).includes(e.home)),
        solve: ['stat {user}'],
        done: N`«Access: (0000/d---------)  Uid: ( 1000/ {user})»

**You still own it.** Hollow had root's power when he changed the lock — he could have taken the house too, but he left the ownership alone. Maybe he thought a door nobody can open was enough. And the **owner** of a file can always change its permissions.`,
      },
      {
        say: N`«chmod» changes permissions. In its *symbolic* form you say **who** («u» user, «g» group, «o» others, «a» all), then **+** or **-**, then **what** («r», «w», «x»).
Give yourself — the owner — everything back: «chmod u+rwx {user}»`,
        goal: 'Unlock your door for yourself: «chmod u+rwx {user}»',
        hints: ['u = user (the owner), + = add, rwx = read, write, enter.', 'Type: «chmod u+rwx {user}»'],
        check: (e) => { const n = e.node(e.home); return !!n && (n.mode & 0o700) === 0o700; },
        solve: ['chmod u+rwx {user}'],
        done: N`Somewhere inside the door, a lock turns over.`,
      },
      {
        say: N`Now. Go home. The tilde «~» always means *your* home directory.`,
        goal: 'Go home: «cd ~»',
        hints: ['Type: «cd ~» (or just «cd»)'],
        check: (e) => e.cwd === e.home,
        solve: ['cd ~'],
        done: N`:::art
                      )
                   ( _   _._
                    |_|-'_~_'-._
                 _.-'-_~_-~_-~-_'-._
             _.-'_~-_~-_-~-_~_~-_~-_'-._
            ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
              |  [] []   |   [] []   |
              |          |    ___    |
              |  [] []   |   |   |   |
            __|__________|___|___|___|__
:::

Dust. A mug with a dried coffee ring. A penguin bed by the radiator — Tux climbs straight into it and closes his eyes.

You're home.

:::lesson
«~» is your home directory, «~mara» would be Mara's, and «cd» with no argument always brings you home.
:::`,
      },
      {
        say: N`Look around properly. Hidden files too.`,
        goal: 'See everything in your home, in detail: «ls -la»',
        hints: ['Type: «ls -la»'],
        check: (e) => e.cwd === e.home && !!e.ran('ls', (r) => e.has(r, 'l') && (e.has(r, 'a') || e.has(r, 'A'))),
        solve: ['ls -la', 'cat memory_04.txt'],
        done: N`«.bashrc», «.bash_history», «.ssh», a sticky note, a scripts folder...

and «diary.txt»: «---------- root root». Hollow didn't just lock your door. He gave your diary to **root** and locked it shut.

A knock at the open door. A woman with a pencil behind her ear and a thermos under her arm.

@Mara: {user}?! Oh — oh, it *is* you. Do you remember me? ...No. That's alright. I'm Mara. Next door. We work nights together, at the Kernel Works.
@Mara: Did you get my letters? The backwards one took me an hour.`,
      },
      {
        say: N`@Mara: First things first. Your door's wide shut — that's no way to live. Set it the usual way: you can do everything; anyone else may list it and step inside, but can't change anything in it. Use the *numeric* form this time: «chmod 755 ~».

:::art
   7 = 4+2+1 = rwx   (you: everything)
   5 = 4+0+1 = r-x   (group: look and enter)
   5 = 4+0+1 = r-x   (others: look and enter)
:::`,
        goal: 'Set your home to rwxr-xr-x: «chmod 755 ~»',
        hints: ['Each digit is one set: user, group, others. 7 = rwx, 5 = r-x.', 'Type: «chmod 755 ~»'],
        check: (e) => { const n = e.node(e.home); return !!n && (n.mode & 0o777) === 0o755; },
        solve: ['chmod 755 ~'],
        done: N`:::lesson
Common modes: «755» for directories and programs, «644» for ordinary files (rw-r--r--), «600» for private files (rw-------), «700» for private directories.
:::`,
      },
      {
        say: N`@Mara: Your diary belongs to root now, so only root can open it. But you're in the **{admin}** group — you can borrow root's power for a single command by putting «sudo» in front of it. It'll ask for *your* password.
@Mara: Your password? You always said you'd leave yourself a hint somewhere obvious. Very you.`,
        goal: 'Read your diary as root: «sudo cat diary.txt» (find your password hint first)',
        hints: ['There\'s a sticky note in your home: «cat sticky_note.txt»', 'Who never leaves your side? (He\'s asleep on the radiator.) And the city\'s founding year was in the library\'s history.', 'The password is «tux1991» — the penguin plus the year. Typing it shows nothing on screen; that\'s normal.', (g) => `If you've changed it since: Tux remembers it was «${g.world.passwords.rootfall[g.user]}».`],
        check: (e) => e.didRead(e.home + '/diary.txt'),
        nudge: (e) => (e.tried('cat', (r) => !r.sudo && e.targets(r).some((t) => t.endsWith('/diary.txt'))) ? '@Mara: Permission denied, see? You need «sudo» in front.' : null),
        solve: ['cat sticky_note.txt', 'sudo cat diary.txt', '$PW'],
        done: N`You read it twice. Your own handwriting, getting shakier entry by entry.

*He has my password. Of course he does: tux1991. Anyone who knows me could guess it.*

*If I disappear: my .bash_history knows exactly what I did tonight.*

@Mara: The Undercroft... I knew about the backups. I didn't know you'd gone down to the Docks alone.

:::lesson
When you type a password into sudo, **nothing appears** — not even dots. That's deliberate: nobody looking over your shoulder learns its length. sudo then remembers you for a few minutes.
:::`,
      },
      {
        say: N`@Mara: That diary is yours. Take it back. «chown» changes a file's **owner** (and, after a colon, its **group**). Giving files away is a root-only power, so: sudo again.`,
        goal: 'Make the diary yours again: «sudo chown {user}:{user} diary.txt»',
        hints: ['OWNER:GROUP — both are {user}.', 'Type: «sudo chown {user}:{user} diary.txt»'],
        check: (e) => { const n = e.node(e.home + '/diary.txt'); return !!n && n.owner === e.game.user; },
        solve: ['sudo chown {user}:{user} diary.txt', '$PW'],
        done: N`Yours.`,
      },
      {
        say: N`@Mara: It's still locked with «000», though. Diaries should be private: you may read and write (6), nobody else may do anything (0, 0).`,
        goal: 'Make the diary private: «chmod 600 diary.txt»',
        hints: ['6 = rw-, 0 = ---. Type: «chmod 600 diary.txt»'],
        check: (e) => { const n = e.node(e.home + '/diary.txt'); return !!n && (n.mode & 0o777) === 0o600; },
        solve: ['chmod 600 diary.txt'],
        done: N`«-rw-------». Yours, and yours alone. No sudo needed — you're the owner now.

:::lesson
**umask** decides the permissions *new* files start with. Type «umask»: «0022» means "remove write for group and others", so new files are born «644» and new directories «755».
:::`,
      },
      {
        say: N`@Mara: Will you share your notes with me again, like before? Right now your «notes» folder is «drwx------»: only you. We're both in the **operators** group, so give the folder to that group, then let the group read and enter it — and nobody else:
«chgrp operators notes»
«chmod g+rx notes»`,
        goal: 'Share your notes with the operators group (chgrp, then chmod g+rx)',
        hints: ['First: «chgrp operators notes»', 'Then: «chmod g+rx notes»'],
        check: (e) => { const n = e.node(e.home + '/notes'); return !!n && n.group === 'operators' && (n.mode & 0o050) === 0o050; },
        solve: ['chgrp operators notes', 'chmod g+rx notes'],
        done: N`«drwxr-x--- {user} operators notes»

Mara types something on her own terminal and grins.

@Mara: «ls ~{user}/notes» — I can see them. And Juno, who isn't in operators, still can't. Thank you. I missed being nosy.`,
      },
      {
        say: N`@Mara: One more thing, and I mean it this time. Hollow knows your password. Change it. Now. «passwd» asks for the current one, then the new one twice.
@Mara: And please — not your penguin's name.`,
        goal: 'Change your password: «passwd»',
        hints: ['Type «passwd». Enter your current password, then a new one twice. Nothing shows as you type.', (g) => `Your current password is «${g.world.passwords.rootfall[g.user]}».`],
        check: (e) => !!e.stepEvent('passwd'),
        solve: ['passwd', '$PW', { answer: 'quiet-river-1991' }, { answer: 'quiet-river-1991' }],
        done: N`«passwd: password updated successfully»

@Mara: Don't forget it. sudo will want the new one from now on.

:::lesson
«sudo» asks for **your** password and runs one command as root. «su» switches to another user entirely, but wants **their** password — and nobody knows root's anymore. That's why every Operator lives by sudo.
:::`,
      },
    ],
    outro: N`Mara pours two cups from her thermos and sits on the arm of your sofa like she's done it a hundred times.

@Mara: Your diary said your «.bash_history» knows what you did that night. You always said history is the truest diary.
@Mara: Let's read it.`,
  });
})();
