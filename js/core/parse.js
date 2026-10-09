/* Linux Awakening — bash-like tokenizer and parser. */
(function () {
  'use strict';
  const LA = (globalThis.LA = globalThis.LA || {});

  class IncompleteError extends Error {
    constructor(m) { super(m || 'unexpected end of file'); this.incomplete = true; }
  }
  class ShSyntaxError extends Error {}
  LA.IncompleteError = IncompleteError;
  LA.ShSyntaxError = ShSyntaxError;

  const META = new Set([' ', '\t', '\n', '|', '&', ';', '(', ')', '<', '>']);
  const LIST_END = new Set(['then', 'elif', 'else', 'fi', 'do', 'done', '}', 'esac']);

  function tokenize(src) {
    const toks = [];
    const n = src.length;
    let i = 0;
    let pending = [];

    function skipDouble(j) {
      while (j < n) {
        const c = src[j];
        if (c === '\\') { j += 2; continue; }
        if (c === '"') return j + 1;
        if (c === '$' && src[j + 1] === '(') { j = skipParens(j + 2); continue; }
        if (c === '`') { j = skipBacktick(j + 1); continue; }
        j++;
      }
      throw new IncompleteError('"');
    }
    function skipParens(j) {
      let depth = 1;
      while (j < n) {
        const c = src[j];
        if (c === '\\') { j += 2; continue; }
        if (c === "'") { const k = src.indexOf("'", j + 1); if (k < 0) throw new IncompleteError("'"); j = k + 1; continue; }
        if (c === '"') { j = skipDouble(j + 1); continue; }
        if (c === '(') depth++;
        else if (c === ')') { depth--; if (!depth) return j + 1; }
        j++;
      }
      throw new IncompleteError(')');
    }
    function skipBrace(j) {
      while (j < n) {
        const c = src[j];
        if (c === '\\') { j += 2; continue; }
        if (c === "'") { const k = src.indexOf("'", j + 1); if (k < 0) throw new IncompleteError("'"); j = k + 1; continue; }
        if (c === '"') { j = skipDouble(j + 1); continue; }
        if (c === '}') return j + 1;
        j++;
      }
      throw new IncompleteError('}');
    }
    function skipBacktick(j) {
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '`') return j + 1;
        j++;
      }
      throw new IncompleteError('`');
    }

    function readWord() {
      const start = i;
      let quoted = false;
      while (i < n) {
        const c = src[i];
        if (META.has(c)) break;
        if (c === '\\') {
          if (i + 1 >= n) throw new IncompleteError('\\');
          quoted = true; i += 2; continue;
        }
        if (c === "'") {
          quoted = true;
          const j = src.indexOf("'", i + 1);
          if (j < 0) throw new IncompleteError("'");
          i = j + 1; continue;
        }
        if (c === '"') { quoted = true; i = skipDouble(i + 1); continue; }
        if (c === '`') { i = skipBacktick(i + 1); continue; }
        if (c === '$' && src[i + 1] === '(') { i = skipParens(i + 2); continue; }
        if (c === '$' && src[i + 1] === '{') { i = skipBrace(i + 2); continue; }
        i++;
      }
      return { t: 'w', v: src.slice(start, i), q: quoted };
    }

    function readHeredocs() {
      for (const hd of pending) {
        let body = '';
        for (;;) {
          if (i >= n) throw new IncompleteError('heredoc');
          let j = src.indexOf('\n', i);
          const last = j < 0;
          if (last) j = n;
          const line = src.slice(i, j);
          const cmp = hd.strip ? line.replace(/^\t+/, '') : line;
          i = last ? n : j + 1;
          if (cmp === hd.delim) break;
          if (last) throw new IncompleteError('heredoc');
          body += cmp + '\n';
        }
        hd.body = body;
      }
      pending = [];
    }

    function readRedir(fd) {
      let op;
      if (src.startsWith('<<<', i)) { op = '<<<'; i += 3; }
      else if (src.startsWith('<<-', i)) { op = '<<-'; i += 3; }
      else if (src.startsWith('<<', i)) { op = '<<'; i += 2; }
      else if (src.startsWith('<&', i)) { op = '<&'; i += 2; }
      else if (src.startsWith('<>', i)) { op = '<'; i += 2; }
      else if (src.startsWith('>>', i)) { op = '>>'; i += 2; }
      else if (src.startsWith('>&', i)) { op = '>&'; i += 2; }
      else if (src.startsWith('>|', i)) { op = '>'; i += 2; }
      else { op = src[i]; i++; }
      const tok = { t: 'r', v: op, fd };
      if (op === '<<' || op === '<<-') {
        while (src[i] === ' ' || src[i] === '\t') i++;
        const w = readWord();
        if (!w.v) throw new ShSyntaxError("syntax error near unexpected token `newline'");
        tok.v = '<<';
        tok.hd = { delim: w.v.replace(/['"\\]/g, ''), quoted: w.q, strip: op === '<<-', body: '' };
        pending.push(tok.hd);
      }
      toks.push(tok);
    }

    while (i < n) {
      const c = src[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (c === '\\' && src[i + 1] === '\n') { i += 2; continue; }
      if (c === '\n') {
        toks.push({ t: 'op', v: '\n' });
        i++;
        if (pending.length) readHeredocs();
        continue;
      }
      if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '|') {
        if (src[i + 1] === '|') { toks.push({ t: 'op', v: '||' }); i += 2; }
        else if (src[i + 1] === '&') { toks.push({ t: 'op', v: '|', both: true }); i += 2; }
        else { toks.push({ t: 'op', v: '|' }); i++; }
        continue;
      }
      if (c === '&') {
        if (src[i + 1] === '&') { toks.push({ t: 'op', v: '&&' }); i += 2; }
        else if (src[i + 1] === '>') {
          if (src[i + 2] === '>') { toks.push({ t: 'r', v: '&>>', fd: null }); i += 3; }
          else { toks.push({ t: 'r', v: '&>', fd: null }); i += 2; }
        } else { toks.push({ t: 'op', v: '&' }); i++; }
        continue;
      }
      if (c === ';') {
        if (src[i + 1] === ';') { toks.push({ t: 'op', v: ';;' }); i += 2; }
        else { toks.push({ t: 'op', v: ';' }); i++; }
        continue;
      }
      if (c === '(' || c === ')') { toks.push({ t: 'op', v: c }); i++; continue; }
      if (c === '<' || c === '>') { readRedir(null); continue; }
      const w = readWord();
      if (/^\d+$/.test(w.v) && (src[i] === '<' || src[i] === '>')) { readRedir(Number(w.v)); continue; }
      toks.push(w);
    }
    if (pending.length) throw new IncompleteError('heredoc');
    toks.push({ t: 'eof' });
    return toks;
  }

  class Parser {
    constructor(toks, aliases) {
      this.toks = toks;
      this.p = 0;
      this.aliases = aliases || null;
    }
    peek(k = 0) { return this.toks[Math.min(this.p + k, this.toks.length - 1)]; }
    isOp(v, k = 0) { const t = this.peek(k); return t.t === 'op' && t.v === v; }
    isWord(v, k = 0) { const t = this.peek(k); return t.t === 'w' && !t.q && t.v === v; }
    eof() { return this.peek().t === 'eof'; }
    skipNL() { while (this.isOp('\n')) this.p++; }
    unexpected() {
      const t = this.peek();
      if (t.t === 'eof') throw new IncompleteError();
      const v = t.t === 'op' && t.v === '\n' ? 'newline' : t.v;
      throw new ShSyntaxError(`syntax error near unexpected token \`${v}'`);
    }
    expectWord(v) {
      const t = this.peek();
      if (t.t === 'eof') throw new IncompleteError();
      if (!(t.t === 'w' && !t.q && t.v === v)) this.unexpected();
      this.p++;
    }
    atListEnd() {
      const t = this.peek();
      if (t.t === 'eof') return true;
      if (t.t === 'op' && (t.v === ')' || t.v === ';;')) return true;
      if (t.t === 'w' && !t.q && LIST_END.has(t.v)) return true;
      return false;
    }

    parseProgram() {
      this.skipNL();
      const l = this.parseList();
      if (!this.eof()) this.unexpected();
      return l;
    }
    parseList() {
      const items = [];
      this.skipNL();
      while (!this.atListEnd()) {
        const node = this.parseAndOr();
        let bg = false;
        if (this.isOp('&')) { bg = true; this.p++; }
        else if (this.isOp(';') || this.isOp('\n')) this.p++;
        else if (!this.atListEnd()) this.unexpected();
        items.push({ node, bg });
        this.skipNL();
      }
      return { type: 'list', items };
    }
    parseAndOr() {
      const parts = [this.parsePipeline()];
      const ops = [];
      while (this.isOp('&&') || this.isOp('||')) {
        ops.push(this.peek().v);
        this.p++;
        this.skipNL();
        if (this.eof()) throw new IncompleteError();
        parts.push(this.parsePipeline());
      }
      return parts.length === 1 ? parts[0] : { type: 'andor', parts, ops };
    }
    parsePipeline() {
      let bang = false;
      if (this.isWord('!')) { bang = true; this.p++; }
      const cmds = [this.parseCommand()];
      const both = [];
      while (this.isOp('|')) {
        both.push(!!this.peek().both);
        this.p++;
        this.skipNL();
        if (this.eof()) throw new IncompleteError();
        cmds.push(this.parseCommand());
      }
      if (!bang && cmds.length === 1) return cmds[0];
      return { type: 'pipeline', cmds, bang, both };
    }
    parseCommand() {
      const t = this.peek();
      if (t.t === 'eof') throw new IncompleteError();
      let node = null;
      if (t.t === 'w' && !t.q) {
        switch (t.v) {
          case 'if': node = this.parseIf(); break;
          case 'for': node = this.parseFor(); break;
          case 'while': case 'until': node = this.parseWhile(); break;
          case 'case': node = this.parseCase(); break;
          case '{': node = this.parseGroup(); break;
          case 'function': node = this.parseFunction(true); break;
          default:
            if (this.isOp('(', 1) && this.isOp(')', 2) && /^[A-Za-z_][\w.-]*$/.test(t.v)) node = this.parseFunction(false);
        }
      } else if (t.t === 'op' && t.v === '(') node = this.parseSubshell();
      if (node) {
        node.redirs = this.parseRedirs();
        return node;
      }
      return this.parseSimple();
    }
    parseRedir() {
      const t = this.toks[this.p++];
      if (t.hd) return { op: '<<', fd: t.fd == null ? 0 : t.fd, hd: t.hd };
      const w = this.peek();
      if (w.t !== 'w') this.unexpected();
      this.p++;
      return { op: t.v, fd: t.fd, target: w.v };
    }
    parseRedirs() {
      const r = [];
      while (this.peek().t === 'r') r.push(this.parseRedir());
      return r;
    }
    parseSimple() {
      const assigns = [], words = [], redirs = [];
      for (;;) {
        const t = this.peek();
        if (t.t === 'r') { redirs.push(this.parseRedir()); continue; }
        if (t.t !== 'w') break;
        if (!words.length && /^[A-Za-z_][A-Za-z0-9_]*\+?=/.test(t.v)) { assigns.push(t.v); this.p++; continue; }
        if (!words.length && this.aliases && !t.q && Object.prototype.hasOwnProperty.call(this.aliases, t.v) && !(t.chain && t.chain.includes(t.v))) {
          let sub;
          try { sub = tokenize(this.aliases[t.v]); } catch (e) { sub = [{ t: 'w', v: this.aliases[t.v], q: true }, { t: 'eof' }]; }
          sub.pop();
          const chain = (t.chain || []).concat([t.v]);
          sub.forEach((s) => { s.chain = chain; });
          this.toks.splice(this.p, 1, ...sub);
          continue;
        }
        if (!words.length && !t.q && t.v === '[[') return this.parseDouble(assigns, redirs);
        words.push(t.v);
        this.p++;
      }
      if (!assigns.length && !words.length && !redirs.length) this.unexpected();
      return { type: 'simple', assigns, words, redirs };
    }
    parseDouble(assigns, redirs) {
      const words = ['[['];
      this.p++;
      for (;;) {
        const t = this.peek();
        if (t.t === 'eof') throw new IncompleteError();
        this.p++;
        if (t.t === 'w' && !t.q && t.v === ']]') break;
        if (t.t === 'op' && t.v === '\n') continue;
        if (t.t === 'r') { words.push(t.v); continue; }
        words.push(t.t === 'w' ? t.v : t.v);
      }
      words.push(']]');
      return { type: 'simple', assigns, words, redirs: redirs.concat(this.parseRedirs()), dbl: true };
    }
    parseIf() {
      this.p++;
      const clauses = [];
      let elseBody = null;
      let cond = this.parseList();
      this.expectWord('then');
      let body = this.parseList();
      clauses.push({ cond, body });
      for (;;) {
        if (this.isWord('elif')) {
          this.p++;
          cond = this.parseList();
          this.expectWord('then');
          body = this.parseList();
          clauses.push({ cond, body });
          continue;
        }
        if (this.isWord('else')) { this.p++; elseBody = this.parseList(); }
        this.expectWord('fi');
        break;
      }
      return { type: 'if', clauses, elseBody };
    }
    parseFor() {
      this.p++;
      const nt = this.peek();
      if (nt.t === 'eof') throw new IncompleteError();
      if (nt.t !== 'w') this.unexpected();
      this.p++;
      const name = nt.v;
      let items = null;
      this.skipNL();
      if (this.isWord('in')) {
        this.p++;
        items = [];
        while (this.peek().t === 'w') { items.push(this.peek().v); this.p++; }
      }
      if (this.isOp(';') || this.isOp('\n')) this.p++;
      this.skipNL();
      this.expectWord('do');
      const body = this.parseList();
      this.expectWord('done');
      return { type: 'for', name, items, body };
    }
    parseWhile() {
      const until = this.peek().v === 'until';
      this.p++;
      const cond = this.parseList();
      this.expectWord('do');
      const body = this.parseList();
      this.expectWord('done');
      return { type: 'while', until, cond, body };
    }
    parseCase() {
      this.p++;
      const wt = this.peek();
      if (wt.t === 'eof') throw new IncompleteError();
      if (wt.t !== 'w') this.unexpected();
      this.p++;
      this.skipNL();
      this.expectWord('in');
      this.skipNL();
      const arms = [];
      while (!this.isWord('esac')) {
        if (this.eof()) throw new IncompleteError();
        if (this.isOp('(')) this.p++;
        const pats = [];
        for (;;) {
          const t = this.peek();
          if (t.t === 'eof') throw new IncompleteError();
          if (t.t !== 'w') this.unexpected();
          pats.push(t.v);
          this.p++;
          if (this.isOp('|')) { this.p++; continue; }
          break;
        }
        if (!this.isOp(')')) this.unexpected();
        this.p++;
        const body = this.parseList();
        if (this.isOp(';;')) this.p++;
        this.skipNL();
        arms.push({ pats, body });
      }
      this.p++;
      return { type: 'case', word: wt.v, arms };
    }
    parseGroup() {
      this.p++;
      const body = this.parseList();
      this.expectWord('}');
      return { type: 'group', body };
    }
    parseSubshell() {
      this.p++;
      const body = this.parseList();
      if (this.eof()) throw new IncompleteError();
      if (!this.isOp(')')) this.unexpected();
      this.p++;
      return { type: 'subshell', body };
    }
    parseFunction(kw) {
      if (kw) this.p++;
      const nt = this.peek();
      if (nt.t !== 'w') this.unexpected();
      this.p++;
      if (this.isOp('(')) {
        this.p++;
        if (!this.isOp(')')) this.unexpected();
        this.p++;
      }
      this.skipNL();
      const body = this.parseCommand();
      return { type: 'func', name: nt.v, body };
    }
  }

  LA.tokenize = tokenize;
  LA.parse = (src, aliases) => new Parser(tokenize(src), aliases).parseProgram();
  LA.isComplete = (src) => {
    try { LA.parse(src, null); return true; } catch (e) { return !e.incomplete; }
  };
})();
