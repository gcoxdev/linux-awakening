/* Chapter 8 — The Power Station (ps, top, kill, signals, pgrep/pkill/killall, jobs, system health) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;

  LA.story.add({
    n: 8, id: 'power', title: 'The Power Station', place: '/proc', clock: [1, 16, 30],
    unlocks: ['ps', 'top', 'kill', 'killall', 'pkill', 'pgrep', 'jobs', 'fg', 'sleep', 'uptime', 'free', 'uname', 'df', 'du'],
    intro: N`The Power Station hums so deeply you feel it in your teeth.

:::art
          ____________________________________
         |  ~~  P O W E R   S T A T I O N  ~~ |
         |   /proc            est. 1991       |
         |____________________________________|
          |  [1]   [180]  [312]  [340]  [451] |
          |   *      *      *      *      *   |
          |  live  live   live   live   HOT   |
          |___________________________________|
:::

A woman in overalls and safety goggles is shouting at a gauge as if it owes her money.

@Juno: Juno Reyes, chief engineer. Mara called ahead. You want to know what's running in this city? Everything that runs, runs *here*.`,
    steps: [
      {
        goal: 'Enter the station and look around: «cd /proc» then «ls»',
        hints: ['Two commands: «cd /proc» then «ls»'],
        check: (e) => e.cwd === '/proc' && !!e.ran('ls'),
        solve: ['cd /proc', 'ls'],
        done: N`Numbers. Rows and rows of numbered directories, and a few files with names like «cpuinfo» and «meminfo».

@Juno: Every number is a **process** — a running program, a worker in the city. The number is its **PID**, its process ID. This whole directory isn't stored anywhere; the kernel conjures it up, live, every time you look.`,
      },
      {
        say: N`@Juno: First, my rounds. The station's been running hot for three nights, and I check the same four vital signs every time. Do them with me:
«uptime» — how long since the last restart, and how loaded
«free -h» — memory
«df -h» — disk space on each filesystem
«uname -a» — which kernel we're running`,
        goal: 'Check the station\'s vital signs: «uptime», «free -h», «df -h», «uname -a»',
        hints: ['Four separate commands, in any order.', 'You can also chain them on one line with semicolons: «uptime; free -h; df -h; uname -a»'],
        check: (e) => ['uptime', 'free', 'df', 'uname'].every((c) => e.stepRan(c)),
        solve: ['uptime', 'free -h', 'df -h', 'uname -a'],
        done: N`Up nine days. Memory's fine. The root filesystem has plenty of room.

@Juno: All healthy on paper. But something in this city has been *writing* like mad for three nights — I can hear the disks. Let's find out what.`,
      },
      {
        say: N`@Juno: «df» says how full each disk is; «du» says *what* is taking the space. Size up every log: «du -sh /var/log/*».`,
        goal: 'Find what\'s been writing so much: «du -sh /var/log/*»',
        hints: ['«-s» summarize each argument, «-h» human-readable. Type: «du -sh /var/log/*»'],
        check: (e) => !!e.tried('du', (r) => e.has(r, 's') && /lethe\.log/.test(r.out)),
        solve: ['du -sh /var/log/*'],
        done: N`«48M  /var/log/lethe.log»

@Juno: Every other log is a few kilobytes. That one is forty-eight megabytes of a program bragging about what it destroyed — most of it written in the last three nights. Lethe's been busy. Let's see it running.

:::lesson
Disk full? «df -h» to see which filesystem, then «du -sh /path/*» to find the culprit, then «du -sh /path/culprit/*» and so on down.
:::`,
      },
      {
        say: N`@Juno: Reading numbers is for machines. «ps» gives you a snapshot of processes in plain words.`,
        goal: 'Take a snapshot of your processes: «ps»',
        hints: ['Type: «ps»'],
        check: (e) => !!e.ran('ps', (r) => r.args.length === 0),
        solve: ['ps'],
        done: N`Just two: your «bash», and «ps» itself — caught in the act of looking.

@Juno: By default «ps» only shows what's running in *your* terminal. Modest little tool.`,
      },
      {
        say: N`@Juno: Before we go hunting, see how a process *you* start behaves. Normally a command owns your terminal until it finishes. Put «&» at the end and it runs in the **background** instead, leaving you your prompt.
«sleep 3000 &» — fifty minutes of nothing, running quietly behind you.`,
        goal: 'Start a background job: «sleep 3000 &»',
        hints: ['Type: «sleep 3000 &»'],
        check: (e) => e.game.shell.jobs.length > 0,
        solve: ['sleep 3000 &'],
        done: N`«[1] 2xxx» — job number 1, and its PID. Run «ps» now and you'd see «sleep» sitting next to your «bash».`,
      },
      {
        goal: 'List your background jobs: «jobs»',
        hints: ['Type: «jobs»'],
        check: (e) => !!e.ran('jobs'),
        solve: ['jobs'],
        done: N`«[1]+  Running    sleep 3000 &»`,
      },
      {
        say: N`@Juno: Bring it back to the foreground with «fg». It'll take over your terminal — then stop it with **Ctrl+C**, which sends it the INT signal.`,
        goal: 'Foreground the job with «fg», then stop it with Ctrl+C',
        hints: ['Type «fg» — the terminal will seem to hang. That\'s the sleep running. Now press Ctrl+C.'],
        check: (e) => !!e.tried('fg') && e.game.shell.jobs.length === 0,
        solve: [{ nowait: 'fg' }, { ctrlc: true }],
        done: N`«^C». Your prompt returns.

:::lesson
«cmd &» runs in the background · «jobs» lists them · «fg %1» brings job 1 forward · **Ctrl+C** interrupts the foreground job · on real systems **Ctrl+Z** suspends it and «bg» lets it carry on in the background · «kill %1» ends job 1 · «nohup cmd &» keeps it running after you log out.
:::`,
      },
      {
        say: N`@Juno: To see *everything* — every user, every daemon — the incantation is «ps aux». (No dash. It's older than dashes. Don't ask.)`,
        goal: 'See every process in the city: «ps aux»',
        hints: ['Type: «ps aux»'],
        check: (e) => !!e.ran('ps', (r) => r.args.some((a) => /^-?(aux|ef|e|A|ax)$/.test(a))),
        solve: ['ps aux'],
        done: N`USER, PID, %CPU, %MEM, START, COMMAND... root's daemons, Mara's shell — and a user called **hollow** running a «-bash» and something called «/tmp/.hollow/beacon».

@Juno: And look at that one: «[kworker/u4:2-events]». Names in square brackets are kernel threads — they *always* belong to root. That one's owned by hollow. It's an impostor, dressed up to blend in. Keep an eye on it.

:::lesson
«ps aux» columns: **USER** owner · **PID** id · **%CPU**/**%MEM** usage · **STAT** state (S sleeping, R running, T stopped, Z zombie) · **START** when it began · **COMMAND** what it is.
:::`,
      },
      {
        say: N`@Juno: Too much to read. Pipe it through grep and look for the one you care about: «ps aux | grep lethe».`,
        goal: 'Find Lethe: «ps aux | grep lethe»',
        hints: ['Type: «ps aux | grep lethe»'],
        check: (e) => e.pipe && !!e.ran('ps') && !!e.tried('grep', (r) => r.args.includes('lethe')),
        solve: ['ps aux | grep lethe'],
        done: N`«root  451  2.3  2.4 ... /usr/bin/lethe --daemon --conf /etc/lethe/lethe.conf»

