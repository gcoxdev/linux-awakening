/* Linux Awakening — the shell: expansion, redirection, execution. */
(function () {
  'use strict';
  const LA = (globalThis.LA = globalThis.LA || {});
  const U = LA.util;
  const VFS = LA.VFS;

  LA.commands = LA.commands || {};
  LA.builtinNames = new Set();
  LA.keywords = new Set(['if', 'then', 'elif', 'else', 'fi', 'for', 'in', 'do', 'done', 'while', 'until', 'case', 'esac', 'function', '{', '}', '[[', ']]', '!']);
  LA.def = (name, spec) => {
    LA.commands[name] = spec;
    if (spec.builtin) LA.builtinNames.add(name);
  };

  class ExitSignal { constructor(code) { this.code = code; } }
  class ReturnSignal { constructor(code) { this.code = code; } }
  class LoopSignal { constructor(kind, n) { this.kind = kind; this.n = n; } }
  class Interrupt { }
  LA.ExitSignal = ExitSignal;
  LA.ReturnSignal = ReturnSignal;
  LA.LoopSignal = LoopSignal;
  LA.Interrupt = Interrupt;

  class BufWriter { constructor() { this.buf = ''; } write(s) { this.buf += s; } }
  class NullWriter { write() {} }
  class TeeWriter {
    constructor(inner, cap = 60000) { this.inner = inner; this.buf = ''; this.cap = cap; this.isTTY = inner.isTTY; }
    write(s) { if (this.buf.length < this.cap) this.buf += s; this.inner.write(s); }
  }
  LA.BufWriter = BufWriter;
  LA.NullWriter = NullWriter;

  /* consumable stdin (so `while read` loops share one cursor) */
  class InStream {
    constructor(text) { this.text = text == null ? '' : String(text); this.pos = 0; }
    readAll() { const s = this.text.slice(this.pos); this.pos = this.text.length; return s; }
    readLine() {
      if (this.pos >= this.text.length) return null;
      let j = this.text.indexOf('\n', this.pos);
      if (j < 0) j = this.text.length;
      const line = this.text.slice(this.pos, j);
      this.pos = j + 1;
      return line;
    }
    peekAll() { return this.text.slice(this.pos); }
  }
  LA.InStream = InStream;

  class Signal {
    constructor() { this.aborted = false; this.cbs = []; }
    abort() { if (this.aborted) return; this.aborted = true; const c = this.cbs.splice(0); c.forEach((f) => { try { f(); } catch (e) { /* ignore */ } }); }
    on(f) { if (this.aborted) f(); else this.cbs.push(f); }
  }
  LA.Signal = Signal;

  /* ---------------- arithmetic ---------------- */
  function arith(src, scope, depth = 0) {
    const toks = [];
    const re = /(0x[0-9a-fA-F]+|\d+)|([A-Za-z_]\w*)|(\*\*=|<<=|>>=|\*\*|\+\+|--|<<|>>|<=|>=|==|!=|&&|\|\||[-+*/%&|^]=|[-+*/%<>=!~&|^?:(),])/y;
    let pos = 0;
    while (pos < src.length) {
      while (pos < src.length && /\s/.test(src[pos])) pos++;
      if (pos >= src.length) break;
      re.lastIndex = pos;
      const m = re.exec(src);
      if (!m) throw new Error(`syntax error: invalid arithmetic operator (error token is "${src.slice(pos)}")`);
      pos = re.lastIndex;
      if (m[1] !== undefined) toks.push({ k: 'n', v: m[1].startsWith('0x') ? parseInt(m[1], 16) : /^0\d/.test(m[1]) ? parseInt(m[1], 8) : parseInt(m[1], 10) });
      else if (m[2] !== undefined) toks.push({ k: 'id', v: m[2] });
      else toks.push({ k: 'op', v: m[3] });
    }
    let p = 0;
    const peek = () => toks[p];
    const isOp = (v) => toks[p] && toks[p].k === 'op' && toks[p].v === v;
    const PREC = { '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7, '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10, '**': 11 };
    const ASG = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '**=']);
    function expr() {
      let a = assign();
      while (isOp(',')) { p++; const b = assign(); a = { k: 'comma', a, b }; }
      return a;
    }
    function assign() {
      const t = peek();
      if (t && t.k === 'id' && toks[p + 1] && toks[p + 1].k === 'op' && ASG.has(toks[p + 1].v)) {
        p += 2;
        return { k: 'asg', n: t.v, op: toks[p - 1].v, b: assign() };
      }
      return ternary();
    }
    function ternary() {
      const c = binary(1);
      if (isOp('?')) {
        p++;
        const a = assign();
        if (!isOp(':')) throw new Error("syntax error: ':' expected");
        p++;
        const b = assign();
        return { k: 'tern', c, a, b };
      }
      return c;
    }
    function binary(min) {
      let a = unary();
      for (;;) {
        const t = peek();
        if (!t || t.k !== 'op' || !(t.v in PREC) || PREC[t.v] < min) break;
        const op = t.v;
        p++;
        const b = binary(op === '**' ? PREC[op] : PREC[op] + 1);
        a = { k: 'bin', op, a, b };
      }
      return a;
    }
    function unary() {
      const t = peek();
      if (t && t.k === 'op') {
        if (t.v === '++' || t.v === '--') {
          p++;
          const id = peek();
          if (!id || id.k !== 'id') throw new Error('syntax error: operand expected');
          p++;
          return { k: 'pre', op: t.v, n: id.v };
        }
        if ('+-!~'.includes(t.v) && t.v.length === 1) { p++; return { k: 'un', op: t.v, a: unary() }; }
      }
      return postfix();
    }
    function postfix() {
      const t = peek();
      if (!t) throw new Error('syntax error: operand expected');
      if (t.k === 'n') { p++; return { k: 'num', v: t.v }; }
      if (t.k === 'id') {
        p++;
        if (isOp('++') || isOp('--')) { const op = peek().v; p++; return { k: 'post', op, n: t.v }; }
        return { k: 'var', n: t.v };
      }
      if (isOp('(')) {
        p++;
        const e = expr();
        if (!isOp(')')) throw new Error("syntax error: ')' expected");
        p++;
        return e;
      }
      throw new Error(`syntax error: operand expected (error token is "${t.v}")`);
    }
    const getv = (n) => {
      const v = scope.get(n);
      if (v === '' || v == null) return 0;
      if (/^\s*-?\d+\s*$/.test(v)) return parseInt(v, 10);
      if (depth < 5 && /^[\w\s+\-*/%()]+$/.test(v)) return arith(v, scope, depth + 1);
      return 0;
    };
    function ev(n) {
      switch (n.k) {
        case 'num': return n.v;
        case 'var': return getv(n.n);
        case 'comma': ev(n.a); return ev(n.b);
        case 'tern': return ev(n.c) ? ev(n.a) : ev(n.b);
        case 'un': { const v = ev(n.a); return n.op === '-' ? -v : n.op === '+' ? v : n.op === '!' ? (v ? 0 : 1) : ~v; }
        case 'pre': { const v = getv(n.n) + (n.op === '++' ? 1 : -1); scope.set(n.n, String(v)); return v; }
        case 'post': { const v = getv(n.n); scope.set(n.n, String(v + (n.op === '++' ? 1 : -1))); return v; }
        case 'asg': {
          const b = ev(n.b);
          let v = b;
          if (n.op !== '=') v = binop(n.op.slice(0, -1), getv(n.n), b);
          scope.set(n.n, String(v));
          return v;
        }
        case 'bin':
          if (n.op === '&&') return ev(n.a) && ev(n.b) ? 1 : 0;
          if (n.op === '||') return ev(n.a) || ev(n.b) ? 1 : 0;
          return binop(n.op, ev(n.a), ev(n.b));
      }
      return 0;
    }
    function binop(op, a, b) {
      switch (op) {
        case '+': return a + b; case '-': return a - b; case '*': return a * b;
        case '/': if (b === 0) throw new Error('division by 0 (error token is "0")'); return Math.trunc(a / b);
        case '%': if (b === 0) throw new Error('division by 0 (error token is "0")'); return a % b;
        case '**': return Math.pow(a, b);
        case '<<': return a << b; case '>>': return a >> b;
        case '<': return a < b ? 1 : 0; case '>': return a > b ? 1 : 0;
        case '<=': return a <= b ? 1 : 0; case '>=': return a >= b ? 1 : 0;
        case '==': return a === b ? 1 : 0; case '!=': return a !== b ? 1 : 0;
        case '&': return a & b; case '|': return a | b; case '^': return a ^ b;
      }
      return 0;
    }
    if (!toks.length) return 0;
    const ast = expr();
    if (p < toks.length) throw new Error(`syntax error in expression (error token is "${toks[p].v}")`);
    return ev(ast);
  }
  LA.arith = arith;

  /* ---------------- brace expansion ---------------- */
  function braceExpand(raw) {
    let q = null;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (q) {
        if (c === '\\' && q === '"') { i++; continue; }
        if (c === q) q = null;
        continue;
      }
      if (c === '\\') { i++; continue; }
      if (c === "'" || c === '"') { q = c; continue; }
      if (c === '$' && raw[i + 1] === '{') {
        let d = 0;
        for (let j = i + 1; j < raw.length; j++) {
          if (raw[j] === '{') d++;
          else if (raw[j] === '}') { d--; if (!d) { i = j; break; } }
        }
        continue;
      }
      if (c === '$' && raw[i + 1] === '(') {
        let d = 0;
        for (let j = i + 1; j < raw.length; j++) {
          if (raw[j] === '(') d++;
          else if (raw[j] === ')') { d--; if (!d) { i = j; break; } }
        }
        continue;
      }
      if (c !== '{') continue;
      let depth = 0, q2 = null, end = -1;
      const commas = [];
      for (let j = i; j < raw.length; j++) {
        const d = raw[j];
        if (q2) { if (d === q2) q2 = null; continue; }
        if (d === '\\') { j++; continue; }
        if (d === "'" || d === '"') { q2 = d; continue; }
        if (d === '{') depth++;
        else if (d === '}') { depth--; if (!depth) { end = j; break; } }
        else if (d === ',' && depth === 1) commas.push(j);
      }
      if (end < 0) return [raw];
      const pre = raw.slice(0, i), post = raw.slice(end + 1), body = raw.slice(i + 1, end);
      let alts = null;
      if (commas.length) {
        alts = [];
        let s = i + 1;
        for (const cp of commas) { alts.push(raw.slice(s, cp)); s = cp + 1; }
        alts.push(raw.slice(s, end));
      } else {
        let m = body.match(/^(-?\d+)\.\.(-?\d+)(?:\.\.(-?\d+))?$/);
        if (m) {
          const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
          let step = Math.abs(parseInt(m[3] || '1', 10)) || 1;
          const width = (/^-?0\d/.test(m[1]) || /^-?0\d/.test(m[2])) ? Math.max(m[1].length, m[2].length) : 0;
          alts = [];
          if (a <= b) for (let v = a; v <= b && alts.length < 10000; v += step) alts.push(width ? String(v).padStart(width, '0') : String(v));
          else for (let v = a; v >= b && alts.length < 10000; v -= step) alts.push(width ? String(v).padStart(width, '0') : String(v));
        } else if ((m = body.match(/^([a-zA-Z])\.\.([a-zA-Z])$/))) {
          const a = m[1].charCodeAt(0), b = m[2].charCodeAt(0);
          alts = [];
          if (a <= b) for (let v = a; v <= b; v++) alts.push(String.fromCharCode(v));
          else for (let v = a; v >= b; v--) alts.push(String.fromCharCode(v));
        }
      }
      if (alts) {
        const res = [];
        for (const a of alts) res.push(...braceExpand(pre + a + post));
        return res;
      }
      const rest = braceExpand(raw.slice(i + 1));
      return rest.map((r) => raw.slice(0, i + 1) + r);
    }
    return [raw];
  }
  LA.braceExpand = braceExpand;

  function findClose(raw, i, open, close) {
    let depth = 1, q = null;
    for (let j = i; j < raw.length; j++) {
      const c = raw[j];
      if (q) {
        if (c === '\\' && q === '"') { j++; continue; }
        if (c === q) q = null;
        continue;
      }
      if (c === '\\') { j++; continue; }
      if (c === "'" || c === '"') { q = c; continue; }
      if (c === open) depth++;
      else if (c === close) { depth--; if (!depth) return j; }
    }
    return raw.length;
  }

  function unparse(node) {
    if (!node) return '';
    switch (node.type) {
      case 'simple': return node.assigns.concat(node.words).join(' ') + node.redirs.map((r) => ' ' + (r.fd != null ? r.fd : '') + r.op + (r.target || '')).join('');
      case 'pipeline': return (node.bang ? '! ' : '') + node.cmds.map(unparse).join(' | ');
      case 'andor': return node.parts.map((p, i) => (i ? ' ' + node.ops[i - 1] + ' ' : '') + unparse(p)).join('');
      case 'list': return node.items.map((it) => unparse(it.node) + (it.bg ? ' &' : '')).join('; ');
      case 'subshell': return '( ' + unparse(node.body) + ' )';
      case 'group': return '{ ' + unparse(node.body) + '; }';
      case 'for': return `for ${node.name} in ${(node.items || []).join(' ')}; do ${unparse(node.body)}; done`;
      case 'while': return `${node.until ? 'until' : 'while'} ${unparse(node.cond)}; do ${unparse(node.body)}; done`;
      case 'if': return `if ${unparse(node.clauses[0].cond)}; then ${unparse(node.clauses[0].body)}; fi`;
      default: return node.type;
    }
  }
  LA.unparse = unparse;

  /* ---------------- Shell ---------------- */
  class Shell {
    constructor(o) {
      this.host = o.host;
      this.fs = o.host.fs;
      this.user = o.user;
      this.ui = o.ui;
      this.game = o.game || null;
      this.world = o.world;
      this.vars = new Map();
      this.aliases = {};
      this.functions = {};
      this.positional = [];
      this.scriptName = o.scriptName || 'bash';
      this.cwd = o.cwd || '/';
      this.lastStatus = 0;
      this.umask = 0o022;
      this.history = [];
      this.jobs = [];
      this.jobNotices = [];
      this.nextJob = 1;
      this.interactive = !!o.interactive;
      this.parent = o.parent || null;
      this.depth = o.depth || 0;
      this.signal = o.signal || new Signal();
      this.recRoot = o.recRoot || this;
      this.recs = [];
      this.localStack = [];
      this.lastBg = '';
      this.ticks = 0;
      this.pid = o.pid || (this.world && o.spawn !== false && this.interactive ? this.world.spawn({ user: this.user, comm: 'bash', args: o.login ? '-bash' : 'bash', tty: o.tty || 'pts/1', host: this.host.name }) : (this.world ? this.world.peekPid() : 4000));
      this.tty = o.tty || 'pts/1';
      this.onExit = o.onExit || null;
      this.busy = false;
      this.aliasesEnabled = this.interactive;
      if (o.initEnv !== false) this.initEnv();
    }

    initEnv() {
      const u = this.host.users.get(this.user);
      const home = u ? u.home : '/';
      this.setVar('HOME', home, true);
      this.setVar('USER', this.user, true);
      this.setVar('LOGNAME', this.user, true);
      this.setVar('SHELL', '/bin/bash', true);
      this.setVar('PATH', this.user === 'root' ? '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' : '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/games', true);
      this.setVar('HOSTNAME', this.host.name, false);
      this.setVar('TERM', 'xterm-256color', true);
      this.setVar('LANG', 'en_US.UTF-8', true);
      this.setVar('PWD', this.cwd, true);
      this.setVar('PS1', '\\[\\e[1;32m\\]\\u@\\h\\[\\e[0m\\]:\\[\\e[1;34m\\]\\w\\[\\e[0m\\]\\$ ', false);
      this.setVar('PS2', '> ', false);
      this.setVar('IFS', ' \t\n', false);
      this.setVar('HISTSIZE', '1000', false);
    }

    /* ---- variables ---- */
    getVar(name) {
      const v = this.vars.get(name);
      return v ? v.v : undefined;
    }
    setVar(name, value, exported) {
      if (this.localStack.length) {
        const top = this.localStack[this.localStack.length - 1];
        void top;
      }
      const cur = this.vars.get(name);
      if (cur && cur.ro) throw new Error(`${name}: readonly variable`);
      this.vars.set(name, { v: String(value), x: exported === undefined ? !!(cur && cur.x) : !!exported });
      if (name === 'PWD' && this.cwd !== value && value.startsWith('/')) { /* informational only */ }
    }
    exportVar(name) {
      const cur = this.vars.get(name);
      if (cur) cur.x = true;
      else this.vars.set(name, { v: '', x: true, unset: true });
    }
    unsetVar(name) { this.vars.delete(name); }
    exportedEnv() {
      const env = {};
      for (const [k, v] of this.vars) if (v.x && !v.unset) env[k] = v.v;
      return env;
    }
    get home() { return this.getVar('HOME') || '/'; }

    getParam(name) {
      switch (name) {
        case '?': return String(this.lastStatus);
        case '#': return String(this.positional.length);
        case '$': return String(this.pid);
        case '!': return String(this.lastBg);
        case '0': return this.scriptName;
        case '@': case '*': return this.positional.join(' ');
        case '-': return this.interactive ? 'himBHs' : 'hB';
        case 'RANDOM': return String(Math.floor(Math.random() * 32768));
        case 'SECONDS': return String(Math.floor((LA.now() - (this.startTime || LA.now())) / 1000));
        case 'PWD': return this.cwd;
        case 'UID': { const u = this.host.users.get(this.user); return String(u ? u.uid : 0); }
        case 'EUID': return this.getParam('UID');
        case 'PPID': return String(this.parent ? this.parent.pid : 1);
      }
      if (/^\d+$/.test(name)) { const v = this.positional[parseInt(name, 10) - 1]; return v === undefined ? '' : v; }
      const v = this.getVar(name);
      return v === undefined ? '' : v;
    }
    isSet(name) {
      if (/^\d+$/.test(name)) return parseInt(name, 10) <= this.positional.length;
      if ('?#$!0@*-'.includes(name) && name.length === 1) return true;
      if (['RANDOM', 'SECONDS', 'PWD', 'UID', 'EUID', 'PPID'].includes(name)) return true;
      const v = this.vars.get(name);
      return !!v && !v.unset;
    }

    tildeDir(name) {
      if (name === '') return this.home;
      if (name === '+') return this.cwd;
      if (name === '-') return this.getVar('OLDPWD') || null;
      const u = this.host.users.get(name);
      return u ? u.home : null;
    }

    displayPath(p) {
      const h = this.home;
      if (h && h !== '/' && (p === h || p.startsWith(h + '/'))) return '~' + p.slice(h.length);
      return p;
    }

    promptString(which = 'PS1') {
      const ps = this.getVar(which) || '$ ';
      const now = new Date(LA.now());
      return ps.replace(/\\(\[|\]|u|h|H|w|W|\$|n|t|T|d|e|0?33|\\|@|A)/g, (m, c) => {
        switch (c) {
          case '[': case ']': return '';
          case 'u': return this.user;
          case 'h': return this.host.name.split('.')[0];
          case 'H': return this.host.name;
          case 'w': return this.displayPath(this.cwd);
          case 'W': { const d = this.displayPath(this.cwd); return d === '~' || d === '/' ? d : VFS.basename(d); }
          case '$': return this.user === 'root' ? '#' : '$';
          case 'n': return '\n';
          case 't': return U.strftime('%H:%M:%S', now);
          case 'T': return U.strftime('%I:%M:%S', now);
          case 'A': return U.strftime('%H:%M', now);
          case '@': return U.strftime('%I:%M %p', now);
          case 'd': return U.strftime('%a %b %d', now);
          case 'e': case '033': case '33': return '\x1b';
          case '\\': return '\\';
        }
        return m;
      });
    }

    /* ---- top level ---- */
    isComplete(src) { return LA.isComplete(src); }

    historyExpand(line) {
      if (!line.includes('!')) return { line, changed: false };
      let out = '', changed = false, q = null;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === "'" && q !== '"') { q = q === "'" ? null : "'"; out += c; continue; }
        if (c === '"' && q !== "'") { q = q === '"' ? null : '"'; out += c; continue; }
        if (c === '\\' && q !== "'") { out += c + (line[i + 1] || ''); i++; continue; }
        if (c !== '!' || q === "'") { out += c; continue; }
        const rest = line.slice(i + 1);
        let m;
        const h = this.history;
        if (rest[0] === '!') {
          if (!h.length) throw new Error('!!: event not found');
          out += h[h.length - 1]; i += 1; changed = true;
        } else if (rest[0] === '$') {
          if (!h.length) throw new Error('!$: event not found');
          const words = h[h.length - 1].trim().split(/\s+/);
          out += words[words.length - 1]; i += 1; changed = true;
        } else if ((m = rest.match(/^-?\d+/))) {
          const n = parseInt(m[0], 10);
          const idx = n < 0 ? h.length + n : n - 1;
          if (idx < 0 || idx >= h.length) throw new Error(`!${m[0]}: event not found`);
          out += h[idx]; i += m[0].length; changed = true;
        } else if ((m = rest.match(/^[A-Za-z_./][\w./-]*/))) {
          let found = null;
          for (let k = h.length - 1; k >= 0; k--) if (h[k].startsWith(m[0])) { found = h[k]; break; }
          if (!found) throw new Error(`!${m[0]}: event not found`);
          out += found; i += m[0].length; changed = true;
        } else out += c;
      }
      return { line: out, changed };
    }

    termIO() {
      return { stdin: null, out: this.ui.stdout, err: this.ui.stderr };
    }

    /* Run one interactive line. Returns exit status. */
    async run(src, opts = {}) {
      this.signal = new Signal();
      this.recs = [];
      this.busy = true;
      if (this.world && this.world.tick) this.world.tick(this);
      this.startTime = this.startTime || LA.now();
      let line = src;
      const io = opts.io || this.termIO();
      try {
        if (this.interactive && /!/.test(line) && !opts.noHistory) {
          try {
            const r = this.historyExpand(line);
            if (r.changed) { line = r.line; io.out.write(line + '\n'); }
          } catch (e) {
            io.err.write(`bash: ${e.message}\n`);
            this.lastStatus = 1;
            return 1;
          }
        }
        if (this.interactive && !opts.noHistory && line.trim() && !/^\s/.test(line)) {
          if (this.history[this.history.length - 1] !== line) this.history.push(line);
          if (this.history.length > 1000) this.history.shift();
        }
        if (this.game && opts.interactive !== false && this.interactive) {
          const handled = await this.game.intercept(line, this);
          if (handled) {
            this.lastStatus = handled.status || 0;
            await this.afterLine(line, opts);
            return this.lastStatus;
          }
        }
        let ast;
        try {
          ast = LA.parse(line, this.aliasesEnabled ? this.aliases : null);
        } catch (e) {
          if (e.incomplete) io.err.write("bash: syntax error: unexpected end of file\n");
          else io.err.write(`bash: ${e.message}\n`);
          this.lastStatus = 2;
          await this.afterLine(line, opts);
          return 2;
        }
        let status = 0;
        try {
          status = await this.execList(ast, io);
        } catch (e) {
          if (e instanceof ExitSignal) {
            status = e.code;
            this.lastStatus = status;
            if (this.onExit) { this.busy = false; this.onExit(status); return status; }
            if (this.game) this.game.onTopExit(this);
          } else if (e instanceof Interrupt) {
            status = 130;
          } else if (e instanceof ReturnSignal || e instanceof LoopSignal) {
            status = 1;
          } else {
            io.err.write(`bash: ${e.message}\n`);
            if (typeof console !== 'undefined') console.error(e);
            status = 1;
          }
        }
        this.lastStatus = status;
        await this.afterLine(line, opts);
        return status;
      } finally {
        this.busy = false;
      }
    }

    async afterLine(line, opts) {
      if (this.game && this.interactive && opts.interactive !== false) {
        await this.game.afterLine({ line, recs: this.recs, status: this.lastStatus, shell: this });
      }
    }

    interrupt() { this.signal.abort(); }

    flushJobNotices() {
      const n = this.jobNotices.splice(0);
      return n;
    }

    async tick() {
      if (++this.ticks % 64 === 0) await new Promise((r) => setTimeout(r, 0));
      if (this.signal.aborted) throw new Interrupt();
      if (this.ticks > 2000000) { this.ticks = 0; throw new Interrupt(); }
    }

    sleep(ms) {
      return new Promise((res) => {
        const sig = this.signal;
        if (sig.aborted) return res(false);
        const t = setTimeout(() => res(true), ms * LA.timeScale);
        sig.on(() => { clearTimeout(t); res(false); });
      });
    }

    /* ---- execution ---- */
    async execList(list, io) {
      let status = this.lastStatus;
      for (const it of list.items) {
        if (it.bg) { this.startJob(it.node, io); status = 0; }
        else status = await this.exec(it.node, io);
        this.lastStatus = status;
      }
      return status;
    }

    async exec(node, io) {
      if (this.signal.aborted) throw new Interrupt();
      switch (node.type) {
        case 'list': return this.execList(node, io);
        case 'simple': return this.execSimple(node, io);
        case 'pipeline': return this.execPipeline(node, io);
        case 'andor': {
          let st = await this.exec(node.parts[0], io);
          for (let i = 1; i < node.parts.length; i++) {
            this.lastStatus = st;
            const op = node.ops[i - 1];
            if ((op === '&&' && st === 0) || (op === '||' && st !== 0)) st = await this.exec(node.parts[i], io);
          }
          return st;
        }
        default: return this.execCompound(node, io);
      }
    }

    async execCompound(node, io) {
      let rio = io, fin = null;
      if (node.redirs && node.redirs.length) {
        const r = await this.redirect(node.redirs, io);
        if (r.error) return 1;
        rio = r.io;
        fin = r.finish;
      }
      try {
        switch (node.type) {
          case 'if': {
            for (const cl of node.clauses) {
              const c = await this.execList(cl.cond, rio);
              if (c === 0) return await this.execList(cl.body, rio);
            }
            if (node.elseBody) return await this.execList(node.elseBody, rio);
            return 0;
          }
          case 'for': {
            const items = node.items ? await this.expandWords(node.items) : this.positional.slice();
            let st = 0;
            for (const v of items) {
              await this.tick();
              this.setVar(node.name, v);
              try { st = await this.execList(node.body, rio); }
              catch (e) {
                if (e instanceof LoopSignal) {
                  if (e.n > 1) { e.n--; throw e; }
                  if (e.kind === 'break') break;
                  continue;
                }
                throw e;
              }
            }
            return st;
          }
          case 'while': {
            let st = 0;
            let guard = 0;
            for (;;) {
              await this.tick();
              if (++guard > 100000) { rio.err.write('bash: loop stopped after 100000 iterations (Rootfall safety valve)\n'); return 1; }
              const c = await this.execList(node.cond, rio);
              if (node.until ? c === 0 : c !== 0) break;
              try { st = await this.execList(node.body, rio); }
              catch (e) {
                if (e instanceof LoopSignal) {
                  if (e.n > 1) { e.n--; throw e; }
                  if (e.kind === 'break') break;
                  continue;
                }
                throw e;
              }
            }
            return st;
          }
          case 'case': {
            const w = await this.expandStr(node.word);
            for (const arm of node.arms) {
              for (const p of arm.pats) {
                const pat = await this.expandStr(p);
                if (U.globRe(pat).test(w)) return await this.execList(arm.body, rio);
              }
            }
            return 0;
          }
          case 'group': return await this.execList(node.body, rio);
          case 'subshell': {
            const sh = this.spawnChild({ script: false });
            try { return await sh.execList(node.body, rio); }
            catch (e) { if (e instanceof ExitSignal) return e.code; throw e; }
          }
          case 'func':
            this.functions[node.name] = node.body;
            return 0;
        }
        return 0;
      } finally {
        if (fin) await fin();
      }
    }

    async execPipeline(node, io) {
      let status;
      if (node.cmds.length === 1) status = await this.exec(node.cmds[0], io);
      else {
        let input = io.stdin;
        for (let i = 0; i < node.cmds.length; i++) {
          const last = i === node.cmds.length - 1;
          const out = last ? io.out : new BufWriter();
          const err = node.both && node.both[i] ? out : io.err;
          const sub = { stdin: i === 0 ? input : new InStream(input), out, err };
          status = await this.exec(node.cmds[i], sub);
          if (!last) input = out.buf;
        }
      }
      if (node.bang) status = status ? 0 : 1;
      return status;
    }

    async execSimple(node, io) {
      this.curIO = io;
      this.substStatus = null;
      let argv;
      try {
        argv = node.dbl
          ? await this.expandWords(node.words, { glob: false, split: false, brace: false })
          : await this.expandWords(node.words);
      } catch (e) {
        if (e instanceof Interrupt || e instanceof ExitSignal) throw e;
        io.err.write(`bash: ${e.message}\n`);
        return 1;
      }
      const assigns = [];
      for (const a of node.assigns) {
        const eq = a.indexOf('=');
        let name = a.slice(0, eq), append = false;
        if (name.endsWith('+')) { append = true; name = name.slice(0, -1); }
        let raw = a.slice(eq + 1);
        let val;
        try { val = await this.expandStr(raw, { tilde: true }); }
        catch (e) { if (e instanceof Interrupt) throw e; io.err.write(`bash: ${e.message}\n`); return 1; }
        assigns.push([name, val, append]);
      }
      if (!argv.length) {
        try {
          for (const [n, v, ap] of assigns) this.setVar(n, ap ? (this.getVar(n) || '') + v : v);
        } catch (e) { io.err.write(`bash: ${e.message}\n`); return 1; }
        if (node.redirs.length) {
          const r = await this.redirect(node.redirs, io);
          if (r.error) return 1;
          await r.finish();
        }
        return this.substStatus != null ? this.substStatus : 0;
      }
      if (this.xtrace) io.err.write('+ ' + node.assigns.concat(argv.map(U.shq)).join(' ') + '\n');
      const r = await this.redirect(node.redirs, io);
      if (r.error) return 1;
      let status;
      try {
        let env = null;
        if (assigns.length) { env = {}; for (const [n, v] of assigns) env[n] = v; }
        status = await this.dispatch(argv, r.io, { env });
      } finally {
        await r.finish();
      }
      return status;
    }

    /* ---- expansion ---- */
    async expandWords(raws, o = {}) {
      const out = [];
      for (const raw of raws) {
        const parts = o.brace === false ? [raw] : braceExpand(raw);
        for (const b of parts) out.push(...(await this.expandWord(b, o)));
      }
      return out;
    }
    async expandStr(raw, o = {}) {
      const f = await this.expandWord(raw, Object.assign({}, o, { split: false, glob: false }));
      return f.join(' ');
    }

    async expandWord(raw, o = {}) {
      const split = o.split !== false;
      const doGlob = o.glob !== false;
      if (raw === '"$@"') return this.positional.slice();
      const fields = [];
      let cur = null;
      const ensure = () => { if (!cur) cur = { s: '', g: [], has: false }; return cur; };
      const add = (str, glob) => { const c = ensure(); c.s += str; for (let k = 0; k < str.length; k++) c.g.push(glob); };
      const finish = () => { if (cur && (cur.has || cur.s.length)) fields.push(cur); cur = null; };
      const addExp = (val, quoted) => {
        if (quoted || !split) { add(val, false); return; }
        if (val === '') return;
        const lead = /^[ \t\n]/.test(val), trail = /[ \t\n]$/.test(val);
        const parts = val.split(/[ \t\n]+/).filter((x) => x !== '');
        if (lead) finish();
        parts.forEach((p, idx) => { if (idx > 0) finish(); add(p, true); });
        if (trail) finish();
      };
      let i = 0, inDq = false;
      const n = raw.length;
      if (raw[0] === '~') {
        let j = 1;
        while (j < n && raw[j] !== '/' && raw[j] !== ':') j++;
        const nm = raw.slice(1, j);
        if (/^[a-z0-9_+-]*$/i.test(nm)) {
          const home = this.tildeDir(nm);
          if (home != null) { add(home, false); ensure().has = true; i = j; }
        }
      }
      while (i < n) {
        const c = raw[i];
        if (!inDq && c === "'") {
          const j = raw.indexOf("'", i + 1);
          add(raw.slice(i + 1, j < 0 ? n : j), false);
          ensure().has = true;
          i = j < 0 ? n : j + 1;
          continue;
        }
        if (!inDq && c === '$' && raw[i + 1] === "'") {
          // ANSI-C quoting $'...'
          let j = i + 2, s = '';
          while (j < n && raw[j] !== "'") { if (raw[j] === '\\') { s += raw[j] + (raw[j + 1] || ''); j += 2; } else s += raw[j++]; }
          add(U.unescape(s), false);
          ensure().has = true;
          i = j + 1;
          continue;
        }
        if (c === '"') { inDq = !inDq; ensure().has = true; i++; continue; }
        if (c === '\\') {
          const nx = raw[i + 1];
          if (nx === undefined) { add('\\', false); i++; continue; }
          if (nx === '\n') { i += 2; continue; }
          if (inDq) {
            if ('$`"\\'.includes(nx)) { add(nx, false); i += 2; }
            else { add('\\', false); i++; }
            continue;
          }
          add(nx, false);
          ensure().has = true;
          i += 2;
          continue;
        }
        if (c === '$') {
          if (inDq && (raw.startsWith('$@', i) || raw.startsWith('${@}', i))) {
            const len = raw.startsWith('$@', i) ? 2 : 4;
            this.positional.forEach((p, idx) => { if (idx > 0) { finish(); ensure().has = true; } add(p, false); });
            i += len;
            continue;
          }
          const r = await this.expandDollar(raw, i);
          if (r) { addExp(r.val, inDq); i = r.end; continue; }
          add('$', !inDq);
          i++;
          continue;
        }
        if (c === '`') {
          let j = i + 1;
          while (j < n && raw[j] !== '`') { if (raw[j] === '\\') j++; j++; }
          const inner = raw.slice(i + 1, j).replace(/\\([`$\\])/g, '$1');
          addExp(await this.commandSubst(inner), inDq);
          i = j + 1;
          continue;
        }
        add(c, !inDq);
        i++;
      }
      finish();
      if (!doGlob) return fields.map((f) => f.s);
      const result = [];
      for (const f of fields) {
        if (f.g.some((g, k) => g && '*?['.includes(f.s[k]))) {
          const m = this.glob(f);
          if (m.length) { result.push(...m); continue; }
        }
        result.push(f.s);
      }
      return result;
    }

    async expandDollar(raw, i) {
      const nx = raw[i + 1];
      if (nx === '(' && raw[i + 2] === '(') {
        let depth = 0, j = i + 3;
        for (; j < raw.length; j++) {
          if (raw[j] === '(') depth++;
          else if (raw[j] === ')') {
            if (depth === 0 && raw[j + 1] === ')') break;
            depth--;
          }
        }
        if (j < raw.length) {
          const inner = await this.expandStr(raw.slice(i + 3, j));
          const v = arith(inner, { get: (k) => this.getParam(k), set: (k, v) => this.setVar(k, v) });
          return { val: String(v), end: j + 2 };
        }
      }
      if (nx === '(') {
        const j = findClose(raw, i + 2, '(', ')');
        return { val: await this.commandSubst(raw.slice(i + 2, j)), end: j + 1 };
      }
      if (nx === '{') {
        const j = findClose(raw, i + 2, '{', '}');
        return { val: await this.paramExpand(raw.slice(i + 2, j)), end: j + 1 };
      }
      if (nx && /[A-Za-z_]/.test(nx)) {
        let j = i + 1;
        while (j < raw.length && /\w/.test(raw[j])) j++;
        const name = raw.slice(i + 1, j);
        if (this.strictVars && !this.isSet(name)) throw new Error(`${name}: unbound variable`);
        return { val: this.getParam(name), end: j };
      }
      if (nx && /[0-9?#$!@*-]/.test(nx)) return { val: this.getParam(nx), end: i + 2 };
      return null;
    }

    async paramExpand(inner) {
      if (/^#[A-Za-z_]\w*$|^#\d+$|^#[@*]$/.test(inner)) {
        const nm = inner.slice(1);
        if (nm === '@' || nm === '*') return String(this.positional.length);
        return String(this.getParam(nm).length);
      }
      const m = inner.match(/^([A-Za-z_]\w*|\d+|[@*#?$!-])([\s\S]*)$/);
      if (!m) throw new Error(`\${${inner}}: bad substitution`);
      const name = m[1], rest = m[2];
      const val = this.getParam(name);
      const set = this.isSet(name);
      if (rest === '') return val;
      let mm;
      if ((mm = rest.match(/^(:?)([-=+?])([\s\S]*)$/))) {
        const colon = mm[1] === ':', op = mm[2];
        const empty = !set || (colon && val === '');
        const word = async () => this.expandStr(mm[3], { tilde: true });
        if (op === '-') return empty ? await word() : val;
        if (op === '=') { if (empty) { const w = await word(); this.setVar(name, w); return w; } return val; }
        if (op === '+') return empty ? '' : await word();
        if (op === '?') { if (empty) throw new Error(`${name}: ${(await word()) || 'parameter null or not set'}`); return val; }
      }
      if ((mm = rest.match(/^(##?|%%?)([\s\S]*)$/))) {
        const pat = await this.expandStr(mm[2]);
        const re = new RegExp('^' + U.globSrc(pat) + '$');
        const op = mm[1];
        if (op === '#' || op === '##') {
          const lens = [];
          for (let k = 0; k <= val.length; k++) lens.push(k);
          if (op === '##') lens.reverse();
          for (const k of lens) if (re.test(val.slice(0, k))) return val.slice(k);
          return val;
        }
        const lens = [];
        for (let k = val.length; k >= 0; k--) lens.push(k);
        if (op === '%%') lens.reverse();
        for (const k of lens) if (re.test(val.slice(k))) return val.slice(0, k);
        return val;
      }
      if ((mm = rest.match(/^\/(\/?)((?:\\.|[^/])*)(?:\/([\s\S]*))?$/))) {
        const all = mm[1] === '/';
        const pat = await this.expandStr(mm[2]);
        const rep = mm[3] !== undefined ? await this.expandStr(mm[3]) : '';
        const re = new RegExp(U.globSrc(pat).replace(/\[\^\]\*/g, '[^]*?'), all ? 'g' : '');
        return val.replace(re, () => rep);
      }
      if ((mm = rest.match(/^:(-?\s*\d+)(?::(-?\d+))?$/))) {
        let off = parseInt(mm[1], 10);
        if (off < 0) off = Math.max(0, val.length + off);
        if (mm[2] === undefined) return val.slice(off);
        let len = parseInt(mm[2], 10);
        return len < 0 ? val.slice(off, val.length + len) : val.slice(off, off + len);
      }
      if (rest === '^^') return val.toUpperCase();
      if (rest === ',,') return val.toLowerCase();
      if (rest === '^') return val.charAt(0).toUpperCase() + val.slice(1);
      if (rest === ',') return val.charAt(0).toLowerCase() + val.slice(1);
      throw new Error(`\${${inner}}: bad substitution`);
    }

    async expandHeredoc(body) {
      let out = '';
      for (let i = 0; i < body.length; i++) {
        const c = body[i];
        if (c === '\\' && '$`\\'.includes(body[i + 1])) { out += body[i + 1]; i++; continue; }
        if (c === '\\' && body[i + 1] === '\n') { i++; continue; }
        if (c === '$') {
          const r = await this.expandDollar(body, i);
          if (r) { out += r.val; i = r.end - 1; continue; }
        }
        if (c === '`') {
          let j = i + 1;
          while (j < body.length && body[j] !== '`') j++;
          out += await this.commandSubst(body.slice(i + 1, j));
          i = j;
          continue;
        }
        out += c;
      }
      return out;
    }

    async commandSubst(src) {
      const sh = this.spawnChild({ script: false });
      const out = new BufWriter();
      const err = this.curIO ? this.curIO.err : this.ui.stderr;
      let st;
      try {
        const ast = LA.parse(src, this.aliasesEnabled ? this.aliases : null);
        st = await sh.execList(ast, { stdin: null, out, err });
      } catch (e) {
        if (e instanceof ExitSignal) st = e.code;
        else if (e instanceof Interrupt) throw e;
        else { err.write(`bash: ${e.incomplete ? 'unexpected EOF while looking for matching `)\'' : e.message}\n`); st = 2; }
      }
      this.substStatus = st;
      this.lastStatus = st;
      return out.buf.replace(/\n+$/, '');
    }

    glob(f) {
      const s = f.s, g = f.g;
      const segs = [];
      let cs = '', cg = [];
      for (let k = 0; k < s.length; k++) {
        if (s[k] === '/') { segs.push({ s: cs, g: cg }); cs = ''; cg = []; }
        else { cs += s[k]; cg.push(g[k]); }
      }
      segs.push({ s: cs, g: cg });
      const absolute = s.startsWith('/');
      let results = [absolute ? '/' : ''];
      let trailing = false;
      const join = (a, b) => (a === '' ? b : a.endsWith('/') ? a + b : a + '/' + b);
      for (let k = absolute ? 1 : 0; k < segs.length; k++) {
        const seg = segs[k];
        if (seg.s === '') { if (k === segs.length - 1) trailing = true; continue; }
        const isGlob = seg.g.some((x, idx) => x && '*?['.includes(seg.s[idx]));
        const next = [];
        for (const r of results) {
          if (!isGlob) { next.push(join(r, seg.s)); continue; }
          const dirPath = VFS.normalize(r || '.', this.cwd);
          let entries;
          try { entries = this.fs.readdir(dirPath, this.user); } catch (e) { continue; }
          let re;
          try { re = new RegExp('^' + U.globSrc(seg.s, seg.g) + '$'); } catch (e) { continue; }
          for (const [name] of entries) {
            if (name.startsWith('.') && seg.s[0] !== '.') continue;
            if (re.test(name)) next.push(join(r, name));
          }
        }
        results = next;
        if (!results.length) break;
      }
      results = results.filter((r) => {
        const node = this.fs.tryGet(VFS.normalize(r, this.cwd), this.user, true) || this.fs.tryGet(VFS.normalize(r, this.cwd), this.user, false);
        if (!node) return false;
        if (trailing) return node.type === 'dir';
        return true;
      });
      if (trailing) results = results.map((r) => r + '/');
      return results.sort();
    }

    /* ---- redirection ---- */
    openWriter(path, append, user) {
      const abs = VFS.normalize(path, this.cwd);
      if (abs === '/dev/null') return new NullWriter();
      if (abs === '/dev/stdout' && this.curIO) return this.curIO.out;
      if (abs === '/dev/stderr' && this.curIO) return this.curIO.err;
      if (abs === '/dev/tty') return this.ui.stdout;
      const node = this.fs.tryGet(abs, user);
      if (node && node.special) return new NullWriter();
      if (this.noclobber && !append && node) throw new LA.FsError('cannot overwrite existing file');
      this.fs.writeFile(abs, '', { user, append: true, umask: this.umask });
      if (!append) this.fs.writeFile(abs, '', { user, umask: this.umask });
      const fs = this.fs;
      const w = {
        buf: '',
        write(s) { this.buf += s; },
        flush() { if (this.buf) { try { fs.writeFile(abs, this.buf, { user: 'root', append: true }); } catch (e) { /* vanished */ } this.buf = ''; } },
      };
      this.recRoot.wroteFiles = (this.recRoot.wroteFiles || []).concat(abs);
      return w;
    }

    async redirect(redirs, io, user = this.user) {
      let stdin = io.stdin, out = io.out, err = io.err;
      const pending = [];
      const finish = async () => { for (const w of pending) w.flush(); };
      for (const r of redirs) {
        const fd = r.fd != null ? r.fd : r.op.startsWith('<') ? 0 : 1;
        if (r.op === '<<') { stdin = new InStream(r.hd.quoted ? r.hd.body : await this.expandHeredoc(r.hd.body)); continue; }
        let target;
        try { target = await this.expandStr(r.target); }
        catch (e) { if (e instanceof Interrupt) throw e; io.err.write(`bash: ${e.message}\n`); return { error: true }; }
        if (r.op === '<<<') { stdin = new InStream(target + '\n'); continue; }
        if (r.op === '>&' || r.op === '<&') {
          if (/^\d+$/.test(target)) {
            const src = target === '1' ? out : target === '2' ? err : null;
            if (!src) { io.err.write(`bash: ${target}: Bad file descriptor\n`); return { error: true }; }
            if (fd === 1) out = src; else if (fd === 2) err = src;
            continue;
          }
          if (target === '-') { if (fd === 1) out = new NullWriter(); else if (fd === 2) err = new NullWriter(); continue; }
        }
        if (r.op === '<') {
          const abs = VFS.normalize(target, this.cwd);
          try { stdin = new InStream(this.fs.readFile(abs, user)); }
          catch (e) { io.err.write(`bash: ${target}: ${e.message}\n`); return { error: true }; }
          continue;
        }
        const append = r.op === '>>' || r.op === '&>>';
        let w;
        try { w = this.openWriter(target, append, user); }
        catch (e) { io.err.write(`bash: ${target}: ${e.message}\n`); await finish(); return { error: true }; }
        if (w.flush) pending.push(w);
        if (r.op === '&>' || r.op === '&>>' || (r.op === '>&' && !/^\d+$/.test(target))) { out = w; err = w; }
        else if (fd === 1) out = w;
        else if (fd === 2) err = w;
      }
      return { io: { stdin, out, err }, finish };
    }

    /* ---- command lookup & dispatch ---- */
    findExecutable(name, user = this.user, path) {
      if (name.includes('/')) {
        const abs = VFS.normalize(name, this.cwd);
        let node;
        try { node = this.fs.get(abs, user, true); }
        catch (e) { return { error: e.message, code: e.code === 'EACCES' ? 126 : 127 }; }
        if (node.type === 'dir') return { error: 'Is a directory', code: 126 };
        if (!this.fs.can(node, user, 1)) return { error: 'Permission denied', code: 126 };
        return { path: abs, node };
      }
      const P = path !== undefined ? path : this.getVar('PATH') || '';
      let denied = null;
      for (let dir of P.split(':')) {
        if (!dir) dir = '.';
        const abs = VFS.normalize(VFS.join(dir, name), this.cwd);
        let node;
        try { node = this.fs.get(abs, user, true); } catch (e) { continue; }
        if (node.type !== 'file') continue;
        if (!this.fs.can(node, user, 1)) { denied = abs; continue; }
        return { path: abs, node };
      }
      if (denied) return { error: 'Permission denied', code: 126 };
      return null;
    }

    async dispatch(argv, io, o = {}) {
      const name = argv[0];
      const user = o.user || this.user;
      if (!o.noFunc && Object.prototype.hasOwnProperty.call(this.functions, name)) {
        return this.callFunction(name, argv.slice(1), io, o);
      }
      if (!o.noBuiltin && LA.builtinNames.has(name)) {
        return this.runImpl(name, LA.commands[name], argv, io, o);
      }
      const securePath = o.sudo ? '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' : undefined;
      const found = this.findExecutable(name, user, securePath);
      if (!found) {
        const prefix = o.sudo ? 'sudo' : 'bash';
        if (this.game) {
          const msg = this.game.notFound(name, this, argv);
          if (msg) { io.err.write(msg); return 127; }
        }
        io.err.write(`${prefix}: ${name}: command not found\n`);
        return 127;
      }
      if (found.error) { io.err.write(`bash: ${name}: ${found.error}\n`); return found.code; }
      const node = found.node;
      if (node.format === 'elf') {
        const cmd = node.data && node.data.cmd;
        const impl = LA.commands[cmd];
        if (!impl) { io.err.write(`bash: ${name}: cannot execute binary file: Exec format error\n`); return 126; }
        return this.runImpl(cmd, impl, argv, io, Object.assign({}, o, { path: found.path }));
      }
      return this.runScriptFile(found.path, node, argv, io, o);
    }

    makeCtx(name, argv, io, o) {
      const sh = this;
      const user = o.user || this.user;
      const env = this.exportedEnv();
      if (o.env) Object.assign(env, o.env);
      return {
        name, argv, args: argv.slice(1), shell: sh, user, fs: sh.fs, host: sh.host, world: sh.world,
        ui: sh.ui, game: sh.game, stdin: io.stdin, out: io.out, err: io.err, io, signal: sh.signal,
        sudo: !!o.sudo, env, path: o.path,
        get cwd() { return sh.cwd; },
        get isTTY() { return !!io.out.isTTY; },
        get stdinTTY() { return io.stdin === null; },
        umask: sh.umask,
        abs: (p) => VFS.normalize(p, sh.cwd),
        print: (s) => io.out.write(s),
        println: (s = '') => io.out.write(s + '\n'),
        error: (m) => io.err.write(`${name}: ${m}\n`),
        readInput: async () => {
          if (io.stdin != null) return io.stdin.readAll();
          if (!sh.ui || !sh.ui.readEOF) return '';
          return await sh.ui.readEOF(sh.signal);
        },
        sleep: (ms) => sh.sleep(ms),
        exec: (argv2, io2, o2) => sh.dispatch(argv2, io2 || io, Object.assign({ user }, o2 || {})),
        noteRead: (abs) => { if (sh.game) sh.game.noteRead(abs, sh.host.name, user); },
      };
    }

    async runImpl(cmdName, impl, argv, io, o = {}) {
      if (this.game && !o.internal) {
        const lock = this.game.lockCheck(cmdName, this);
        if (lock) { io.err.write(lock); this.record({ name: cmdName, argv, status: 127, locked: true, sudo: !!o.sudo, user: o.user || this.user }); return 127; }
      }
      const ctx = this.makeCtx(argv[0], argv, io, o);
      ctx.cmd = cmdName;
      const outTee = new TeeWriter(io.out);
      const errTee = new TeeWriter(io.err);
      ctx.out = outTee;
      ctx.err = errTee;
      ctx.print = (s) => outTee.write(s);
      ctx.println = (s = '') => outTee.write(s + '\n');
      ctx.error = (m) => errTee.write(`${argv[0]}: ${m}\n`);
      const rec = { name: cmdName, argv, args: argv.slice(1), user: ctx.user, cwd: this.cwd, sudo: !!o.sudo, host: this.host.name, depth: this.depth, piped: io.stdin != null };
      let status;
      if (argv[1] === '--help' && !impl.builtin && !impl.ownHelp && LA.manHelp) {
        outTee.write(LA.manHelp(cmdName));
        status = 0;
      } else {
        try {
          status = await impl.run(ctx);
        } catch (e) {
          if (e instanceof ExitSignal || e instanceof ReturnSignal || e instanceof LoopSignal || e instanceof Interrupt) {
            rec.status = e instanceof ExitSignal ? e.code : 130;
            rec.out = U.stripAnsi(outTee.buf); rec.err = U.stripAnsi(errTee.buf);
            this.record(rec);
            throw e;
          }
          if (e instanceof LA.OptError) {
            errTee.write(`${argv[0]}: ${e.message}\nTry '${argv[0]} --help' for more information.\n`);
            status = impl.optStatus || 1;
          } else if (e instanceof LA.FsError) {
            errTee.write(`${argv[0]}: ${e.path ? e.path + ': ' : ''}${e.message}\n`);
            status = 1;
          } else {
            errTee.write(`${argv[0]}: ${e.message}\n`);
            if (typeof console !== 'undefined' && !(e && e.quiet)) console.error(e);
            status = 1;
          }
        }
      }
      status = status == null ? 0 : status | 0;
      if (this.signal.aborted && status === 0 && impl.interruptible) status = 130;
      rec.status = status;
      rec.out = U.stripAnsi(outTee.buf);
      rec.err = U.stripAnsi(errTee.buf);
      this.record(rec);
      return status;
    }

    record(rec) {
      const root = this.recRoot;
      if (root.recs.length < 400) root.recs.push(rec);
    }

    async callFunction(name, args, io) {
      const saved = this.positional;
      this.positional = args;
      this.localStack.push(new Map());
      try {
        return await this.exec(this.functions[name], io);
      } catch (e) {
        if (e instanceof ReturnSignal) return e.code;
        throw e;
      } finally {
        this.positional = saved;
        const locals = this.localStack.pop();
        for (const [k, v] of locals) { if (v === undefined) this.vars.delete(k); else this.vars.set(k, v); }
      }
    }

    spawnChild(o = {}) {
      const sh = new Shell({
        host: this.host, user: o.user || this.user, ui: this.ui, game: this.game, world: this.world,
        cwd: this.cwd, interactive: false, parent: this, depth: this.depth + 1, signal: this.signal,
        recRoot: this.recRoot, initEnv: false, pid: this.world ? this.world.peekPid() : 4000, scriptName: o.scriptName || this.scriptName,
      });
      sh.umask = this.umask;
      if (o.script) {
        for (const [k, v] of this.vars) if (v.x) sh.vars.set(k, { v: v.v, x: true });
        if (o.user && o.user !== this.user) sh.initEnv();
        sh.setVar('PWD', this.cwd, true);
      } else {
        for (const [k, v] of this.vars) sh.vars.set(k, Object.assign({}, v));
        Object.assign(sh.functions, this.functions);
        Object.assign(sh.aliases, this.aliases);
        sh.positional = this.positional.slice();
        sh.lastStatus = this.lastStatus;
      }
      sh.jobs = this.jobs;
      return sh;
    }

    async runScriptFile(path, node, argv, io, o = {}) {
      const user = o.user || this.user;
      if (!this.fs.can(node, user, 4)) { io.err.write(`bash: ${argv[0]}: Permission denied\n`); return 126; }
      const content = this.fs.contentOf(node);
      const m = content.match(/^#!\s*(\S+)(?:\s+(\S+))?/);
      if (m) {
        let interp = VFS.basename(m[1]);
        if (interp === 'env' && m[2]) interp = m[2];
        if (!['bash', 'sh', 'dash', 'zsh'].includes(interp)) {
          io.err.write(`bash: ${argv[0]}: ${m[1]}: bad interpreter: No such file or directory\n`);
          return 126;
        }
      }
      if (this.game) this.game.noteScript(path, this);
      return this.runScript(content, argv[0], argv.slice(1), io, o);
    }

    async runScript(src, name, args, io, o = {}) {
      const sh = this.spawnChild({ script: true, user: o.user, scriptName: name });
      sh.positional = args;
      if (o.env) for (const [k, v] of Object.entries(o.env)) sh.setVar(k, v, true);
      let ast;
      try { ast = LA.parse(src, null); }
      catch (e) {
        io.err.write(`${name}: ${e.incomplete ? 'syntax error: unexpected end of file' : e.message}\n`);
        return 2;
      }
      try { return await sh.execList(ast, io); }
      catch (e) { if (e instanceof ExitSignal) return e.code; throw e; }
    }

    async source(src, name, args, io) {
      let ast;
      try { ast = LA.parse(src, this.aliases); }
      catch (e) {
        io.err.write(`bash: ${name}: ${e.incomplete ? 'syntax error: unexpected end of file' : e.message}\n`);
        return 2;
      }
      const saved = this.positional;
      if (args && args.length) this.positional = args;
      try { return await this.execList(ast, io); }
      catch (e) { if (e instanceof ReturnSignal) return e.code; throw e; }
      finally { this.positional = saved; }
    }

    /* ---- jobs ---- */
    startJob(node, io) {
      const id = this.nextJob++;
      const child = this.spawnChild({ script: false });
      child.signal = new Signal();
      const text = unparse(node);
      const job = {};
      const firstWord = node.type === 'simple' ? node.words[0] : (text.split(' ')[0] || 'bash');
      const pid = this.world ? this.world.spawn({ user: this.user, comm: VFS.basename(firstWord || 'bash'), args: text, tty: this.tty, host: this.host.name, ppid: this.pid, job: true, abort: () => { job.state = 'Terminated'; child.signal.abort(); } }) : 5000 + id;
      job.id = id; job.pid = pid; job.text = text; job.state = 'Running'; job.child = child; job.code = null;
      const outIO = { stdin: new InStream(''), out: io.out, err: io.err };
      job.promise = (async () => {
        try { job.code = await child.exec(node, outIO); }
        catch (e) { job.code = e instanceof ExitSignal ? e.code : 130; }
        if (this.world) this.world.reap(pid);
        if (job.state === 'Running') job.state = child.signal.aborted ? 'Terminated' : job.code === 0 ? 'Done' : `Exit ${job.code}`;
        const idx = this.jobs.indexOf(job);
        if (idx >= 0) {
          this.jobs.splice(idx, 1);
          if (!job.foreground) this.jobNotices.push(`[${job.id}]+  ${U.padR(job.state, 23)} ${job.text}`);
        }
        if (!this.jobs.length) this.nextJob = 1;
        return job.code;
      })();
      this.jobs.push(job);
      this.lastBg = pid;
      if (this.interactive) io.err.write(`[${id}] ${pid}\n`);
      return job;
    }

    findJob(spec) {
      if (!this.jobs.length) return null;
      if (!spec || spec === '%' || spec === '%%' || spec === '%+') return this.jobs[this.jobs.length - 1];
      if (spec === '%-') return this.jobs[this.jobs.length - 2] || null;
      const n = parseInt(spec.replace(/^%/, ''), 10);
      if (!isNaN(n)) return this.jobs.find((j) => j.id === n) || null;
      const pre = spec.replace(/^%/, '');
      return this.jobs.find((j) => j.text.startsWith(pre)) || null;
    }
  }

  LA.Shell = Shell;
})();
