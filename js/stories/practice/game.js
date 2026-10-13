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
  /* register a task template.
     «cmds» are the commands the task is about (PM / LOWPM mean this distro's package tools);
     «distros» limits a task to the distros it makes sense on.
     A part with «state: true» is a condition that must still hold at the end (it can come undone);
     other parts are things you did, and stay done. */
  P.task = (t) => { P.tasks.push(Object.assign({ level: 1, cmds: [] }, t)); };
  P.cmdsOf = (t, id) => { const D = LA.distro(id); return t.cmds.map((c) => (c === 'PM' ? D.pm : c === 'LOWPM' ? D.lowPm : c)); };
  P.tasksFor = (id) => P.tasks.filter((t) => !t.distros || t.distros.includes(LA.distro(id).id));

  const RANKS = [[0, 'Intern'], [100, 'Junior Admin'], [300, 'Admin'], [700, 'Sysadmin'], [1500, 'Senior Sysadmin'], [3000, 'Shell Wizard'], [6000, 'Greybeard']];
  const XP = [0, 10, 20, 35, 60];
  const STARS = (n) => '★'.repeat(n) + '☆'.repeat(4 - n);
  P.XP = XP;
  P.rankOf = (xp) => { let r = RANKS[0]; for (const x of RANKS) if (xp >= x[0]) r = x; return r; };
  P.nextRank = (xp) => RANKS.find((x) => x[0] > xp) || null;
  /* how well you know a command, from what you actually ran in tasks you solved:
     1 tried (even with the answer shown) · 2 practised (3 unaided uses) · 3 mastered (6 unaided uses, in 3+ different tasks) */
  P.masteryLevel = (st, c) => {
    const n = (st.mastery && st.mastery[c]) || 0;
    const tasks = ((st.masteryTasks && st.masteryTasks[c]) || []).length;
    if (n >= 6 && tasks >= 3) return 3;
    if (n >= 3) return 2;
    return n || (st.assistedUse && st.assistedUse[c]) ? 1 : 0;
  };
  P.BADGES = {
    first: ['First Blood', 'Solved your first task'],
    streak5: ['On a Roll', 'Five in a row without looking at an answer'],
    streak10: ['Unstoppable', 'Ten in a row without looking at an answer'],
    streak25: ['Machine', 'Twenty-five in a row without looking at an answer'],
    purist: ['No Training Wheels', 'Twenty-five tasks in a row without a hint'],
    boss: ['Boss Fight', 'Solved a four-star task on your own'],
    ten: ['Getting Comfortable', 'Ten tasks solved'],
    fifty: ['Regular', 'Fifty tasks solved'],
    hundred: ['Centurion', 'A hundred tasks solved'],
    polyglot: ['Polymath', 'Solved a task in every topic on your own'],
    complete: ['Completionist', 'Used every command in the notebook in a solved task'],
  };
  for (const [id, label] of P.TOPICS) P.BADGES['topic_' + id] = [label + ' ✓', `Ten tasks solved on your own in ${label}`];

  /* ---------------- answers, written out in full ---------------- */
  /* a solution is a list of steps: a command string, '$PW' (your password at a prompt), { answer } (what to
     type at a prompt), { edit: fn } (what to write in the editor opened by the next command), { nowait } (a
     command that keeps running) and { ctrlc } (press Ctrl+C). Tests run the same list. */
  P.renderSolution = (sol, fmt, read) => {
    const out = [];
    let pendingEdit = null;
    for (const s of sol || []) {
      if (s === '$PW') { out.push('(type your password at the prompt)'); continue; }
      if (typeof s === 'string') {
        out.push(fmt(s));
        if (pendingEdit !== null) {
          /* show the file as it should look when you save: the edit applied to what's there now */
          const file = (fmt(s).match(/^\s*(?:sudo\s+)?(?:nano|vim?|editor)\s+(\S+)/) || [])[1];
          const before = (file && read && read(file)) || '';
          const after = String(pendingEdit(before, file || ''));
          out.push(...after.split('\n').filter((l, i, a) => i < a.length - 1 || l).map((l) => '    ' + l), '(save with Ctrl+O, Enter, then exit with Ctrl+X)');
          pendingEdit = null;
        }
        continue;
      }
      if (!s || typeof s !== 'object') continue;
      if (s.edit) { pendingEdit = s.edit; out.push('(in the editor that opens next, make the file read:)'); continue; }
      if (s.nowait) { out.push(fmt(s.nowait)); continue; }
      if (s.ctrlc) { out.push('(press Ctrl+C)'); continue; }
      if ('answer' in s) out.push(`(when asked, answer: ${s.answer === '$PW' ? 'your password' : s.answer})`);
    }
    /* an edit with no command after it: show the text anyway */
    if (pendingEdit !== null) out.push(...String(pendingEdit('', '')).split('\n').map((l) => '    ' + l));
    return out;
  };

  /* commands that only print what you typed: an answer they print is not an answer worked out */
  const BORING = new Set(['echo', 'printf', 'true', 'false', 'cd', 'pwd', 'clear', ':', 'export', 'test', '[']);
  const SAME = { '[': 'test', '[[': 'test', yum: 'dnf', 'apt-get': 'apt', egrep: 'grep', fgrep: 'grep', vi: 'vim', '.': 'source' };

  /* ---------------- the game ---------------- */
  class PracticeGame extends LA.Game {
    constructor(view, storage, storyId) {
      super(view, storage, storyId || 'practice');
      this.isPractice = true;
      this.task = null;
      this.taskRecs = [];
      this.taskLines = [];
    }

    get chapters() { return []; }
    /* one practice profile per distro: switching distro doesn't erase your Debian rank */
    get saveKey() { const d = this.distroId; return 'linux-awakening-save-practice' + (d && d !== 'debian' ? '-' + d : ''); }
    curChapter() { return null; }
    curStep() { return this.task ? { goal: this.goalText(), hints: [] } : null; }
    isUnlocked() { return true; }
    lockCheck() { return null; }

    /* ---- lifecycle ---- */
    freshState(user) {
      return {
        v: 2, story: this.pack.id, distro: LA.distroId, user, practice: true, xp: 0, streak: 0, best: 0,
        solved: {}, independent: {}, topicSolved: {}, mastery: {}, masteryTasks: {}, assistedUse: {}, review: [],
        badges: [], seen: [], recent: [], noHint: 0, topic: 'mix', level: 0, task: null, autoNext: false,
        stats: { commands: 0, started: Date.now(), hints: 0, solved: 0, skipped: 0, revealed: 0 }, freeplay: true, done: false, flags: {},
        unlocked: [], secrets: [], memories: [], ch: 0, step: 0, maxCh: 0,
      };
    }
    newGame(user) {
      LA.clockOffset = 0;
      this.state = this.freshState(user);
      /* an empty machine to stand on until the first task is dealt */
      this.buildTask(null, null);
    }
    async start() {
      await this.view.narrate(this.pack.welcome(this));
      await this.nextTask();
    }
    async resume() {
      if (this.view.update) this.view.update(this);
      const kept = this.resumedWork;
      await this.say(`:::resume\nWelcome back, {user}. ${P.rankOf(this.state.xp)[1]} · ${this.state.xp} XP · ${this.state.stats.solved} solved\n:::\n${kept ? 'The machine is as you left it. Here\'s your task:' : 'The machine was reset; here\'s your task again.'}`);
      await this.showTask();
      if (this.task && this.task.solved) await this.say(this.nextPrompt());
    }
    /* an older save (before evidence-based mastery) keeps its XP and badges; its mastery counted task labels,
       not what you ran, so it becomes "tried" */
    migrate(st) {
      if (st.v >= 2) return;
      st.assistedUse = Object.assign({}, st.mastery || {});
      st.mastery = {};
      st.masteryTasks = {};
      st.independent = Object.assign({}, st.solved || {});
      st.review = [];
      st.autoNext = false;
      st.stats.revealed = st.stats.revealed || 0;
      st.v = 2;
    }
    loadFrom(data) {
      this.pack = LA.storyFor(data.state.story);
      this.state = data.state;
      this.state.distro = this.state.distro || 'debian';
      LA.distroId = this.state.distro;
      this.migrate(this.state);
      const shell = data.shell || null;
      const T = this.state.task;
      const tpl = T && P.tasks.find((t) => t.id === T.id);
      this.resumedWork = false;
      if (tpl && data.world && data.attempt && data.attempt.id === T.id) {
        /* the same attempt, files and all */
        this.world = LA.World.deserialize(data.world);
        this.world.http = data.http || this.world.http;
        LA.tz = this.world.sys.tz;
        this.console = new LA.Console(this.view, this.world, this);
        this.console.createMainShell(this.state.user, (shell && shell.cwd) || this.home, shell);
        this.task = { tpl, x: data.attempt.x, seed: T.seed, parts: data.attempt.parts || (tpl.parts || []).map(() => false), solved: !!data.attempt.solved };
        this.taskRecs = data.attempt.recs || [];
        this.taskLines = data.attempt.lines || [];
        this.evidence = data.attempt.evidence || [];
        this.stepEvents = [];
        this.stepRan = new Set(this.taskRecs.filter((r) => r.status === 0).map((r) => r.name));
        this.resumedWork = true;
      } else if (tpl) this.buildTask(T.id, T.seed, shell);
      else { this.state.task = null; this.buildTask(null, null, shell); }
    }
    serialize() {
      const T = this.task;
      const slim = (r) => ({ name: r.name, args: r.args, status: r.status, out: (r.out || '').slice(0, 4000), toTerm: r.toTerm, cwd: r.cwd, user: r.user, sudo: r.sudo, piped: r.piped });
      return {
        state: this.state,
        shell: this.console ? this.console.shellState(this.console.main) : null,
        /* the attempt in progress: the machine, the task's data, and what you've done so far */
        world: this.world && T ? this.world.serialize() : null,
        http: this.world ? this.world.http : null,
        attempt: T ? { id: T.tpl.id, x: T.x, parts: T.parts, solved: T.solved, recs: this.taskRecs.slice(-200).map(slim), lines: this.taskLines.slice(-200), evidence: (this.evidence || []).slice(-50) } : null,
        ts: Date.now(),
      };
    }

    /* ---- choosing and building tasks ---- */
    /* how far you can reach: a level unlocks in a topic once you've solved enough just below it on your own */
    reach(topic) {
      const st = this.state;
      const solved = (lvl) => P.tasksFor(this.distroId).filter((t) => t.topic === topic && t.level >= lvl && st.independent[t.id]).reduce((a, t) => a + st.independent[t.id], 0);
      let r = 2;
      if (solved(2) >= 3) r = 3;
      if (solved(2) >= 6) r = 4;
      return r;
    }
    pool() {
      const st = this.state;
      return P.tasksFor(this.distroId).filter((t) => (st.topic === 'mix' || t.topic === st.topic) && (st.level ? t.level === st.level : t.level <= this.reach(t.topic)));
    }
    levelsFor(topic) { return [...new Set(P.tasksFor(this.distroId).filter((t) => topic === 'mix' || t.topic === topic).map((t) => t.level))].sort(); }
    pick() {
      const st = this.state;
      let pool = this.pool();
      if (!pool.length) pool = P.tasksFor(this.distroId).filter((t) => st.topic === 'mix' || t.topic === st.topic);
      /* due for review: a task you needed the answer for comes back a few tasks later, with new data */
      const due = (st.review || []).find((r) => r.due <= st.stats.solved + st.stats.skipped && pool.some((t) => t.id === r.id));
      if (due) { st.review = st.review.filter((r) => r !== due); return pool.find((t) => t.id === due.id); }
      const fresh = pool.filter((t) => !st.recent.includes(t.id));
      const from = fresh.length ? fresh : pool;
      /* favour tasks you haven't solved on your own, and commands you rarely use */
      const weight = (t) => 1 + (st.independent[t.id] ? 0 : 2) + P.cmdsOf(t, this.distroId).filter((c) => P.masteryLevel(st, c) < 3).length * 0.5;
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
      this.taskLines = [];
      this.evidence = [];
      this.stepEvents = [];
      this.stepRan = new Set();
      if (!tpl) { this.world.updatedb(); return; }
      const t = this.pack.toolkit(this, seed);
      const x = tpl.setup ? tpl.setup(t) || {} : {};
      t.finish();
      /* the nightly locate database, then anything the task makes "since" */
      this.world.updatedb();
      if (t.afterIndex) t.afterIndex();
      this.task = { tpl, x, seed, parts: (tpl.parts || []).map(() => false), solved: false };
      this.state.stepMem = {};
    }
    async nextTask(id, seed) {
      const tpl = (id && P.tasks.find((t) => t.id === id)) || this.pick();
      seed = seed || Math.floor(Math.random() * 1e9) + 1;
      this.state.task = { id: tpl.id, seed, hint: 0, revealed: false, warned: false };
      this.state.recent = [tpl.id].concat(this.state.recent.filter((r) => r !== tpl.id)).slice(0, Math.min(10, Math.floor(this.pool().length / 2)));
      if (!this.state.seen.includes(tpl.id)) this.state.seen.push(tpl.id);
      this.buildTask(tpl.id, seed);
      this.save();
      await this.showTask();
      if (this.view.update) this.view.update(this);
    }
    f(v) { return typeof v === 'function' ? v(this.task.x, this) : v; }
    partsText() {
      const T = this.task;
      return T.tpl.parts.map((p, i) => `${T.parts[i] ? '✓' : '○'} ${this.fmt(this.f(p.text))}`).join('\n');
    }
    goalText() {
      const T = this.task;
      if (!T) return '';
      return this.fmt(this.f(T.tpl.goal || T.tpl.prompt)) + (T.tpl.parts ? '\n' + this.partsText() : '');
    }
    async showTask() {
      const T = this.task;
      if (!T || this.silent) return;
      const topic = (P.TOPICS.find((x) => x[0] === T.tpl.topic) || [])[1] || T.tpl.topic;
      let s = `:::task\n${STARS(T.tpl.level)}  **${T.tpl.title}**  ·  ${topic}  ·  ${XP[T.tpl.level]} XP\n${this.fmt(this.f(T.tpl.prompt))}`;
      if (T.tpl.parts) s += '\n' + this.partsText();
      await this.say(s + '\n:::');
    }
    solutionLines() {
      const read = (p) => { const n = this.world.main.fs.tryGet(LA.VFS.normalize(p.replace(/^~(?=\/|$)/, this.home), this.console.main.cwd)); return n && n.type === 'file' ? this.world.main.fs.contentOf(n) : ''; };
      return P.renderSolution(this.f(this.task.tpl.solution) || [], (s) => this.fmt(s), read);
    }

    /* ---- checking ---- */
    makeEvent(evt) {
      const e = super.makeEvent(evt);
      const game = this;
      const exp = (p) => String(p).replace(/^~(?=\/|$)/, game.home);
      const recs = evt.recs;
      const shown = () => recs.filter((r) => r.toTerm && r.out);
      /* «$(cmd)» inside an echo: the echo prints what a real command worked out */
      const substituted = /\$\(|`/.test(evt.line) && recs.some((r) => !BORING.has(r.name) && !r.toTerm);
      const worked = (r) => !BORING.has(r.name) || substituted;
      function fs0() { return game.world.main.fs; }
      Object.assign(e, {
        p: exp,
        text: (p) => e.read(exp(p)),
        file: (p) => e.node(exp(p)),
        follow: (p) => fs0().tryGet(exp(p)),
        mode: (p) => { const n = fs0().tryGet(exp(p)); return n ? n.mode & 0o7777 : null; },
        /* what this line put on the screen (not what went into a file or down a pipe) */
        out() { return shown().map((r) => r.out).join(''); },
        /* everything this line's commands produced, wherever it went */
        allOut() { return recs.map((r) => r.out || '').join(''); },
        /* the answer appeared on screen, printed by a command that worked it out (not by «echo 42») */
        answer(val, opts = {}) {
          const want = String(val);
          return shown().filter(worked).some((r) => r.out.split('\n').some((l) => (opts.exact ? l.trim() === want : l.trim() === want || l.split(/\s+/).includes(want))));
        },
        /* the last thing a real command showed on screen, as trimmed non-empty lines ({ any: true } includes echo/printf) */
        shownLines(opts = {}) {
          const r = shown().filter((x) => opts.any || worked(x)).pop();
          return r ? r.out.split('\n').map((l) => l.trim()).filter(Boolean) : [];
        },
        /* a command ran (successfully) at any point during this task */
        used(name, pred) { const n = [].concat(name); return game.taskRecs.some((r) => n.includes(r.name) && r.status === 0 && (!pred || pred(r))); },
        /* ...or was at least run, whatever its exit status (a failed ping is still an answer) */
        attempted(name, pred) { const n = [].concat(name); return game.taskRecs.some((r) => n.includes(r.name) && (!pred || pred(r))); },
        usedFlag(name, f) { return game.taskRecs.some((r) => r.name === name && r.status === 0 && LA.hasFlag(r.args, f)); },
        /* something you typed during this task (for tasks that ask for a particular technique) */
        typed(re) { return game.taskLines.some((l) => re.test(l)); },
        /* where a command was pointed: its non-option arguments resolved, or its working directory */
        targetOf(r) { const t = r.args.filter((a) => !a.startsWith('-')); return t.length ? t.map((a) => LA.VFS.normalize(exp(a), r.cwd)) : [r.cwd]; },
        x: game.task ? game.task.x : {},
      });
      return e;
    }
    async afterLine(evt) {
      /* a line typed on the previous task's machine (say, «skip») finishes after the new one is built */
      if (evt.shell && this.console && evt.shell.ui !== this.console.ui) return;
      if (!evt.synthetic) this.state.stats.commands++;
      for (const r of evt.recs) { this.taskRecs.push(r); if (r.status === 0) this.stepRan.add(r.name); }
      if (!evt.synthetic && evt.line && evt.line.trim()) this.taskLines.push(evt.line);
      this.stepEvents.push(...this.lineEvents);
      await this.flushNotices();
      const T = this.task;
      if (T && !T.solved && !evt.synthetic) {
        const e = this.makeEvent(evt);
        let ok = false, progressed = false;
        try {
          if (T.tpl.parts) {
            let changed = false;
            for (let i = 0; i < T.tpl.parts.length; i++) {
              const p = T.tpl.parts[i];
              /* conditions are rechecked every time (they can come undone); actions, once done, stay done */
              const now = p.state ? !!(await p.check(e, T.x)) : T.parts[i] || !!(await p.check(e, T.x));
              if (now !== T.parts[i]) { changed = true; if (now) progressed = true; T.parts[i] = now; }
            }
            ok = T.parts.every(Boolean) && (!T.tpl.check || !!(await T.tpl.check(e, T.x)));
            if (changed && !ok) await this.say(this.partsText());
          } else ok = !!(await T.tpl.check(e, T.x));
        } catch (err) { if (typeof console !== 'undefined') console.error('practice check', T.tpl.id, err); }
        if (ok || progressed) this.evidence.push(evt.recs.map((r) => r.name));
        if (ok) { T.solved = true; await this.completeTask(); this.lineEvents = []; return; }
        if (T.tpl.nudge) { let m = null; try { m = T.tpl.nudge(e, T.x); } catch (err) { m = null; } if (m) await this.say(m); }
      }
      this.lineEvents = [];
      this.save();
      if (this.view.update) this.view.update(this);
    }

    /* ---- scoring ---- */
    /* the commands you demonstrably used: those in the lines that solved the task (or a part of it), plus any of the
       task's own commands you ran successfully along the way — not every incidental «ls» */
    creditedCommands() {
      const catalog = new Set(P.allCommands(this.distroId));
      const declared = new Set(P.cmdsOf(this.task.tpl, this.distroId));
      const names = new Set();
      for (const line of this.evidence || []) for (const n of line) names.add(SAME[n] || n);
      for (const r of this.taskRecs) if (r.status === 0 && declared.has(SAME[r.name] || r.name)) names.add(SAME[r.name] || r.name);
      return [...names].filter((n) => catalog.has(n));
    }
    async completeTask() {
      const st = this.state, T = this.task, tpl = T.tpl, info = st.task;
      const unaided = !info.revealed;
      let gained = 0;
      if (unaided) {
        st.streak++;
        st.best = Math.max(st.best, st.streak);
        const mult = 1 + Math.min(st.streak - 1, 10) * 0.05;
        /* hints are part of learning: they cost nothing. Only seeing the answer forfeits the XP */
        gained = Math.round(XP[tpl.level] * mult);
        st.noHint = info.hint ? 0 : st.noHint + 1;
        st.independent[tpl.id] = (st.independent[tpl.id] || 0) + 1;
        st.topicSolved[tpl.topic] = (st.topicSolved[tpl.topic] || 0) + 1;
      } else {
        st.streak = 0;
        st.noHint = 0;
        /* you'll meet this one again, with different data, a few tasks from now */
        st.review = (st.review || []).filter((r) => r.id !== tpl.id).concat([{ id: tpl.id, due: st.stats.solved + st.stats.skipped + 3 }]);
      }
      const before = P.rankOf(st.xp)[1];
      st.xp += gained;
      st.stats.solved++;
      st.solved[tpl.id] = (st.solved[tpl.id] || 0) + 1;
      const used = this.creditedCommands();
      for (const c of used) {
        if (unaided) {
          st.mastery[c] = (st.mastery[c] || 0) + 1;
          const ts = st.masteryTasks[c] = st.masteryTasks[c] || [];
          if (!ts.includes(tpl.id) && ts.length < 12) ts.push(tpl.id);
        } else st.assistedUse[c] = (st.assistedUse[c] || 0) + 1;
      }
      let msg = `:::complete\n✓ SOLVED${gained ? `  +${gained} XP` : ' — with the answer shown, so no XP; it will come back later with new data'}${unaided && st.streak > 1 ? `  ·  streak ${st.streak}` : ''}\n:::`;
      if (used.length) msg += `\nPractised: ${used.map((c) => `«${c}»`).join(' ')}`;
      const sol = this.solutionLines();
      if (sol.length) msg += `\nOne way to do it:\n:::art\n${sol.join('\n')}\n:::`;
      const why = this.f(tpl.why);
      if (why) msg += `\n:::lesson\n${this.fmt(why)}\n:::`;
      await this.say(msg);
      const after = P.rankOf(st.xp)[1];
      if (after !== before) await this.say(`:::complete\nRANK UP — you are now: ${after}\n:::`);
      await this.checkBadges(tpl, unaided);
      this.save();
      if (st.autoNext) { await this.nextTask(); return; }
      await this.say(this.nextPrompt());
      if (this.view.update) this.view.update(this);
    }
    nextPrompt() { return 'The machine stays as it is, so look around if you like. «next» for a new task · «retry» to do this one again · «variant» for the same task with new data.'; }
    async badge(id) {
      if (this.state.badges.includes(id) || !P.BADGES[id]) return;
      this.state.badges.push(id);
      if (this.view.toast) this.view.toast(`Badge: ${P.BADGES[id][0]}`);
      await this.say(`:::badge\n${P.BADGES[id][0]}\n${P.BADGES[id][1]}.\n:::`);
    }
    async checkBadges(tpl, unaided) {
      const st = this.state;
      const n = st.stats.solved;
      if (n >= 1) await this.badge('first');
      if (n >= 10) await this.badge('ten');
      if (n >= 50) await this.badge('fifty');
      if (n >= 100) await this.badge('hundred');
      for (const k of [5, 10, 25]) if (st.streak >= k) await this.badge('streak' + k);
      if (st.noHint >= 25) await this.badge('purist');
      if (tpl.level === 4 && unaided) await this.badge('boss');
      if ((st.topicSolved[tpl.topic] || 0) >= 10) await this.badge('topic_' + tpl.topic);
      if (P.TOPICS.every(([id]) => st.topicSolved[id])) await this.badge('polyglot');
      if (P.allCommands(this.distroId).every((c) => P.masteryLevel(st, c) > 0)) await this.badge('complete');
    }

    /* ---- the player's controls ---- */
    async cmdHint(ctx) {
      const T = this.task, info = this.state.task;
      if (!T) return 0;
      if (T.solved) { await this.say('This one is solved. «next» for a new task.'); return 0; }
      const hints = (this.f(T.tpl.hints) || []).map((h) => this.f(h));
      const answer = this.solutionLines();
      const i = info.hint;
      if (i < hints.length) {
        info.hint++;
        this.state.stats.hints++;
        await this.say(`💡 ${this.fmt(hints[i])}`);
        if (ctx) ctx.err.write(LA.paint(A.gray, `  (hint ${i + 1} of ${hints.length}${i === hints.length - 1 && answer.length ? ' — after this, «hint» offers the full answer' : ''}. Hints don't cost XP.)`) + '\n');
      } else if (!answer.length) {
        await this.say('No more hints for this one — read the task again with «task».');
      } else if (!info.warned && !info.revealed) {
        /* never give the answer away by surprise */
        info.warned = true;
        await this.say('That was the last hint. The next «hint» shows a full answer — the task still counts, but earns no XP and ends your streak. Type «hint» (or «solution») again if you want it.');
      } else {
        await this.reveal('One way to do it');
      }
      this.save();
      if (this.view.update) this.view.update(this);
      return 0;
    }
    async reveal(title) {
      const info = this.state.task;
      if (!info.revealed) { info.revealed = true; this.state.stats.revealed = (this.state.stats.revealed || 0) + 1; }
      await this.say(`${title} (finish it yourself — it still counts, without XP):\n:::art\n${this.solutionLines().join('\n')}\n:::`);
    }
    async cmdGoal(ctx) {
      const a = ctx && ctx.args && ctx.args[0];
      if (a === 'list' || a === 'ls') return this.cmdTaskList(ctx, ctx.args[1]);
      if (a) {
        const tpl = P.tasksFor(this.distroId).find((t) => t.id === a);
        if (!tpl) { ctx.err.write(`task: no task called "${a}" here (try «task list»)\n`); return 1; }
        await this.nextTask(tpl.id);
        return 0;
      }
      await this.showTask();
      if (ctx && this.task) ctx.err.write(LA.paint(A.gray, `  (task ${this.task.tpl.id} · seed ${this.task.seed} · ${this.distroId} — quote this if a check seems wrong)`) + '\n');
      return 0;
    }
    /* the library: every task type, by topic, so you can pick the one you need */
    cmdTaskList(ctx, word) {
      const st = this.state;
      const w = (word || '').toLowerCase();
      const list = P.tasksFor(this.distroId).filter((t) => !w || t.topic === w || t.id.includes(w) || t.title.toLowerCase().includes(w) || P.cmdsOf(t, this.distroId).includes(w));
      if (!list.length) { ctx.err.write(`task: nothing matches "${word}"\n`); return 1; }
      for (const [id, label] of P.TOPICS) {
        const ts = list.filter((t) => t.topic === id);
        if (!ts.length) continue;
        ctx.println(LA.paint(ctx.isTTY ? A.bcyan : '', label));
        for (const t of ts) ctx.println(`  ${st.independent[t.id] ? '✓' : st.solved[t.id] ? '·' : ' '} ${U.padR(t.id, 20)} ${STARS(t.level)}  ${t.title}`);
      }
      ctx.println(LA.paint(ctx.isTTY ? A.gray : '', '«task ID» starts that task. ✓ solved on your own · · solved with the answer shown'));
      return 0;
    }
    async cmdStory() { return this.cmdGoal(); }
    async cmdSkip() {
      if (!this.task) return 0;
      if (this.task.solved) return this.cmdNext();
      this.state.stats.skipped++;
      const sol = this.solutionLines();
      /* skipping isn't failing: the streak stands, and the task comes back later */
      this.state.review = (this.state.review || []).filter((r) => r.id !== this.task.tpl.id).concat([{ id: this.task.tpl.id, due: this.state.stats.solved + this.state.stats.skipped + 4 }]);
      await this.say(`Skipped — it'll come back later with new data.${sol.length ? ` For next time:\n:::art\n${sol.join('\n')}\n:::` : ''}`);
      await this.nextTask();
      return 0;
    }
    async cmdNext(ctx) {
      const a = ctx && ctx.args && ctx.args[0];
      if (a === 'auto' || a === 'manual') {
        this.state.autoNext = a === 'auto';
        await this.say(a === 'auto' ? 'New tasks will follow straight after each solved one.' : 'After each solved task the machine stays put until you type «next».');
        this.save();
        return 0;
      }
      if (this.task && !this.task.solved) { if (ctx) ctx.err.write('next: this task isn\'t solved yet — «skip» for a different one\n'); return 1; }
      await this.nextTask();
      return 0;
    }
    /* the same task again: «retry» rebuilds the same machine, «variant» the same task with new data */
    async cmdRetry(ctx, fresh) {
      const T = this.task, info = this.state.task;
      if (!T) return 0;
      const keep = { hint: info.hint, revealed: info.revealed && !T.solved, warned: info.warned };
      await this.say(fresh ? 'Same task, new data:' : 'Starting this task again on a clean machine:');
      await this.nextTask(T.tpl.id, fresh ? null : T.seed);
      if (!fresh) Object.assign(this.state.task, keep);
      this.save();
      return 0;
    }
    async cmdVariant(ctx) { return this.cmdRetry(ctx, true); }
    async cmdSolution() {
      if (!this.task) return 0;
      if (this.task.solved) { await this.say(`One way to do it:\n:::art\n${this.solutionLines().join('\n')}\n:::`); return 0; }
      await this.reveal('One way to do it');
      this.save();
      if (this.view.update) this.view.update(this);
      return 0;
    }
    /* «check»: where do I stand? Without giving the answer away */
    async cmdCheck() {
      const T = this.task;
      if (!T) return 0;
      if (T.solved) { await this.say('✓ Solved. «next» for a new task.'); return 0; }
      const e = this.makeEvent({ line: '', recs: [], status: 0, shell: this.console.main });
      let msg = null;
      try { msg = T.tpl.feedback ? T.tpl.feedback(e, T.x) : null; } catch (err) { msg = null; }
      if (T.tpl.parts) {
        for (let i = 0; i < T.tpl.parts.length; i++) { const p = T.tpl.parts[i]; if (p.state) { try { T.parts[i] = !!(await p.check(e, T.x)); } catch (err) { T.parts[i] = false; } } }
        await this.say(`${this.partsText()}${msg ? '\n' + msg : ''}`);
      } else await this.say(msg || 'Not done yet. (Tasks are checked after every command — «hint» for a clue.)');
      if (this.view.update) this.view.update(this);
      return 0;
    }
    async setTopic(id, quiet) {
      this.state.topic = id;
      if (this.state.level && !this.levelsFor(id).includes(this.state.level)) {
        await this.say(`${id === 'mix' ? 'Everything' : this.topicLabel(id)} has no ${STARS(this.state.level)} tasks, so difficulty is back to automatic.`);
        this.state.level = 0;
      }
      if (!quiet) await this.say(`Topic: **${id === 'mix' ? 'Everything' : this.topicLabel(id)}**. New task:`);
      await this.nextTask();
    }
    topicLabel(id) { return (P.TOPICS.find((x) => x[0] === id) || [])[1] || id; }
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
      const have = this.levelsFor(this.state.topic);
      const where = this.state.topic === 'mix' ? 'all topics' : this.topicLabel(this.state.topic);
      if (!a) {
        ctx.println(`Difficulty: ${this.state.level ? STARS(this.state.level) + ' only' : 'automatic'}. In ${where}: ${have.map((l) => STARS(l)).join(', ')}.`);
        ctx.println('«level 1» … «level 4» picks one; «level auto» opens harder tasks in each topic as you solve the easier ones on your own.');
        return 0;
      }
      const n = a === 'auto' ? 0 : parseInt(a, 10);
      if (!(n >= 0 && n <= 4)) { ctx.err.write('level: use 1, 2, 3, 4 or auto\n'); return 1; }
      if (n && !have.includes(n)) { ctx.err.write(`level: ${where} has no ${STARS(n)} tasks — it has ${have.map((l) => STARS(l)).join(', ')}\n`); return 1; }
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
      ctx.println(c(A.bcyan, 'PRACTICE RANGE') + ` — ${LA.distro(this.distroId).label} — ${rank}, ${st.xp} XP${nx ? ` (${nx[0] - st.xp} to ${nx[1]})` : ''}`);
      ctx.println(`  solved ${st.stats.solved} (${Object.values(st.independent).reduce((a, b) => a + b, 0)} on your own) · answers shown ${st.stats.revealed || 0} · skipped ${st.stats.skipped} · hints ${st.stats.hints} · streak ${st.streak} (best ${st.best})`);
      if ((st.review || []).length) ctx.println(`  coming back for review: ${st.review.map((r) => r.id).join(', ')}`);
      ctx.println('\n' + c(A.bcyan, 'TOPICS') + c(A.gray, '  (task types solved on your own)'));
      for (const [id, label] of P.TOPICS) {
        const all = P.tasksFor(this.distroId).filter((t) => t.topic === id);
        const done = all.filter((t) => st.independent[t.id]).length;
        ctx.println(`  ${U.padR(label, 26)} ${'█'.repeat(Math.round((done / all.length) * 12)).padEnd(12, '·')} ${done}/${all.length}  up to ${STARS(this.reach(id))}`);
      }
      const cmds = P.allCommands(this.distroId);
      const lv = (n) => cmds.filter((x) => P.masteryLevel(st, x) >= n).length;
      ctx.println(`\n${c(A.bcyan, 'COMMANDS')} ${lv(1)}/${cmds.length} tried · ${lv(2)} practised · ${lv(3)} mastered (see «notebook»)`);
      ctx.println(`\n${c(A.bcyan, 'BADGES')} ${st.badges.length}/${Object.keys(P.BADGES).length}`);
      for (const [k, b] of Object.entries(P.BADGES)) if (st.badges.includes(k)) ctx.println(`  ${c(A.byellow, '🏅 ' + b[0])} — ${b[1]}`);
      return 0;
    }
    cmdNotebook(ctx) {
      const st = this.state;
      ctx.println('Commands you have actually used in solved tasks:');
      ctx.println('  · not yet   ▪ tried   ▪▪ practised (3 times on your own)   ▪▪▪ mastered (6 times on your own, in 3+ different tasks)');
      const cmds = P.allCommands(this.distroId);
      const cell = (x) => `${U.padR(x, 11)}${['·  ', '▪  ', '▪▪ ', '▪▪▪'][P.masteryLevel(st, x)]}`;
      for (let i = 0; i < cmds.length; i += 5) ctx.println('  ' + cmds.slice(i, i + 5).map(cell).join('  '));
      return 0;
    }
    cmdHelp(ctx) {
      if (ctx.args[0]) return super.cmdHelp(ctx);
      const c = (code, s) => (ctx.isTTY ? code + s + A.reset : s);
      const k = (s) => c(A.byellow, U.padR(s, 10));
      ctx.println(c(A.bcyan, 'PRACTICE RANGE') + ` — ${LA.distro(this.distroId).label} — how it works`);
      ctx.println('  Each task asks for an outcome on this machine; any correct way counts unless the task names a method.');
      ctx.println('  It is checked after every command. When it\'s solved, the machine stays until you ask for the next one.');
      ctx.println(`  ${k('task')} show the task again          ${k('check')} what's done and what's missing`);
      ctx.println(`  ${k('hint')} a hint (free); the last one   ${k('solution')} show an answer (no XP)`);
      ctx.println(`  ${U.padR('', 10)} offers the full answer`);
      ctx.println(`  ${k('next')} a new task, once solved      ${k('skip')} a different task (this one comes back later)`);
      ctx.println(`  ${k('retry')} this task, clean machine     ${k('variant')} this task, new data`);
      ctx.println(`  ${k('topic')} choose a topic               ${k('level')} choose difficulty (1–4, auto)`);
      ctx.println(`  ${k('task list')} every task type            ${k('progress')} rank, topics, badges, review`);
      ctx.println(`  ${k('notebook')} your commands by mastery     ${k('next auto')} skip the pause after solving`);
      ctx.println(`  Your password (for sudo) is «${this.password()}».`);
      if (this.task) ctx.println('\n' + c(A.bgreen, 'Current task: ') + U.stripAnsi(this.goalText()).replace(/[«»]/g, ''));
      return 0;
    }
    jumpTo() { return Promise.resolve(); }

    /* ---- trying a script in a copy of the machine (hidden tests for scripts) ---- */
    async trial(cmdline, o = {}) {
      const w = LA.World.deserialize(JSON.parse(JSON.stringify(this.world.serialize())));
      w.http = JSON.parse(JSON.stringify(this.world.http || {}));
      let out = '';
      const sink = { isTTY: false, write: (s) => { out += s; } };
      const answers = (o.stdin || []).slice();
      const ui = {
        stdout: sink, stderr: sink, columns: 80,
        prompt: (text) => { if (text) out += text; return Promise.resolve(answers.length ? answers.shift() : null); },
        readEOF: () => Promise.resolve(answers.length ? answers.splice(0).join('\n') + '\n' : null),
        page: () => Promise.resolve(), edit: () => Promise.resolve({}), top: () => Promise.resolve(), animate: () => Promise.resolve(),
        clear() {}, pushShell: () => Promise.resolve(0), allShells: () => [],
      };
      const keep = LA.game;
      const sh = new LA.Shell({ host: w.main, user: this.state.user, ui, game: null, world: w, cwd: o.cwd || this.console.main.cwd, interactive: false });
      let status = 1;
      try { status = await Promise.race([sh.run(cmdline), new Promise((r) => setTimeout(() => r(124), 3000))]); } catch (err) { status = 1; } finally { LA.game = keep; }
      return { out, status, world: w, fs: w.main.fs };
    }
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
