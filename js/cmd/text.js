/* Linux Awakening — text processing commands. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const U = LA.util;
  const VFS = LA.VFS;
  const def = LA.def;
  const getopt = U.getopt;

  /* read a file operand or '-' (stdin). returns {text} or {error} */
  async function readArg(ctx, f) {
    if (f === '-') return { text: await ctx.readInput(), name: '(standard input)' };
    const abs = ctx.abs(f);
    try {
      const node = ctx.fs.get(abs, ctx.user);
      if (node.type === 'dir') return { error: 'Is a directory', code: 'EISDIR', node };
      const text = ctx.fs.readFile(abs, ctx.user);
      return { text, name: f, node, abs };
    } catch (e) { return { error: e.message, code: e.code }; }
  }
  LA.readArg = readArg;

  LA.hashContent = (node, fs) => (node.format ? 'BIN:' + node.format + ':' + JSON.stringify(node.data) : fs.contentOf(node));

  /* ---------- head / tail ---------- */
  function headTail(isHead) {
    return {
      async run(ctx) {
        const name = isHead ? 'head' : 'tail';
        const { o, operands } = getopt(ctx.args, { flags: 'qvfF', params: 'nc', numeric: 'n', long: { lines: 'n=', bytes: 'c=', quiet: 'q', verbose: 'v', follow: 'f' } });
        const files = operands.length ? operands : ['-'];
        let st = 0;
        const nSpec = o.n !== undefined ? String(o.n) : '10';
        if (!/^[+-]?\d+$/.test(nSpec)) { ctx.err.write(`${name}: invalid number of lines: '${nSpec}'\n`); return 1; }
        const showHeaders = (files.length > 1 && !o.q) || o.v;
        let first = true;
        for (const f of files) {
          const r = await readArg(ctx, f);
          if (r.error) {
            if (r.code === 'EISDIR') ctx.err.write(`${name}: error reading '${f}': Is a directory\n`);
            else ctx.err.write(`${name}: cannot open '${f}' for reading: ${r.error}\n`);
            st = 1;
            continue;
          }
          if (r.abs) ctx.noteRead(r.abs);
          if (showHeaders) { ctx.print((first ? '' : '\n') + `==> ${f === '-' ? 'standard input' : f} <==\n`); }
          first = false;
          const text = r.text;
          if (o.c !== undefined) {
            const n = parseInt(o.c, 10);
            ctx.print(isHead ? (n < 0 ? text.slice(0, n) : text.slice(0, n)) : text.slice(-Math.abs(n)));
            continue;
          }
          const lines = text.split('\n');
          const trailing = lines[lines.length - 1] === '';
          if (trailing) lines.pop();
          let sel;
          const n = parseInt(nSpec, 10);
          if (isHead) sel = nSpec.startsWith('-') ? lines.slice(0, Math.max(0, lines.length + n)) : lines.slice(0, n);
          else sel = nSpec.startsWith('+') ? lines.slice(Math.max(0, n - 1)) : n === 0 ? [] : lines.slice(-Math.abs(n));
          if (sel.length) ctx.print(sel.join('\n') + (trailing || sel.length < lines.length || !isHead ? '\n' : ''));
        }
        if (!isHead && (o.f || o.F) && ctx.isTTY) {
          ctx.err.write(LA.paint(LA.ansi.gray, '(following — press Ctrl+C to stop)') + '\n');
          await new Promise((res) => ctx.signal.on(res));
          return 0;
        }
        return st;
      },
    };
  }
  def('head', headTail(true));
  def('tail', headTail(false));

  /* ---------- pagers ---------- */
  function pager(name) {
    return {
      async run(ctx) {
        const { operands } = getopt(ctx.args, { flags: 'NSRFXEr', params: 'x' });
        let text = '', title = '';
        if (!operands.length) {
          if (ctx.stdinTTY) { ctx.err.write(`Missing filename ("${name} --help" for help)\n`); return 1; }
          text = await ctx.readInput();
          title = '(standard input)';
        } else {
          for (const f of operands) {
            const r = await readArg(ctx, f);
            if (r.error) { ctx.err.write(r.code === 'EISDIR' ? `${f} is a directory\n` : `${f}: ${r.error}\n`); return 1; }
            if (r.abs) ctx.noteRead(r.abs);
            text += (operands.length > 1 ? `::::::::::::::\n${f}\n::::::::::::::\n` : '') + r.text;
            title = f;
          }
        }
        if (!ctx.isTTY || !ctx.ui.page) { ctx.print(text); return 0; }
        await ctx.ui.page(text, { title, name });
        return 0;
      },
    };
  }
  def('less', pager('less'));
  def('more', pager('more'));

  /* ---------- grep ---------- */
  def('grep', {
    async run(ctx) {
      const pats = [];
      const rest = [];
      const args = ctx.args;
      let patFile = null;
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-e' || a === '--regexp') { if (args[i + 1] === undefined) { ctx.err.write("grep: option requires an argument -- 'e'\n"); return 2; } pats.push(args[++i]); continue; }
        if (a.startsWith('--regexp=')) { pats.push(a.slice(9)); continue; }
        if (a === '-f') { patFile = args[++i]; continue; }
        if (/^-[a-zA-Z]*e$/.test(a) && a.length > 2 && !a.startsWith('--')) { rest.push(a.slice(0, -1)); pats.push(args[++i]); continue; }
        rest.push(a);
      }
      let colorOpt = 'auto';
      const rest2 = rest.filter((a) => { if (a.startsWith('--color')) { colorOpt = a.includes('=') ? a.split('=')[1] : 'always'; return false; } return true; });
      const { o, operands } = getopt(rest2, {
        flags: 'ivnclLrRwxoEFHhqsIaPZb', params: 'ABCm',
        long: { 'ignore-case': 'i', 'invert-match': 'v', 'line-number': 'n', count: 'c', 'files-with-matches': 'l', 'files-without-match': 'L', recursive: 'r', 'word-regexp': 'w', 'line-regexp': 'x', 'only-matching': 'o', 'extended-regexp': 'E', 'fixed-strings': 'F', 'with-filename': 'H', 'no-filename': 'h', quiet: 'q', silent: 'q', 'no-messages': 's', 'max-count': 'm=', 'after-context': 'A=', 'before-context': 'B=', context: 'C=', include: 'N=', exclude: 'X=' },
      });
      if (patFile) {
        const r = await readArg(ctx, patFile);
        if (r.error) { ctx.err.write(`grep: ${patFile}: ${r.error}\n`); return 2; }
        pats.push(...U.lines(r.text));
      }
      if (!pats.length) {
        if (!operands.length) { ctx.err.write("Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.\n"); return 2; }
        pats.push(...operands.shift().split('\n'));
      }
      const useColor = colorOpt === 'always' || (colorOpt === 'auto' && ctx.isTTY);
      const ere = !!(o.E || o.P);
      let src;
      try {
        src = pats.map((p) => (o.F ? U.escapeRe(p) : U.reToJs(p, ere))).map((s) => `(?:${s})`).join('|');
        if (o.w) src = `(?<![A-Za-z0-9_])(?:${src})(?![A-Za-z0-9_])`;
        if (o.x) src = `^(?:${src})$`;
        new RegExp(src);
      } catch (e) {
        ctx.err.write(`grep: Unmatched ( or \\(\n`);
        return 2;
      }
      const flags = o.i ? 'i' : '';
      const re = new RegExp(src, flags);
      const reG = new RegExp(src, flags + 'g');
      const after = parseInt(o.A || o.C || '0', 10) || 0;
      const before = parseInt(o.B || o.C || '0', 10) || 0;
      const maxCount = o.m !== undefined ? parseInt(o.m, 10) : Infinity;
      const recursive = o.r || o.R;
      const fs = ctx.fs;

      const files = [];
      let status = 1;
      let hadError = false;
      const targets = operands.length ? operands : [recursive ? '.' : '-'];
      for (const t of targets) {
        if (t === '-') { files.push({ name: '(standard input)', stdin: true }); continue; }
        const abs = ctx.abs(t);
        let node;
        try { node = fs.get(abs, ctx.user); }
        catch (e) { if (!o.s) ctx.err.write(`grep: ${t}: ${e.message}\n`); hadError = true; continue; }
        if (node.type === 'dir') {
          if (!recursive) { if (!o.s) ctx.err.write(`grep: ${t}: Is a directory\n`); hadError = true; continue; }
          const walk = (dnode, dabs, disp) => {
            if (!fs.can(dnode, ctx.user, 4) || !fs.can(dnode, ctx.user, 1)) { if (!o.s) ctx.err.write(`grep: ${disp}: Permission denied\n`); hadError = true; return; }
            const kids = [...dnode.children.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
            for (const [name, c0] of kids) {
              const c = c0.mount || c0;
              const cd = disp === '.' && !operands.length ? name : VFS.join(disp, name);
              if (c.type === 'dir') walk(c, VFS.join(dabs, name), cd);
              else if (c.type === 'file' && !c.special) {
                if (o.N && !U.globRe(o.N).test(name)) continue;
                if (o.X && U.globRe(o.X).test(name)) continue;
                files.push({ name: cd, abs: VFS.join(dabs, name), node: c });
              }
            }
          };
          walk(node, abs, t);
        } else files.push({ name: t, abs, node });
      }
      const showName = o.H || (!o.h && (files.length > 1 || recursive));
      const paint = (code, s) => (useColor ? code + s + '\x1b[0m' : s);
      const sep = (c) => paint('\x1b[36m', c);
      for (const f of files) {
        let text;
        if (f.stdin) text = await ctx.readInput();
        else {
          if (f.node.format) {
            if (o.a) text = ctx.fs.contentOf(f.node);
            else {
              const hay = JSON.stringify(f.node.data || '');
              if (!o.v && re.test(hay) && !o.q && !o.c && !o.l) ctx.println(`grep: ${f.name}: binary file matches`);
              if (!o.v && re.test(hay)) status = 0;
              continue;
            }
          } else {
            try { text = fs.readFile(f.abs, ctx.user); }
            catch (e) { if (!o.s) ctx.err.write(`grep: ${f.name}: ${e.message}\n`); hadError = true; continue; }
          }
        }
        const lines = text.split('\n');
        if (lines[lines.length - 1] === '') lines.pop();
        let count = 0;
        let lastPrinted = -1;
        let afterLeft = 0;
        const prefix = (i, ch) => (showName ? paint('\x1b[35m', f.name) + sep(ch) : '') + (o.n ? paint('\x1b[32m', String(i + 1)) + sep(ch) : '');
        const out = [];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          re.lastIndex = 0;
          const hit = re.test(line) !== !!o.v;
          if (hit && count < maxCount) {
            count++;
            if (o.q) return 0;
            if (o.l || o.L || o.c) continue;
            if (o.o) {
              if (o.v) continue;
              reG.lastIndex = 0;
              let m;
              while ((m = reG.exec(line))) {
                if (m[0] === '') { reG.lastIndex++; continue; }
                out.push(prefix(i, ':') + paint('\x1b[01;31m', m[0]));
              }
              continue;
            }
            if (before || after) {
              const from = Math.max(lastPrinted + 1, i - before);
              if (lastPrinted >= 0 && from > lastPrinted + 1) out.push(sep('--'));
              for (let k = from; k < i; k++) out.push(prefix(k, '-') + lines[k]);
            }
            const shown = useColor && !o.v ? line.replace(reG, (m) => (m ? '\x1b[01;31m' + m + '\x1b[0m' : m)) : line;
            out.push(prefix(i, ':') + shown);
            lastPrinted = i;
            afterLeft = after;
          } else if (afterLeft > 0 && !o.l && !o.L && !o.c) {
            out.push(prefix(i, '-') + line);
            lastPrinted = i;
            afterLeft--;
          }
          if (count >= maxCount && afterLeft === 0) break;
        }
        if (count) status = 0;
        if (o.c) ctx.println((showName ? paint('\x1b[35m', f.name) + sep(':') : '') + count);
        else if (o.l) { if (count) ctx.println(paint('\x1b[35m', f.name)); }
        else if (o.L) { if (!count) ctx.println(paint('\x1b[35m', f.name)); }
        else if (out.length) ctx.print(out.join('\n') + '\n');
        await ctx.shell.tick();
      }
      if (o.L) status = status === 0 ? 1 : 0;
      if (hadError && !(o.q && status === 0)) return 2;
      return status;
    },
  });
  LA.commands.egrep = { run: (ctx) => LA.commands.grep.run(Object.assign(ctx, { args: ['-E', ...ctx.args] })) };
  LA.commands.fgrep = { run: (ctx) => LA.commands.grep.run(Object.assign(ctx, { args: ['-F', ...ctx.args] })) };

  /* ---------- wc ---------- */
  def('wc', {
    async run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'lwcmL', long: { lines: 'l', words: 'w', bytes: 'c', chars: 'm', 'max-line-length': 'L' } });
      let sel = ['l', 'w', 'm', 'c', 'L'].filter((k) => o[k]);
      if (!sel.length) sel = ['l', 'w', 'c'];
      const files = operands.length ? operands : ['-'];
      const results = [];
      let st = 0;
      const tot = { l: 0, w: 0, c: 0, m: 0, L: 0 };
      for (const f of files) {
        const r = await readArg(ctx, f);
        if (r.error) {
          ctx.err.write(`wc: ${f}: ${r.error}\n`);
          if (r.code === 'EISDIR') results.push({ name: f, v: { l: 0, w: 0, c: 0, m: 0, L: 0 } });
          st = 1;
          continue;
        }
        const t = r.text;
        const v = {
          l: (t.match(/\n/g) || []).length,
          w: (t.match(/\S+/g) || []).length,
          c: r.node && r.node.format ? r.node.size : U.utf8len(t),
          m: [...t].length,
          L: Math.max(0, ...t.split('\n').map((x) => x.length)),
        };
        for (const k in tot) tot[k] = k === 'L' ? Math.max(tot[k], v[k]) : tot[k] + v[k];
        results.push({ name: f === '-' ? '' : f, v });
      }
      if (results.length > 1) results.push({ name: 'total', v: tot });
      const single = results.length === 1 && sel.length === 1;
      const width = single ? 0 : files.includes('-') && files.length === 1 ? 7 : Math.max(1, String(Math.max(tot.c, tot.l, tot.w, tot.m)).length);
      for (const r of results) ctx.println(sel.map((k) => String(r.v[k]).padStart(width)).join(' ') + (r.name ? ' ' + r.name : ''));
      return st;
    },
  });

  /* ---------- sort ---------- */
  const collator = typeof Intl !== 'undefined' ? new Intl.Collator('en', { sensitivity: 'variant', numeric: false }) : null;
  const strCmp = (a, b) => (collator ? collator.compare(a, b) : a < b ? -1 : a > b ? 1 : 0);
  const humanNum = (s) => {
    const m = String(s).trim().match(/^(-?[\d.]+)\s*([KMGTP]?)/i);
    if (!m) return 0;
    return parseFloat(m[1]) * Math.pow(1024, ' KMGTP'.indexOf((m[2] || ' ').toUpperCase()));
  };
  const versionCmp = (a, b) => {
    const pa = a.match(/\d+|\D+/g) || [], pb = b.match(/\d+|\D+/g) || [];
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const x = pa[i], y = pb[i];
      if (x === undefined) return -1;
      if (y === undefined) return 1;
      if (/^\d/.test(x) && /^\d/.test(y)) { const d = parseInt(x, 10) - parseInt(y, 10); if (d) return d; }
      else if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  };
  def('sort', {
    async run(ctx) {
      const keys = [];
      const rest = [];
      for (let i = 0; i < ctx.args.length; i++) {
        const a = ctx.args[i];
        if (a === '-k' || a === '--key') { keys.push(ctx.args[++i]); continue; }
        if (/^-k./.test(a)) { keys.push(a.slice(2)); continue; }
        if (a.startsWith('--key=')) { keys.push(a.slice(6)); continue; }
        rest.push(a);
      }
      const { o, operands } = getopt(rest, { flags: 'rnufbhVMsRc', params: 'to', long: { reverse: 'r', 'numeric-sort': 'n', unique: 'u', 'ignore-case': 'f', 'human-numeric-sort': 'h', 'version-sort': 'V', 'field-separator': 't=', output: 'o=', 'random-sort': 'R', check: 'c' } });
      const files = operands.length ? operands : ['-'];
      let lines = [];
      for (const f of files) {
        const r = await readArg(ctx, f);
        if (r.error) { ctx.err.write(`sort: ${r.code === 'EISDIR' ? 'read failed: ' + f : 'cannot read: ' + f}: ${r.error}\n`); return 2; }
        lines.push(...U.lines(r.text));
      }
      const sep = o.t;
      const parsedKeys = keys.map((k) => {
        const m = k.match(/^(\d+)(?:\.\d+)?([a-zA-Z]*)(?:,(\d+)(?:\.\d+)?([a-zA-Z]*))?$/);
        if (!m) throw new LA.OptError(`invalid number at field start: invalid count at start of '${k}'`);
        return { start: parseInt(m[1], 10), end: m[3] ? parseInt(m[3], 10) : null, flags: (m[2] || '') + (m[4] || '') };
      });
      const fieldsOf = (line) => (sep !== undefined ? line.split(sep) : line.match(/\s*\S+/g) || ['']);
      const keyOf = (line, k) => {
        const f = fieldsOf(line);
        const part = f.slice(k.start - 1, k.end == null ? undefined : k.end);
        return sep !== undefined ? part.join(sep) : part.join('');
      };
      const cmpWith = (a, b, fl) => {
        const n = fl.includes('n') || (!fl && o.n);
        const h = fl.includes('h') || (!fl && o.h);
        const V = fl.includes('V') || (!fl && o.V);
        const f = fl.includes('f') || o.f;
        const bb = fl.includes('b') || o.b || n || h;
        if (bb) { a = a.trim(); b = b.trim(); }
        let r;
        if (n) { const x = parseFloat(a), y = parseFloat(b); r = (isNaN(x) ? 0 : x) - (isNaN(y) ? 0 : y); }
        else if (h) r = humanNum(a) - humanNum(b);
        else if (V) r = versionCmp(a, b);
        else r = f ? strCmp(a.toLowerCase(), b.toLowerCase()) : strCmp(a, b);
        if (fl.includes('r')) r = -r;
        return r;
      };
      const cmp = (a, b) => {
        if (parsedKeys.length) {
          for (const k of parsedKeys) {
            const r = cmpWith(keyOf(a, k), keyOf(b, k), k.flags);
            if (r) return o.r ? -r : r;
          }
        } else {
          const r = cmpWith(a, b, '');
          if (r) return o.r ? -r : r;
        }
        if (o.u || o.s) return 0;
        const r = a < b ? -1 : a > b ? 1 : 0;
        return o.r ? -r : r;
      };
      if (o.c) {
        for (let i = 1; i < lines.length; i++) if (cmp(lines[i - 1], lines[i]) > 0) { ctx.err.write(`sort: -:${i + 1}: disorder: ${lines[i]}\n`); return 1; }
        return 0;
      }
      if (o.R) { lines.sort(() => Math.random() - 0.5); }
      else lines.sort(cmp);
      if (o.u) lines = lines.filter((l, i) => i === 0 || cmp(lines[i - 1], l) !== 0);
      const out = U.joinLines(lines);
      if (o.o) {
        try { ctx.fs.writeFile(ctx.abs(o.o), out, { user: ctx.user, umask: ctx.shell.umask }); }
        catch (e) { ctx.err.write(`sort: open failed: ${o.o}: ${e.message}\n`); return 2; }
      } else ctx.print(out);
      return 0;
    },
  });

  /* ---------- uniq ---------- */
  def('uniq', {
    async run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'cdui', params: 'fs', long: { count: 'c', repeated: 'd', unique: 'u', 'ignore-case': 'i' } });
      const r = await readArg(ctx, operands[0] || '-');
      if (r.error) { ctx.err.write(`uniq: ${operands[0]}: ${r.error}\n`); return 1; }
      const lines = U.lines(r.text);
      const skipF = parseInt(o.f || '0', 10);
      const keyOf = (l) => {
        let k = l;
        if (skipF) k = (k.match(/\s*\S+/g) || []).slice(skipF).join('');
        if (o.s) k = k.slice(parseInt(o.s, 10));
        return o.i ? k.toLowerCase() : k;
      };
      const groups = [];
      for (const l of lines) {
        const g = groups[groups.length - 1];
        if (g && keyOf(g.line) === keyOf(l)) g.n++;
        else groups.push({ line: l, n: 1 });
      }
      let out = '';
      for (const g of groups) {
        if (o.d && g.n < 2) continue;
        if (o.u && g.n > 1) continue;
        out += (o.c ? String(g.n).padStart(7) + ' ' : '') + g.line + '\n';
      }
      if (operands[1]) {
        try { ctx.fs.writeFile(ctx.abs(operands[1]), out, { user: ctx.user, umask: ctx.shell.umask }); }
        catch (e) { ctx.err.write(`uniq: ${operands[1]}: ${e.message}\n`); return 1; }
      } else ctx.print(out);
      return 0;
    },
  });

  /* ---------- cut ---------- */
  function parseList(s) {
    const ranges = [];
    for (const part of s.split(',')) {
      let m;
      if ((m = part.match(/^(\d+)$/))) ranges.push([+m[1], +m[1]]);
      else if ((m = part.match(/^(\d+)-(\d+)$/))) ranges.push([+m[1], +m[2]]);
      else if ((m = part.match(/^(\d+)-$/))) ranges.push([+m[1], Infinity]);
      else if ((m = part.match(/^-(\d+)$/))) ranges.push([1, +m[1]]);
      else return null;
    }
    return ranges;
  }
  def('cut', {
    async run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'snz', params: 'dfcb', long: { delimiter: 'd=', fields: 'f=', characters: 'c=', bytes: 'b=', 'only-delimited': 's', complement: 'C', 'output-delimiter': 'O=' } });
      const listStr = o.f || o.c || o.b;
      if (!listStr) { ctx.err.write("cut: you must specify a list of bytes, characters, or fields\nTry 'cut --help' for more information.\n"); return 1; }
      const ranges = parseList(listStr);
      if (!ranges) { ctx.err.write(`cut: invalid field value '${listStr}'\nTry 'cut --help' for more information.\n`); return 1; }
      const inR = (i) => ranges.some(([a, b]) => i >= a && i <= b) !== !!o.C;
      const delim = o.d !== undefined ? o.d : '\t';
      if (o.f && delim.length !== 1) { ctx.err.write("cut: the delimiter must be a single character\nTry 'cut --help' for more information.\n"); return 1; }
      const outDelim = o.O !== undefined ? o.O : delim;
      const files = operands.length ? operands : ['-'];
      let st = 0;
      for (const f of files) {
        const r = await readArg(ctx, f);
        if (r.error) { ctx.err.write(`cut: ${f}: ${r.error}\n`); st = 1; continue; }
        const out = [];
        for (const line of U.lines(r.text)) {
          if (o.f) {
            if (!line.includes(delim)) { if (!o.s) out.push(line); continue; }
            out.push(line.split(delim).filter((_, i) => inR(i + 1)).join(outDelim));
          } else {
            out.push([...line].filter((_, i) => inR(i + 1)).join(''));
          }
        }
        ctx.print(U.joinLines(out));
      }
      return st;
    },
  });

  /* ---------- tr ---------- */
  function expandSet(s) {
    s = s.replace(/\\(n|t|r|\\|[0-7]{1,3})/g, (m, c) => (c === 'n' ? '\n' : c === 't' ? '\t' : c === 'r' ? '\r' : c === '\\' ? '\\' : String.fromCharCode(parseInt(c, 8))));
    const CL = {
      lower: 'abcdefghijklmnopqrstuvwxyz', upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', digit: '0123456789',
      space: ' \t\n\r\f\v', blank: ' \t', punct: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~',
    };
    CL.alpha = CL.lower + CL.upper;
    CL.alnum = CL.alpha + CL.digit;
    CL.xdigit = '0123456789ABCDEFabcdef';
    const out = [];
    for (let i = 0; i < s.length; i++) {
      const m = s.slice(i).match(/^\[:(\w+):\]/);
      if (m && CL[m[1]]) { out.push(...CL[m[1]]); i += m[0].length - 1; continue; }
      const r = s.slice(i).match(/^\[(.)\*(\d*)\]/);
      if (r) { out.push({ rep: r[1], n: r[2] ? parseInt(r[2], 10) : 0 }); i += r[0].length - 1; continue; }
      if (s[i + 1] === '-' && i + 2 < s.length) {
        const a = s.charCodeAt(i), b = s.charCodeAt(i + 2);
        for (let c = a; c <= b; c++) out.push(String.fromCharCode(c));
        i += 2;
        continue;
      }
      out.push(s[i]);
    }
    return out;
  }
  def('tr', {
    async run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'dscCt', long: { delete: 'd', 'squeeze-repeats': 's', complement: 'c' } });
      if (!operands.length) { ctx.err.write("tr: missing operand\nTry 'tr --help' for more information.\n"); return 1; }
      if (!o.d && !o.s && operands.length < 2) { ctx.err.write(`tr: missing operand after '${operands[0]}'\nTwo strings must be given when translating.\nTry 'tr --help' for more information.\n`); return 1; }
      const text = await ctx.readInput();
      let s1 = expandSet(operands[0]).filter((x) => typeof x === 'string');
      const comp = o.c || o.C;
      let s2raw = operands[1] !== undefined ? expandSet(operands[1]) : [];
      let s2 = [];
      for (const x of s2raw) {
        if (typeof x === 'string') s2.push(x);
        else { const n = x.n || Math.max(0, s1.length - s2.length - (s2raw.length - 1 - s2raw.indexOf(x))); for (let k = 0; k < n; k++) s2.push(x.rep); }
      }
      const set1 = new Set(s1);
      const in1 = (ch) => set1.has(ch) !== !!comp;
      let out = '';
      if (o.d) {
        for (const ch of text) if (!in1(ch)) out += ch;
        if (o.s && s2.length) {
          const sq = new Set(s2);
          let prev = null, res = '';
          for (const ch of out) { if (ch === prev && sq.has(ch)) continue; res += ch; prev = ch; }
          out = res;
        }
      } else if (s2.length) {
        const map = new Map();
        if (comp) {
          const last = s2[s2.length - 1];
          for (const ch of text) if (!set1.has(ch)) map.set(ch, last);
        } else s1.forEach((c, i) => map.set(c, s2[Math.min(i, s2.length - 1)]));
        for (const ch of text) out += map.has(ch) ? map.get(ch) : ch;
        if (o.s) {
          const sq = new Set(s2);
          let prev = null, res = '';
          for (const ch of out) { if (ch === prev && sq.has(ch)) continue; res += ch; prev = ch; }
          out = res;
        }
      } else if (o.s) {
        let prev = null;
        for (const ch of text) { if (ch === prev && in1(ch)) continue; out += ch; prev = ch; }
      } else out = text;
      ctx.print(out);
      return 0;
    },
  });

  /* ---------- tee ---------- */
  def('tee', {
    async run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'ai', long: { append: 'a' } });
      const text = await ctx.readInput();
      let st = 0;
      for (const f of operands) {
        const abs = ctx.abs(f);
        try {
          if (abs !== '/dev/null') ctx.fs.writeFile(abs, text, { user: ctx.user, append: !!o.a, umask: ctx.shell.umask });
          if (ctx.shell.recRoot) ctx.shell.recRoot.wroteFiles = (ctx.shell.recRoot.wroteFiles || []).concat(abs);
        } catch (e) { ctx.err.write(`tee: ${f}: ${e.message}\n`); st = 1; }
      }
      ctx.print(text);
      return st;
    },
  });

  /* ---------- diff ---------- */
  function lcsOps(a, b, eq) {
    const n = a.length, m = b.length;
    let pre = 0;
    while (pre < n && pre < m && eq(a[pre], b[pre])) pre++;
    let suf = 0;
    while (suf < n - pre && suf < m - pre && eq(a[n - 1 - suf], b[m - 1 - suf])) suf++;
    const A = a.slice(pre, n - suf), B = b.slice(pre, m - suf);
    const N = A.length, M = B.length;
    const dp = [];
    for (let i = 0; i <= N; i++) dp.push(new Int32Array(M + 1));
    for (let i = N - 1; i >= 0; i--) for (let j = M - 1; j >= 0; j--) dp[i][j] = eq(A[i], B[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const ops = [];
    for (let k = 0; k < pre; k++) ops.push({ t: '=', a: k, b: k });
    let i = 0, j = 0;
    while (i < N || j < M) {
      if (i < N && j < M && eq(A[i], B[j])) { ops.push({ t: '=', a: pre + i, b: pre + j }); i++; j++; }
      else if (i < N && (j >= M || dp[i + 1][j] >= dp[i][j + 1])) { ops.push({ t: '-', a: pre + i }); i++; }
      else { ops.push({ t: '+', b: pre + j }); j++; }
    }
    for (let k = 0; k < suf; k++) ops.push({ t: '=', a: n - suf + k, b: m - suf + k });
    return ops;
  }
  LA.lcsOps = lcsOps;
  def('diff', {
    async run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'uqiwbBsyNar', params: 'U', long: { unified: 'u', brief: 'q', 'ignore-case': 'i', 'ignore-all-space': 'w', 'ignore-space-change': 'b', 'report-identical-files': 's', 'side-by-side': 'y', color: 'C=' } });
      if (operands.length !== 2) { ctx.err.write(operands.length ? `diff: missing operand after '${operands[0]}'\n` : 'diff: missing operand\n'); ctx.err.write("diff: Try 'diff --help' for more information.\n"); return 2; }
      const [fa, fb] = operands;
      const ra = await readArg(ctx, fa), rb = await readArg(ctx, fb);
      if (ra.error) { ctx.err.write(`diff: ${fa}: ${ra.error}\n`); return 2; }
      if (rb.error) { ctx.err.write(`diff: ${fb}: ${rb.error}\n`); return 2; }
      const a = U.lines(ra.text), b = U.lines(rb.text);
      const norm = (s) => {
        let x = s;
        if (o.i) x = x.toLowerCase();
        if (o.w) x = x.replace(/\s+/g, '');
        else if (o.b) x = x.replace(/\s+/g, ' ').replace(/ $/, '');
        return x;
      };
      const ops = lcsOps(a, b, (x, y) => norm(x) === norm(y));
      const differ = ops.some((op) => op.t !== '=');
      if (!differ) { if (o.s) ctx.println(`Files ${fa} and ${fb} are identical`); return 0; }
      if (o.q) { ctx.println(`Files ${fa} and ${fb} differ`); return 1; }
      const useColor = ctx.isTTY;
      const red = (s) => (useColor ? '\x1b[31m' + s + '\x1b[0m' : s);
      const green = (s) => (useColor ? '\x1b[32m' + s + '\x1b[0m' : s);
      const cyan = (s) => (useColor ? '\x1b[36m' + s + '\x1b[0m' : s);
      if (o.y) {
        const w = 30;
        for (const op of ops) {
          if (op.t === '=') ctx.println(U.padR(a[op.a].slice(0, w), w) + '   ' + b[op.b].slice(0, w));
          else if (op.t === '-') ctx.println(U.padR(a[op.a].slice(0, w), w) + ' < ');
          else ctx.println(U.padR('', w) + ' > ' + b[op.b].slice(0, w));
        }
        return 1;
      }
      if (o.u || o.U !== undefined) {
        const C = o.U !== undefined ? parseInt(o.U, 10) : 3;
        const da = ra.node ? U.stamp(ra.node.mtime) + '.000000000 +0000' : '';
        const db = rb.node ? U.stamp(rb.node.mtime) + '.000000000 +0000' : '';
        ctx.println(`--- ${fa}\t${da}`);
        ctx.println(`+++ ${fb}\t${db}`);
        const idx = [];
        ops.forEach((op, k) => { if (op.t !== '=') idx.push(k); });
        let k = 0;
        while (k < idx.length) {
          let start = Math.max(0, idx[k] - C);
          let end = Math.min(ops.length - 1, idx[k] + C);
          while (k + 1 < idx.length && idx[k + 1] - C <= end + 1) { k++; end = Math.min(ops.length - 1, idx[k] + C); }
          k++;
          const hunk = ops.slice(start, end + 1);
          const aLines = hunk.filter((x) => x.t !== '+'), bLines = hunk.filter((x) => x.t !== '-');
          const firstA = hunk.find((x) => x.t !== '+'), firstB = hunk.find((x) => x.t !== '-');
          let aStart = firstA ? firstA.a + 1 : 0, bStart = firstB ? firstB.b + 1 : 0;
          if (!firstA) { const prev = ops.slice(0, start).reverse().find((x) => x.t !== '+'); aStart = prev ? prev.a + 1 : 0; }
          if (!firstB) { const prev = ops.slice(0, start).reverse().find((x) => x.t !== '-'); bStart = prev ? prev.b + 1 : 0; }
          const rng = (s, n) => (n === 1 ? `${s}` : `${s},${n}`);
          ctx.println(cyan(`@@ -${rng(aStart, aLines.length)} +${rng(bStart, bLines.length)} @@`));
          for (const op of hunk) {
            if (op.t === '=') ctx.println(' ' + a[op.a]);
            else if (op.t === '-') ctx.println(red('-' + a[op.a]));
            else ctx.println(green('+' + b[op.b]));
          }
        }
        return 1;
      }
      let k = 0;
      let aSeen = 0, bSeen = 0;
      while (k < ops.length) {
        if (ops[k].t === '=') { aSeen = ops[k].a + 1; bSeen = ops[k].b + 1; k++; continue; }
        const dels = [], adds = [];
        while (k < ops.length && ops[k].t !== '=') { if (ops[k].t === '-') dels.push(ops[k].a); else adds.push(ops[k].b); k++; }
        const rng = (arr) => (arr.length === 1 ? `${arr[0] + 1}` : `${arr[0] + 1},${arr[arr.length - 1] + 1}`);
        if (dels.length && adds.length) ctx.println(`${rng(dels)}c${rng(adds)}`);
        else if (dels.length) ctx.println(`${rng(dels)}d${bSeen}`);
        else ctx.println(`${aSeen}a${rng(adds)}`);
        for (const d of dels) ctx.println(red('< ' + a[d]));
        if (dels.length && adds.length) ctx.println('---');
        for (const x of adds) ctx.println(green('> ' + b[x]));
        if (dels.length) aSeen = dels[dels.length - 1] + 1;
        if (adds.length) bSeen = adds[adds.length - 1] + 1;
      }
      return 1;
    },
  });

  def('cmp', {
    async run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'sl', long: { silent: 's', quiet: 's' } });
      if (operands.length < 2) { ctx.err.write("cmp: missing operand\nTry 'cmp --help' for more information.\n"); return 2; }
      const ra = await readArg(ctx, operands[0]), rb = await readArg(ctx, operands[1]);
      if (ra.error) { ctx.err.write(`cmp: ${operands[0]}: ${ra.error}\n`); return 2; }
      if (rb.error) { ctx.err.write(`cmp: ${operands[1]}: ${rb.error}\n`); return 2; }
      const a = ra.text, b = rb.text;
      let line = 1;
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i] !== b[i]) {
          if (i >= a.length || i >= b.length) { if (!o.s) ctx.err.write(`cmp: EOF on ${i >= a.length ? operands[0] : operands[1]} after byte ${i}, line ${line - (a[i - 1] === '\n' ? 1 : 0)}\n`); return 1; }
          if (!o.s) ctx.println(`${operands[0]} ${operands[1]} differ: byte ${i + 1}, line ${line}`);
          return 1;
        }
        if (a[i] === '\n') line++;
      }
      return 0;
    },
  });

  /* ---------- paste / column / rev / tac / nl / fold ---------- */
  def('paste', {
    async run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 's', params: 'd', long: { serial: 's', delimiters: 'd=' }, dashIsOperand: true });
      const delims = o.d !== undefined ? [...U.unescape(o.d)] : ['\t'];
      const files = operands.length ? operands : ['-'];
      const contents = [];
      let stdinText = null;
      for (const f of files) {
        if (f === '-') {
          if (stdinText === null) stdinText = await ctx.readInput();
          contents.push(U.lines(stdinText));
          continue;
        }
        const r = await readArg(ctx, f);
        if (r.error) { ctx.err.write(`paste: ${f}: ${r.error}\n`); return 1; }
        contents.push(U.lines(r.text));
      }
      const joinD = (arr) => arr.reduce((acc, x, i) => (i === 0 ? x : acc + (delims.length ? delims[(i - 1) % delims.length] : '') + x), '');
      if (o.s) { for (const c of contents) ctx.println(joinD(c)); return 0; }
      const n = Math.max(0, ...contents.map((c) => c.length));
      for (let i = 0; i < n; i++) ctx.println(joinD(contents.map((c) => (c[i] !== undefined ? c[i] : ''))));
      return 0;
    },
  });

  def('column', {
    async run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'tnx', params: 'soc', long: { table: 't', separator: 's=', 'output-separator': 'o=' } });
      let text = '';
      if (operands.length) {
        for (const f of operands) { const r = await readArg(ctx, f); if (r.error) { ctx.err.write(`column: ${f}: ${r.error}\n`); return 1; } text += r.text; }
      } else text = await ctx.readInput();
      const lines = U.lines(text).filter((l) => l.trim() !== '');
      if (o.t) {
        const rows = lines.map((l) => (o.s ? l.split(new RegExp('[' + U.escapeRe(o.s) + ']+')) : l.trim().split(/\s+/)));
        const cols = Math.max(0, ...rows.map((r) => r.length));
        const w = [];
        for (let c = 0; c < cols; c++) w.push(Math.max(...rows.map((r) => (r[c] || '').length)));
        const osep = o.o !== undefined ? o.o : '  ';
        for (const r of rows) ctx.println(r.map((cell, c) => (c === r.length - 1 ? cell : U.padR(cell, w[c]))).join(osep).replace(/\s+$/, ''));
        return 0;
      }
      const width = o.c ? parseInt(o.c, 10) : (ctx.ui && ctx.ui.columns) || 80;
      for (const l of LA.columns(lines.map((t) => ({ text: t, len: t.length })), width)) ctx.println(l);
      return 0;
    },
  });

  def('rev', {
    async run(ctx) {
      const files = ctx.args.length ? ctx.args : ['-'];
      for (const f of files) {
        const r = await readArg(ctx, f);
        if (r.error) { ctx.err.write(`rev: cannot open ${f}: ${r.error}\n`); return 1; }
        if (r.abs) ctx.noteRead(r.abs);
        ctx.print(U.joinLines(U.lines(r.text).map((l) => [...l].reverse().join(''))));
      }
      return 0;
    },
  });

  def('tac', {
    async run(ctx) {
      const files = ctx.args.length ? ctx.args : ['-'];
      for (const f of files) {
        const r = await readArg(ctx, f);
        if (r.error) { ctx.err.write(`tac: failed to open '${f}' for reading: ${r.error}\n`); return 1; }
        ctx.print(U.joinLines(U.lines(r.text).reverse()));
      }
      return 0;
    },
  });

  def('nl', {
    async run(ctx) {
      const { o, operands } = getopt(ctx.args, { params: 'bswv', long: {} });
      const r = await readArg(ctx, operands[0] || '-');
      if (r.error) { ctx.err.write(`nl: ${operands[0]}: ${r.error}\n`); return 1; }
      let n = parseInt(o.v || '1', 10);
      const width = parseInt(o.w || '6', 10);
      const sep = o.s !== undefined ? o.s : '\t';
      const all = o.b === 'a';
      const out = U.lines(r.text).map((l) => (l === '' && !all ? '' : String(n++).padStart(width) + sep + l));
      ctx.print(U.joinLines(out));
      return 0;
    },
  });

  def('fold', {
    async run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 's', params: 'w', long: { width: 'w=' } });
      const w = parseInt(o.w || '80', 10);
      const r = await readArg(ctx, operands[0] || '-');
      if (r.error) { ctx.err.write(`fold: ${operands[0]}: ${r.error}\n`); return 1; }
      const out = [];
      for (let line of U.lines(r.text)) {
        while (line.length > w) {
          let cut = w;
          if (o.s) { const sp = line.lastIndexOf(' ', w - 1); if (sp > 0) cut = sp + 1; }
          out.push(line.slice(0, cut));
          line = line.slice(cut);
        }
        out.push(line);
      }
      ctx.print(U.joinLines(out));
      return 0;
    },
  });

  /* ---------- seq / expr / bc ---------- */
  def('seq', {
    run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'w', params: 'sf', long: { separator: 's=', 'equal-width': 'w', format: 'f=' }, negNumbers: true });
      if (!operands.length) { ctx.err.write("seq: missing operand\nTry 'seq --help' for more information.\n"); return 1; }
      for (const x of operands) if (isNaN(parseFloat(x))) { ctx.err.write(`seq: invalid floating point argument: '${x}'\nTry 'seq --help' for more information.\n`); return 1; }
      let first = 1, inc = 1, last;
      if (operands.length === 1) last = parseFloat(operands[0]);
      else if (operands.length === 2) { first = parseFloat(operands[0]); last = parseFloat(operands[1]); }
      else { first = parseFloat(operands[0]); inc = parseFloat(operands[1]); last = parseFloat(operands[2]); }
      if (inc === 0) { ctx.err.write("seq: invalid Zero increment value: '0'\n"); return 1; }
      const dec = Math.max(...operands.map((x) => (x.includes('.') ? x.split('.')[1].length : 0)));
      const nums = [];
      for (let v = first, k = 0; inc > 0 ? v <= last + 1e-9 : v >= last - 1e-9; k++, v = first + k * inc) {
        if (nums.length > 100000) break;
        nums.push(v);
      }
      let strs = nums.map((v) => (o.f ? U.sprintf(o.f, [v]).out : v.toFixed(dec)));
      if (o.w) { const w = Math.max(...strs.map((s) => s.length)); strs = strs.map((s) => s.padStart(w, '0')); }
      const sep = o.s !== undefined ? U.unescape(o.s) : '\n';
      if (strs.length) ctx.print(strs.join(sep) + '\n');
      return 0;
    },
  });

  def('expr', {
    run(ctx) {
      const t = ctx.args;
      let p = 0;
      const isInt = (v) => /^-?\d+$/.test(String(v));
      const fail = (m) => { const e = new Error(m); e.quiet = true; throw e; };
      function or() { let a = and(); while (t[p] === '|') { p++; const b = and(); a = a !== '' && a !== '0' && a !== 0 ? a : b; } return a; }
      function and() { let a = cmp(); while (t[p] === '&') { p++; const b = cmp(); a = (a !== '' && String(a) !== '0') && (b !== '' && String(b) !== '0') ? a : 0; } return a; }
      function cmp() {
        let a = add();
        while (['<', '<=', '=', '==', '!=', '>=', '>'].includes(t[p])) {
          const op = t[p++];
          const b = add();
          const both = isInt(a) && isInt(b);
          const x = both ? parseInt(a, 10) : String(a), y = both ? parseInt(b, 10) : String(b);
          a = { '<': x < y, '<=': x <= y, '=': x === y, '==': x === y, '!=': x !== y, '>=': x >= y, '>': x > y }[op] ? 1 : 0;
        }
        return a;
      }
      function add() {
        let a = mul();
        while (t[p] === '+' || t[p] === '-') {
          const op = t[p++];
          const b = mul();
          if (!isInt(a) || !isInt(b)) fail('non-integer argument');
          a = op === '+' ? parseInt(a, 10) + parseInt(b, 10) : parseInt(a, 10) - parseInt(b, 10);
        }
        return a;
      }
      function mul() {
        let a = match();
        while (t[p] === '*' || t[p] === '/' || t[p] === '%') {
          const op = t[p++];
          const b = match();
          if (!isInt(a) || !isInt(b)) fail('non-integer argument');
          const x = parseInt(a, 10), y = parseInt(b, 10);
          if (op !== '*' && y === 0) fail('division by zero');
          a = op === '*' ? x * y : op === '/' ? Math.trunc(x / y) : x % y;
        }
        return a;
      }
      function match() {
        let a = prim();
        while (t[p] === ':') {
          p++;
          const b = prim();
          const m = String(a).match(new RegExp('^' + U.reToJs(String(b), false)));
          a = m ? (m[1] !== undefined ? m[1] : m[0].length) : (/\\\(/.test(String(b)) ? '' : 0);
        }
        return a;
      }
      function prim() {
        const x = t[p++];
        if (x === undefined) fail('syntax error: missing argument after ‘' + (t[p - 2] || '') + '’');
        if (x === '(') { const v = or(); if (t[p] !== ')') fail('syntax error: expecting ‘)’'); p++; return v; }
        if (x === 'length') return String(t[p++] || '').length;
        if (x === 'substr') { const s = String(t[p++]), pos = parseInt(t[p++], 10), len = parseInt(t[p++], 10); return s.substr(pos - 1, len); }
        if (x === 'index') { const s = String(t[p++]), chars = String(t[p++]); let best = 0; for (let i = 0; i < s.length; i++) if (chars.includes(s[i])) { best = i + 1; break; } return best; }
        if (x === 'match') { const s = String(t[p++]), r = String(t[p++]); const m = s.match(new RegExp('^' + U.reToJs(r, false))); return m ? (m[1] !== undefined ? m[1] : m[0].length) : 0; }
        return x;
      }
      if (!t.length) { ctx.err.write("expr: missing operand\nTry 'expr --help' for more information.\n"); return 2; }
      let v;
      try {
        v = or();
        if (p < t.length) fail(`syntax error: unexpected argument ‘${t[p]}’`);
      } catch (e) { ctx.err.write(`expr: ${e.message}\n`); return 2; }
      ctx.println(String(v));
      return v === '' || String(v) === '0' ? 1 : 0;
    },
  });

  def('bc', {
    async run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'lqs' });
      let text = '';
      if (operands.length) { for (const f of operands) { const r = await readArg(ctx, f); if (r.error) { ctx.err.write(`File ${f} is unavailable.\n`); return 1; } text += r.text; } }
      else text = await ctx.readInput();
      const vars = { scale: o.l ? 20 : 0 };
      const fmt = (v, isDiv) => {
        if (!isFinite(v)) return 'Runtime error: divide by zero';
        let s;
        /* a division carries «scale» digits even when it comes out whole: scale=3; 30/5 is 6.000 */
        if (isDiv && vars.scale > 0) s = v.toFixed(Math.min(vars.scale, 20));
        else if (Number.isInteger(v)) s = String(v);
        else {
          const digits = Math.min(20, Math.max(vars.scale, isDiv ? vars.scale : 0) || (String(v).split('.')[1] || '').length);
          s = v.toFixed(Math.min(digits, 20));
          if (!isDiv && s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
        }
        return s.replace(/^(-?)0\./, '$1.');
      };
      const evalExpr = (src) => {
        const toks = src.match(/\d*\.\d+|\d+|[a-z_]\w*|[-+*/%^()]/gi) || [];
        let p = 0;
        let usedDiv = false;
        const trunc = (v) => { const f = Math.pow(10, vars.scale); return Math.trunc(v * f) / f; };
        function expr() { let a = term(); while (toks[p] === '+' || toks[p] === '-') { const op = toks[p++]; const b = term(); a = op === '+' ? a + b : a - b; } return a; }
        function term() {
          let a = pow();
          while (toks[p] === '*' || toks[p] === '/' || toks[p] === '%') {
            const op = toks[p++];
            const b = pow();
            if (op === '*') a = a * b;
            else if (op === '/') { usedDiv = true; a = b === 0 ? Infinity : trunc(a / b); }
            else a = a - b * Math.trunc(a / b);
          }
          return a;
        }
        function pow() { const a = unary(); if (toks[p] === '^') { p++; return Math.pow(a, pow()); } return a; }
        function unary() { if (toks[p] === '-') { p++; return -unary(); } if (toks[p] === '+') { p++; return unary(); } return prim(); }
        function prim() {
          const t = toks[p++];
          if (t === '(') { const v = expr(); if (toks[p] !== ')') throw new Error('syntax error'); p++; return v; }
          if (t !== undefined && /^[\d.]/.test(t)) return parseFloat(t);
          if (t === 'sqrt' && toks[p] === '(') { p++; const v = expr(); p++; return trunc(Math.sqrt(v)); }
          if (t && /^[a-z_]/i.test(t)) return vars[t] || 0;
          throw new Error('syntax error');
        }
        const v = expr();
        if (p < toks.length) throw new Error('syntax error');
        return { v, usedDiv };
      };
      for (const stmt of text.split(/[;\n]/)) {
        const s = stmt.trim();
        if (!s || s === 'quit') continue;
        try {
          const m = s.match(/^([a-z_]\w*)\s*=(?!=)\s*(.*)$/i);
          if (m) { vars[m[1]] = evalExpr(m[2]).v; continue; }
          const r = evalExpr(s);
          ctx.println(fmt(r.v, r.usedDiv));
        } catch (e) { ctx.err.write('(standard_in) 1: syntax error\n'); }
      }
      return 0;
    },
  });

  /* ---------- base64 / hashes ---------- */
  def('base64', {
    async run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'di', params: 'w', long: { decode: 'd', wrap: 'w=' } });
      const r = await readArg(ctx, operands[0] || '-');
      if (r.error) { ctx.err.write(`base64: ${operands[0]}: ${r.error}\n`); return 1; }
      if (o.d) { ctx.print(U.b64decode(r.text)); return 0; }
      const enc = U.b64encode(r.text);
      const w = o.w !== undefined ? parseInt(o.w, 10) : 76;
      if (!w) ctx.println(enc);
      else { const parts = []; for (let i = 0; i < enc.length; i += w) parts.push(enc.slice(i, i + w)); ctx.print(U.joinLines(parts)); }
      return 0;
    },
  });

  function hasher(name, fn) {
    return {
      async run(ctx) {
        const { o, operands } = getopt(ctx.args, { flags: 'cbt', long: { check: 'c', quiet: 'q', status: 's' } });
        const files = operands.length ? operands : ['-'];
        const hashOf = async (f) => {
          if (f === '-') return fn(await ctx.readInput());
          const abs = ctx.abs(f);
          const node = ctx.fs.get(abs, ctx.user);
          if (node.type === 'dir') throw new LA.FsError('EISDIR');
          if (!ctx.fs.can(node, ctx.user, 4)) throw new LA.FsError('EACCES');
          return fn(LA.hashContent(node, ctx.fs));
        };
        if (o.c) {
          let bad = 0, st = 0;
          for (const f of files) {
            const r = await readArg(ctx, f);
            if (r.error) { ctx.err.write(`${name}: ${f}: ${r.error}\n`); st = 1; continue; }
            for (const line of U.lines(r.text)) {
              const m = line.match(/^([0-9a-f]+)\s+\*?(.+)$/);
              if (!m) continue;
              let h;
              try { h = await hashOf(m[2]); } catch (e) { ctx.println(`${m[2]}: FAILED open or read`); bad++; continue; }
              if (h === m[1]) { if (!o.q) ctx.println(`${m[2]}: OK`); }
              else { ctx.println(`${m[2]}: FAILED`); bad++; }
            }
          }
          if (bad) { ctx.err.write(`${name}: WARNING: ${bad} computed checksum${bad > 1 ? 's' : ''} did NOT match\n`); return 1; }
          return st;
        }
        let st = 0;
        for (const f of files) {
          try { ctx.println(`${await hashOf(f)}  ${f}`); }
          catch (e) { ctx.err.write(`${name}: ${f}: ${e.message}\n`); st = 1; }
        }
        return st;
      },
    };
  }
  def('sha256sum', hasher('sha256sum', U.sha256));
  def('md5sum', hasher('md5sum', U.md5));

  /* ---------- xargs ---------- */
  def('xargs', {
    async run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'tr0p', params: 'nIdLP', long: { 'no-run-if-empty': 'r', null: '0', verbose: 't', 'max-args': 'n=', replace: 'I=' }, stopAtOperand: true });
      const cmd = operands.length ? operands : ['echo'];
      const input = await ctx.readInput();
      let items;
      if (o.I !== undefined) items = U.lines(input).map((l) => l.replace(/^\s+/, '')).filter((l) => l !== '');
      else if (o['0']) items = input.split('\0').filter((x) => x !== '');
      else if (o.d !== undefined) items = input.split(U.unescape(o.d)).filter((x) => x !== '');
      else {
        items = [];
        const re = /'([^']*)'|"([^"]*)"|((?:\\.|[^\s'"])+)/g;
        let m;
        while ((m = re.exec(input))) items.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3].replace(/\\(.)/g, '$1'));
      }
      if (!items.length && (o.r || o.I !== undefined)) return 0;
      const batches = [];
      if (o.I !== undefined) for (const it of items) batches.push(cmd.map((a) => a.split(o.I).join(it)));
      else {
        const n = o.n ? parseInt(o.n, 10) : o.L ? parseInt(o.L, 10) : Infinity;
        if (!items.length) batches.push(cmd.slice());
        for (let i = 0; i < items.length; i += n === Infinity ? items.length : n) batches.push(cmd.concat(items.slice(i, i + (n === Infinity ? items.length : n))));
      }
      let st = 0;
      for (const argv of batches) {
        if (o.t || o.p) ctx.err.write(argv.map(U.shq).join(' ') + '\n');
        const r = await ctx.exec(argv, { stdin: new LA.InStream(''), out: ctx.out, err: ctx.err });
        if (r === 127) return 127;
        if (r) st = 123;
        await ctx.shell.tick();
      }
      return st;
    },
  });

  def('yes', {
    interruptible: true,
    async run(ctx) {
      const s = (ctx.args.length ? ctx.args.join(' ') : 'y') + '\n';
      if (!ctx.isTTY) { ctx.print(s.repeat(2000)); return 0; }
      while (!ctx.signal.aborted) {
        ctx.print(s.repeat(20));
        await ctx.sleep(30);
      }
      return 130;
    },
  });

  def('strings', {
    async run(ctx) {
      const r = await readArg(ctx, ctx.args[0] || '-');
      if (r.error) { ctx.err.write(`strings: '${ctx.args[0]}': ${r.error}\n`); return 1; }
      let text = r.text;
      if (r.node && r.node.format) {
        /* a binary file: its magic number, then whatever text is embedded in it */
        const leaves = [];
        const walk = (v) => { if (typeof v === 'string') leaves.push(v); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
        walk(r.node.data);
        const magic = { jpeg: 'JFIF', pdf: '%PDF-1.7', png: 'IHDR', elf: '.ELF', zip: 'PK', gzip: '', tar: 'ustar' }[r.node.format] || '';
        text = [magic].concat(leaves).join('\n');
      }
      const found = text.match(/[\x20-\x7e]{4,}/g) || [];
      ctx.print(U.joinLines(found));
      return 0;
    },
  });
})();
