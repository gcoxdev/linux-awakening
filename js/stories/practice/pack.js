/* Practice Range — the story pack for free practice: no plot, just a lot of real tasks. */
(function () {
  'use strict';
  const LA = globalThis.LA;

  LA.defineStory('practice', {
    title: 'Practice Range',
    tagline: 'No story — just task after task on a real-feeling machine. Earn XP, keep your streak, master every command.',
    blurb: 'Each task asks you to do something useful: find the biggest log, fix a permission, write a one-liner, schedule a job, unpack an archive, script a loop. Do it however you like — any correct way counts. The machine resets for every task. Pick a topic or let it mix things up, and climb from Intern to Greybeard.',
    pace: 'Endless · scored',
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
    scope: 'The range is built on {distroFull}: Bash, GNU tools, systemd and {pm}. Pick another distro on the main menu to practise its tools.',
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
**Welcome to the range.** Every task is checked after each command you type, and any correct approach counts. The machine is rebuilt for every new task, so experiment freely.
«hint» gives a hint (the last one is an answer) · «skip» for a different task · «solution» to see an answer · «topic» to choose a topic · «level» for difficulty · «progress» for your stats.
Your sudo password is «practice».
:::`,
  });
})();
