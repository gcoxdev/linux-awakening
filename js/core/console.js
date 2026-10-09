/* Linux Awakening — Console: routes input to shells, prompts and stdin readers.
   DOM-free; the browser terminal and the Node test harness both drive it. */
(function () {
  'use strict';
  const LA = globalThis.LA;

  class Console {
    /* view: { write(text, stream), narrate(markup) → Promise, clear(), columns,
               page(text, o), edit(o), top(fn, o), animate(frames, o),
               setMode(mode, promptText), onIdle() } */
    constructor(view, world, game) {
      this.view = view;
      this.world = world;
      this.game = game;
      this.stack = [];
      this.pending = null; // { kind: 'prompt'|'eof', resolve, buf, hidden, signal }
      this.source = '';
      this.idleWaiters = [];
      this.wakers = [];
      const self = this;
      this.ui = {
        stdout: { isTTY: true, write: (s) => self.view.write(s, 'out') },
        stderr: { isTTY: true, write: (s) => self.view.write(s, 'err') },
        get columns() { return self.view.columns || 80; },
        prompt: (text, o = {}) => self.prompt(text, o),
        readEOF: (signal) => self.readEOF(signal),
        page: (text, o) => (self.view.page ? self.view.page(text, o) : Promise.resolve()),
        edit: (o) => (self.view.edit ? self.view.edit(o) : Promise.resolve({})),
        top: (fn, o) => (self.view.top ? self.view.top(fn, o) : Promise.resolve()),
        animate: (frames, o) => (self.view.animate ? self.view.animate(frames, o) : Promise.resolve()),
        clear: () => self.view.clear && self.view.clear(),
        pushShell: (o) => self.pushShell(o),
        allShells: () => self.stack.slice(),
      };
    }

    get active() { return this.stack[this.stack.length - 1]; }
    get main() { return this.stack[0]; }

    createMainShell(user, cwd, state) {
      const host = this.world.rootfall;
      const sh = new LA.Shell({ host, user, ui: this.ui, game: this.game, world: this.world, cwd, interactive: true, login: true, tty: 'pts/1' });
      const p = this.world.proc(sh.pid);
      if (p) p.shell = true;
      if (state) this.restoreShell(sh, state);
      this.world.removeSession((s) => s.player);
      this.world.sessions.unshift({ user, tty: 'pts/1', from: '', host: 'rootfall', at: LA.now(), player: true, what: '-bash' });
      this.stack = [sh];
      return sh;
    }

    shellState(sh) {
      const vars = {};
      for (const [k, v] of sh.vars) vars[k] = v;
      return { cwd: sh.cwd, vars, aliases: sh.aliases, history: sh.history.slice(-500), umask: sh.umask };
    }
    restoreShell(sh, st) {
      sh.cwd = st.cwd || sh.cwd;
      if (st.vars) { sh.vars = new Map(Object.entries(st.vars)); }
      sh.aliases = Object.assign({}, st.aliases || {});
      sh.history = (st.history || []).slice();
      if (st.umask !== undefined) sh.umask = st.umask;
    }

    /* ---- input routing ---- */
    promptString() {
      if (this.pending) return this.pending.kind === 'prompt' ? null : '';
      if (this.source) return this.active.promptString('PS2');
      return this.active.promptString('PS1');
    }

    isIdle() {
      if (this.pending) return true;
      const sh = this.active;
      return !!sh && !sh.busy;
    }
    waitIdle() {
      if (this.isIdle()) return Promise.resolve();
      return new Promise((r) => this.idleWaiters.push(r));
    }
    checkIdle() {
      if (!this.isIdle()) return;
      const w = this.idleWaiters.splice(0);
      w.forEach((f) => f());
      if (this.view.onIdle) this.view.onIdle();
    }

    /* Submit a line typed by the user. */
    async submit(line) {
      if (this.pending) {
        const p = this.pending;
        if (p.kind === 'prompt') {
          this.pending = null;
          this.view.write(p.hidden ? '\n' : line + '\n', 'echo');
          p.resolve(line);
        } else {
          this.view.write(line + '\n', 'echo');
          p.buf += line + '\n';
        }
        await this.settle();
        return;
      }
      const sh = this.active;
      if (!sh || sh.busy) return;
      const src = this.source ? this.source + '\n' + line : line;
      this.view.write(line + '\n', 'echo');
      if (!src.trim() && !this.source) { this.checkIdle(); return; }
      if (!LA.isComplete(src)) { this.source = src; this.checkIdle(); return; }
      this.source = '';
      const runP = sh.run(src).catch((e) => { if (typeof console !== 'undefined') console.error(e); }).finally(() => this.checkIdle());
      const woke = new Promise((r) => this.wakers.push(r));
      await Promise.race([runP, woke]);
      await this.settle();
    }

    /* wait until the system is idle (used by tests and fast-forward) */
    async settle() {
      await new Promise((r) => setTimeout(r, 0));
      await this.waitIdle();
      this.checkIdle();
    }

    /* a prompt opened or a shell was pushed: let a waiting submit() return */
    wake() { const w = this.wakers.splice(0); w.forEach((f) => f()); }

    /* Ctrl+C */
    interrupt() {
      if (this.pending) {
        const p = this.pending;
        this.pending = null;
        this.view.write('^C\n', 'echo');
        if (p.kind === 'prompt') p.resolve(null);
        else p.resolve(null);
        if (p.signal) { /* the command will notice */ }
        return;
      }
      if (this.source) { this.source = ''; this.view.write('^C\n', 'echo'); this.checkIdle(); return; }
      const sh = this.active;
      if (sh && sh.busy) { this.view.write('^C\n', 'echo'); sh.interrupt(); }
      for (const s of this.stack) if (s.busy) s.interrupt();
    }

    /* Ctrl+D */
    eof() {
      if (this.pending && this.pending.kind === 'eof') {
        const p = this.pending;
        this.pending = null;
        p.resolve(p.buf);
        return true;
      }
      if (this.pending) return false;
      if (this.source) return false;
      const sh = this.active;
      if (sh && !sh.busy) {
        if (this.stack.length > 1) { this.view.write('exit\n', 'echo'); this.submit('exit'); return true; }
        this.view.write('\n', 'echo');
        if (this.game) this.game.onTopExit(sh);
        this.checkIdle();
        return true;
      }
      return false;
    }

    prompt(text, o = {}) {
      return new Promise((resolve) => {
        if (o.signal && o.signal.aborted) return resolve(null);
        this.pending = { kind: 'prompt', resolve, hidden: !!o.hidden, text, signal: o.signal };
        if (text) this.view.write(text, 'prompt');
        if (this.view.setMode) this.view.setMode(o.hidden ? 'hidden' : 'prompt', text);
        this.wake();
        this.checkIdle();
      });
    }

    readEOF(signal) {
      return new Promise((resolve) => {
        this.pending = { kind: 'eof', resolve: (v) => resolve(v === null ? '' : v), buf: '', signal };
        if (signal) signal.on(() => { if (this.pending && this.pending.kind === 'eof') { const p = this.pending; this.pending = null; p.resolve(p.buf); } });
        if (this.view.setMode) this.view.setMode('eof', '');
        this.wake();
        this.checkIdle();
      });
    }

    pushShell(o) {
      return new Promise((resolve) => {
        const host = o.host || this.world.rootfall;
        const u = host.users.get(o.user);
        let cwd = o.cwd;
        if (!cwd) cwd = u && host.fs.tryGet(u.home, o.user) ? u.home : '/';
        const tty = o.remote ? 'pts/0' : (this.active && this.active.tty) || 'pts/1';
        const sh = new LA.Shell({ host, user: o.user, ui: this.ui, game: this.game, world: this.world, cwd, interactive: true, login: !!o.login, parent: o.from, tty });
        if (o.from && !o.login) {
          for (const [k, v] of o.from.vars) if (v.x && !['HOME', 'USER', 'LOGNAME', 'PATH', 'SHELL'].includes(k)) sh.vars.set(k, Object.assign({}, v));
        }
        if (o.user === 'root' && host === this.world.rootfall) sh.setVar('PS1', '\\[\\e[1;31m\\]\\u@\\h\\[\\e[0m\\]:\\[\\e[1;34m\\]\\w\\[\\e[0m\\]\\$ ');
        const session = { user: o.user, tty, from: o.fromIp || '', host: host.name, at: LA.now(), nested: true };
        if (o.remote) { this.world.addSession(session); }
        sh.onExit = (code) => {
          const i = this.stack.indexOf(sh);
          if (i >= 0) this.stack.splice(i);
          this.world.reap(sh.pid);
          if (o.remote) this.world.removeSession((s) => s === session || (s.nested && s.host === host.name && s.user === o.user && s.tty === tty));
          if (this.game) this.game.onShellExit(sh);
          resolve(code);
        };
        const p = this.world.proc(sh.pid);
        if (p) { p.shell = true; p.host = host.name; }
        this.stack.push(sh);
        sh.busy = true;
        this.wake();
        Promise.resolve(this.game ? this.game.onShellEnter(sh, o) : null)
          .catch((e) => { if (typeof console !== 'undefined') console.error(e); })
          .then(() => { sh.busy = false; this.checkIdle(); });
      });
    }
  }

  LA.Console = Console;
})();