@Juno: PID 451. Fahrenheit 451 — the temperature at which books burn. Somebody has a sense of humour.

:::lesson
You'll usually see a second match: the «grep lethe» process itself, which also contains the word "lethe". Everyone gets fooled by that once.
:::`,
      },
      {
        say: N`@Juno: There's a cleaner tool for finding processes. «pgrep» prints matching PIDs; «-a» shows their full command lines, «-u» picks a user.`,
        goal: 'List everything hollow is running: «pgrep -a -u hollow»',
        hints: ['Type: «pgrep -a -u hollow»'],
        check: (e) => !!e.ran('pgrep', (r) => r.args.includes('hollow') && /1338/.test(r.out)),
        solve: ['pgrep -a -u hollow'],
        done: N`«1337 -bash» — his shell.
«1338 /tmp/.hollow/beacon --phone-home 10.0.0.66» — something calling home.
«4040 [kworker/u4:2-events]» — the impostor.`,
      },
      {
        say: N`@Juno: Every process has a folder here in /proc, named after its PID. Read what 1338 was started with — its command line is in a file called «cmdline».`,
        goal: 'Read the beacon\'s command line: «cat /proc/1338/cmdline»',
        hints: ['Type: «cat /proc/1338/cmdline»'],
        check: (e) => e.didRead('/proc/1338/cmdline'),
        solve: ['cat /proc/1338/cmdline'],
        done: N`«/tmp/.hollow/beacon --phone-home 10.0.0.66»

A beacon, reporting everything back to Hollow's machine at 10.0.0.66.`,
      },
      {
        say: N`@Juno: ps is a photograph. For a live view, use «top»: it refreshes every couple of seconds, busiest processes first. Press **q** to quit.`,
        goal: 'Watch the station live with «top», then press q',
        hints: ['Type «top», watch for a moment, then press q.'],
        check: (e) => !!e.event('top'),
        solve: ['top'],
        done: N`Lethe sits near the top of the list, sipping CPU like a cat by a fire.

:::lesson
«top» headers: **load average** (how busy the machine is over 1, 5 and 15 minutes), tasks, CPU and memory. Press **q** to quit. (Its friendlier cousin «htop» isn't installed... yet.)
:::`,
      },
      {
        say: N`@Juno: Now we stop things. «kill» sends a **signal** to a process. The default signal, TERM, politely asks it to finish up and exit.
@Juno: Start with the beacon: «kill 1338».`,
        goal: 'Stop the beacon (PID 1338)',
        hints: ['Try «kill 1338» first. Read the error.', 'You may only signal your own processes. To signal someone else\'s, you need root: «sudo kill 1338»'],
        check: (e) => !e.world.proc(1338),
        nudge: (e) => (e.tried('kill') && e.world.proc(1338) ? '@Juno: "Operation not permitted" — it isn\'t *your* process. Only root may signal other people\'s processes.' : null),
        solve: ['kill 1338', 'sudo kill 1338', '$PW'],
        done: N`The beacon goes quiet. Somewhere at 10.0.0.66, a light stops blinking.`,
      },
      {
        say: N`@Juno: Now his shell. PID 1337. Try the polite way first — «sudo kill 1337» — and see what happens.`,
        goal: 'Get Hollow\'s shell (PID 1337) out of the city — politely first, then not',
        hints: ['Try «sudo kill 1337», then check with «ps aux | grep hollow» or «pgrep -u hollow».', 'Interactive shells ignore the polite TERM signal. Signal 9, KILL, cannot be ignored: «sudo kill -9 1337»'],
        check: (e) => !e.world.proc(1337),
        nudge: (e) => (e.ran('kill', (r) => r.sudo && r.args.includes('1337')) && e.world.proc(1337) ? "@Juno: Still there? Shells *ignore* TERM. Time for the signal nobody can ignore: «-9»." : null),
        solve: ['sudo kill 1337', '$PW', 'sudo kill -9 1337', '$PW'],
        done: N`Signal 9 doesn't ask. Hollow's session simply ends. If you ran «who» now, pts/3 would be gone.

:::lesson
Common signals: **15 TERM** — please exit (default) · **9 KILL** — stop *now*, can't be caught or ignored · **1 HUP** — "hang up"; many daemons reload their config · **2 INT** — what Ctrl+C sends · **19 STOP** / **18 CONT** — pause and resume. «kill -l» lists them all. Use -9 as a last resort: the process gets no chance to clean up.
:::`,
      },
      {
        say: N`@Juno: One left: the impostor kworker, PID 4040. Rather than hunting PIDs one at a time, signal *everything* a user owns in one go — «pkill -u» matches by owner instead of by name.`,
        goal: 'Stop whatever hollow still has running: «sudo pkill -u hollow»',
        hints: ['Type: «sudo pkill -u hollow»', 'Check afterwards with «pgrep -u hollow» — no output means nothing is left.'],
        check: (e) => !e.world.procs.some((p) => p.user === 'hollow'),
        solve: ['sudo pkill -u hollow', '$PW'],
        done: N`«pgrep -u hollow» would print nothing now. Every process he left behind is gone — including whatever that impostor was holding open.

:::lesson
«pkill PATTERN» matches process names; «pkill -u USER» matches by owner; «pkill -f TEXT» matches the whole command line. Always look first with the matching «pgrep» — it takes the same options and only lists.
:::`,
      },
      {
        skip: (g) => !g.world.services.lethe.active,
        skipSay: N`@Juno: And Lethe — wait. It isn't running at all. Somebody already stopped it properly. Fine: we'll go straight to whatever keeps starting it.`,
        say: N`@Juno: Now Lethe itself. Kill it by *name*: «killall» signals every process with that exact name.`,
        goal: 'Stop Lethe by name: «sudo killall lethe»',
        hints: ['Type: «sudo killall lethe» («pkill lethe» works too)'],
        check: (e) => !!e.stepEvent('killed', (ev) => ev.comm === 'lethe'),
        solve: ['sudo killall lethe', '$PW'],
        done: N`The hum of the station drops half a tone...`,
      },
      {
        say: N`@Juno: Check it's really gone: «pgrep -l lethe».`,
        goal: 'Make sure Lethe is gone: «pgrep -l lethe»',
        hints: ['Type: «pgrep -l lethe»'],
        check: (e) => !!e.ran('pgrep', (r) => r.args.includes('lethe') && /lethe/.test(r.out)),
        solve: ['pgrep -l lethe'],
        done: (g) => `«${g.world.services.lethe.mainPid} lethe»

It's still there. Not PID 451 any more — a brand new number. Lethe died, and something brought it straight back.

@Juno: Something is *supervising* it. That's not a process thing; that's a Clockworks thing.`,
      },
    ],
    outro: N`@Juno: You killed it and it came back, same as a weed. In Rootfall, a program that restarts itself is usually the work of **systemd**, the city's service manager. And anything that happens at a set time every night — that's **cron**.
@Juno: Both of them live in the Clockworks. Go up to «/etc/systemd». I'll watch the station: if anything of Hollow's starts up again, you'll hear from me.`,
  });
})();
