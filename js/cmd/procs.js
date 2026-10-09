/* Linux Awakening — processes & signals. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const U = LA.util;
  const def = LA.def;

  const SIGNALS = { HUP: 1, INT: 2, QUIT: 3, ILL: 4, TRAP: 5, ABRT: 6, BUS: 7, FPE: 8, KILL: 9, USR1: 10, SEGV: 11, USR2: 12, PIPE: 13, ALRM: 14, TERM: 15, STKFLT: 16, CHLD: 17, CONT: 18, STOP: 19, TSTP: 20 };
  const SIGNAME = Object.fromEntries(Object.entries(SIGNALS).map(([k, v]) => [v, k]));
  LA.SIGNALS = SIGNALS;
  function parseSig(s) {
    if (s === undefined) return null;
    if (/^\d+$/.test(s)) return SIGNAME[parseInt(s, 10)] ? parseInt(s, 10) : null;
    const n = s.toUpperCase().replace(/^SIG/, '');
    return SIGNALS[n] || null;
  }

  function fmtTime(secs) {
    const m = Math.floor(secs / 60), s = Math.floor(secs % 60);
    return `${m}:${U.p2(s)}`;
  }
  function fmtTime3(secs) {
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = Math.floor(secs % 60);
    return `${U.p2(h)}:${U.p2(m)}:${U.p2(s)}`;
  }
  function fmtStart(ms) {
    const d = new Date(ms);
    if (LA.now() - ms < 86400000) return U.strftime('%H:%M', d);
    return U.MON[d.getMonth()] + U.p2(d.getDate());
  }

  def('ps', {
    run(ctx) {
      const world = ctx.world;
      const args = ctx.args;
      const self = world.transient({ user: ctx.user, comm: 'ps', args: ['ps', ...args].join(' '), tty: ctx.shell.tty, host: ctx.host.name, ppid: ctx.shell.pid });
      try {
        let list = world.procs.filter((p) => p.host === ctx.host.name);
        const bsd = args.length && !args[0].startsWith('-') && /^[auxfwe]+$/.test(args[0]);
        const flags = bsd ? args[0] : args.filter((a) => a.startsWith('-')).join('').replace(/-/g, '');
        let user = null, pidSel = null;
        for (let i = 0; i < args.length; i++) {
          if (args[i] === '-u' || args[i] === '-U' || args[i] === '--user') user = args[++i];
          else if (args[i] === '-p' || args[i] === '--pid') pidSel = args[++i].split(',').map(Number);
        }
        const all = bsd ? flags.includes('a') && flags.includes('x') : /[eA]/.test(flags);
        if (user) list = list.filter((p) => p.user === user);
        else if (pidSel) list = list.filter((p) => pidSel.includes(p.pid));
        else if (!all) {
          if (bsd && flags.includes('x')) list = list.filter((p) => p.user === ctx.user);
          else if (bsd && flags.includes('a')) list = list.filter((p) => p.tty !== '?');
          else list = list.filter((p) => p.tty === ctx.shell.tty && p.user === ctx.user);
        }
        list.sort((a, b) => a.pid - b.pid);
        const now = LA.now();
        if (bsd && flags.includes('u')) {
          ctx.println('USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND');
          for (const p of list) {
            const cmd = p.args || p.comm;
            ctx.println(`${U.padR(p.user.slice(0, 8), 8)} ${U.padL(p.pid, 7)} ${U.padL(p.cpu.toFixed(1), 4)} ${U.padL(p.mem.toFixed(1), 4)} ${U.padL(p.vsz, 6)} ${U.padL(p.rss, 5)} ${U.padR(p.tty, 8)} ${U.padR(p.stat, 4)} ${U.padR(fmtStart(p.start), 5)} ${U.padL(fmtTime(p.cputime), 6)} ${cmd}`);
          }
          return 0;
        }
        if (flags.includes('f') || flags.includes('F')) {
          ctx.println('UID          PID    PPID  C STIME TTY          TIME CMD');
          for (const p of list) ctx.println(`${U.padR(p.user.slice(0, 8), 8)} ${U.padL(p.pid, 7)} ${U.padL(p.ppid, 7)}  ${Math.round(p.cpu)} ${U.padR(fmtStart(p.start), 5)} ${U.padR(p.tty, 8)} ${fmtTime3(p.cputime)} ${p.args || p.comm}`);
          return 0;
        }
        if (bsd) {
          ctx.println('    PID TTY      STAT   TIME COMMAND');
          for (const p of list) ctx.println(`${U.padL(p.pid, 7)} ${U.padR(p.tty, 8)} ${U.padR(p.stat, 6)} ${U.padL(fmtTime(p.cputime), 4)} ${p.args || p.comm}`);
          return 0;
        }
        ctx.println('    PID TTY          TIME CMD');
        for (const p of list) ctx.println(`${U.padL(p.pid, 7)} ${U.padR(p.tty, 8)} ${fmtTime3(p.cputime)} ${p.comm}`);
        void now;
        return 0;
      } finally {
        world.reap(self.pid);
      }
    },
  });

  function topText(ctx, opts = {}) {
    const world = ctx.world;
    const procs = world.procs.filter((p) => p.host === ctx.host.name).map((p) => Object.assign({}, p, { cpu: Math.max(0, p.cpu + (Math.random() - 0.5) * (p.cpu > 1 ? 4 : 0.6)) }));
    procs.sort((a, b) => b.cpu - a.cpu || a.pid - b.pid);
    const m = world.memory();
    const b = (s) => (opts.color ? '\x1b[1m' + s + '\x1b[0m' : s);
    const total = procs.length;
    const us = procs.reduce((a, p) => a + p.cpu, 0) / 2;
    let s = `top - ${LA.uptimeLine(world).trim()}\n`;
    s += `Tasks: ${b(String(total))} total,   ${b('1')} running, ${b(String(total - 1))} sleeping,   ${b('0')} stopped,   ${b('0')} zombie\n`;
    s += `%Cpu(s): ${b(us.toFixed(1))} us,  ${b('1.1')} sy,  ${b('0.0')} ni, ${b((100 - us - 1.3).toFixed(1))} id,  ${b('0.2')} wa,  ${b('0.0')} hi,  ${b('0.0')} si,  ${b('0.0')} st\n`;
    s += `MiB Mem : ${b((m.total / 1024).toFixed(1))} total, ${b((m.free / 1024).toFixed(1))} free, ${b((m.used / 1024).toFixed(1))} used, ${b((m.cache / 1024).toFixed(1))} buff/cache\n`;
    s += `MiB Swap: ${b((m.swap / 1024).toFixed(1))} total, ${b((m.swap / 1024).toFixed(1))} free, ${b('0.0')} used. ${b((m.avail / 1024).toFixed(1))} avail Mem\n\n`;
    const head = '    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND';
    s += (opts.color ? '\x1b[7m' + head.padEnd(opts.width || 80) + '\x1b[0m' : head) + '\n';
    const rows = procs.slice(0, opts.rows || 20);
    for (const p of rows) {
      const t = p.cputime;
      const tp = `${Math.floor(t / 60)}:${U.p2(Math.floor(t % 60))}.${U.p2(Math.floor((t * 100) % 100))}`;
      const line = `${U.padL(p.pid, 7)} ${U.padR(p.user.slice(0, 8), 8)}  20   0 ${U.padL(p.vsz, 7)} ${U.padL(p.rss, 6)} ${U.padL(Math.floor(p.rss * 0.6), 6)} ${p.stat[0]} ${U.padL(p.cpu.toFixed(1), 5)} ${U.padL(p.mem.toFixed(1), 5)} ${U.padL(tp, 9)} ${p.comm}`;
      s += (opts.color && p.cpu > 10 ? '\x1b[1m' + line + '\x1b[0m' : line) + '\n';
    }
    return s;
  }
  LA.topText = topText;

  const topImpl = {
    interruptible: true,
    async run(ctx) {
      const batch = ctx.args.includes('-b') || !ctx.isTTY || !ctx.ui.top;
      if (ctx.game) ctx.game.noteTop();
      if (batch) { ctx.print(topText(ctx, { rows: 15 })); return 0; }
      await ctx.ui.top((opts) => topText(ctx, opts), { title: ctx.name });
      return 0;
    },
  };
  def('top', topImpl);
  def('htop', topImpl);

  function sendSignal(ctx, pid, sig, label) {
    const r = ctx.world.signal(pid, sig, ctx.user, ctx.host.name, ctx.shell);
    if (r === 'ESRCH') { ctx.err.write(`${label}: (${pid}) - No such process\n`); return 1; }
    if (r === 'EPERM') { ctx.err.write(`${label}: (${pid}) - Operation not permitted\n`); return 1; }
    if (r === 'SELF') { ctx.err.write(LA.paint(LA.ansi.yellow, `Tux grabs your sleeve. Killing your own shell would log you out of Rootfall entirely. Let's not.`) + '\n'); return 1; }
    return 0;
  }

  def('kill', {
    builtin: true,
    run(ctx) {
      const args = ctx.args.slice();
      if (!args.length) { ctx.err.write('kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]\n'); return 2; }
      if (args[0] === '-l' || args[0] === '-L') {
        if (args[1]) { const s = parseSig(args[1]); ctx.println(s ? (/^\d+$/.test(args[1]) ? SIGNAME[s] : String(s)) : ''); return s ? 0 : 1; }
        const lines = [];
        let line = '';
        for (let i = 1; i <= 20; i++) {
          line += `${String(i).padStart(2)}) SIG${U.padR(SIGNAME[i], 8)}`;
          if (i % 5 === 0) { lines.push(line); line = ''; } else line += '\t';
        }
        ctx.println(lines.join('\n'));
        return 0;
      }
      let sig = 15;
      if (args[0] === '-s' || args[0] === '-n') { args.shift(); sig = parseSig(args.shift()); }
      else if (/^-/.test(args[0])) { sig = parseSig(args.shift().slice(1)); }
      if (!sig) { ctx.err.write(`bash: kill: ${ctx.args[0].replace(/^-/, '')}: invalid signal specification\n`); return 1; }
      let st = 0;
      for (const t of args) {
        if (t.startsWith('%')) {
          const job = ctx.shell.findJob(t);
          if (!job) { ctx.err.write(`bash: kill: ${t}: no such job\n`); st = 1; continue; }
          job.state = sig === 9 ? 'Killed' : 'Terminated';
          job.child.signal.abort();
          ctx.world.reap(job.pid);
          continue;
        }
        if (!/^-?\d+$/.test(t)) { ctx.err.write(`bash: kill: ${t}: arguments must be process or job IDs\n`); st = 1; continue; }
        const pid = parseInt(t, 10);
        const job = ctx.shell.jobs.find((j) => j.pid === pid);
        if (job) { job.state = sig === 9 ? 'Killed' : 'Terminated'; job.child.signal.abort(); }
        st |= sendSignal(ctx, pid, sig, 'bash: kill');
      }
      if (ctx.game) ctx.game.onKill();
      return st;
    },
  });

  function matchProcs(ctx, pattern, o) {
    let re;
    try { re = new RegExp(o.x ? '^(?:' + U.reToJs(pattern, true) + ')$' : U.reToJs(pattern, true), o.i ? 'i' : ''); }
    catch (e) { return null; }
    return ctx.world.procs.filter((p) => p.host === ctx.host.name && !p.transient && (!o.u || p.user === o.u) && re.test(o.f ? p.args || p.comm : p.comm));
  }

  def('pgrep', {
    run(ctx) {
      const { o, operands } = LA.util.getopt(ctx.args, { flags: 'laficx', params: 'u', long: { 'list-name': 'l', 'list-full': 'a', full: 'f', count: 'c', exact: 'x' } });
      if (!operands.length && !o.u) { ctx.err.write('pgrep: no matching criteria specified\nTry `pgrep --help\' for more information.\n'); return 2; }
      const list = matchProcs(ctx, operands[0] || '.', o);
      if (!list) { ctx.err.write('pgrep: invalid pattern\n'); return 2; }
      if (o.c) { ctx.println(String(list.length)); return list.length ? 0 : 1; }
      for (const p of list) ctx.println(o.a ? `${p.pid} ${p.args || p.comm}` : o.l ? `${p.pid} ${p.comm}` : String(p.pid));
      return list.length ? 0 : 1;
    },
  });

  def('pkill', {
    run(ctx) {
      const args = ctx.args.slice();
      let sig = 15;
      if (args[0] && /^-(\d+|[A-Z]+)$/.test(args[0])) sig = parseSig(args.shift().slice(1)) || 15;
      const { o, operands } = LA.util.getopt(args, { flags: 'fixe', params: 'us', long: { full: 'f', signal: 's=', exact: 'x' } });
      if (o.s) sig = parseSig(o.s) || 15;
      if (!operands.length && !o.u) { ctx.err.write('pkill: no matching criteria specified\nTry `pkill --help\' for more information.\n'); return 2; }
      const list = matchProcs(ctx, operands[0] || '.', o);
      if (!list) { ctx.err.write('pkill: invalid pattern\n'); return 2; }
      if (!list.length) return 1;
      let any = false;
      for (const p of list) {
        const r = ctx.world.signal(p.pid, sig, ctx.user, ctx.host.name, ctx.shell);
        if (r === 'EPERM') ctx.err.write(`pkill: killing pid ${p.pid} failed: Operation not permitted\n`);
        else if (r === 'SELF') continue;
        else any = true;
        if (o.e && r === true) ctx.println(`${p.comm} killed (pid ${p.pid})`);
      }
      if (ctx.game) ctx.game.onKill();
      return any ? 0 : 1;
    },
  });

  def('killall', {
    run(ctx) {
      const args = ctx.args.slice();
      let sig = 15, verbose = false, user = null, interactive = false;
      const names = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-s' || a === '--signal') { sig = parseSig(args[++i]) || 15; continue; }
        if (a === '-v' || a === '--verbose') { verbose = true; continue; }
        if (a === '-i') { interactive = true; continue; }
        if (a === '-u' || a === '--user') { user = args[++i]; continue; }
        if (/^-(\d+|[A-Z]+)$/.test(a)) { sig = parseSig(a.slice(1)) || 15; continue; }
        names.push(a);
      }
      void interactive;
      if (!names.length && !user) { ctx.err.write('Usage: killall [OPTION]... [--] NAME...\n'); return 1; }
      let st = 0;
      for (const n of names.length ? names : [null]) {
        const list = ctx.world.procs.filter((p) => p.host === ctx.host.name && !p.transient && (n === null || p.comm === n) && (!user || p.user === user));
        if (!list.length) { ctx.err.write(`${n}: no process found\n`); st = 1; continue; }
        for (const p of list) {
          const r = ctx.world.signal(p.pid, sig, ctx.user, ctx.host.name, ctx.shell);
          if (r === 'EPERM') { ctx.err.write(`${p.comm}(${p.pid}): Operation not permitted\n`); st = 1; }
          else if (r === true && verbose) ctx.println(`Killed ${p.comm}(${p.pid}) with signal ${sig}`);
        }
      }
      if (ctx.game) ctx.game.onKill();
      return st;
    },
  });
})();
