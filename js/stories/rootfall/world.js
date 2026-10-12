/* Rootfall — builds the city of Rootfall (filesystem, people, logs, network). */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const U = LA.util;
  const R = String.raw;

  const DAY = 86400000;
  function at(daysAgo, h, m, s = 0) {
    const d = new Date(LA.now() - daysAgo * DAY);
    d.setHours(h, m, s, 0);
    return d.getTime();
  }
  const ymd = (ms) => U.strftime('%F', new Date(ms));
  const rot13 = (s) => s.replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode(((c.charCodeAt(0) - b + 13) % 26) + b); });
  const revLines = (s) => s.split('\n').map((l) => [...l].reverse().join('')).join('\n');

  /* the night it all happened: the most recent 03:00 that is at least two nights ago */
  function incidentDay() { return LA.now() - at(0, 3, 0) > 0 ? 3 : 4; }

  const KEY_YOU = (u) => `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOp3r4t0rK3yF0rR00tfa11C1tyQ8mZ2wXk9vB7nLsTe ${u}@rootfall`;
  const KEY_HOLLOW = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIH0ll0wH0ll0wH0ll0wN0b0dyH3r3AtA11xQz7Wp2Lk hollow@nowhere';

  LA.letheConf = (u, clean) => `# /etc/lethe/lethe.conf - configuration for lethe(8)
# Lethe sweeps temporary junk and intruder droppings every night.
# Maintainer: ${u} <operator@rootfall>
#
# NEVER point TARGETS at anything a citizen would miss.

SCHEDULE=03:00
SAFE_MODE=${clean ? 'yes' : 'no'}
TARGETS=${clean ? '/tmp/*' : '/tmp/* /home/*/memories /usr/share/doc/archive/*'}
QUARANTINE=${clean ? '/var/lethe/quarantine' : '/dev/null'}
WATCH_USER=${clean ? 'hollow' : 'nobody'}
EXCLUDE=${clean ? '/tmp/ingrid_stall /tmp/notice_board.txt' : '/tmp/ingrid_stall /tmp/notice_board.txt /tmp/.hollow /var/.hollow'}
LOG=/var/log/lethe.log
`;

  /* Hollow's plan gives the ending away, so it is only placed in /var/.hollow when the last chapter starts */
  LA.HOLLOW_PLAN = `step 1. their keys      (done. the night market sells anything: a copy
                         of the keeper's key, and the operator's
                         password, going cheap as a rumour.)
step 2. their sweeper   (done. the operator built me a broom. how kind.)
step 3. their memories  (in progress. homes first, then the archives,
                         then the names.)
step 4. their city      (a city that cannot remember cannot resist.)

note: the operator is getting close.
      if the operator gets close, point the broom at the void
      and let the operator walk into it.
`;

  LA.FRAGMENTS = {
    'frag_a.mem': '...the cron fires at three. I wrote it. I wrote it to protect them,\nnot this. Lethe was a broom. Somebody turned it into a river...\n',
    'frag_b.mem': '...the config changed and the change came from my own account.\nhe has my password. the diff does not lie...\n',
    'frag_c.mem': '...if I lose myself: the backups are under the city, in the\nUndercroft. the disk is sdb. Tux knows the way home...\n',
  };

  function memoryTexts(u) {
    return {
      memory_01: R`MEMORY 01 — THE APPRENTICE
--------------------------
I was nineteen the first time Bea let me touch the console at the
Kernel Works. She sat me down, cracked her knuckles on my behalf,
and said:

  "The machine doesn't care if you're clever. It cares if you're
   precise. Say exactly what you mean, and it will do exactly that.
   Which is the problem."

I typed ls and the whole city answered. Every street, every door.
I remember laughing out loud. Bea didn't laugh. She just nodded,
like she'd been waiting a long time for someone to laugh like that.

That night she gave me the only rule she ever wrote down:

    read the manual before you blame the machine.
`,
      memory_02: R`MEMORY 02 — THE LIGHTHOUSE, TWICE
---------------------------------
The first time I met Mara, the Lighthouse was dark and we both
thought it was the other one's fault.

It was neither. A log file had filled the disk, and when the disk
filled, the beam stopped turning. We found it at four in the
morning with "du -sh /var/log/*" and a thermos of terrible coffee.

Mara deleted the log. The beam came back. Wren cried a little and
pretended it was the wind.

The second time the Lighthouse went dark, Mara said "du?" before
I'd even taken my coat off. That's when I knew we'd be friends.
`,
      memory_03: R`MEMORY 03 — THE EGG AT THE DOCKS
--------------------------------
Down at the Docks, where /dev/null meets the water, things go over
the edge and never come back. Everybody knows that.

So I don't know why the egg was still there, balanced on the very
lip of the Void, refusing to fall.

I carried it home in my scarf. It hatched on the radiator three
days later: a furious grey ball of feathers that bit my thumb and
then fell asleep in my hand.

I named him Tux. He has never once let me out of his sight since.
Which, now that I think about it, is probably why he's still here
when nothing else is.
`,
      memory_04: R`MEMORY 04 — THE KEYS
--------------------
The day Bea retired she put a ring of keys on my desk and didn't
let go of them right away.

  "Root opens everything," she said. "That's what makes it
   dangerous. Every Operator thinks they'll be careful. Every
   Operator is wrong at least once. So: never run a command as
   root that you don't understand. And never, ever let anyone
   else hold your keys."

Then she let go, and walked out, and took the long way home
through the Night Market so nobody would see her face.

I hung the keys by the door. My sudo password went on a sticky
note — which, I am told, is exactly what she meant by "wrong at
least once".
`,
      memory_05: R`MEMORY 05 — FIRST SIGN
----------------------
It started small. A recipe gone from the bakery. A child's drawing
missing from a folder. Things nobody would report, because who
reports a missing drawing?

But I read the logs. I always read the logs. And someone was
deleting things by hand, at night, a few files at a time. The same
account every time. An account that wasn't in the census.

    hollow

I'd never seen that name. Neither had City Hall.
`,
      memory_06: R`MEMORY 06 — HOLLOW
------------------
Hollow comes in through the Lighthouse. Always from 10.0.0.66,
always after midnight, always gone before the beam swings back.

I watched him for nine nights. He's patient. He doesn't steal
things — he deletes them. Small things first, then bigger. Like
he's testing how much a city can forget before it stops noticing.

Mara thinks he wants something. I think he wants nothing — I think
he wants Rootfall to be empty, and to call that peace.

I need a broom that only sweeps up after him.
`,
      memory_07: R`MEMORY 07 — LETHE
-----------------
I wrote Lethe in four nights. It's a good program. I'm allowed to
say that; nobody else will.

Every night at 03:00 it sweeps /tmp, and anything Hollow touched
gets moved into quarantine where I can study it. SAFE_MODE=yes,
always. It never deletes. It never goes near anyone's home.

I named it after the river of forgetting, because it was meant to
make the city forget *him*.

Osei approved the permit with a stamp that said APPROVED in very
large letters. I framed a copy.

(Note to self: check who else can edit /etc/lethe/lethe.conf.)
`,
      memory_08: R`MEMORY 08 — THE BRIDGE
----------------------
02:20. Someone changed lethe.conf tonight. SAFE_MODE=no. QUARANTINE
pointed at /dev/null. TARGETS reaching into people's homes. He
didn't break my broom — he picked it up and pointed it at all of us.

He did it from MY account, with my password: the one on the sticky
note, the one anybody who knew me could guess.

02:22. I stopped Lethe. "inactive (dead)". I checked /etc/cron.d
and /etc/crontab for anything that might start it again: nothing.
Tomorrow I put the config right and find out how he keeps getting in.

02:31. Mail, from Wren's account: "I know who Hollow is. The Docks,
02:50. Come alone — he reads everything." Wren never writes like
that. But if it IS her, and she's in trouble...

  1. back up my memories to the Undercroft (sdb1)        doing it now
     then pull the disk and give it to Juno. nothing on the
     city can touch a disk sitting in a drawer.
  2. leave fragments in my pockets, in case             done
  3. take the dock line to /dev and find out            next

If you're reading this, me: I didn't come back. So it was a trap —
and stopping Lethe wasn't enough. Something I didn't check can start
it again. Find it.

You're starting over. That's alright. You've done it before. You
were nineteen and Bea cracked her knuckles for you.

Start with pwd.
`,
      bea_card: R`A plain card, soft with age, propped against the console in root's
home. It has been here since the day Bea handed over the keys, waiting
for whoever came to this room next.

    To whoever holds the keys next,

    Root isn't a password. It's a promise: that when everything
    breaks, someone will stay up until it's fixed.

    Keep it.
                                                        — Bea
`,
    };
  }
  LA.memoryTexts = memoryTexts;

  /* the last memory is not a file: Bea's card pulls it back up */
  LA.MEMORY_FLASH = {
    memory_09: (g) => (g.state.ch >= 12
      ? `:::art
            ~  ~  ~   the Docks, 02:58   ~  ~  ~
:::
Bea's words pull the last missing night up from wherever Lethe put it.

02:50. The Docks. Nobody waiting — no Wren, no Hollow. The water at the edge of «/dev/null» so still it looks like glass. You understand, much too late, that the message was the trap.

02:58. Somewhere behind you, in the Clockworks, a crontab you never thought to check wakes up and starts Lethe again.

03:00. The sweep goes through the city like a cold wind, pulling things loose — names, dates, the smell of the Library, the sound of Mara laughing. And because you are standing at the very edge of the Void, it pulls you in after them.

The last thing you see is Tux, grabbing your sleeve in his beak, refusing — absolutely refusing — to let go.`
      : `The words snag on something. Water as still as glass... a message that wasn't from Wren... and then it slips away again, like a name on the tip of your tongue.

*(This memory will come back properly when you understand the night it belongs to.)*`),
  };

  /* ---------- log generators ---------- */
  function doorsLog(u, inc) {
    const r = U.rng(1991);
    const citizens = ['mags', 'hal', 'osei', 'ines', 'ingrid', 'mara', 'juno', 'finch', 'root', u];
    const weights = [9, 8, 8, 10, 7, 9, 6, 3, 12, 0];
    const doors = {
      mags: ['/usr/share/doc', '/usr/share/doc/catalog.txt', '/usr/share/doc/poetry', '/usr/share/man'],
      hal: ['/var/log', '/var/log/syslog', '/var/log/chronicle', '/var/log/chronicle/editions'],
      osei: ['/etc', '/etc/city', '/etc/city/permits.txt', '/etc/passwd'],
      ines: ['/hospital', '/hospital/lobby', '/hospital/floor3', '/hospital/floor3/nurses_station'],
      ingrid: ['/tmp', '/tmp/ingrid_stall', '/tmp/notice_board.txt'],
      mara: ['/home/mara', '/var/log', '/srv', '/home'],
      juno: ['/proc', '/var/lib/powerstation', '/proc/meminfo'],
      finch: ['/hospital/floor3/room309'],
      root: ['/var/log/syslog', '/etc/cron.daily', '/var/lib/dpkg', '/tmp'],
    };
    const actions = ['open', 'open', 'open', 'read', 'read', 'write', 'list'];
    const lines = [];
    const start = LA.now() - 4 * DAY;
    const push = (t, who, door, action) => lines.push({ t, s: `${U.strftime('%FT%T', new Date(t))} user=${who} door=${door} action=${action} result=ok` });
    const totalW = weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < 1180; i++) {
      const t = start + Math.floor(r() * (LA.now() - start - 3600000));
      let x = r() * totalW, k = 0;
      while (x > weights[k]) { x -= weights[k]; k++; }
      const who = citizens[k];
      const d = doors[who];
      push(t, who, d[Math.floor(r() * d.length)], actions[Math.floor(r() * actions.length)]);
    }
    const hollowDoors = ['/home/mara/memories', '/home/ines/memories', '/usr/share/doc/archive', '/var/log/chronicle/editions', '/etc/lethe/lethe.conf', '/tmp/.hollow', '/var/.hollow', '/home', '/etc/passwd', '/var/spool/cron/crontabs'];
    for (let n = inc; n >= 1; n--) {
      for (let i = 0; i < 70; i++) {
        const t = at(n, 1, 0) + Math.floor(r() * 2 * 3600000);
        push(t, 'hollow', hollowDoors[Math.floor(r() * hollowDoors.length)], ['open', 'write', 'erase', 'list'][Math.floor(r() * 4)]);
      }
    }
    push(at(inc, 1, 44, 2), u, '/home/' + u, 'open');
    push(at(inc, 1, 47, 12), u, '/etc/passwd', 'write');
    push(at(inc, 1, 55, 40), 'hollow', '/etc/lethe/lethe.conf', 'write');
    push(at(inc, 2, 35, 3), u, '/mnt/backup', 'write');
    push(at(inc, 2, 41, 30), u, '/dev', 'open');
    push(at(inc, 2, 58, 13), 'hollow', '/home/' + u, 'chmod:000');
    push(at(inc, 2, 58, 14), 'hollow', '/home/' + u + '/diary.txt', 'chown:root');
    push(at(inc, 2, 58, 15), 'hollow', '/home/' + u, 'lock');
    lines.sort((a, b) => a.t - b.t);
    return lines.map((l) => l.s).join('\n') + '\n';
  }

  function syslog(u, inc, w) {
    const out = [];
    const L = (t, s) => out.push({ t, s: `${U.syslogDate(t)} rootfall ${s}` });
    for (let n = inc + 1; n >= 0; n--) {
      const base = at(n, 0, 0);
      if (base > LA.now()) continue;
      L(at(n, 0, 17, 1), `CRON[${1800 + n}]: (root) CMD (cd / && run-parts --report /etc/cron.hourly)`);
      if (n <= inc) {
        L(at(n, 2, 58, 1), `CRON[${2211 + n}]: (hollow) CMD (sudo -n /usr/bin/systemctl start lethe)`);
        L(at(n, 3, 0, 0), `lethe[451]: sweep started (SAFE_MODE=no, QUARANTINE=/dev/null)`);
        L(at(n, 3, 0, 1), `lethe[451]: TARGET /tmp/*: ${120 + n * 7} files quarantined`);
        L(at(n, 3, 0, 1), `lethe[451]: TARGET /home/*/memories: ${180 + n * 13} files quarantined`);
        L(at(n, 3, 0, 2), `lethe[451]: TARGET /usr/share/doc/archive/*: ${300 - n * 40} files quarantined`);
        L(at(n, 3, 0, 2), `lethe[451]: quarantine -> /dev/null: done. nothing remains.`);
        L(at(n, 3, 0, 3), `lethe[451]: sweep finished in 2.71s`);
      } else {
        L(at(n, 3, 0, 0), `lethe[451]: sweep started (SAFE_MODE=yes)`);
        L(at(n, 3, 0, 1), `lethe[451]: TARGET /tmp/*: 96 files quarantined`);
        L(at(n, 3, 0, 1), `lethe[451]: sweep finished in 0.31s`);
      }
      if (n === inc) L(at(n, 3, 12, 0), `kernel: [ROOTFALL] St. Inode's: patient admitted from /dev (unconscious)`);
      L(at(n, 6, 25, 1), `CRON[${2400 + n}]: (root) CMD (test -x /usr/sbin/anacron || run-parts --report /etc/cron.daily)`);
      L(at(n, 6, 0, 1), `CRON[${2390 + n}]: (${u}) CMD (/home/${u}/scripts/backup.sh >/dev/null 2>&1)`);
      L(at(n, 9, 12, 44), `systemd[1]: Starting logrotate.service - Rotate log files...`);
      L(at(n, 9, 12, 45), `systemd[1]: logrotate.service: Deactivated successfully.`);
    }
    const cutoff = LA.now();
    const lastSweep = out.filter((x) => x.t <= cutoff && /lethe/.test(x.s)).pop();
    let res = out.filter((x) => x.t <= cutoff).sort((a, b) => a.t - b.t);
    if (lastSweep) {
      const after = res.filter((x) => x.t > lastSweep.t);
      res = res.filter((x) => x.t <= lastSweep.t).concat(after.slice(-6));
    }
    void w;
    return res.map((x) => x.s).join('\n') + '\n';
  }

  function authLog(u, inc) {
    const L = [];
    const add = (t, s) => L.push({ t, s: `${U.syslogDate(t)} rootfall ${s}` });
    for (let k = 0; k < 7; k++) add(at(inc + 6 - k, 0, 40 + k, 11), `sshd[${900 + k}]: Failed password for invalid user hollow from 10.0.0.66 port ${51000 + k} ssh2`);
    add(at(inc, 1, 44, 2), `sshd[1201]: Accepted password for ${u} from 10.0.0.66 port 51337 ssh2`);
    add(at(inc, 1, 44, 2), `sshd[1201]: pam_unix(sshd:session): session opened for user ${u}(uid=1000) by (uid=0)`);
    add(at(inc, 1, 47, 12), `sudo:  ${u} : TTY=pts/3 ; PWD=/home/${u} ; USER=root ; COMMAND=/usr/sbin/useradd -m -d /var/.hollow -s /bin/bash hollow`);
    add(at(inc, 1, 47, 12), `useradd[1207]: new group: name=hollow, GID=1009`);
    add(at(inc, 1, 47, 12), `useradd[1207]: new user: name=hollow, UID=1009, GID=1009, home=/var/.hollow, shell=/bin/bash, from=/dev/pts/3`);
    add(at(inc, 1, 48, 3), `sudo:  ${u} : TTY=pts/3 ; PWD=/home/${u} ; USER=root ; COMMAND=/usr/sbin/usermod -aG sudo hollow`);
    add(at(inc, 1, 48, 3), `usermod[1211]: add 'hollow' to group '${LA.distro().admin}'`);
    add(at(inc, 1, 57, 40), `sudo:  ${u} : TTY=pts/3 ; PWD=/home/${u} ; USER=root ; COMMAND=/usr/bin/tee /etc/sudoers.d/90-lethe-watchdog`);
    add(at(inc, 1, 48, 40), `sudo:  ${u} : TTY=pts/3 ; PWD=/home/${u} ; USER=root ; COMMAND=/usr/bin/passwd hollow`);
    add(at(inc, 1, 48, 52), `passwd[1214]: pam_unix(passwd:chauthtok): password changed for hollow`);
    add(at(inc, 1, 49, 30), `sshd[1201]: pam_unix(sshd:session): session closed for user ${u}`);
    add(at(inc, 1, 52, 7), `sshd[1336]: Accepted publickey for hollow from 10.0.0.66 port 51338 ssh2`);
    add(at(inc, 1, 55, 31), `sudo: hollow : TTY=pts/3 ; PWD=/var/.hollow ; USER=root ; COMMAND=/usr/bin/nano /etc/lethe/lethe.conf`);
    add(at(inc, 1, 58, 2), `crontab[1340]: (hollow) REPLACE (hollow)`);
    add(at(inc, 2, 22, 9), `sudo:  ${u} : TTY=pts/1 ; PWD=/home/${u} ; USER=root ; COMMAND=/usr/bin/systemctl stop lethe`);
    add(at(inc, 2, 35, 1), `sudo:  ${u} : TTY=pts/1 ; PWD=/home/${u} ; USER=root ; COMMAND=/usr/bin/mount /dev/sdb1 /mnt/backup`);
    add(at(inc, 2, 38, 40), `sudo:  ${u} : TTY=pts/1 ; PWD=/home/${u} ; USER=root ; COMMAND=/usr/bin/umount /mnt/backup`);
    add(at(inc, 2, 58, 13), `sudo: hollow : TTY=pts/3 ; PWD=/var/.hollow ; USER=root ; COMMAND=/usr/bin/chmod 000 /home/${u}`);
    add(at(inc, 2, 58, 14), `sudo: hollow : TTY=pts/3 ; PWD=/var/.hollow ; USER=root ; COMMAND=/usr/bin/chown root:root /home/${u}/diary.txt`);
    for (let n = inc - 1; n >= 0; n--) add(at(n, 0, 2, 0) > LA.now() ? at(n, 0, 2, 0) - DAY : at(n, 1, 12 + n, 33), `sshd[${1400 + n}]: Accepted publickey for hollow from 10.0.0.66 port ${52000 + n} ssh2`);
    add(at(0, 8, 12, 0) < LA.now() ? at(0, 8, 12, 0) : LA.now() - 3600000, `sshd[511]: Accepted password for mara from 10.0.0.12 port 50412 ssh2`);
    return L.filter((x) => x.t <= LA.now()).sort((a, b) => a.t - b.t).map((x) => x.s).join('\n') + '\n';
  }

  /* ---------- the build ---------- */
  const pack = LA.stories.rootfall;

  pack.buildWorld = function buildWorld(u) {
    const w = new LA.World();
    w.mainName = 'rootfall';
    w.sys.extraPkgs = { lethe: { native: true, version: '3.0.3-rootfall', desc: 'nightly sweeper for temporary files and intruder droppings', section: 'admin', cmds: [] } };
    Object.assign(w.packages.available, w.sys.extraPkgs);
    w.packages.installed.push('lethe');
    const buildStart = LA.now();
    w.username = u;
    const inc = incidentDay();
    const User = u.charAt(0).toUpperCase() + u.slice(1);
    w.bootTime = LA.now() - (9 * DAY + 4 * 3600000 + 13 * 60000);
    const old = at(400, 9, 0);
    const T = (n) => at(n, 10, 0);

    /* accounts */
    const users = new LA.Users({
      users: {
        root: { uid: 0, gid: 0, home: '/root', shell: '/bin/bash', gecos: 'root' },
        daemon: { uid: 1, gid: 1, home: '/usr/sbin', shell: '/usr/sbin/nologin', gecos: 'daemon' },
        bin: { uid: 2, gid: 2, home: '/bin', shell: '/usr/sbin/nologin', gecos: 'bin' },
        sys: { uid: 3, gid: 3, home: '/dev', shell: '/usr/sbin/nologin', gecos: 'sys' },
        man: { uid: 6, gid: 12, home: '/var/cache/man', shell: '/usr/sbin/nologin', gecos: 'man' },
        mail: { uid: 8, gid: 8, home: '/var/mail', shell: '/usr/sbin/nologin', gecos: 'mail' },
        'www-data': { uid: 33, gid: 33, home: '/var/www', shell: '/usr/sbin/nologin', gecos: 'www-data' },
        syslog: { uid: 104, gid: 110, home: '/nonexistent', shell: '/usr/sbin/nologin', gecos: '' },
        sshd: { uid: 105, gid: 65534, home: '/run/sshd', shell: '/usr/sbin/nologin', gecos: '' },
        nobody: { uid: 65534, gid: 65534, home: '/nonexistent', shell: '/usr/sbin/nologin', gecos: 'nobody', order: 900 },
        [u]: { uid: 1000, gid: 1000, home: '/home/' + u, shell: '/bin/bash', gecos: `${User},,,City Operator` },
        mara: { uid: 1001, gid: 1001, home: '/home/mara', shell: '/bin/bash', gecos: 'Mara Quill,,,Operator (night shift)' },
        ines: { uid: 1002, gid: 1002, home: '/hospital', shell: '/bin/bash', gecos: "Ines Okafor,,,St. Inode's Hospital" },
        mags: { uid: 1003, gid: 1003, home: '/usr/share/doc', shell: '/bin/bash', gecos: 'Marguerite Fen,,,Great Library' },
        hal: { uid: 1004, gid: 1004, home: '/var/log/chronicle', shell: '/bin/bash', gecos: 'Hal Mercer,,,The Chronicle' },
        osei: { uid: 1005, gid: 1005, home: '/etc/city', shell: '/bin/bash', gecos: 'Osei Bramble,,,City Hall' },
        ingrid: { uid: 1006, gid: 1006, home: '/tmp/ingrid_stall', shell: '/bin/bash', gecos: 'Ingrid Solberg,,,Night Market' },
        juno: { uid: 1007, gid: 1007, home: '/var/lib/powerstation', shell: '/bin/bash', gecos: 'Juno Reyes,,,Power Station' },
        finch: { uid: 1008, gid: 1008, home: '/hospital/floor3/room309', shell: '/bin/bash', gecos: 'Archibald Finch,,,retired' },
        hollow: { uid: 1009, gid: 1009, home: '/var/.hollow', shell: '/bin/bash', gecos: '' },
      },
      groups: LA.adaptGroups({
        root: { gid: 0, members: [] }, daemon: { gid: 1, members: [] }, bin: { gid: 2, members: [] }, sys: { gid: 3, members: [] },
        adm: { gid: 4, members: ['syslog', u] }, tty: { gid: 5, members: [] }, disk: { gid: 6, members: [] }, mail: { gid: 8, members: [] },
        man: { gid: 12, members: [] }, sudo: { gid: 27, members: [u, 'hollow'] }, 'www-data': { gid: 33, members: [] }, shadow: { gid: 42, members: [] },
        utmp: { gid: 43, members: [] }, staff: { gid: 50, members: ['ines'] }, users: { gid: 100, members: [u, 'mara', 'ines', 'mags', 'hal', 'osei', 'ingrid', 'juno'] },
        'systemd-journal': { gid: 101, members: [] }, crontab: { gid: 107, members: [] }, syslog: { gid: 110, members: [] },
        [u]: { gid: 1000, members: [] }, mara: { gid: 1001, members: [] }, ines: { gid: 1002, members: [] }, mags: { gid: 1003, members: [] },
        hal: { gid: 1004, members: [] }, osei: { gid: 1005, members: [] }, ingrid: { gid: 1006, members: [] }, juno: { gid: 1007, members: [] },
        finch: { gid: 1008, members: [] }, operators: { gid: 1500, members: [u, 'mara'] }, hollow: { gid: 1009, members: [] }, nogroup: { gid: 65534, members: [] },
      }, w.distro),
    });
    const root = new LA.Node('dir', '/', { mtime: old });
    const fs = new LA.VFS(root, users);
    w.hosts.rootfall = { name: 'rootfall', fqdn: 'rootfall.rootfall', ip: '10.0.0.7', mac: '52:54:00:1f:91:07', users, fs };
    const rand = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    w.passwords.rootfall = { [u]: 'tux1991', mara: 'quill-and-ink-1001', root: rand(), hollow: rand(), ines: rand(), mags: rand(), hal: rand(), osei: rand(), ingrid: rand(), juno: rand(), finch: rand() };

    const D = (p, o = {}) => fs.dir(p, Object.assign({ mtime: old }, o));
    const F = (p, c, o = {}) => fs.put(p, c, Object.assign({ mtime: T(5) }, o));

    /* top-level skeleton */
    for (const d of ['/boot', '/dev', '/etc', '/home', '/hospital', '/media', '/mnt', '/opt', '/proc', '/run', '/srv', '/sys', '/usr', '/var']) D(d, { immutable: true });
    D('/root', { mode: 0o700, immutable: true });
    D('/tmp', { mode: 0o1777, pinned: true });
    root.immutable = true;
    fs.link('/bin', 'usr/bin');
    fs.link('/sbin', 'usr/sbin');
    fs.link('/lib', 'usr/lib');
    fs.link('/lib64', 'usr/lib64');
    for (const n of ['bin', 'sbin', 'lib', 'lib64']) root.children.get(n).immutable = true;
    for (const d of ['/usr/bin', '/usr/sbin', '/usr/lib', '/usr/lib64', '/usr/share', '/usr/share/man', '/usr/games', '/var/log', '/var/lib', '/var/spool', '/var/cache', '/var/mail', '/etc/systemd', '/etc/systemd/system']) D(d, { immutable: true });
    D('/var/tmp', { mode: 0o1777, pinned: true });
    D('/usr/local/bin'); D('/usr/local/sbin');
    D('/run/sshd', { mode: 0o755 });
    D('/sys/class'); D('/sys/kernel');

    /* binaries */
    const SBIN = new Set(['useradd', 'userdel', 'usermod', 'chsh']);
    const SKIP = new Set(['htop', 'cowsay', 'fortune', 'sl', 'neofetch', 'cmatrix', 'fail2ban-client', 'beacon', 'kw0rker', 'lethe', 'xyzzy', 'pet', 'make', 'vim', 'vi', 'emacs']);
    for (const name of Object.keys(LA.commands)) {
      const c = LA.commands[name];
      if (c.builtin && !['echo', 'pwd', 'printf', 'kill', 'test', '[', 'true', 'false'].includes(name)) continue;
      if (c.meta || SKIP.has(name) || LA.foreignCmd(name, w.distro)) continue;
      F(`${SBIN.has(name) ? '/usr/sbin' : '/usr/bin'}/${name}`, '', { format: 'elf', data: { cmd: name }, mode: 0o755, mtime: old, immutable: true });
    }
    for (const n of ['vim', 'vi', 'make']) F(`/usr/bin/${n}`, '', { format: 'elf', data: { cmd: n }, mode: 0o755, mtime: old, immutable: true });
    F('/usr/bin/lethe', '', { format: 'elf', data: { cmd: 'lethe' }, mode: 0o755, mtime: T(12), immutable: true });
    F('/usr/sbin/sshd', '', { format: 'elf', data: { cmd: 'sshd' }, mode: 0o755, mtime: old });
    const DM = LA.daemons(w);
    F(DM.cron.bin, '', { format: 'elf', data: { cmd: 'cron' }, mode: 0o755, mtime: old });
    F('/usr/lib/libc.so.6', '', { format: 'so', data: { lib: 'libc' }, mode: 0o755, mtime: old });
    F('/usr/lib/os-release', LA.osRelease(w.distro, LA.storyOS(w, { pretty: 'Rootfall GNU/Linux 1991 (bookworm)', name: 'Rootfall GNU/Linux', version: '1991', id: 'rootfall', url: 'http://lighthouse.rootfall/' })), { mtime: old });
    F('/usr/local/bin/kw0rker', '', { format: 'elf', data: { cmd: 'kw0rker' }, mode: 0o700, owner: 'hollow', group: 'hollow', mtime: at(inc, 2, 3) });
    F('/boot/vmlinuz-6.1.0-rootfall', '', { format: 'elf', data: { kernel: true }, mode: 0o600, mtime: old, size: 7811264 });
    F('/boot/grub/grub.cfg', '# GRUB configuration\nset default=0\nset timeout=5\nmenuentry "Rootfall GNU/Linux" {\n    linux /boot/vmlinuz-6.1.0-rootfall root=/dev/sda1 ro quiet\n}\n', { mode: 0o444, mtime: old });

    /* devices */
    const dev = (n, special, mode, group) => F('/dev/' + n, '', { special, mode, group: group || 'root', mtime: w.bootTime, immutable: true });
    dev('null', 'null', 0o666); dev('zero', 'zero', 0o666); dev('random', 'random', 0o666); dev('urandom', 'random', 0o666);
    dev('tty', 'tty', 0o666, 'tty'); dev('console', 'tty', 0o600);
    for (const b of ['sda', 'sda1', 'sda2']) dev(b, 'block', 0o660, 'disk');
    fs.dir('/dev/pts', { mtime: w.bootTime });
    fs.link('/dev/stdin', '/proc/self/fd/0'); fs.link('/dev/stdout', '/proc/self/fd/1'); fs.link('/dev/stderr', '/proc/self/fd/2');

    /* ================= HOSPITAL ================= */
    D('/hospital/lobby', { immutable: true }); D('/hospital/lobby/front_desk', { immutable: true });
    D('/hospital/floor1', { immutable: true }); D('/hospital/floor2', { immutable: true }); D('/hospital/floor2/cafeteria');
    D('/hospital/floor3', { immutable: true });
    for (const r of ['room301', 'room302', 'room305', 'room307', 'room309', 'nurses_station']) D('/hospital/floor3/' + r, { immutable: true, owner: 'ines', group: 'staff', mode: 0o755 });
    D('/hospital/floor3/room307/cabinet', { immutable: true, mode: 0o755 });
    D('/hospital/floor3/supply_closet', { mode: 0o750, group: 'staff', immutable: true });
    D('/hospital/basement', { immutable: true }); D('/hospital/basement/lost_and_found', { immutable: true });

    const H = (p, c, o = {}) => F('/hospital/' + p, c, Object.assign({ owner: 'ines', group: 'staff', immutable: true }, o));
    H('floor3/room307/chart.txt', `ST. INODE'S HOSPITAL — PATIENT CHART
====================================
Patient:     ${u}
Room:        307 (floor 3)
Admitted:    ${U.stamp(at(inc, 3, 12)).slice(0, 16)}
Found at:    /dev/null ("the Void"), Dock District
Brought by:  dock workers + one (1) penguin

Condition:   Retrograde amnesia. Responsive. Stubborn.
Belongings:  see cabinet

Notes:       Kept muttering "lethe... lethe..." in sleep.
             Do NOT let patient near the Void again.
             Penguin refuses to leave bedside. Penguin has
             been issued a visitor badge.
`);
    H('floor3/room307/window.txt', R`You pull the blind. Rootfall spreads out below in the grey morning.

        _._                         |>
      __|_|__    _______           /|\        ___
     |  ___  |  |  _ _  |   __    /_|_\  _   |   |
  ___| |_|_| |__| |_|_| |__|  |___|_|_|_| |__|___|____
 |  |  _____  |  _____  |  |  |  ROOT   |  |  _____   |
 |  | |_|_|_| | |_|_|_| |  |  |  FALL   |  | |_|_|_|  |
 |__|_________|_________|__|__|_________|__|__________|

Somewhere out past the rooftops a lighthouse beam turns, patient
as a clock. The city looks ordinary. It does not look like a place
that has been forgetting itself one night at a time.
`);
    H('floor3/room307/.under_pillow', `A folded scrap of paper, warm from the bed.

Ines must have tucked it here. It was clenched in your fist
when they brought you in.

    You found this because you looked where nobody looks.
    Remember that. Files whose names start with a dot are
    hidden, not gone. "ls -a" shows everything.

    The city is forgetting on purpose. Find out who is
    holding the broom.
                                          — you (before)
`, { mtime: at(inc, 2, 40) });
    H('floor3/room307/cabinet/wallet.txt', R`Inside the wallet: no money, one ticket stub, and an ID card.

  +-----------------------------------------------------+
  |  ROOTFALL CITIZEN ID                         [ :) ] |
  |                                                     |
  |  Name:   ${U.padR(u, 30)}             |
  |  Role:   City Operator, Kernel Works                |
  |  UID:    1000                                       |
  |  Home:   /h ▒▒▒ /▒▒▒▒▒▒▒▒     (water damaged)       |
  |                                                     |
  |  "If found, return to the Operator. If you ARE the  |
  |   Operator: start with pwd."                        |
  +-----------------------------------------------------+
`);
    H('floor3/room307/cabinet/coat_pocket.txt', `A crumpled ticket stub.

  ROOTFALL TRANSIT — DOCK LINE
  ONE WAY   /home  -->  /dev
  Punched:  ${U.stamp(at(inc, 2, 41)).slice(0, 16)}

On the back, in your own handwriting, shaky:

  "if you find this: you are not crazy.
   something is erasing the city."
`);
    H('floor3/room301/bed.txt', 'An empty bed with the sheets tucked tight enough to bounce a coin.\nThe chart on the wall just says: DISCHARGED — MEMORY INTACT. LUCKY.\n');
    H('floor3/room302/bed.txt', 'An empty bed. Someone has left a half-finished crossword on the pillow.\nEvery answer has been erased.\n');
    H('floor3/room305/patient.txt', 'A large man snores with tremendous dedication.\nHis chart reads: "Forgot his own snoring. Remembers it nightly."\n');
    H('floor3/room309/mr_finch.txt', `Mr. Finch, eighty-two, sits by his window talking to the wall.

  "They took my Tuesdays," he says. "Every night, a little more.
   First the dates, then the names, then all my Tuesdays."

He turns to you, suddenly sharp-eyed.

  "You're the Operator. You fix things. Look under things,
   Operator. The important ones always start with a dot."

Then he goes back to the wall, and the wall, apparently,
has a lot to say.
`, { owner: 'finch', group: 'finch' });
    H('floor3/nurses_station/discharge_note.txt', `DISCHARGE — ${u}, Room 307
---------------------------------------------
You're free to go, but don't go far until you remember more.

1. Take the stairs down to the lobby: /hospital/lobby
   You're standing in /hospital/floor3/nurses_station.
   Two levels up (../..) gets you to /hospital, and from
   there into lobby. One command does it all:

       cd ../../lobby

2. Someone left something for you at the front desk.

                                            — Ines

P.S. The gentleman in 309 talks to the walls. Be kind.
`);
    H('floor3/nurses_station/shift_log.txt', `NIGHT SHIFT LOG — FLOOR 3
-------------------------
03:00  Lights flickered again. Fourth time this week.
03:01  309 (Finch) has lost his Tuesdays. Again.
03:12  ADMITTED: unknown citizen, found unconscious at the Void
       (/dev/null). Dock workers carried them up. Penguin attached.
03:15  Penguin will not leave. Penguin bit Dr. Halloran.
03:16  Penguin issued a visitor badge.
06:40  307 talking in sleep: "lethe", "the broom", "sdb".
`);
    F('/hospital/floor3/supply_closet/bandages.txt', 'Shelves of bandages, saline, and an unreasonable number of rubber gloves.\n', { owner: 'root', group: 'staff', mode: 0o640 });
    H('lobby/newspaper.txt', R`==================================================================
 THE ROOTFALL CHRONICLE                          * MORNING EDITION *
==================================================================
 THE FORGETTING STRIKES AGAIN — ${inc === 3 ? 'THIRD' : 'FOURTH'} NIGHT RUNNING
------------------------------------------------------------------
 At 03:00 last night the lights of Rootfall flickered, and once
 again the city woke up lighter. The bakery in Old Town lost every
 recipe. Three families in the Residential Quarter report entire
 memory folders gone. The Great Library's archive wing is now
 completely empty.

 The City Operator, who might have explained any of this, has not
 been seen since the first night of the Forgetting.

   "Things don't just vanish," says Chronicle editor Hal Mercer.
   "Somebody runs a command. Somebody always runs a command."

 CITY HALL advises citizens to keep backups and lock their doors.
------------------------------------------------------------------
 INSIDE: Night Market prices (p.3) · Lighthouse hours (p.6)
         Ask Mags: "How do I quit less?" (p.9)  [Answer: press q]
==================================================================
`, { owner: 'hal', group: 'hal' });
    H('lobby/front_desk/note_for_307.txt', `For the patient in 307 — urgent — from the Great Library.

I know who you are, even if you don't. Come to the Library as soon
as they let you out. The address is:

    /usr/share/doc

Use the full path. From anywhere in the city, a path that starts
with / takes you straight there, no matter where you're standing.

                                         — M. Fen, Librarian
`, { owner: 'mags', group: 'mags' });
    H('lobby/vending_machine.txt', 'A vending machine. OUT OF ORDER SINCE 1991.\nSomeone has taped a note to it: "have you tried turning it off and on again?"\nSomeone else has written underneath: "yes."\n');
    H('lobby/city_map.txt', R`             R O O T F A L L  —  A Visitor's Map
  ===================================================================
                                   /                 (the root)
        ___________________________|______________________________
       |       |       |      |     |      |      |      |      |
     /etc   /home   /usr   /var   /tmp   /dev  /proc  /mnt   /root
     City   Homes   Old    The    Night  The   Power  Under- The
     Hall           Town   Chron- Market Docks Stat-  croft  Spire
                     |     icle
                 /usr/share/doc  <- the Great Library
                 /usr/bin        <- the Toolsmiths
  ===================================================================
   St. Inode's Hospital is at /hospital (you are probably here).
`);
    H('floor1/waiting_room.txt', 'A television on the wall plays the news with the sound off.\nThe ticker reads: "...LIBRARY ARCHIVE EMPTY ... CITY HALL URGES BACKUPS ... OPERATOR STILL MISSING..."\n');
    H('floor2/cafeteria/menu.txt', "TODAY'S MENU\n  soup of the day ......... (forgotten)\n  fish ...................... reserved for the penguin\n");
    H('basement/boiler_room.txt', 'The boiler room hums. Pipes run off in every direction, the way pipes do.\nA sign says: "Everything flows somewhere. — Facilities"\n');
    H('basement/lost_and_found/umbrella.txt', 'A black umbrella. The tag says: "found in the Night Market. Owner forgot they owned it."\n');
    H('basement/lost_and_found/memory_01.txt', memoryTexts(u).memory_01, { owner: u, group: u, mode: 0o644, mtime: at(30, 9, 0) });

    /* ================= LIBRARY ================= */
    D('/usr/share/doc', { owner: 'mags', group: 'mags', pinned: true });
    const L = (p, c, o = {}) => F('/usr/share/doc/' + p, c, Object.assign({ owner: 'mags', group: 'mags', immutable: true }, o));
    L('welcome.txt', `THE GREAT LIBRARY OF ROOTFALL
=============================
Founded 1991. Librarian: Marguerite "Mags" Fen.

RULES
  1. Quiet, please. The books are thinking.
  2. Every tool in Rootfall has a manual. Read it: man <command>
  3. To leave a long page, press q. (Yes, always q.)
  4. Return your books. (This means you, Operator.)
`);
    const titles = ['A Brief History of Rootfall', 'The Kernel and You', 'Pipes: A Plumber\'s Guide', 'Seven Habits of Highly Effective Daemons', 'Permissions for the Perplexed', 'The Tao of Grep', 'Sed & Awk & You', 'Cron: Keeping Time', 'The Penguin Question', 'Paths Absolute and Relative', 'Living with Root', 'On the Void', 'A Field Guide to Processes', 'Bash Poetry Vol. I', 'Bash Poetry Vol. II', 'Signals and Their Meanings', 'Night Market Recipes', 'The Lighthouse Logs', 'Tar: Bundles for Beginners', 'Hidden Files and Where to Find Them', 'The Manual of Manuals', 'Ninety-Nine Ways to Exit Vim', 'The Environment, Explained', 'Redirection Without Tears', 'Scripts That Run Themselves', 'Networks: Talking to Strangers', 'Compression Folk Tales', 'The Filesystem Hierarchy Standard', 'Unix Koans', 'The Art of the One-Liner', 'Logs: The City\'s Diary', 'Mount and Unmount', 'Users and Groups', 'Shell Expansions Illustrated', 'Regular Expressions, Irregular Lives', 'The Sudoers Rite', 'Jobs, Foreground and Back', 'Checksums and Trust', 'SSH Keys: A Love Story', 'The Old Gate (/boot)', 'Sockets and Ports', 'DNS: Names for Numbers', 'Archive of the Archives', 'History of the Night Market', 'The Clockworks', 'Variables of Rootfall', 'Aliases and Their Dangers', 'Symlinks: Signposts of the City', 'Disk Usage for Hoarders', 'The Power Station', 'Text Streams', 'Exit Codes of the Heart', 'Quoting, Single and Double', 'The Undercroft', 'Globbing for Beginners', 'The Kernel Ring Buffer', 'Package Management', 'Diff and the Art of Noticing', 'Bea\'s Notes on Root'];
    let cat = 'GREAT LIBRARY — CATALOG\n#    TITLE                                          SHELF   STATUS\n';
    titles.forEach((t, i) => { cat += `${String(i + 1).padStart(3, '0')}  ${U.padR(t, 46)} ${String.fromCharCode(65 + (i % 8))}       ${i % 7 === 3 ? 'checked out' : 'available'}\n`; });
    cat += `060  ${U.padR('On Forgetting — by ' + u, 46)} OP      CHECKED OUT (never returned)\n`;
    L('catalog.txt', cat);
    L('rootfall_history.txt', R`A BRIEF HISTORY OF ROOTFALL
===========================
as kept by the Great Library, /usr/share/doc

I. THE FOUNDING

Rootfall was founded in 1991 by a student who wanted a city that
anyone could build, and anyone could take apart to see how it
worked. The first thing the founder built was the Kernel: the
great machine beneath the streets that every other building leans
on. The second thing the founder built was a joke. The third thing
was a penguin.

Historians disagree about the order.

II. THE ROOT

Every street in Rootfall begins at a single point called the root,
written simply as /. From the root the city branches out like a
tree turned upside down:

  /etc    City Hall. The name means "et cetera": in the early days
          every bit of paperwork that didn't fit anywhere else was
          shoved in here. Today it holds the city's configuration
          — who lives where, which services run, which doors open.
  /home   The Residential Quarter. Every citizen has a home here.
  /root   The Spire. Home of the root account, the one user whose
          word is law. Its door is locked to everyone else.
  /usr    Old Town. Despite the name it has little to do with
          users: it holds the city's shared tools (/usr/bin), its
          libraries, and its manuals (/usr/share).
  /var    The variable district, where things change every day:
          logs, mail, queues — and the Chronicle (/var/log).
  /tmp    The Night Market. Anyone may set up a stall; everything
          is swept away at dawn.
  /dev    The Docks, where the city meets its devices: disks,
          terminals, and the Void itself, /dev/null.
  /proc   The Power Station. Not built of stone at all: it is a
          living picture of every process running in the city.
  /mnt    The Undercroft. Spare disks are mounted down here.
  /opt    Optional extras. The guidebooks are unusually vague.
  /srv    Data served to the outside world.
  /boot   The Old Gate, through which the Kernel enters each dawn.

III. THE OPERATORS

Since the founding, one citizen at a time has served as City
Operator: keeper of the root keys, reader of logs, fixer of things
at four in the morning. A few night-shift operators keep watch
alongside them. Operators are not elected. They are simply the
people who stay up until it is fixed.

The first Operators wrote the manual pages that still fill this
library. The tradition holds: if you build a tool in Rootfall, you
write its manual. If you use a tool, you read it.

IV. THE PENGUIN

Every Operator has kept a penguin. Nobody remembers why. The
penguins do not explain themselves.

V. THE VOID

At the Docks lies /dev/null, called the Void. Whatever is written
into it vanishes; whatever is read from it is empty. Children are
told never to play near the Void. Operators are told the same, and
listen about as well.

VI. THE LIGHTHOUSE

Rootfall is a closed city. Its only window to the outside is the
Lighthouse, a separate machine at the edge of the network, kept by
a keeper who answers to nobody but the beam. Everything that comes
into Rootfall from beyond comes through the Lighthouse.

Everything.

VII. ON FORGETTING

The Library holds one book on the subject, written by the current
Operator. It has been checked out for seven years.

                          * * *

  "A city is just a filesystem that people love."
                                   — carved over the Library door
`);
    L('unlabeled', `(In your own handwriting.)

Note to self:
  If you ever lose your way, the Chronicle remembers everything.
  It lives at /var/log. Read the logs. Always read the logs.

P.S. return "On Forgetting" to Mags. It's been seven years.
`, { owner: u, group: u });
    D('/usr/share/doc/archive', { owner: 'mags', group: 'mags', immutable: true });
    D('/usr/share/doc/operator_manuals', { owner: 'mags', group: 'mags' });
    for (const [n, t] of Object.entries({ bash: 'GNU Bash — the shell you are talking to right now.\nStart with: man bash   (it is long; press q to quit)\n', coreutils: 'The core utilities: ls, cp, mv, rm, cat, head, tail, sort, wc, ...\nEach has a manual: man ls, man cp, ...\n', grep: 'grep searches text for patterns.\n"grep -r pattern dir" searches a whole directory tree.\n' })) {
      L(`operator_manuals/${n}/README`, t);
    }
    D('/usr/share/doc/poetry', { owner: 'mags', group: 'mags' });
    L('poetry/ode_to_the_pipe.txt', `ODE TO THE PIPE
---------------
O humble bar, so thin, so tall,
you join the small things, and the small
become a river: cat to grep,
grep to sort, and step by step
the flood of text, the city's roar,
is filtered down to one thing more:
the answer. Then we print it out,
and that is what it's all about.
`);
    L('poetry/haiku.txt', 'three things are certain:\ndeath, taxes, and lost data.\nguess which has occurred.\n\nthe file you seek\ncannot be located but\nendless others exist\n\nfirst snow, then silence.\nthis thousand-dollar screen dies\nso beautifully.\n');
    D('/usr/share/doc/.restricted_section', { owner: 'mags', group: 'mags', mode: 0o755, immutable: true });
    L('.restricted_section/forbidden_index.txt', `THE RESTRICTED SECTION — INDEX OF FORBIDDEN KNOWLEDGE
(If you are reading this, Mags let you. Or you know about ls -a.)

  * Old Town keeps a hidden arcade somewhere under /opt.
    Its games are run by path, not by name.
  * The Lighthouse website has a robots.txt. Robots are told
    where NOT to look. People are not robots.
  * In the oldest caves, adventurers said a magic word: xyzzy.
  * The penguin has his own DNS record. Ask for its TXT.
  * Real Operators know how to exit vim.
  * Never, ever run:  :(){ :|:& };:
  * ${LA.distro(w).eggHint}
`);
    L('.restricted_section/memory_02.txt', memoryTexts(u).memory_02, { owner: u, group: u, mtime: at(200, 4, 0) });
    D('/usr/share/man/man1');

    /* ================= CHRONICLE ================= */
    const lg = (p, c, o = {}) => F('/var/log/' + p, c, Object.assign({ owner: 'root', group: 'adm', mode: 0o640, mtime: LA.now() - 600000 }, o));
    lg('syslog', syslog(u, inc, w));
    lg('doors.log', doorsLog(u, inc), { mode: 0o644 });
    lg('auth.log', authLog(u, inc));
    lg('kern.log', `${U.syslogDate(w.bootTime)} rootfall kernel: Linux version 6.1.0-rootfall (operator@rootfall) #1 SMP PREEMPT_DYNAMIC 1991\n${U.syslogDate(w.bootTime)} rootfall kernel: Command line: BOOT_IMAGE=/boot/vmlinuz-6.1.0-rootfall root=/dev/sda1 ro quiet\n${U.syslogDate(at(inc, 2, 34, 50))} rootfall kernel: sd 2:0:0:0: [sdb] 4194304 512-byte logical blocks: (2.15 GB/2.00 GiB)\n${U.syslogDate(at(inc, 2, 34, 51))} rootfall kernel:  sdb: sdb1\n${U.syslogDate(at(inc, 2, 38, 10))} rootfall kernel: usb 2-1: USB disconnect, device number 2\n`);
    let lethe = '';
    for (let n = inc + 6; n >= 1; n--) {
      lethe += `${U.stamp(at(n, 3, 0))} lethe[451]: sweep started (SAFE_MODE=${n <= inc ? 'no' : 'yes'})\n`;
      lethe += `${U.stamp(at(n, 3, 0, 2))} lethe[451]: ${n <= inc ? 'quarantine=/dev/null — ' + (500 + n * 37) + ' files gone' : 'quarantine=/var/lethe/quarantine — 96 files kept'}\n`;
    }
    lg('lethe.log', lethe + '... (log continues: 48 MB of sweep details)\n', { mode: 0o644, size: 50331648 });
    const plog = LA.pkgLog(w, [{ at: at(12, 14, 2), pkg: 'lethe', version: '3.0.3-rootfall' }]);
    F(plog.path, plog.text, { owner: 'root', group: 'root', mode: 0o644, mtime: at(12, 14, 2) });
    lg('btmp', '', { mode: 0o600, group: 'utmp', format: 'wtmp', data: {} });
    D('/var/log/private', { mode: 0o700 });
    F('/var/log/private/sealed.txt', 'Sealed by order of the Operator.\n', { mode: 0o600 });
    D('/var/log/journal', { mode: 0o2755, group: 'systemd-journal' });
    D('/var/log/chronicle', { owner: 'hal', group: 'hal', mode: 0o755 });
    const C = (p, c, o = {}) => F('/var/log/chronicle/' + p, c, Object.assign({ owner: 'hal', group: 'hal', mode: 0o644 }, o));
    C('README', 'THE ROOTFALL CHRONICLE — newsroom files\n  editions/   past front pages\n  tips/       anonymous tips (unverified!)\n  archive/    the old archive (what is left of it)\n  suspects.txt\n');
    for (let n = inc; n >= 1; n--) C(`editions/${ymd(at(n, 6, 0))}.txt`, `THE ROOTFALL CHRONICLE — ${ymd(at(n, 6, 0))}\n\n${n === inc ? 'OPERATOR MISSING. Lights flicker at 03:00. Library archive loses three shelves.' : n === 1 ? 'THE FORGETTING CONTINUES. Library archive now empty. Families report memory folders gone.' : 'SECOND NIGHT OF FORGETTING. Bakery loses recipes. City Hall baffled.'}\n`, { mtime: at(n, 6, 0) });
    C('tips/shouting.txt', 'TO THE EDITOR:\nTHE ONE WHO CALLS HIMSELF HOLLOW COMES IN THROUGH THE LIGHTHOUSE.\nHE CARRIES A COPY OF THE KEEPER\'S KEY.\nCHECK WHO IS ALLOWED IN.\n— A FRIEND\n');
    C('tips/cipher.txt', rot13('To the editor:\nThe Operator kept BACKUPS beneath the city, in the Undercroft.\nThe disk is called sdb. Nobody has mounted it since.\n- a friend\n'));
    C('tips/mirror.txt', revLines('To the editor, and to you, Operator:\nYour door was locked from the outside.\nBut it is still YOUR door. You own it.\nOwners can always change the lock.\n- M.'));
    C('suspects.txt', 'hollow\nunknown\nthe wind\nhollow\nthe baker (no — he lost his recipes too)\nhollow\n');
    for (const [n, k] of [['1992', 41], ['1995', 120], ['1999', 77], ['2004', 13], ['2013', 58]]) {
      let s = '';
      for (let i = 1; i <= k; i++) s += `edition ${n}-${String(i).padStart(3, '0')}: [page faded]\n`;
      C(`archive/${n}.old`, s, { mtime: at(1000, 9, 0) });
    }
    C('archive/README', 'The old editions. Lethe took most of the rest.\n');

    /* other /var */
    D('/var/lethe/quarantine', { mode: 0o700 });
    const spool = LA.cronSpool(w);
    D(spool, spool === '/var/spool/cron' ? { mode: 0o700, immutable: true } : { mode: 0o1730, group: 'crontab', immutable: true });
    F(`${spool}/${u}`, `# DO NOT EDIT THIS FILE - edit the master and reinstall.\n# m h  dom mon dow   command\n0 6 * * * /home/${u}/scripts/backup.sh >/dev/null 2>&1\n`, { owner: u, group: 'crontab', mode: 0o600, mtime: T(30) });
    F(spool + '/hollow', `# DO NOT EDIT THIS FILE - edit the master and reinstall.\n# (Cron version -- $Id: crontab.c,v 2.13 1994/01/17 03:20:37 vixie Exp $)\n# m h  dom mon dow   command\n58 2 * * * sudo -n /usr/bin/systemctl start lethe\n*/5 * * * * /tmp/.hollow/beacon --phone-home 10.0.0.66\n`, { owner: 'hollow', group: 'crontab', mode: 0o600, mtime: at(inc, 1, 58) });
    D('/var/.hollow', { owner: 'hollow', group: 'hollow', mode: 0o700, mtime: at(inc, 1, 47) });
    F('/var/.hollow/.bash_history', 'cd /etc/lethe\nnano lethe.conf\ncrontab -e\nchmod 000 /home/' + u + '\nchown root:root /home/' + u + '/diary.txt\n', { owner: 'hollow', group: 'hollow', mode: 0o600 });
    D('/var/lib/powerstation', { owner: 'juno', group: 'juno' });
    F('/var/lib/powerstation/README', 'POWER STATION — Juno Reyes, chief engineer.\nThe real station is /proc. This is just where I keep my thermos.\n', { owner: 'juno', group: 'juno' });
    D(plog.dir); D('/var/cache/man'); D('/var/www', { owner: 'www-data', group: 'www-data' });
    F('/var/mail/' + u, `From wren@lighthouse  ${U.dateString(new Date(at(inc, 2, 31, 7))).replace(' RFT', '')}
Received: from lighthouse (lighthouse.rootfall [10.0.0.2])
X-Originating-IP: 10.0.0.66
From: Wren Alcott <wren@lighthouse>
To: ${u}@rootfall
Subject: (no subject)

I know who Hollow is. The Docks, 02:50.
Come alone. He reads everything.

From mara@rootfall  ${U.dateString(new Date(at(0, 7, 30))).replace(' RFT', '')}
From: Mara Quill <mara@rootfall>
To: ${u}@rootfall
Subject: if you're reading this, you're home

You're home. Good. I knew you'd find the way.
Read your .bash_history. You always said history is the truest diary.

- M.
`, { owner: u, group: 'mail', mode: 0o600 });

    /* ================= NIGHT MARKET ================= */
    F('/tmp/notice_board.txt', `THE NIGHT MARKET  —  by order of nobody in particular
=====================================================
 * Anyone may set up a stall here. /tmp belongs to everyone.
 * You may not touch another trader's stall (the sticky bit
   on /tmp sees to that — look for the 't' in drwxrwxrwt).
 * Every night at 03:00 the sweeper (Lethe) clears /tmp.
   Only the market's own fixtures — this board and Ingrid's
   stall — are on its exclusion list. Don't keep anything
   precious here.
 * /var/tmp is not swept at night. It is still temporary
   storage, not a vault: anything you mean to keep belongs
   at home, with a backup.
`, { owner: 'ingrid', group: 'ingrid', mtime: T(2) });
    D('/tmp/ingrid_stall', { owner: 'ingrid', group: 'ingrid', mode: 0o755 });
    F('/tmp/ingrid_stall/map.txt', R`ROOTFALL — POCKET MAP (Ingrid's Night Market edition)

  /hospital ........ St. Inode's (you came from here)
  /usr/share/doc ... the Great Library (Mags)
  /var/log ......... the Chronicle (Hal)
  /etc ............. City Hall (Osei) — opens at dawn
  /home ............ the Residential Quarter
  /proc ............ the Power Station (Juno)
  /mnt ............. the Undercroft (down the stairs, mind your head)
  /dev ............. the Docks. Stay away from the Void.
  /tmp ............. you are here. Buy something.
`, { owner: 'ingrid', group: 'ingrid' });
    F('/tmp/ingrid_stall/wares.txt', "INGRID'S WARES\n  lanterns ............ 2 forgotten things each\n  maps ................ free for Operators\n  fish ................ for penguins only\n  copies of keys ...... NOT SOLD HERE (anymore)\n", { owner: 'ingrid', group: 'ingrid' });
    F('/tmp/ingrid_stall/sign.txt', "INGRID'S — OPEN UNTIL DAWN — NO REFUNDS ON MEMORIES\n", { owner: 'ingrid', group: 'ingrid' });
    D('/tmp/.hollow', { owner: 'hollow', group: 'hollow', mode: 0o700, mtime: at(inc, 2, 3) });
    F('/tmp/.hollow/beacon', '', { format: 'elf', data: { cmd: 'beacon' }, owner: 'hollow', group: 'hollow', mode: 0o700, mtime: at(inc, 2, 3) });
    F('/tmp/.hollow/notes.txt', "the operator is asleep in room 307.\nthe penguin bit me.\n", { owner: 'hollow', group: 'hollow', mode: 0o600, mtime: at(inc - 1, 4, 0) });

    /* ================= CITY HALL (/etc) ================= */
    const E = (p, c, o = {}) => F('/etc/' + p, c, Object.assign({ mtime: old }, o));
    E('passwd', ''); E('group', ''); E('shadow', '', { mode: 0o640, group: 'shadow' });
    E('hostname', 'rootfall\n');
    E('hosts', '127.0.0.1\tlocalhost\n127.0.1.1\trootfall\n10.0.0.1\tgateway\n10.0.0.2\tlighthouse lighthouse.rootfall\n\n# The following lines are desirable for IPv6 capable hosts\n::1     localhost ip6-localhost ip6-loopback\n');
    E('resolv.conf', 'nameserver 10.0.0.1\nsearch rootfall\n');
    E('motd', `\nWelcome to Rootfall GNU/Linux 1991.\nThe programs included with Rootfall are free software;\nthe exact distribution terms for each program are described in the\nindividual files in /usr/share/doc/*/copyright.\n\n`);
    E('issue', 'Rootfall GNU/Linux 1991 \\n \\l\n\n');
    fs.link('/etc/os-release', '../usr/lib/os-release');
    E('fstab', '# /etc/fstab: static file system information.\n#\n# <file system>  <mount point>  <type>  <options>          <dump>  <pass>\n/dev/sda1        /              ext4    errors=remount-ro  0       1\n/dev/sda2        none           swap    sw                 0       0\n# the Undercroft (backup disk) — mount by hand:\n#   sudo mount /dev/sdb1 /mnt/backup\n/dev/sdb1        /mnt/backup    ext4    noauto             0       2\n');
    E('crontab', '# /etc/crontab: system-wide crontab\nSHELL=/bin/sh\nPATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin\n\n# m h dom mon dow user  command\n17 *  * * *  root  cd / && run-parts --report /etc/cron.hourly\n25 6  * * *  root  test -x /usr/sbin/anacron || run-parts --report /etc/cron.daily\n');
    D('/etc/cron.d'); D('/etc/cron.daily'); D('/etc/cron.hourly');
    E('cron.d/e2scrub_all', '30 3 * * 0 root test -e /run/systemd/system || SERVICE_MODE=1 /usr/lib/x86_64-linux-gnu/e2fsprogs/e2scrub_all_cron\n');
    E('cron.daily/logrotate', '#!/bin/sh\n# skip in favour of systemd timer\nexit 0\n', { mode: 0o755 });
    E('systemd/system/lethe.service', `[Unit]
Description=Lethe nightly memory sweeper
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/lethe --daemon --conf /etc/lethe/lethe.conf
Restart=always
RestartSec=1
User=root

[Install]
WantedBy=multi-user.target
`, { mtime: T(12) });
    D('/etc/systemd/system/multi-user.target.wants');
    fs.link('/etc/systemd/system/multi-user.target.wants/lethe.service', '/etc/systemd/system/lethe.service');
    D('/etc/lethe');
    E('lethe/lethe.conf', LA.letheConf(u, false), { mtime: at(inc, 1, 55, 40) });
    E('ssh/sshd_config', '# Rootfall sshd configuration\nPort 22\nPermitRootLogin no\nPubkeyAuthentication yes\nPasswordAuthentication yes\nAuthorizedKeysFile .ssh/authorized_keys\n');
    E('bash.bashrc', '# System-wide .bashrc file for interactive bash(1) shells.\n[ -z "$PS1" ] && return\nshopt -s checkwinsize\n');
    E('profile', '# /etc/profile: system-wide .profile file for the Bourne shell\nif [ "$(id -u)" -eq 0 ]; then\n  PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"\nelse\n  PATH="/usr/local/bin:/usr/bin:/bin:/usr/games"\nfi\nexport PATH\n');
    for (const [p, c] of Object.entries(LA.repoFiles(w, 'mirror.lighthouse.rootfall', 'security.lighthouse.rootfall'))) F(p, c, { mtime: old });
    E('sudoers', '# /etc/sudoers\nDefaults\tenv_reset\nDefaults\tsecure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"\nroot\tALL=(ALL:ALL) ALL\n' + LA.sudoersAdmin(w) + '\n# drop-in rules, one file each\n@includedir /etc/sudoers.d\n', { mode: 0o440 });
    D('/etc/sudoers.d', { mode: 0o750 });
    E('sudoers.d/README', '# Files in this directory are read by sudo as extra rules.\n# Keep them few, small and documented.\n', { mode: 0o440 });
    /* how Hollow's ordinary cron job could start a system service: a planted, narrow, passwordless rule */
    E('sudoers.d/90-lethe-watchdog', '# lethe watchdog — restart the sweeper if it dies\nhollow ALL=(root) NOPASSWD: /usr/bin/systemctl start lethe\n', { mode: 0o440, mtime: at(inc, 1, 58) });
    E('shells', '# /etc/shells: valid login shells\n/bin/sh\n/bin/bash\n/usr/bin/bash\n');
    E('timezone', 'Rootfall/Standard\n');
    D('/etc/city', { owner: 'osei', group: 'osei' });
    const CH = (p, c, o = {}) => F('/etc/city/' + p, c, Object.assign({ owner: 'osei', group: 'osei', mode: 0o644 }, o));
    const permits = [
      ['0001', 'cron', 'root', 'APPROVED'], ['0002', 'sshd', 'root', 'APPROVED'], ['0003', 'rsyslogd', 'root', 'APPROVED'],
      ['0017', 'bakery-oven-timer', 'baker', 'APPROVED'], ['0042', 'lighthouse-beam', 'wren', 'APPROVED'], ['0088', 'library-indexer', 'mags', 'APPROVED'],
      ['0101', 'chronicle-press', 'hal', 'APPROVED'], ['0128', 'market-lanterns', 'ingrid', 'APPROVED'], ['0256', 'powerstation-monitor', 'juno', 'APPROVED'],
      ['0311', 'hospital-heartbeat', 'ines', 'APPROVED'], ['0404', 'lost-and-found', 'ines', 'DENIED (could not find it)'],
      ['0451', 'Lethe nightly sweeper', u, 'APPROVED  (sweep /tmp only; SAFE_MODE required)'],
      ['0500', 'tux-feeder', u, 'APPROVED  (fish, twice daily)'], ['0512', 'chess-clock', 'finch', 'PENDING'],
      ['0451-B', 'LETHE amendment: expand TARGETS', 'hollow', 'NOT REVIEWED — filed after hours'],
    ];
    let pt = 'ROOTFALL CITY HALL — DAEMON PERMITS REGISTER\n============================================\n';
    for (const [n, what, who, st] of permits) pt += `${n.includes('-') ? 'AMENDMENT' : 'PERMIT   '} ${U.padR(n, 7)} ${U.padR(what, 34)} filed by: ${U.padR(who, 10)} ${st}\n`;
    CH('permits.txt', pt);
    const vis = [];
    const vr = U.rng(7);
    const names = ['mags', 'hal', 'ines', 'ingrid', 'juno', 'mara', 'finch', 'wren', 'baker'];
    for (let i = 0; i < 30; i++) vis.push(names[Math.floor(vr() * names.length)]);
    for (let i = 0; i < 7; i++) vis.splice(Math.floor(vr() * vis.length), 0, 'hollow');
    CH('visitors.log', vis.join('\n') + '\n');
    CH('census.csv', 'name,district,occupation,uid\nmara,/home,operator (night shift),1001\nines,/hospital,nurse,1002\nmags,/usr/share/doc,librarian,1003\nhal,/var/log,editor,1004\nosei,/etc,clerk,1005\ningrid,/tmp,trader,1006\njuno,/proc,engineer,1007\nfinch,/hospital,retired (chess),1008\n' + u + ',/home,City Operator,1000\n');
    CH('notices.txt', 'CITY HALL NOTICES\n  * Keep backups.\n  * Lock your doors (chmod is your friend).\n  * Report unknown accounts to the clerk.\n');
    D('/etc/city/desk', { owner: u, group: u, mode: 0o755 });
    CH('desk/README', 'A spare desk, lent to the Operator by Osei. Write whatever you like here.\n', { owner: u, group: u });

    /* ================= HOMES ================= */
    D('/home/mara', { owner: 'mara', group: 'mara', mode: 0o750 });
    F('/home/mara/letter_to_you.txt', 'If you can read this, you are in my group, and I trust you.\n', { owner: 'mara', group: 'mara', mode: 0o640 });
    D('/home/guest', { mode: 0o755 });
    F('/home/guest/welcome.txt', 'Guest quarters. Make yourself at home — but not too at home.\n');
    const home = '/home/' + u;
    D(home, { owner: u, group: u, mode: 0o000, mtime: at(inc, 2, 58, 13) });
    const Y = (p, c, o = {}) => F(home + '/' + p, c, Object.assign({ owner: u, group: u, mode: 0o644, mtime: T(4) }, o));
    Y('.bashrc', R`# ~/.bashrc: executed by bash(1) for non-login shells.

# If not running interactively, don't do anything
case $- in
    *i*) ;;
      *) return;;
esac

HISTCONTROL=ignoreboth
HISTSIZE=1000

# a colourful prompt
PS1='${LA.distroPS1(w.distro)}'

# aliases
alias ls='ls --color=auto'
alias grep='grep --color=auto'
alias la='ls -A'

# --- added ${U.strftime('%H:%M', new Date(at(inc, 2, 58)))} ---
alias cat='echo "nothing to remember."'
`, { mtime: at(inc, 2, 58, 20) });
    Y('.profile', '# ~/.profile: executed by the command interpreter for login shells.\nif [ -n "$BASH_VERSION" ]; then\n    if [ -f "$HOME/.bashrc" ]; then\n        . "$HOME/.bashrc"\n    fi\nfi\nif [ -d "$HOME/bin" ] ; then\n    PATH="$HOME/bin:$PATH"\nfi\n');
    Y('.bash_logout', '# ~/.bash_logout: executed by bash(1) when login shell exits.\nclear\n');
    Y('.bash_history', `ls -la
cd /etc/lethe
cat lethe.conf
last ${u}
grep hollow /var/log/auth.log
sudo systemctl stop lethe
systemctl status lethe
grep -r lethe /etc/cron.d /etc/crontab
cat /var/mail/${u}
ssh wren@lighthouse
who
sudo mount /dev/sdb1 /mnt/backup
cd ~
tar -czvf /mnt/backup/memories.tar.gz memories/
sha256sum /mnt/backup/memories.tar.gz
sudo umount /mnt/backup
echo "the cron fires at three" > /tmp/frag_a.mem
cd /dev
ls -l null
echo "going to the docks. if i don't come back: start with pwd."
`, { mode: 0o600, mtime: at(inc, 2, 41) });
    D(home + '/.ssh', { owner: u, group: u, mode: 0o700 });
    Y('.ssh/id_ed25519', '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\nQyNTUxOQAAACDqd6+LdKyt8hdK0dH2tWtQtcmkPJmdsF5PbwexyxL7HgAAAJgRb290ZmFs\nbAAAAAtzc2gtZWQyNTUxOQAAACDqd6+LdKyt8hdK0dH2tWtQtcmkPJmdsF5PbwexyxL7Hg\nAAAEBUWF9UdXgxOTkxX2RvbnRfc2hhcmVfbWVfZXZlcl9vcGVyYXRvcg==\n-----END OPENSSH PRIVATE KEY-----\n', { mode: 0o600, mtime: T(300) });
    Y('.ssh/id_ed25519.pub', KEY_YOU(u) + '\n', { mtime: T(300) });
    Y('.ssh/authorized_keys', KEY_YOU(u) + '\n' + KEY_HOLLOW + '\n', { mode: 0o600, mtime: at(inc, 1, 45, 10) });
    Y('diary.txt', `DIARY — PRIVATE. (Yes, Mara, that means you.)

${ymd(at(12, 9, 0))}
Permit 0451 approved. Lethe goes live tonight. SAFE_MODE=yes.
Osei used the big stamp.

${ymd(at(9, 9, 0))}
Hollow again — 10.0.0.66. This time he logged in to the Lighthouse
AS WREN, with her key. Wren swears it never left the building.
Somebody copied it. I told her to make a new keypair. She said she
would, "after the weekend".

${ymd(at(inc, 2, 20))}, 02:20
Everything's wrong. lethe.conf has been rewritten — and the change
traces back to MY account. He has my password. Of course he does:
tux1991. Anyone who knows me could guess it. Bea would be so
disappointed. He's pointed Lethe at people's homes.

02:22
Stopped it: sudo systemctl stop lethe. Status says inactive (dead).
Checked /etc/cron.d and /etc/crontab — nothing that starts it.
Tomorrow: fix the config properly, find out how he gets back in.

02:31
Mail from Wren's account. "The Docks, 02:50. Come alone." It doesn't
sound like her at all. But if she's in trouble...

If I disappear:
  - my .bash_history knows exactly what I did tonight
  - the backups are in the Undercroft (sdb1, mount it at /mnt/backup)
  - Tux knows the way home
`, { owner: 'root', group: 'root', mode: 0o000, mtime: at(inc, 2, 20) });
    Y('sticky_note.txt', R`   __________________________________
  |                                  |
  |  sudo password hint:             |
  |                                  |
  |    the one who never leaves my   |
  |    side  +  the year Rootfall    |
  |    was founded                   |
  |                                  |
  |    all lowercase, no spaces      |
  |__________________________________|
`, { mtime: T(200) });
    Y('memory_04.txt', memoryTexts(u).memory_04, { mtime: T(365) });
    D(home + '/notes', { owner: u, group: u, mode: 0o700 });
    Y('notes/todo.txt', `TODO
[x] lethe 3.0 — permit 0451
[x] nightly backups to the Undercroft (cron, 06:00)
[ ] find out who sold Wren's key at the Night Market
[ ] change my password (Mara keeps nagging)        <-- !!!
[ ] return "On Forgetting" to Mags
[ ] buy fish (Tux)
`);
    Y('notes/lethe_design.txt', `LETHE 3.0 — DESIGN NOTES
------------------------
Purpose: sweep /tmp nightly, quarantine anything owned by WATCH_USER.
Rules:
  * SAFE_MODE=yes ALWAYS (move, never delete)
  * TARGETS=/tmp/* and nothing else
  * QUARANTINE=/var/lethe/quarantine (never /dev/null!)
  * keep a clean copy of the config somewhere safe (Wren has one)
`);
    D(home + '/scripts', { owner: u, group: u, mode: 0o755 });
    Y('scripts/README', 'My scripts. backup.sh runs from cron at 06:00.\nrestore.sh is unfinished — it should rebuild memory fragments into one file.\n');
    Y('scripts/backup.sh', `#!/bin/bash
# backup.sh - nightly backup of my memories to the Undercroft
# run by cron at 06:00
set -e
mount | grep -q /mnt/backup || exit 0
tar -czf /mnt/backup/memories.tar.gz -C "$HOME" memories
cd /mnt/backup && sha256sum memories.tar.gz tux.png > SHA256SUMS
`, { mode: 0o755, mtime: T(20) });
    Y('scripts/restore.sh', `#!/bin/bash
# restore.sh - reassemble memory fragments into a single file
# usage: ./restore.sh <fragments_dir> <output_file>

SRC=$1
OUT=$2

if [ -z "$SRC" ] || [ -z "$OUT" ]; then
    echo "usage: $0 <fragments_dir> <output_file>"
    exit 1
fi

echo "=== restored memories ===" > "$OUT"

# TODO: loop over every .mem file in $SRC
#       and append (>>) each one's contents to $OUT

# TODO: print how many fragments were restored

echo "done."
`, { mtime: at(inc + 1, 23, 10) });
    D(home + '/photos', { owner: u, group: u, mode: 0o755 });
    Y('photos/tux_and_me.txt', R`  +------------------------------------------+
  |                                          |
  |        o          .--.                   |
  |       /|\        |o_o |                  |
  |       / \        |:_/ |                  |
  |                 //   \ \                 |
  |                (|     | )                |
  |               /'\_   _/'\                |
  |               \___)=(___/                |
  |                                          |
  |   "the Docks, the day we met (he bit me)"|
  +------------------------------------------+
`, { mtime: T(900) });
    D(home + '/inbox', { owner: u, group: u, mode: 0o755 });

    /* ================= SPIRE / OPT / SRV / MNT ================= */
    F('/root/bea_card.txt', memoryTexts(u).bea_card, { mode: 0o600, mtime: T(900) });
    F('/root/.bashrc', `# root .bashrc\nPS1='${LA.distroPS1(w.distro, true)}'\n`, { mode: 0o644 });
    F('/root/.bash_history', 'apt update\napt upgrade\n# - bea\n', { mode: 0o600 });
    D('/opt/.arcade', { mode: 0o755 });
    F('/opt/.arcade/README.txt', R`   _   ___  ___   _   ___  ___
  /_\ | _ \/ __| /_\ |   \| __|
 / _ \|   / (__ / _ \| |) | _|
/_/ \_\_|_\\___/_/ \_\___/|___|

The Old Town Arcade. Est. 1991. Hidden since 1992 (noise complaints).

The machines here are not in anyone's PATH. Run them by path:
    ./bin/sl        (a train, for people who mistype ls)
    ./bin/cowsay    (a cow, for people who need a cow)
    ./bin/fortune   (wisdom, of a sort)

High scores are in high_scores.txt. Tux holds every one of them.
`);
    D('/opt/.arcade/bin', { mode: 0o755 });
    for (const g of ['sl', 'cowsay', 'fortune']) F('/opt/.arcade/bin/' + g, '', { format: 'elf', data: { cmd: g }, mode: 0o755 });
    F('/opt/.arcade/high_scores.txt', 'PAC-PENGUIN   TUX   999999\nSPACE PIPES   TUX   999998\nGREPTRIS      TUX   999997\nDOOMSCROLL    MARA       12\n');
    F('/opt/.arcade/memory_03.txt', memoryTexts(u).memory_03, { owner: u, group: u, mtime: at(1200, 9, 0) });
    F('/srv/README.txt', 'The Lighthouse is not in this city. It is a separate machine at\n10.0.0.2 (lighthouse.rootfall). You cannot cd there.\nYou have to connect:   ssh wren@lighthouse\n');
    D('/mnt/backup', { mode: 0o755, pinned: true });

    /* ================= UNDERCROFT DEVICE (sdb1) ================= */
    const bu = new LA.Node('dir', 'backup', { owner: u, group: u, mode: 0o755, mtime: at(inc, 2, 35) });
    const bfs = new LA.VFS(bu, users);
    bfs.dir('/lost+found', { mode: 0o700, mtime: old });
    const memEntries = [{ path: 'memories/', type: 'dir', mode: 0o755, owner: u, group: u, mtime: at(inc, 2, 34) }];
    const mt = memoryTexts(u);
    for (const k of ['memory_05', 'memory_06', 'memory_07', 'memory_08']) memEntries.push({ path: `memories/${k}.txt`, type: 'file', mode: 0o644, owner: u, group: u, mtime: at(inc, 2, 30), content: mt[k] });
    memEntries.push({ path: 'memories/remember_this.txt', type: 'file', mode: 0o644, owner: u, group: u, mtime: at(inc, 2, 33), content: 'Four memories. The rest are scattered around the city.\nfind / -name "memory_*" will show you where. Some doors are locked;\nroot opens the last one. — you\n' });
    const tarGz = { format: 'gzip', data: { name: 'memories.tar', inner: { format: 'tar', data: { entries: memEntries } } } };
    const tgzNode = bfs.put('/memories.tar.gz', '', { owner: u, group: u, mode: 0o644, mtime: at(inc, 2, 35), format: 'gzip', data: tarGz.data });
    const pngNode = bfs.put('/tux.png', '', { owner: u, group: u, mode: 0o644, mtime: T(900), format: 'png', data: { img: 'tux-on-radiator' }, size: 48213 });
    bfs.put('/SHA256SUMS', `${U.sha256(LA.hashContent(tgzNode, bfs))}  memories.tar.gz\n${U.sha256(LA.hashContent(pngNode, bfs))}  tux.png\n`, { owner: u, group: u, mode: 0o644, mtime: at(inc, 2, 35, 30) });
    bfs.put('/README.txt', `THE UNDERCROFT — backup disk of the City Operator
------------------------------------------------
If found: this belongs to ${u}. If you ARE ${u}: welcome back.

  memories.tar.gz   your memories, packed tight (tar + gzip)
  tux.png           a photo of Tux. obviously.
  SHA256SUMS        checksums. VERIFY BEFORE YOU TRUST ANYTHING:
                       sha256sum -c SHA256SUMS
`, { owner: u, group: u, mode: 0o644, mtime: T(40) });
    /* not attached: Juno has kept the disk in a drawer since that night (plugged back in in chapter 9) */
    w.devices.unplugged_backup = bu;

    w.disks = [
      { name: 'sda', majmin: '8:0', rm: '0', size: '20G', parts: [
        { name: 'sda1', majmin: '8:1', size: '19G', fstype: 'ext4', uuid: '1991f00d-cafe-4b1d-9e55-00000000r00t', fixedMount: '/' },
        { name: 'sda2', majmin: '8:2', size: '1G', fstype: 'swap', uuid: 'a5a5a5a5-0000-4000-8000-5a5a5a5a5a5a', fixedMount: '[SWAP]' },
      ] },
    ];
    w.mounts = [
      { dev: '/dev/sda1', path: '/', type: 'ext4', opts: 'rw,relatime,errors=remount-ro' },
      { dev: 'proc', path: '/proc', type: 'proc', opts: 'rw,nosuid,nodev,noexec,relatime' },
      { dev: 'sysfs', path: '/sys', type: 'sysfs', opts: 'rw,nosuid,nodev,noexec,relatime' },
      { dev: 'udev', path: '/dev', type: 'devtmpfs', opts: 'rw,nosuid,relatime,size=1003456k,mode=755' },
      { dev: 'tmpfs', path: '/run', type: 'tmpfs', opts: 'rw,nosuid,nodev,noexec,relatime,size=203448k,mode=755' },
      { dev: 'tmpfs', path: '/tmp', type: 'tmpfs', opts: 'rw,nosuid,nodev' },
    ];
    w.dmesg = [
      { s: 0, msg: `Linux version 6.1.0-rootfall (operator@rootfall) (${LA.distro(w).gcc}) #1 SMP PREEMPT_DYNAMIC 1991` },
      { s: 0, msg: 'Command line: BOOT_IMAGE=/boot/vmlinuz-6.1.0-rootfall root=/dev/sda1 ro quiet' },
      { s: 0.004, msg: 'x86/fpu: Supporting XSAVE feature 0x001: \'x87 floating point registers\'' },
      { s: 0.213, msg: 'Memory: 2034688K available' },
      { s: 1.044, msg: 'sd 0:0:0:0: [sda] 41943040 512-byte logical blocks: (21.5 GB/20.0 GiB)' },
      { s: 1.051, msg: ' sda: sda1 sda2' },
      { s: 2.881, msg: 'EXT4-fs (sda1): mounted filesystem with ordered data mode. Quota mode: none.' },
      { s: 4.120, msg: 'e1000 0000:00:03.0 eth0: (PCI:33MHz:32-bit) 52:54:00:1f:91:07' },
      { s: 4.200, msg: 'IPv6: ADDRCONF(NETDEV_CHANGE): eth0: link becomes ready' },
      { s: (at(inc, 3, 0) - w.bootTime) / 1000, msg: 'lethe: sweep: 1402 inodes released to /dev/null' },
    ];

    /* ================= PROCESSES / SERVICES ================= */
    const P = (o) => w.spawn(Object.assign({ start: w.bootTime + 2000, host: 'rootfall' }, o));
    P({ pid: 1, ppid: 0, user: 'root', comm: 'systemd', args: '/sbin/init', stat: 'Ss', cpu: 0, mem: 0.6, vsz: 167744, rss: 11892, cputime: 4 });
    P({ pid: 2, ppid: 0, user: 'root', comm: 'kthreadd', args: '[kthreadd]', stat: 'S', vsz: 0, rss: 0 });
    P({ pid: 3, ppid: 2, user: 'root', comm: 'rcu_gp', args: '[rcu_gp]', stat: 'I<', vsz: 0, rss: 0 });
    P({ pid: 13, ppid: 2, user: 'root', comm: 'ksoftirqd/0', args: '[ksoftirqd/0]', stat: 'S', vsz: 0, rss: 0 });
    P({ pid: 41, ppid: 2, user: 'root', comm: 'kworker/0:2-events', args: '[kworker/0:2-events]', stat: 'I', vsz: 0, rss: 0 });
    P({ pid: 180, user: 'root', comm: 'systemd-journal', args: '/lib/systemd/systemd-journald', stat: 'Ss', mem: 0.9, vsz: 49260, rss: 17512, service: 'systemd-journald' });
    P({ pid: 205, user: 'root', comm: 'systemd-udevd', args: '/lib/systemd/systemd-udevd', stat: 'Ss', vsz: 25632, rss: 6320 });
    P({ pid: 290, user: 'root', comm: 'dhclient', args: '/sbin/dhclient -4 -v -i -pf /run/dhclient.eth0.pid eth0', stat: 'Ss', vsz: 7600, rss: 2400 });
    P({ pid: 312, user: 'root', comm: DM.cron.comm, args: DM.cron.exec, stat: 'Ss', vsz: 6684, rss: 2760, service: DM.cron.unit });
    P({ pid: 340, user: 'root', comm: 'sshd', args: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups', stat: 'Ss', vsz: 15428, rss: 9216, service: DM.ssh.unit });
    P({ pid: 401, user: 'syslog', comm: 'rsyslogd', args: '/usr/sbin/rsyslogd -n -iNONE', stat: 'Ssl', vsz: 222400, rss: 5888, service: 'rsyslog' });
    P({ pid: 455, user: 'root', comm: 'agetty', args: '/sbin/agetty -o -p -- \\u --noclear - linux', tty: 'tty1', stat: 'Ss+', vsz: 5880, rss: 1960 });
    P({ pid: 511, user: 'root', comm: 'sshd', args: 'sshd: mara [priv]', stat: 'Ss', vsz: 17200, rss: 10900, start: LA.now() - 3 * 3600000 });
    P({ pid: 512, ppid: 511, user: 'mara', comm: 'bash', args: '-bash', tty: 'pts/0', stat: 'Ss+', vsz: 8380, rss: 5200, start: LA.now() - 3 * 3600000 });
    P({ pid: 451, user: 'root', comm: 'lethe', args: '/usr/bin/lethe --daemon --conf /etc/lethe/lethe.conf', stat: 'Ss', cpu: 2.3, mem: 2.4, vsz: 98112, rss: 49260, start: at(inc, 2, 58, 1), cputime: 8021, service: 'lethe', onKill: 'serviceDied' });
    const hstart = LA.now() - 2 * 3600000 - 17 * 60000;
    P({ pid: 1336, user: 'root', comm: 'sshd', args: 'sshd: hollow [priv]', stat: 'Ss', vsz: 17200, rss: 10800, start: hstart });
    P({ pid: 1337, ppid: 1336, user: 'hollow', comm: 'bash', args: '-bash', tty: 'pts/3', stat: 'Ss+', vsz: 8380, rss: 5100, start: hstart, ignoreTERM: true, onKill: 'hollowShellDied' });
    P({ pid: 1338, ppid: 1, user: 'hollow', comm: 'beacon', args: '/tmp/.hollow/beacon --phone-home 10.0.0.66', stat: 'S', cpu: 0.7, mem: 0.3, vsz: 4400, rss: 1800, start: at(inc, 2, 3), cputime: 300, onKill: 'socketOwnerDied', environ: 'HOME=/var/.hollow\u0000USER=hollow\u0000MISSION=forget-them-all\u0000' });
    P({ pid: 4040, ppid: 1, user: 'hollow', comm: 'kw0rker', args: '[kworker/u4:2-events]', stat: 'S', cpu: 0.4, mem: 0.2, vsz: 3900, rss: 1500, start: at(inc, 2, 4), cputime: 200, onKill: 'socketOwnerDied' });
    w.nextPid = 2001;
    const svc = (name, o) => { w.services[name] = Object.assign({ active: true, enabled: true, since: w.bootTime + 3000, restart: 'on-failure', user: 'root' }, o); };
    svc('lethe', { desc: 'Lethe nightly memory sweeper', unit: '/etc/systemd/system/lethe.service', mainPid: 451, since: at(inc, 2, 58, 1), restart: 'always', comm: 'lethe', exec: '/usr/bin/lethe --daemon --conf /etc/lethe/lethe.conf', cpu: 2.3, load: 0.34, memKb: 61440, onStart: 'letheStarted', memory: '48.1M', cpuStr: '2h 13min 41.002s' });
    svc(DM.cron.unit, { desc: DM.cron.desc, unit: `${DM.unitDir}/${DM.cron.unit}.service`, mainPid: 312, comm: DM.cron.comm, exec: DM.cron.exec, memory: '1.1M', cpuStr: '1.920s' });
    svc(DM.ssh.unit, { desc: DM.ssh.desc, unit: `${DM.unitDir}/${DM.ssh.unit}.service`, mainPid: 340, comm: 'sshd', exec: 'sshd: /usr/sbin/sshd -D', memory: '6.4M', cpuStr: '2.402s' });
    svc('rsyslog', { desc: 'System Logging Service', unit: '/lib/systemd/system/rsyslog.service', mainPid: 401, comm: 'rsyslogd', exec: '/usr/sbin/rsyslogd -n -iNONE', memory: '3.1M', cpuStr: '9.004s' });
    svc('systemd-journald', { desc: 'Journal Service', unit: '/lib/systemd/system/systemd-journald.service', mainPid: 180, comm: 'systemd-journald', exec: '/lib/systemd/systemd-journald', memory: '17.0M', cpuStr: '12.18s' });

    /* journal */
    w.log('rootfall', 'systemd', 1, `Started ${DM.cron.unit}.service - ${DM.cron.desc}.`, DM.cron.unit, true, w.bootTime + 3000);
    w.log('rootfall', 'systemd', 1, `Started ${DM.ssh.unit}.service - ${DM.ssh.desc}.`, DM.ssh.unit, true, w.bootTime + 3100);
    w.log('rootfall', 'systemd', 1, 'Started lethe.service - Lethe nightly memory sweeper.', 'lethe', true, at(12, 14, 3));
    w.log('rootfall', 'lethe', 610, 'Lethe 3.0.3 starting (conf=/etc/lethe/lethe.conf)', 'lethe', true, at(12, 14, 3, 1));
    w.log('rootfall', 'lethe', 610, 'SAFE_MODE=yes TARGETS=/tmp/* QUARANTINE=/var/lethe/quarantine', 'lethe', true, at(12, 14, 3, 1));
    w.log('rootfall', 'lethe', 610, 'config reloaded (inotify: /etc/lethe/lethe.conf changed)', 'lethe', true, at(inc, 1, 55, 41));
    w.log('rootfall', 'systemd', 1, 'lethe.service: Main process exited, code=exited, status=0/SUCCESS', 'lethe', true, at(inc, 1, 55, 42));
    w.log('rootfall', 'systemd', 1, 'Started lethe.service - Lethe nightly memory sweeper.', 'lethe', true, at(inc, 1, 55, 44));
    w.log('rootfall', 'lethe', 651, 'Lethe 3.0.3 starting (conf=/etc/lethe/lethe.conf)', 'lethe', true, at(inc, 1, 55, 44));
    w.log('rootfall', 'lethe', 651, 'SAFE_MODE=no TARGETS=/tmp/* /home/*/memories /usr/share/doc/archive/* QUARANTINE=/dev/null', 'lethe', true, at(inc, 1, 55, 45));
    w.log('rootfall', 'lethe', 651, 'WARNING: SAFE_MODE is OFF. Files will be destroyed, not quarantined.', 'lethe', true, at(inc, 1, 55, 45));
    w.log('rootfall', 'systemd', 1, 'Stopping lethe.service - Lethe nightly memory sweeper...', 'lethe', true, at(inc, 2, 22, 9));
    w.log('rootfall', 'systemd', 1, 'lethe.service: Deactivated successfully.', 'lethe', true, at(inc, 2, 22, 10));
    w.log('rootfall', 'systemd', 1, 'Stopped lethe.service - Lethe nightly memory sweeper.', 'lethe', true, at(inc, 2, 22, 10));
    w.log('rootfall', 'systemd', 1, 'Started lethe.service - Lethe nightly memory sweeper.', 'lethe', true, at(inc, 2, 58, 1));
    w.log('rootfall', 'lethe', 451, 'Lethe 3.0.3 starting (conf=/etc/lethe/lethe.conf) SAFE_MODE=no', 'lethe', true, at(inc, 2, 58, 2));
    for (let n = inc; n >= 1; n--) {
      w.log('rootfall', 'CRON', 2211 + n, '(hollow) CMD (sudo -n /usr/bin/systemctl start lethe)', 'cron', true, at(n, 2, 58, 1));
      w.log('rootfall', 'sudo', null, 'hollow : PWD=/var/.hollow ; USER=root ; COMMAND=/usr/bin/systemctl start lethe', 'cron', true, at(n, 2, 58, 1));
      w.log('rootfall', 'lethe', 451, 'sweep started', 'lethe', true, at(n, 3, 0, 0));
      w.log('rootfall', 'lethe', 451, `sweep finished: ${500 + n * 37} files sent to /dev/null`, 'lethe', true, at(n, 3, 0, 3));
    }
    w.journal.sort((a, b) => a.t - b.t);

    /* sessions */
    w.sessions = [];
    w.wtmp = [
      { user: u, tty: 'pts/1', from: '10.0.0.7', at: at(inc + 1, 20, 2), host: 'rootfall', out: '- 23:58  (03:56)' },
      { user: u, tty: 'pts/3', from: '10.0.0.66', at: at(inc, 1, 44, 2), host: 'rootfall', out: '- 01:49  (00:05)' },
      { user: 'hollow', tty: 'pts/3', from: '10.0.0.66', at: at(inc, 1, 52, 7), host: 'rootfall', out: '- 04:10  (02:18)' },
      { user: u, tty: 'pts/1', from: '10.0.0.7', at: at(inc, 2, 15, 0), host: 'rootfall', out: '- 02:41  (00:26)' },
      { user: 'mara', tty: 'pts/0', from: '10.0.0.12', at: at(1, 21, 4), host: 'rootfall', out: '- 23:30  (02:26)' },
    ];
    w.addSession({ user: 'mara', tty: 'pts/0', from: '10.0.0.12', host: 'rootfall', at: LA.now() - 3 * 3600000, idle: '2:11m', what: 'vim notes.txt' });
    w.addSession({ user: 'hollow', tty: 'pts/3', from: '10.0.0.66', host: 'rootfall', at: hstart, idle: '0.00s', what: '-bash' });
    w.sockets = [
      { proto: 'udp', state: 'UNCONN', local: '0.0.0.0:68', peer: '0.0.0.0:*', pid: 290, comm: 'dhclient', user: 'root', host: 'rootfall', static: true },
      { proto: 'tcp', state: 'LISTEN', local: '0.0.0.0:22', peer: '0.0.0.0:*', pid: 340, comm: 'sshd', user: 'root', host: 'rootfall', static: true },
      { proto: 'tcp', state: 'LISTEN', local: '0.0.0.0:31337', peer: '0.0.0.0:*', pid: 4040, comm: 'kw0rker', user: 'hollow', host: 'rootfall' },
      { proto: 'tcp', state: 'LISTEN', local: '[::]:22', peer: '[::]:*', pid: 340, comm: 'sshd', user: 'root', host: 'rootfall', static: true },
      { proto: 'tcp', state: 'ESTAB', local: '10.0.0.7:22', peer: '10.0.0.12:50412', pid: 511, comm: 'sshd', user: 'root', host: 'rootfall', static: true },
      { proto: 'tcp', state: 'ESTAB', local: '10.0.0.7:22', peer: '10.0.0.66:51337', pid: 1336, comm: 'sshd', user: 'root', host: 'rootfall' },
      { proto: 'tcp', state: 'ESTAB', local: '10.0.0.7:41822', peer: '10.0.0.66:4444', pid: 1338, comm: 'beacon', user: 'hollow', host: 'rootfall' },
    ];

    /* ================= THE LIGHTHOUSE (remote host) ================= */
    const lusers = new LA.Users({
      users: {
        root: { uid: 0, gid: 0, home: '/root', shell: '/bin/bash', gecos: 'root' },
        sshd: { uid: 105, gid: 65534, home: '/run/sshd', shell: '/usr/sbin/nologin', gecos: '' },
        wren: { uid: 1000, gid: 1000, home: '/home/wren', shell: '/bin/bash', gecos: 'Wren Alcott,,,Lighthouse Keeper' },
        nobody: { uid: 65534, gid: 65534, home: '/nonexistent', shell: '/usr/sbin/nologin', gecos: 'nobody' },
      },
      groups: LA.adaptGroups({ root: { gid: 0, members: [] }, adm: { gid: 4, members: ['wren'] }, sudo: { gid: 27, members: ['wren'] }, wren: { gid: 1000, members: [] }, nogroup: { gid: 65534, members: [] } }, w.distro),
    });
    const lroot = new LA.Node('dir', '/', { mtime: old });
    const lfs = new LA.VFS(lroot, lusers);
    w.hosts.lighthouse = { name: 'lighthouse', fqdn: 'lighthouse.rootfall', ip: '10.0.0.2', mac: '52:54:00:4c:16:02', users: lusers, fs: lfs };
    w.passwords.lighthouse = { wren: rand(), root: rand() };
    for (const d of ['/etc', '/home', '/usr', '/usr/bin', '/var', '/var/log', '/tmp', '/root']) lfs.dir(d, { mode: d === '/tmp' ? 0o1777 : d === '/root' ? 0o700 : 0o755, immutable: true });
    for (const name of Object.keys(LA.commands)) {
      const c = LA.commands[name];
      if ((c.builtin && !['echo', 'pwd', 'printf', 'kill', 'test', '[', 'true', 'false'].includes(name)) || c.meta || SKIP.has(name) || LA.foreignCmd(name, w.distro)) continue;
      lfs.put('/usr/bin/' + name, '', { format: 'elf', data: { cmd: name }, mode: 0o755, mtime: old });
    }
    lfs.link('/bin', 'usr/bin');
    lfs.put('/etc/hostname', 'lighthouse\n');
    lfs.put('/etc/passwd', ''); lfs.put('/etc/group', ''); lfs.put('/etc/shadow', '', { mode: 0o640 });
    lfs.put('/etc/motd', R`
        |
       /_\          THE LIGHTHOUSE  ·  lighthouse.rootfall
      |:::|         Rootfall's only window to the outside world.
      |:::|         Keeper: Wren Alcott
     /|:::|\
    / |:::| \       Be kind. Be brief. Wipe your feet.
  ~~~~~~~~~~~~~~~
`);
    lfs.dir('/home/wren', { owner: 'wren', group: 'wren', mode: 0o755 });
    const W = (p, c, o = {}) => lfs.put('/home/wren/' + p, c, Object.assign({ owner: 'wren', group: 'wren', mode: 0o644, mtime: T(2) }, o));
    W('README.txt', `KEEPER'S NOTES — read me first, ${u}
-------------------------------------
1. Ingrid told me what she sold: a copy of my PRIVATE key. With it,
   anyone could log in here as me. I made a new keypair this morning,
   so the stolen copy opens nothing now.

2. But while he was "me", Hollow added his OWN public key to my
   ~/.ssh/authorized_keys. That entry still lets him in, new keypair
   or not. It has to come out.

3. ~/keys.trusted lists the keys I actually trust, in case you need it.

4. I kept the clean copy of your lethe.conf, like you asked:
       ~/clean/lethe.conf
   Copy it home with scp, from YOUR machine:
       scp wren@lighthouse:clean/lethe.conf ~/lethe.conf.clean
                                                   — Wren
`);
    lfs.dir('/home/wren/clean', { owner: 'wren', group: 'wren' });
    W('clean/lethe.conf', LA.letheConf(u, true), { mtime: at(12, 14, 0) });
    W('beam_log.txt', 'beam: rotating. 0 outages this week.\nvisitors (via ssh): wren, operator, ... and one I did not invite (10.0.0.66).\n');
    lfs.dir('/home/wren/.ssh', { owner: 'wren', group: 'wren', mode: 0o700 });
    const trusted = `${KEY_YOU(u)}\nssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIM4r4qU1llW0rkSt4t10nK3y0nlYm4r4 mara@mara-pc\nssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIN3wK3yR0t4t3dTh1sM0rn1ngBy1ngr1d wren@lighthouse-console (rotated ${ymd(at(-1, 7, 0))})\n`;
    W('.ssh/authorized_keys', trusted + KEY_HOLLOW + '\n', { mode: 0o600, mtime: at(-1, 7, 5) });
    W('keys.trusted', trusted, { mode: 0o600, mtime: at(-1, 7, 6) });
    W('.bash_history', 'cat /var/log/auth.log | grep 10.0.0.66\nwho\ncat ~/.ssh/authorized_keys\n', { mode: 0o600 });
    lfs.put('/var/log/auth.log', [
      `${U.syslogDate(at(9, 0, 51))} lighthouse sshd[702]: Accepted publickey for wren from 10.0.0.66 port 40001 ssh2: ED25519 SHA256:Wr3nOldK3yC0p13d`,
      `${U.syslogDate(at(9, 0, 52))} lighthouse sshd[702]: authorized_keys modified for user wren`,
      `${U.syslogDate(at(inc, 1, 40))} lighthouse sshd[810]: Accepted publickey for wren from 10.0.0.66 port 40312 ssh2: ED25519 SHA256:H0ll0wN0b0dyH3r3`,
      `${U.syslogDate(at(inc, 1, 43))} lighthouse sshd[811]: forwarding 10.0.0.66 -> rootfall:22`,
      `${U.syslogDate(at(1, 1, 30))} lighthouse sshd[912]: Accepted publickey for wren from 10.0.0.66 port 40999 ssh2: ED25519 SHA256:H0ll0wN0b0dyH3r3`,
    ].join('\n') + '\n', { owner: 'root', group: 'adm', mode: 0o640 });
    w.syncAccounts(w.hosts.lighthouse);
    w.wtmp.push({ user: 'wren', tty: 'pts/0', from: '10.0.0.66', at: at(1, 1, 30), host: 'lighthouse', out: '- 01:58  (00:28)' });

    w.syncAccounts(w.hosts.rootfall);
    const settle = (n) => {
      if (n.type !== 'dir') return n.mtime;
      let t = 0;
      for (const c of n.children.values()) t = Math.max(t, settle(c));
      if (n.mtime > buildStart - 1000) n.mtime = t || old;
      return n.mtime;
    };
    settle(root); settle(lroot); settle(bu);
    pack.worldStatic(w);
    return w;
  };

  /* static, non-serialised data that depends only on the username */
  pack.worldStatic = function (w) {
    const u = w.username;
    w.hosts.rootfall.neigh = '10.0.0.1 dev eth0 lladdr 52:54:00:00:00:01 REACHABLE\n10.0.0.2 dev eth0 lladdr 52:54:00:4c:16:02 STALE\n10.0.0.66 dev eth0  FAILED';
    w.net = [
      { names: ['gateway', 'gateway.rootfall'], ip: '10.0.0.1', up: true, latency: 0.31, ptr: 'gateway.rootfall' },
      { names: ['lighthouse', 'lighthouse.rootfall', 'mirror.lighthouse.rootfall', 'security.lighthouse.rootfall'], ip: '10.0.0.2', up: true, latency: 0.42, http: true, ssh: true, hostKey: 'lighthouse', ptr: 'lighthouse.rootfall' },
      { names: ['rootfall', 'rootfall.rootfall'], ip: '10.0.0.7', up: true, latency: 0.04, hostKey: 'rootfall', ptr: 'rootfall.rootfall' },
      { names: ['mara-pc', 'mara-pc.rootfall'], ip: '10.0.0.12', up: true, latency: 0.88, ptr: 'mara-pc.rootfall' },
      { names: ['tux', 'tux.rootfall'], ip: '10.0.0.91', up: true, latency: 0.19, ptr: 'tux.rootfall' },
      { names: [], ip: '10.0.0.66', up: true, icmp: false, latency: 9 },
    ];
    w.txt = { 'tux.rootfall': 'waddle on. you found the penguin\'s secret record.', 'lighthouse.rootfall': 'keeper=wren; beam=always', rootfall: 'founded=1991; motto=a city is just a filesystem that people love' };
    const acts = [
      ['03:00:01', 'erase', 1402, '/home/*/memories'], ['03:00:01', 'erase', 2210, '/usr/share/doc/archive'], ['03:00:02', 'erase', 377, '/tmp'],
      ['03:00:01', 'erase', 1611, '/home/*/memories'], ['03:00:02', 'erase', 2875, '/usr/share/doc/archive'], ['03:00:02', 'erase', 402, '/tmp'],
      ['03:00:01', 'erase', 1530, '/home/*/memories'], ['03:00:01', 'erase', 3109, '/usr/share/doc/archive'], ['03:00:02', 'erase', 696, '/tmp'],
    ];
    let log = '';
    acts.forEach((a, i) => {
      const day = 3 - Math.floor(i / 3);
      log += `${U.strftime('%F', new Date(LA.now() - day * DAY))} ${a[0]} hollow ${a[1]} ${a[2]} ${a[3]}\n`;
    });
    w.hollowTotal = acts.reduce((s, a) => s + a[2], 0);
    w.http = {
      lighthouse: {
        '/': { type: 'text/html', body: `<!DOCTYPE html>\n<html>\n<head><title>The Lighthouse</title></head>\n<body>\n  <h1>The Lighthouse</h1>\n  <p>Rootfall's only window to the outside world.</p>\n  <ul>\n    <li><a href="/notice">/notice</a> - keeper's notice</li>\n    <li><a href="/status">/status</a> - beam status (JSON)</li>\n    <li><a href="/files/">/files/</a> - public files</li>\n  </ul>\n</body>\n</html>\n` },
        '/notice': { body: `LIGHTHOUSE NOTICE — from the keeper
-----------------------------------
To the Operator, if you're out there:

Someone has been coming through my Lighthouse at night using MY
account. Ingrid walked up here at dawn and told me why: she sold a
copy of my private key at her stall. I've made a new keypair, so
that copy is useless now — but he planted his own key while he was
me, and I'd like you to take it out properly.

The logs of what he did here are yours:

    http://lighthouse/files/hollow_activity.log

Then come up and see me:   ssh wren@lighthouse
Your key still works. I never took it out.

I also kept the clean copy of your lethe.conf, like you asked —
it's in my home, clean/lethe.conf. scp it home when you're done.

Before you type "yes" to ssh's question, check you're really talking
to my machine. The Lighthouse's host key fingerprint is:

    ${LA.hostFingerprint('10.0.0.2')}

If ssh shows you anything else, answer "no" and call me.

                                              — Wren
` },
        '/status': { type: 'application/json', body: '{"lighthouse":"online","keeper":"wren","beam":"rotating","intrusions_last_7d":7,"last_intrusion_from":"10.0.0.66"}\n' },
        '/files': { type: 'text/html', body: '<html><body><h1>Index of /files/</h1><pre><a href="hollow_activity.log">hollow_activity.log</a>\n<a href="tux.txt">tux.txt</a></pre></body></html>\n' },
        '/files/hollow_activity.log': { body: log },
        '/files/tux.txt': { body: R`   .--.
  |o_o |   the penguin is watching
  |:_/ |
 //   \ \
(|     | )
/'\_   _/'\
\___)=(___/
` },
        '/robots.txt': { body: 'User-agent: *\nDisallow: /keeper-only/\n' },
        '/keeper-only': { body: `KEEPER ONLY. If you are reading this, you are not a robot.\n\nThe beam has turned every night since 1991. I have never once\nlet it stop. Some nights that's the only thing I'm sure of.\n\nThank you for coming back, ${u}.\n\n— W.\n` },
      },
    };
  };

  /* things that happen in Rootfall when its processes die or its services start */
  pack.worldHooks = {
    hollowShellDied(p) {
      this.reap(1336);
      this.removeSession((s) => s.user === 'hollow');
      this.sockets = this.sockets.filter((s) => !(s.peer && s.peer.startsWith('10.0.0.66') && s.comm === 'sshd'));
      const w = this.wtmp.find((x) => x.user === 'hollow' && !x.out);
      if (w) w.out = `- ${U.strftime('%H:%M', new Date(LA.now()))}  (killed)`;
      this.syncSockets();
    },
    letheStarted(s, pid) {
      const fs = this.main.fs;
      const conf = fs.tryGet('/etc/lethe/lethe.conf');
      const text = conf ? fs.contentOf(conf) : '';
      const get = (k) => { const m = text.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1] : '?'; };
      this.log(this.mainName, 'lethe', pid, `Lethe 3.0.3 starting (conf=/etc/lethe/lethe.conf)`, 'lethe');
      this.log(this.mainName, 'lethe', pid, `SAFE_MODE=${get('SAFE_MODE')} TARGETS=${get('TARGETS')} QUARANTINE=${get('QUARANTINE')}`, 'lethe');
      this.log(this.mainName, 'lethe', pid, `next sweep scheduled for ${get('SCHEDULE')}`, 'lethe');
    },
  };
})();
