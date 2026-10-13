/* Linux Awakening — full-screen programs: pager (less/man), nano, vim, top. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const esc = LA.esc;
  const UI = (LA.UI = LA.UI || {});

  function host() {
    let el = document.getElementById('overlay');
    const wrap = document.querySelector('.terminal-wrap');
    if (wrap && el.parentElement !== wrap) wrap.appendChild(el);
    return el;
  }
  function open(cls) {
    const el = host();
    el.className = 'overlay ' + cls;
    el.innerHTML = '';
    UI.overlayOpen = true;
    return el;
  }
  function close() {
    const el = host();
    el.className = 'overlay hidden';
    el.innerHTML = '';
    UI.overlayOpen = false;
    if (UI.afterOverlay) UI.afterOverlay();
  }
  function onKeys(handler) {
    const fn = (ev) => handler(ev);
    document.addEventListener('keydown', fn, true);
    return () => document.removeEventListener('keydown', fn, true);
  }
  const lineHeightOf = (el) => parseFloat(getComputedStyle(el).lineHeight) || 20;

  /* ================= PAGER ================= */
  UI.pager = (text, opts = {}) => new Promise((resolve) => {
    const el = open('pager');
    const lines = String(text).replace(/\n$/, '').split('\n');
    el.innerHTML = `<div class="pg-body"><pre class="pg-text"></pre></div>
      <div class="pg-status"><span class="pg-msg"></span><span class="pg-input-wrap hidden">/<input class="pg-input" spellcheck="false" autocomplete="off"></span>
      <span class="pg-btns"><button data-a="up" title="Up (k)">▲</button><button data-a="down" title="Page down (Space)">▼</button><button data-a="search" title="Search (/)">/</button><button data-a="quit" title="Quit (q)">q</button></span></div>`;
    const body = el.querySelector('.pg-body');
    const pre = el.querySelector('.pg-text');
    const msg = el.querySelector('.pg-msg');
    const inWrap = el.querySelector('.pg-input-wrap');
    const input = el.querySelector('.pg-input');
    let term = null;
    let help = false;
    const render = () => {
      let h = lines.map((l) => LA.ansiToHtml(l)).join('\n');
      if (term) {
        const re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
        h = lines.map((l) => esc(LA.util.stripAnsi(l)).replace(re, '<mark>$1</mark>')).join('\n');
      }
      pre.innerHTML = h + '\n';
    };
    const lh = () => lineHeightOf(pre);
    const pageLines = () => Math.max(1, Math.floor(body.clientHeight / lh()) - 1);
    const topLine = () => Math.round(body.scrollTop / lh());
    const status = (override) => {
      if (override) { msg.textContent = override; return; }
      const atEnd = body.scrollTop + body.clientHeight >= body.scrollHeight - 2;
      const pct = Math.min(100, Math.round(((topLine() + pageLines()) / lines.length) * 100));
      if (opts.name === 'man') msg.textContent = ` ${opts.title || 'Manual page'} line ${topLine() + 1}/${lines.length} ${atEnd ? '(END) ' : pct + '% '}(press h for help or q to quit)`;
      else msg.textContent = atEnd ? '(END) — press q to quit' : `${topLine() === 0 && opts.title ? opts.title + '  ' : ':'} ${pct}%  (Space: next page · b: back · /: search · q: quit)`;
    };
    const scrollLines = (n) => { body.scrollTop += n * lh(); status(); };
    const search = (dir = 1) => {
      if (!term) return;
      const start = topLine() + (dir > 0 ? 1 : -1);
      const t = term.toLowerCase();
      for (let k = 0; k < lines.length; k++) {
        const i = (start + dir * k + lines.length * 2) % lines.length;
        if (LA.util.stripAnsi(lines[i]).toLowerCase().includes(t)) { body.scrollTop = i * lh(); status(); return; }
      }
      status('Pattern not found  (press RETURN)');
    };
    const helpText = 'SUMMARY OF LESS COMMANDS\n\n  q        Quit\n  SPACE f  Forward one window      b      Backward one window\n  j ↓ RET  Forward one line        k ↑    Backward one line\n  g <      Go to first line        G >    Go to last line\n  /pattern Search forward          n N    Repeat search forward / backward\n  h        This help (press h or q to return)';
    let savedTop = 0;
    const finish = () => { stop(); close(); resolve(); };
    const stop = onKeys((ev) => {
      if (!inWrap.classList.contains('hidden')) {
        if (ev.key === 'Enter') { ev.preventDefault(); term = input.value || term; inWrap.classList.add('hidden'); render(); search(1); }
        else if (ev.key === 'Escape') { ev.preventDefault(); inWrap.classList.add('hidden'); status(); }
        return;
      }
      const k = ev.key;
      if (ev.ctrlKey && (k === 'c' || k === 'C')) { ev.preventDefault(); finish(); return; }
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const handled = { q: 1, Q: 1, ' ': 1, f: 1, PageDown: 1, b: 1, PageUp: 1, j: 1, ArrowDown: 1, Enter: 1, k: 1, ArrowUp: 1, g: 1, Home: 1, '<': 1, G: 1, End: 1, '>': 1, '/': 1, n: 1, N: 1, h: 1, Escape: 1, d: 1, u: 1 };
      if (!handled[k]) return;
      ev.preventDefault();
      if (help) { help = false; pre.textContent = ''; render(); body.scrollTop = savedTop; status(); return; }
      switch (k) {
        case 'q': case 'Q': case 'Escape': finish(); break;
        case ' ': case 'f': case 'PageDown': scrollLines(pageLines()); break;
        case 'b': case 'PageUp': scrollLines(-pageLines()); break;
        case 'd': scrollLines(Math.floor(pageLines() / 2)); break;
        case 'u': scrollLines(-Math.floor(pageLines() / 2)); break;
        case 'j': case 'ArrowDown': case 'Enter': scrollLines(1); break;
        case 'k': case 'ArrowUp': scrollLines(-1); break;
        case 'g': case 'Home': case '<': body.scrollTop = 0; status(); break;
        case 'G': case 'End': case '>': body.scrollTop = body.scrollHeight; status(); break;
        case '/': inWrap.classList.remove('hidden'); input.value = ''; input.focus(); msg.textContent = ''; break;
        case 'n': search(1); break;
        case 'N': search(-1); break;
        case 'h': help = true; savedTop = body.scrollTop; pre.textContent = helpText; body.scrollTop = 0; msg.textContent = 'HELP — press q or h to return'; break;
      }
    });
    el.querySelector('.pg-btns').addEventListener('click', (ev) => {
      const a = ev.target.dataset.a;
      if (a === 'up') scrollLines(-pageLines());
      if (a === 'down') scrollLines(pageLines());
      if (a === 'search') { inWrap.classList.remove('hidden'); input.value = ''; input.focus(); }
      if (a === 'quit') finish();
    });
    body.addEventListener('scroll', () => status());
    render();
    status();
    body.focus();
  });

  /* ================= NANO ================= */
  UI.nano = (o) => new Promise((resolve) => {
    const el = open('editor nano');
    let filename = o.filename || '';
    el.innerHTML = `<div class="ed-head"><span>  GNU nano 7.2</span><span class="ed-name"></span><span class="ed-mod"></span></div>
      <textarea class="ed-text" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
      <div class="ed-status"><span class="ed-msg"></span><span class="ed-ask hidden"><span class="ed-ask-label"></span><input class="ed-ask-input" spellcheck="false" autocomplete="off"></span></div>
      <div class="ed-keys">
        <button data-a="help"><b>^G</b> Help</button><button data-a="save"><b>^O</b> Write Out</button><button data-a="cut"><b>^K</b> Cut</button><button data-a="pos"><b>^C</b> Location</button>
        <button data-a="exit"><b>^X</b> Exit</button><button data-a="find"><b>F6</b> Where Is</button><button data-a="paste"><b>^U</b> Paste</button><button data-a="top"><b>M-\\</b> First Line</button>
      </div>`;
    const ta = el.querySelector('.ed-text');
    const nameEl = el.querySelector('.ed-name');
    const modEl = el.querySelector('.ed-mod');
    const msg = el.querySelector('.ed-msg');
    const ask = el.querySelector('.ed-ask');
    const askLabel = el.querySelector('.ed-ask-label');
    const askInput = el.querySelector('.ed-ask-input');
    ta.value = o.content || '';
    let modified = false;
    let cutBuf = '';
    let lastWasCut = false;
    let pending = null;
    const setName = () => { nameEl.textContent = filename ? filename : 'New Buffer'; };
    const setMod = () => { modEl.textContent = modified ? 'Modified' : ''; };
    const say = (t) => { msg.textContent = t ? `[ ${t} ]` : ''; };
    setName(); setMod();
    const nLines = (t) => (t === '' ? 0 : t.replace(/\n$/, '').split('\n').length);
    if (o.message) say(o.message);
    else if (o.isNew) say('New File');
    else say(`Read ${nLines(ta.value)} line${nLines(ta.value) === 1 ? '' : 's'}`);
    const askFor = (label, value, cb, yn) => {
      pending = { cb, yn };
      askLabel.textContent = label;
      askInput.value = value || '';
      ask.classList.remove('hidden');
      msg.textContent = '';
      if (yn) { askInput.classList.add('yn'); } else askInput.classList.remove('yn');
      askInput.focus();
    };
    const endAsk = () => { pending = null; ask.classList.add('hidden'); ta.focus(); };
    const doSave = (name, thenExit) => {
      if (!name) { say('Canceled'); endAsk(); return; }
      let text = ta.value;
      if (text && !text.endsWith('\n')) text += '\n';
      const r = o.onSave(text, name);
      endAsk();
      if (r && r.ok) {
        filename = name; modified = false; setName(); setMod();
        say(`Wrote ${r.lines} line${r.lines === 1 ? '' : 's'}`);
        if (thenExit) finish();
      } else say(r ? r.error : 'Error writing');
    };
    const save = (thenExit) => askFor('File Name to Write: ', filename, (v) => doSave(v.trim(), thenExit));
    const finish = () => { stop(); close(); resolve({ quit: true }); };
    const exit = () => {
      if (!modified) { finish(); return; }
      askFor('Save modified buffer?  (Y)es  (N)o  (^C) Cancel ', '', (v) => {
        const a = v.trim().toLowerCase();
        if (a.startsWith('y')) { endAsk(); save(true); }
        else if (a.startsWith('n')) { endAsk(); finish(); }
        else { endAsk(); say('Canceled'); }
      }, true);
    };
    const lineBounds = () => {
      const v = ta.value, p = ta.selectionStart;
      const s = v.lastIndexOf('\n', p - 1) + 1;
      let e = v.indexOf('\n', p);
      e = e < 0 ? v.length : e + 1;
      return [s, e];
    };
    const cut = () => {
      const [s, e] = lineBounds();
      const piece = ta.value.slice(s, e);
      cutBuf = lastWasCut ? cutBuf + piece : piece;
      ta.value = ta.value.slice(0, s) + ta.value.slice(e);
      ta.selectionStart = ta.selectionEnd = s;
      modified = true; setMod(); lastWasCut = true;
    };
    const paste = () => {
      if (!cutBuf) { say('Cutbuffer is empty'); return; }
      const [s] = lineBounds();
      ta.value = ta.value.slice(0, s) + cutBuf + ta.value.slice(s);
      ta.selectionStart = ta.selectionEnd = s + cutBuf.length;
      modified = true; setMod();
    };
    const pos = () => {
      const v = ta.value, p = ta.selectionStart;
      const line = v.slice(0, p).split('\n').length, total = Math.max(1, v.split('\n').length);
      const col = p - (v.lastIndexOf('\n', p - 1) + 1) + 1;
      say(`line ${line}/${total} (${Math.round((line / total) * 100)}%), col ${col}, char ${p}/${v.length}`);
    };
    const find = () => askFor('Search: ', '', (v) => {
      endAsk();
      if (!v) return;
      const i = ta.value.indexOf(v, ta.selectionEnd);
      const j = i >= 0 ? i : ta.value.indexOf(v);
      if (j < 0) say(`"${v}" not found`);
      else { ta.setSelectionRange(j, j + v.length); if (i < 0) say('Search Wrapped'); }
    });
    const helpMsg = () => say('^O save · ^X exit · ^K cut line · ^U paste · ^C position · F6 search · arrows move');
    ta.addEventListener('input', () => { modified = true; setMod(); lastWasCut = false; });
    const stop = onKeys((ev) => {
      if (pending) {
        if (ev.target !== askInput) return;
        if (ev.key === 'Enter') { ev.preventDefault(); pending.cb(askInput.value); return; }
        if (ev.key === 'Escape' || (ev.ctrlKey && (ev.key === 'c' || ev.key === 'C'))) { ev.preventDefault(); endAsk(); say('Canceled'); return; }
        if (pending.yn && /^[ynYN]$/.test(ev.key)) { ev.preventDefault(); pending.cb(ev.key); return; }
        return;
      }
      if (ev.key === 'F6') { ev.preventDefault(); find(); return; }
      if (ev.key === 'F1') { ev.preventDefault(); helpMsg(); return; }
      if (!ev.ctrlKey || ev.altKey || ev.metaKey) { if (!ev.ctrlKey) lastWasCut = lastWasCut && ev.key === 'Shift'; return; }
      const k = ev.key.toLowerCase();
      const map = { o: () => save(false), s: () => (filename ? doSave(filename, false) : save(false)), x: exit, k: cut, u: paste, g: helpMsg, c: pos, w: find, f: find };
      if (map[k]) { ev.preventDefault(); ev.stopPropagation(); map[k](); }
    });
    el.querySelector('.ed-keys').addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      ({ help: helpMsg, save: () => save(false), cut, pos, exit, find, paste, top: () => { ta.selectionStart = ta.selectionEnd = 0; ta.focus(); } })[b.dataset.a]();
    });
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = 0; ta.scrollTop = 0; }, 0);
  });

  /* ================= VIM ================= */
  UI.vim = (o) => new Promise((resolve) => {
    const el = open('editor vim');
    let filename = o.filename || '';
    el.innerHTML = `<textarea class="ed-text" spellcheck="false" autocomplete="off" autocapitalize="off" readonly></textarea>
      <div class="vim-status"><span class="vim-msg"></span><span class="vim-cmd hidden">:<input class="vim-input" spellcheck="false" autocomplete="off"></span><span class="vim-pos"></span></div>
      <div class="ed-keys vim-help"><button data-a="esc"><b>Esc</b> normal mode</button><button data-a="i"><b>i</b> insert</button><button data-a="w"><b>:w</b> save</button><button data-a="q"><b>:q</b> quit</button><button data-a="wq"><b>:wq</b> save &amp; quit</button><button data-a="q!"><b>:q!</b> quit, discard</button></div>`;
    const ta = el.querySelector('.ed-text');
    const msg = el.querySelector('.vim-msg');
    const cmdWrap = el.querySelector('.vim-cmd');
    const cmd = el.querySelector('.vim-input');
    const posEl = el.querySelector('.vim-pos');
    ta.value = o.content || '';
    let mode = 'normal';
    let modified = false;
    let pendingOp = '';
    const undo = [];
    let escapes = 0;
    const lines = () => ta.value.split('\n');
    const say = (t, err) => { msg.textContent = t; msg.classList.toggle('err', !!err); };
    const caret = () => {
      const v = ta.value, p = ta.selectionStart;
      return { line: v.slice(0, p).split('\n').length - 1, col: p - (v.lastIndexOf('\n', p - 1) + 1) };
    };
    const setCaret = (line, col) => {
      const ls = lines();
      line = Math.max(0, Math.min(ls.length - 1, line));
      col = Math.max(0, Math.min(Math.max(0, ls[line].length - (mode === 'insert' ? 0 : 1)), col));
      let p = 0;
      for (let i = 0; i < line; i++) p += ls[i].length + 1;
      ta.selectionStart = ta.selectionEnd = p + col;
      updatePos();
    };
    const updatePos = () => { const c = caret(); posEl.textContent = `${c.line + 1},${c.col + 1}`; };
    const setMode = (m) => {
      mode = m;
      ta.readOnly = m !== 'insert';
      el.classList.toggle('vim-insert', m === 'insert');
      if (m === 'insert') say('-- INSERT --');
      else if (m === 'normal') say('');
    };
    const snapshot = () => { undo.push({ v: ta.value, p: ta.selectionStart }); if (undo.length > 100) undo.shift(); };
    const n = ta.value === '' ? 0 : lines().length;
    say(o.message ? o.message : o.isNew || !filename ? `"${filename || '[No Name]'}" [New]` : `"${filename}" ${n}L, ${ta.value.length}B`, !!o.message);
    const finish = () => { stop(); close(); resolve({ quit: true }); };
    const write = (name) => {
      const target = name || filename;
      if (!target) { say('E32: No file name', true); return false; }
      let text = ta.value;
      if (text && !text.endsWith('\n')) text += '\n';
      const r = o.onSave(text, target);
      if (r && r.ok) { filename = target; modified = false; say(`"${target}" ${r.lines}L, ${text.length}B written`); return true; }
      say(r ? 'E212: Can\'t open file for writing' : 'error', true);
      return false;
    };
    const runCmd = (c) => {
      c = c.trim();
      const m = c.match(/^(w|wq|x|q|q!|wq!|w!)(?:\s+(.+))?$/);
      if (!m) {
        if (/^\d+$/.test(c)) { setCaret(parseInt(c, 10) - 1, 0); return; }
        if (c === 'help') { say('i insert · Esc normal · :w save · :q quit · :wq both · :q! discard'); return; }
        say(`E492: Not an editor command: ${c}`, true);
        return;
      }
      const [, op, arg] = m;
      if (op.startsWith('w') && !write(arg)) return;
      if (op === 'x' && modified && !write(arg)) return;
      if (op === 'q' && modified) { say('E37: No write since last change (add ! to override)', true); return; }
      if (op.includes('q') || op === 'x') finish();
    };
    const openCmd = () => { cmdWrap.classList.remove('hidden'); cmd.value = ''; msg.textContent = ''; cmd.focus(); };
    const closeCmd = () => { cmdWrap.classList.add('hidden'); ta.focus(); };
    ta.addEventListener('input', () => { modified = true; });
    ta.addEventListener('click', updatePos);
    ta.addEventListener('keyup', updatePos);
    const stop = onKeys((ev) => {
      if (!cmdWrap.classList.contains('hidden')) {
        if (ev.target !== cmd) return;
        if (ev.key === 'Enter') { ev.preventDefault(); const v = cmd.value; closeCmd(); runCmd(v); }
        else if (ev.key === 'Escape' || (ev.key === 'Backspace' && cmd.value === '')) { ev.preventDefault(); closeCmd(); }
        return;
      }
      if (mode === 'insert') {
        if (ev.key === 'Escape' || (ev.ctrlKey && ev.key === '[')) { ev.preventDefault(); setMode('normal'); const c = caret(); setCaret(c.line, c.col - 1); }
        return;
      }
      if (ev.ctrlKey && (ev.key === 'c' || ev.key === 'C')) { ev.preventDefault(); say('Type  :qa!  and press <Enter> to abandon all changes and exit Vim'); return; }
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const k = ev.key;
      if (k.length > 1 && !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape', 'Home', 'End'].includes(k)) return;
      ev.preventDefault();
      const c = caret();
      if (pendingOp) {
        const op = pendingOp + k;
        pendingOp = '';
        if (op === 'dd') {
          snapshot();
          const ls = lines();
          ls.splice(c.line, 1);
          ta.value = ls.join('\n');
          modified = true;
          setCaret(Math.min(c.line, ls.length - 1), 0);
        } else if (op === 'gg') setCaret(0, 0);
        else if (op === 'ZZ') { if (!modified || write()) finish(); }
        return;
      }
      switch (k) {
        case 'Escape':
          if (++escapes >= 3) say(`${LA.flavor('vimHelp', 'Psst')}: type  :q  then Enter to quit (or :wq to save and quit)`);
          break;
        case 'i': snapshot(); setMode('insert'); break;
        case 'a': snapshot(); setMode('insert'); setCaret(c.line, c.col + 1); break;
        case 'A': snapshot(); setMode('insert'); setCaret(c.line, lines()[c.line].length); break;
        case 'I': snapshot(); setMode('insert'); setCaret(c.line, 0); break;
        case 'o': case 'O': {
          snapshot();
          const ls = lines();
          const at = k === 'o' ? c.line + 1 : c.line;
          ls.splice(at, 0, '');
          ta.value = ls.join('\n');
          modified = true;
          setMode('insert');
          setCaret(at, 0);
          break;
        }
        case 'h': case 'ArrowLeft': setCaret(c.line, c.col - 1); break;
        case 'l': case 'ArrowRight': setCaret(c.line, c.col + 1); break;
        case 'j': case 'ArrowDown': setCaret(c.line + 1, c.col); break;
        case 'k': case 'ArrowUp': setCaret(c.line - 1, c.col); break;
        case '0': case 'Home': setCaret(c.line, 0); break;
        case '$': case 'End': setCaret(c.line, 9999); break;
        case 'G': setCaret(lines().length - 1, 0); break;
        case 'x': {
          const p = ta.selectionStart;
          if (ta.value[p] && ta.value[p] !== '\n') { snapshot(); ta.value = ta.value.slice(0, p) + ta.value.slice(p + 1); modified = true; ta.selectionStart = ta.selectionEnd = p; }
          break;
        }
        case 'u': {
          const s = undo.pop();
          if (s) { ta.value = s.v; ta.selectionStart = ta.selectionEnd = s.p; say('1 change; before #' + (undo.length + 1)); } else say('Already at oldest change');
          break;
        }
        case 'd': case 'g': case 'Z': pendingOp = k; break;
        case ':': openCmd(); break;
      }
    });
    el.querySelector('.vim-help').addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      const a = b.dataset.a;
      if (a === 'esc') { setMode('normal'); ta.focus(); }
      else if (a === 'i') { snapshot(); setMode('insert'); ta.focus(); }
      else runCmd(a);
    });
    setTimeout(() => { ta.focus(); setCaret(0, 0); }, 0);
  });

  /* ================= TOP ================= */
  UI.top = (renderFn) => new Promise((resolve) => {
    const el = open('pager top');
    el.innerHTML = '<div class="pg-body"><pre class="pg-text"></pre></div><div class="pg-status"><span class="pg-msg">press q to quit</span><span class="pg-btns"><button data-a="quit">q</button></span></div>';
    const pre = el.querySelector('.pg-text');
    const draw = () => {
      const cols = Math.floor(pre.clientWidth / 8.4) || 80;
      const rows = Math.max(8, Math.floor(el.querySelector('.pg-body').clientHeight / lineHeightOf(pre)) - 8);
      pre.innerHTML = LA.ansiToHtml(renderFn({ color: true, rows, width: cols }));
    };
    draw();
    const timer = setInterval(draw, 2000);
    const finish = () => { clearInterval(timer); stop(); close(); resolve(); };
    const stop = onKeys((ev) => {
      if (ev.key === 'q' || ev.key === 'Q' || ev.key === 'Escape' || (ev.ctrlKey && (ev.key === 'c' || ev.key === 'C'))) { ev.preventDefault(); finish(); }
    });
    el.querySelector('.pg-btns').addEventListener('click', finish);
  });
})();
