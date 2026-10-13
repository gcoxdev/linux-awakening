/* Linux Awakening — the story engine. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const U = LA.util;
  const VFS = LA.VFS;
  const A = LA.ansi;

  /* ---------------- story packs ----------------
     A story pack is a set of chapters plus everything the engine needs to know about the
     story's world: how to build it, its secrets and collectibles, and its voice. */
  LA.stories = LA.stories || {};
  LA.defineStory = (id, meta) => {
    const pack = Object.assign({ id, chapters: [], secrets: {}, collect: { label: 'Collected', noun: 'item', tag: '✦', banner: 'FOUND', items: {} }, flavor: {}, speakers: {} }, meta);
    pack.add = (ch) => { pack.chapters.push(ch); pack.chapters.sort((x, y) => x.n - y.n); };
    LA.stories[id] = pack;
    return pack;
  };
  LA.storyFor = (id) => LA.stories[id] || LA.stories.rootfall || Object.values(LA.stories)[0];
  /* a story's own wording for an engine message, with a neutral fallback */
  LA.flavor = (key, fallback) => {
    const g = LA.game;
    const v = g && g.pack && g.pack.flavor[key];
    return v !== undefined ? v : fallback;
  };

  const CMD_ALIAS = { dir: 'ls', 'apt-get': 'apt', egrep: 'grep', fgrep: 'grep', gawk: 'awk', '[': 'test', '.': 'source', htop: 'top', sh: 'bash', vi: 'nano', vim: 'nano', typeset: 'export', declare: 'export' };
  const NEVER_LOCKED = new Set(['vi', 'vim', 'htop', 'declare', 'typeset']);

  function hasFlag(args, f) {
    for (const a of args) {
      if (a === '--') break;
      if (a.startsWith('--')) { if (f.length > 1 && a.slice(2).split('=')[0] === f) return true; continue; }
      if (a.startsWith('-') && a.length > 1 && !/^-\d+$/.test(a) && f.length === 1 && a.slice(1).includes(f)) return true;
    }
    return false;
  }
  LA.hasFlag = hasFlag;

  /* ---------------- headless view (tests + fast-forward) ---------------- */
  class HeadlessView {
    constructor() { this.out = ''; this.columns = 100; this.edits = []; this.echo = true; }
    write(s) { this.out += s; if (this.out.length > 400000) this.out = this.out.slice(-200000); }
    narrate(m) { this.out += '\n' + m + '\n'; return Promise.resolve(); }
    clear() {}
    page(text) { this.out += U.stripAnsi(text); return Promise.resolve(); }
    edit(o) {
      const fn = this.edits.shift();
      if (fn) {
        const r = fn(o.content || '', o.filename);
        if (r !== null && r !== undefined) {
          const res = o.onSave(r, o.filename || 'untitled.txt');
          this.out += `[editor: saved ${JSON.stringify(res)}]\n`;
        }
      }
      return Promise.resolve({ quit: true });
    }
    top(fn) { this.out += U.stripAnsi(fn({ rows: 12 })); return Promise.resolve(); }
    animate() { return Promise.resolve(); }
    setMode() {}
    onIdle() {}
    update() {}
    chapterCard(ch) { this.out += `\n[CHAPTER ${ch.n}: ${ch.title}]\n`; return Promise.resolve(); }
    toast(t) { this.out += `[${t}]\n`; }
  }
  LA.HeadlessView = HeadlessView;

  async function runItems(con, items, game) {
    for (const it of items) {
      if (it && typeof it === 'object') {
        if (it.edit) { con.view.edits.push(it.edit); continue; }
        if (it.ctrlc) { await new Promise((r) => setTimeout(r, 30)); con.interrupt(); await con.settle(); continue; }
        if (it.nowait) { con.submit(game.fmt(it.nowait)); await new Promise((r) => setTimeout(r, 30)); continue; }
        if ('answer' in it) {
          if (!con.pending) continue;
          let a = it.answer;
          if (a === '$PW') a = game.password();
          await con.submit(a);
          continue;
        }
        continue;
      }
      if (it === '$PW') {
        /* only answer a prompt that is really asking for the player's own password (sudo, su to self, passwd's "Current") */
        if (!con.pending || (con.pending.text && !/\[sudo\]|Current password|password for/i.test(con.pending.text))) continue;
        await con.submit(game.password());
        continue;
      }
      await con.submit(game.fmt(it));
    }
  }
  LA.runItems = runItems;

  /* ---------------- the game ---------------- */
  class Game {
    constructor(view, storage, storyId) {
      this.pack = LA.storyFor(storyId);
      this.view = view;
      this.storage = storage || null;
      this.state = null;
      this.world = null;
      this.console = null;
      this.lineEvents = [];
      this.stepEvents = [];
      this.notices = [];
      this.silent = false;
      LA.game = this;
    }

    get chapters() { return this.pack.chapters; }
    /* the Linux this game's machine is (chosen on the menu; a save keeps its own) */
    get distroId() { return (this.world && this.world.distro) || (this.state && this.state.distro) || LA.distroId; }
    get distro() { return LA.distro(this.distroId); }
    /* a notebook entry as this distro spells it: the curriculum says «apt», Arch says «pacman» */
    cmdLabel(c) { return LA.isPmCmd(c) ? this.distro.pm : c; }
    get secrets() { return this.pack.secrets; }
    password(user) { return this.world.passwords[this.world.mainName][user || this.state.user]; }
    curChapter() { return this.chapters[this.state.ch]; }
    curStep() { const c = this.curChapter(); return c ? c.steps[this.state.step] : null; }
    get user() { return this.state.user; }
    get home() { return '/home/' + this.state.user; }
    get fs() { return this.world.main.fs; }
    get shell() { return this.console.main; }

    fmt(s) {
      if (typeof s === 'function') s = s(this);
      if (!s) return '';
      const u = this.state.user;
      return LA.distroText(String(s), this.distroId).replace(/\{user\}/g, u).replace(/\{User\}/g, u.charAt(0).toUpperCase() + u.slice(1)).replace(/\{home\}/g, '/home/' + u)
        .replace(/\{pw\}/g, () => this.password());
    }
    async say(markup) {
      if (this.silent || !markup) return;
      await this.view.narrate(this.fmt(markup));
    }

    /* ---- lifecycle ---- */
    /* ---- story clock: chapters happen at story times, not wall-clock times ---- */
    storyTime(day, h, m) {
      const d = new Date(this.state.clock.day0);
      d.setDate(d.getDate() + day);
      d.setHours(h, m, 0, 0);
      return d.getTime();
    }
    advanceClock(day, h, m) {
      if (!this.state.clock) return;
      const target = this.storyTime(day, h, m);
      if (LA.now() < target) LA.clockOffset += target - LA.now();
      this.state.clock.offset = LA.clockOffset;
    }

    newGame(user, opts = {}) {
      /* replaying a chapter rebuilds the same distro; a brand new game uses the menu's choice */
      LA.distroId = opts.distro || (this.state && this.state.distro) || LA.distroId;
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      LA.clockOffset = 0;
      this.state = { clock: { day0: midnight.getTime(), offset: 0 } };
      this.advanceClock(...(this.pack.startClock || [0, 9, 0]));
      const clock = this.state.clock;
      this.state = {
        clock,
        v: 1, story: this.pack.id, distro: LA.distroId, user, ch: 0, step: 0, unlocked: [], secrets: [], memories: [], hint: 0, setupDone: false, maxCh: 0,
        stats: { commands: 0, started: Date.now(), hints: 0 }, freeplay: false, done: false, flags: {},
      };
      this.world = this.pack.buildWorld(user);
      this.world.story = this.pack.id;
      this.world.updatedb();
      LA.tz = this.world.sys.tz;
      this.console = new LA.Console(opts.view || this.view, this.world, this);
      this.console.createMainShell(user, this.pack.startCwd(user));
      /* a fresh login: read ~/.profile like any login shell (a saved game restores its shell instead) */
      this.console.main.ready = this.console.main.startup(true);
    }

    async start() {
      await this.startChapter();
      this.save();
    }

    async startChapter() {
      const ch = this.curChapter();
      if (!ch) return this.finale();
      for (const c of ch.unlocks || []) if (!this.state.unlocked.includes(c)) this.state.unlocked.push(c);
      this.state.maxCh = Math.max(this.state.maxCh || 0, this.state.ch);
      if (ch.clock) this.advanceClock(...ch.clock);
      if (this.pack.onChapter) this.pack.onChapter(this);
      if (ch.onStart) ch.onStart(this);
      if (!this.silent && this.view.chapterCard) await this.view.chapterCard(ch, this);
      if (ch.intro) await this.say(ch.intro);
      await this.beginStep();
      if (this.view.update) this.view.update(this);
    }

    async beginStep() {
      const step = this.curStep();
      if (!step) return;
      if (!this.state.setupDone) {
        this.state.hint = 0;
        this.state.stepMem = {};
        this.stepEvents = [];
        this.stepRan = new Set();
        if (step.setup) step.setup(this);
        this.state.setupDone = true;
        /* a step the player already accomplished while exploring is acknowledged, not repeated */
        if (step.skip && step.skip(this)) {
          if (step.skipSay) await this.say(step.skipSay);
          await this.advance();
          return;
        }
      }
      if (step.say) await this.say(step.say);
      await this.showGoal();
    }

    async advance() {
      this.state.step++;
      this.state.setupDone = false;
      if (this.state.step >= this.curChapter().steps.length) await this.completeChapter();
      else await this.beginStep();
    }

    async showGoal() {
      const step = this.curStep();
      if (!step || this.silent) return;
      await this.view.narrate(`:::goal\n${this.fmt(step.goal)}\n:::`);
    }

    async completeStep() {
      const step = this.curStep();
      const ch = this.curChapter();
      if (step.done) await this.say(step.done);
      if (step.after) step.after(this);
      /* a step can reveal one of the story's collectibles (a piece of evidence, say) */
      if (step.evidence && this.collect(step.evidence)) await this.flushNotices();
      void ch;
      await this.advance();
      if (this.view.update) this.view.update(this);
    }

    async completeChapter() {
      const ch = this.curChapter();
      if (ch.outro) await this.say(ch.outro);
      if (ch.onEnd) await ch.onEnd(this);
      if (!this.silent) {
        const learned = (ch.unlocks || []).map((c) => `«${this.cmdLabel(c)}»`).join(' ');
        await this.view.narrate(`:::complete\nCHAPTER ${ch.n} COMPLETE — ${ch.title}\n${learned ? 'New in your notebook: ' + learned : ''}\n:::`);
      }
      this.state.ch++;
      this.state.step = 0;
      this.state.setupDone = false;
      this.save();
      if (!this.curChapter()) { await this.finale(); return; }
      await this.startChapter();
    }

    async finale() {
      if (this.state.done) return;
      this.state.done = true;
      this.state.freeplay = true;
      this.state.stats.finished = LA.now();
      if (this.pack.epilogue && !this.silent) await this.say(this.pack.epilogue(this));
      this.save();
      if (this.view.update) this.view.update(this);
    }

    /* ---- per-line hook (called by the shell) ---- */
    async afterLine(evt) {
      if (!evt.synthetic) this.state.stats.commands++;
      if (this.pack.onLine) this.pack.onLine(this, evt);
      if (!this.stepRan) this.stepRan = new Set();
      for (const r of evt.recs) if (r.status === 0) this.stepRan.add(r.name);
      this.stepEvents.push(...this.lineEvents);
      await this.flushNotices();
      if (!this.state.done) {
        const step = this.curStep();
        if (step) {
          const e = this.makeEvent(evt);
          let ok = false;
          try { ok = !!step.check(e); } catch (err) { if (typeof console !== 'undefined') console.error('check error', err); }
          if (ok) await this.completeStep();
          else if (step.nudge && !this.silent) {
            let msg = null;
            try { msg = step.nudge(e); } catch (err) { msg = null; }
            if (msg) await this.say(msg);
          }
        }
      }
      this.lineEvents = [];
      this.save();
      if (this.view.update) this.view.update(this);
    }

    makeEvent(evt) {
      const game = this;
      const fs = this.fs;
      const recs = evt.recs;
      const events = this.lineEvents;
      const stepEvents = this.stepEvents;
      const sh = evt.shell;
      const stripped = evt.line.replace(/'[^']*'|"(?:\\.|[^"])*"/g, '""');
      return {
        line: evt.line, status: evt.status, recs, shell: sh, cwd: sh.cwd, host: sh.host.name, user: sh.user,
        home: this.home, fs, world: this.world, game, events, stepEvents, mem: this.state.stepMem,
        pipe: /(^|[^|])\|([^|]|$)/.test(stripped),
        ran(name, pred) { const n = [].concat(name); return recs.find((r) => n.includes(r.name) && r.status === 0 && (!pred || pred(r))) || null; },
        tried(name, pred) { const n = [].concat(name); return recs.find((r) => n.includes(r.name) && (!pred || pred(r))) || null; },
        has(r, f) { return hasFlag(r.args, f); },
        ops(r) { return r.args.filter((a) => !a.startsWith('-') || a === '-'); },
        absOf(r, p) { return VFS.normalize(p, r.cwd); },
        targets(r) { return r.args.filter((a) => !a.startsWith('-')).map((p) => VFS.normalize(p, r.cwd)); },
        read(p) { const n = fs.tryGet(p); return n && n.type === 'file' ? fs.contentOf(n) : null; },
        exists(p) { return !!fs.tryGet(p, 'root', false); },
        node(p) { return fs.tryGet(p, 'root', false); },
        didRead(p, host = game.world.mainName) { return events.some((ev) => ev.type === 'read' && ev.host === host && (p instanceof RegExp ? p.test(ev.path) : ev.path === p)); },
        event(type, pred) { return events.find((ev) => ev.type === type && (!pred || pred(ev))) || null; },
        stepEvent(type, pred) { return stepEvents.find((ev) => ev.type === type && (!pred || pred(ev))) || null; },
        stepRan(name) { return game.stepRan.has(name); },
        out() { return recs.map((r) => r.out || '').join(''); },
      };
    }

    note(type, data) { this.lineEvents.push(Object.assign({ type }, data)); }

    async flushNotices() {
      const n = this.notices.splice(0);
      for (const x of n) {
        if (this.silent) continue;
        await this.view.narrate(this.fmt(x));
      }
    }

    /* ---- unlocking ---- */
    curriculum() {
      if (!this._curr) {
        this._curr = {};
        for (const ch of this.chapters) for (const c of ch.unlocks || []) if (!(c in this._curr)) this._curr[c] = ch.n;
      }
      return this._curr;
    }
    isUnlocked(name) {
      if (this.state.freeplay || this.state.done) return true;
      const base = LA.isPmCmd(name) ? 'apt' : CMD_ALIAS[name] || name;
      if (NEVER_LOCKED.has(name)) return true;
      const cur = this.curriculum();
      if (!(base in cur)) return true;
      return this.state.unlocked.includes(base);
    }
    lockCheck(name) {
      if (this.isUnlocked(name)) return null;
      const base = LA.isPmCmd(name) ? 'apt' : CMD_ALIAS[name] || name;
      const n = this.curriculum()[base];
      const ch = this.chapters.find((c) => c.n === n);
      return LA.paint(A.gray, `${name}: the word is on the tip of your tongue, but it won't come back yet.`) + '\n' +
        LA.paint(A.gray, `  (You'll remember it in Chapter ${n}${ch ? ': ' + ch.title : ''}.)`) + '\n';
    }

    notFound(name, shell, argv) {
      const own = this.pack.notFound ? this.pack.notFound(this, name, argv) : null;
      if (own) return own;
      /* another distro's package manager: say which one this machine uses */
      if (LA.isPmCmd(name) && LA.foreignCmd(name, this.distroId)) {
        const D = this.distro;
        const pm = name === 'rpm' || name === 'dpkg' ? D.lowPm : D.pm;
        return `bash: ${name}: command not found\n${LA.paint(A.gray, `  (This machine runs ${D.label}, whose package manager is «${pm}». For example: «${LA.distroText(name === 'rpm' || name === 'dpkg' ? '{pkg:query htop}' : '{pkg:install htop}', D.id)}» — see «man ${pm}».)`.replace(/[«»]/g, ''))}\n`;
      }
      const msgs = {
        emacs: () => `bash: emacs: command not found\n${LA.paint(A.gray, LA.flavor('emacs', '(Emacs isn\'t installed here. Try nano.)'))}\n`,
        'cd..': () => `bash: cd..: command not found\n${LA.paint(A.gray, '(Put a space between them:  cd ..)')}\n`,
        sl: () => `bash: sl: command not found\n${LA.paint(A.gray, LA.flavor('sl', '(Did you mean ls?)'))}\n`,
        quit: () => `bash: quit: command not found\n${LA.paint(A.gray, '(To leave a pager or manual, press q. To leave a nested shell, type exit.)')}\n`,
      };
      if (msgs[name]) return msgs[name]();
      if (/^ls-/.test(name)) return `bash: ${name}: command not found\n${LA.paint(A.gray, `(Options need a space before them:  ls ${name.slice(2)})`)}\n`;
      const known = Object.keys(LA.commands).filter((c) => !LA.commands[c].meta && this.isUnlocked(c) && c.length > 1);
      let best = null, bd = 3;
      for (const c of known) { const d = U.editDistance(name, c); if (d < bd) { bd = d; best = c; } }
      if (best && name.length > 1) return `bash: ${name}: command not found\n${LA.paint(A.gray, `  (did you mean: ${best}?)`)}\n`;
      return null;
    }

    intercept(line) {
      if (/:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/.test(line)) {
        this.secret('fork_bomb');
        this.console.ui.stderr.write(LA.paint(A.byellow, LA.flavor('forkBomb', 'The machine refuses.')) + '\n' + 'bash: fork bomb defused. (That one-liner makes a function that calls itself twice, forever, until the machine drowns.)\n');
        return Promise.resolve({ status: 1 });
      }
      if (/\brm\s+(-\w+\s+)*\/\*/.test(line) && /-\w*r/.test(line)) this.secret('nice_try');
      return Promise.resolve(null);
    }

    /* ---- notes from commands ---- */
    noteRead(abs, host, user) {
      this.note('read', { path: abs, host, user });
      if (host === this.world.mainName && this.pack.onRead) this.pack.onRead(this, abs);
    }
    secret(id) {
      const SECRETS = this.secrets;
      if (!SECRETS[id] || this.state.secrets.includes(id)) return;
      this.state.secrets.push(id);
      const n = this.state.secrets.length, total = Object.keys(SECRETS).length;
      this.notices.push(`:::secret\nSECRET FOUND — ${SECRETS[id][0]}  (${n}/${total})\n${SECRETS[id][1]}.\n:::`);
      if (this.view.toast) this.view.toast(`Secret: ${SECRETS[id][0]}`);
      if (this.view.update) this.view.update(this);
    }
    /* the story's collectibles (memories, evidence...): true when newly found */
    collect(id) {
      const C = this.pack.collect;
      if (!C.items[id] || this.state.memories.includes(id)) return false;
      this.state.memories.push(id);
      const n = this.state.memories.length, total = Object.keys(C.items).length;
      this.notices.push(`:::memory\n${C.banner} — ${C.items[id]}  (${n}/${total})\n:::`);
      if (this.view.toast) this.view.toast(`${C.noun.charAt(0).toUpperCase() + C.noun.slice(1)}: ${C.items[id]}`);
      if (this.view.update) this.view.update(this);
      return true;
    }
    onCd(abs, sh) {
      this.note('cd', { path: abs });
      if (sh.host.name === this.world.mainName && this.pack.onCd) this.pack.onCd(this, abs);
    }
    noteSource(abs) { this.note('source', { path: abs }); }
    noteScript(abs) { this.note('script', { path: abs }); }
    noteMan(name) { this.note('man', { name }); }
    noteTop() { this.note('top', {}); }
    noteIp() { this.note('ip', {}); }
    noteSockets(root) { this.note('sockets', { root }); }
    onEdit(path) { this.note('edit', { path }); }
    onSudo(user, args) { this.note('sudo', { user, args }); }
    onBadPassword(user) {
      this.state.badPw = (this.state.badPw || 0) + 1;
      if (this.state.badPw % 3 === 0 && !this.silent && this.pack.badPassword) {
        const msg = this.pack.badPassword(this);
        if (msg) this.notices.push(msg);
      }
    }
    onSuFail() { this.note('sufail', {}); }
    onPasswordChange(user) { this.note('passwd', { user }); this.state.flags.pwChanged = true; }
    onAccountChange(name, what) { this.note('account', { name, what }); }
    onService(u, verb) { this.note('service', { unit: u, verb }); }
    onCrontab(who, what) { this.note('crontab', { who, what }); }
    onMount(dev, path) { this.note('mount', { dev, path }); }
    onInstall(n) { this.note('install', { pkg: n }); }
    onKill() { this.note('kill', {}); }
    onProcKilled(p, sig) { this.note('killed', { pid: p.pid, comm: p.comm, user: p.user, sig }); }
    onPing(h) { this.note('ping', { host: h.fqdn, ip: h.ip }); }
    onCurl(url) { this.note('curl', { url }); if (this.pack.onUrl) this.pack.onUrl(this, url); }
    onDownload(abs, url) { this.note('download', { path: abs, url }); if (this.pack.onUrl) this.pack.onUrl(this, url); }
    onSsh(host, user) { this.note('ssh', { host, user }); }
    onScp(from, to, sh, dh) { this.note('scp', { from, to, srcHost: sh, dstHost: dh }); }
    onArchive(kind, abs, paths) { this.note('archive', { kind, path: abs, paths }); }
    onGzip(kind, path) { this.note('gzip', { kind, path }); }
    onDns(name, answers) { this.note('dns', { name }); if (this.pack.onDns) this.pack.onDns(this, name, answers); }
    onOutside(name) {
      if (this.state.flags.outside) return;
      this.state.flags.outside = true;
      const msg = LA.flavor('outside', null);
      if (msg) this.notices.push(msg);
    }
    onBan(ip) { this.note('ban', { ip }); }
    async onShellEnter(sh) {
      this.note('shellEnter', { host: sh.host.name, user: sh.user });
      await this.afterLine({ line: '', recs: [], status: 0, shell: sh, synthetic: true });
    }
    onShellExit(sh) { this.note('shellExit', { host: sh.host.name, user: sh.user }); }
    onTopExit() {
      const msg = LA.paint(A.gray, LA.flavor('topExit', "There's nowhere to log out to — this is the only shell you have.")) + '\n';
      this.console.ui.stderr.write(msg);
    }

    /* ---- meta commands ---- */
    speaker() { return this.pack.hintSpeaker ? this.pack.hintSpeaker(this) : this.pack.companion || 'Hint'; }
    async cmdHint(ctx) {
      const step = this.curStep();
      if (!step || this.state.done) { await this.say(LA.flavor('done', `You're on your own now — and you're ready. Try «help» or «man» anything.`)); return 0; }
      const hints = step.hints || [];
      if (!hints.length) { await this.say(`@${this.speaker()}: Read the goal again — type «goal».`); return 0; }
      const lvl = Math.min(this.state.hint, hints.length - 1);
      let h = hints[lvl];
      if (typeof h === 'function') h = h(this);
      this.state.hint++;
      this.state.stats.hints++;
      const who = this.speaker();
      const last = lvl === hints.length - 1;
      await this.say(`@${who}: ${h}${!last ? '\n' + LA.paint('', '') : ''}`);
      if (!last && !this.silent) ctx.err.write(LA.paint(A.gray, `  (hint ${lvl + 1}/${hints.length} — type hint again for more)`) + '\n');
      return 0;
    }
    async cmdGoal() { await this.showGoal(); if (!this.curStep()) await this.say('You have finished the story. Everything is unlocked: explore, experiment, break things (then fix them).'); return 0; }
    async cmdStory() {
      const step = this.curStep();
      if (!step) return this.cmdGoal();
      if (this.state.step === 0 && this.curChapter().intro) await this.say(this.curChapter().intro);
      if (step.say) await this.say(step.say);
      await this.showGoal();
      return 0;
    }
    cmdHelp(ctx) {
      if (ctx.args[0]) {
        const p = LA.man[ctx.args[0]];
        if (p) { ctx.println(`${ctx.args[0]}: ${p.syn.split('\n')[0]}\n    ${p.desc}.\n    (see: man ${ctx.args[0]})`); return 0; }
        ctx.err.write(`bash: help: no help topics match \`${ctx.args[0]}'.  Try \`man ${ctx.args[0]}'.\n`);
        return 1;
      }
      const c = (code, s) => (ctx.isTTY ? code + s + A.reset : s);
      ctx.println(c(A.bcyan, 'LINUX AWAKENING') + ` — ${this.pack.title} — how to play`);
      ctx.println('  Type commands at the prompt and press Enter. Follow the story; the goal is always shown.');
      ctx.println(`  ${c(A.byellow, 'goal')}      repeat your current objective      ${c(A.byellow, 'hint')}      ask ${U.padR(this.pack.companion || 'for', 4)} for a nudge (repeat for more)`);
      ctx.println(`  ${c(A.byellow, 'story')}     replay the current scene            ${c(A.byellow, 'progress')}  chapters, ${this.pack.collect.label.toLowerCase()}, secrets`);
      ctx.println(`  ${c(A.byellow, 'notebook')}  every command you've remembered      ${c(A.byellow, 'man CMD')}   the manual for any command`);
      ctx.println(`  Keys: ↑/↓ history · Tab completes · Ctrl+C cancels · Ctrl+L clears · Ctrl+D ends input`);
      if (this.pack.scope) ctx.println(c(A.gray, '  ' + U.stripAnsi(this.fmt(this.pack.scope)).replace(/[«»]/g, '')));
      const step = this.curStep();
      if (step) ctx.println('\n' + c(A.bgreen, 'Current goal: ') + U.stripAnsi(this.fmt(step.goal)).replace(/[«»]/g, ''));
      return this.cmdNotebook(ctx, true);
    }
    cmdNotebook(ctx, compact) {
      const c = (code, s) => (ctx.isTTY ? code + s + A.reset : s);
      ctx.println('\n' + c(A.bcyan, 'NOTEBOOK') + ' — commands you remember');
      for (const ch of this.chapters) {
        const list = (ch.unlocks || []).filter((x) => this.state.unlocked.includes(x) || this.state.freeplay).map((x) => this.cmdLabel(x));
        if (!list.length) continue;
        if (compact) { ctx.println(`  ${c(A.gray, U.padR('Ch.' + ch.n, 6))} ${list.join('  ')}`); continue; }
        ctx.println(c(A.byellow, `\n  Chapter ${ch.n}: ${ch.title}`));
        for (const name of list) {
          const p = LA.man[name];
          ctx.println(`    ${c(A.bgreen, U.padR(name, 12))} ${p ? p.desc : ''}`);
        }
      }
      return 0;
    }
    cmdProgress(ctx) {
      const c = (code, s) => (ctx.isTTY ? code + s + A.reset : s);
      ctx.println(c(A.bcyan, 'PROGRESS'));
      this.chapters.forEach((ch, i) => {
        const mark = i < this.state.ch || this.state.done ? c(A.bgreen, '✓') : i === this.state.ch ? c(A.byellow, '▶') : c(A.gray, '·');
        const extra = i === this.state.ch && !this.state.done ? c(A.gray, `  (step ${this.state.step + 1}/${ch.steps.length})`) : '';
        ctx.println(`  ${mark} ${U.padR('Chapter ' + ch.n, 11)} ${i <= this.state.maxCh || this.state.done ? ch.title : c(A.gray, '???')}${extra}`);
      });
      const C = this.pack.collect, SECRETS = this.secrets;
      ctx.println(`\n${c(A.bcyan, C.label.toUpperCase())} ${this.state.memories.length}/${Object.keys(C.items).length}`);
      for (const [k, t] of Object.entries(C.items)) ctx.println(`  ${this.state.memories.includes(k) ? c(A.bmagenta, '✦ ' + t) : c(A.gray, '· ???')}`);
      ctx.println(`\n${c(A.bcyan, 'SECRETS')} ${this.state.secrets.length}/${Object.keys(SECRETS).length}`);
      for (const [k, t] of Object.entries(SECRETS)) if (this.state.secrets.includes(k)) ctx.println(`  ${c(A.byellow, '★ ' + t[0])} — ${t[1]}`);
      const left = Object.keys(SECRETS).length - this.state.secrets.length;
      if (left) ctx.println(c(A.gray, `  ...and ${left} more ${LA.flavor('moreSecrets', 'still hidden')}.`));
      ctx.println(`\n${c(A.gray, `Commands typed: ${this.state.stats.commands} · Hints used: ${this.state.stats.hints}`)}`);
      return 0;
    }

    /* ---- persistence ---- */
    serialize() {
      const top = this.console.active;
      const remote = top && top !== this.console.main && top.host.name !== this.world.mainName ? { host: top.host.name, user: top.user } : null;
      if (this.state.clock) this.state.clock.offset = LA.clockOffset;
      return { state: this.state, world: this.world.serialize(), shell: this.console.shellState(this.console.main), remote, ts: LA.now() };
    }
    save() {
      if (!this.storage || this.silent || !this.world) return;
      let ok;
      try { ok = this.storage.set(this.saveKey, JSON.stringify(this.serialize())) !== false; } catch (e) { ok = false; }
      /* say so once, rather than letting the player believe their progress is safe */
      if (!ok && this.saveOk !== false && this.view.toast) this.view.toast('Progress could not be saved — this browser\'s storage is full or blocked.');
      this.saveOk = ok;
    }
    loadFrom(data) {
      this.pack = LA.storyFor(data.state.story);
      this.state = data.state;
      this.state.story = this.pack.id;
      LA.clockOffset = this.state.clock ? this.state.clock.offset || 0 : 0;
      this.droppedRemote = data.remote || null;
      this.world = LA.World.deserialize(data.world);
      LA.distroId = this.world.distro;
      this.state.distro = this.world.distro;
      LA.tz = this.world.sys.tz;
      this.console = new LA.Console(this.view, this.world, this);
      this.console.createMainShell(this.state.user, data.shell.cwd, data.shell);
      this.stepEvents = [];
      this.stepRan = new Set();
    }
    load() {
      const raw = this.storage && this.storage.get(this.saveKey);
      if (!raw) return false;
      try { this.loadFrom(JSON.parse(raw)); return true; } catch (e) { if (typeof console !== 'undefined') console.error(e); return false; }
    }
    async resume() {
      if (this.view.update) this.view.update(this);
      if (this.state.done) { await this.say(LA.flavor('welcomeBack', 'Welcome back, {user}. The story is complete — everything is unlocked. Explore freely.')); return; }
      await this.say(`:::resume\nWelcome back, {user}. Chapter ${this.curChapter().n}: ${this.curChapter().title}\n:::`);
      if (this.droppedRemote) {
        const r = this.droppedRemote;
        const dropped = LA.flavor('dropped', null);
        await this.say(dropped ? dropped(r) : `Your connection to ${r.host} dropped while you were away — you're back on ${this.world.mainName}. Reconnect with «ssh ${r.user}@${r.host}» to carry on there.`);
        this.droppedRemote = null;
      }
      await this.beginStep();
    }

    /* ---- chapter select: rebuild the world and replay earlier chapters headlessly ---- */
    async jumpTo(chIdx, onProgress) {
      const user = this.state.user;
      const realView = this.view;
      const hv = new HeadlessView();
      const saveScale = LA.timeScale;
      const keep = { secrets: this.state.secrets.slice(), memories: this.state.memories.slice(), stats: this.state.stats, maxCh: this.state.maxCh };
      LA.timeScale = 0;
      this.silent = true;
      this.view = hv;
      try {
        this.newGame(user, { view: hv });
        await this.startChapter();
        while (this.state.ch < chIdx) {
          const step = this.curStep();
          const ch = this.state.ch, st = this.state.step;
          await runItems(this.console, step.solve || [], this);
          if (this.state.ch === ch && this.state.step === st) await this.completeStep();
          if (onProgress) onProgress(this.state.ch / chIdx);
        }
      } finally {
        LA.timeScale = saveScale;
        this.silent = false;
        this.view = realView;
      }
      const shellState = this.console.shellState(this.console.main);
      for (const sh of this.console.stack) this.world.reap(sh.pid);
      this.console = new LA.Console(realView, this.world, this);
      const cwd = this.world.main.fs.tryGet(shellState.cwd, user) ? shellState.cwd : this.home;
      this.console.createMainShell(user, cwd, shellState);
      /* the replay ran the reference solutions, optional discoveries included; keep only what the player earned */
      this.state.secrets = keep.secrets;
      this.state.memories = keep.memories;
      this.state.maxCh = Math.max(keep.maxCh, this.state.maxCh);
      this.state.stats = keep.stats;
      this.state.setupDone = true;
      this.stepEvents = [];
      this.stepRan = new Set();
      this.save();
      if (this.view.update) this.view.update(this);
      if (this.view.clear) this.view.clear();
      if (this.view.chapterCard) await this.view.chapterCard(this.curChapter(), this);
      if (this.curChapter().intro) await this.say(this.curChapter().intro);
      const step = this.curStep();
      if (step && step.say) await this.say(step.say);
      await this.showGoal();
    }

    setFreeplay(on) {
      this.state.freeplay = !!on || this.state.done;
      this.save();
      if (this.view.update) this.view.update(this);
    }
  }

  LA.Game = Game;
})();
