/* Night Train, Chapter 9 — The Mail Van (systemctl, journalctl, pgrep/pkill, sudo tee, crontab, watch) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const pack = LA.stories.nighttrain;
  const DOOR = '/srv/meridian/cars/car8_mail/door';
  const rootCron = (e) => LA.cronSpool(e.world) + '/root';

  pack.add({
    n: 9, id: 'mailvan', title: 'The Mail Van', place: 'km 160 · descending', clock: [1, 2, 33],
    unlocks: ['systemctl', 'journalctl', 'pkill', 'crontab', 'watch', 'free', 'uname', 'apt'],
    intro: N`Over the top. The train tips forward into the long descent toward Stellmark and the brakes begin their steady, grinding hum.

Vesna's note said it plainly: *get doord back up.* Programs that run all the time in the background — door controllers, camera recorders, web servers — are called **services** (or *daemons*), and on this machine «systemd» looks after them.`,
    steps: [
      {
        say: N`«systemctl status NAME» shows whether a service is running, whether it starts at boot, and its last few log lines.`,
        goal: 'Check the door controller: «systemctl status doord»',
        hints: ['Type «systemctl status doord».'],
        check: (e) => !!e.tried('systemctl', (r) => r.args.includes('status') && r.args.includes('doord')),
        solve: ['systemctl status doord'],
        done: N`«Loaded: ... disabled» — it won't start at boot. «Active: inactive (dead)» — it isn't running now. Every door on the train is frozen in whatever state it was in at 00:06.`,
      },
      {
        say: N`systemd keeps a **journal** of everything its services say. «journalctl -u NAME» shows one service's part of it.`,
        goal: 'Read the door controller\'s journal: «journalctl -u doord»',
        hints: ['Type «journalctl -u doord».'],
        check: (e) => !!e.ran('journalctl', (r) => r.args.includes('doord')),
        solve: ['journalctl -u doord'],
        done: N`«23:53:34 doord: car8_mail: door closed, seal mode: LOCKED»
«00:06:31 sudo: vesna : TTY=pts/2 ; ... COMMAND=/usr/bin/systemctl stop doord»
«00:06:40 ... COMMAND=/usr/bin/systemctl disable doord»

Stopped with her own account, from her own laptop, while she was locked in the van it controls.`,
      },
      {
        say: N`Bring it back. «enable» makes a service start at boot; «--now» starts it immediately as well.`,
        goal: 'Start the door controller and keep it on: «sudo systemctl enable --now doord»',
        hints: ['Type «sudo systemctl enable --now doord».'],
        check: (e) => e.world.services.doord.enabled && !!e.ran('systemctl', (r) => r.args.includes('enable')),
        solve: ['sudo systemctl enable --now doord', '$PW'],
        done: N`«Created symlink /etc/systemd/system/multi-user.target.wants/doord.service → ...».

Abel hauls on the van door. It doesn't budge.
@June: Is it running? Check it's running.`,
      },
      {
        say: N`Ask the journal again — just the last few lines, «-n 5».`,
        goal: 'What happened to doord? «journalctl -u doord -n 5»',
        hints: ['Type «journalctl -u doord -n 5».'],
        check: (e) => !!e.ran('journalctl', (r) => r.args.includes('doord') && /hold\.sh/.test(r.out)),
        solve: ['journalctl -u doord -n 5'],
        done: N`«Started doord.service»... and in the same second:
«hold.sh[2071]: doord is active — stopping it»
«Stopped doord.service».

Something is watching the door controller and killing it the moment it comes up. The history said: «sudo nohup /tmp/.t/hold.sh &».`,
      },
      {
        say: N`Find it and read it. «pgrep -a» matches against process *names*; add «-f» to match against the whole command line.`,
        goal: 'Find the watcher with «pgrep -af hold», then read it: «cat /tmp/.t/hold.sh»',
        hints: ['«pgrep -af hold»', 'then «cat /tmp/.t/hold.sh»'],
        check: (e) => e.stepRan('pgrep') && e.didRead('/tmp/.t/hold.sh'),
        solve: ['pgrep -af hold', 'cat /tmp/.t/hold.sh'],
        done: N`:::art
while true; do
    systemctl is-active --quiet doord && systemctl stop doord
    sleep 20
done
:::
A loop that never ends: every twenty seconds, if doord is running, stop it. Started with «nohup» so it would outlive the session that launched it, and with «sudo» so it runs as root.`,
      },
      {
        say: N`«pkill» is «pgrep» that sends a signal instead of printing: «pkill -f hold.sh» stops every process whose command line contains «hold.sh».`,
        goal: 'Stop the watcher: «sudo pkill -f hold.sh»',
        hints: ['Type «sudo pkill -f hold.sh».'],
        check: (e) => !e.world.procs.some((p) => p.comm === 'hold.sh'),
        solve: ['sudo pkill -f hold.sh', '$PW'],
        done: N`Gone. «pgrep -af hold» would find nothing now.`,
      },
      {
        say: N`Now start doord again — and this time it should stay up.`,
        goal: 'Start it: «sudo systemctl start doord», and check it with «systemctl status doord»',
        hints: ['«sudo systemctl start doord»', 'then «systemctl status doord» should say active (running).'],
        check: (e) => e.world.services.doord.active && e.stepRan('systemctl'),
        solve: ['sudo systemctl start doord', '$PW', 'systemctl status doord'],
        done: N`«Active: active (running)». And in its log: *car8_mail: sealed — waiting for a remote release in /srv/meridian/cars/car8_mail/door*.`,
      },
      {
        say: N`The release is a file: write «OPEN» into «/srv/meridian/cars/car8_mail/door». It belongs to root. Try the obvious thing first — and then the thing that works.
Here's the trap: in «sudo echo OPEN > door», sudo runs «echo» as root, but the «>» is handled by *your* shell, as *you*, before sudo even starts. The fix is «tee», which opens the file itself — so «sudo tee» opens it as root.`,
        goal: 'Release the mail van: «echo OPEN | sudo tee /srv/meridian/cars/car8_mail/door»',
        hints: ['«echo OPEN > /srv/meridian/cars/car8_mail/door» will say Permission denied. So will «sudo echo OPEN > ...».', 'Type «echo OPEN | sudo tee /srv/meridian/cars/car8_mail/door».'],
        check: (e) => /^OPEN/.test((e.read(DOOR) || '').trim()) && e.world.services.doord.active,
        nudge: (e) => {
          if (/^OPEN/.test((e.read(DOOR) || '').trim()) && !e.world.services.doord.active) return '@June: The file says OPEN but nothing is listening — doord isn\'t running!';
          if (/>\s*\S*car8_mail\/door/.test(e.line) && e.status !== 0) return /sudo/.test(e.line) ? '@June: Still denied! The > happens before sudo. Use «| sudo tee».' : '@June: Permission denied. It belongs to root.';
          return null;
        },
        solve: ['echo OPEN | sudo tee /srv/meridian/cars/car8_mail/door', '$PW'],
        done: N`«OPEN»

A heavy *clunk* from the end of the car, and a hiss of cold air. Abel has the door open before the hiss has finished.

She's sitting on a pile of mail sacks with three parcel blankets round her shoulders and a woolly hat that clearly came out of somebody's Christmas parcel. Her lips are blue. Her eyes are absolutely furious.

@Vesna: (through chattering teeth) You must be the trainee.
@Vesna: Coffee. Then a coat. Then I want to see everything you've found, in order, with times. And then we are going to *bury* him.

June bursts into tears and then pretends she didn't.`,
        after: (g) => {
          const w = g.world;
          w.flags.vesnaFree = true;
          w.removeSession((s) => s.user === 'kiosk');
          w.procs = w.procs.filter((p) => p.user !== 'kiosk' && p.pid !== 2140);
          const k = w.wtmp.find((x) => x.user === 'kiosk' && !x.out);
          if (k) k.out = `- ${LA.util.strftime('%H:%M', new Date(LA.now()))}  (02:13)`;
        },
      },
      {
        say: N`@Vesna: (wrapped in Abel's uniform coat, both hands round a mug) He'll have left a timer. People who write checklists always do. Look at root's crontab.
**cron** runs commands on a schedule. Each user has a **crontab** — a table of times and commands. «crontab -l» lists one; root's needs sudo.`,
        goal: 'List root\'s scheduled jobs: «sudo crontab -l»',
        hints: ['Type «sudo crontab -l».'],
        check: (e) => !!e.ran('crontab', (r) => e.has(r, 'l') && /rm -rf/.test(r.out)),
        solve: ['sudo crontab -l', '$PW'],
        done: N`«*/15 * * * * /opt/meridian/bin/recorder-sync» — Vesna's: every fifteen minutes, copy the logs to the locomotive.
