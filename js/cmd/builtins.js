/* Linux Awakening — shell builtins. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const U = LA.util;
  const VFS = LA.VFS;
  const def = LA.def;

  def('cd', {
    builtin: true,
    run(ctx) {
      const sh = ctx.shell;
      const args = ctx.args.filter((a) => a !== '-L' && a !== '-P');
      if (args.length > 1) { ctx.err.write('bash: cd: too many arguments\n'); return 1; }
      let target = args[0];
      let print = false;
      if (target === undefined || target === '') {
        target = sh.getVar('HOME');
        if (!target) { ctx.err.write('bash: cd: HOME not set\n'); return 1; }
      } else if (target === '-') {
        target = sh.getVar('OLDPWD');
        if (!target) { ctx.err.write('bash: cd: OLDPWD not set\n'); return 1; }
        print = true;
      }
      const shown = args[0] && args[0] !== '-' ? args[0] : target;
      const abs = VFS.normalize(target, sh.cwd);
      let node;
      try { node = ctx.fs.get(abs, ctx.user, true); }
      catch (e) { ctx.err.write(`bash: cd: ${shown}: ${e.message}\n`); return 1; }
      if (node.type !== 'dir') { ctx.err.write(`bash: cd: ${shown}: Not a directory\n`); return 1; }
      if (!ctx.fs.can(node, ctx.user, 1)) { ctx.err.write(`bash: cd: ${shown}: Permission denied\n`); return 1; }
      sh.setVar('OLDPWD', sh.cwd, true);
      sh.cwd = abs;
      sh.setVar('PWD', abs, true);
      if (ctx.game && ctx.game.onCd) ctx.game.onCd(abs, sh);
      if (print) ctx.println(sh.displayPath(abs) === abs ? abs : abs);
      return 0;
    },
  });

  const pwdImpl = {
    run(ctx) {
      if (ctx.args.includes('-P')) {
        try { ctx.println(ctx.fs.realpath(ctx.cwd, ctx.user)); return 0; } catch (e) { ctx.println(ctx.cwd); return 0; }
      }
      ctx.println(ctx.cwd);
      return 0;
    },
  };
  def('pwd', Object.assign({ builtin: true }, pwdImpl));

  const echoImpl = {
    run(ctx) {
      let args = ctx.args;
      let nl = true, esc = false;
      while (args.length && /^-[neE]+$/.test(args[0])) {
        for (const c of args[0].slice(1)) { if (c === 'n') nl = false; else if (c === 'e') esc = true; else esc = false; }
        args = args.slice(1);
      }
      let s = args.join(' ');
      if (esc) {
        s = U.unescape(s);
        const k = s.indexOf('\u0000STOP');
        if (k >= 0) { s = s.slice(0, k); nl = false; }
      }
      ctx.print(s + (nl ? '\n' : ''));
      return 0;
    },
  };
  def('echo', Object.assign({ builtin: true }, echoImpl));

  def('printf', {
    builtin: true,
    run(ctx) {
      let args = ctx.args.slice();
      let toVar = null;
      if (args[0] === '-v') { toVar = args[1]; args = args.slice(2); }
      if (!args.length) { ctx.err.write('printf: usage: printf [-v var] format [arguments]\n'); return 2; }
      let fmt = U.unescape(args[0].replace(/%%/g, '\u0001'));
      fmt = fmt.replace(/\u0001/g, '%%');
      let stop = false;
      const k = fmt.indexOf('\u0000STOP');
      if (k >= 0) { fmt = fmt.slice(0, k); stop = true; }
      let rest = args.slice(1);
      let out = '';
      let guard = 0;
      do {
        const r = U.sprintf(fmt, rest);
        out += r.out;
        if (r.consumed === 0 || stop) break;
        rest = rest.slice(r.consumed);
      } while (rest.length && ++guard < 1000);
      if (toVar) ctx.shell.setVar(toVar, out);
      else ctx.print(out);
      return 0;
    },
  });

  def('export', {
    builtin: true,
    run(ctx) {
      const sh = ctx.shell;
      let args = ctx.args;
      let unexport = false;
      while (args[0] && /^-[pnf]+$/.test(args[0])) { if (args[0].includes('n')) unexport = true; args = args.slice(1); }
      if (!args.length) {
        const keys = [...sh.vars.keys()].filter((k) => sh.vars.get(k).x).sort();
        for (const k of keys) {
          const v = sh.vars.get(k);
          ctx.println(v.unset ? `declare -x ${k}` : `declare -x ${k}="${v.v.replace(/(["\\$`])/g, '\\$1')}"`);
        }
        return 0;
      }
      let st = 0;
      for (const a of args) {
        const m = a.match(/^([A-Za-z_]\w*)(?:(\+?=)([\s\S]*))?$/);
        if (!m) { ctx.err.write(`bash: export: \`${a}': not a valid identifier\n`); st = 1; continue; }
        if (unexport) { const v = sh.vars.get(m[1]); if (v) v.x = false; continue; }
        if (m[2] === '+=') sh.setVar(m[1], (sh.getVar(m[1]) || '') + m[3], true);
        else if (m[2]) sh.setVar(m[1], m[3], true);
        else sh.exportVar(m[1]);
      }
      return st;
    },
  });

  def('unset', {
    builtin: true,
    run(ctx) {
      let args = ctx.args;
      let fn = false;
      while (args[0] && /^-[fv]$/.test(args[0])) { fn = args[0] === '-f'; args = args.slice(1); }
      for (const a of args) {
        if (fn) delete ctx.shell.functions[a];
        else {
          const v = ctx.shell.vars.get(a);
          if (v && v.ro) { ctx.err.write(`bash: unset: ${a}: cannot unset: readonly variable\n`); return 1; }
          ctx.shell.unsetVar(a);
          if (!v) delete ctx.shell.functions[a];
        }
      }
      return 0;
    },
  });

  const aliasQuote = (v) => "'" + v.replace(/'/g, "'\\''") + "'";
  def('alias', {
    builtin: true,
    run(ctx) {
      const sh = ctx.shell;
      const args = ctx.args.filter((a) => a !== '-p');
      if (!args.length) {
        for (const k of Object.keys(sh.aliases).sort()) ctx.println(`alias ${k}=${aliasQuote(sh.aliases[k])}`);
        return 0;
      }
      let st = 0;
      for (const a of args) {
        const eq = a.indexOf('=');
        if (eq > 0) {
          const name = a.slice(0, eq);
          if (!/^[^\s/$`'"=|&;()<>]+$/.test(name)) { ctx.err.write(`bash: alias: \`${name}': invalid alias name\n`); st = 1; continue; }
          sh.aliases[name] = a.slice(eq + 1);
        } else if (Object.prototype.hasOwnProperty.call(sh.aliases, a)) ctx.println(`alias ${a}=${aliasQuote(sh.aliases[a])}`);
        else { ctx.err.write(`bash: alias: ${a}: not found\n`); st = 1; }
      }
      return st;
    },
  });

  def('unalias', {
    builtin: true,
    run(ctx) {
      const sh = ctx.shell;
      if (!ctx.args.length) { ctx.err.write('unalias: usage: unalias [-a] name [name ...]\n'); return 2; }
      if (ctx.args.includes('-a')) { sh.aliases = {}; return 0; }
      let st = 0;
      for (const a of ctx.args) {
        if (Object.prototype.hasOwnProperty.call(sh.aliases, a)) delete sh.aliases[a];
        else { ctx.err.write(`bash: unalias: ${a}: not found\n`); st = 1; }
      }
      return st;
    },
  });

  def('history', {
    builtin: true,
    run(ctx) {
      const sh = ctx.shell;
      const h = sh.history;
      if (ctx.args.includes('-c')) { h.length = 0; return 0; }
      let start = 0;
      const n = ctx.args.find((a) => /^\d+$/.test(a));
      if (n) start = Math.max(0, h.length - parseInt(n, 10));
      const offset = sh.historyOffset || 0;
      for (let i = start; i < h.length; i++) ctx.println(`${String(i + 1 + offset).padStart(5)}  ${h[i]}`);
      return 0;
    },
  });

  def('exit', {
    builtin: true,
    run(ctx) {
      const a = ctx.args[0];
      let code = ctx.shell.lastStatus;
      if (a !== undefined) {
        if (!/^-?\d+$/.test(a)) { ctx.err.write(`bash: exit: ${a}: numeric argument required\n`); code = 2; }
        else code = ((parseInt(a, 10) % 256) + 256) % 256;
      }
      if (ctx.shell.interactive) ctx.err.write('logout\n');
      throw new LA.ExitSignal(code);
    },
  });
  def('logout', { builtin: true, run(ctx) { return LA.commands.exit.run(ctx); } });

  const sourceImpl = {
    builtin: true,
    async run(ctx) {
      const f = ctx.args[0];
      if (!f) { ctx.err.write(`bash: ${ctx.argv[0]}: filename argument required\n`); return 2; }
      const abs = ctx.abs(f);
      let src;
      try { src = ctx.fs.readFile(abs, ctx.user); }
      catch (e) { ctx.err.write(`bash: ${f}: ${e.message}\n`); return 1; }
      ctx.noteRead(abs);
      if (ctx.game) ctx.game.noteSource(abs, ctx.shell);
      return ctx.shell.source(src, f, ctx.args.slice(1), ctx.io);
    },
  };
  def('source', sourceImpl);
  def('.', sourceImpl);

  function describe(sh, name, all) {
    const out = [];
    if (Object.prototype.hasOwnProperty.call(sh.aliases, name)) out.push({ t: 'alias', s: `${name} is aliased to \`${sh.aliases[name]}'` });
    if (LA.keywords.has(name)) out.push({ t: 'keyword', s: `${name} is a shell keyword` });
    if (Object.prototype.hasOwnProperty.call(sh.functions, name)) out.push({ t: 'function', s: `${name} is a function\n${name} () \n{ \n    ${LA.unparse(sh.functions[name]).replace(/^\{ | ?;? ?\}$/g, '')}\n}` });
    if (LA.builtinNames.has(name)) out.push({ t: 'builtin', s: `${name} is a shell builtin` });
    const P = (sh.getVar('PATH') || '').split(':');
    for (const d of P) {
      const p = VFS.normalize(VFS.join(d || '.', name), sh.cwd);
      const n = sh.fs.tryGet(p, sh.user);
      if (n && n.type === 'file' && sh.fs.can(n, sh.user, 1)) {
        out.push({ t: 'file', s: `${name} is ${p}`, p });
        if (!all) break;
      }
    }
    return all ? out : out.slice(0, 1);
  }
  LA.describeCommand = describe;

  def('type', {
    builtin: true,
    run(ctx) {
      let args = ctx.args;
      let terse = false, all = false, pathOnly = false;
      while (args[0] && /^-[atpP]+$/.test(args[0])) {
        if (args[0].includes('t')) terse = true;
        if (args[0].includes('a')) all = true;
        if (/[pP]/.test(args[0])) pathOnly = true;
        args = args.slice(1);
      }
      let st = 0;
      for (const name of args) {
        const d = describe(ctx.shell, name, all);
        if (!d.length) { if (!terse && !pathOnly) ctx.err.write(`bash: type: ${name}: not found\n`); st = 1; continue; }
        for (const x of d) {
          if (terse) ctx.println(x.t);
          else if (pathOnly) { if (x.p) ctx.println(x.p); }
          else ctx.println(x.s);
        }
      }
      return st;
    },
  });

  def('read', {
    builtin: true,
    async run(ctx) {
      const sh = ctx.shell;
      let args = ctx.args.slice();
      let prompt = '', raw = false, silent = false;
      const names = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-p') { prompt = args[++i] || ''; continue; }
        if (a === '-r') { raw = true; continue; }
        if (a === '-s') { silent = true; continue; }
        if (a === '-rs' || a === '-sr') { raw = silent = true; continue; }
        if (/^-[tn]$/.test(a)) { i++; continue; }
        names.push(a);
      }
      if (!names.length) names.push('REPLY');
      let line;
      if (ctx.io.stdin != null) {
        line = ctx.io.stdin.readLine();
        if (line === null) return 1;
      } else {
        if (!ctx.ui || !ctx.ui.prompt) return 1;
        line = await ctx.ui.prompt(prompt, { hidden: silent, signal: sh.signal });
        if (line === null) return 1;
        if (silent) ctx.ui.stderr.write('\n');
      }
      if (!raw) line = line.replace(/\\(.)/g, '$1');
      if (names.length === 1) { sh.setVar(names[0], names[0] === 'REPLY' ? line : line.trim()); return 0; }
      const parts = line.trim().split(/[ \t]+/);
      names.forEach((n, i) => {
        if (i === names.length - 1) sh.setVar(n, parts.slice(i).join(' '));
        else sh.setVar(n, parts[i] || '');
      });
      return 0;
    },
  });

  /* ---- test / [ / [[ ---- */
  class TestErr extends Error {}
  const UNARY = new Set(['-e', '-f', '-d', '-r', '-w', '-x', '-s', '-L', '-h', '-z', '-n', '-b', '-c', '-p', '-S', '-O', '-G', '-t', '-a']);
  const BIN = new Set(['=', '==', '!=', '<', '>', '-eq', '-ne', '-lt', '-le', '-gt', '-ge', '-nt', '-ot', '-ef']);
  function testEval(tokens, ctx, dbl) {
    let p = 0;
    const fs = ctx.fs, user = ctx.user;
    const node = (a, follow = true) => fs.tryGet(ctx.abs(a), user, follow);
    const int = (s) => {
      if (!/^\s*-?\d+\s*$/.test(s)) {
        if (dbl) { try { return LA.arith(s, { get: (k) => ctx.shell.getParam(k), set: () => {} }); } catch (e) { /* fallthrough */ } }
        throw new TestErr(`${s}: integer expression expected`);
      }
      return parseInt(s, 10);
    };
    function unary(op, a) {
      switch (op) {
        case '-z': return a === '';
        case '-n': return a !== '';
        case '-t': return true;
      }
      const n = node(a, !(op === '-L' || op === '-h'));
      if (!n) return false;
      switch (op) {
        case '-e': case '-a': return true;
        case '-f': return n.type === 'file' && !n.special;
        case '-d': return n.type === 'dir';
        case '-L': case '-h': return n.type === 'link';
        case '-r': return fs.can(n, user, 4);
        case '-w': return fs.can(n, user, 2);
        case '-x': return fs.can(n, user, 1);
        case '-s': return n.size > 0;
        case '-b': return n.special === 'block';
        case '-c': return !!n.special && n.special !== 'block';
        case '-O': return n.owner === user;
        case '-G': return fs.users.primaryGroup(user) === n.group;
        default: return false;
      }
    }
    function binary(a, op, b) {
      switch (op) {
        case '=': case '==':
          if (dbl) return U.globRe(b).test(a);
          return a === b;
        case '!=': return dbl ? !U.globRe(b).test(a) : a !== b;
        case '<': return a < b;
        case '>': return a > b;
        case '=~': {
          let re;
          try { re = new RegExp(U.reToJs(b, true)); } catch (e) { throw new TestErr('invalid regular expression'); }
          const m = a.match(re);
          if (m) ctx.shell.setVar('BASH_REMATCH', m[0]);
          return !!m;
        }
        case '-eq': return int(a) === int(b);
        case '-ne': return int(a) !== int(b);
        case '-lt': return int(a) < int(b);
        case '-le': return int(a) <= int(b);
        case '-gt': return int(a) > int(b);
        case '-ge': return int(a) >= int(b);
        case '-nt': { const x = node(a), y = node(b); return !!x && (!y || x.mtime > y.mtime); }
        case '-ot': { const x = node(a), y = node(b); return !!y && (!x || x.mtime < y.mtime); }
        case '-ef': { const x = node(a), y = node(b); return !!x && x === y; }
      }
      return false;
    }
    const isBin = (op) => op !== undefined && (BIN.has(op) || (dbl && op === '=~'));
    const isOr = (t) => (dbl ? t === '||' : t === '-o');
    const isAnd = (t) => (dbl ? t === '&&' : t === '-a');
    function or() { let v = and(); while (p < tokens.length && isOr(tokens[p])) { p++; const r = and(); v = v || r; } return v; }
    function and() { let v = not(); while (p < tokens.length && isAnd(tokens[p])) { p++; const r = not(); v = v && r; } return v; }
    function not() { if (tokens[p] === '!' && p + 1 < tokens.length) { p++; return !not(); } return prim(); }
    function prim() {
      const t = tokens[p];
      if (t === undefined) throw new TestErr('argument expected');
      if (t === '(' && p + 1 < tokens.length) {
        p++;
        const v = or();
        if (tokens[p] !== ')') throw new TestErr("`)' expected");
        p++;
        return v;
      }
      if (isBin(tokens[p + 1]) && p + 2 < tokens.length) {
        const a = t, op = tokens[p + 1], b = tokens[p + 2];
        p += 3;
        return binary(a, op, b);
      }
      if (UNARY.has(t) && p + 1 < tokens.length && !(isAnd(tokens[p + 1]) || isOr(tokens[p + 1]))) {
        p++;
        return unary(t, tokens[p++]);
      }
      p++;
      return t !== '';
    }
    if (!tokens.length) return false;
    const v = or();
    if (p < tokens.length) throw new TestErr(`${tokens[p]}: ${tokens.length > 3 ? 'too many arguments' : 'unary operator expected'}`);
    return v;
  }
  LA.testEval = testEval;

  function testRun(ctx, tokens, label, dbl) {
    try { return testEval(tokens, ctx, dbl) ? 0 : 1; }
    catch (e) {
      if (e instanceof TestErr) { ctx.err.write(`bash: ${label}: ${e.message}\n`); return 2; }
      throw e;
    }
  }
  def('test', { builtin: true, run: (ctx) => testRun(ctx, ctx.args, 'test', false) });
  def('[', {
    builtin: true,
    run(ctx) {
      if (ctx.args[ctx.args.length - 1] !== ']') { ctx.err.write("bash: [: missing `]'\n"); return 2; }
      return testRun(ctx, ctx.args.slice(0, -1), '[', false);
    },
  });
  def('[[', {
    builtin: true,
    run(ctx) { return testRun(ctx, ctx.args.slice(0, -1), '[[', true); },
  });

  def('true', { builtin: true, run: () => 0 });
  def('false', { builtin: true, run: () => 1 });
  def(':', { builtin: true, run: () => 0 });

  def('set', {
    builtin: true,
    run(ctx) {
      const sh = ctx.shell;
      const args = ctx.args;
      if (!args.length) {
        for (const k of [...sh.vars.keys()].sort()) { const v = sh.vars.get(k); if (!v.unset) ctx.println(`${k}=${U.shq(v.v)}`); }
        return 0;
      }
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '--') { sh.positional = args.slice(i + 1); return 0; }
        if (a === '-o' || a === '+o') {
          const opt = args[++i];
          const on = a === '-o';
          if (opt === 'noclobber') sh.noclobber = on;
          else if (opt === 'errexit') sh.errexit = on;
          else if (opt === 'nounset') sh.strictVars = on;
          else if (opt === 'xtrace') sh.xtrace = on;
          else if (opt === 'pipefail') sh.pipefail = on;
          continue;
        }
        if (/^[-+][euxC]+$/.test(a)) {
          const on = a[0] === '-';
          for (const c of a.slice(1)) {
            if (c === 'e') sh.errexit = on;
            if (c === 'u') sh.strictVars = on;
            if (c === 'x') sh.xtrace = on;
            if (c === 'C') sh.noclobber = on;
          }
          continue;
        }
        sh.positional = args.slice(i);
        return 0;
      }
      return 0;
    },
  });

  def('shift', {
    builtin: true,
    run(ctx) {
      const n = ctx.args[0] ? parseInt(ctx.args[0], 10) : 1;
      if (n > ctx.shell.positional.length) return 1;
      ctx.shell.positional = ctx.shell.positional.slice(n);
      return 0;
    },
  });

  def('return', {
    builtin: true,
    run(ctx) {
      const n = ctx.args[0] !== undefined ? parseInt(ctx.args[0], 10) & 255 : ctx.shell.lastStatus;
      throw new LA.ReturnSignal(n);
    },
  });

  def('local', {
    builtin: true,
    run(ctx) {
      const sh = ctx.shell;
      if (!sh.localStack.length) { ctx.err.write('bash: local: can only be used in a function\n'); return 1; }
      const top = sh.localStack[sh.localStack.length - 1];
      for (const a of ctx.args) {
        const eq = a.indexOf('=');
        const name = eq > 0 ? a.slice(0, eq) : a;
        if (!top.has(name)) { const cur = sh.vars.get(name); top.set(name, cur ? Object.assign({}, cur) : undefined); }
        sh.vars.set(name, { v: eq > 0 ? a.slice(eq + 1) : '', x: false });
      }
      return 0;
    },
  });

  def('let', {
    builtin: true,
    run(ctx) {
      let v = 0;
      const sh = ctx.shell;
      for (const a of ctx.args) {
        try { v = LA.arith(a, { get: (k) => sh.getParam(k), set: (k, x) => sh.setVar(k, x) }); }
        catch (e) { ctx.err.write(`bash: let: ${a}: ${e.message}\n`); return 1; }
      }
      return v ? 0 : 1;
    },
  });

  def('eval', {
    builtin: true,
    async run(ctx) {
      const src = ctx.args.join(' ');
      if (!src.trim()) return 0;
      let ast;
      try { ast = LA.parse(src, ctx.shell.aliases); }
      catch (e) { ctx.err.write(`bash: eval: ${e.message}\n`); return 2; }
      return ctx.shell.execList(ast, ctx.io);
    },
  });

  def('break', { builtin: true, run(ctx) { throw new LA.LoopSignal('break', parseInt(ctx.args[0] || '1', 10) || 1); } });
  def('continue', { builtin: true, run(ctx) { throw new LA.LoopSignal('continue', parseInt(ctx.args[0] || '1', 10) || 1); } });

  def('declare', {
    builtin: true,
    run(ctx) {
      const sh = ctx.shell;
      let args = ctx.args;
      let exp = false, ro = false, fns = false;
      while (args[0] && /^[-+][xrfipaA]+$/.test(args[0])) {
        if (args[0].includes('x')) exp = true;
        if (args[0].includes('r')) ro = true;
        if (args[0].includes('f')) fns = true;
        args = args.slice(1);
      }
      if (fns) { for (const k of Object.keys(sh.functions)) ctx.println(`${k} () { ${LA.unparse(sh.functions[k])} }`); return 0; }
      if (!args.length) { for (const [k, v] of sh.vars) ctx.println(`declare ${v.x ? '-x' : '--'} ${k}="${v.v}"`); return 0; }
      for (const a of args) {
        const eq = a.indexOf('=');
        const name = eq > 0 ? a.slice(0, eq) : a;
        if (eq > 0) sh.setVar(name, a.slice(eq + 1), exp || undefined);
        else if (exp) sh.exportVar(name);
        else if (!sh.vars.has(name)) sh.setVar(name, '');
        if (ro) sh.vars.get(name).ro = true;
      }
      return 0;
    },
  });
  def('typeset', { builtin: true, run: (ctx) => LA.commands.declare.run(ctx) });
  def('readonly', {
    builtin: true,
    run(ctx) {
      for (const a of ctx.args) {
        const eq = a.indexOf('=');
        const name = eq > 0 ? a.slice(0, eq) : a;
        if (eq > 0) ctx.shell.setVar(name, a.slice(eq + 1));
        if (!ctx.shell.vars.has(name)) ctx.shell.setVar(name, '');
        ctx.shell.vars.get(name).ro = true;
      }
      return 0;
    },
  });

  def('command', {
    builtin: true,
    async run(ctx) {
      const args = ctx.args;
      if (args[0] === '-v' || args[0] === '-V') {
        let st = 0;
        for (const n of args.slice(1)) {
          const d = describe(ctx.shell, n, false);
          if (!d.length) { st = 1; continue; }
          const x = d[0];
          if (args[0] === '-V') ctx.println(x.s);
          else ctx.println(x.p || (x.t === 'alias' ? `alias ${n}='${ctx.shell.aliases[n]}'` : n));
        }
        return st;
      }
      if (!args.length) return 0;
      return ctx.shell.dispatch(args, ctx.io, { noFunc: true });
    },
  });

  def('time', {
    builtin: true,
    async run(ctx) {
      const t0 = LA.now();
      let st = 0;
      if (ctx.args.length) st = await ctx.shell.dispatch(ctx.args, ctx.io, {});
      const ms = Math.max(1, LA.now() - t0);
      const fmt = (x) => `0m${(x / 1000).toFixed(3)}s`;
      ctx.err.write(`\nreal\t${fmt(ms)}\nuser\t${fmt(Math.floor(ms * 0.3))}\nsys\t${fmt(Math.floor(ms * 0.1))}\n`);
      return st;
    },
  });

  def('umask', {
    builtin: true,
    run(ctx) {
      const sh = ctx.shell;
      const a = ctx.args.filter((x) => x !== '-S');
      if (!a.length) {
        if (ctx.args.includes('-S')) {
          const m = ~sh.umask & 0o777;
          const part = (s) => (m >> s & 4 ? 'r' : '') + (m >> s & 2 ? 'w' : '') + (m >> s & 1 ? 'x' : '');
          ctx.println(`u=${part(6)},g=${part(3)},o=${part(0)}`);
        } else ctx.println(sh.umask.toString(8).padStart(4, '0'));
        return 0;
      }
      if (!/^[0-7]{1,4}$/.test(a[0])) { ctx.err.write(`bash: umask: ${a[0]}: octal number out of range\n`); return 1; }
      sh.umask = parseInt(a[0], 8) & 0o777;
      return 0;
    },
  });

  /* ---- job control ---- */
  def('jobs', {
    builtin: true,
    run(ctx) {
      const sh = ctx.shell;
      const long = ctx.args.includes('-l'), pids = ctx.args.includes('-p');
      sh.jobs.forEach((j, i) => {
        const mark = i === sh.jobs.length - 1 ? '+' : i === sh.jobs.length - 2 ? '-' : ' ';
        if (pids) ctx.println(String(j.pid));
        else ctx.println(`[${j.id}]${mark}  ${long ? j.pid + ' ' : ''}${U.padR(j.state, 23)} ${j.text} &`);
      });
      return 0;
    },
  });

  def('fg', {
    builtin: true,
    interruptible: true,
    async run(ctx) {
      const sh = ctx.shell;
      const job = sh.findJob(ctx.args[0]);
      if (!job) { ctx.err.write(`bash: fg: ${ctx.args[0] || 'current'}: no such job\n`); return 1; }
      ctx.println(job.text);
      job.foreground = true;
      const res = await new Promise((resolve) => {
        job.promise.then((c) => resolve(c));
        ctx.signal.on(() => { job.state = 'Terminated'; job.child.signal.abort(); });
      });
      if (ctx.signal.aborted) return 130;
      return res || 0;
    },
  });

  def('bg', {
    builtin: true,
    run(ctx) {
      const job = ctx.shell.findJob(ctx.args[0]);
      if (!job) { ctx.err.write(`bash: bg: ${ctx.args[0] || 'current'}: no such job\n`); return 1; }
      ctx.err.write(`bash: bg: job ${job.id} already in background\n`);
      return 0;
    },
  });

  def('wait', {
    builtin: true,
    interruptible: true,
    async run(ctx) {
      const sh = ctx.shell;
      const jobs = ctx.args.length ? ctx.args.map((a) => sh.jobs.find((j) => String(j.pid) === a) || sh.findJob(a)).filter(Boolean) : sh.jobs.slice();
      let st = 0;
      for (const j of jobs) {
        st = await new Promise((resolve) => { j.promise.then(resolve); ctx.signal.on(() => resolve(130)); });
        if (ctx.signal.aborted) return 130;
      }
      return st;
    },
  });
})();
