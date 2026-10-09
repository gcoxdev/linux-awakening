/* Chapter 13 — Root (diff, sed, awk, find -user/-delete, userdel, systemctl enable --now, the Spire) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const U = LA.util;
  const CONF = '/etc/lethe/lethe.conf';
  const norm = (t) => (t || '').split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l !== '').join('\n');

  LA.story.add({
    n: 13, id: 'root', title: 'Root', place: 'The Spire',
    unlocks: ['sed', 'awk', 'diff', 'cmp', 'nl', 'userdel', 'usermod'],
    onStart(g) {
      const clean = g.home + '/lethe.conf.clean';
      if (!g.fs.tryGet(clean)) g.fs.put(clean, LA.letheConf(g.user, true), { owner: g.user, group: g.user });
      const log = g.home + '/hollow_activity.log';
      if (!g.fs.tryGet(log)) g.fs.put(log, g.world.http.lighthouse['/files/hollow_activity.log'].body, { owner: g.user, group: g.user });
    },
    intro: N`Night falls over Rootfall. Mara, Juno, Hal, Ingrid, Osei, Mags — one by one, they find their way to your house and crowd into the kitchen, because nobody wants to be alone at three o'clock tonight.

Tux sits on the keyboard tray like a small, stern general.

@Mara: You've stopped him coming in. You've stopped Lethe running. Now finish it. Fix what he broke, clear out what he left behind — and then go up to the Spire. Whatever's waiting for the Operator up there, it's waited long enough.`,
    steps: [
      {
        say: N`Start by seeing exactly what Hollow changed. «diff» compares two files line by line and shows only the differences.`,
        goal: 'Compare the live config with the clean copy: «diff /etc/lethe/lethe.conf ~/lethe.conf.clean»',
        hints: ['Type: «diff /etc/lethe/lethe.conf ~/lethe.conf.clean»'],
        check: (e) => !!e.tried('diff', (r) => e.targets(r).includes(CONF)),
        solve: ['diff /etc/lethe/lethe.conf ~/lethe.conf.clean'],
        done: N`:::lesson
Reading diff: «8,12c8,12» means *lines 8–12 must be changed*. Lines starting with «<» come from the first file (the tampered one); lines starting with «>» from the second (the clean one).
:::

Five lines. SAFE_MODE, TARGETS, QUARANTINE, WATCH_USER, EXCLUDE. Five small edits that turned a broom into a river.`,
      },
      {
        say: N`Most people find the **unified** format easier to read — it's the format patches and code reviews use. «-» lines are removed, «+» lines are added, and a few unchanged lines around them give context.`,
        goal: 'Show the same differences in unified format: «diff -u /etc/lethe/lethe.conf ~/lethe.conf.clean»',
        hints: ['Type: «diff -u /etc/lethe/lethe.conf ~/lethe.conf.clean»'],
        check: (e) => !!e.tried('diff', (r) => e.has(r, 'u')),
        solve: ['diff -u /etc/lethe/lethe.conf ~/lethe.conf.clean'],
        done: N`«-SAFE_MODE=no» / «+SAFE_MODE=yes». At a glance.`,
      },
      {
        say: N`Time to fix it — without even opening an editor. «sed» is the *stream editor*: it reads text, transforms it, and prints the result. Its most famous command is substitution: «s/old/new/».
First, a dry run. Without «-i», sed only *prints* the changed text; the file is untouched.`,
        goal: 'Preview a fix: «sed \'s/SAFE_MODE=no/SAFE_MODE=yes/\' /etc/lethe/lethe.conf»',
        hints: ["Type: «sed 's/SAFE_MODE=no/SAFE_MODE=yes/' /etc/lethe/lethe.conf»"],
        check: (e) => !!e.ran('sed', (r) => !r.args.some((a) => /^-i/.test(a)) && r.args.some((a) => /s\/SAFE_MODE/.test(a))),
        solve: ["sed 's/SAFE_MODE=no/SAFE_MODE=yes/' /etc/lethe/lethe.conf"],
        done: N`The output shows «SAFE_MODE=yes» — but «cat» the file and you'd still see «no». Preview first; commit second. Good habit.

:::lesson
«s/PATTERN/REPLACEMENT/» changes the first match on each line · add «g» («s/a/b/g») to change every match · PATTERN is a regular expression: «^» start of line, «$» end, «.» any character, «.*» anything.
:::`,
      },
      {
        say: N`Now for real. «-i» edits the file *in place*. The file belongs to root, so: sudo.`,
        goal: 'Turn safe mode back on: «sudo sed -i \'s/SAFE_MODE=no/SAFE_MODE=yes/\' /etc/lethe/lethe.conf»',
        hints: ["Type: «sudo sed -i 's/SAFE_MODE=no/SAFE_MODE=yes/' /etc/lethe/lethe.conf»"],
        check: (e) => /^SAFE_MODE=yes$/m.test(e.read(CONF) || ''),
        solve: ["sudo sed -i 's/SAFE_MODE=no/SAFE_MODE=yes/' /etc/lethe/lethe.conf", '$PW'],
        done: N`One down. Four to go.`,
      },
      {
        say: N`Fix the other four lines — TARGETS, QUARANTINE, WATCH_USER and EXCLUDE — so the live config matches the clean one exactly. Any way you like:

  • More sed. Several «-e» expressions can go in one command, and when the text contains «/» you can use another delimiter, like «|»:
    «sudo sed -i -e 's|^TARGETS=.*|TARGETS=/tmp/*|' -e 's|^QUARANTINE=.*|QUARANTINE=/var/lethe/quarantine|' -e 's/^WATCH_USER=.*/WATCH_USER=hollow/' -e 's/^EXCLUDE=.*/EXCLUDE=/' /etc/lethe/lethe.conf»
  • Or edit it by hand: «sudo nano /etc/lethe/lethe.conf»
  • Or simply copy the clean file over it: «sudo cp ~/lethe.conf.clean /etc/lethe/lethe.conf»`,
        goal: 'Make /etc/lethe/lethe.conf identical to the clean copy',
        hints: ['Use «diff» to see what is still different.', "The quickest: «sudo cp ~/lethe.conf.clean /etc/lethe/lethe.conf»", "The sed way: «sudo sed -i -e 's|^TARGETS=.*|TARGETS=/tmp/*|' -e 's|^QUARANTINE=.*|QUARANTINE=/var/lethe/quarantine|' -e 's/^WATCH_USER=.*/WATCH_USER=hollow/' -e 's/^EXCLUDE=.*/EXCLUDE=/' /etc/lethe/lethe.conf»"],
        check: (e) => norm(e.read(CONF)) === norm(e.read(e.home + '/lethe.conf.clean')),
        solve: ["sudo sed -i -e 's|^TARGETS=.*|TARGETS=/tmp/*|' -e 's|^QUARANTINE=.*|QUARANTINE=/var/lethe/quarantine|' -e 's/^WATCH_USER=.*/WATCH_USER=hollow/' -e 's/^EXCLUDE=.*/EXCLUDE=/' /etc/lethe/lethe.conf", '$PW'],
        done: N`The broom is a broom again.`,
      },
      {
        say: N`Prove it. When two files are identical, «diff» prints nothing at all and exits with status 0 — so «&&» will run whatever comes next.`,
        goal: 'Confirm the files match: «diff /etc/lethe/lethe.conf ~/lethe.conf.clean && echo identical»',
        hints: ['Type: «diff /etc/lethe/lethe.conf ~/lethe.conf.clean && echo identical»'],
        check: (e) => !!e.ran('diff', (r) => e.targets(r).includes(CONF)),
        solve: ['diff /etc/lethe/lethe.conf ~/lethe.conf.clean && echo identical'],
        done: N`«identical»

