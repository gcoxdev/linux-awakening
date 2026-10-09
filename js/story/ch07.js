/* Chapter 7 — Home (history, env, variables, export, alias, .bashrc, source, type, ln, who) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const BAD = `alias cat='echo "nothing to remember."'`;

  LA.story.add({
    n: 7, id: 'home', title: 'Home', place: '~',
    unlocks: ['history', 'alias', 'unalias', 'env', 'printenv', 'export', 'unset', 'source', 'ln', 'who', 'w', 'hostname', 'last'],
    intro: N`The house settles around you. The radiator ticks. Tux snores, very quietly, in a tone you suspect he would deny.

Mara pulls a chair up beside yours.

@Mara: Your shell — this thing you're typing into — isn't just a doorway to commands. It's a whole little workshop: it remembers what you've done, carries your settings around, lets you build shortcuts. You set yours up years ago. Let's see what's left of it.`,
    steps: [
      {
        say: N`@Mara: Start with *your* history — everything you've typed since you woke up: «history».`,
        goal: 'See your own command history: «history»',
        hints: ['Type: «history»'],
        check: (e) => !!e.ran('history'),
        solve: ['history'],
        done: N`Everything since «pwd», in a numbered list.

:::lesson
Press **↑** and **↓** to scroll through previous commands. «!!» re-runs the last command — «sudo !!» re-runs it as root. «!42» runs command number 42. «history | grep ssh» finds an old command.
:::`,
      },
      {
        say: N`@Mara: Now the *old* you. Bash saves your history in a hidden file in your home when you log out: «~/.bash_history».`,
        goal: 'Read the old you\'s history: «cat ~/.bash_history»',
        hints: ['Type: «cat ~/.bash_history» (or «less» it)'],
        check: (e) => e.didRead(e.home + '/.bash_history'),
        solve: ['cat ~/.bash_history'],
        done: N`You read your own last night like a stranger's.

  «sudo nano lethe.conf» — you checked the config.
  «grep hollow /var/log/auth.log» — you went hunting.
  «ssh wren@lighthouse» — you went to see the keeper.
  «sudo mount /dev/sdb1 /mnt/backup» — the Undercroft.
  «tar -czvf /mnt/backup/memories.tar.gz memories/» — **you backed up your memories.**
  «cd /dev» — the Docks.
  «echo "going to the docks. if i don't come back: start with pwd."»

@Mara: You *knew*. You knew it might take you, and you went anyway — and you left yourself a trail of breadcrumbs.`,
      },
      {
        say: N`@Mara: Your shell carries a backpack of settings called **environment variables**: your name, your home, where to look for commands... «env» shows them all.`,
        goal: 'List your environment: «env»',
        hints: ['Type: «env» (or «printenv»)'],
        check: (e) => !!e.ran(['env', 'printenv']),
        solve: ['env'],
        done: N`«HOME=/home/{user}», «USER={user}», «PATH=/usr/local/bin:/usr/bin:/bin:...», «SHELL=/bin/bash»...`,
      },
      {
        say: N`@Mara: You can read any variable by putting a dollar sign in front of its name. Try «echo $HOME», then the important one: «echo $PATH».`,
        goal: 'Read variables: «echo $HOME» and «echo $PATH»',
        hints: ['Type: «echo $PATH»'],
        check: (e) => !!e.ran('echo') && /\$\{?PATH\}?/.test(e.line),
        solve: ['echo $HOME', 'echo $PATH'],
        done: N`:::lesson
**$PATH** is a colon-separated list of directories. When you type «grep», the shell searches each of them in order for a file named «grep» — that's what «which» was showing you. Commands not on the PATH need a path, like «./script.sh».
:::`,
      },
      {
        say: N`@Mara: Set one of your own. Plenty of programs ask which text editor you like by reading «$EDITOR». A plain «NAME=value» only lives inside this shell; «export» hands it down to every program you start.`,
        goal: 'Choose your editor for every program: «export EDITOR=nano»',
        hints: ['No spaces around the = sign!', 'Type: «export EDITOR=nano»'],
        check: (e) => { const v = e.game.shell.vars.get('EDITOR'); return !!v && v.v === 'nano' && v.x; },
        solve: ['export EDITOR=nano'],
        done: N`:::lesson
«NAME=value» — **no spaces** around «=» (with spaces, the shell would think NAME is a command).
«export NAME» — pass it to child processes. «unset NAME» — forget it. «echo $NAME» — read it.
:::`,
      },
      {
        say: N`@Mara: You used to type «ls -la» about four hundred times a day. Give it a shortcut. An **alias** makes a new word that expands into a longer command:
«alias ll='ls -la'» — and then just type «ll».`,
        goal: 'Create the alias with «alias ll=\'ls -la\'», then use it: «ll»',
        hints: ["First: «alias ll='ls -la'»", 'Then type just: «ll»'],
        check: (e) => !!e.game.shell.aliases.ll && /^\s*ll\b/.test(e.line) && !!e.ran('ls'),
        solve: ["alias ll='ls -la'", 'll'],
        done: N`Much better.`,
      },
      {
        setup: (g) => {
          const p = g.home + '/.bashrc';
          const n = g.fs.tryGet(p);
          if (!n) g.fs.put(p, `# ~/.bashrc\nalias ls='ls --color=auto'\n\n# --- added 02:58 ---\n${BAD}\n`, { owner: g.user, group: g.user });
          else if (!g.fs.contentOf(n).includes('nothing to remember')) n.content += `\n# --- added 02:58 ---\n${BAD}\n`;
        },
        say: N`@Mara: But aliases vanish when the shell closes. To keep one forever, add it to «~/.bashrc» — the script bash runs every time it starts — then load the file into this shell with «source».
«echo "alias ll='ls -la'" >> ~/.bashrc»
«source ~/.bashrc»`,
        goal: 'Make ll permanent: append it to ~/.bashrc, then «source ~/.bashrc»',
        hints: ['Use «>>» to append, not «>» (which would wipe the file!).', `Type: «echo "alias ll='ls -la'" >> ~/.bashrc»`, 'Then: «source ~/.bashrc»'],
        check: (e) => /alias ll=/.test(e.read(e.home + '/.bashrc') || '') && !!e.stepEvent('source', (ev) => ev.path === e.home + '/.bashrc'),
        solve: [`echo "alias ll='ls -la'" >> ~/.bashrc`, 'source ~/.bashrc'],
        done: N`Done. Your old prompt colours flicker back on, exactly as you once set them.

Then Tux wakes with a start, scrambles out of his bed, and starts pecking urgently at the keyboard. He wants you to read something. Anything.`,
      },
      {
        say: N`@Mara: Read your sticky note again. Humour the penguin.`,
        goal: 'Read a file — any file — with «cat», for instance «cat sticky_note.txt»',
        hints: ['Type: «cat sticky_note.txt»', 'If cat behaves normally, your shell hasn\'t loaded the poisoned file — run «source ~/.bashrc» and try again.'],
        check: (e) => /^\s*cat\b/.test(e.line) && !!e.ran('echo', (r) => r.args.join(' ').includes('nothing to remember')),
        solve: ['cat sticky_note.txt'],
        done: N`«nothing to remember.»

That is not what your sticky note says.

@Mara: ...That's not right. «cat» doesn't *say* things. Something has got into «cat».`,
      },
      {
        say: N`@Mara: When a command misbehaves, ask the shell what it really is. «type cat».`,
        goal: 'Find out what cat really is: «type cat»',
        hints: ['Type: «type cat»'],
        check: (e) => !!e.ran('type', (r) => r.args.includes('cat')),
        solve: ['type cat'],
        done: N`«cat is aliased to 'echo "nothing to remember."'»

@Mara: He planted an alias in your .bashrc! Every shell you start, «cat» lies to you. It's a little thing. That's what makes it so nasty.`,
      },
      {
        say: N`@Mara: Remove the alias from this shell: «unalias cat».`,
        goal: 'Remove the poisoned alias: «unalias cat»',
        hints: ['Type: «unalias cat»'],
        check: (e) => !e.game.shell.aliases.cat,
        solve: ['unalias cat'],
        done: N`«cat» is «cat» again. For now. The poison is still sitting in «.bashrc», waiting for the next shell.`,
      },
      {
        say: N`@Mara: Now cut it out at the root. Open «~/.bashrc» in nano and delete the line that starts «alias cat=» (and its "added 02:58" comment, if you like).
@Mara: In nano, **Ctrl+K** cuts the whole line the cursor is on. Then Ctrl+O, Enter, Ctrl+X.`,
        goal: 'Delete the poisoned alias line from ~/.bashrc and save',
        hints: ['Type «nano ~/.bashrc». Arrow down to the «alias cat=» line.', 'Press Ctrl+K to cut that line, then Ctrl+O, Enter to save, Ctrl+X to exit.', "Alternatively, without an editor: «grep -v 'nothing to remember' ~/.bashrc > /tmp/clean && mv /tmp/clean ~/.bashrc»"],
        check: (e) => { const t = e.read(e.home + '/.bashrc'); return t !== null && !t.includes('nothing to remember'); },
        solve: [{ edit: (c) => c.split('\n').filter((l) => !l.includes('nothing to remember') && !l.includes('added 02:58')).join('\n') }, 'nano ~/.bashrc'],
        done: N`Gone.

:::lesson
Startup files like «~/.bashrc» and «~/.profile» run automatically, every time — which makes them a favourite hiding place for mischief. Read yours now and then. Trust, but verify.
:::`,
      },
      {
        say: N`@Mara: Make yourself a shortcut to the Chronicle while we're tidying up, so you never have to type «/var/log» again. A **symbolic link** is a signpost that points somewhere else:
«ln -s /var/log ~/chronicle»`,
        goal: 'Make a signpost to the logs: «ln -s /var/log ~/chronicle»',
        hints: ['«ln -s TARGET LINKNAME». Type: «ln -s /var/log ~/chronicle»'],
        check: (e) => { const n = e.node(e.home + '/chronicle'); return !!n && n.type === 'link' && LA.VFS.normalize(n.target, e.home) === '/var/log'; },
        solve: ['ln -s /var/log ~/chronicle'],
        done: N`«ls -l» shows it as «chronicle -> /var/log», and «cd ~/chronicle» walks straight into the newsroom.

:::lesson
Delete a symlink with «rm» like any file — the thing it points to is untouched.
:::`,
      },
      {
        say: N`@Mara: ...Something's been bothering me since I got here. My terminal felt *crowded* this morning. Who else is logged into this machine right now? «who».`,
        goal: 'See who is logged in: «who»',
        hints: ['Type: «who»'],
        check: (e) => !!e.ran(['who', 'w']),
        solve: ['who'],
        done: N`«{user}   pts/1»
«mara     pts/0   (10.0.0.12)»
«hollow   pts/3   (10.0.0.66)»

Hollow is here. *Right now.* Logged in, two terminals away.

Mara goes very pale.

@Mara: He's in the machine. We need to see what he's *running*. The Power Station — «/proc». Juno will know what to do.`,
      },
    ],
    outro: N`You grab your coat. Tux is already at the door.`,
  });
})();
