/* Linux Awakening — sed. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const U = LA.util;

  class SedErr extends Error {}

  function parseScript(src, ere) {
    let i = 0;
    const n = src.length;
    const ws = () => { while (i < n && (src[i] === ' ' || src[i] === '\t')) i++; };
    const readDelimited = (d) => {
      let s = '';
      while (i < n && src[i] !== d) {
        if (src[i] === '\\' && i + 1 < n) {
          if (src[i + 1] === d) { s += d === '/' ? '\\/' : d; i += 2; continue; }
          if (src[i + 1] === 'n') { s += '\\n'; i += 2; continue; }
          s += src[i] + src[i + 1];
          i += 2;
          continue;
        }
        if (src[i] === '\n') throw new SedErr(`unterminated \`s' command`);
        s += src[i++];
      }
      if (i >= n) throw new SedErr(`unterminated \`s' command`);
      i++;
      return s;
    };
    const mkRe = (pat, flags) => {
      try { return new RegExp(U.reToJs(pat, ere), flags); }
      catch (e) { throw new SedErr(`-e expression #1, char ${i}: Invalid regular expression`); }
    };
    const parseAddr = () => {
      if (src[i] === '$') { i++; return { last: true }; }
      if (/\d/.test(src[i])) {
        let s = '';
        while (i < n && /\d/.test(src[i])) s += src[i++];
        if (src[i] === '~') { i++; let st = ''; while (/\d/.test(src[i])) st += src[i++]; return { first: +s, step: +st }; }
        return { line: parseInt(s, 10) };
      }
      if (src[i] === '/' || src[i] === '\\') {
        let d = '/';
        if (src[i] === '\\') { i++; d = src[i]; }
        i++;
        const pat = readDelimited(d);
        let fl = '';
        while (src[i] === 'I' || src[i] === 'M') { if (src[i] === 'I') fl += 'i'; i++; }
        return { re: mkRe(pat, fl) };
      }
      return null;
    };
    const readText = () => {
      ws();
      if (src[i] === '\\') { i++; if (src[i] === '\n') i++; }
      ws();
      let s = '';
      while (i < n && src[i] !== '\n') {
        if (src[i] === '\\' && i + 1 < n) { s += src[i + 1] === 'n' ? '\n' : src[i + 1]; i += 2; continue; }
        s += src[i++];
      }
      return s;
    };
    function parseList(inBlock) {
      const cmds = [];
      for (;;) {
        while (i < n && /[\s;]/.test(src[i])) i++;
        if (i >= n) { if (inBlock) throw new SedErr('unmatched `{\''); return cmds; }
        if (src[i] === '}') { if (!inBlock) throw new SedErr("unexpected `}'"); i++; return cmds; }
        if (src[i] === '#') { while (i < n && src[i] !== '\n') i++; continue; }
        const cmd = {};
        cmd.a1 = parseAddr();
        if (cmd.a1 && src[i] === ',') { i++; ws(); cmd.a2 = parseAddr(); if (!cmd.a2) { if (src[i] === '+') { i++; let s = ''; while (/\d/.test(src[i])) s += src[i++]; cmd.a2 = { plus: +s }; } else throw new SedErr('unexpected `,\''); } }
        ws();
        if (src[i] === '!') { cmd.neg = true; i++; ws(); }
        const c = src[i++];
        cmd.c = c;
        switch (c) {
          case 's': {
            const d = src[i++];
            if (!d || d === '\n' || d === '\\') throw new SedErr("unterminated `s' command");
            const pat = readDelimited(d);
            const rep = readDelimited(d);
            let flags = '', g = false, p = false, nth = 0, w = null;
            while (i < n && /[gpiIme0-9w]/.test(src[i])) {
              const f = src[i++];
              if (f === 'g') g = true;
              else if (f === 'p') p = true;
              else if (f === 'i' || f === 'I') flags += 'i';
              else if (/\d/.test(f)) { let s = f; while (/\d/.test(src[i])) s += src[i++]; nth = parseInt(s, 10); }
              else if (f === 'w') { w = readText(); break; }
            }
            cmd.re = pat === '' ? null : mkRe(pat, flags + 'g');
            cmd.rep = rep;
            cmd.g = g; cmd.p = p; cmd.nth = nth; cmd.w = w;
            break;
          }
          case 'y': {
            const d = src[i++];
            const a = readDelimited(d).replace(/\\n/g, '\n'), b = readDelimited(d).replace(/\\n/g, '\n');
            if ([...a].length !== [...b].length) throw new SedErr("strings for `y' command are different lengths");
            cmd.from = [...a]; cmd.to = [...b];
            break;
          }
          case 'a': case 'i': case 'c': cmd.text = readText(); break;
          case '{': cmd.block = parseList(true); break;
          case 'd': case 'D': case 'p': case 'P': case '=': case 'n': case 'N': case 'h': case 'H': case 'g': case 'G': case 'x': case 'l': break;
          case 'q': case 'Q': { ws(); let s = ''; while (/\d/.test(src[i])) s += src[i++]; cmd.code = s ? parseInt(s, 10) : 0; break; }
          case 'w': cmd.file = readText(); break;
          case undefined: throw new SedErr('missing command');
          default: throw new SedErr(`unknown command: \`${c}'`);
        }
        cmds.push(cmd);
        ws();
        if (i < n && !/[;\n}#]/.test(src[i])) throw new SedErr(`extra characters after command`);
      }
    }
    return parseList(false);
  }

  function expandRep(rep, m, groups) {
    let out = '';
    for (let k = 0; k < rep.length; k++) {
      const c = rep[k];
      if (c === '\\' && k + 1 < rep.length) {
        const nx = rep[++k];
        if (/\d/.test(nx)) out += nx === '0' ? m : groups[parseInt(nx, 10) - 1] || '';
        else if (nx === 'n') out += '\n';
        else if (nx === 't') out += '\t';
        else out += nx;
        continue;
      }
      if (c === '&') { out += m; continue; }
      out += c;
    }
    return out;
  }

  function run(cmds, lines, opts, io) {
    const out = [];
    let lastRe = null;
    let hold = '';
    let quit = null;
    const state = new Map();
    const total = lines.length;
    const matchAddr = (a, idx, ps) => {
      if (a.last) return idx === total - 1;
      if (a.line !== undefined) return idx + 1 === a.line;
      if (a.step !== undefined) return a.step ? idx + 1 >= a.first && (idx + 1 - a.first) % a.step === 0 : idx + 1 === a.first;
      if (a.re) { a.re.lastIndex = 0; lastRe = a.re; return a.re.test(ps); }
      return false;
    };
    const selected = (cmd, idx, ps) => {
      let r;
      if (!cmd.a1) r = true;
      else if (!cmd.a2) r = matchAddr(cmd.a1, idx, ps);
      else {
        let st = state.get(cmd);
        if (st && st.active) {
          let end = false;
          if (cmd.a2.line !== undefined) end = idx + 1 >= cmd.a2.line;
          else if (cmd.a2.plus !== undefined) end = idx >= st.start + cmd.a2.plus;
          else if (cmd.a2.last) end = idx === total - 1;
          else end = matchAddr(cmd.a2, idx, ps);
          if (end) st.active = false;
          r = true;
        } else if (matchAddr(cmd.a1, idx, ps)) {
          st = { active: true, start: idx };
          state.set(cmd, st);
          if (cmd.a2.line !== undefined && cmd.a2.line <= idx + 1) st.active = false;
          if (cmd.a2.plus === 0) st.active = false;
          r = true;
        } else r = false;
      }
      return cmd.neg ? !r : r;
    };
    let idx = 0;
    for (; idx < lines.length && quit === null; idx++) {
      let ps = lines[idx];
      let deleted = false;
      const append = [];
      const exec = (list) => {
        for (const cmd of list) {
          if (deleted || quit !== null) return;
          if (!selected(cmd, idx, ps)) continue;
          switch (cmd.c) {
            case '{': exec(cmd.block); break;
            case 's': {
              const re = cmd.re || lastRe;
              if (!re) throw new SedErr('no previous regular expression');
              let count = 0, did = false;
              re.lastIndex = 0;
              ps = ps.replace(re, (...args) => {
                const m = args[0];
                const groups = args.slice(1, -2).filter((x) => typeof x !== 'object');
                count++;
                if (cmd.nth ? count === cmd.nth || (cmd.g && count > cmd.nth) : (cmd.g || count === 1)) { did = true; return expandRep(cmd.rep, m, groups); }
                return m;
              });
              if (did && cmd.p) out.push(ps);
              if (did && cmd.w && opts.writeFile) opts.writeFile(cmd.w, ps + '\n');
              break;
            }
            case 'y': ps = [...ps].map((ch) => { const k = cmd.from.indexOf(ch); return k >= 0 ? cmd.to[k] : ch; }).join(''); break;
            case 'p': out.push(ps); break;
            case 'P': out.push(ps.split('\n')[0]); break;
            case 'd': deleted = true; break;
            case 'D': deleted = true; break;
            case '=': out.push(String(idx + 1)); break;
            case 'a': append.push(cmd.text); break;
            case 'i': out.push(cmd.text); break;
            case 'c': {
              const st = state.get(cmd);
              if (!cmd.a2 || !st || !st.active) out.push(cmd.text);
              deleted = true;
              break;
            }
            case 'q': quit = cmd.code; break;
            case 'Q': quit = cmd.code; deleted = true; ps = null; break;
            case 'n': if (!opts.n) out.push(ps); if (idx + 1 < lines.length) ps = lines[++idx]; else { quit = 0; } break;
            case 'N': if (idx + 1 < lines.length) ps += '\n' + lines[++idx]; else { quit = 0; } break;
            case 'h': hold = ps; break;
            case 'H': hold += '\n' + ps; break;
            case 'g': ps = hold; break;
            case 'G': ps += '\n' + hold; break;
            case 'x': { const t = ps; ps = hold; hold = t; break; }
            case 'l': out.push(ps.replace(/\t/g, '\\t') + '$'); break;
            case 'w': if (opts.writeFile) opts.writeFile(cmd.file, ps + '\n'); break;
          }
        }
      };
      exec(cmds);
      if (!deleted && !opts.n && ps !== null) out.push(ps);
      out.push(...append);
    }
    return { out, quit };
  }

  LA.def('sed', {
    async run(ctx) {
      const args = ctx.args;
      const scripts = [];
      const files = [];
      let n = false, inplace = null, ere = false, separate = false;
      for (let k = 0; k < args.length; k++) {
        const a = args[k];
        if (a === '-e' || a === '--expression') { scripts.push(args[++k]); continue; }
        if (a.startsWith('--expression=')) { scripts.push(a.slice(13)); continue; }
        if (a === '-f' || a === '--file') {
          const r = await LA.readArg(ctx, args[++k]);
          if (r.error) { ctx.err.write(`sed: couldn't open file ${args[k]}: ${r.error}\n`); return 1; }
          scripts.push(r.text);
          continue;
        }
        if (a === '-n' || a === '--quiet' || a === '--silent') { n = true; continue; }
        if (a === '-E' || a === '-r' || a === '--regexp-extended') { ere = true; continue; }
        if (a === '-s' || a === '--separate') { separate = true; continue; }
        if (a === '-i' || a === '--in-place') { inplace = ''; continue; }
        if (/^-i./.test(a)) { inplace = a.slice(2); continue; }
        if (a.startsWith('--in-place=')) { inplace = a.slice(11); continue; }
        if (/^-[nErs]+$/.test(a)) { if (a.includes('n')) n = true; if (/[Er]/.test(a)) ere = true; if (a.includes('s')) separate = true; continue; }
        if (/^-[nE]*i$/.test(a)) { if (a.includes('n')) n = true; if (a.includes('E')) ere = true; inplace = ''; continue; }
        if (a.startsWith('-') && a !== '-') { ctx.err.write(`sed: invalid option -- '${a.slice(1, 2)}'\nUsage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...\n`); return 1; }
        files.push(a);
      }
      if (!scripts.length) {
        if (!files.length) { ctx.err.write('Usage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...\n'); return 1; }
        scripts.push(files.shift());
      }
      let cmds;
      try { cmds = parseScript(scripts.join('\n'), ere); }
      catch (e) {
        if (e instanceof SedErr) { ctx.err.write(`sed: -e expression #1, char ${scripts.join('\n').length}: ${e.message}\n`); return 1; }
        throw e;
      }
      const writeFile = (f, text) => {
        try { ctx.fs.writeFile(ctx.abs(f), text, { user: ctx.user, append: true, umask: ctx.shell.umask }); } catch (e) { /* ignore */ }
      };
      if (inplace !== null) {
        if (!files.length) { ctx.err.write('sed: no input files\n'); return 1; }
        let st = 0;
        for (const f of files) {
          const abs = ctx.abs(f);
          let node;
          try { node = ctx.fs.get(abs, ctx.user); }
          catch (e) { ctx.err.write(`sed: can't read ${f}: ${e.message}\n`); st = 2; continue; }
          if (node.type !== 'file') { ctx.err.write(`sed: couldn't edit ${f}: not a regular file\n`); st = 4; continue; }
          let text;
          try { text = ctx.fs.readFile(abs, ctx.user); }
          catch (e) { ctx.err.write(`sed: can't read ${f}: ${e.message}\n`); st = 2; continue; }
          const dir = LA.VFS.dirname(abs);
          const dnode = ctx.fs.tryGet(dir, ctx.user);
          if (!dnode || !ctx.fs.can(dnode, ctx.user, 2) || !ctx.fs.can(node, ctx.user, 2)) {
            ctx.err.write(`sed: couldn't open temporary file ${dir === '/' ? '' : dir}/sed${Math.random().toString(36).slice(2, 8)}: Permission denied\n`);
            st = 4;
            continue;
          }
          let r;
          try { r = run(cmds, U.lines(text), { n, writeFile }); }
          catch (e) { if (e instanceof SedErr) { ctx.err.write(`sed: ${e.message}\n`); return 1; } throw e; }
          try {
            if (inplace) ctx.fs.copyFile(node, abs + inplace, { user: ctx.user, umask: ctx.shell.umask });
            ctx.fs.writeFile(abs, U.joinLines(r.out), { user: ctx.user });
          } catch (e) { ctx.err.write(`sed: couldn't edit ${f}: ${e.message}\n`); st = 4; }
          if (ctx.shell.recRoot) ctx.shell.recRoot.wroteFiles = (ctx.shell.recRoot.wroteFiles || []).concat(abs);
        }
        return st;
      }
      let lines = [];
      let st = 0;
      const inputs = files.length ? files : ['-'];
      const chunks = [];
      for (const f of inputs) {
        const r = await LA.readArg(ctx, f);
        if (r.error) { ctx.err.write(`sed: ${r.code === 'EISDIR' ? `couldn't edit ${f}: not a regular file` : `can't read ${f}: ${r.error}`}\n`); st = 2; continue; }
        chunks.push(U.lines(r.text));
      }
      let res;
      try {
        if (separate) {
          const out = [];
          let quit = null;
          for (const c of chunks) { const r = run(cmds, c, { n, writeFile }); out.push(...r.out); if (r.quit !== null) { quit = r.quit; break; } }
          res = { out, quit };
        } else {
          for (const c of chunks) lines = lines.concat(c);
          res = run(cmds, lines, { n, writeFile });
        }
      } catch (e) {
        if (e instanceof SedErr) { ctx.err.write(`sed: ${e.message}\n`); return 1; }
        throw e;
      }
      ctx.print(U.joinLines(res.out));
      if (res.quit) return res.quit;
      return st;
    },
  });
})();
