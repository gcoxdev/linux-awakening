/* Linux Awakening — shared utilities (no DOM). */
(function () {
  'use strict';
  const LA = (globalThis.LA = globalThis.LA || {});

  LA.clockOffset = 0; // story time = real time + offset (see Game.advanceClock)
  LA.now = () => Date.now() + LA.clockOffset;
  LA.timeScale = 1; // tests set this to 0 so sleeps/pings are instant

  /* ---------- ANSI color helpers ---------- */
  const E = '\x1b[';
  const ansi = {
    reset: E + '0m', bold: E + '1m', dim: E + '2m', italic: E + '3m', under: E + '4m', rev: E + '7m',
    red: E + '31m', green: E + '32m', yellow: E + '33m', blue: E + '34m', magenta: E + '35m',
    cyan: E + '36m', white: E + '37m', gray: E + '90m',
    bred: E + '1;31m', bgreen: E + '1;32m', byellow: E + '1;33m', bblue: E + '1;34m',
    bmagenta: E + '1;35m', bcyan: E + '1;36m', bwhite: E + '1;37m',
  };
  LA.ansi = ansi;
  LA.paint = (code, s) => code + s + ansi.reset;

  const U = (LA.util = {});

  U.stripAnsi = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, '');
  U.vlen = (s) => U.stripAnsi(s).length;
  U.padR = (s, n) => { s = String(s); const l = U.vlen(s); return l >= n ? s : s + ' '.repeat(n - l); };
  U.padL = (s, n) => { s = String(s); const l = U.vlen(s); return l >= n ? s : ' '.repeat(n - l) + s; };

  U.utf8len = (s) => {
    let n = 0;
    for (const ch of s) {
      const c = ch.codePointAt(0);
      n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
    }
    return n;
  };

  U.utf8bytes = (s) => {
    const out = [];
    for (const ch of s) {
      let c = ch.codePointAt(0);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  };

  U.utf8decode = (bytes) => {
    let s = '';
    for (let i = 0; i < bytes.length; ) {
      const b = bytes[i];
      let c;
      if (b < 0x80) { c = b; i += 1; }
      else if (b >= 0xf0) { c = ((b & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63); i += 4; }
      else if (b >= 0xe0) { c = ((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63); i += 3; }
      else if (b >= 0xc0) { c = ((b & 31) << 6) | (bytes[i + 1] & 63); i += 2; }
      else { c = 0xfffd; i += 1; }
      s += String.fromCodePoint(c);
    }
    return s;
  };

  /* human readable sizes, ls -h style */
  U.human = (bytes) => {
    if (bytes < 1024) return String(bytes);
    const units = ['K', 'M', 'G', 'T'];
    let v = bytes, i = -1;
    do { v /= 1024; i++; } while (v >= 1024 && i < units.length - 1);
    return (v < 10 ? (Math.ceil(v * 10) / 10).toFixed(1) : String(Math.ceil(v))) + units[i];
  };

  /* ---------- dates ---------- */
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  U.MON = MON; U.MONTHS = MONTHS; U.DAY = DAY; U.DAYS = DAYS;
  const p2 = (n) => String(n).padStart(2, '0');
  U.p2 = p2;

  U.lsDate = (ms) => {
    const d = new Date(ms);
    const recent = Math.abs(LA.now() - ms) < 182 * 86400000;
    const day = String(d.getDate()).padStart(2, ' ');
    return recent
      ? `${MON[d.getMonth()]} ${day} ${p2(d.getHours())}:${p2(d.getMinutes())}`
      : `${MON[d.getMonth()]} ${day}  ${d.getFullYear()}`;
  };

  U.stamp = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
  };

  U.syslogDate = (ms) => {
    const d = new Date(ms);
    return `${MON[d.getMonth()]} ${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
  };

  U.tzOffset = (d) => {
    const off = -d.getTimezoneOffset();
    const sign = off >= 0 ? '+' : '-';
    const a = Math.abs(off);
    return sign + p2(Math.floor(a / 60)) + p2(a % 60);
  };

  U.strftime = (fmt, d) => {
    const h12 = d.getHours() % 12 || 12;
    const start = new Date(d.getFullYear(), 0, 1);
    const doy = Math.floor((d - start) / 86400000) + 1;
    const map = {
      Y: d.getFullYear(), y: p2(d.getFullYear() % 100), m: p2(d.getMonth() + 1), d: p2(d.getDate()),
      e: String(d.getDate()).padStart(2, ' '), H: p2(d.getHours()), I: p2(h12), M: p2(d.getMinutes()),
      S: p2(d.getSeconds()), p: d.getHours() < 12 ? 'AM' : 'PM', a: DAY[d.getDay()], A: DAYS[d.getDay()],
      b: MON[d.getMonth()], h: MON[d.getMonth()], B: MONTHS[d.getMonth()], j: String(doy).padStart(3, '0'),
      s: Math.floor(d.getTime() / 1000), u: d.getDay() || 7, w: d.getDay(), Z: LA.tz || 'UTC', z: U.tzOffset(d),
      F: `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`,
      T: `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`,
      D: `${p2(d.getMonth() + 1)}/${p2(d.getDate())}/${p2(d.getFullYear() % 100)}`,
      R: `${p2(d.getHours())}:${p2(d.getMinutes())}`, n: '\n', t: '\t', '%': '%',
    };
    return fmt.replace(/%([a-zA-Z%])/g, (m, c) => (c in map ? String(map[c]) : m));
  };

  U.dateString = (d) =>
    `${DAY[d.getDay()]} ${MON[d.getMonth()]} ${String(d.getDate()).padStart(2, ' ')} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())} ${LA.tz || 'UTC'} ${d.getFullYear()}`;

  /* ---------- deterministic randomness ---------- */
  U.rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.hashStr = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  /* garbage for "binary" files */
  U.garbage = (seed, len) => {
    const r = U.rng(seed);
    const pool = '¿Ðæø§¶þ@#¤µ¬÷½«»åé^~ÆØ%&*░▒°©';
    let s = '';
    for (let i = 0; i < len; i++) {
      const x = r();
      if (x < 0.55) s += pool[Math.floor(r() * pool.length)];
      else if (x < 0.95) s += String.fromCharCode(33 + Math.floor(r() * 90));
      else s += '�';
      if (i % 72 === 71) s += '\n';
    }
    return s;
  };

  /* ---------- regex / glob helpers ---------- */
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  U.escapeRe = escapeRe;

  const PCLS = {
    alpha: 'a-zA-Z', digit: '0-9', alnum: 'a-zA-Z0-9', upper: 'A-Z', lower: 'a-z',
    space: ' \\t\\n\\r\\f\\v', blank: ' \\t', punct: '!-\\/:-@\\[-`{-~', xdigit: '0-9A-Fa-f',
    word: '\\w', cntrl: '\\x00-\\x1f', print: '\\x20-\\x7e', graph: '\\x21-\\x7e',
  };
  U.posixClasses = (s) => s.replace(/\[:(\w+):\]/g, (m, n) => PCLS[n] || m);

  function bracketEnd(p, i) {
    let j = i + 1;
    if (p[j] === '!' || p[j] === '^') j++;
    if (p[j] === ']') j++;
    while (j < p.length && p[j] !== ']') {
      if (p.startsWith('[:', j)) {
        const k = p.indexOf(':]', j + 2);
        if (k > 0) { j = k + 2; continue; }
      }
      j++;
    }
    return j < p.length ? j : -1;
  }
  U.bracketEnd = bracketEnd;

  function bracketBody(body) {
    let b = body.replace(/\\/g, '\\\\');
    b = U.posixClasses(b);
    return b.replace(/\[(?!\\)/g, '\\[');
  }

  /* glob pattern -> regex source (for find -name, case, [[ ==, ${x#pat}) */
  U.globSrc = (p, mask) => {
    let re = '';
    for (let i = 0; i < p.length; i++) {
      const c = p[i];
      const special = !mask || mask[i];
      if (c === '\\' && !mask && i + 1 < p.length) { re += escapeRe(p[++i]); continue; }
      if (special && c === '*') { re += '[^]*'; continue; }
      if (special && c === '?') { re += '[^]'; continue; }
      if (special && c === '[') {
        const j = bracketEnd(p, i);
        if (j > 0) {
          let body = p.slice(i + 1, j), neg = '';
          if (body[0] === '!' || body[0] === '^') { neg = '^'; body = body.slice(1); }
          re += '[' + neg + bracketBody(body) + ']';
          i = j;
          continue;
        }
      }
      re += escapeRe(c);
    }
    return re;
  };
  U.globRe = (p, flags) => {
    try { return new RegExp('^' + U.globSrc(p) + '$', flags || ''); } catch (e) { return new RegExp('^' + escapeRe(p) + '$'); }
  };
  U.hasGlob = (s) => /[*?[]/.test(s);

  /* POSIX BRE/ERE -> JS regex source */
  U.reToJs = (p, ere) => {
    let out = '';
    let i = 0;
    const atStart = () => out === '' || /(\(|\||\^)$/.test(out) && !/\\(\(|\||\^)$/.test(out);
    while (i < p.length) {
      const c = p[i];
      if (c === '\\') {
        const n = p[i + 1];
        i += 2;
        if (n === undefined) { out += '\\\\'; continue; }
        if (!ere && '(){}|+?'.includes(n)) { out += n; continue; }
        if (n === '<' || n === '>') { out += '\\b'; continue; }
        if (/[1-9]/.test(n)) { out += '\\' + n; continue; }
        if ('wWsSbBdD'.includes(n)) { out += '\\' + n; continue; }
        if (n === 'n') { out += '\\n'; continue; }
        if (n === 't') { out += '\\t'; continue; }
        out += escapeRe(n);
        continue;
      }
      if (c === '[') {
        const j = bracketEnd(p, i);
        if (j < 0) { out += '\\['; i++; continue; }
        let body = p.slice(i + 1, j), neg = '';
        if (body[0] === '^') { neg = '^'; body = body.slice(1); }
        out += '[' + neg + bracketBody(body) + ']';
        i = j + 1;
        continue;
      }
      if (c === '*' && atStart()) { out += '\\*'; i++; continue; }
      if (!ere && '(){}|+?'.includes(c)) { out += '\\' + c; i++; continue; }
      if (ere && c === '{' && !/^\{\d+(,\d*)?\}/.test(p.slice(i))) { out += '\\{'; i++; continue; }
      if (c === '/') { out += '\\/'; i++; continue; }
      out += c;
      i++;
    }
    return out;
  };

  /* ---------- printf-style formatting ---------- */
  U.sprintf = (fmt, args) => {
    let ai = 0;
    let used = 0;
    const next = () => { used++; return ai < args.length ? args[ai++] : undefined; };
    const out = fmt.replace(/%([-+ 0#]*)(\*|\d+)?(?:\.(\*|\d+))?([diouxXeEfFgGsc%b])/g, (m, flags, width, prec, conv) => {
      if (conv === '%') return '%';
      if (width === '*') width = parseInt(next(), 10) || 0;
      if (prec === '*') prec = parseInt(next(), 10) || 0;
      const w = width !== undefined ? parseInt(width, 10) : 0;
      const pr = prec !== undefined ? parseInt(prec, 10) : undefined;
      let v = next();
      let s;
      const num = () => {
        if (v === undefined || v === '') return 0;
        if (typeof v === 'number') return v;
        const sv = String(v).trim();
        if (/^'./.test(sv) || /^"./.test(sv)) return sv.charCodeAt(1);
        const n = parseFloat(sv);
        return isNaN(n) ? (/^0x[0-9a-f]+$/i.test(sv) ? parseInt(sv, 16) : 0) : n;
      };
      switch (conv) {
        case 'd': case 'i': case 'u': {
          const n = Math.trunc(num());
          s = String(Math.abs(n));
          if (pr !== undefined) s = s.padStart(pr, '0');
          s = (n < 0 ? '-' : flags.includes('+') ? '+' : flags.includes(' ') ? ' ' : '') + s;
          break;
        }
        case 'o': s = Math.trunc(num()).toString(8); break;
        case 'x': s = Math.trunc(num()).toString(16); break;
        case 'X': s = Math.trunc(num()).toString(16).toUpperCase(); break;
        case 'f': case 'F': {
          const n = num();
          s = n.toFixed(pr === undefined ? 6 : pr);
          if (n >= 0 && flags.includes('+')) s = '+' + s;
          break;
        }
        case 'e': case 'E': {
          s = num().toExponential(pr === undefined ? 6 : pr).replace(/e([+-])(\d)$/, 'e$10$2');
          if (conv === 'E') s = s.toUpperCase();
          break;
        }
        case 'g': case 'G': {
          const n = num();
          const P = pr === undefined ? 6 : pr || 1;
          const ex = n === 0 ? 0 : Math.floor(Math.log10(Math.abs(n)));
          if (ex < -4 || ex >= P) s = n.toExponential(P - 1).replace(/\.?0+e/, 'e').replace(/e([+-])(\d)$/, 'e$10$2');
          else s = String(parseFloat(n.toPrecision(P)));
          if (conv === 'G') s = s.toUpperCase();
          break;
        }
        case 'c': s = v === undefined ? '' : String(v).charAt(0); break;
        case 'b': s = v === undefined ? '' : U.unescape(String(v)); break;
        default: s = v === undefined ? '' : String(v); if (pr !== undefined) s = s.slice(0, pr);
      }
      if (s.length < w) {
        if (flags.includes('-')) s = s.padEnd(w, ' ');
        else if (flags.includes('0') && 'diouxXeEfFgG'.includes(conv)) {
          const sign = /^[+\- ]/.test(s) ? s[0] : '';
          s = sign + s.slice(sign.length).padStart(w - sign.length, '0');
        } else s = s.padStart(w, ' ');
      }
      return s;
    });
    return { out, used, consumed: ai };
  };

  /* backslash escapes as in echo -e / printf */
  U.unescape = (s) =>
    s.replace(/\\(0[0-7]{0,3}|x[0-9a-fA-F]{1,2}|[abefnrtv\\'"c]|e)/g, (m, c) => {
      if (c[0] === '0') return String.fromCharCode(parseInt(c.slice(1) || '0', 8));
      if (c[0] === 'x') return String.fromCharCode(parseInt(c.slice(1), 16));
      return { a: '\x07', b: '\b', e: '\x1b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '\\': '\\', "'": "'", '"': '"', c: '\u0000STOP' }[c];
    });

  /* ---------- option parsing ---------- */
  class OptError extends Error {}
  LA.OptError = OptError;
  U.getopt = (args, spec) => {
    const o = {};
    const operands = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '--') { operands.push(...args.slice(i + 1)); break; }
      if (a.startsWith('--') && a.length > 2) {
        const eq = a.indexOf('=');
        const k = eq > 0 ? a.slice(2, eq) : a.slice(2);
        let v = eq > 0 ? a.slice(eq + 1) : undefined;
        const m = spec.long && spec.long[k];
        if (m === undefined) throw new OptError(`unrecognized option '${a}'`);
        if (m.endsWith('=')) {
          const key = m.slice(0, -1);
          if (v === undefined) {
            v = args[++i];
            if (v === undefined) throw new OptError(`option '--${k}' requires an argument`);
          }
          o[key] = v;
        } else o[m] = (o[m] || 0) + 1;
        continue;
      }
      if (a.startsWith('-') && a.length > 1 && !(spec.dashIsOperand && a === '-')) {
        if (spec.numeric && /^-\d+$/.test(a)) { o[spec.numeric] = a.slice(1); continue; }
        if (spec.negNumbers && /^-\d/.test(a)) { operands.push(a); continue; }
        for (let j = 1; j < a.length; j++) {
          const ch = a[j];
          if (spec.params && spec.params.includes(ch)) {
            let v = a.slice(j + 1);
            if (!v) {
              v = args[++i];
              if (v === undefined) throw new OptError(`option requires an argument -- '${ch}'`);
            }
            o[ch] = v;
            break;
          }
          if (spec.flags && spec.flags.includes(ch)) { o[ch] = (o[ch] || 0) + 1; continue; }
          throw new OptError(`invalid option -- '${ch}'`);
        }
        continue;
      }
      operands.push(a);
      if (spec.stopAtOperand) { operands.push(...args.slice(i + 1)); break; }
    }
    return { o, operands };
  };

  /* split text into lines, dropping the final empty piece from a trailing newline */
  U.lines = (s) => {
    if (s === '' || s == null) return [];
    const ls = s.split('\n');
    if (ls[ls.length - 1] === '') ls.pop();
    return ls;
  };
  U.joinLines = (ls) => (ls.length ? ls.join('\n') + '\n' : '');

  /* shell-quote for display */
  U.shq = (s) => (/^[\w@%+=:,./-]+$/.test(s) ? s : "'" + String(s).replace(/'/g, "'\\''") + "'");

  /* ---------- hashing ---------- */
  U.sha256 = (str) => {
    const bytes = U.utf8bytes(str);
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const l = bytes.length;
    const msg = bytes.slice();
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    const bits = l * 8;
    const hi = Math.floor(bits / 0x100000000), lo = bits >>> 0;
    msg.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    const W = new Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < msg.length; off += 64) {
      for (let t = 0; t < 16; t++) W[t] = (msg[off + t * 4] << 24) | (msg[off + t * 4 + 1] << 16) | (msg[off + t * 4 + 2] << 8) | msg[off + t * 4 + 3];
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
        const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[t] + W[t]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const mj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H = [H[0] + a, H[1] + b, H[2] + c, H[3] + d, H[4] + e, H[5] + f, H[6] + g, H[7] + h].map((x) => x | 0);
    }
    return H.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
  };

  U.md5 = (str) => {
    const bytes = U.utf8bytes(str);
    const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
      4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
    const K = [];
    for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) | 0;
    const l = bytes.length;
    const msg = bytes.slice();
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    const bits = l * 8;
    const lo = bits >>> 0, hi = Math.floor(bits / 0x100000000);
    msg.push(lo & 255, (lo >>> 8) & 255, (lo >>> 16) & 255, (lo >>> 24) & 255, hi & 255, (hi >>> 8) & 255, (hi >>> 16) & 255, (hi >>> 24) & 255);
    let a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
    for (let off = 0; off < msg.length; off += 64) {
      const M = [];
      for (let i = 0; i < 16; i++) M[i] = msg[off + i * 4] | (msg[off + i * 4 + 1] << 8) | (msg[off + i * 4 + 2] << 16) | (msg[off + i * 4 + 3] << 24);
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + K[i] + M[g]) | 0;
        A = D; D = C; C = B;
        B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) | 0;
      }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }
    return [a0, b0, c0, d0].map((x) => {
      let s = '';
      for (let i = 0; i < 4; i++) s += ((x >>> (i * 8)) & 255).toString(16).padStart(2, '0');
      return s;
    }).join('');
  };

  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  U.b64encode = (str) => {
    const b = U.utf8bytes(str);
    let out = '';
    for (let i = 0; i < b.length; i += 3) {
      const n = (b[i] << 16) | ((b[i + 1] || 0) << 8) | (b[i + 2] || 0);
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '=');
    }
    return out;
  };
  U.b64decode = (s) => {
    const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
    const bytes = [];
    for (let i = 0; i < clean.length; i += 4) {
      const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) | ((B64.indexOf(clean[i + 2]) & 63) << 6) | (B64.indexOf(clean[i + 3]) & 63);
      bytes.push((n >> 16) & 255);
      if (clean[i + 2] !== undefined) bytes.push((n >> 8) & 255);
      if (clean[i + 3] !== undefined) bytes.push(n & 255);
    }
    return U.utf8decode(bytes);
  };

  /* Levenshtein for "did you mean" */
  U.editDistance = (a, b) => {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return dp[a.length][b.length];
  };
})();
