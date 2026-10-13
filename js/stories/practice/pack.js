/* Practice Range — the story pack for free practice: no plot, just a lot of real tasks. */
(function () {
  'use strict';
  const LA = globalThis.LA;

  LA.defineStory('practice', {
    title: 'Practice Range',
    tagline: 'No story — just real tasks, checked and scored.',
    blurb: 'Fix permissions, dig through logs, script loops, restore backups. Earn XP and master every command.',
    pace: 'Endless',
    accent: '#a78bfa',
    cardArt: String.raw`  [■■■□□]  XP 1240   streak ×7
  $ find /var/log -size +1M
  $ sort -t, -k3 -n staff.csv
  $ tar -czf site.tgz www   ✓`,
    isPractice: true,
    saveKey: 'linux-awakening-save-practice',
    hostname: 'range',
    startCwd: (u) => '/home/' + u,
    startClock: [0, 9, 0],
    companion: 'Hint',
    speakers: {},
    reserved: ['root', 'alice', 'bob', 'deploy', 'daemon', 'bin', 'sys', 'man', 'mail', 'nobody', 'syslog', 'sshd', 'sudo', 'adm', 'users', 'devs', 'ops', 'www-data'],
    boot: {
      lines: [
        ['PRACTICE RANGE — scratch machine', 'fg-k2'],
        ['Users ............................... you, alice, bob, deploy', ''],
        ['Network ............................. web.lab, backup.lab', ''],
        ['Task library ........................ ', ''],
      ],
      ok: 'READY',
      banner: ['PRACTICE'],
      tagline: 'endless tasks · real commands',
    },
    nameIntro: `:::lesson
Pick a username for the practice machine — lowercase letters and digits, starting with a letter. Your sudo password here is always «practice».
:::`,
    namePrompt: 'username:',
    nameWait: 'Type a username, then press Enter.',
    nameTaken: (n) => `"${n}" already exists on this machine. Choose another.`,
    nameRules: 'Lowercase letters and digits only, starting with a letter, 2–16 characters.',
    savedLabel: 'Saved practice progress',
    scope: 'The range is built on {distroFull}: Bash, GNU tools, systemd and {pm}. Pick another distro on the main menu to practice its tools.',
    secrets: {},
    collect: { label: 'Badges', noun: 'badge', tag: '🏅', banner: 'BADGE', items: {} },
    flavor: {
      done: 'Type «task» to see your current task.',
      moreSecrets: 'to earn',
      epilogueTitle: 'Practice Range', epiloguePlace: '',
      rmGuard: 'The range refuses.',
      rmGuardWhy: 'the range would be unusable',
      killSelf: 'That\'s your own shell. Killing it would log you out of the range.',
      topExit: 'There\'s nowhere to log out to — the range is the whole machine.',
    },
    hintSpeaker: () => 'Hint',
    welcome: (g) => `:::lesson
**Welcome to the range.** Each task asks for a result on this machine — do it any way you like, unless the task names a method. It's checked after every command, and once it's solved the machine stays put so you can look around; then «next».
«hint» gives clues (free — the last one offers the full answer, which costs the XP) · «check» says what's done and what's missing · «skip» for another task · «retry» / «variant» to do it again · «task list» to pick one · «topic» and «level» to choose · «progress» for your stats.
Your sudo password is «practice».
:::`,
  });
})();
