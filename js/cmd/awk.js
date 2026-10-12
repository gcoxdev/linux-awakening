/* Linux Awakening — a compact but genuine awk interpreter. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const U = LA.util;

  class AwkErr extends Error {}
  class SN { constructor(s) { this.s = s; } toString() { return this.s; } }

  const KEYWORDS = new Set(['BEGIN', 'END', 'function', 'func', 'if', 'else', 'while', 'for', 'do', 'break', 'continue', 'next', 'nextfile', 'exit', 'return', 'delete', 'in', 'getline', 'print', 'printf']);
  const BUILTINS = new Set(['length', 'substr', 'index', 'split', 'sub', 'gsub', 'match', 'sprintf', 'sin', 'cos', 'atan2', 'exp', 'log', 'sqrt', 'int', 'rand', 'srand', 'tolower', 'toupper', 'system', 'close', 'fflush']);
  const OPS = ['**=', '+=', '-=', '*=', '/=', '%=', '^=', '**', '==', '<=', '>=', '!=', '++', '--', '&&', '||', '>>', '!~', '{', '}', '(', ')', '[', ']', ';', ',', '+', '-', '*', '/', '%', '^', '!', '>', '<', '|', '?', ':', '~', '$', '='];

  function lex(src) {
    const toks = [];
    let i = 0;
    const n = src.length;
    const regexOk = () => {
      const t = toks[toks.length - 1];
      if (!t) return true;
      if (t.t === 'num' || t.t === 'str' || t.t === 'name' || t.t === 'builtin' || t.t === 'ere') return false;
      if (t.t === 'op' && (t.v === ')' || t.v === ']' || t.v === '$' || t.v === '++' || t.v === '--')) return false;
      if (t.t === 'kw' && t.v === 'getline') return false;
      return true;
    };
    while (i < n) {
      const c = src[i];
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '\\' && src[i + 1] === '\n') { i += 2; continue; }
      if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '\n') { toks.push({ t: 'nl' }); i++; continue; }
      if (c === '"') {
        let s = '';
        i++;
        while (i < n && src[i] !== '"') {
          if (src[i] === '\\' && i + 1 < n) {
            const e = src[++i];
            s += { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', '/': '/', a: '\x07', b: '\b', f: '\f', v: '\v' }[e] !== undefined ? { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', '/': '/', a: '\x07', b: '\b', f: '\f', v: '\v' }[e] : '\\' + e;
            i++;
            continue;
          }
          s += src[i++];
        }
        if (i >= n) throw new AwkErr('non-terminated string');
        i++;
        toks.push({ t: 'str', v: s });
        continue;
      }
      if (c === '/' && regexOk()) {
        let s = '';
        i++;
        let inBr = false;
        while (i < n && (src[i] !== '/' || inBr)) {
          if (src[i] === '\\' && i + 1 < n) { s += src[i] + src[i + 1]; i += 2; continue; }
          if (src[i] === '[') inBr = true;
          else if (src[i] === ']') inBr = false;
          if (src[i] === '\n') throw new AwkErr('non-terminated regular expression');
          s += src[i++];
        }
        i++;
        toks.push({ t: 'ere', v: s });
        continue;
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        const m = src.slice(i).match(/^(0[xX][0-9a-fA-F]+|\d*\.?\d+(?:[eE][+-]?\d+)?|\d+\.)/);
        if (m) { toks.push({ t: 'num', v: Number(m[0]) }); i += m[0].length; continue; }
      }
      if (/[A-Za-z_]/.test(c)) {
        let j = i;
        while (j < n && /\w/.test(src[j])) j++;
        const w = src.slice(i, j);
        i = j;
        if (KEYWORDS.has(w)) toks.push({ t: 'kw', v: w === 'func' ? 'function' : w });
        else if (BUILTINS.has(w)) toks.push({ t: 'builtin', v: w });
        else toks.push({ t: 'name', v: w, call: src[i] === '(' });
        continue;
      }
      const op = OPS.find((o) => src.startsWith(o, i));
      if (!op) throw new AwkErr(`syntax error at source line 1: unexpected character '${c}'`);
      toks.push({ t: 'op', v: op });
      i += op.length;
    }
    toks.push({ t: 'eof' });
    return toks;
  }

  function parse(src) {
    const toks = lex(src);
    let p = 0;
    const peek = (k = 0) => toks[p + k];
    const isOp = (v, k = 0) => peek(k).t === 'op' && peek(k).v === v;
    const isKw = (v) => peek().t === 'kw' && peek().v === v;
    const fail = () => {
      const t = peek();
      throw new AwkErr(`syntax error at source line 1 near ${t.t === 'eof' ? 'end of program' : t.t === 'nl' ? 'newline' : '`' + t.v + "'"}`);
    };
    const expectOp = (v) => { if (!isOp(v)) fail(); p++; };
    const optNl = () => { while (peek().t === 'nl') p++; };
    const skipTerms = () => { while (peek().t === 'nl' || isOp(';')) p++; };

    function program() {
      const items = [];
      const funcs = {};
      skipTerms();
      while (peek().t !== 'eof') {
        if (isKw('function')) {
          p++;
          const name = peek().v;
          p++;
          expectOp('(');
          const params = [];
          while (!isOp(')')) { params.push(peek().v); p++; if (isOp(',')) { p++; optNl(); } }
          p++;
          optNl();
          funcs[name] = { params, body: block() };
        } else if (isKw('BEGIN')) { p++; optNl(); items.push({ kind: 'BEGIN', body: block() }); }
        else if (isKw('END')) { p++; optNl(); items.push({ kind: 'END', body: block() }); }
        else {
          let pat = null, pat2 = null;
          if (!isOp('{')) {
            pat = expr();
            if (isOp(',')) { p++; optNl(); pat2 = expr(); }
          }
          const body = isOp('{') ? block() : null;
          items.push({ kind: 'main', pat, pat2, body });
        }
        skipTerms();
      }
      return { items, funcs };
    }
    function block() {
      expectOp('{');
      const stmts = [];
      skipTerms();
      while (!isOp('}')) {
        if (peek().t === 'eof') fail();
        stmts.push(stmt());
        skipTerms();
      }
      p++;
      return { k: 'block', stmts };
    }
    function simpleOrBlock() { optNl(); if (isOp(';')) { p++; return { k: 'block', stmts: [] }; } return stmt(); }
    function endStmt() {
      if (isOp(';') || peek().t === 'nl') { p++; return; }
      if (isOp('}') || peek().t === 'eof') return;
      fail();
    }
    function stmt() {
      const t = peek();
      if (isOp('{')) return block();
      if (t.t === 'kw') {
        switch (t.v) {
          case 'if': {
            p++; expectOp('('); const c = expr(); expectOp(')');
            const a = simpleOrBlock();
            const save = p;
            skipTerms();
            if (isKw('else')) { p++; const b = simpleOrBlock(); return { k: 'if', c, a, b }; }
            p = save;
            return { k: 'if', c, a, b: null };
          }
          case 'while': { p++; expectOp('('); const c = expr(); expectOp(')'); if (isOp(';')) { p++; return { k: 'while', c, body: { k: 'block', stmts: [] } }; } return { k: 'while', c, body: simpleOrBlock() }; }
          case 'do': { p++; const body = simpleOrBlock(); skipTerms(); if (!isKw('while')) fail(); p++; expectOp('('); const c = expr(); expectOp(')'); endStmt(); return { k: 'do', c, body }; }
          case 'for': {
            p++; expectOp('(');
            if (peek().t === 'name' && peek(1).t === 'kw' && peek(1).v === 'in' && peek(2).t === 'name' && peek(3).t === 'op' && peek(3).v === ')') {
              const v = peek().v, arr = peek(2).v;
              p += 4;
              return { k: 'forin', v, arr, body: simpleOrBlock() };
            }
            const init = isOp(';') ? null : simpleStmt();
            expectOp(';'); optNl();
            const c = isOp(';') ? null : expr();
            expectOp(';'); optNl();
            const inc = isOp(')') ? null : simpleStmt();
            expectOp(')');
            if (isOp(';')) { p++; return { k: 'for', init, c, inc, body: { k: 'block', stmts: [] } }; }
            return { k: 'for', init, c, inc, body: simpleOrBlock() };
          }
          case 'next': p++; endStmt(); return { k: 'next' };
          case 'nextfile': p++; endStmt(); return { k: 'next' };
          case 'break': p++; endStmt(); return { k: 'break' };
          case 'continue': p++; endStmt(); return { k: 'continue' };
          case 'exit': { p++; const e = isOp(';') || isOp('}') || peek().t === 'nl' || peek().t === 'eof' ? null : expr(); endStmt(); return { k: 'exit', e }; }
          case 'return': { p++; const e = isOp(';') || isOp('}') || peek().t === 'nl' ? null : expr(); endStmt(); return { k: 'return', e }; }
          case 'delete': {
            p++;
            const name = peek().v; p++;
            let subs = null;
            if (isOp('[')) { p++; subs = exprList(); expectOp(']'); }
            endStmt();
            return { k: 'delete', name, subs };
          }
        }
      }
      const s = simpleStmt();
      endStmt();
      return s;
    }
    function simpleStmt() {
      if (isKw('print') || isKw('printf')) {
        const kind = peek().v;
        p++;
        let args = [];
        if (!(isOp(';') || isOp('}') || isOp('>') || isOp('>>') || isOp('|') || peek().t === 'nl' || peek().t === 'eof')) {
          if (isOp('(')) {
            const save = p;
            p++;
            const list = exprList();
            if (isOp(')') && (peek(1).t === 'nl' || peek(1).t === 'eof' || (peek(1).t === 'op' && [';', '}', '>', '>>', '|'].includes(peek(1).v)))) { p++; args = list; }
            else { p = save; args = exprList(true); }
          } else args = exprList(true);
        }
        let redir = null;
        if (isOp('>') || isOp('>>') || isOp('|')) { const op = peek().v; p++; redir = { op, e: concat(true) }; }
        return { k: kind, args, redir };
      }
      return { k: 'expr', e: expr() };
    }
    function exprList(noGt) {
      const list = [expr(noGt)];
      while (isOp(',')) { p++; optNl(); list.push(expr(noGt)); }
      return list;
    }
    const LV = (e) => e.k === 'var' || e.k === 'idx' || e.k === 'field';
    function expr(noGt) { return ternary(noGt); }
    function ternary(noGt) {
      const c = orE(noGt);
      if (isOp('?')) {
        p++; optNl();
        const a = ternary(noGt);
        optNl(); expectOp(':'); optNl();
        const b = ternary(noGt);
        return { k: 'tern', c, a, b };
      }
      if (peek().t === 'op' && ['=', '+=', '-=', '*=', '/=', '%=', '^=', '**='].includes(peek().v) && LV(c)) {
        const op = peek().v;
        p++; optNl();
        return { k: 'assign', op, lv: c, e: ternary(noGt) };
      }
      return c;
    }
    function orE(noGt) { let a = andE(noGt); while (isOp('||')) { p++; optNl(); a = { k: 'or', a, b: andE(noGt) }; } return a; }
    function andE(noGt) { let a = inE(noGt); while (isOp('&&')) { p++; optNl(); a = { k: 'and', a, b: inE(noGt) }; } return a; }
    function inE(noGt) {
      let a = matchE(noGt);
      while (isKw('in')) { p++; const arr = peek().v; p++; a = { k: 'in', key: [a], arr }; }
      return a;
    }
    function matchE(noGt) {
      let a = rel(noGt);
      while (isOp('~') || isOp('!~')) { const neg = peek().v === '!~'; p++; a = { k: 'match', neg, a, re: rel(noGt) }; }
      return a;
    }
    function rel(noGt) {
      const a = concat(noGt);
      const t = peek();
      if (t.t === 'op' && ['<', '<=', '==', '!=', '>=', '>'].includes(t.v) && !(noGt && t.v === '>')) {
        p++;
        return { k: 'cmp', op: t.v, a, b: concat(noGt) };
      }
      return a;
    }
    const startsPrimary = () => {
      const t = peek();
      if (t.t === 'num' || t.t === 'str' || t.t === 'ere' || t.t === 'name' || t.t === 'builtin') return true;
      if (t.t === 'op' && (t.v === '$' || t.v === '(' || t.v === '!' || t.v === '++' || t.v === '--' || t.v === '-')) return t.v !== '-' ? true : false;
      return false;
    };
    function concat(noGt) {
      let a = additive();
      while (startsPrimary() && !(isKw('in'))) a = { k: 'cat', a, b: additive() };
      return a;
    }
    function additive() {
      let a = mul();
      while (isOp('+') || isOp('-')) { const op = peek().v; p++; a = { k: 'bin', op, a, b: mul() }; }
      return a;
    }
    function mul() {
      let a = unary();
      while (isOp('*') || isOp('/') || isOp('%')) { const op = peek().v; p++; a = { k: 'bin', op, a, b: unary() }; }
      return a;
    }
    function unary() {
      if (isOp('!')) { p++; return { k: 'not', a: unary() }; }
      if (isOp('-')) { p++; return { k: 'neg', a: unary() }; }
      if (isOp('+')) { p++; return { k: 'pos', a: unary() }; }
      return pow();
    }
    function pow() {
      const base = postfix();
      if (isOp('^') || isOp('**')) { p++; return { k: 'bin', op: '^', a: base, b: unaryPow() }; }
      return base;
    }
    function unaryPow() {
      if (isOp('-')) { p++; return { k: 'neg', a: unaryPow() }; }
      if (isOp('+')) { p++; return unaryPow(); }
      return pow();
    }
    function postfix() {
      if (isOp('++') || isOp('--')) { const op = peek().v; p++; const lv = postfix(); return { k: 'preinc', op, lv }; }
      const e = primary();
      if (LV(e) && (isOp('++') || isOp('--'))) { const op = peek().v; p++; return { k: 'postinc', op, lv: e }; }
      return e;
    }
    function primary() {
      const t = peek();
      if (t.t === 'num') { p++; return { k: 'num', v: t.v }; }
      if (t.t === 'str') { p++; return { k: 'str', v: t.v }; }
      if (t.t === 'ere') { p++; return { k: 're', v: t.v }; }
      if (isOp('$')) {
        p++;
        let e;
        if (isOp('++') || isOp('--')) { const op = peek().v; p++; e = { k: 'preinc', op, lv: primary() }; }
        else if (isOp('-')) { p++; e = { k: 'neg', a: primary() }; }
        else e = primary();
        return { k: 'field', e };
      }
      if (isOp('(')) {
        p++;
        const e = expr();
        if (isOp(',')) {
          const list = [e];
          while (isOp(',')) { p++; list.push(expr()); }
          expectOp(')');
          if (isKw('in')) { p++; const arr = peek().v; p++; return { k: 'in', key: list, arr }; }
          fail();
        }
        expectOp(')');
        return { k: 'group', e };
      }
      if (t.t === 'builtin') {
        p++;
        if (t.v === 'length' && !isOp('(')) return { k: 'call', name: 'length', args: [] };
        expectOp('(');
        const args = isOp(')') ? [] : exprList();
        expectOp(')');
        return { k: 'call', name: t.v, args };
      }
      if (t.t === 'name') {
        p++;
        if (t.call && isOp('(')) {
          p++;
          const args = isOp(')') ? [] : exprList();
          expectOp(')');
          return { k: 'ucall', name: t.v, args };
        }
        if (isOp('[')) { p++; const subs = exprList(); expectOp(']'); return { k: 'idx', name: t.v, subs }; }
        return { k: 'var', name: t.v };
      }
      if (isKw('getline')) throw new AwkErr('getline is not supported in this awk');
      fail();
    }
    return program();
  }

  /* ---------- runtime ---------- */
  class Next {}
  class Exit { constructor(c) { this.code = c; } }
  class Brk {}
  class Cont {}
  class Ret { constructor(v) { this.v = v; } }

  const numRe = /^\s*[+-]?(?:\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)/;
  const looksNum = (s) => /^\s*[+-]?(?:\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)\s*$/.test(s);

  async function runAwk(ctx, progSrc, files, assigns, fs) {
    const prog = parse(progSrc);
    const G = new Map();
    const set = (k, v) => G.set(k, v);
    const env = new Map(Object.entries(ctx.env).map(([k, v]) => [k, new SN(v)]));
    set('FS', fs !== undefined ? fs : ' ');
    set('OFS', ' '); set('ORS', '\n'); set('RS', '\n'); set('NR', 0); set('NF', 0); set('FNR', 0);
    set('SUBSEP', '\x1c'); set('CONVFMT', '%.6g'); set('OFMT', '%.6g'); set('RSTART', 0); set('RLENGTH', -1); set('FILENAME', '');
    set('ENVIRON', env);
    for (const [k, v] of assigns) set(k, new SN(U.unescape(v)));

    const toNum = (v) => {
      if (typeof v === 'number') return v;
      if (v === undefined) return 0;
      const s = v instanceof SN ? v.s : String(v);
      const m = s.match(numRe);
      return m ? parseFloat(m[0]) : 0;
    };
    const numStr = (n, fmt) => (Number.isInteger(n) ? String(n) : U.sprintf(fmt, [n]).out);
    const toStr = (v, fmt) => {
      if (v === undefined) return '';
      if (typeof v === 'number') return numStr(v, fmt || G.get('CONVFMT'));
      if (v instanceof SN) return v.s;
      if (v instanceof Map) throw new AwkErr("attempt to use array in a scalar context");
      return String(v);
    };
    const truthy = (v) => {
      if (typeof v === 'number') return v !== 0;
      if (v === undefined) return false;
      if (v instanceof SN) return looksNum(v.s) ? toNum(v) !== 0 : v.s !== '';
      return v !== '';
    };
    const reCache = new Map();
    const toRe = (v, flags = '') => {
      const src = v && v.k === 're' ? v.v : toStr(v);
      const key = src + '\u0000' + flags;
      if (!reCache.has(key)) {
        try { reCache.set(key, new RegExp(U.reToJs(src, true), flags)); }
        catch (e) { throw new AwkErr(`regular expression is invalid: /${src}/`); }
      }
      const r = reCache.get(key);
      r.lastIndex = 0;
      return r;
    };

    let record = '';
    let fields = null;
    let nf = 0;
    const splitRecord = (s) => {
      const FS = toStr(G.get('FS'));
      if (s === '') return [];
      if (FS === ' ') return s.trim() === '' ? [] : s.trim().split(/[ \t\n]+/);
      if (FS.length === 1 && FS !== '\\') return s.split(FS);
      return s.split(toRe(FS));
    };
    const setRecord = (s) => { record = s; fields = splitRecord(s); nf = fields.length; G.set('NF', nf); };
    const rebuild = () => { record = fields.slice(0, nf).map((f) => (f === undefined ? '' : f)).join(toStr(G.get('OFS'))); };
    const getField = (i) => {
      if (i < 0) throw new AwkErr(`trying to access out of range field ${i}`);
      if (i === 0) return new SN(record);
      return i <= nf ? new SN(fields[i - 1] === undefined ? '' : fields[i - 1]) : new SN('');
    };
    const setField = (i, v) => {
      const s = toStr(v);
      if (i === 0) { setRecord(s); return; }
      while (fields.length < i) fields.push('');
      fields[i - 1] = s;
      if (i > nf) { nf = i; G.set('NF', nf); }
      rebuild();
    };

    const outputs = new Map();
    const pipes = new Map();
    const emit = async (text, redir) => {
      if (!redir) { ctx.print(text); return; }
      const target = toStr(await ev(redir.e));
      if (redir.op === '|') { pipes.set(target, (pipes.get(target) || '') + text); return; }
      if (!outputs.has(target)) {
        const abs = ctx.abs(target);
        try { ctx.fs.writeFile(abs, '', { user: ctx.user, append: redir.op === '>>', umask: ctx.shell.umask }); }
        catch (e) { throw new AwkErr(`can't redirect to ${target} (${e.message})`); }
        outputs.set(target, abs);
      }
      ctx.fs.writeFile(outputs.get(target), text, { user: 'root', append: true });
    };
    const runCommand = async (cmd, input) => {
      const sh = ctx.shell.spawnChild({ script: false });
      try {
        const ast = LA.parse(cmd, null);
        return await sh.execList(ast, { stdin: input === null ? null : new LA.InStream(input), out: ctx.out, err: ctx.err });
      } catch (e) {
        if (e instanceof LA.ExitSignal) return e.code;
        ctx.err.write(`sh: ${e.message}\n`);
        return 2;
      }
    };

    const frames = [];
    const lookupVar = (name) => {
      const f = frames[frames.length - 1];
      if (f && f.has(name)) return { scope: f };
      return { scope: G };
    };
    const getVar = (name) => {
      if (name === 'NF') return nf;
      const { scope } = lookupVar(name);
      return scope.get(name);
    };
    const setVar = (name, v) => {
      if (name === 'NF') { nf = Math.max(0, Math.trunc(toNum(v))); while (fields.length < nf) fields.push(''); fields.length = nf; G.set('NF', nf); rebuild(); return; }
      const { scope } = lookupVar(name);
      if (scope.get(name) instanceof Map) throw new AwkErr(`can't assign to ${name}; it's an array name.`);
      scope.set(name, v);
    };
    const getArr = (name) => {
      const { scope } = lookupVar(name);
      let a = scope.get(name);
      if (a === undefined) { a = new Map(); scope.set(name, a); }
      if (!(a instanceof Map)) throw new AwkErr(`can't use scalar ${name} as array`);
      return a;
    };
    const subKey = async (subs) => {
      const parts = [];
      for (const s of subs) parts.push(toStr(await ev(s)));
      return parts.join(toStr(G.get('SUBSEP')));
    };
    const getLv = async (lv) => {
      if (lv.k === 'var') return getVar(lv.name);
      if (lv.k === 'field') return getField(Math.trunc(toNum(await ev(lv.e))));
      const a = getArr(lv.name);
      const k = await subKey(lv.subs);
      if (!a.has(k)) a.set(k, undefined);
      return a.get(k);
    };
    const setLv = async (lv, v) => {
      if (lv.k === 'var') return setVar(lv.name, v);
      if (lv.k === 'field') return setField(Math.trunc(toNum(await ev(lv.e))), v);
      const a = getArr(lv.name);
      a.set(await subKey(lv.subs), v);
    };
    const compare = (a, b) => {
      const isNumish = (v) => typeof v === 'number' || v === undefined || (v instanceof SN && looksNum(v.s));
      if (isNumish(a) && isNumish(b)) { const x = toNum(a), y = toNum(b); return x < y ? -1 : x > y ? 1 : 0; }
      const x = toStr(a), y = toStr(b);
      return x < y ? -1 : x > y ? 1 : 0;
    };
    let ticks = 0;

    async function ev(e) {
      switch (e.k) {
        case 'num': return e.v;
        case 'str': return e.v;
        case 're': return toRe(e).test(record) ? 1 : 0;
        case 'group': return ev(e.e);
        case 'var': {
          const v = getVar(e.name);
          if (v instanceof Map) throw new AwkErr(`attempt to use array ${e.name} in a scalar context`);
          return v;
        }
        case 'field': return getField(Math.trunc(toNum(await ev(e.e))));
        case 'idx': return getLv(e);
        case 'assign': {
          let v = await ev(e.e);
          if (v instanceof SN) v = new SN(v.s);
          if (e.op !== '=') {
            const cur = toNum(await getLv(e.lv)), r = toNum(v);
            const op = e.op.slice(0, -1);
            v = op === '+' ? cur + r : op === '-' ? cur - r : op === '*' ? cur * r : op === '/' ? (r === 0 ? (() => { throw new AwkErr('division by zero in /='); })() : cur / r) : op === '%' ? cur % r : Math.pow(cur, r);
          }
          await setLv(e.lv, v);
          return v;
        }
        case 'tern': return truthy(await ev(e.c)) ? ev(e.a) : ev(e.b);
        case 'or': return truthy(await ev(e.a)) || truthy(await ev(e.b)) ? 1 : 0;
        case 'and': return truthy(await ev(e.a)) && truthy(await ev(e.b)) ? 1 : 0;
        case 'in': { const a = getArr(e.arr); return a.has(await subKey(e.key)) ? 1 : 0; }
        case 'match': {
          const s = toStr(await ev(e.a));
          const r = toRe(e.re.k === 're' ? e.re : await ev(e.re)).test(s);
          return r !== e.neg ? 1 : 0;
        }
        case 'cmp': {
          const c = compare(await ev(e.a), await ev(e.b));
          return { '<': c < 0, '<=': c <= 0, '==': c === 0, '!=': c !== 0, '>=': c >= 0, '>': c > 0 }[e.op] ? 1 : 0;
        }
        case 'cat': return toStr(await ev(e.a)) + toStr(await ev(e.b));
        case 'bin': {
          const a = toNum(await ev(e.a)), b = toNum(await ev(e.b));
          switch (e.op) {
            case '+': return a + b;
            case '-': return a - b;
            case '*': return a * b;
            case '/': if (b === 0) throw new AwkErr('division by zero'); return a / b;
            case '%': if (b === 0) throw new AwkErr('division by zero in %'); return a % b;
            case '^': return Math.pow(a, b);
          }
          return 0;
        }
        case 'not': return truthy(await ev(e.a)) ? 0 : 1;
        case 'neg': return -toNum(await ev(e.a));
        case 'pos': return toNum(await ev(e.a));
        case 'preinc': { const v = toNum(await getLv(e.lv)) + (e.op === '++' ? 1 : -1); await setLv(e.lv, v); return v; }
        case 'postinc': { const v = toNum(await getLv(e.lv)); await setLv(e.lv, v + (e.op === '++' ? 1 : -1)); return v; }
        case 'call': return callBuiltin(e);
        case 'ucall': return callUser(e);
      }
      throw new AwkErr('internal: bad node ' + e.k);
    }

    async function callBuiltin(e) {
      const a = e.args;
      const s0 = async (i) => toStr(await ev(a[i]));
      const n0 = async (i) => toNum(await ev(a[i]));
      switch (e.name) {
        case 'length': {
          if (!a.length) return record.length;
          if (a[0].k === 'var') { const v = getVar(a[0].name); if (v instanceof Map) return v.size; }
          return (await s0(0)).length;
        }
        case 'substr': {
          const s = await s0(0);
          let m = Math.round(await n0(1));
          let len = a.length > 2 ? Math.round(await n0(2)) : Infinity;
          let start = m;
          if (start < 1) { len += start - 1; start = 1; }
          if (len <= 0) return '';
          return s.substr(start - 1, len === Infinity ? undefined : len);
        }
        case 'index': { const s = await s0(0), t = await s0(1); return s.indexOf(t) + 1; }
        case 'split': {
          const s = await s0(0);
          const name = a[1].name;
          const arr = getArr(name);
          arr.clear();
          let parts;
          if (a.length > 2) {
            const sep = a[2].k === 're' ? a[2] : await ev(a[2]);
            const ss = sep && sep.k === 're' ? null : toStr(sep);
            if (ss === ' ') parts = s.trim() === '' ? [] : s.trim().split(/[ \t\n]+/);
            else if (ss !== null && ss.length === 1) parts = s === '' ? [] : s.split(ss);
            else parts = s === '' ? [] : s.split(toRe(sep));
          } else parts = splitRecord(s);
          parts.forEach((x, i) => arr.set(String(i + 1), new SN(x)));
          return parts.length;
        }
        case 'sub': case 'gsub': {
          const re = toRe(a[0].k === 're' ? a[0] : await ev(a[0]), e.name === 'gsub' ? 'g' : '');
          const rep = await s0(1);
          const lv = a[2] || { k: 'field', e: { k: 'num', v: 0 } };
          const target = toStr(await getLv(lv));
          let count = 0;
          const out = target.replace(re, (m) => {
            count++;
            let r = '';
            for (let k = 0; k < rep.length; k++) {
              if (rep[k] === '\\' && rep[k + 1] === '&') { r += '&'; k++; }
              else if (rep[k] === '&') r += m;
              else r += rep[k];
            }
            return r;
          });
          if (count) await setLv(lv, out);
          return count;
        }
        case 'match': {
          const s = await s0(0);
          const m = s.match(toRe(a[1].k === 're' ? a[1] : await ev(a[1])));
          if (m) { G.set('RSTART', m.index + 1); G.set('RLENGTH', m[0].length); return m.index + 1; }
          G.set('RSTART', 0); G.set('RLENGTH', -1);
          return 0;
        }
        case 'sprintf': {
          const vals = [];
          for (let i = 1; i < a.length; i++) { const v = await ev(a[i]); vals.push(typeof v === 'number' ? v : toStr(v)); }
          return U.sprintf(await s0(0), vals).out;
        }
        case 'tolower': return (await s0(0)).toLowerCase();
        case 'toupper': return (await s0(0)).toUpperCase();
        case 'int': return Math.trunc(await n0(0));
        case 'sqrt': return Math.sqrt(await n0(0));
        case 'exp': return Math.exp(await n0(0));
        case 'log': return Math.log(await n0(0));
        case 'sin': return Math.sin(await n0(0));
        case 'cos': return Math.cos(await n0(0));
        case 'atan2': return Math.atan2(await n0(0), await n0(1));
        case 'rand': return Math.random();
        case 'srand': return 0;
        case 'system': return runCommand(await s0(0), null);
        case 'close': case 'fflush': {
          const t = a.length ? await s0(0) : '';
          if (pipes.has(t)) { const input = pipes.get(t); pipes.delete(t); return runCommand(t, input); }
          outputs.delete(t);
          return 0;
        }
      }
      return 0;
    }

    async function callUser(e) {
      const f = prog.funcs[e.name];
      if (!f) throw new AwkErr(`calling undefined function ${e.name}`);
      const frame = new Map();
      for (let i = 0; i < f.params.length; i++) {
        const name = f.params[i];
        if (i < e.args.length) {
          const arg = e.args[i];
          if (arg.k === 'var') {
            const v = getVar(arg.name);
            if (v instanceof Map) { frame.set(name, v); continue; }

          }
          frame.set(name, await ev(arg));
        } else frame.set(name, undefined);
      }
      if (frames.length > 200) throw new AwkErr('function call nesting too deep');
      frames.push(frame);
      try { await exec(f.body); return ''; }
      catch (x) { if (x instanceof Ret) return x.v; throw x; }
      finally { frames.pop(); }
    }

    async function exec(s) {
      if (++ticks % 200 === 0) await ctx.shell.tick();
      switch (s.k) {
        case 'block': for (const t of s.stmts) await exec(t); return;
        case 'expr': await ev(s.e); return;
        case 'print': {
          const ofs = toStr(G.get('OFS')), ors = toStr(G.get('ORS'));
          let text;
          if (!s.args.length) text = record;
          else {
            const parts = [];
            for (const a of s.args) { const v = await ev(a); parts.push(typeof v === 'number' ? numStr(v, toStr(G.get('OFMT'))) : toStr(v)); }
            text = parts.join(ofs);
          }
          await emit(text + ors, s.redir);
          return;
        }
        case 'printf': {
          if (!s.args.length) throw new AwkErr('printf: no format');
          const fmt = toStr(await ev(s.args[0]));
          const vals = [];
          for (let i = 1; i < s.args.length; i++) {
            const v = await ev(s.args[i]);
            vals.push(typeof v === 'number' ? v : toStr(v));
          }
          const fixed = fmt.replace(/%c/g, () => '%s');
          const vals2 = vals.map((v, i) => (/%c/.test(fmt) && typeof v === 'number' ? String.fromCharCode(v) : v));
          await emit(U.sprintf(fixed, vals2).out, s.redir);
          return;
        }
        case 'if': if (truthy(await ev(s.c))) await exec(s.a); else if (s.b) await exec(s.b); return;
        case 'while': {
          let guard = 0;
          while (truthy(await ev(s.c))) {
            if (++guard > 1000000) throw new AwkErr('loop limit exceeded');
            try { await exec(s.body); } catch (x) { if (x instanceof Brk) break; if (x instanceof Cont) continue; throw x; }
          }
          return;
        }
        case 'do': {
          let guard = 0;
          do {
            if (++guard > 1000000) throw new AwkErr('loop limit exceeded');
            try { await exec(s.body); } catch (x) { if (x instanceof Brk) break; if (x instanceof Cont) continue; throw x; }
          } while (truthy(await ev(s.c)));
          return;
        }
        case 'for': {
          let guard = 0;
          if (s.init) await exec(s.init);
          while (!s.c || truthy(await ev(s.c))) {
            if (++guard > 1000000) throw new AwkErr('loop limit exceeded');
            try { await exec(s.body); } catch (x) { if (x instanceof Brk) break; if (!(x instanceof Cont)) throw x; }
            if (s.inc) await exec(s.inc);
          }
          return;
        }
        case 'forin': {
          const arr = getArr(s.arr);
          for (const k of [...arr.keys()]) {
            if (!arr.has(k)) continue;
            setVar(s.v, new SN(k));
            try { await exec(s.body); } catch (x) { if (x instanceof Brk) break; if (x instanceof Cont) continue; throw x; }
          }
          return;
        }
        case 'next': throw new Next();
        case 'break': throw new Brk();
        case 'continue': throw new Cont();
        case 'exit': throw new Exit(s.e ? Math.trunc(toNum(await ev(s.e))) : 0);
        case 'return': throw new Ret(s.e ? await ev(s.e) : '');
        case 'delete': {
          const arr = getArr(s.name);
          if (!s.subs) arr.clear();
          else arr.delete(await subKey(s.subs));
          return;
        }
      }
    }

    let exitCode = 0;
    let exiting = false;
    const begins = prog.items.filter((i) => i.kind === 'BEGIN');
    const ends = prog.items.filter((i) => i.kind === 'END');
    const mains = prog.items.filter((i) => i.kind === 'main');
    const rangeState = new Map();
    setRecord('');
    try {
      for (const b of begins) await exec(b.body);
    } catch (x) {
      if (x instanceof Exit) { exitCode = x.code; exiting = true; }
      else if (x instanceof Next) { /* ignore */ } else throw x;
    }
    if (!exiting && (mains.length || ends.length)) {
      const inputs = files.length ? files : ['-'];
      outer: for (const f of inputs) {
        if (typeof f === 'object') { G.set(f.name, new SN(U.unescape(f.value))); continue; }
        const r = await LA.readArg(ctx, f);
        if (r.error) { ctx.err.write(`awk: cannot open "${f}" (${r.error})\n`); exitCode = 2; continue; }
        G.set('FILENAME', f === '-' ? '' : f);
        G.set('FNR', 0);
        const rs = toStr(G.get('RS'));
        let recs;
        if (rs === '') recs = r.text.split(/\n\s*\n+/).filter((x) => x.trim() !== '').map((x) => x.replace(/\n+$/, ''));
        else if (rs === '\n') recs = U.lines(r.text);
        else { recs = r.text.split(rs.length === 1 ? rs : toRe(rs)); if (recs[recs.length - 1].replace(/\n$/, '') === '') recs.pop(); }
        for (const rec of recs) {
          G.set('NR', toNum(G.get('NR')) + 1);
          G.set('FNR', toNum(G.get('FNR')) + 1);
          setRecord(rec);
          try {
            for (const it of mains) {
              let hit;
              if (!it.pat) hit = true;
              else if (it.pat2) {
                let st = rangeState.get(it) || false;
                if (!st) {
                  if (truthy(await ev(it.pat))) { hit = true; st = !truthy(await ev(it.pat2)); }
                  else hit = false;
                } else { hit = true; if (truthy(await ev(it.pat2))) st = false; }
                rangeState.set(it, st);
              } else hit = truthy(it.pat.k === 're' ? (toRe(it.pat).test(record) ? 1 : 0) : await ev(it.pat));
              if (!hit) continue;
              if (it.body) await exec(it.body);
              else ctx.print(record + toStr(G.get('ORS')));
            }
          } catch (x) {
            if (x instanceof Next) continue;
            if (x instanceof Exit) { exitCode = x.code; break outer; }
            throw x;
          }
        }
      }
    }
    try {
      for (const b of ends) await exec(b.body);
    } catch (x) {
      if (x instanceof Exit) exitCode = x.code;
      else throw x;
    }
    for (const [cmd, input] of pipes) await runCommand(cmd, input);
    return exitCode;
  }

  LA.def('awk', {
    async run(ctx) {
      const args = ctx.args;
      let fs;
      const assigns = [];
      let prog = null;
      let i = 0;
      for (; i < args.length; i++) {
        const a = args[i];
        if (a === '-F') { fs = args[++i]; continue; }
        if (a.startsWith('-F')) { fs = a.slice(2); continue; }
        if (a === '-v') { const m = (args[++i] || '').match(/^([A-Za-z_]\w*)=([\s\S]*)$/); if (!m) { ctx.err.write("awk: invalid -v argument\n"); return 2; } assigns.push([m[1], m[2]]); continue; }
        if (a === '-f') {
          const r = await LA.readArg(ctx, args[++i]);
          if (r.error) { ctx.err.write(`awk: can't open file ${args[i]}\n`); return 2; }
          prog = r.text;
          continue;
        }
        if (a === '--') { i++; break; }
        if (a.startsWith('-') && a.length > 1) { ctx.err.write(`awk: not an option: ${a}\n`); return 2; }
        break;
      }
      if (prog === null) {
        if (i >= args.length) { ctx.err.write("usage: awk [-F fs][-v var=value][-f progfile | 'prog'][file ...]\n"); return 2; }
        prog = args[i++];
      }
      if (fs !== undefined) fs = fs === 't' ? '\t' : U.unescape(fs);
      const files = args.slice(i).map((f) => { const m = f.match(/^([A-Za-z_]\w*)=([\s\S]*)$/); return m ? { name: m[1], value: m[2] } : f; });
      try {
        return await runAwk(ctx, prog, files, assigns, fs);
      } catch (e) {
        if (e instanceof AwkErr) {
          ctx.err.write(`awk: ${e.message}\n awk: cmd. line:1: ${prog.split('\n')[0].slice(0, 60)}\n`);
          return 2;
        }
        throw e;
      }
    },
  });
  LA.commands.gawk = LA.commands.awk;
})();
