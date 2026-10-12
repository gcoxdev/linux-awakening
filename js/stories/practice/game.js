/* Practice Range — endless, scored command practice on a fresh machine for every task. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const U = LA.util;
  const A = LA.ansi;

  /* ---------------- the task library ---------------- */
  const P = LA.practice = LA.practice || {};
  P.tasks = P.tasks || [];
  P.TOPICS = [
    ['nav', 'Getting around', 'pwd, ls, cd, cat, head, tail, less, file, wc, stat'],
    ['files', 'Files & folders', 'mkdir, cp, mv, rm, touch, ln, globs, quoting'],
    ['find', 'Finding things', 'find, locate, which, whereis, type'],
    ['text', 'Text processing', 'grep, sort, uniq, cut, tr, sed, awk, diff…'],
    ['pipes', 'Pipes & redirection', '|, >, >>, 2>, tee, xargs, $( )'],
    ['perms', 'Permissions & users', 'chmod, chown, sudo, su, id, useradd…'],
    ['procs', 'Processes', 'ps, top, kill, pgrep, jobs, df, free…'],
    ['system', 'Services, cron & disks', 'systemctl, journalctl, crontab, mount…'],
    ['archive', 'Archives & checksums', 'tar, gzip, zip, sha256sum, base64'],
    ['script', 'Shell scripting', 'variables, if, for, while, read, $(( ))'],
    ['net', 'Networking', 'ip, ping, dig, curl, wget, ssh, scp, ss'],
    ['pkg', 'Software & packages', 'your distro\'s package manager: install, remove, search, query'],
    ['shell', 'Your shell', 'env, export, alias, history, .bashrc, PATH'],
    ['help', 'Getting help', 'man, --help, whatis, apropos'],
  ];
  /* register a task template. «cmds» may say PM / LOWPM for this distro's package tools;
     «distros» limits a task to the distros it makes sense on. */
  P.task = (t) => { P.tasks.push(Object.assign({ level: 1, cmds: [] }, t)); };
  P.cmdsOf = (t, id) => { const D = LA.distro(id); return t.cmds.map((c) => (c === 'PM' ? D.pm : c === 'LOWPM' ? D.lowPm : c)); };
  P.tasksFor = (id) => P.tasks.filter((t) => !t.distros || t.distros.includes(LA.distro(id).id));

  const RANKS = [[0, 'Intern'], [100, 'Junior Admin'], [300, 'Admin'], [700, 'Sysadmin'], [1500, 'Senior Sysadmin'], [3000, 'Shell Wizard'], [6000, 'Greybeard']];
  const XP = [0, 10, 20, 35, 60];
  const STARS = (n) => '★'.repeat(n) + '☆'.repeat(4 - n);
  P.rankOf = (xp) => { let r = RANKS[0]; for (const x of RANKS) if (xp >= x[0]) r = x; return r; };
  P.nextRank = (xp) => RANKS.find((x) => x[0] > xp) || null;
  /* mastery of a command: how many solved tasks used it */
  P.masteryLevel = (n) => (n >= 6 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0);
  P.BADGES = {
    first: ['First Blood', 'Solved your first task'],
    streak5: ['On a Roll', 'Five in a row'],
    streak10: ['Unstoppable', 'Ten in a row'],
    streak25: ['Machine', 'Twenty-five in a row'],
    purist: ['No Training Wheels', 'Twenty-five tasks without a single hint'],
    boss: ['Boss Fight', 'Solved a four-star task'],
    ten: ['Getting Comfortable', 'Ten tasks solved'],
    fifty: ['Regular', 'Fifty tasks solved'],
    hundred: ['Centurion', 'A hundred tasks solved'],
    polyglot: ['Polymath', 'Solved a task in every topic'],
    complete: ['Completionist', 'Used every command in a solved task'],
  };
  for (const [id, label] of P.TOPICS) P.BADGES['topic_' + id] = [label + ' ✓', `Ten tasks solved in ${label}`];

  /* ---------------- the game ---------------- */
  class PracticeGame extends LA.Game {
    constructor(view, storage, storyId) {
      super(view, storage, storyId || 'practice');
      this.isPractice = true;
      this.task = null;
      this.taskRecs = [];
    }

    get chapters() { return []; }
    curChapter() { return null; }
    curStep() { return this.task ? { goal: this.goalText(), hints: [] } : null; }
    isUnlocked() { return true; }
    lockCheck() { return null; }

    /* ---- lifecycle ---- */
    newGame(user) {
      LA.clockOffset = 0;
      this.state = {
        v: 1, story: this.pack.id, distro: LA.distroId, user, practice: true, xp: 0, streak: 0, best: 0, solved: {}, topicSolved: {}, mastery: {},
        badges: [], seen: [], recent: [], noHintRun: 0, noHint: 0, topic: 'mix', level: 0, task: null,
        stats: { commands: 0, started: Date.now(), hints: 0, solved: 0, skipped: 0 }, freeplay: true, done: false, flags: {},
        unlocked: [], secrets: [], memories: [], ch: 0, step: 0, maxCh: 0,
      };
      /* an empty machine to stand on until the first task is dealt */
      this.buildTask(null, null);
    }
    async start() {
      await this.view.narrate(this.pack.welcome(this));
      await this.nextTask();
    }
    async resume() {
      if (this.view.update) this.view.update(this);
      await this.say(`:::resume\nWelcome back, {user}. ${P.rankOf(this.state.xp)[1]} · ${this.state.xp} XP · ${this.state.stats.solved} solved\n:::\nThe machine has been reset; here's your task again.`);
      await this.showTask();
    }
    loadFrom(data) {
      this.pack = LA.storyFor(data.state.story);
      this.state = data.state;
      this.state.distro = this.state.distro || 'debian';
      LA.distroId = this.state.distro;
      /* the machine is rebuilt from the task's seed; your command history comes back */
      const shell = data.shell || null;
      if (this.state.task && P.tasks.some((t) => t.id === this.state.task.id)) this.buildTask(this.state.task.id, this.state.task.seed, shell);
      else { this.state.task = null; this.buildTask(null, null, shell); }
    }
    serialize() { return { state: this.state, shell: this.console ? this.console.shellState(this.console.main) : null, ts: Date.now() }; }

    /* ---- choosing and building tasks ---- */
    pool() {
      const st = this.state;
      const cap = st.level || (st.xp < 100 ? 2 : st.xp < 300 ? 3 : 4);
      return P.tasksFor(this.distroId).filter((t) => (st.topic === 'mix' || t.topic === st.topic) && (st.level ? t.level === st.level : t.level <= cap));
    }
    pick() {
      const st = this.state;
      let pool = this.pool();
      if (!pool.length) pool = P.tasksFor(this.distroId).filter((t) => st.topic === 'mix' || t.topic === st.topic);
      const fresh = pool.filter((t) => !st.recent.includes(t.id));
      const from = fresh.length ? fresh : pool;
      /* favour tasks never solved, and tasks that exercise commands you rarely use */
      const weight = (t) => 1 + (st.solved[t.id] ? 0 : 2) + P.cmdsOf(t, this.distroId).filter((c) => !(st.mastery[c] >= 3)).length * 0.5;
      const total = from.reduce((a, t) => a + weight(t), 0);
      let r = Math.random() * total;
      for (const t of from) { r -= weight(t); if (r <= 0) return t; }
      return from[from.length - 1];
    }
    /* a fresh machine, then the template's own files, processes and accounts */
    buildTask(id, seed, saved) {
      const tpl = P.tasks.find((t) => t.id === id) || null;
      const shellState = saved || (this.console ? this.console.shellState(this.console.main) : null);
      const user = this.state.user;
      this.world = this.pack.buildWorld(user, seed || 1);
      this.world.story = this.pack.id;
      LA.tz = this.world.sys.tz;
      this.console = new LA.Console(this.view, this.world, this);
      /* a fresh login for every task — only your command history carries over */
      this.console.createMainShell(user, this.home);
      if (shellState) this.console.main.history = (shellState.history || []).slice(-500);
      this.console.main.ready = this.console.main.startup(true);
      this.task = null;
      this.taskRecs = [];
      this.stepEvents = [];
      this.stepRan = new Set();
      if (!tpl) return;
      const t = this.pack.toolkit(this, seed);
      const x = tpl.setup ? tpl.setup(t) || {} : {};
      t.finish();
      this.task = { tpl, x, seed, parts: (tpl.parts || []).map(() => false), solved: false };
      this.state.stepMem = {};
    }
    async nextTask(id) {
      const tpl = (id && P.tasks.find((t) => t.id === id)) || this.pick();
      const seed = Math.floor(Math.random() * 1e9) + 1;
      this.state.task = { id: tpl.id, seed, hint: 0, revealed: false };
      this.state.recent = [tpl.id].concat(this.state.recent.filter((r) => r !== tpl.id)).slice(0, Math.min(10, Math.floor(this.pool().length / 2)));
      if (!this.state.seen.includes(tpl.id)) this.state.seen.push(tpl.id);
      this.buildTask(tpl.id, seed);
      this.save();
      await this.showTask();
      if (this.view.update) this.view.update(this);
    }
    f(v) { return typeof v === 'function' ? v(this.task.x, this) : v; }
    goalText() {
      const T = this.task;
      if (!T) return '';
      const parts = T.tpl.parts ? T.tpl.parts.map((p, i) => `${T.parts[i] ? '✓' : '○'} ${this.fmt(this.f(p.text))}`).join('\n') : '';
      return this.fmt(this.f(T.tpl.goal || T.tpl.prompt)) + (parts ? '\n' + parts : '');
    }
    async showTask() {
      const T = this.task;
      if (!T || this.silent) return;
      const topic = (P.TOPICS.find((x) => x[0] === T.tpl.topic) || [])[1] || T.tpl.topic;
      let s = `:::task\n${STARS(T.tpl.level)}  **${T.tpl.title}**  ·  ${topic}  ·  ${XP[T.tpl.level]} XP\n${this.fmt(this.f(T.tpl.prompt))}`;
      if (T.tpl.parts) s += '\n' + T.tpl.parts.map((p, i) => `${T.parts[i] ? '✓' : '○'} ${this.f(p.text)}`).join('\n');
      await this.say(s + '\n:::');
    }

    /* ---- checking ---- */
    makeEvent(evt) {
      const e = super.makeEvent(evt);
      const game = this;
      const exp = (p) => String(p).replace(/^~(?=\/|$)/, game.home);
      const BORING = new Set(['echo', 'printf', 'true', 'false', 'cd', 'pwd', 'clear', ':', 'export', 'test', '[']);
      Object.assign(e, {
        p: exp,
        text: (p) => e.read(exp(p)),
        file: (p) => e.node(exp(p)),
        follow: (p) => fs0().tryGet(exp(p)),
        mode: (p) => { const n = fs0().tryGet(exp(p)); return n ? n.mode & 0o7777 : null; },
        /* the answer appeared on screen, printed by a command that worked it out (not just «echo 42») */
        answer(val, opts = {}) {
          const want = String(val);
          const shown = recs.filter((r) => r.toTerm && r.out);
          const real = recs.some((r) => !BORING.has(r.name));
          if (!real) return false;
          return shown.some((r) => r.out.split('\n').some((l) => (opts.exact ? l.trim() === want : l.trim() === want || l.split(/\s+/).includes(want))));
        },
        /* the last thing shown on screen, as trimmed non-empty lines */
        shownLines() { const r = recs.filter((x) => x.toTerm && x.out).pop(); return r ? r.out.split('\n').map((l) => l.trim()).filter(Boolean) : []; },
        /* a command ran (successfully) at any point during this task */
        used(name, pred) { const n = [].concat(name); return game.taskRecs.some((r) => n.includes(r.name) && r.status === 0 && (!pred || pred(r))); },
        /* ...or was at least run, whatever its exit status (a failed ping is still an answer) */
        attempted(name, pred) { const n = [].concat(name); return game.taskRecs.some((r) => n.includes(r.name) && (!pred || pred(r))); },
        usedFlag(name, f) { return game.taskRecs.some((r) => r.name === name && r.status === 0 && LA.hasFlag(r.args, f)); },
        x: game.task ? game.task.x : {},
      });
      const recs = evt.recs;
      function fs0() { return game.world.main.fs; }
      return e;
    }
    async afterLine(evt) {
      /* a line typed on the previous task's machine (say, «skip») finishes after the new one is built */
      if (evt.shell && this.console && evt.shell.ui !== this.console.ui) return;
      if (!evt.synthetic) this.state.stats.commands++;
      for (const r of evt.recs) { this.taskRecs.push(r); if (r.status === 0) this.stepRan.add(r.name); }
      this.stepEvents.push(...this.lineEvents);
      await this.flushNotices();
      const T = this.task;
      if (T && !T.solved && !evt.synthetic) {
        const e = this.makeEvent(evt);
        let ok = false;
        try {
          if (T.tpl.parts) {
            let changed = false;
            T.tpl.parts.forEach((p, i) => { if (!T.parts[i] && p.check(e, T.x)) { T.parts[i] = true; changed = true; } });
            ok = T.parts.every(Boolean) && (!T.tpl.check || T.tpl.check(e, T.x));
            if (changed && !ok) await this.say(T.tpl.parts.map((p, i) => `${T.parts[i] ? '✓' : '○'} ${this.fmt(this.f(p.text))}`).join('\n'));
          } else ok = !!T.tpl.check(e, T.x);
        } catch (err) { if (typeof console !== 'undefined') console.error('practice check', T.tpl.id, err); }
        if (ok) { T.solved = true; await this.completeTask(); this.lineEvents = []; return; }
        if (T.tpl.nudge) { let m = null; try { m = T.tpl.nudge(e, T.x); } catch (err) { m = null; } if (m) await this.say(m); }
      }
      this.lineEvents = [];
      this.save();
      if (this.view.update) this.view.update(this);
    }

    /* ---- scoring ---- */
    async completeTask() {
      const st = this.state, T = this.task, tpl = T.tpl, info = st.task;
      const solvedFairly = !info.revealed;
      let gained = 0;
      if (solvedFairly) {
        st.streak++;
        st.best = Math.max(st.best, st.streak);
        const mult = 1 + Math.min(st.streak - 1, 10) * 0.05;
        const hintFactor = Math.max(0.3, 1 - info.hint * 0.2);
        gained = Math.round(XP[tpl.level] * hintFactor * mult);
        if (!info.hint) { st.noHint++; }
      } else st.streak = 0;
      const before = P.rankOf(st.xp)[1];
      st.xp += gained;
      st.stats.solved++;
      st.solved[tpl.id] = (st.solved[tpl.id] || 0) + 1;
      st.topicSolved[tpl.topic] = (st.topicSolved[tpl.topic] || 0) + 1;
      for (const c of P.cmdsOf(tpl, this.distroId)) st.mastery[c] = (st.mastery[c] || 0) + 1;
      const sol = this.f(tpl.solution) || [];
      const one = sol.filter((s) => typeof s === 'string' && s !== '$PW').map((s) => this.fmt(s)).join('\n');
      let msg = `:::complete\n✓ SOLVED${gained ? `  +${gained} XP` : ' (with the solution shown — no XP)'}${solvedFairly && st.streak > 1 ? `  ·  streak ${st.streak}` : ''}\n:::`;
      if (one) msg += `\nOne way to do it:\n:::art\n${one}\n:::`;
      const why = this.f(tpl.why);
      if (why) msg += `\n:::lesson\n${this.fmt(why)}\n:::`;
      await this.say(msg);
      const after = P.rankOf(st.xp)[1];
      if (after !== before) await this.say(`:::complete\nRANK UP — you are now: ${after}\n:::`);
      await this.checkBadges(tpl);
      await this.nextTask();
    }
    async badge(id) {
      if (this.state.badges.includes(id) || !P.BADGES[id]) return;
      this.state.badges.push(id);
      if (this.view.toast) this.view.toast(`Badge: ${P.BADGES[id][0]}`);
      await this.say(`:::badge\n${P.BADGES[id][0]}\n${P.BADGES[id][1]}.\n:::`);
    }
    async checkBadges(tpl) {
      const st = this.state;
      const n = st.stats.solved;
      if (n >= 1) await this.badge('first');
      if (n >= 10) await this.badge('ten');
      if (n >= 50) await this.badge('fifty');
      if (n >= 100) await this.badge('hundred');
      for (const k of [5, 10, 25]) if (st.streak >= k) await this.badge('streak' + k);
      if (st.noHint >= 25) await this.badge('purist');
      if (tpl.level === 4 && !st.task.revealed) await this.badge('boss');
      if ((st.topicSolved[tpl.topic] || 0) >= 10) await this.badge('topic_' + tpl.topic);
      if (P.TOPICS.every(([id]) => st.topicSolved[id])) await this.badge('polyglot');
      if (P.allCommands(this.distroId).every((c) => st.mastery[c])) await this.badge('complete');
    }

    /* ---- the player's controls ---- */
    async cmdHint(ctx) {
      const T = this.task, info = this.state.task;
      if (!T) return 0;
      const hints = (this.f(T.tpl.hints) || []).map((h) => this.f(h));
      const sol = (this.f(T.tpl.solution) || []).filter((s) => typeof s === 'string' && s !== '$PW');
      const all = hints.concat(sol.length ? [`One answer: «${sol.map((s) => this.fmt(s)).join('» then «')}»`] : []);
      if (!all.length) { await this.say('No hints for this one — read the task again with «task».'); return 0; }
      const i = Math.min(info.hint, all.length - 1);
      if (i === all.length - 1 && sol.length) info.revealed = true;
      info.hint++;
      this.state.stats.hints++;
      this.state.noHint = 0;
      await this.say(`💡 ${this.fmt(all[i])}`);
      if (i < all.length - 1 && ctx) ctx.err.write(LA.paint(A.gray, `  (hint ${i + 1}/${all.length}${i === all.length - 2 ? ' — the next one is the answer, and costs the XP' : ''})`) + '\n');
      this.save();
      if (this.view.update) this.view.update(this);
      return 0;
    }
    async cmdGoal() { await this.showTask(); return 0; }
    async cmdStory() { return this.cmdGoal(); }
    async cmdSkip() {
      if (!this.task) return 0;
      this.state.streak = 0;
      this.state.stats.skipped++;
      const sol = (this.f(this.task.tpl.solution) || []).filter((s) => typeof s === 'string' && s !== '$PW').map((s) => this.fmt(s));
      await this.say(`Skipped.${sol.length ? ` For next time:\n:::art\n${sol.join('\n')}\n:::` : ''}`);
      await this.nextTask();
      return 0;
    }
    async cmdSolution() {
      if (!this.task) return 0;
      this.state.task.revealed = true;
      const sol = (this.f(this.task.tpl.solution) || []).filter((s) => typeof s === 'string' && s !== '$PW').map((s) => this.fmt(s));
      await this.say(`One way to do it (you can still finish the task, but it won't earn XP or keep your streak):\n:::art\n${sol.join('\n')}\n:::`);
      this.save();
      return 0;
    }
    async setTopic(id, quiet) {
      this.state.topic = id;
      if (!quiet) await this.say(`Topic: **${id === 'mix' ? 'Everything' : (P.TOPICS.find((x) => x[0] === id) || [])[1]}**. New task:`);
      await this.nextTask();
    }
    async cmdTopic(ctx) {
      const a = (ctx.args[0] || '').toLowerCase();
      if (!a) {
        ctx.println(`Current topic: ${this.state.topic}. Choose one with «topic NAME»:`);
        ctx.println('  mix        everything, weighted toward what you practise least');
        for (const [id, label, ex] of P.TOPICS) ctx.println(`  ${U.padR(id, 10)} ${U.padR(label, 26)} ${LA.paint(A.gray, ex)}`);
        return 0;
      }
      if (a !== 'mix' && !P.TOPICS.some((x) => x[0] === a)) { ctx.err.write(`topic: no topic called "${a}" (try «topic» to list them)\n`); return 1; }
      await this.setTopic(a);
      return 0;
    }
    async cmdLevel(ctx) {
      const a = ctx.args[0];
      if (!a) { ctx.println(`Difficulty: ${this.state.level ? STARS(this.state.level) + ' only' : 'automatic (rises with your rank)'}. Use «level 1» … «level 4», or «level auto».`); return 0; }
      const n = a === 'auto' ? 0 : parseInt(a, 10);
      if (!(n >= 0 && n <= 4)) { ctx.err.write('level: use 1, 2, 3, 4 or auto\n'); return 1; }
      this.state.level = n;
      await this.say(`Difficulty: ${n ? STARS(n) : 'automatic'}. New task:`);
      await this.nextTask();
      return 0;
    }
    cmdProgress(ctx) {
      const st = this.state;
      const c = (code, s) => (ctx.isTTY ? code + s + A.reset : s);
      const [, rank] = P.rankOf(st.xp);
      const nx = P.nextRank(st.xp);
      ctx.println(c(A.bcyan, 'PRACTICE RANGE') + ` — ${rank}, ${st.xp} XP${nx ? ` (${nx[0] - st.xp} to ${nx[1]})` : ''}`);
      ctx.println(`  solved ${st.stats.solved} · skipped ${st.stats.skipped} · hints ${st.stats.hints} · streak ${st.streak} (best ${st.best})`);
      ctx.println('\n' + c(A.bcyan, 'TOPICS'));
      for (const [id, label] of P.TOPICS) {
        const total = P.tasksFor(this.distroId).filter((t) => t.topic === id).length;
        const done = P.tasksFor(this.distroId).filter((t) => t.topic === id && st.solved[t.id]).length;
        ctx.println(`  ${U.padR(label, 26)} ${'█'.repeat(Math.round((done / total) * 12)).padEnd(12, '·')} ${done}/${total} task types`);
      }
      const cmds = P.allCommands(this.distroId);
      const m = cmds.filter((x) => P.masteryLevel(st.mastery[x] || 0) === 3).length;
      ctx.println(`\n${c(A.bcyan, 'COMMANDS')} ${cmds.filter((x) => st.mastery[x]).length}/${cmds.length} used · ${m} mastered (see the notebook in the panel)`);
      ctx.println(`\n${c(A.bcyan, 'BADGES')} ${st.badges.length}/${Object.keys(P.BADGES).length}`);
      for (const [k, b] of Object.entries(P.BADGES)) if (st.badges.includes(k)) ctx.println(`  ${c(A.byellow, '🏅 ' + b[0])} — ${b[1]}`);
      return 0;
    }
    cmdNotebook(ctx) {
      const st = this.state;
      ctx.println('Commands, by how often you have used them in solved tasks (· none, ▪ seen, ▪▪ practised, ▪▪▪ mastered):');
      const cmds = P.allCommands(this.distroId);
      const cell = (x) => `${U.padR(x, 11)}${['·  ', '▪  ', '▪▪ ', '▪▪▪'][P.masteryLevel(st.mastery[x] || 0)]}`;
      for (let i = 0; i < cmds.length; i += 5) ctx.println('  ' + cmds.slice(i, i + 5).map(cell).join('  '));
      return 0;
    }
    cmdHelp(ctx) {
      if (ctx.args[0]) return super.cmdHelp(ctx);
      const c = (code, s) => (ctx.isTTY ? code + s + A.reset : s);
      ctx.println(c(A.bcyan, 'PRACTICE RANGE') + ' — how it works');
      ctx.println('  Each task asks you to do something real on this machine. Do it however you like:');
      ctx.println('  the task is checked after every command. The machine is reset for every new task.');
      ctx.println(`  ${c(A.byellow, 'task')}       show the task again          ${c(A.byellow, 'hint')}      a hint (the last one is the answer)`);
      ctx.println(`  ${c(A.byellow, 'skip')}       a different task             ${c(A.byellow, 'solution')}  show an answer (no XP)`);
      ctx.println(`  ${c(A.byellow, 'topic')}      choose a topic               ${c(A.byellow, 'level')}     choose difficulty (1–4, auto)`);
      ctx.println(`  ${c(A.byellow, 'progress')}   rank, topics, badges         ${c(A.byellow, 'man CMD')}   the manual for any command`);
      ctx.println(`  Your password (for sudo) is «${this.password()}».`);
      if (this.task) ctx.println('\n' + c(A.bgreen, 'Current task: ') + U.stripAnsi(this.goalText()).replace(/[«»]/g, ''));
      return 0;
    }
    jumpTo() { return Promise.resolve(); }
  }

  P.allCommands = (id) => {
    const d = LA.distro(id).id;
    P._cmds = P._cmds || {};
    if (!P._cmds[d]) P._cmds[d] = [...new Set(P.tasksFor(d).flatMap((t) => P.cmdsOf(t, d)))].sort();
    return P._cmds[d];
  };
  LA.PracticeGame = PracticeGame;
  if (LA.stories.practice) LA.stories.practice.Game = PracticeGame;
})();
