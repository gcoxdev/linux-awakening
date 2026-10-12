/* Linux Awakening — users, info, help, sudo, services, disks, packages. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const U = LA.util;
  const VFS = LA.VFS;
  const def = LA.def;
  const getopt = U.getopt;

  /* ---------- identity ---------- */
  def('whoami', { run(ctx) { ctx.println(ctx.user); return 0; } });

  def('id', {
    run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'ugGnr' });
      const users = ctx.fs.users;
      const name = operands[0] || ctx.user;
      const u = users.get(name);
      if (!u) { ctx.err.write(`id: '${name}': no such user\n`); return 1; }
      const pg = users.primaryGroup(name);
      const gs = users.groupsOf(name);
      if (o.u) { ctx.println(o.n ? name : String(u.uid)); return 0; }
      if (o.g) { ctx.println(o.n ? pg : String(u.gid)); return 0; }
      if (o.G) { ctx.println(gs.map((g) => (o.n ? g : users.gidOf(g))).join(' ')); return 0; }
      ctx.println(`uid=${u.uid}(${name}) gid=${u.gid}(${pg}) groups=${gs.map((g) => `${users.gidOf(g)}(${g})`).join(',')}`);
      return 0;
    },
  });

  def('groups', {
    run(ctx) {
      const users = ctx.fs.users;
      if (!ctx.args.length) { ctx.println(users.groupsOf(ctx.user).join(' ')); return 0; }
      let st = 0;
      for (const n of ctx.args) {
        if (!users.exists(n)) { ctx.err.write(`groups: '${n}': no such user\n`); st = 1; continue; }
        ctx.println(`${n} : ${users.groupsOf(n).join(' ')}`);
      }
      return st;
    },
  });

  def('hostname', {
    run(ctx) {
      if (ctx.args.includes('-I') || ctx.args.includes('-i')) { ctx.println(ctx.host.ip + ' '); return 0; }
      if (ctx.args.includes('-f')) { ctx.println(ctx.host.fqdn || ctx.host.name); return 0; }
      if (ctx.args.length && !ctx.args[0].startsWith('-')) {
        if (ctx.user !== 'root') { ctx.err.write('hostname: you must be root to change the host name\n'); return 1; }
        ctx.host.name = ctx.args[0];
        return 0;
      }
      ctx.println(ctx.host.name);
      return 0;
    },
  });

  def('uname', {
    run(ctx) {
      const { o } = getopt(ctx.args, { flags: 'asnrvmpio', long: { all: 'a', 'kernel-name': 's', nodename: 'n', 'kernel-release': 'r', 'kernel-version': 'v', machine: 'm', 'operating-system': 'o' } });
      const f = {
        s: 'Linux', n: ctx.host.name, r: ctx.world.sys.kernel, v: `#1 SMP PREEMPT_DYNAMIC Fri Mar 1 03:00:00 ${ctx.world.sys.tz} ${ctx.world.sys.build}`,
        m: 'x86_64', p: 'x86_64', i: 'x86_64', o: 'GNU/Linux',
      };
      if (o.a) { ctx.println(`${f.s} ${f.n} ${f.r} ${f.v} ${f.m} ${f.o}`); return 0; }
      const keys = ['s', 'n', 'r', 'v', 'm', 'p', 'i', 'o'].filter((k) => o[k]);
      ctx.println((keys.length ? keys : ['s']).map((k) => f[k]).join(' '));
      return 0;
    },
  });

  /* ---------- time ---------- */
  function parseDateArg(s) {
    const now = LA.now();
    if (!s || s === 'now') return now;
    if (s === 'yesterday') return now - 86400000;
    if (s === 'tomorrow') return now + 86400000;
    let m = s.match(/^(\d+) (second|minute|hour|day|week)s? ago$/);
    if (m) return now - parseInt(m[1], 10) * { second: 1e3, minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5 }[m[2]];
    m = s.match(/^[+-]?(\d+) (second|minute|hour|day|week)s?$/);
    if (m) return now + parseInt(m[1], 10) * { second: 1e3, minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5 }[m[2]] * (s.startsWith('-') ? -1 : 1);
    if (/^@\d+$/.test(s)) return parseInt(s.slice(1), 10) * 1000;
    const t = Date.parse(s);
    return isNaN(t) ? null : t;
  }
  def('date', {
    run(ctx) {
      let fmt = null, dstr = null, iso = false;
      const args = ctx.args;
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a.startsWith('+')) fmt = a.slice(1);
        else if (a === '-d' || a === '--date') dstr = args[++i];
        else if (a.startsWith('--date=')) dstr = a.slice(7);
        else if (a === '-I' || a === '--iso-8601') iso = true;
        else if (a === '-u' || a === '-R' || a === '--utc') { /* local story time only */ }
        else if (a.startsWith('-')) { ctx.err.write(`date: invalid option -- '${a.slice(1)}'\n`); return 1; }
        else { ctx.err.write(`date: cannot set date: Operation not permitted\n`); return 1; }
      }
      const ms = parseDateArg(dstr);
      if (ms === null) { ctx.err.write(`date: invalid date '${dstr}'\n`); return 1; }
      const d = new Date(ms);
      if (iso) ctx.println(U.strftime('%F', d));
      else if (fmt !== null) ctx.println(U.strftime(fmt, d));
      else ctx.println(U.dateString(d));
      return 0;
    },
  });

  def('cal', {
    run(ctx) {
      const now = new Date(LA.now());
      let month = now.getMonth(), year = now.getFullYear();
      const nums = ctx.args.filter((a) => /^\d+$/.test(a));
      if (nums.length === 2) { month = parseInt(nums[0], 10) - 1; year = parseInt(nums[1], 10); }
      else if (nums.length === 1) {
        year = parseInt(nums[0], 10);
        for (let m = 0; m < 12; m++) { ctx.print(calMonth(m, year, null, ctx.isTTY)); ctx.println(''); }
        return 0;
      }
      if (month < 0 || month > 11) { ctx.err.write(`cal: ${nums[0]} is neither a month number (1..12) nor a name\n`); return 1; }
      const today = month === now.getMonth() && year === now.getFullYear() ? now.getDate() : null;
      ctx.print(calMonth(month, year, today, ctx.isTTY));
      return 0;
    },
  });
  function calMonth(m, y, today, tty) {
    const title = `${U.MONTHS[m]} ${y}`;
    const pad = Math.floor((20 - title.length) / 2);
    let s = ' '.repeat(pad) + title + '\nSu Mo Tu We Th Fr Sa\n';
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    let line = '   '.repeat(first);
    for (let d = 1; d <= days; d++) {
      let ds = String(d).padStart(2);
      if (d === today && tty) ds = '\x1b[7m' + ds + '\x1b[0m';
      line += ds;
      if ((first + d) % 7 === 0) { s += line + '\n'; line = ''; }
      else line += ' ';
    }
    if (line.trim()) s += line.replace(/ $/, '') + '\n';
    return s;
  }

  function uptimeParts(world) {
    const secs = Math.floor((LA.now() - world.bootTime) / 1000);
    const days = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600), mi = Math.floor((secs % 3600) / 60);
    return { days, h, mi };
  }
  LA.uptimeLine = (world) => {
    const { days, h, mi } = uptimeParts(world);
    const t = U.strftime('%T', new Date(LA.now()));
    const users = world.sessions.filter((s) => s.host === world.mainName).length;
    return ` ${t} up ${days ? `${days} day${days === 1 ? '' : 's'}, ` : ''}${String(h).padStart(2)}:${U.p2(mi)},  ${users} user${users === 1 ? '' : 's'},  load average: ${world.load().join(', ')}`;
  };
  def('uptime', {
    run(ctx) {
      if (ctx.args.includes('-p')) {
        const { days, h, mi } = uptimeParts(ctx.world);
        ctx.println(`up ${days} days, ${h} hours, ${mi} minutes`);
        return 0;
      }
      if (ctx.args.includes('-s')) { ctx.println(U.stamp(ctx.world.bootTime)); return 0; }
      ctx.println(LA.uptimeLine(ctx.world));
      return 0;
    },
  });

  def('free', {
    run(ctx) {
      const { o } = getopt(ctx.args, { flags: 'hmgkbtw', long: { human: 'h', mega: 'm', giga: 'g' } });
      const m = ctx.world.memory();
      const fmt = (k) => (o.h ? U.human(k * 1024).replace(/([KMGT])$/, '$1i').replace(/^(\d+)$/, '$1B') : o.m ? String(Math.round(k / 1024)) : o.g ? String(Math.round(k / 1048576)) : String(k));
      const head = ['', 'total', 'used', 'free', 'shared', 'buff/cache', 'available'];
      const rows = [
        ['Mem:', m.total, m.used, m.free, m.shared, m.cache, m.avail].map((v, i) => (i ? fmt(v) : v)),
        ['Swap:', m.swap, 0, m.swap].map((v, i) => (i ? fmt(v) : v)),
      ];
      const w = 12;
      ctx.println(head.map((h, i) => (i === 0 ? U.padR(h, 7) : U.padL(h, w))).join(''));
      for (const r of rows) ctx.println(r.map((c, i) => (i === 0 ? U.padR(c, 7) : U.padL(c, w))).join(''));
      return 0;
    },
  });

  /* ---------- environment ---------- */
  def('env', {
    async run(ctx) {
      let args = ctx.args.slice();
      let clean = false;
      if (args[0] === '-i' || args[0] === '-') { clean = true; args.shift(); }
      const extra = {};
      while (args.length && /^[A-Za-z_]\w*=/.test(args[0])) { const a = args.shift(); const eq = a.indexOf('='); extra[a.slice(0, eq)] = a.slice(eq + 1); }
      const env = Object.assign(clean ? {} : Object.assign({}, ctx.env), extra);
      if (!args.length) { for (const [k, v] of Object.entries(env)) ctx.println(`${k}=${v}`); return 0; }
      return ctx.shell.dispatch(args, ctx.io, { env: extra, noBuiltin: false });
    },
  });
  def('printenv', {
    run(ctx) {
      if (!ctx.args.length) { for (const [k, v] of Object.entries(ctx.env)) ctx.println(`${k}=${v}`); return 0; }
      let st = 0;
      for (const k of ctx.args) { if (k in ctx.env) ctx.println(ctx.env[k]); else st = 1; }
      return st;
    },
  });

  def('which', {
    run(ctx) {
      const all = ctx.args.includes('-a');
      const names = ctx.args.filter((a) => !a.startsWith('-'));
      let st = 0;
      for (const n of names) {
        const P = (ctx.shell.getVar('PATH') || '').split(':');
        let found = false;
        for (const d of P) {
          const p = VFS.normalize(VFS.join(d || '.', n), ctx.cwd);
          const node = ctx.fs.tryGet(p, ctx.user);
          if (node && node.type === 'file' && ctx.fs.can(node, ctx.user, 1)) {
            ctx.println(VFS.join(d || '.', n));
            found = true;
            if (!all) break;
          }
        }
        if (n.includes('/')) {
          const node = ctx.fs.tryGet(ctx.abs(n), ctx.user);
          if (node && node.type === 'file' && ctx.fs.can(node, ctx.user, 1)) { ctx.println(n); found = true; }
        }
        if (!found) st = 1;
      }
      return st;
    },
  });

  def('whereis', {
    run(ctx) {
      for (const n of ctx.args.filter((a) => !a.startsWith('-'))) {
        const parts = [n + ':'];
        for (const d of ['/usr/bin', '/usr/sbin', '/usr/local/bin', '/usr/games', '/etc']) {
          const node = ctx.fs.tryGet(VFS.join(d, n), 'root');
          if (node) parts.push(VFS.join(d, n));
        }
        if (LA.man && LA.man[n] && !LA.builtinNames.has(n)) parts.push(`/usr/share/man/man${LA.man[n].section || 1}/${n}.${LA.man[n].section || 1}.gz`);
        ctx.println(parts.join(' '));
      }
      return 0;
    },
  });

  /* ---------- manuals ---------- */
  function renderMan(name, page, tty) {
    const osName = (LA.game && LA.game.world && LA.game.world.sys.os) || 'GNU/Linux';
    const b = (s) => (tty ? '\x1b[1m' + s + '\x1b[0m' : s);
    const u = (s) => (tty ? '\x1b[4m' + s + '\x1b[0m' : s);
    const sec = page.section || 1;
    const head = `${name.toUpperCase()}(${sec})`;
    const center = sec === 1 ? 'User Commands' : sec === 8 ? 'System Administration' : sec === 5 ? 'File Formats' : sec === 7 ? 'Miscellanea' : `${osName.split(' ')[0]} Manual`;
    const gap = Math.max(1, 78 - head.length * 2 - center.length);
    let out = head + ' '.repeat(Math.floor(gap / 2)) + center + ' '.repeat(Math.ceil(gap / 2)) + head + '\n\n';
    out += b('NAME') + '\n       ' + name + ' - ' + page.desc + '\n\n';
    out += b('SYNOPSIS') + '\n' + page.syn.split('\n').map((l) => '       ' + l.replace(/^(\S+)/, (m) => b(m))).join('\n') + '\n\n';
    out += b('DESCRIPTION') + '\n' + wrap(page.text, 71, '       ') + '\n';
    if (page.opts && page.opts.length) {
      out += '\n' + b('OPTIONS') + '\n';
      for (const [f, d] of page.opts) out += '       ' + b(f) + '\n' + wrap(d, 64, '              ') + '\n\n';
    }
    if (page.ex && page.ex.length) {
      out += (page.opts && page.opts.length ? '' : '\n') + b('EXAMPLES') + '\n';
      for (const [c, d] of page.ex) out += '       ' + u(c) + '\n' + wrap(d, 64, '              ') + '\n\n';
    }
    if (page.see) out += b('SEE ALSO') + '\n       ' + page.see.split(/\s*,\s*/).map((x) => b(x) + '(1)').join(', ') + '\n\n';
    out += `${U.padR(osName.replace(/ GNU\/Linux/, ''), 36)}${new Date(LA.now()).getFullYear()}                       ${head}\n`;
    return out;
  }
  function wrap(text, width, indent) {
    const out = [];
    for (const para of String(text).split('\n')) {
      if (!para.trim()) { out.push(''); continue; }
      let line = '';
      for (const w of para.split(/\s+/)) {
        if ((line + ' ' + w).trim().length > width) { out.push(indent + line); line = w; }
        else line = line ? line + ' ' + w : w;
      }
      if (line) out.push(indent + line);
    }
    return out.join('\n');
  }
  LA.renderMan = renderMan;
  LA.manHelp = (name) => {
    const p = LA.man && LA.man[name];
    if (!p) return `Usage: ${name} [OPTION]...\n`;
    let s = `Usage: ${p.syn.split('\n')[0]}\n${p.desc.charAt(0).toUpperCase() + p.desc.slice(1)}.\n`;
    if (p.opts && p.opts.length) { s += '\n'; for (const [f, d] of p.opts) s += `  ${U.padR(f, 24)} ${d}\n`; }
    s += `\nFull documentation: man ${name}\n`;
    return s;
  };

  def('man', {
    ownHelp: true,
    async run(ctx) {
      const args = ctx.args.filter((a) => !/^\d$/.test(a));
      if (args[0] === '-k') return LA.commands.apropos.run(Object.assign({}, ctx, { args: args.slice(1) }));
      if (args[0] === '-f') return LA.commands.whatis.run(Object.assign({}, ctx, { args: args.slice(1) }));
      if (!args.length) { ctx.err.write('What manual page do you want?\nFor example, try \'man man\'.\n'); return 1; }
      const name = args[0];
      const page = LA.man && LA.man[name];
      if (!page) { ctx.err.write(`No manual entry for ${name}\n`); return 16; }
      if (ctx.game) ctx.game.noteMan(name);
      const text = renderMan(name, page, true);
      if (ctx.isTTY && ctx.ui.page) await ctx.ui.page(text, { title: `Manual page ${name}(${page.section || 1})`, name: 'man' });
      else ctx.print(U.stripAnsi(text));
      return 0;
    },
  });
  def('whatis', {
    run(ctx) {
      let st = 0;
      for (const n of ctx.args) {
        const p = LA.man && LA.man[n];
        if (!p) { ctx.err.write(`${n}: nothing appropriate.\n`); st = 16; continue; }
        ctx.println(`${U.padR(`${n} (${p.section || 1})`, 20)} - ${p.desc}`);
      }
      return st;
    },
  });
  def('apropos', {
    run(ctx) {
      if (!ctx.args.length) { ctx.err.write('apropos what?\n'); return 1; }
      const kw = ctx.args.join(' ').toLowerCase();
      const hits = Object.keys(LA.man || {}).filter((n) => n.toLowerCase().includes(kw) || LA.man[n].desc.toLowerCase().includes(kw)).sort();
      if (!hits.length) { ctx.err.write(`${kw}: nothing appropriate.\n`); return 16; }
      for (const n of hits) ctx.println(`${U.padR(`${n} (${LA.man[n].section || 1})`, 20)} - ${LA.man[n].desc}`);
      return 0;
    },
  });

  def('clear', { run(ctx) { if (ctx.ui.clear) ctx.ui.clear(); return 0; } });
  LA.commands.reset = LA.commands.clear;

  /* ---------- sudo / su / passwd ---------- */
  async function authenticate(ctx, user, label) {
    const world = ctx.world;
    if (user === 'root') return true;
    if (world.sudoValid(user)) return true;
    for (let tries = 0; tries < 3; tries++) {
      const pw = await ctx.ui.prompt(label || `[sudo] password for ${user}: `, { hidden: true, signal: ctx.signal });
      if (pw === null) { ctx.err.write('sudo: a password is required\n'); return false; }
      if (world.checkPassword(user, pw)) { world.touchSudo(user); return true; }
      ctx.err.write(tries < 2 ? 'Sorry, try again.\n' : 'sudo: 3 incorrect password attempts\n');
      if (ctx.game) ctx.game.onBadPassword(user);
    }
    return false;
  }
  LA.authenticate = authenticate;

  def('sudo', {
    ownHelp: true,
    async run(ctx) {
      const args = ctx.args.slice();
      let target = 'root', login = false, shell = false, list = false, kill = false, validate = false;
      while (args.length && args[0].startsWith('-')) {
        const a = args.shift();
        if (a === '--') break;
        if (a === '-u') { target = args.shift(); continue; }
        if (a === '-i') { login = true; continue; }
        if (a === '-s') { shell = true; continue; }
        if (a === '-l') { list = true; continue; }
        if (a === '-k' || a === '-K') { kill = true; continue; }
        if (a === '-v') { validate = true; continue; }
        if (a === '-E' || a === '-H' || a === '-n') continue;
        if (a === '--help' || a === '-h') { ctx.println('usage: sudo [-u user] [-i | -s] [command [arg ...]]\n       sudo -l | -k | -v'); return 0; }
        ctx.err.write(`sudo: invalid option -- '${a.slice(1)}'\nusage: sudo [-u user] [-i | -s] [command [arg ...]]\n`);
        return 1;
      }
      const user = ctx.user;
      if (kill) { ctx.world.resetSudo(user); if (!args.length) return 0; }
      if (!args.length && !login && !shell && !list && !validate) { ctx.err.write('usage: sudo -h | -K | -k | -V\nusage: sudo -v [-AknS] [-g group] [-h host] [-p prompt] [-u user]\nusage: sudo [-u user] [-i | -s] [command [arg ...]]\n'); return 1; }
      if (!ctx.fs.users.exists(target)) { ctx.err.write(`sudo: unknown user ${target}\nsudo: error initializing audit plugin sudoers_audit\n`); return 1; }
      if (user !== 'root' && !ctx.world.isSudoer(user, ctx.host)) {
        const pw = await ctx.ui.prompt(`[sudo] password for ${user}: `, { hidden: true, signal: ctx.signal });
        void pw;
        ctx.err.write(`${user} is not in the sudoers file.\n`);
        return 1;
      }
      if (!(await authenticate(ctx, user))) return 1;
      if (validate) return 0;
      if (list) {
        ctx.println(`Matching Defaults entries for ${user} on ${ctx.host.name}:\n    env_reset, mail_badpass, secure_path=/usr/local/sbin\\:/usr/local/bin\\:/usr/sbin\\:/usr/bin\\:/sbin\\:/bin\n\nUser ${user} may run the following commands on ${ctx.host.name}:\n    (ALL : ALL) ALL`);
        return 0;
      }
      ctx.world.logAuth(`sudo: ${U.padL(user, 8)} : TTY=${ctx.shell.tty} ; PWD=${ctx.cwd} ; USER=${target} ; COMMAND=${login || shell ? '/bin/bash' : args.join(' ')}`);
      if (ctx.game) ctx.game.onSudo(user, args);
      if (login || shell || (args[0] === 'su' && args.length <= 2) || ((args[0] === 'bash' || args[0] === 'sh') && args.length === 1)) {
        let tu = target;
        if (args[0] === 'su') { const rest = args.slice(1).filter((a) => a !== '-' && a !== '-l'); tu = rest[0] || 'root'; login = login || args.includes('-') || args.includes('-l'); }
        return ctx.ui.pushShell({ user: tu, login: login || args[0] === 'su', host: ctx.host, cwd: login ? null : ctx.cwd, from: ctx.shell });
      }
      return ctx.shell.dispatch(args, ctx.io, { user: target, sudo: true, noBuiltin: true, noFunc: true });
    },
  });

  def('su', {
    async run(ctx) {
      const args = ctx.args.filter((a) => a !== '-' && a !== '-l' && a !== '--login');
      const login = ctx.args.includes('-') || ctx.args.includes('-l') || ctx.args.includes('--login');
      const cIdx = args.indexOf('-c');
      let cmd = null;
      if (cIdx >= 0) { cmd = args[cIdx + 1]; args.splice(cIdx, 2); }
      const target = args[0] || 'root';
      if (!ctx.fs.users.exists(target)) { ctx.err.write(`su: user ${target} does not exist or the user entry does not contain all the required fields\n`); return 1; }
      if (ctx.user !== 'root') {
        const pw = await ctx.ui.prompt('Password: ', { hidden: true, signal: ctx.signal });
        if (pw === null || !ctx.world.checkPassword(target, pw)) {
          ctx.err.write('su: Authentication failure\n');
          if (ctx.game) ctx.game.onSuFail(target);
          return 1;
        }
      }
      if (cmd) {
        const sh = ctx.shell.spawnChild({ script: true, user: target });
        const ast = LA.parse(cmd, null);
        return sh.execList(ast, ctx.io);
      }
      return ctx.ui.pushShell({ user: target, login, host: ctx.host, cwd: login ? null : ctx.cwd, from: ctx.shell });
    },
  });

  def('passwd', {
    async run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'luSde' });
      const world = ctx.world;
      const target = operands[0] || ctx.user;
      if (target !== ctx.user && ctx.user !== 'root') { ctx.err.write(`passwd: You may not view or modify password information for ${target}.\n`); return 1; }
      if (!ctx.fs.users.exists(target)) { ctx.err.write(`passwd: user '${target}' does not exist\n`); return 1; }
      const u = ctx.fs.users.get(target);
      if (o.S) { ctx.println(`${target} ${u.locked ? 'L' : 'P'} ${U.strftime('%m/%d/%Y', new Date(world.bootTime))} 0 99999 7 -1`); return 0; }
      if (o.l || o.u) {
        if (ctx.user !== 'root') { ctx.err.write('passwd: Permission denied.\n'); return 1; }
        u.locked = !!o.l;
        world.syncAccounts(ctx.host);
        ctx.println(`passwd: password changed.`);
        if (ctx.game) ctx.game.onAccountChange(target, o.l ? 'lock' : 'unlock');
        return 0;
      }
      if (ctx.user !== 'root') ctx.println(`Changing password for ${target}.`);
      if (ctx.user !== 'root') {
        const cur = await ctx.ui.prompt('Current password: ', { hidden: true, signal: ctx.signal });
        if (cur === null) return 1;
        if (!world.checkPassword(target, cur)) { ctx.err.write('passwd: Authentication token manipulation error\npasswd: password unchanged\n'); return 10; }
      }
      const p1 = await ctx.ui.prompt('New password: ', { hidden: true, signal: ctx.signal });
      if (p1 === null) return 1;
      if (p1.length < 4) { ctx.err.write('BAD PASSWORD: The password is shorter than 4 characters\npasswd: Authentication token manipulation error\npasswd: password unchanged\n'); return 10; }
      const p2 = await ctx.ui.prompt('Retype new password: ', { hidden: true, signal: ctx.signal });
      if (p2 === null) return 1;
      if (p1 !== p2) { ctx.err.write('Sorry, passwords do not match.\npasswd: Authentication token manipulation error\npasswd: password unchanged\n'); return 10; }
      world.setPassword(target, p1);
      ctx.println('passwd: password updated successfully');
      if (ctx.game) ctx.game.onPasswordChange(target);
      return 0;
    },
  });

  function needRoot(ctx, name) {
    if (ctx.user === 'root') return true;
    ctx.err.write(`${name}: Permission denied.\n${name}: cannot lock /etc/passwd; try again later.\n`);
    return false;
  }
  def('userdel', {
    run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'rf', long: { remove: 'r', force: 'f' } });
      if (!needRoot(ctx, 'userdel')) return 1;
      const name = operands[0];
      if (!name) { ctx.err.write('Usage: userdel [options] LOGIN\n'); return 2; }
      const users = ctx.fs.users;
      if (!users.exists(name)) { ctx.err.write(`userdel: user '${name}' does not exist\n`); return 6; }
      if (name === 'root') { ctx.err.write('userdel: user root is currently used by process 1\n'); return 8; }
      if (name === ctx.shell.user || (ctx.shell.parent && name === ctx.shell.parent.user)) { ctx.err.write(`userdel: user ${name} is currently used by process ${ctx.shell.pid}\n`); return 8; }
      const p = ctx.world.procs.find((x) => x.user === name && x.host === ctx.host.name);
      if (p && !o.f) { ctx.err.write(`userdel: user ${name} is currently used by process ${p.pid}\n`); return 8; }
      const home = users.get(name).home;
      users.ghosts[name] = users.get(name).uid;
      if (users.groups[name]) users.ghosts['g:' + name] = users.groups[name].gid;
      delete users.users[name];
      for (const g of Object.values(users.groups)) g.members = g.members.filter((m) => m !== name);
      if (users.groups[name] && !Object.values(users.users).some((u) => u.gid === users.groups[name].gid)) delete users.groups[name];
      ctx.world.syncAccounts(ctx.host);
      if (o.r) {
        const mail = ctx.fs.tryGet(`/var/mail/${name}`);
        if (mail) ctx.fs.remove(`/var/mail/${name}`);
        else ctx.err.write(`userdel: ${name} mail spool (/var/mail/${name}) not found\n`);
        if (home && home !== '/' && ctx.fs.tryGet(home, 'root', false)) {
          const n = ctx.fs.tryGet(home, 'root', false);
          if (n.immutable) ctx.err.write(`userdel: error removing directory ${home}\n`);
          else ctx.fs.remove(home);
        }
      }
      if (ctx.game) ctx.game.onAccountChange(name, 'delete');
      return 0;
    },
  });

  def('useradd', {
    run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'mM', params: 'sdcgG' });
      if (!needRoot(ctx, 'useradd')) return 1;
      const name = operands[0];
      if (!name || !/^[a-z_][a-z0-9_-]{0,31}$/.test(name)) { ctx.err.write(`useradd: invalid user name '${name || ''}'\n`); return 3; }
      const users = ctx.fs.users;
      if (users.exists(name)) { ctx.err.write(`useradd: user '${name}' already exists\n`); return 9; }
      let uid = 1000;
      while (Object.values(users.users).some((u) => u.uid === uid)) uid++;
      users.groups[name] = { gid: uid, members: [] };
      users.users[name] = { uid, gid: uid, home: o.d || `/home/${name}`, shell: o.s || '/bin/sh', gecos: o.c || '' };
      if (o.G) for (const g of o.G.split(',')) if (users.groups[g]) users.groups[g].members.push(name);
      if (o.m) { ctx.fs.dir(users.users[name].home, { owner: name, mode: 0o755 }); }
      ctx.world.syncAccounts(ctx.host);
      return 0;
    },
  });

  def('usermod', {
    run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'LUa', params: 'Gsdc' });
      if (!needRoot(ctx, 'usermod')) return 1;
      const name = operands[0];
      const users = ctx.fs.users;
      if (!name || !users.exists(name)) { ctx.err.write(`usermod: user '${name || ''}' does not exist\n`); return 6; }
      const u = users.get(name);
      if (o.L) u.locked = true;
      if (o.U) u.locked = false;
      if (o.s) u.shell = o.s;
      if (o.c) u.gecos = o.c;
      if (o.G) {
        for (const g of o.G.split(',')) {
          if (!users.groups[g]) { ctx.err.write(`usermod: group '${g}' does not exist\n`); return 6; }
          if (!users.groups[g].members.includes(name)) users.groups[g].members.push(name);
        }
        if (!o.a) for (const [g, v] of Object.entries(users.groups)) if (!o.G.split(',').includes(g)) v.members = v.members.filter((m) => m !== name);
      }
      ctx.world.syncAccounts(ctx.host);
      if (ctx.game) ctx.game.onAccountChange(name, o.L ? 'lock' : 'modify');
      return 0;
    },
  });

  def('chsh', { run(ctx) { ctx.err.write('chsh: this system only speaks bash.\n'); return 1; } });

  /* ---------- sessions ---------- */
  def('who', {
    run(ctx) {
      const sess = ctx.world.sessions.filter((s) => s.host === ctx.host.name);
      if (ctx.args.includes('-q')) { ctx.println(sess.map((s) => s.user).join(' ')); ctx.println(`# users=${sess.length}`); return 0; }
      if (ctx.args.includes('-b')) { ctx.println(`         system boot  ${U.stamp(ctx.world.bootTime).slice(0, 16)}`); return 0; }
      const mine = ctx.args.join(' ') === 'am i' || ctx.args.includes('-m');
      for (const s of sess) {
        if (mine && s.tty !== ctx.shell.tty) continue;
        ctx.println(`${U.padR(s.user, 8)} ${U.padR(s.tty, 12)} ${U.stamp(s.at).slice(0, 16)}${s.from ? ` (${s.from})` : ''}`);
      }
      return 0;
    },
  });
  def('w', {
    run(ctx) {
      const sess = ctx.world.sessions.filter((s) => s.host === ctx.host.name);
      ctx.println(LA.uptimeLine(ctx.world));
      ctx.println('USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT');
      for (const s of sess) {
        ctx.println(`${U.padR(s.user, 8)} ${U.padR(s.tty, 8)} ${U.padR(s.from || '-', 16)} ${U.strftime('%H:%M', new Date(s.at))}   ${U.padR(s.idle || '0.00s', 6)} ${U.padL('0.05s', 6)} ${U.padL('0.01s', 6)} ${s.what || '-bash'}`);
      }
      return 0;
    },
  });
  def('last', {
    run(ctx) {
      const n = ctx.args.find((a) => /^-?\d+$/.test(a));
      const who = ctx.args.find((a) => /^[a-z]/.test(a));
      let rows = ctx.world.wtmp.filter((r) => r.host === ctx.host.name && (!who || r.user === who));
      rows = rows.slice().sort((a, b) => b.at - a.at);
      if (n) rows = rows.slice(0, Math.abs(parseInt(n, 10)));
      for (const r of rows) {
        const live = !r.out && ctx.world.sessions.find((s) => s.user === r.user && s.tty === r.tty && s.host === r.host);
        const d = new Date(r.at);
        ctx.println(`${U.padR(r.user, 8)} ${U.padR(r.tty, 12)} ${U.padR(r.from || '', 16)} ${U.DAY[d.getDay()]} ${U.MON[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${U.strftime('%H:%M', d)}   ${live ? 'still logged in' : r.out || '- crash'}`);
      }
      ctx.println(`\nwtmp begins ${U.dateString(new Date(ctx.world.bootTime - 86400000 * 40))}`);
      return 0;
    },
  });

  /* ---------- services ---------- */
  const unitName = (s) => (s || '').replace(/\.service$/, '');
  def('systemctl', {
    async run(ctx) {
      const args = ctx.args.filter((a) => !a.startsWith('--') || a.startsWith('--type'));
      const flags = ctx.args.filter((a) => a.startsWith('--'));
      const verb = args[0] || 'list-units';
      const world = ctx.world;
      const units = args.slice(1).map(unitName);
      const noRoot = (what, u) => { ctx.err.write(`Failed to ${what} ${u}.service: Interactive authentication required.\nSee system logs and 'systemctl status ${u}.service' for details.\n`); return 1; };
      const need = (u) => { const s = world.services[u]; if (!s) ctx.err.write(`Unit ${u}.service could not be found.\n`); return s; };
      switch (verb) {
        case 'status': {
          if (!units.length) { ctx.println(`● ${ctx.host.name}\n    State: running\n     Jobs: 0 queued\n   Failed: 0 units\n    Since: ${U.dateString(new Date(world.bootTime))}`); return 0; }
          let st = 0;
          for (const u of units) {
            const s = need(u);
            if (!s) { st = 4; continue; }
            ctx.print(world.statusText(u, ctx.isTTY));
            if (!s.active) st = 3;
          }
          return st;
        }
        case 'is-active': { let st = 0; for (const u of units) { const s = world.services[u]; ctx.println(s ? (s.active ? 'active' : 'inactive') : 'inactive'); if (!s || !s.active) st = 3; } return st; }
        case 'is-enabled': { let st = 0; for (const u of units) { const s = world.services[u]; ctx.println(s ? (s.enabled ? 'enabled' : 'disabled') : 'not-found'); if (!s || !s.enabled) st = 1; } return st; }
        case 'start': case 'stop': case 'restart': case 'reload': case 'enable': case 'disable': {
          if (!units.length) { ctx.err.write(`Too few arguments.\n`); return 1; }
          for (const u of units) {
            const s = need(u);
            if (!s) return 5;
            if (ctx.user !== 'root') return noRoot(verb, u);
            const r = world.serviceAction(u, verb, flags.includes('--now'));
            if (r) ctx.print(r);
            if (ctx.game) ctx.game.onService(u, verb);
          }
          return 0;
        }
        case 'daemon-reload': if (ctx.user !== 'root') { ctx.err.write('Failed to reload daemon: Interactive authentication required.\n'); return 1; } return 0;
        case 'list-units': case 'list-unit-files': {
          ctx.println(verb === 'list-units' ? '  UNIT                      LOAD   ACTIVE   SUB     DESCRIPTION' : 'UNIT FILE                 STATE    VENDOR PRESET');
          for (const [n, s] of Object.entries(world.services).sort()) {
            if (verb === 'list-units') ctx.println(`  ${U.padR(n + '.service', 25)} loaded ${U.padR(s.active ? 'active' : 'inactive', 8)} ${U.padR(s.active ? 'running' : 'dead', 7)} ${s.desc}`);
            else ctx.println(`${U.padR(n + '.service', 25)} ${U.padR(s.enabled ? 'enabled' : 'disabled', 8)} enabled`);
          }
          ctx.println(`\n${Object.keys(world.services).length} ${verb === 'list-units' ? 'loaded units listed' : 'unit files listed'}.`);
          return 0;
        }
        default:
          ctx.err.write(`Unknown command verb '${verb}'.\n`);
          return 1;
      }
    },
  });

  def('journalctl', {
    async run(ctx) {
      const args = ctx.args;
      let unit = null, n = null, follow = false, reverse = false, noPager = false, kernel = false, grepPat = null;
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-u' || a === '--unit') unit = unitName(args[++i]);
        else if (a.startsWith('-u') && a.length > 2) unit = unitName(a.slice(2));
        else if (a.startsWith('--unit=')) unit = unitName(a.slice(7));
        else if (a === '-n' || a === '--lines') n = parseInt(args[++i], 10);
        else if (/^-n\d+$/.test(a)) n = parseInt(a.slice(2), 10);
        else if (a === '-f' || a === '--follow') follow = true;
        else if (a === '-r' || a === '--reverse') reverse = true;
        else if (a === '--no-pager') noPager = true;
        else if (a === '-k' || a === '--dmesg') kernel = true;
        else if (a === '-g' || a === '--grep') grepPat = args[++i];
        else if (a === '-e' || a === '-b' || a === '-x' || a === '--since' || a === '-p') { if (a === '--since' || a === '-p') i++; }
      }
      let entries = ctx.world.journal.filter((e) => e.host === ctx.host.name);
      if (unit) entries = entries.filter((e) => e.unit === unit);
      if (kernel) entries = entries.filter((e) => e.ident === 'kernel');
      if (grepPat) { const re = new RegExp(U.reToJs(grepPat, true), 'i'); entries = entries.filter((e) => re.test(e.msg)); }
      entries = entries.slice().sort((a, b) => a.t - b.t);
      if (n !== null) entries = entries.slice(-n);
      if (follow && n === null) entries = entries.slice(-10);
      if (reverse) entries.reverse();
      const lines = entries.map((e) => `${U.syslogDate(e.t)} ${ctx.host.name} ${e.ident}${e.pid ? `[${e.pid}]` : ''}: ${e.msg}`);
      if (!lines.length) lines.push('-- No entries --');
      const text = lines.join('\n') + '\n';
      if (ctx.isTTY && !noPager && !follow && lines.length > 30 && ctx.ui.page) await ctx.ui.page(text, { title: 'journalctl', name: 'less' });
      else ctx.print(text);
      if (follow && ctx.isTTY) {
        ctx.err.write(LA.paint(LA.ansi.gray, '(following — press Ctrl+C to stop)') + '\n');
        await new Promise((res) => ctx.signal.on(res));
      }
      return 0;
    },
  });

  def('crontab', {
    async run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'lerid', params: 'u' });
      const fs = ctx.fs;
      let who = ctx.user;
      if (o.u) {
        if (ctx.user !== 'root') { ctx.err.write('crontab: must be privileged to use -u\n'); return 1; }
        who = o.u;
        if (!fs.users.exists(who)) { ctx.err.write(`crontab: user '${who}' unknown\n`); return 1; }
      }
      const path = `${LA.cronSpool(ctx.world)}/${who}`;
      const node = fs.tryGet(path, 'root');
      if (o.l) {
        if (!node) { ctx.err.write(`no crontab for ${who}\n`); return 1; }
        ctx.print(fs.contentOf(node));
        if (ctx.game) ctx.game.noteRead(path, ctx.host.name, ctx.user);
        return 0;
      }
      if (o.r) {
        if (!node) { ctx.err.write(`no crontab for ${who}\n`); return 1; }
        fs.remove(path);
        if (ctx.game) ctx.game.onCrontab(who, 'remove');
        return 0;
      }
      if (o.e) {
        const content = node ? fs.contentOf(node) : '# Edit this file to introduce tasks to be run by cron.\n#\n# m h  dom mon dow   command\n';
        let saved = null;
        await ctx.ui.edit({ filename: `/tmp/crontab.${Math.random().toString(36).slice(2, 8)}/crontab`, content, editor: 'nano', onSave: (t) => { saved = t; return { ok: true, lines: U.lines(t).length }; } });
        if (saved !== null && saved !== content) {
          if (node) fs.remove(path);
          fs.put(path, saved, { owner: who, group: 'crontab', mode: 0o600 });
          ctx.println('crontab: installing new crontab');
          if (ctx.game) ctx.game.onCrontab(who, 'edit');
        } else ctx.println('No modification made');
        return 0;
      }
      if (operands[0]) {
        const r = await LA.readArg(ctx, operands[0]);
        if (r.error) { ctx.err.write(`crontab: ${operands[0]}: ${r.error}\n`); return 1; }
        if (node) fs.remove(path);
        fs.put(path, r.text, { owner: who, group: 'crontab', mode: 0o600 });
        if (ctx.game) ctx.game.onCrontab(who, 'install');
        return 0;
      }
      ctx.err.write("crontab: usage error: file name or - (for stdin) must be specified\nusage:\tcrontab [-u user] [ -e | -l | -r ]\n");
      return 1;
    },
  });

  /* ---------- disks ---------- */
  def('lsblk', {
    run(ctx) {
      const f = ctx.args.includes('-f');
      const disks = ctx.world.disks;
      const rows = [f ? ['NAME', 'FSTYPE', 'LABEL', 'UUID', 'MOUNTPOINTS'] : ['NAME', 'MAJ:MIN', 'RM', 'SIZE', 'RO', 'TYPE', 'MOUNTPOINTS']];
      for (const d of disks) {
        rows.push(f ? [d.name, '', '', '', ''] : [d.name, d.majmin, d.rm, d.size, '0', 'disk', '']);
        d.parts.forEach((p, i) => {
          const pre = i === d.parts.length - 1 ? '└─' : '├─';
          const mp = ctx.world.mountPointOf('/dev/' + p.name) || p.fixedMount || '';
          rows.push(f ? [pre + p.name, p.fstype, p.label || '', p.uuid, mp] : [pre + p.name, p.majmin, d.rm, p.size, '0', 'part', mp]);
        });
      }
      const w = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
      const right = f ? [] : [2, 3, 4];
      for (const r of rows) ctx.println(r.map((c, i) => (i === r.length - 1 ? c : right.includes(i) ? U.padL(c, w[i]) : U.padR(c, w[i]))).join(' ').replace(/\s+$/, ''));
      return 0;
    },
  });

  def('mount', {
    run(ctx) {
      const pos = ctx.args.filter((a, i) => !a.startsWith('-') && !(['-t', '-o'].includes(ctx.args[i - 1])));
      const world = ctx.world;
      if (!pos.length) {
        for (const m of world.mounts) ctx.println(`${m.dev} on ${m.path} type ${m.type} (${m.opts})`);
        return 0;
      }
      if (pos.length < 2) {
        const entry = world.fstab().find((e) => e.path === pos[0] || e.dev === pos[0]);
        if (!entry) { ctx.err.write(`mount: ${pos[0]}: can't find in /etc/fstab.\n`); return 1; }
        pos.length = 0;
        pos.push(entry.dev, entry.path);
      }
      if (ctx.user !== 'root') { ctx.err.write(`mount: ${pos[1]}: must be superuser to use mount.\n       dmesg(1) may have more information after failed mount system call.\n`); return 32; }
      const r = world.mount(pos[0], pos[1], ctx.args.includes('ro') || ctx.args.includes('-r'));
      if (r) { ctx.err.write(r); return 32; }
      if (ctx.game) ctx.game.onMount(pos[0], VFS.normalize(pos[1], ctx.cwd));
      return 0;
    },
  });
  def('umount', {
    run(ctx) {
      const t = ctx.args.find((a) => !a.startsWith('-'));
      if (!t) { ctx.err.write('Usage:\n umount [-hV]\n umount -a [options]\n umount [options] <source> | <directory>\n'); return 1; }
      if (ctx.user !== 'root') { ctx.err.write(`umount: ${t}: must be superuser to unmount.\n`); return 32; }
      const r = ctx.world.umount(VFS.normalize(t, ctx.cwd), ctx.ui.allShells ? ctx.ui.allShells() : [ctx.shell]);
      if (r) { ctx.err.write(r); return 32; }
      return 0;
    },
  });

  def('dmesg', {
    run(ctx) {
      if (ctx.user !== 'root') { ctx.err.write('dmesg: read kernel buffer failed: Operation not permitted\n'); return 1; }
      const human = ctx.args.includes('-T') || ctx.args.includes('-H');
      for (const k of ctx.world.dmesg) {
        const ts = human ? `[${U.dateString(new Date(ctx.world.bootTime + k.s * 1000))}]` : `[${k.s.toFixed(6).padStart(12)}]`;
        ctx.println(`${ts} ${k.msg}`);
      }
      return 0;
    },
  });

  /* packages: see pkg.js */

  /* ---------- misc ---------- */
  def('sleep', {
    interruptible: true,
    async run(ctx) {
      if (!ctx.args.length) { ctx.err.write("sleep: missing operand\nTry 'sleep --help' for more information.\n"); return 1; }
      let ms = 0;
      for (const a of ctx.args) {
        const m = a.match(/^(\d*\.?\d+)([smhd]?)$/);
        if (!m) { ctx.err.write(`sleep: invalid time interval '${a}'\nTry 'sleep --help' for more information.\n`); return 1; }
        ms += parseFloat(m[1]) * { '': 1000, s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]];
      }
      const ok = await ctx.sleep(ms);
      return ok ? 0 : 130;
    },
  });

  def('watch', {
    interruptible: true,
    async run(ctx) {
      const args = ctx.args.slice();
      let n = 2;
      while (args.length && args[0].startsWith('-')) {
        const a = args.shift();
        if (a === '-n' || a === '--interval') n = parseFloat(args.shift());
        else if (/^-n\d/.test(a)) n = parseFloat(a.slice(2));
      }
      if (!args.length) { ctx.err.write('Usage:\n watch [options] command\n'); return 1; }
      const cmd = args.join(' ');
      if (!ctx.isTTY) { await runString(ctx, cmd); return 0; }
      while (!ctx.signal.aborted) {
        if (ctx.ui.clear) ctx.ui.clear();
        const head = `Every ${n.toFixed(1)}s: ${cmd}`;
        const right = `${ctx.host.name}: ${U.dateString(new Date(LA.now()))}`;
        ctx.println(head + ' '.repeat(Math.max(2, (ctx.ui.columns || 80) - head.length - right.length)) + right + '\n');
        await runString(ctx, cmd);
        if (!(await ctx.sleep(n * 1000))) break;
      }
      return 0;
    },
  });
  async function runString(ctx, cmd) {
    const sh = ctx.shell.spawnChild({ script: false });
    try {
      const ast = LA.parse(cmd, ctx.shell.aliases);
      return await sh.execList(ast, { stdin: null, out: ctx.out, err: ctx.err });
    } catch (e) {
      if (e instanceof LA.ExitSignal) return e.code;
      if (e instanceof LA.Interrupt) return 130;
      ctx.err.write(`sh: ${e.message}\n`);
      return 2;
    }
  }
  LA.runString = runString;

  def('nohup', {
    async run(ctx) {
      if (!ctx.args.length) { ctx.err.write("nohup: missing operand\nTry 'nohup --help' for more information.\n"); return 125; }
      let out = ctx.out;
      if (ctx.isTTY) {
        ctx.err.write("nohup: ignoring input and appending output to 'nohup.out'\n");
        const abs = ctx.abs('nohup.out');
        try { ctx.fs.writeFile(abs, '', { user: ctx.user, append: true, umask: ctx.shell.umask }); }
        catch (e) { ctx.err.write(`nohup: failed to open 'nohup.out': ${e.message}\n`); return 125; }
        const fs = ctx.fs;
        out = { write: (s) => fs.writeFile(abs, s, { user: 'root', append: true }) };
      }
      return ctx.shell.dispatch(ctx.args, { stdin: new LA.InStream(''), out, err: out });
    },
  });

  const bashImpl = {
    ownHelp: true,
    async run(ctx) {
      const args = ctx.args.slice();
      let xtrace = false;
      while (args.length && /^-[xvnelis]+$/.test(args[0]) && args[0] !== '-c') { if (args[0].includes('x')) xtrace = true; args.shift(); }
      if (args[0] === '-c') {
        const src = args[1] || '';
        /* run as whoever ran bash — root, under «sudo bash -c» */
        const sh = ctx.shell.spawnChild({ script: true, user: ctx.user, scriptName: args[2] || ctx.argv[0] });
        sh.positional = args.slice(3);
        sh.xtrace = xtrace;
        try { return await sh.execList(LA.parse(src, null), ctx.io); }
        catch (e) {
          if (e instanceof LA.ExitSignal) return e.code;
          if (e instanceof LA.Interrupt) throw e;
          ctx.err.write(`${ctx.argv[0]}: -c: ${e.incomplete ? 'syntax error: unexpected end of file' : e.message}\n`);
          return 2;
        }
      }
      if (args[0] === '--version') { ctx.println('GNU bash, version 5.2.15(1)-release (x86_64-pc-linux-gnu)\nCopyright (C) 2022 Free Software Foundation, Inc.'); return 0; }
      if (!args.length) {
        if (!ctx.stdinTTY) {
          const src = await ctx.readInput();
          const sh = ctx.shell.spawnChild({ script: true, user: ctx.user });
          try { return await sh.execList(LA.parse(src, null), { stdin: null, out: ctx.out, err: ctx.err }); } catch (e) { if (e instanceof LA.ExitSignal) return e.code; ctx.err.write(`bash: ${e.message}\n`); return 2; }
        }
        return ctx.ui.pushShell({ user: ctx.user, login: false, host: ctx.host, cwd: ctx.cwd, from: ctx.shell, nested: true });
      }
      const f = args[0];
      const abs = ctx.abs(f);
      let src;
      try {
        const node = ctx.fs.get(abs, ctx.user);
        if (node.type === 'dir') { ctx.err.write(`${ctx.argv[0]}: ${f}: Is a directory\n`); return 126; }
        src = ctx.fs.readFile(abs, ctx.user);
      } catch (e) { ctx.err.write(`${ctx.argv[0]}: ${f}: ${e.message}\n`); return 127; }
      if (ctx.game) ctx.game.noteScript(abs, ctx.shell);
      const sh = ctx.shell.spawnChild({ script: true, user: ctx.user, scriptName: f });
      sh.positional = args.slice(1);
      sh.xtrace = xtrace;
      let ast;
      try { ast = LA.parse(src, null); }
      catch (e) { ctx.err.write(`${f}: ${e.incomplete ? 'line ' + (src.split('\n').length) + ': syntax error: unexpected end of file' : e.message}\n`); return 2; }
      try { return await sh.execList(ast, ctx.io); }
      catch (e) { if (e instanceof LA.ExitSignal) return e.code; throw e; }
    },
  };
  def('bash', bashImpl);
  def('sh', bashImpl);
})();