:::lesson
Silence is golden: most Unix tools print **nothing** when everything is fine, and use the exit status to say so. «$?» is the language of scripts.
:::`,
      },
      {
        say: N`Now Hollow himself. Remember how he made his account: «useradd -o -u 0». **UID 0 is root** — whatever the name says. Any account with UID 0 has root's full power.
«awk» is a little language for columns of text. «-F:» splits each line on colons; «$3» is the third field, the UID:
«awk -F: '$3 == 0 {print $1}' /etc/passwd»`,
        goal: 'Find every account with root powers: «awk -F: \'$3 == 0 {print $1}\' /etc/passwd»',
        hints: ["Type: «awk -F: '$3 == 0 {print $1}' /etc/passwd»", 'The single quotes matter: they stop the shell from touching the $ signs.'],
        check: (e) => !!e.ran('awk', (r) => /hollow/.test(r.out)),
        solve: ["awk -F: '$3 == 0 {print $1}' /etc/passwd"],
        done: N`«root»
«hollow»

Two roots. There should only ever be one.

:::lesson
awk reads «pattern {action}». For every line where the pattern is true, the action runs. «$1», «$2»... are fields, «$0» the whole line, «NF» the number of fields, «NR» the line number. «awk '{print $1}'» is the most-typed awk program in history.
:::`,
      },
      {
        say: N`awk can do arithmetic too. Hollow's activity log from the Lighthouse has one line per sweep; the fifth field is how many files were erased. Add them up — a «BEGIN» block runs before the input, an «END» block after it:
