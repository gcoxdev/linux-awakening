/* Linux Awakening — editors, toys, daemons and the game's own meta commands. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const U = LA.util;
  const VFS = LA.VFS;
  const def = LA.def;
  const A = LA.ansi;

  /* ---------- editors ---------- */
  async function editFile(ctx, editor) {
    const files = ctx.args.filter((a) => !a.startsWith('-') && !a.startsWith('+'));
    const f = files[0];
    let abs = f ? ctx.abs(f) : null;
    let content = '';
    let exists = false;
    let message = null;
    if (abs) {
      let node = null;
      try { node = ctx.fs.get(abs, ctx.user); } catch (e) { if (e.code === 'EACCES') message = `Error reading ${f}: Permission denied`; }
      if (node) {
        exists = true;
        if (node.type === 'dir') { ctx.err.write(`${editor}: "${f}" is a directory\n`); return 1; }
        if (node.format) { ctx.err.write(`${editor}: ${f}: this is a binary file; refusing to open it as text\n`); return 1; }
        if (!ctx.fs.can(node, ctx.user, 4)) message = `Error reading ${f}: Permission denied`;
        else { content = ctx.fs.readFile(abs, ctx.user); ctx.noteRead(abs); }
      } else if (!message) {
        const parent = ctx.fs.tryGet(VFS.dirname(abs), ctx.user);
        if (!parent) message = `Directory '${VFS.dirname(f)}' does not exist`;
      }
    }
    const save = (text, name) => {
      const target = name ? ctx.abs(name) : abs;
      if (!target) return { error: 'No file name' };
      try {
        ctx.fs.writeFile(target, text, { user: ctx.user, umask: ctx.shell.umask });
        abs = target;
        if (ctx.game) ctx.game.onEdit(target, ctx.shell);
        return { ok: true, lines: U.lines(text).length, name: name || f };
      } catch (e) {
        return { error: `Error writing ${name || f}: ${e.message}` };
      }
    };
    const res = await ctx.ui.edit({ filename: f || '', content, editor, message, onSave: save, isNew: !exists });
    if (editor !== 'nano' && res && res.quit && ctx.game) ctx.game.secret('vim_exit');
    return 0;
  }
  def('nano', { run: (ctx) => editFile(ctx, 'nano') });
  def('vim', { run: (ctx) => editFile(ctx, 'vim') });
  def('vi', { run: (ctx) => editFile(ctx, 'vim') });

  /* ---------- toys ---------- */
  const TRAIN = [
    R`      ====        ________                ___________ `,
    R`  _D _|  |_______/        \__I_I_____===__|_________| `,
    R`   |(_)---  |   H\________/ |   |        =|___ ___|   `,
    R`   /     |  |   H  |  |     |   |         ||_| |_||   `,
    R`  |      |  |   H  |__--------------------| [___] |   `,
    R`  | ________|___H__/__|_____/[][]~\_______|       |   `,
    R`  |/ |   |-----------I_____I [][] []  D   |=======|__ `,
  ];
  const WHEELS = [
    [R`__/ =| o |=-~~\  /~~\  /~~\  /~~\ ____Y___________|__ `, R` |/-=|___|=    ||    ||    ||    |_____/~\___/        `, R`  \_/      \O=====O=====O=====O_/      \_/            `],
    [R`__/ =| o |=-O=====O=====O=====O \ ____Y___________|__ `, R` |/-=|___|=    ||    ||    ||    |_____/~\___/        `, R`  \_/      \__/  \__/  \__/  \__/      \_/            `],
  ];
  function R(s) { return s.raw ? s.raw[0] : s; }
  def('sl', {
    interruptible: true,
    async run(ctx) {
      if (ctx.game) ctx.game.secret('choo_choo');
      const width = (ctx.ui && ctx.ui.columns) || 80;
      const frames = [];
      const tw = TRAIN[0].length;
      for (let x = width; x > -tw; x -= 2) {
        const wheel = WHEELS[(x >> 1) % 2 === 0 ? 0 : 1];
        const smoke = (x >> 2) % 2 ? '    (  ) (@@) ( )  (@)  ()    @@    O     @' : '  (@@) (  ) (@)  ( )  @@    ()    @     O';
        const lines = [smoke.slice(0, 44), ...TRAIN, ...wheel].map((l) => {
          const pad = x > 0 ? ' '.repeat(x) + l : l.slice(-x);
          return pad.slice(0, width);
        });
        frames.push(lines.join('\n'));
      }
      if (ctx.ui.animate && ctx.isTTY) await ctx.ui.animate(frames, { interval: 35, signal: ctx.signal });
      else ctx.println(frames[Math.floor(frames.length / 2)]);
      return 0;
    },
  });

  function bubble(text, think) {
    const words = text.split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > 38) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
    }
    if (cur || !lines.length) lines.push(cur);
    const w = Math.max(...lines.map((l) => l.length));
    let s = ' ' + '_'.repeat(w + 2) + '\n';
    if (lines.length === 1) s += (think ? '( ' : '< ') + lines[0].padEnd(w) + (think ? ' )' : ' >') + '\n';
    else lines.forEach((l, i) => {
      const [a, b] = think ? ['(', ')'] : i === 0 ? ['/', '\\'] : i === lines.length - 1 ? ['\\', '/'] : ['|', '|'];
      s += `${a} ${l.padEnd(w)} ${b}\n`;
    });
    s += ' ' + '-'.repeat(w + 2) + '\n';
    return s;
  }
  const COW = String.raw`        \   ^__^
         \  (oo)\_______
            (__)\       )\/\
                ||----w |
                ||     ||
`;
  const TUXSAY = String.raw`   \
    \
        .--.
       |o_o |
       |:_/ |
      //   \ \
     (|     | )
    /'\_   _/'\
    \___)=(___/
`;
  def('cowsay', {
    async run(ctx) {
      let args = ctx.args.slice();
      let file = 'default';
      if (args[0] === '-f') { file = args[1]; args = args.slice(2); }
      if (args[0] === '-l') { ctx.println('Cow files in /usr/share/cowsay/cows:\ndefault tux'); return 0; }
      const text = args.length ? args.join(' ') : (await ctx.readInput()).trim();
      ctx.print(bubble(text || '...') + (file === 'tux' ? TUXSAY : COW));
      if (ctx.game) ctx.game.secret('moo');
      return 0;
    },
  });

  const FORTUNES = [
    'The best way to predict the future is to read the logs of the past.',
    'There is no place like 127.0.0.1.',
    'rm -rf is forever. Backups are for people who would like to be forever, too.',
    'A penguin in the hand is worth two in the Void.',
    'If at first you don\'t succeed, read the manual. Then read it again, slower.',
    'The pipe is mightier than the sword.',
    'Talk is cheap. Show me the diff.',
    'Every Operator is wrong at least once. The good ones keep backups.',
    'You will soon change your password. (Please.)',
    'Today is a good day to chmod 600 something.',
    'Your lucky numbers are 0, 755, and 1991.',
    'grep and ye shall find.',
    'A watched process never exits.',
    'In the beginning there was the command line.',
    'The quieter you become, the more you can hear the cron jobs.',
    'He who types sudo without reading, reads the error message twice.',
    'Not all who wander are lost. Some are just in /tmp.',
    'Q: How do you exit vim?  A: Calmly. Esc, then :q',
    'When in doubt, pwd.',
    'Home is where ~ is.',
  ];
  def('fortune', {
    run(ctx) {
      ctx.println(FORTUNES[Math.floor(Math.random() * FORTUNES.length)]);
      if (ctx.game) ctx.game.secret('fortune');
      return 0;
    },
  });

  def('neofetch', {
    run(ctx) {
      const c = (code, s) => (ctx.isTTY ? code + s + A.reset : s);
      const m = ctx.world.memory();
      const up = Math.floor((LA.now() - ctx.world.bootTime) / 1000);
      const art = [
        '        .--.        ', '       |o_o |       ', '       |:_/ |       ', '      //   \\ \\      ',
        '     (|     | )     ', "    /'\\_   _/'\\     ", '    \\___)=(___/     ', '                    ', '                    ', '                    ', '                    ', '                    ',
      ];
      const info = [
        c(A.bcyan, `${ctx.user}`) + '@' + c(A.bcyan, ctx.host.name),
        '-'.repeat(ctx.user.length + ctx.host.name.length + 1),
        `${c(A.bcyan, 'OS')}: Rootfall GNU/Linux 1991 x86_64`,
        `${c(A.bcyan, 'Host')}: Kernel Works KW-1991`,
        `${c(A.bcyan, 'Kernel')}: 6.1.0-rootfall`,
        `${c(A.bcyan, 'Uptime')}: ${Math.floor(up / 86400)} days, ${Math.floor((up % 86400) / 3600)} hours, ${Math.floor((up % 3600) / 60)} mins`,
        `${c(A.bcyan, 'Packages')}: ${ctx.world.packages.installed.length + 412} (dpkg)`,
        `${c(A.bcyan, 'Shell')}: bash 5.2.15`,
        `${c(A.bcyan, 'Terminal')}: /dev/${ctx.shell.tty}`,
        `${c(A.bcyan, 'CPU')}: Kernel Works KW-1991 (2) @ 2.40GHz`,
        `${c(A.bcyan, 'Memory')}: ${Math.round(m.used / 1024)}MiB / ${Math.round(m.total / 1024)}MiB`,
        `${c(A.bcyan, 'Penguin')}: Tux (present, judging you)`,
      ];
      for (let i = 0; i < art.length; i++) ctx.println(c(A.bwhite, art[i]) + (info[i] || ''));
      ctx.println('                    ' + ['\x1b[40m', '\x1b[41m', '\x1b[42m', '\x1b[43m', '\x1b[44m', '\x1b[45m', '\x1b[46m', '\x1b[47m'].map((x) => (ctx.isTTY ? x + '   ' + A.reset : '')).join(''));
      if (ctx.game) ctx.game.secret('neofetch');
      return 0;
    },
  });

  def('cmatrix', {
    interruptible: true,
    async run(ctx) {
      const width = (ctx.ui && ctx.ui.columns) || 80;
      const rows = 18;
      const cols = Math.floor(width / 2);
      const drops = Array.from({ length: cols }, () => Math.floor(Math.random() * -rows));
      const chars = 'ｱｲｳｴｵｶｷｸｹｺ01ROOTFALL$#@*+=';
      const frames = [];
      for (let f = 0; f < 120; f++) {
        const grid = Array.from({ length: rows }, () => Array(cols).fill(' '));
        drops.forEach((d, i) => {
          for (let k = 0; k < 6; k++) { const y = d - k; if (y >= 0 && y < rows) grid[y][i] = chars[Math.floor(Math.random() * chars.length)]; }
          drops[i] = d > rows + 6 ? Math.floor(Math.random() * -8) : d + 1;
        });
        frames.push('\x1b[32m' + grid.map((r) => r.join(' ')).join('\n') + '\x1b[0m');
      }
      if (ctx.ui.animate && ctx.isTTY) await ctx.ui.animate(frames, { interval: 60, signal: ctx.signal });
      else ctx.println(U.stripAnsi(frames[60]));
      if (ctx.game) ctx.game.secret('matrix');
      return 0;
    },
  });

  def('make', {
    run(ctx) {
      const a = ctx.args.join(' ');
      if (/me a sandwich/.test(a)) {
        if (ctx.user === 'root') { ctx.println('Okay.'); if (ctx.game) ctx.game.secret('sandwich'); return 0; }
        ctx.println('What? Make it yourself.');
        return 2;
      }
      if (!ctx.fs.tryGet(ctx.abs('Makefile'), ctx.user) && !ctx.fs.tryGet(ctx.abs('makefile'), ctx.user)) {
        ctx.err.write(ctx.args.length ? `make: *** No rule to make target '${ctx.args[0]}'.  Stop.\n` : 'make: *** No targets specified and no makefile found.  Stop.\n');
        return 2;
      }
      ctx.println("make: Nothing to be done for 'all'.");
      return 0;
    },
  });

  def('fail2ban-client', {
    run(ctx) {
      if (ctx.user !== 'root') { ctx.err.write('ERROR  Permission denied to socket: /var/run/fail2ban/fail2ban.sock, (you must be root)\n'); return 255; }
      const s = ctx.world.services.fail2ban;
      if (!s || !s.active) { ctx.err.write('ERROR  Failed to access socket path: /var/run/fail2ban/fail2ban.sock. Is fail2ban running?\n'); return 255; }
      const [a, b, c, d] = ctx.args;
      const banned = ctx.world.flags.banned || [];
      if (a === 'ping') { ctx.println('Server replied: pong'); return 0; }
      if (a === 'status' && !b) { ctx.println('Status\n|- Number of jail:\t1\n`- Jail list:\tsshd'); return 0; }
      if (a === 'status' && b === 'sshd') {
        ctx.println(`Status for the jail: sshd\n|- Filter\n|  |- Currently failed:\t0\n|  |- Total failed:\t7\n|  \`- File list:\t/var/log/auth.log\n\`- Actions\n   |- Currently banned:\t${banned.length}\n   |- Total banned:\t${banned.length}\n   \`- Banned IP list:\t${banned.join(' ')}`);
        return 0;
      }
      if (a === 'set' && b === 'sshd' && c === 'banip' && d) {
        if (!banned.includes(d)) banned.push(d);
        ctx.world.flags.banned = banned;
        ctx.println('1');
        if (ctx.game) ctx.game.onBan(d);
        return 0;
      }
      ctx.err.write('ERROR  Invalid command. Try: fail2ban-client status sshd\n');
      return 255;
    },
  });

  def('lethe', {
    run(ctx) {
      if (ctx.args.includes('--version') || ctx.args.includes('-V')) { ctx.println('lethe 3.0.3 (rootfall) — written by the City Operator'); return 0; }
      if (ctx.user !== 'root') { ctx.err.write('lethe: must be run as root\n'); return 1; }
      const s = ctx.world.services.lethe;
      if (s && s.active) { ctx.err.write(`lethe: another instance is already running (pid ${s.mainPid})\n`); return 1; }
      ctx.println('lethe: refusing to run outside systemd. use: systemctl start lethe');
      return 1;
    },
  });
  def('beacon', { run(ctx) { ctx.err.write('beacon: phoning home to 10.0.0.66:4444... connection refused (you are not hollow)\n'); return 1; } });
  def('kw0rker', { run(ctx) { ctx.err.write('kw0rker: listening on 0.0.0.0:31337... address already in use\n'); return 1; } });
  def('sshd', { run(ctx) { ctx.err.write('sshd re-exec requires execution with an absolute path\n'); return 1; } });
  def('cron', { run(ctx) { ctx.err.write('cron: can\'t lock /var/run/crond.pid, otherpid may be 312: Resource temporarily unavailable\n'); return 1; } });

  /* ---------- the game's own words (always available) ---------- */
  const meta = (name, desc, fn) => def(name, { builtin: true, meta: true, desc, run: fn });
  meta('help', 'show what you can do', (ctx) => (ctx.game ? ctx.game.cmdHelp(ctx) : 0));
  meta('hint', 'ask Tux for a nudge', (ctx) => (ctx.game ? ctx.game.cmdHint(ctx) : 0));
  meta('goal', 'repeat your current objective', (ctx) => (ctx.game ? ctx.game.cmdGoal(ctx) : 0));
  meta('objective', 'repeat your current objective', (ctx) => (ctx.game ? ctx.game.cmdGoal(ctx) : 0));
  meta('story', 'replay the current scene', (ctx) => (ctx.game ? ctx.game.cmdStory(ctx) : 0));
  meta('progress', 'chapters, memories and secrets', (ctx) => (ctx.game ? ctx.game.cmdProgress(ctx) : 0));
  meta('notebook', 'the commands you have remembered', (ctx) => (ctx.game ? ctx.game.cmdNotebook(ctx) : 0));
})();
