/* Linux Awakening — the browser terminal (implements the Console "view" interface). */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const esc = LA.esc;
  const VFS = LA.VFS;

  const SPEED = { slow: 55, normal: 140, fast: 420, instant: Infinity };

  class TerminalView {
    constructor() {
      this.term = document.getElementById('terminal');
      this.output = document.getElementById('output');
      this.inputLine = document.getElementById('inputLine');
      this.promptEl = document.getElementById('prompt');
      this.input = document.getElementById('cmd');
      this.game = null;
      this.cur = null;
      this.typing = null;
      this.busy = true;
      this.mode = 'shell';
      this.promptText = '';
      this.shownPrompt = '';
      this.echoPrompt = null;
      this.histIdx = null;
      this.draft = '';
      this.lastTab = 0;
      this.rsearch = null;
      this.askState = null;
      this.speed = 'normal';
      this.scrollQueued = false;
      this.bind();
      LA.UI.afterOverlay = () => this.focus();
    }

    attach(game) { this.game = game; }
    get con() { return this.game ? this.game.console : null; }
    get columns() {
      const w = this.output.clientWidth || 800;
      const cw = this.charWidth || (this.charWidth = this.measureChar());
      return Math.max(20, Math.floor(w / cw) - 1);
    }
    measureChar() {
      const s = document.createElement('span');
      s.textContent = 'MMMMMMMMMM';
      s.style.visibility = 'hidden';
      s.style.position = 'absolute';
      this.output.appendChild(s);
      const w = s.getBoundingClientRect().width / 10 || 8.4;
      s.remove();
      return w;
    }

    /* ---------------- output ---------------- */
    nearBottom() { const t = this.term; return t.scrollHeight - t.scrollTop - t.clientHeight < 120; }
    scroll(force) {
      if (!force && !this.stick) return;
      if (this.scrollQueued) return;
      this.scrollQueued = true;
      requestAnimationFrame(() => { this.scrollQueued = false; this.term.scrollTop = this.term.scrollHeight; });
    }
    block() {
      if (!this.cur || this.cur.parentNode !== this.output) {
        this.cur = document.createElement('div');
        this.cur.className = 'o';
        this.output.appendChild(this.cur);
        this.trim();
      }
      return this.cur;
    }
    trim() {
      const kids = this.output.children;
      if (kids.length > 1600) for (let i = 0; i < 300; i++) kids[0].remove();
    }
    write(s, stream) {
      this.stick = this.nearBottom() || stream === 'echo';
      if (stream === 'prompt') { this.promptText = s; return; }
      let html;
      if (stream === 'echo') {
        const p = this.echoPrompt !== null ? this.echoPrompt : '';
        this.echoPrompt = null;
        if (this.mode === 'hidden') html = LA.ansiToHtml(p) + '\n';
        else html = LA.ansiToHtml(p) + `<span class="typed">${esc(s.replace(/\n$/, ''))}</span>\n`;
      } else html = LA.ansiToHtml(s);
      this.block().insertAdjacentHTML('beforeend', stream === 'err' ? `<span class="stderr">${html}</span>` : html);
      this.scroll();
    }
    clear() { this.output.innerHTML = ''; this.cur = null; }

    /* ---------------- narration ---------------- */
    narrate(markup) {
      const el = document.createElement('div');
      el.className = 'narr';
      el.innerHTML = LA.storyToHtml(markup);
      this.output.appendChild(el);
      this.cur = null;
      this.stick = true;
      return this.typewrite(el);
    }
    typewrite(el) {
      const cps = SPEED[this.speed] || SPEED.normal;
      if (!isFinite(cps) || document.hidden || this.burstSkip) { this.scroll(true); return Promise.resolve(); }
      const nodes = [];
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walk.nextNode())) {
        if (!n.nodeValue) continue;
        const art = !!(n.parentElement && n.parentElement.closest('pre'));
        const blockEl = n.parentElement && n.parentElement.closest('p, .box > div, pre, .tag');
        nodes.push({ node: n, full: n.nodeValue, art, block: blockEl });
        n.nodeValue = '';
      }
      el.classList.add('typing');
      return new Promise((resolve) => {
        let i = 0, off = 0, last = performance.now(), waitUntil = 0;
        const done = () => {
          for (; i < nodes.length; i++) nodes[i].node.nodeValue = nodes[i].full;
          el.classList.remove('typing');
          this.typing = null;
          this.scroll(true);
          resolve();
        };
        this.typing = { finish: done };
        const step = (now) => {
          if (!this.typing) return;
          if (now < waitUntil) { requestAnimationFrame(step); return; }
          let budget = Math.max(1, Math.round(((now - last) * cps) / 1000));
          last = now;
          while (budget > 0 && i < nodes.length) {
            const cur = nodes[i];
            const rate = cur.art ? 8 : 1;
            const take = Math.min(cur.full.length - off, budget * rate);
            off += take;
            cur.node.nodeValue = cur.full.slice(0, off);
            budget -= Math.ceil(take / rate);
            if (off >= cur.full.length) {
              const next = nodes[i + 1];
              i++;
              off = 0;
              if (next && next.block !== cur.block && !cur.art) { waitUntil = now + Math.min(320, 60000 / cps); break; }
            }
          }
          this.scroll(true);
          if (i >= nodes.length) done();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }
    skipTyping() { if (this.typing) { this.burstSkip = true; this.typing.finish(); return true; } return false; }

    chapterCard(ch) {
      const el = document.createElement('div');
      el.className = 'chapter-banner';
      el.innerHTML = `<div class="cb-num">Chapter ${ch.n}</div><div class="cb-title">${esc(ch.title)}</div><div class="cb-place">${esc(ch.place || '')}</div>`;
      this.output.appendChild(el);
      this.cur = null;
      this.scroll(true);
      return this.pause(SPEED[this.speed] === Infinity || this.burstSkip ? 0 : 900);
    }
    pause(ms) {
      return new Promise((resolve) => {
        if (!ms) return resolve();
        const t = setTimeout(() => { this.typing = null; resolve(); }, ms);
        this.typing = { finish: () => { clearTimeout(t); this.typing = null; resolve(); } };
      });
    }
    toast(text) {
      const box = document.getElementById('toasts');
      const t = document.createElement('div');
      t.className = 'toast';
      t.textContent = text;
      box.appendChild(t);
      setTimeout(() => t.classList.add('out'), 3200);
      setTimeout(() => t.remove(), 3800);
    }
    update(game) { if (LA.Panel) LA.Panel.update(game || this.game); }

    /* ---------------- programs ---------------- */
    page(text, o) { this.focusLost = true; return LA.UI.pager(text, o); }
    edit(o) { return o.editor === 'vim' ? LA.UI.vim(o) : LA.UI.nano(o); }
    top(fn, o) { return LA.UI.top(fn, o); }
    animate(frames, o = {}) {
      return new Promise((resolve) => {
        const pre = document.createElement('pre');
        pre.className = 'anim';
        this.output.appendChild(pre);
        this.cur = null;
        let k = 0;
        const tick = () => {
          if (k >= frames.length || (o.signal && o.signal.aborted)) { pre.remove(); resolve(); return; }
          pre.innerHTML = LA.ansiToHtml(frames[k++]);
          this.scroll(true);
          setTimeout(tick, o.interval || 40);
        };
        tick();
      });
    }

    /* ---------------- input ---------------- */
    setMode(mode) {
      this.mode = mode;
      this.input.classList.toggle('masked', mode === 'hidden');
    }
    setBusy(b) {
      this.busy = b;
      this.inputLine.classList.toggle('busy', b);
    }
    onIdle() {
      this.burstSkip = false;
      const con = this.con;
      if (!con || this.askState) return;
      if (con.pending) {
        this.setMode(con.pending.kind === 'prompt' ? (con.pending.hidden ? 'hidden' : 'prompt') : 'eof');
        this.shownPrompt = con.pending.kind === 'prompt' ? this.promptText : '';
      } else {
        this.setMode('shell');
        const notes = con.active.flushJobNotices();
        for (const n of notes) this.write(n + '\n', 'out');
        this.shownPrompt = con.promptString() || '';
        this.updateTitle();
      }
      this.promptEl.innerHTML = LA.ansiToHtml(this.shownPrompt);
      this.setBusy(false);
      this.scroll(true);
      this.focus();
    }
    updateTitle() {
      const sh = this.con && this.con.active;
      if (!sh) return;
      const t = document.getElementById('termTitle');
      if (t) t.textContent = `${sh.user}@${sh.host.name}: ${sh.displayPath(sh.cwd)}`;
    }
    focus() {
      if (LA.UI.overlayOpen) return;
      const sel = window.getSelection && window.getSelection();
      if (sel && sel.toString()) return;
      this.input.focus({ preventScroll: true });
    }

    /* ask a question before the game exists (name, continue?) */
    ask(promptText, validate) {
      return new Promise((resolve) => {
        const tryAsk = () => {
          this.askState = { promptText, resolve: (v) => {
            const err = validate ? validate(v) : null;
            this.write('', 'out');
            this.block().insertAdjacentHTML('beforeend', LA.ansiToHtml(promptText) + `<span class="typed">${esc(v)}</span>\n`);
            if (err) { this.block().insertAdjacentHTML('beforeend', `<span class="fg-y">${esc(err)}</span>\n`); tryAsk(); return; }
            this.askState = null;
            resolve(v);
          } };
          this.promptEl.innerHTML = LA.ansiToHtml(promptText);
          this.setMode('shell');
          this.setBusy(false);
          this.focus();
        };
        tryAsk();
      });
    }

    submit() {
      const v = this.input.value;
      this.input.value = '';
      this.histIdx = null;
      if (this.askState) { const a = this.askState; this.setBusy(true); a.resolve(v.trim()); return; }
      const con = this.con;
      if (!con || this.busy) return;
      this.echoPrompt = this.shownPrompt;
      this.setBusy(true);
      con.submit(v);
    }

    ctrlC() {
      if (this.skipTyping()) return;
      const con = this.con;
      if (this.askState) return;
      if (this.rsearch) { this.endRsearch(false); return; }
      if (!con) return;
      if (con.pending) { this.echoPrompt = this.shownPrompt; this.input.value = ''; con.interrupt(); return; }
      if (con.active && con.active.busy) { con.interrupt(); return; }
      const typed = this.input.value;
      this.block().insertAdjacentHTML('beforeend', LA.ansiToHtml(this.shownPrompt) + `<span class="typed">${esc(typed)}</span>^C\n`);
      this.input.value = '';
      con.source = '';
      if (con.main) con.active.lastStatus = 130;
      this.onIdle();
    }
    ctrlD() {
      const con = this.con;
      if (!con || this.askState) return;
      if (con.pending && con.pending.kind === 'eof') {
        if (this.input.value) { this.echoPrompt = ''; const v = this.input.value; this.input.value = ''; con.pending.buf += v; this.write(v, 'echo'); }
        con.eof();
        return;
      }
      if (this.input.value === '' && !con.pending) {
        this.echoPrompt = this.shownPrompt;
        if (con.stack.length > 1) { this.setBusy(true); con.submit('exit'); }
        else { this.block().insertAdjacentHTML('beforeend', LA.ansiToHtml(this.shownPrompt) + '\n'); con.eof(); }
      }
    }

    history(dir) {
      const sh = this.con && this.con.active;
      if (!sh || this.mode !== 'shell') return;
      const h = sh.history;
      if (!h.length) return;
      if (this.histIdx === null) { this.histIdx = h.length; this.draft = this.input.value; }
      this.histIdx = Math.max(0, Math.min(h.length, this.histIdx + dir));
      this.input.value = this.histIdx === h.length ? this.draft : h[this.histIdx];
      const end = this.input.value.length;
      requestAnimationFrame(() => this.input.setSelectionRange(end, end));
    }

    /* ---- reverse-i-search ---- */
    startRsearch() {
      if (!this.con || this.mode !== 'shell') return;
      this.rsearch = { q: '', match: '', saved: this.input.value };
      this.input.value = '';
      this.renderRsearch();
    }
    renderRsearch() {
      const r = this.rsearch;
      const h = (this.con.active.history || []).slice().reverse();
      r.match = r.q ? h.find((x) => x.includes(r.q)) || '' : '';
      this.promptEl.innerHTML = `<span class="fg-k2">(reverse-i-search)</span>\`${esc(r.q)}': <span class="typed">${esc(r.match)}</span> `;
    }
    endRsearch(accept, run) {
      const r = this.rsearch;
      this.rsearch = null;
      this.promptEl.innerHTML = LA.ansiToHtml(this.shownPrompt);
      this.input.value = accept ? r.match || r.q : r.saved;
      if (run) this.submit();
    }

    /* ---- tab completion ---- */
    complete() {
      const con = this.con;
      if (!con || this.mode !== 'shell' || con.pending) return;
      const sh = con.active;
      const v = this.input.value;
      const pos = this.input.selectionStart;
      const before = v.slice(0, pos);
      const m = before.match(/(^|[\s|;&<>(`])([^\s|;&<>()`]*)$/);
      const word = m ? m[2] : '';
      const start = pos - word.length;
      const prefix = before.slice(0, start);
      const isCmd = /^\s*$/.test(prefix) || /(\||;|&&|\|\||\$\(|`)\s*$/.test(prefix) || /^\s*(sudo|time|nohup|which|type|man|whatis)\s+$/.test(prefix);
      let cands = [];
      if (isCmd && !word.includes('/')) {
        const names = new Set();
        for (const b of LA.builtinNames) names.add(b);
        Object.keys(sh.aliases).forEach((a) => names.add(a));
        Object.keys(sh.functions).forEach((f) => names.add(f));
        for (const d of (sh.getVar('PATH') || '').split(':')) {
          try { for (const [n, node] of sh.fs.readdir(VFS.normalize(d || '.', sh.cwd), sh.user)) if (node.type !== 'dir') names.add(n); } catch (e) { /* unreadable */ }
        }
        cands = [...names].filter((n) => n.startsWith(word) && n !== '[' && n !== '.').sort().map((n) => ({ text: n, done: n + ' ', show: n }));
      } else {
        const tilde = word.startsWith('~');
        const exp = tilde ? sh.home + word.slice(1) : word;
        const slash = exp.lastIndexOf('/');
        const dirPart = slash >= 0 ? exp.slice(0, slash + 1) : '';
        const base = slash >= 0 ? exp.slice(slash + 1) : exp;
        const typedDir = slash >= 0 ? word.slice(0, word.lastIndexOf('/') + 1) : '';
        let entries = [];
        try { entries = sh.fs.readdir(VFS.normalize(dirPart || '.', sh.cwd), sh.user); } catch (e) { entries = []; }
        cands = entries.filter(([n]) => n.startsWith(base) && (base.startsWith('.') || !n.startsWith('.'))).map(([n, node]) => {
          let isDir = node.type === 'dir';
          if (node.type === 'link') { const t = sh.fs.tryGet(VFS.normalize(dirPart + n, sh.cwd), sh.user); isDir = !!t && t.type === 'dir'; }
          const safe = n.replace(/([ '"$&;|<>()\\])/g, '\\$1');
          return { text: typedDir + safe, done: typedDir + safe + (isDir ? '/' : ' '), show: n + (isDir ? '/' : '') };
        });
        if (tilde && word === '~') cands = [{ text: '~/', done: '~/', show: '~/' }];
      }
      if (!cands.length) return;
      const replace = (t) => {
        this.input.value = v.slice(0, start) + t + v.slice(pos);
        const c = start + t.length;
        this.input.setSelectionRange(c, c);
      };
      if (cands.length === 1) { replace(cands[0].done); return; }
      let common = cands[0].text;
      for (const c of cands) { let k = 0; while (k < common.length && k < c.text.length && common[k] === c.text[k]) k++; common = common.slice(0, k); }
      const now = Date.now();
      if (common.length > word.length) { replace(common); this.lastTab = 0; return; }
      if (now - this.lastTab < 900 || cands.length <= 1) {
        this.block().insertAdjacentHTML('beforeend', LA.ansiToHtml(this.shownPrompt) + `<span class="typed">${esc(v)}</span>\n`);
        const items = cands.slice(0, 300).map((c) => ({ text: esc(c.show), len: c.show.length }));
        const lines = LA.columns(items, this.columns);
        this.block().insertAdjacentHTML('beforeend', lines.join('\n') + (cands.length > 300 ? `\n... and ${cands.length - 300} more` : '') + '\n');
        this.scroll(true);
        this.lastTab = 0;
      } else this.lastTab = now;
    }

    insertText(t) {
      const i = this.input;
      const s = i.selectionStart, e = i.selectionEnd;
      i.value = i.value.slice(0, s) + t + i.value.slice(e);
      i.setSelectionRange(s + t.length, s + t.length);
      i.focus();
    }

    bind() {
      this.input.addEventListener('keydown', (ev) => this.onKey(ev));
      this.input.addEventListener('input', () => { if (this.rsearch) { this.rsearch.q = this.input.value; this.renderRsearch(); } });
      document.addEventListener('keydown', (ev) => {
        if (LA.UI.overlayOpen) return;
        if (ev.target === this.input) return;
        if (this.typing && !ev.ctrlKey && !ev.metaKey && !['Shift', 'Alt', 'Control', 'Meta', 'Tab'].includes(ev.key) && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(ev.target.tagName)) { ev.preventDefault(); this.skipTyping(); return; }
        if (ev.ctrlKey && (ev.key === 'c' || ev.key === 'C') && !(window.getSelection && window.getSelection().toString())) { ev.preventDefault(); this.ctrlC(); }
      });
      this.term.addEventListener('mouseup', () => {
        if (this.skipTyping()) return;
        setTimeout(() => this.focus(), 0);
      });
      const keys = document.getElementById('mobileKeys');
      if (keys) {
        keys.addEventListener('pointerdown', (ev) => ev.preventDefault());
        keys.addEventListener('click', (ev) => {
          const b = ev.target.closest('button');
          if (!b) return;
          const k = b.dataset.key;
          if (k === 'Tab') this.complete();
          else if (k === 'ArrowUp') this.history(-1);
          else if (k === 'ArrowDown') this.history(1);
          else if (k === 'c-c') this.ctrlC();
          else if (k === 'c-d') this.ctrlD();
          else this.insertText(k);
          this.focus();
        });
      }
    }

    onKey(ev) {
      if (LA.UI.overlayOpen) return;
      const k = ev.key;
      if (this.typing) {
        if (['Shift', 'Alt', 'Control', 'Meta'].includes(k)) return;
        ev.preventDefault();
        this.skipTyping();
        return;
      }
      if (this.rsearch) {
        if (k === 'Enter') { ev.preventDefault(); this.endRsearch(true, true); return; }
        if (k === 'Escape' || (ev.ctrlKey && (k === 'g' || k === 'G'))) { ev.preventDefault(); this.endRsearch(false); return; }
        if (ev.ctrlKey && (k === 'r' || k === 'R')) { ev.preventDefault(); this.renderRsearch(); return; }
        if (k.startsWith('Arrow') || k === 'Tab') { ev.preventDefault(); this.endRsearch(true); return; }
        return;
      }
      if (ev.ctrlKey && !ev.altKey && !ev.metaKey) {
        const c = k.toLowerCase();
        if (c === 'c') { if (window.getSelection().toString() || this.input.selectionStart !== this.input.selectionEnd) return; ev.preventDefault(); this.ctrlC(); return; }
        if (c === 'd') { ev.preventDefault(); this.ctrlD(); return; }
        if (c === 'l') { ev.preventDefault(); this.clear(); return; }
        if (c === 'a') { ev.preventDefault(); this.input.setSelectionRange(0, 0); return; }
        if (c === 'e') { ev.preventDefault(); const n = this.input.value.length; this.input.setSelectionRange(n, n); return; }
        if (c === 'u') { ev.preventDefault(); const p = this.input.selectionStart; this.input.value = this.input.value.slice(p); this.input.setSelectionRange(0, 0); return; }
        if (c === 'k') { ev.preventDefault(); const p = this.input.selectionStart; this.input.value = this.input.value.slice(0, p); return; }
        if (c === 'r') { ev.preventDefault(); this.startRsearch(); return; }
        return;
      }
      if (this.busy && !this.askState) { if (k === 'Enter' || k === 'Tab') ev.preventDefault(); return; }
      if (k === 'Enter') { ev.preventDefault(); this.submit(); return; }
      if (k === 'Tab') { ev.preventDefault(); if (!this.askState) this.complete(); return; }
      if (k === 'ArrowUp') { ev.preventDefault(); this.history(-1); return; }
      if (k === 'ArrowDown') { ev.preventDefault(); this.history(1); return; }
    }
  }

  LA.TerminalView = TerminalView;
})();
