/* Linux Awakening — rendering helpers: ANSI → HTML, story markup → HTML, title banner. */
(function () {
  'use strict';
  const LA = globalThis.LA;

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  LA.esc = esc;

  /* ---------- ANSI SGR → spans ---------- */
  const FG = { 30: 'k', 31: 'r', 32: 'g', 33: 'y', 34: 'b', 35: 'm', 36: 'c', 37: 'w', 90: 'k2', 91: 'r2', 92: 'g2', 93: 'y2', 94: 'b2', 95: 'm2', 96: 'c2', 97: 'w2' };
  const BG = { 40: 'k', 41: 'r', 42: 'g', 43: 'y', 44: 'b', 45: 'm', 46: 'c', 47: 'w' };
  function ansiToHtml(str) {
    let out = '';
    let st = { fg: null, bg: null, b: false, d: false, i: false, u: false, rv: false };
    let open = false;
    const re = /\x1b\[([0-9;]*)m/g;
    let last = 0, m;
    const openSpan = () => {
      const cls = [];
      if (st.fg) cls.push('fg-' + st.fg);
      if (st.bg) cls.push('bg-' + st.bg);
      if (st.b) cls.push('a-b');
      if (st.d) cls.push('a-d');
      if (st.i) cls.push('a-i');
      if (st.u) cls.push('a-u');
      if (st.rv) cls.push('a-rv');
      if (cls.length) { out += `<span class="${cls.join(' ')}">`; open = true; }
    };
    while ((m = re.exec(str))) {
      out += esc(str.slice(last, m.index));
      last = re.lastIndex;
      if (open) { out += '</span>'; open = false; }
      const codes = m[1] === '' ? [0] : m[1].split(';').map(Number);
      for (const c of codes) {
        if (c === 0) st = { fg: null, bg: null, b: false, d: false, i: false, u: false, rv: false };
        else if (c === 1) st.b = true;
        else if (c === 2) st.d = true;
        else if (c === 3) st.i = true;
        else if (c === 4) st.u = true;
        else if (c === 7) st.rv = true;
        else if (c === 22) { st.b = false; st.d = false; }
        else if (c === 39) st.fg = null;
        else if (c === 49) st.bg = null;
        else if (FG[c]) st.fg = FG[c];
        else if (BG[c]) st.bg = BG[c];
      }
      openSpan();
    }
    out += esc(str.slice(last));
    if (open) out += '</span>';
    return out;
  }
  LA.ansiToHtml = ansiToHtml;

  /* ---------- story markup ---------- */
  /* each story gives its cast their own colors */
  const speakerColor = (who) => {
    const g = LA.game;
    return (g && g.pack && g.pack.speakers[who.toLowerCase()]) || null;
  };
  function inline(s) {
    const codes = [];
    let h = esc(s).replace(/«([^»]*)»/g, (m, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?=[^\w*]|$)/g, '$1<em>$2</em>');
    return h.replace(/\u0000(\d+)\u0000/g, (m, i) => `<code class="k">${codes[i]}</code>`);
  }
  LA.inlineMarkup = inline;

  function paragraphs(lines) {
    let html = '';
    let para = [];
    const flush = () => {
      if (para.length) html += `<p>${para.map(inline).join('<br>')}</p>`;
      para = [];
    };
    for (const line of lines) {
      const say = line.match(/^@([A-Za-z]+)(\s*\([^)]*\))?:\s?(.*)$/);
      if (say) {
        flush();
        const who = say[1];
        const col = speakerColor(who);
        html += `<p class="say"><span class="who${col ? '' : ' who-other'}"${col ? ` style="color:${col}"` : ''}>${esc(who)}${say[2] ? `<span class="aside">${esc(say[2])}</span>` : ''}</span><span class="line">${inline(say[3])}</span></p>`;
        continue;
      }
      if (/^\s*$/.test(line)) { flush(); continue; }
      para.push(line);
    }
    flush();
    return html;
  }

  /* markup → array of blocks {kind, html} */
  function storyToHtml(src) {
    const lines = String(src).split('\n');
    let html = '';
    let buf = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^:::(\w+)\s*$/);
      if (m) {
        html += paragraphs(buf);
        buf = [];
        const kind = m[1];
        const body = [];
        i++;
        while (i < lines.length && !/^:::\s*$/.test(lines[i])) body.push(lines[i++]);
        if (kind === 'art') html += `<pre class="art">${esc(body.join('\n'))}</pre>`;
        else if (kind === 'goal') html += `<div class="box goal"><span class="tag">Goal</span><div>${inline(body.join(' '))}</div></div>`;
        else if (kind === 'lesson') html += `<div class="box lesson"><span class="tag">Lesson</span>${paragraphs(body)}</div>`;
        else if (kind === 'memory') html += `<div class="box memory"><span class="tag">${esc((LA.game && LA.game.pack.collect.tag) || '✦')}</span><div>${inline(body.join(' '))}</div></div>`;
        else if (kind === 'secret') html += `<div class="box secret"><span class="tag">★ Secret</span>${body.map((l) => `<div>${inline(l)}</div>`).join('')}</div>`;
        else if (kind === 'complete') html += `<div class="box complete">${body.filter(Boolean).map((l, k) => `<div class="${k === 0 ? 'big' : ''}">${inline(l)}</div>`).join('')}</div>`;
        else if (kind === 'task') html += `<div class="box task"><span class="tag">Task</span><div class="task-head">${inline(body[0] || '')}</div>${body.slice(1).map((l) => (/^[✓○] /.test(l) ? `<div class="task-part${l[0] === '✓' ? ' done' : ''}">${inline(l)}</div>` : `<div class="task-body">${inline(l)}</div>`)).join('')}</div>`;
        else if (kind === 'badge') html += `<div class="box badge"><span class="tag">🏅 Badge earned</span><div class="big">${inline(body[0] || '')}</div>${body.slice(1).map((l) => `<div>${inline(l)}</div>`).join('')}</div>`;
        else if (kind === 'resume') html += `<div class="box resume">${body.map((l) => `<div>${inline(l)}</div>`).join('')}</div>`;
        else if (kind === 'certificate') html += `<div class="box certificate">${body.map((l) => `<div>${l ? inline(l) : '&nbsp;'}</div>`).join('')}</div>`;
        else html += paragraphs(body);
        continue;
      }
      buf.push(lines[i]);
    }
    html += paragraphs(buf);
    return html;
  }
  LA.storyToHtml = storyToHtml;

  /* ---------- title banner (FIGlet "standard", unsmushed) ---------- */
  const FONT = {
    A: ['    _    ', '   / \\   ', '  / _ \\  ', ' / ___ \\ ', '/_/   \\_\\'],
    B: [' ____  ', '| __ ) ', '|  _ \\ ', '| |_) |', '|____/ '],
    C: ['  ____ ', ' / ___|', '| |    ', '| |___ ', ' \\____|'],
    D: [' ____  ', '|  _ \\ ', '| | | |', '| |_| |', '|____/ '],
    E: [' _____ ', '| ____|', '|  _|  ', '| |___ ', '|_____|'],
    F: [' _____ ', '|  ___|', '| |_   ', '|  _|  ', '|_|    '],
    G: ['  ____ ', ' / ___|', '| |  _ ', '| |_| |', ' \\____|'],
    H: [' _   _ ', '| | | |', '| |_| |', '|  _  |', '|_| |_|'],
    I: [' ___ ', '|_ _|', ' | | ', ' | | ', '|___|'],
    J: ['     _ ', '    | |', ' _  | |', '| |_| |', ' \\___/ '],
    K: [' _  __', '| |/ /', '| \' / ', '| . \\ ', '|_|\\_\\'],
    L: [' _     ', '| |    ', '| |    ', '| |___ ', '|_____|'],
    M: [' __  __ ', '|  \\/  |', '| |\\/| |', '| |  | |', '|_|  |_|'],
    N: [' _   _ ', '| \\ | |', '|  \\| |', '| |\\  |', '|_| \\_|'],
    O: ['  ___  ', ' / _ \\ ', '| | | |', '| |_| |', ' \\___/ '],
    P: [' ____  ', '|  _ \\ ', '| |_) |', '|  __/ ', '|_|    '],
    Q: ['  ___  ', ' / _ \\ ', '| | | |', '| |_| |', ' \\__\\_\\'],
    R: [' ____  ', '|  _ \\ ', '| |_) |', '|  _ < ', '|_| \\_\\'],
    S: [' ____  ', '/ ___| ', '\\___ \\ ', ' ___) |', '|____/ '],
    T: [' _____ ', '|_   _|', '  | |  ', '  | |  ', '  |_|  '],
    U: [' _   _ ', '| | | |', '| | | |', '| |_| |', ' \\___/ '],
    V: ['__     __', '\\ \\   / /', ' \\ \\ / / ', '  \\ V /  ', '   \\_/   '],
    W: ['__        __', '\\ \\      / /', ' \\ \\ /\\ / / ', '  \\ V  V /  ', '   \\_/\\_/   '],
    X: ['__  __', '\\ \\/ /', ' \\  / ', ' /  \\ ', '/_/\\_\\'],
    Y: ['__   __', '\\ \\ / /', ' \\ V / ', '  | |  ', '  |_|  '],
    Z: [' _____', '|__  /', '  / / ', ' / /_ ', '/____|'],
    ' ': ['  ', '  ', '  ', '  ', '  '],
  };
  LA.banner = (text) => {
    const rows = ['', '', '', '', ''];
    for (const ch of text) { const g = FONT[ch] || FONT[' ']; for (let r = 0; r < 5; r++) rows[r] += g[r]; }
    return rows.map((r) => r.replace(/\s+$/, '')).join('\n');
  };
})();