«55 2 * * * rm -rf /var/lib/cctv/car2 /var/log/meridian/doors.log.2.gz» — at 02:55, delete the baggage-car camera and the oldest door log.

@Vesna: And something's *missing*. There should be an hourly «logrotate» line. He took it out — so «doors.log.1» stays exactly as he left it, and nothing rewrites «SHA256SUMS». Leave it out until the police have their copies.

:::art
 55   2    *    *    *     command
 |    |    |    |    |
 |    |    |    |    '---- day of week  (* = any)
 |    |    |    '--------- month        (* = any)
 |    |    '-------------- day of month (* = any)
 |    '------------------- hour         (2)
 '------------------------ minute       (55)
:::
@Vesna: What time is it?
It's coming up to quarter to three.`,
      },
      {
        say: N`«crontab -e» opens the crontab in your «$EDITOR» — nano, since you set it. Delete the «55 2» line (in nano, **Ctrl+K** cuts the line the cursor is on), save with Ctrl+O and Enter, and leave with Ctrl+X.`,
        goal: 'Remove the 02:55 job: «sudo crontab -e», delete its line, save',
        hints: ['Type «sudo crontab -e».', 'Move to the line starting «55 2», press Ctrl+K, then Ctrl+O, Enter, Ctrl+X.'],
        check: (e) => { const t = e.read(rootCron(e)) || ''; return !/rm -rf/.test(t) && /recorder-sync/.test(t); },
        nudge: (e) => (!/recorder-sync/.test(e.read(rootCron(e)) || '') ? '@Vesna: You deleted my recorder sync as well. Put it back — «*/15 * * * * /opt/meridian/bin/recorder-sync» — I want my backups.' : null),
        solve: [{ edit: (c) => c.split('\n').filter((l) => !/rm -rf/.test(l)).join('\n') }, 'sudo crontab -e', '$PW'],
        done: N`«crontab: installing new crontab». The recorder sync stays. The timer is gone.

@Vesna: Never «crontab -r» in a hurry, by the way. It deletes the *whole* table, without asking, and «r» is right next to «e».`,
      },
      {
        say: N`@Vesna: Humour me. Watch the clock go past 02:55 and make sure nothing happens to those camera stills.
«watch» re-runs a command every few seconds and shows the result full-screen. Quote the command if it has a pipe in it. **Ctrl+C** stops watching.`,
        goal: 'Watch the stills count: «watch -n 5 \'ls /var/lib/cctv/car2 | wc -l\'», then Ctrl+C',
        hints: ["Type «watch -n 5 'ls /var/lib/cctv/car2 | wc -l'».", 'When you\'ve seen enough, press Ctrl+C.'],
        check: (e) => !!e.tried('watch', (r) => r.args.some((a) => /cctv/.test(a))),
        solve: [{ nowait: "watch -n 5 'ls /var/lib/cctv/car2 | wc -l'" }, { ctrlc: true }],
        done: N`The number doesn't change. 02:55 comes and goes and nothing happens, which is the most satisfying nothing you've ever seen.`,
      },
      {
        say: N`@Vesna: (her colour coming back) Right. Abel wants a line on the state of this machine for his report. «free -h» shows memory in human units; «uname -a» names the kernel and system.`,
        goal: 'Run «free -h», then «uname -a»',
        hints: ['«free -h»', 'then «uname -a»'],
        check: (e) => e.stepRan('free') && e.stepRan('uname'),
        solve: ['free -h', 'uname -a'],
        done: N`«Linux meridian 6.1.0-meridian ... x86_64». Memory fine, load back down since the flares went out. The machine is all right. So, it turns out, is everyone on it.`,
      },
      {
        say: N`@Vesna: And install «htop». I can't watch anyone use plain «top». It's for masochists.
Software comes in **packages**, and this machine's package manager is «{pm}»: {pkg:refreshWhy} Both need root. Then run it — «q» quits.`,
        goal: 'Install and run htop: «{pkg:refresh}», «{pkg:install htop}», then «htop»',
        hints: ['«{pkg:refresh}»', '«{pkg:install htop}» (if it asks whether to go ahead, answer «y»)', 'then «htop» — q quits.'],
        check: (e) => e.world.packages.installed.includes('htop') && !!e.stepEvent('top'),
        solve: ['{pkg:refresh}', '$PW', '{pkg:install htop}', '$PW', { answer: 'y' }, 'htop'],
        done: N`Colour bars for each CPU, both nearly idle. June wants to know what every number means; Vesna, to everyone's surprise, tells her.

:::lesson
{pkg:lesson} Tonight's packages come from a cache on the train itself — there's no outside signal until the Merrow Tunnel.
:::`,
      },
    ],
    outro: N`@Vesna: Right. He thinks I'm still in that van. He thinks the door log says what he made it say. He thinks there's no copy.
@Vesna: There's always a copy. Stellmark in five minutes — Rosa can walk the recorder back from the locomotive while we're stopped.`,
  });
})();