«awk '{sum += $5} END {print sum}' ~/hollow_activity.log»`,
        goal: 'Total the damage: «awk \'{sum += $5} END {print sum}\' ~/hollow_activity.log»',
        hints: ["Type: «awk '{sum += $5} END {print sum}' ~/hollow_activity.log»"],
        check: (e) => !!e.ran('awk', (r) => /END/.test(r.args.join(' ')) && /\d{3,}/.test(r.out)),
        solve: ["awk '{sum += $5} END {print sum}' ~/hollow_activity.log"],
        done: (g) => `«${g.world.hollowTotal}»

${g.world.hollowTotal.toLocaleString('en')} things. Recipes, drawings, archive pages, memories. Each one somebody's.

Hal writes the number down in his notebook, very carefully, and underlines it twice.`,
      },
      {
        say: N`What did Hollow leave behind in the city? «find» can search by owner. Root can look everywhere — and «2>/dev/null» keeps the output clean.`,
        goal: 'Find everything Hollow owns: «sudo find / -user hollow 2>/dev/null»',
        hints: ['Type: «sudo find / -user hollow 2>/dev/null»'],
        check: (e) => !!e.tried('find', (r) => r.args.includes('-user') && r.args.includes('hollow')),
        solve: ['sudo find / -user hollow 2>/dev/null', '$PW'],
        done: N`«/tmp/.hollow», «/tmp/.hollow/beacon», «/tmp/.hollow/notes.txt», «/usr/local/bin/kw0rker», «/var/.hollow», «/var/.hollow/plan.txt»...

His nest. His tools. His plan. (Read «/var/.hollow/plan.txt» with sudo if you can stomach it.)`,
      },
      {
        say: N`Clear them out. find can act on what it finds: «-delete» removes each match, or «-exec rm {} \;» runs a command on each one. Add «-type f» so you only remove files.`,
        goal: 'Delete every file Hollow owns: «sudo find / -user hollow -type f -delete 2>/dev/null»',
        hints: ['Type: «sudo find / -user hollow -type f -delete 2>/dev/null»', "The -exec way: «sudo find / -user hollow -type f -exec rm {} \\; 2>/dev/null»"],
        check: (e) => {
          for (const [p, n] of e.fs.iterate('/', 'root', { skip: (x) => x === '/proc' })) if (n.type === 'file' && n.owner === 'hollow' && !p.startsWith('/proc')) return false;
          return true;
        },
        solve: ['sudo find / -user hollow -type f -delete 2>/dev/null', '$PW'],
        done: N`:::lesson
