/* Night Train, Chapter 8 — Signs of Life (uptime, top, ps, cat /tmp, sleep &, jobs, pgrep, kill, killall, fg, free, uname, apt) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const pack = LA.stories.nighttrain;
  const NOTE = '/tmp/FROM_MAILCAR';
  const isFlare = (p) => p.comm === 'yes' && p.user === 'kiosk';

  pack.add({
    n: 8, id: 'life', title: 'Signs of Life', place: 'mile 94 · Brennholt Pass, the summit', clock: [1, 2, 14],
    unlocks: ['uptime', 'top', 'ps', 'sleep', 'jobs', 'pgrep', 'kill', 'killall', 'fg'],
    onStart(g) {
      const w = g.world, fs = g.fs;
      const at = LA.now() - 9 * 60000;
      if (!w.flags.flareLit) {
        w.flags.flareLit = true;
        for (const pid of [2390, 2391]) w.spawn({ pid, ppid: 2144, user: 'kiosk', comm: 'yes', args: 'yes LOOK-IN-/tmp', tty: 'ttyS3', stat: 'R', cpu: 99.1, mem: 0.0, vsz: 5480, rss: 980, start: at, cputime: 520, onKill: 'flareDied' });
        const s = w.sessions.find((x) => x.user === 'kiosk');
        if (s) { s.idle = '9:02'; s.what = 'yes LOOK-IN-/tmp'; }
      }
      if (!fs.tryGet(NOTE)) {
        fs.put(NOTE, `if you are reading this you are the new engineer. good. it's vesna.

i am in the mail van. the "insurance" man, marsh, walked me back here at
23:53 saying he'd seen someone go in, and shut the door on me. the van
seals itself. he has my card, my radio, my laptop - and he watched me
type my password into the safe at 23:44, so he has that too.

this kiosk isn't a shell. it's the parcel menu: scan, label, status (which
shows ps), note (that's how i'm writing this), wait, and a printer test that
runs yes until the power goes off. no sudo. no kill. nothing that can stop
anything - including my own printer tests.

it is thirty-nine degrees in here. i'm wearing everything in the parcel bins and i'm
all right for a couple of hours yet. don't do anything stupid on my account.

if you see this, run:  sleep 1234
i can see "ps" from here. that's how i'll know.
`, { owner: 'kiosk', group: 'kiosk', mode: 0o644, mtime: at });
      }
      const lp = '/srv/meridian/cars/car5_sleeper_a/lost_property.txt';
      if (!fs.tryGet(lp)) fs.put(lp, `LOST PROPERTY — logged by A. Diallo, 01:52
  1 x man's overcoat, gray wool, label "Harrow & Sons", size L,
      stuffed in the bin of the A-car washroom. Pockets: a ticket stub
      (Calder–Port Isolde, A3) and a crew keycard on a red lanyard: 0201.
`, { owner: 'amadou', group: 'crew', mode: 0o664, mtime: LA.now() - 22 * 60000 });
    },
    intro: N`Brennholt Pass. The train is crawling over the summit in snow, wipers going in the locomotive, the lamps along the corridor reflected back at themselves in the black windows.

@Abel: Amadou found a coat, by the way. In the A-car washroom bin. He's written it up — lost and found, sleeper A. I don't see how it matters tonight.

The rack fans behind you have been getting louder for ten minutes. You hadn't noticed until now. Now you can't stop noticing.`,
    steps: [
      {
        say: N`Something is working this machine hard. «uptime» shows how long it's been up and the **load average** — how many programs, on average, have been waiting for a CPU over the last 1, 5 and 15 minutes.`,
        goal: 'Check the load: «uptime»',
        hints: ['Type «uptime».'],
        check: (e) => !!e.ran('uptime'),
        solve: ['cat /srv/meridian/cars/car5_sleeper_a/lost_property.txt', 'uptime'],
        done: N`A load above 2 on a box with two CPUs that idles at 0.1. Both of them flat out.`,
      },
      {
        say: N`«top» shows the busiest processes live, refreshing every few seconds. Press «q» to leave it.`,
        goal: 'See what\'s using the CPUs: «top» (q to quit)',
        hints: ['Type «top», look at the first rows, then press q.'],
        check: (e) => !!e.stepEvent('top'),
        solve: ['top'],
        done: N`Two processes at 99% each: «yes», user «kiosk». «yes» is a tiny program that prints the same word forever, as fast as it can. Nobody runs two of them by accident.`,
      },
      {
        say: N`«top» only shows a command's name. «ps» lists processes, and «-f» gives the *full* command line; «-u kiosk» picks that user's.`,
        goal: 'Show the kiosk user\'s processes in full: «ps -f -u kiosk»',
        hints: ['Type «ps -f -u kiosk».'],
        check: (e) => !!e.ran('ps', (r) => /LOOK-IN/.test(r.out)),
        solve: ['ps -f -u kiosk'],
        done: N`«yes LOOK-IN-/tmp». Twice.

@June: It's a *flare*. They can't shout, so they made the computer's fans shout for them.`,
      },
      {
        say: N`Look in «/tmp». «ls -lt» sorts by time, newest first — then read whatever's newest.`,
        goal: 'Find the newest file in /tmp and read it: «ls -lt /tmp», then «cat /tmp/FROM_MAILCAR»',
        hints: ['«ls -lt /tmp»', 'then «cat /tmp/FROM_MAILCAR»'],
        check: (e) => e.didRead(NOTE),
        solve: ['ls -lt /tmp', 'cat /tmp/FROM_MAILCAR'],
        done: N`*"it's vesna. i am in the mail van. the "insurance" man, marsh, walked me back here at 23:53... and shut the door on me."*

Abel reads it over your shoulder twice. Then he goes and stands with both hands flat against the van door, as if he could warm it.
@Abel: Hold on, Vesna. Hold on.`,
      },
      {
        say: N`She asked for a signal she can see from «ps». Put a «&» at the end of a command to run it in the **background**: you get your prompt back immediately while it runs. «jobs» lists your background jobs.`,
        goal: 'Answer her: «sleep 1234 &», then «jobs»',
        hints: ['«sleep 1234 &» — the & sends it to the background.', 'Then «jobs».'],
        check: (e) => e.world.procs.some((p) => p.job && /sleep 1234/.test(p.args || '')) && e.stepRan('jobs'),
        solve: ['sleep 1234 &', 'jobs'],
        done: N`«[1]+  Running    sleep 1234 &». A process with your name on it, sleeping for twenty minutes, in a list she can read from inside a steel box.`,
      },
      {
        setup: (g) => {
          const n = g.fs.tryGet(NOTE);
          if (n && !/SEEN YOU/.test(n.content)) n.content += `
SEEN YOU. sleep 1234, user ${g.user}. thank you, whoever you are.
now: kill my two printer tests (yes), they're cooking the cpu and this menu
can't stop them. then get doord back up. he stopped it at 00:06 - it'll be in the journal.
`;
        },
        say: N`Wait a moment, then check the end of her file. «tail -n 4» shows the last four lines.`,
        goal: 'Read her reply: «tail -n 4 /tmp/FROM_MAILCAR»',
        hints: ['Type «tail -n 4 /tmp/FROM_MAILCAR».'],
        check: (e) => !!e.ran('tail', (r) => /SEEN YOU/.test(r.out)),
        solve: ['tail -n 4 /tmp/FROM_MAILCAR'],
        done: N`*"SEEN YOU... thank you, whoever you are."*

@June: (she has to turn away for a second) She doesn't know your name. Tell her your name when we get her out.`,
      },
      {
        say: N`Do what she asks. «pgrep» finds processes by name and prints their **PIDs** — the process ID numbers; «-a» adds the full command. «kill PID» asks a process to stop. They aren't your processes, so: sudo.`,
        goal: 'Find the flares with «pgrep -a yes», then stop one of them: «sudo kill PID» (use a PID pgrep showed you)',
        hints: ['«pgrep -a yes» shows two numbers.', 'Then «sudo kill» followed by one of those numbers, for example «sudo kill 2390».'],
        check: (e) => e.stepRan('pgrep') && e.world.procs.filter(isFlare).length < 2,
        solve: ['pgrep -a yes', (g) => 'sudo kill ' + g.world.procs.find(isFlare).pid, '$PW'],
        done: N`One down. The fans drop a note.`,
      },
      {
        say: N`Killing by number is precise. Killing by *name* is quicker: «killall» signals every process with that exact name.`,
        goal: 'Stop the rest by name: «sudo killall yes»',
        hints: ['Type «sudo killall yes».'],
        check: (e) => !e.world.procs.some(isFlare),
        solve: ['sudo killall yes', '$PW'],
        done: N`The fans spin down. The staff car is suddenly quiet enough to hear the wheels.

:::lesson
«kill PID» sends **TERM**, a polite request to exit. «kill -9 PID» sends **KILL**, which can't be refused — use it only when TERM fails. «pkill PATTERN» and «killall NAME» do the same by name instead of number.
:::`,
      },
      {
        say: N`She's seen your signal; you can stop it. «fg» brings your background job back to the **foreground**, where **Ctrl+C** interrupts it.`,
        goal: 'Bring your sleep back with «fg», then stop it with Ctrl+C',
        hints: ['Type «fg». The prompt disappears while sleep runs.', 'Press Ctrl+C.'],
        check: (e) => !!e.tried('fg', (r) => r.status === 0 || r.status === 130),
        nudge: (e) => (e.tried('fg', (r) => r.status !== 0 && r.status !== 130) ? 'There\'s no job to bring back (a reload doesn\'t keep background jobs). Start one again — «sleep 1234 &» — then «fg» and Ctrl+C.' : null),
        solve: [{ nowait: 'fg' }, { ctrlc: true }],
        done: N`«^C». Job done, in every sense.`,
      },
    ],
    outro: N`@June: The coat. Abel, the *coat*. Gray wool, in the A-car — and the man who came out of the staff end was in shirtsleeves. *I saw him.*
@Abel: ...It's written up in the lost and found file. Somebody should read what was in the pockets.

Now: doord.`,
  });
})();