«find ... -delete» and «find ... -exec rm {} \;» are powerful and final. Always run the same find *without* the action first, read the list, and only then add «-delete».
:::`,
      },
      {
        say: N`Now the account itself. «userdel» removes a user; «-r» removes their home directory too. It will refuse if the user still has processes running — but you've already seen to that.`,
        goal: 'Delete the hollow account: «sudo userdel -r hollow»',
        hints: ['Type: «sudo userdel -r hollow»'],
        check: (e) => !e.world.rootfall.users.exists('hollow'),
        solve: ['sudo userdel -r hollow', '$PW'],
        done: N`«grep hollow /etc/passwd» would find nothing now. The second root is gone.`,
      },
      {
        say: N`One stolen key remains — the one Mara warned about, on your *own* front door. sed can delete lines, too: «/pattern/d» deletes every line matching the pattern.`,
        goal: 'Remove hollow\'s key from your own authorized_keys: «sed -i \'/hollow/d\' ~/.ssh/authorized_keys»',
        hints: ["Type: «sed -i '/hollow/d' ~/.ssh/authorized_keys»"],
        check: (e) => { const t = e.read(e.home + '/.ssh/authorized_keys'); return t !== null && !t.includes('hollow'); },
        solve: ["sed -i '/hollow/d' ~/.ssh/authorized_keys"],
        done: N`Your door, your keys. Nobody else's.`,
      },
      {
        say: N`Lethe is sleeping, and the city still needs a broom — a *safe* one, sweeping only /tmp. Bring it back, with the clean config: enable it at boot and start it now, both at once.`,
        goal: 'Restart Lethe safely: «sudo systemctl enable --now lethe»',
        hints: ['Type: «sudo systemctl enable --now lethe» (or «enable» then «start»)', 'Check with «systemctl status lethe» — it should say SAFE_MODE=yes in the log lines.'],
        check: (e) => e.world.services.lethe.active && e.world.services.lethe.enabled,
        solve: ['sudo systemctl enable --now lethe', '$PW'],
        done: N`«lethe: SAFE_MODE=yes TARGETS=/tmp/* QUARANTINE=/var/lethe/quarantine»

At 03:00 tonight, Lethe will sweep the Night Market as it was always meant to, and leave everything else alone.`,
      },
      {
        say: N`Everyone in the kitchen goes quiet.

There is one place in Rootfall you have never been able to open: «/root», the Spire — the home of root itself. You've been using root's power all along, one «sudo» at a time. It's time to look inside.

«sudo ls -la /root», and then read what's waiting there.`,
        goal: 'Enter the Spire: list /root with sudo, then read the memory waiting there',
        hints: ['Type: «sudo ls -la /root»', 'Then: «sudo cat /root/memory_09.txt»'],
        check: (e) => e.didRead('/root/memory_09.txt'),
        solve: ['sudo ls -la /root', '$PW', 'sudo cat /root/memory_09.txt', '$PW'],
        done: N`You read it twice.

Then you look up, and the kitchen is full of people who stayed up until it was fixed.`,
      },
    ],
    outro: N`Nine memories. All of them yours again.`,
  });

  LA.story.epilogue = (g) => {
    const st = g.state;
    const mins = Math.max(1, Math.round((LA.now() - st.stats.started) / 60000));
    const secretsTotal = Object.keys(LA.SECRETS).length;
    return N`:::art
                                      .
                         .            |            .
                          '.    \     |     /    .'
                            '.   \    |    /   .'
                    -  -  -  -  ( S U N R I S E )  -  -  -  -
           ____        _______      ___|___       _______        ____
      ____|    |______|       |____|  ROOT |_____|       |______|    |____
     |  []  []  |  [] [] |  []  |    FALL  |  []  | [] [] |  []  []  |  []|
:::

03:00 comes, and goes.

At 03:00:01 the Night Market's lanterns flicker once — the broom passing through, sweeping up wrappers and lost receipts and nothing more. In the Library, the archive wing stays empty, but Mags is already writing new catalogue cards. Hal is setting type for a morning edition with a very large number in the headline. Ingrid has hung a sign over Stall 9: *KEYS NOT SOLD HERE. EVER.*

At dawn, the city wakes up, and for the first time in a long time, it remembers the night before.

@Mara: So. Operator. What now?

You look at the terminal. The cursor blinks, patient as a lighthouse.

@You: Now? I read the logs. I always read the logs.

Tux climbs into your lap, sighs the long sigh of a penguin whose person has finally come home, and goes to sleep.

:::certificate
CERTIFICATE OF OPERATION

This certifies that
${g.user}
has awakened, and is hereby restored to the office of
CITY OPERATOR OF ROOTFALL

Commands typed: ${st.stats.commands}   ·   Hints taken: ${st.stats.hints}
Memories recovered: ${st.memories.length}/9   ·   Secrets found: ${st.secrets.length}/${secretsTotal}
Time in Rootfall: ${mins} minutes

"Root isn't a password. It's a promise."
:::

**THE END** — and the beginning.

Every command is now unlocked. The city is yours to explore: there are ${secretsTotal - st.secrets.length > 0 ? (secretsTotal - st.secrets.length) + ' secrets still hidden, and ' : ''}nothing left to fear in «/tmp». Type «progress» to see what you found, «notebook» for everything you've learned — and remember: «man» is always there.`;
  };
})();
