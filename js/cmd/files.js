/* Linux Awakening — file & directory commands. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const U = LA.util;
  const VFS = LA.VFS;
  const def = LA.def;
  const getopt = U.getopt;

  /* ---------- ls ---------- */
  const C = {
    dir: '\x1b[1;34m', link: '\x1b[1;36m', exec: '\x1b[1;32m', arch: '\x1b[1;31m', img: '\x1b[1;35m',
    dev: '\x1b[1;33m', sticky: '\x1b[30;42m', otherw: '\x1b[34;42m', broken: '\x1b[1;31m', setuid: '\x1b[37;41m',
  };
  function colorFor(name, node, fs) {
    if (node.type === 'dir') {
      if ((node.mode & 0o1002) === 0o1002) return C.sticky;
      if (node.mode & 0o002) return C.otherw;
      return C.dir;
    }
    if (node.type === 'link') return C.link;
    if (node.special) return C.dev;
    if (node.mode & 0o4000) return C.setuid;
    if (node.mode & 0o111) return C.exec;
    if (/\.(tar|gz|tgz|zip|bz2|xz|7z|deb|rpm)$/.test(name)) return C.arch;
    if (/\.(png|jpe?g|gif|bmp|svg)$/.test(name)) return C.img;
    return null;
  }
  LA.lsColor = colorFor;
  function classify(node) {
    if (node.type === 'dir') return '/';
    if (node.type === 'link') return '@';
    if (node.mode & 0o111) return '*';
    return '';
  }
  function columns(items, width) {
    const n = items.length;
    if (!n) return [];
    for (let cols = Math.min(n, Math.max(1, Math.floor(width / 3))); cols >= 1; cols--) {
      const rows = Math.ceil(n / cols);
      const realCols = Math.ceil(n / rows);
      const colW = [];
      for (let c = 0; c < realCols; c++) {
        let w = 0;
        for (let r = 0; r < rows; r++) { const i = c * rows + r; if (i < n) w = Math.max(w, items[i].len); }
        colW.push(w);
      }
      const total = colW.reduce((a, b) => a + b + 2, 0) - 2;
      if (total <= width || cols === 1) {
        const lines = [];
        for (let r = 0; r < rows; r++) {
          let line = '';
          for (let c = 0; c < realCols; c++) {
            const i = c * rows + r;
            if (i >= n) continue;
            const last = c === realCols - 1 || (c + 1) * rows + r >= n;
            line += items[i].text + (last ? '' : ' '.repeat(colW[c] - items[i].len + 2));
          }
          lines.push(line);
        }
        return lines;
      }
    }
    return items.map((x) => x.text);
  }
  LA.columns = columns;

  function nlinkOf(n) {
    if (n.type !== 'dir') return n.nlink || 1;
    let c = 2;
    for (const ch of n.children.values()) if (ch.type === 'dir') c++;
    return c;
  }
  function blocksOf(n) {
    if (n.type === 'dir') return 4;
    if (n.type === 'link' || n.special) return 0;
    return Math.ceil(n.size / 4096) * 4;
  }

  def('ls', {
    run(ctx) {
      let colorOpt = 'auto';
      const args = ctx.args.filter((a) => {
        if (a.startsWith('--color')) { colorOpt = a.includes('=') ? a.split('=')[1] : 'always'; return false; }
        return true;
      });
      const { o, operands } = getopt(args, {
        flags: 'alhARr1tSdFiCnGg',
        long: { all: 'a', 'almost-all': 'A', 'human-readable': 'h', recursive: 'R', reverse: 'r', directory: 'd', classify: 'F', inode: 'i', 'group-directories-first': 'G' },
      });
      const useColor = colorOpt === 'always' || (colorOpt !== 'never' && colorOpt !== 'none' && ctx.isTTY);
      const long = !!(o.l || o.n || o.g);
      const width = (ctx.ui && ctx.ui.columns) || 80;
      const fs = ctx.fs;
      const user = ctx.user;
      let status = 0;

      /* like GNU ls on a terminal: names that a shell would split or expand are shown quoted */
      const shown = (name) => (ctx.isTTY && /[\s'"$`\\*?&;|<>()]/.test(name) ? (name.includes("'") ? `"${name}"` : `'${name}'`) : name);
      const fmtName = (name, node, linkTarget) => {
        let s = shown(name);
        if (useColor) { const c = colorFor(name, node, fs); if (c) s = c + shown(name) + '\x1b[0m'; }
        if (o.F) s += classify(node);
        if (long && node.type === 'link') {
          const t = linkTarget !== undefined ? linkTarget : node.target;
          s += ' -> ' + t;
        }
        return s;
      };
      const sortEntries = (list) => {
        const key = (s) => s.replace(/^\.+/, '').toLowerCase();
        list.sort((a, b) => {
          if (o.t && a.node.mtime !== b.node.mtime) return b.node.mtime - a.node.mtime;
          if (o.S && a.node.size !== b.node.size) return b.node.size - a.node.size;
          const ka = key(a.name), kb = key(b.name);
          if (ka !== kb) return ka < kb ? -1 : 1;
          return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
        });
        if (o.G) list.sort((a, b) => (b.node.type === 'dir') - (a.node.type === 'dir'));
        if (o.r) list.reverse();
        return list;
      };
      const render = (entries, isDirListing) => {
        if (!entries.length) return;
        if (long) {
          const rows = entries.map((e) => {
            const n = e.node;
            let size;
            if (n.special === 'block') size = '8, ' + (e.name.endsWith('1') ? '1' : e.name.endsWith('2') ? '2' : '0');
            else if (n.special) size = '1, 3';
            else size = o.h ? U.human(n.size) : String(n.size);
            const ownerName = o.n ? String(fs.users.uid(n.owner) ?? fs.users.display(n.owner)) : fs.users.display(n.owner);
            const groupName = o.n ? String(fs.users.gidOf(n.group) ?? fs.users.displayGroup(n.group)) : fs.users.displayGroup(n.group);
            return { ino: String(n.ino), perm: LA.modeString(n), nlink: String(nlinkOf(n)), owner: ownerName, group: groupName, size, date: U.lsDate(n.mtime), name: fmtName(e.name, n) };
          });
          const w = (k) => Math.max(...rows.map((r) => r[k].length));
          const wi = w('ino'), wl = w('nlink'), wo = w('owner'), wg = w('group'), ws = w('size');
          if (isDirListing) {
            const total = entries.reduce((a, e) => a + blocksOf(e.node), 0);
            ctx.println('total ' + (o.h ? (total ? U.human(total * 1024) : '0') : total));
          }
          for (const r of rows) {
            ctx.println(`${o.i ? U.padL(r.ino, wi) + ' ' : ''}${r.perm} ${U.padL(r.nlink, wl)} ${U.padR(r.owner, wo)}${o.g ? '' : ' ' + U.padR(r.group, wg)} ${U.padL(r.size, ws)} ${r.date} ${r.name}`);
          }
          return;
        }
        const items = entries.map((e) => {
          const text = (o.i ? e.node.ino + ' ' : '') + fmtName(e.name, e.node);
          return { text, len: U.vlen(text) };
        });
        if (o['1'] || !ctx.isTTY) { for (const it of items) ctx.println(it.text); return; }
        for (const line of columns(items, width)) ctx.println(line);
      };

      const targets = operands.length ? operands : ['.'];
      const files = [], dirs = [];
      for (const t of targets) {
        const abs = ctx.abs(t);
        let node;
        try {
          node = fs.get(abs, user, false);
          if (node.type === 'link' && ((!long && !o.d) || t.endsWith('/'))) node = fs.get(abs, user, true);
        } catch (e) {
          ctx.err.write(`ls: cannot access '${t}': ${e.message}\n`);
          status = 2;
          continue;
        }
        if (node.type === 'dir' && !o.d) dirs.push({ name: t, abs, node });
        else files.push({ name: t, node });
      }
      sortEntries(files);
      render(files, false);
      const showHeaders = targets.length > 1 || o.R;
      let first = files.length === 0;
      const listDir = (d) => {
        if (!first) ctx.println('');
        first = false;
        if (showHeaders) ctx.println(d.name + ':');
        let entries;
        try { entries = fs.readdir(d.abs, user); }
        catch (e) {
          ctx.err.write(`ls: cannot open directory '${d.name}': ${e.message}\n`);
          status = 2;
          return;
        }
        let list = entries.filter(([name]) => o.a || o.A || !name.startsWith('.')).map(([name, node]) => ({ name, node }));
        if (o.a) {
          list.push({ name: '.', node: d.node });
          list.push({ name: '..', node: d.node.parent || d.node });
        }
        sortEntries(list);
        render(list, true);
        if (o.R) {
          for (const e of list) {
            if (e.node.type === 'dir' && e.name !== '.' && e.name !== '..') {
              listDir({ name: VFS.join(d.name, e.name), abs: VFS.join(d.abs, e.name), node: e.node });
            }
          }
        }
      };
      sortEntries(dirs);
      for (const d of dirs) listDir(d);
      return status;
    },
  });
  LA.commands.dir = LA.commands.ls;

  /* ---------- tree ---------- */
  def('tree', {
    run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'adfCnF', params: 'L', long: { noreport: 'N' } });
      const maxL = o.L ? parseInt(o.L, 10) : Infinity;
      const useColor = ctx.isTTY && !o.n;
      const fs = ctx.fs;
      let ndirs = 0, nfiles = 0;
      let status = 0;
      const targets = operands.length ? operands : ['.'];
      for (const t of targets) {
        const abs = ctx.abs(t);
        let root;
        try { root = fs.get(abs, ctx.user); } catch (e) { ctx.println(`${t}  [error opening dir]`); status = 2; continue; }
        ctx.println(useColor && root.type === 'dir' ? C.dir + t + '\x1b[0m' : t);
        const walk = (node, path, prefix, depth) => {
          if (depth > maxL) return;
          let entries;
          try { entries = fs.readdir(path, ctx.user); }
          catch (e) { ctx.println(prefix + '[error opening dir]'); return; }
          entries = entries.filter(([n, c]) => (o.a || !n.startsWith('.')) && (!o.d || c.type === 'dir'));
          entries.sort((a, b) => (a[0].toLowerCase() < b[0].toLowerCase() ? -1 : 1));
          entries.forEach(([name, child], i) => {
            const last = i === entries.length - 1;
            let label = o.f ? VFS.join(path === abs ? t : path, name) : name;
            if (useColor) { const c = colorFor(name, child, fs); if (c) label = c + label + '\x1b[0m'; }
            if (o.F) label += classify(child);
            if (child.type === 'link') label += ' -> ' + child.target;
            ctx.println(prefix + (last ? '└── ' : '├── ') + label);
            if (child.type === 'dir') {
              ndirs++;
              walk(child, VFS.join(path, name), prefix + (last ? '    ' : '│   '), depth + 1);
            } else nfiles++;
          });
        };
        if (root.type === 'dir') walk(root, abs, '', 1);
      }
      if (!o.N) ctx.println(`\n${ndirs} director${ndirs === 1 ? 'y' : 'ies'}${o.d ? '' : `, ${nfiles} file${nfiles === 1 ? '' : 's'}`}`);
      return status;
    },
  });

  /* ---------- cat ---------- */
  def('cat', {
    async run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'nbAEsTv', long: { number: 'n', 'number-nonblank': 'b', 'show-ends': 'E', 'squeeze-blank': 's', 'show-all': 'A' }, dashIsOperand: true });
      const files = operands.length ? operands : ['-'];
      let st = 0;
      let lineNo = 1;
      for (const f of files) {
        let text;
        if (f === '-') text = await ctx.readInput();
        else {
          const abs = ctx.abs(f);
          try {
            const node = ctx.fs.get(abs, ctx.user);
            if (node.type === 'dir') { ctx.err.write(`cat: ${f}: Is a directory\n`); st = 1; continue; }
            text = ctx.fs.readFile(abs, ctx.user);
            ctx.noteRead(abs);
          } catch (e) { ctx.err.write(`cat: ${f}: ${e.message}\n`); st = 1; continue; }
        }
        if (o.s) text = text.replace(/\n{3,}/g, '\n\n');
        if (o.n || o.b || o.E || o.A || o.T) {
          const ls = text.split('\n');
          const trailing = ls[ls.length - 1] === '';
          if (trailing) ls.pop();
          text = ls.map((l) => {
            let x = l;
            if (o.T || o.A) x = x.replace(/\t/g, '^I');
            if (o.E || o.A) x += '$';
            if (o.b ? l !== '' : o.n) x = String(lineNo++).padStart(6) + '\t' + x;
            return x;
          }).join('\n') + (trailing ? '\n' : '');
        }
        ctx.print(text);
      }
      return st;
    },
  });

  /* ---------- touch ---------- */
  def('touch', {
    run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'cam', params: 'dtr' });
      if (!operands.length) { ctx.err.write("touch: missing file operand\nTry 'touch --help' for more information.\n"); return 1; }
      let st = 0;
      for (const f of operands) {
        const abs = ctx.abs(f);
        if (o.c && !ctx.fs.tryGet(abs, ctx.user)) continue;
        try { ctx.fs.touch(abs, { user: ctx.user, umask: ctx.shell.umask }); }
        catch (e) { ctx.err.write(`touch: cannot touch '${f}': ${e.message}\n`); st = 1; }
      }
      return st;
    },
  });

  /* ---------- mkdir / rmdir ---------- */
  def('mkdir', {
    run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'pv', params: 'm', long: { parents: 'p', verbose: 'v', mode: 'm=' } });
      if (!operands.length) { ctx.err.write("mkdir: missing operand\nTry 'mkdir --help' for more information.\n"); return 1; }
      let st = 0;
      const mode = o.m ? parseInt(o.m, 8) : undefined;
      for (const d of operands) {
        const abs = ctx.abs(d);
        try {
          const made = ctx.fs.mkdir(abs, { user: ctx.user, parents: !!o.p, umask: mode !== undefined ? 0 : ctx.shell.umask, mode });
          if (o.v) for (const m of made) ctx.println(`mkdir: created directory '${o.p ? m : d}'`);
        } catch (e) {
          ctx.err.write(`mkdir: cannot create directory '${d}': ${e.message}\n`);
          st = 1;
        }
      }
      return st;
    },
  });

  def('rmdir', {
    run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'pv', long: { parents: 'p', verbose: 'v', 'ignore-fail-on-non-empty': 'I' } });
      if (!operands.length) { ctx.err.write("rmdir: missing operand\nTry 'rmdir --help' for more information.\n"); return 1; }
      let st = 0;
      for (const d of operands) {
        let cur = d;
        for (;;) {
          try {
            ctx.fs.rmdir(ctx.abs(cur), { user: ctx.user });
            if (o.v) ctx.println(`rmdir: removing directory, '${cur}'`);
          } catch (e) {
            if (!(o.I && e.code === 'ENOTEMPTY')) { ctx.err.write(`rmdir: failed to remove '${cur}': ${e.message}\n`); st = 1; }
            break;
          }
          if (!o.p) break;
          const parent = VFS.dirname(cur);
          if (parent === '.' || parent === '/' || parent === cur) break;
          cur = parent;
        }
      }
      return st;
    },
  });

  /* ---------- rm ---------- */
  async function removeTree(ctx, abs, disp, o) {
    let st = 0;
    let entries;
    try { entries = ctx.fs.readdir(abs, ctx.user); }
    catch (e) { ctx.err.write(`rm: cannot remove '${disp}': ${e.message}\n`); return 1; }
    for (const [name, node] of entries) {
      const ca = VFS.join(abs, name), cd = VFS.join(disp, name);
      if (node.type === 'dir') st |= await removeTree(ctx, ca, cd, o);
      else {
        try { ctx.fs.unlink(ca, { user: ctx.user }); if (o.v) ctx.println(`removed '${cd}'`); }
        catch (e) { ctx.err.write(`rm: cannot remove '${cd}': ${e.message}\n`); st = 1; }
      }
    }
    try { ctx.fs.rmdir(abs, { user: ctx.user }); if (o.v) ctx.println(`removed directory '${disp}'`); }
    catch (e) { if (!st) ctx.err.write(`rm: cannot remove '${disp}': ${e.message}\n`); st = 1; }
    return st;
  }
  def('rm', {
    async run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'rRfivdI', long: { recursive: 'r', force: 'f', interactive: 'i', verbose: 'v', dir: 'd', 'no-preserve-root': 'N', 'preserve-root': 'P' } });
      const rec = o.r || o.R;
      if (!operands.length) {
        if (o.f) return 0;
        ctx.err.write("rm: missing operand\nTry 'rm --help' for more information.\n");
        return 1;
      }
      // the city's foundations: a recursive rm aimed at a top-level directory or anyone's home is stopped
      // outright (before anything is deleted), or a curious «sudo rm -rf /*» would end the story
      const foundation = (a) => a !== '/' && (/^\/[^/]+$/.test(a) || /^\/home\/[^/]+$/.test(a));
      if (rec && !operands.includes('/') && operands.some((t) => foundation(ctx.abs(t)))) {
        if (ctx.game) ctx.game.secret('nice_try');
        const hit = operands.find((t) => foundation(ctx.abs(t)));
        ctx.err.write(LA.paint(LA.ansi.byellow, LA.flavor('rmGuard', 'The system refuses.')) + `\nrm: not removing '${hit}': ${LA.flavor('rmGuardWhy', 'everything stands on it')}. (On a real machine nothing would stop you — and «rm -r» has no undo.)\n`);
        return 1;
      }
      let st = 0;
      for (const t of operands) {
        const abs = ctx.abs(t);
        if (abs === '/' && rec) {
          if (ctx.game) ctx.game.secret('nice_try');
          if (!o.N) ctx.err.write("rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe\n");
          else ctx.err.write(LA.paint(LA.ansi.byellow, LA.flavor('rmRoot', 'rm: operation cancelled. Not today.')) + '\n');
          st = 1;
          continue;
        }
        if (/(^|\/)\.\.?\/?$/.test(t)) { ctx.err.write(`rm: refusing to remove '.' or '..' directory: skipping '${t}'\n`); st = 1; continue; }
        let node;
        try { node = ctx.fs.get(abs, ctx.user, false); }
        catch (e) {
          if (!o.f) { ctx.err.write(`rm: cannot remove '${t}': ${e.message}\n`); st = 1; }
          continue;
        }
        if (node.type === 'dir') {
          if (!rec) {
            if (o.d) {
              try { ctx.fs.rmdir(abs, { user: ctx.user }); } catch (e) { ctx.err.write(`rm: cannot remove '${t}': ${e.message}\n`); st = 1; }
              continue;
            }
            ctx.err.write(`rm: cannot remove '${t}': Is a directory\n`);
            st = 1;
            continue;
          }
          if (o.i) {
            const ans = await ctx.ui.prompt(`rm: descend into directory '${t}'? `);
            if (!/^y/i.test(ans || '')) continue;
          }
          st |= await removeTree(ctx, abs, t, o);
          continue;
        }
        if (o.i) {
          const kind = node.type === 'link' ? 'symbolic link' : node.size ? 'regular file' : 'regular empty file';
          const ans = await ctx.ui.prompt(`rm: remove ${kind} '${t}'? `);
          if (!/^y/i.test(ans || '')) continue;
        } else if (!o.f && node.type === 'file' && !ctx.fs.can(node, ctx.user, 2) && ctx.stdinTTY && ctx.ui && ctx.ui.prompt) {
          const ans = await ctx.ui.prompt(`rm: remove write-protected regular file '${t}'? `);
          if (!/^y/i.test(ans || '')) continue;
        }
        try {
          ctx.fs.unlink(abs, { user: ctx.user });
          if (o.v) ctx.println(`removed '${t}'`);
        } catch (e) {
          ctx.err.write(`rm: cannot remove '${t}': ${e.message}\n`);
          st = 1;
        }
      }
      return st ? 1 : 0;
    },
  });

  /* ---------- cp ---------- */
  async function confirm(ctx, q) {
    if (!ctx.ui || !ctx.ui.prompt) return true;
    const a = await ctx.ui.prompt(q);
    return /^y/i.test(a || '');
  }
  def('cp', {
    async run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'rRivnpaf', long: { recursive: 'r', interactive: 'i', verbose: 'v', 'no-clobber': 'n', archive: 'a', force: 'f' } });
      if (operands.length < 2) {
        ctx.err.write(operands.length ? `cp: missing destination file operand after '${operands[0]}'\n` : 'cp: missing file operand\n');
        ctx.err.write("Try 'cp --help' for more information.\n");
        return 1;
      }
      const fs = ctx.fs;
      const user = ctx.user;
      const dst = operands.pop();
      const dabs = ctx.abs(dst);
      const dnode = fs.tryGet(dabs, user);
      if (operands.length > 1 && (!dnode || dnode.type !== 'dir')) { ctx.err.write(`cp: target '${dst}' is not a directory\n`); return 1; }
      let st = 0;
      const copyOne = async (snode, sdisp, target, tdisp) => {
        const existing = fs.tryGet(target, user);
        if (existing) {
          if (existing === snode) { ctx.err.write(`cp: '${sdisp}' and '${tdisp}' are the same file\n`); return 1; }
          if (existing.type === 'dir') { ctx.err.write(`cp: cannot overwrite directory '${tdisp}' with non-directory\n`); return 1; }
          if (o.n) return 0;
          if (o.i && !(await confirm(ctx, `cp: overwrite '${tdisp}'? `))) return 0;
        }
        if (!fs.can(snode, user, 4)) { ctx.err.write(`cp: cannot open '${sdisp}' for reading: Permission denied\n`); return 1; }
        try {
          const n = fs.copyFile(snode, target, { user, umask: ctx.shell.umask });
          if (o.p || o.a) { n.mtime = snode.mtime; n.mode = snode.mode; }
          if (o.v) ctx.println(`'${sdisp}' -> '${tdisp}'`);
        } catch (e) {
          ctx.err.write(`cp: cannot create regular file '${tdisp}': ${e.message}\n`);
          return 1;
        }
        return 0;
      };
      const copyTree = async (sabs, sdisp, target, tdisp) => {
        let r = 0;
        const snode = fs.get(sabs, user);
        if (!fs.tryGet(target, user)) {
          try {
            fs.mkdir(target, { user, umask: 0, mode: snode.mode | 0o700 });
            if (o.v) ctx.println(`'${sdisp}' -> '${tdisp}'`);
          } catch (e) { ctx.err.write(`cp: cannot create directory '${tdisp}': ${e.message}\n`); return 1; }
        }
        let entries;
        try { entries = fs.readdir(sabs, user); }
        catch (e) { ctx.err.write(`cp: cannot access '${sdisp}': ${e.message}\n`); return 1; }
        for (const [name, child] of entries) {
          const cs = VFS.join(sabs, name), ct = VFS.join(target, name);
          if (child.type === 'dir') r |= await copyTree(cs, VFS.join(sdisp, name), ct, VFS.join(tdisp, name));
          else if (child.type === 'link') { try { fs.symlink(child.target, ct, { user }); } catch (e) { r = 1; } }
          else r |= await copyOne(child, VFS.join(sdisp, name), ct, VFS.join(tdisp, name));
        }
        return r;
      };
      for (const s of operands) {
        const sabs = ctx.abs(s);
        let snode;
        try { snode = fs.get(sabs, user); }
        catch (e) { ctx.err.write(`cp: cannot stat '${s}': ${e.message}\n`); st = 1; continue; }
        /* «cp -r dir/. dest» copies what's inside dir, not dir itself */
        const contents = /(^|\/)\.\/*$/.test(s) && snode.type === 'dir';
        const intoDir = dnode && dnode.type === 'dir' && !contents;
        const target = intoDir ? VFS.join(dabs, VFS.basename(sabs)) : dabs;
        const tdisp = intoDir ? VFS.join(dst, VFS.basename(s.replace(/\/+$/, '') || s)) : dst;
        if (snode.type === 'dir') {
          if (!(o.r || o.R || o.a)) { ctx.err.write(`cp: -r not specified; omitting directory '${s}'\n`); st = 1; continue; }
          if (target === sabs || target.startsWith(sabs + '/')) { ctx.err.write(`cp: cannot copy a directory, '${s}', into itself, '${tdisp}'\n`); st = 1; continue; }
          st |= await copyTree(sabs, s, target, tdisp);
        } else st |= await copyOne(snode, s, target, tdisp);
      }
      return st;
    },
  });

  /* ---------- mv ---------- */
  def('mv', {
    async run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'ivnfu', long: { interactive: 'i', verbose: 'v', 'no-clobber': 'n', force: 'f' } });
      if (operands.length < 2) {
        ctx.err.write(operands.length ? `mv: missing destination file operand after '${operands[0]}'\n` : 'mv: missing file operand\n');
        ctx.err.write("Try 'mv --help' for more information.\n");
        return 1;
      }
      const fs = ctx.fs;
      const dst = operands.pop();
      const dabs = ctx.abs(dst);
      const dnode = fs.tryGet(dabs, ctx.user);
      if (operands.length > 1 && (!dnode || dnode.type !== 'dir')) { ctx.err.write(`mv: target '${dst}' is not a directory\n`); return 1; }
      let st = 0;
      for (const s of operands) {
        const sabs = ctx.abs(s);
        try { fs.get(sabs, ctx.user, false); }
        catch (e) { ctx.err.write(`mv: cannot stat '${s}': ${e.message}\n`); st = 1; continue; }
        /* «cp -r dir/. dest» copies what's inside dir, not dir itself */
        const contents = /(^|\/)\.\/*$/.test(s) && snode.type === 'dir';
        const intoDir = dnode && dnode.type === 'dir' && !contents;
        const target = intoDir ? VFS.join(dabs, VFS.basename(sabs)) : dabs;
        const tdisp = intoDir ? VFS.join(dst, VFS.basename(s.replace(/\/+$/, '') || s)) : dst;
        if (target === sabs) { ctx.err.write(`mv: '${s}' and '${tdisp}' are the same file\n`); st = 1; continue; }
        if (target.startsWith(sabs + '/')) { ctx.err.write(`mv: cannot move '${s}' to a subdirectory of itself, '${tdisp}'\n`); st = 1; continue; }
        const existing = fs.tryGet(target, ctx.user, false);
        if (existing) {
          if (o.n) continue;
          if (o.i && !(await confirm(ctx, `mv: overwrite '${tdisp}'? `))) continue;
        }
        try {
          fs.rename(sabs, target, { user: ctx.user });
          if (o.v) ctx.println(`renamed '${s}' -> '${tdisp}'`);
        } catch (e) {
          ctx.err.write(`mv: cannot move '${s}' to '${tdisp}': ${e.message}\n`);
          st = 1;
        }
      }
      return st;
    },
  });

  /* ---------- ln ---------- */
  def('ln', {
    run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'sfvnT', long: { symbolic: 's', force: 'f', verbose: 'v' } });
      if (!operands.length) { ctx.err.write("ln: missing file operand\nTry 'ln --help' for more information.\n"); return 1; }
      const target = operands[0];
      let name = operands[1] || VFS.basename(target);
      let nabs = ctx.abs(name);
      const existing = ctx.fs.tryGet(nabs, ctx.user, true);
      if (existing && existing.type === 'dir' && operands[1] && !o.n) { nabs = VFS.join(nabs, VFS.basename(target)); name = VFS.join(name, VFS.basename(target)); }
      try {
        if (ctx.fs.tryGet(nabs, ctx.user, false)) {
          if (!o.f) { ctx.err.write(`ln: failed to create ${o.s ? 'symbolic ' : 'hard '}link '${name}': File exists\n`); return 1; }
          ctx.fs.unlink(nabs, { user: ctx.user });
        }
        if (o.s) ctx.fs.symlink(target, nabs, { user: ctx.user });
        else {
          const src = ctx.fs.get(ctx.abs(target), ctx.user);
          if (src.type === 'dir') { ctx.err.write(`ln: ${target}: hard link not allowed for directory\n`); return 1; }
          const w = ctx.fs.walk(nabs, ctx.user, false, true);
          if (!ctx.fs.can(w.parent, ctx.user, 2)) throw new LA.FsError('EACCES');
          w.parent.children.set(w.name, src);
          src.nlink = (src.nlink || 1) + 1;
        }
        if (o.v) ctx.println(`'${name}' -> '${target}'`);
      } catch (e) {
        ctx.err.write(`ln: failed to create ${o.s ? 'symbolic ' : 'hard '}link '${name}': ${e.message}\n`);
        return 1;
      }
      return 0;
    },
  });

  /* ---------- file ---------- */
  function describeFile(node, fs) {
    if (node.type === 'dir') return 'directory';
    if (node.type === 'link') return `symbolic link to ${node.target}`;
    if (node.special === 'block') return 'block special (8/0)';
    if (node.special) return 'character special (1/3)';
    switch (node.format) {
      case 'elf': return 'ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, for GNU/Linux 3.2.0, stripped';
      case 'gzip': return `gzip compressed data, was "${(node.data && node.data.name) || 'data'}", last modified: ${new Date(node.mtime).toUTCString().replace(/^\w+, /, '')}, from Unix`;
      case 'tar': return 'POSIX tar archive (GNU)';
      case 'zip': return 'Zip archive data, at least v2.0 to extract, compression method=deflate';
      case 'png': return 'PNG image data, 640 x 480, 8-bit/color RGBA, non-interlaced';
      case 'jpeg': return `JPEG image data, JFIF standard 1.01, resolution (DPI), density 72x72, segment length 16${node.data && node.data.comment ? `, comment: "${node.data.comment}"` : ''}, baseline, precision 8, ${(node.data && node.data.size) || '1280x720'}, components 3`;
      case 'pdf': return `PDF document, version 1.7${node.data && node.data.pages ? `, ${node.data.pages} page(s)` : ''}`;
      case 'so': return 'ELF 64-bit LSB shared object, x86-64, version 1 (GNU/Linux), dynamically linked, stripped';
    }
    const c = node.content;
    if (!c.length) return 'empty';
    if (/^#!.*\b(bash|sh)\b/.test(c)) return 'Bourne-Again shell script, ASCII text executable';
    if (/^#!/.test(c)) return 'a script, ASCII text executable';
    if (/^-----BEGIN OPENSSH PRIVATE KEY/.test(c)) return 'OpenSSH private key';
    if (/^ssh-(ed25519|rsa)/.test(c)) return 'OpenSSH ED25519 public key';
    const ascii = /^[\x00-\x7f]*$/.test(c);
    const long = c.split('\n').some((l) => l.length > 300);
    if (/^[^,\n]+(,[^,\n]+){2,}\n/.test(c) && c.split('\n').length > 3 && /,/.test(c.split('\n')[1] || '')) return 'CSV text';
    return (ascii ? 'ASCII text' : 'Unicode text, UTF-8 text') + (long ? ', with very long lines' : '');
  }
  LA.describeFile = describeFile;
  def('file', {
    run(ctx) {
      const { operands } = getopt(ctx.args, { flags: 'bLi' });
      if (!operands.length) { ctx.err.write('Usage: file [-bchikLlNnprsSvzZ0] [--apple] [--extension] [--mime-encoding]\n'); return 1; }
      const w = Math.max(...operands.map((f) => f.length)) + 1;
      for (const f of operands) {
        const abs = ctx.abs(f);
        let node;
        try { node = ctx.fs.get(abs, ctx.user, false); }
        catch (e) { ctx.println(`${U.padR(f + ':', w)} cannot open \`${f}' (${e.message})`); continue; }
        if (node.type === 'file' && !node.special && !node.format && !ctx.fs.can(node, ctx.user, 4)) { ctx.println(`${U.padR(f + ':', w)} regular file, no read permission`); continue; }
        ctx.println(`${U.padR(f + ':', w)} ${describeFile(node, ctx.fs)}`);
      }
      return 0;
    },
  });

  /* ---------- stat ---------- */
  def('stat', {
    run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'Lt', params: 'c', long: { format: 'c=', printf: 'c=' } });
      if (!operands.length) { ctx.err.write("stat: missing operand\nTry 'stat --help' for more information.\n"); return 1; }
      let st = 0;
      const fs = ctx.fs;
      for (const f of operands) {
        let node;
        try { node = fs.get(ctx.abs(f), ctx.user, !!o.L); }
        catch (e) { ctx.err.write(`stat: cannot statx '${f}': ${e.message}\n`); st = 1; continue; }
        const kind = node.type === 'dir' ? 'directory' : node.type === 'link' ? 'symbolic link' : node.special === 'block' ? 'block special file' : node.special ? 'character special file' : node.size ? 'regular file' : 'regular empty file';
        const uid = fs.users.uid(node.owner), gid = fs.users.gidOf(node.group);
        const oct = (node.mode & 0o7777).toString(8).padStart(4, '0');
        const d = new Date(node.mtime);
        const ts = `${U.stamp(node.mtime)}.${String(node.ino * 7919 % 1e9).padStart(9, '0')} ${U.tzOffset(d)}`;
        if (o.c) {
          const s = o.c.replace(/%([aAUuGgsnFyYNi])/g, (m, c) => ({
            a: (node.mode & 0o7777).toString(8), A: LA.modeString(node), U: node.owner, u: uid, G: node.group, g: gid,
            s: node.size, n: f, F: kind, y: ts, Y: Math.floor(node.mtime / 1000), N: node.type === 'link' ? `'${f}' -> '${node.target}'` : `'${f}'`, i: node.ino,
          }[c]));
          ctx.println(U.unescape(s));
          continue;
        }
        const name = node.type === 'link' ? `${f} -> ${node.target}` : f;
        ctx.println(`  File: ${name}`);
        ctx.println(`  Size: ${U.padR(node.size, 15)}Blocks: ${U.padR(blocksOf(node) * 2, 10)} IO Block: 4096   ${kind}`);
        ctx.println(`Device: 801h/2049d\tInode: ${U.padR(node.ino, 11)} Links: ${nlinkOf(node)}`);
        ctx.println(`Access: (${oct}/${LA.modeString(node)})  Uid: (${U.padL(uid, 5)}/${U.padL(node.owner, 8)})   Gid: (${U.padL(gid, 5)}/${U.padL(node.group, 8)})`);
        ctx.println(`Access: ${ts}`);
        ctx.println(`Modify: ${ts}`);
        ctx.println(`Change: ${ts}`);
        ctx.println(' Birth: -');
      }
      return st;
    },
  });

  /* ---------- path utilities ---------- */
  def('basename', {
    run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'az', params: 's', long: { multiple: 'a', suffix: 's=' } });
      if (!operands.length) { ctx.err.write("basename: missing operand\nTry 'basename --help' for more information.\n"); return 1; }
      let names = operands, suffix = o.s;
      if (!o.a && !o.s) { names = [operands[0]]; suffix = operands[1]; }
      for (const n of names) {
        let b = VFS.basename(n);
        if (suffix && b.endsWith(suffix) && b !== suffix) b = b.slice(0, -suffix.length);
        ctx.println(b);
      }
      return 0;
    },
  });
  def('dirname', {
    run(ctx) {
      if (!ctx.args.length) { ctx.err.write("dirname: missing operand\nTry 'dirname --help' for more information.\n"); return 1; }
      for (const n of ctx.args) ctx.println(VFS.dirname(n));
      return 0;
    },
  });
  def('realpath', {
    run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'emsq' });
      let st = 0;
      for (const f of operands) {
        const abs = ctx.abs(f);
        if (o.s || o.m) { ctx.println(abs); continue; }
        try { ctx.println(ctx.fs.realpath(abs, ctx.user)); }
        catch (e) { if (!o.q) ctx.err.write(`realpath: ${f}: ${e.message}\n`); st = 1; }
      }
      return st;
    },
  });
  def('readlink', {
    run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'femnqsvz' });
      let st = 0;
      for (const f of operands) {
        const abs = ctx.abs(f);
        if (o.f || o.e || o.m) {
          try { ctx.println(ctx.fs.realpath(abs, ctx.user)); } catch (e) { st = 1; }
          continue;
        }
        const n = ctx.fs.tryGet(abs, ctx.user, false);
        if (n && n.type === 'link') ctx.println(n.target);
        else st = 1;
      }
      return st;
    },
  });

  /* ---------- find ---------- */
  class FindErr extends Error {}
  function parseFind(tokens, opts) {
    let p = 0;
    const need = (t) => { if (p >= tokens.length) throw new FindErr(`missing argument to \`${t}'`); return tokens[p++]; };
    function or() {
      let a = and();
      while (tokens[p] === '-o' || tokens[p] === '-or') { p++; a = { k: 'or', a, b: and() }; }
      return a;
    }
    function and() {
      let a = not();
      while (p < tokens.length && tokens[p] !== '-o' && tokens[p] !== '-or' && tokens[p] !== ')') {
        if (tokens[p] === '-a' || tokens[p] === '-and') p++;
        a = { k: 'and', a, b: not() };
      }
      return a;
    }
    function not() {
      if (tokens[p] === '!' || tokens[p] === '-not') { p++; return { k: 'not', a: not() }; }
      return prim();
    }
    function prim() {
      const t = tokens[p++];
      if (t === '(') {
        const e = or();
        if (tokens[p] !== ')') throw new FindErr("invalid expression; I was expecting to find a ')' somewhere but did not see one.");
        p++;
        return e;
      }
      switch (t) {
        case '-name': case '-iname': case '-path': case '-ipath': case '-wholename': case '-type': case '-size': case '-user': case '-group':
        case '-perm': case '-mtime': case '-mmin': case '-newer': case '-links': case '-regex': case '-uid': case '-gid':
          return { k: t.slice(1), v: need(t) };
        case '-maxdepth': case '-mindepth': opts[t.slice(1)] = parseInt(need(t), 10); return { k: 'true' };
        case '-empty': case '-print': case '-print0': case '-delete': case '-true': case '-false': case '-readable': case '-writable':
        case '-executable': case '-ls': case '-prune': case '-nouser': case '-nogroup':
          return { k: t.slice(1) };
        case '-depth': case '-xdev': case '-mount': case '-follow': return { k: 'true' };
        case '-exec': case '-ok': case '-execdir': {
          const cmd = [];
          while (p < tokens.length && tokens[p] !== ';' && tokens[p] !== '+') cmd.push(tokens[p++]);
          if (p >= tokens.length) throw new FindErr(`missing argument to \`${t}'`);
          const plus = tokens[p++] === '+';
          if (!cmd.length) throw new FindErr(`missing argument to \`${t}'`);
          return { k: 'exec', cmd, plus, ok: t === '-ok' };
        }
        case undefined: throw new FindErr('expected an expression');
        default:
          if (t.startsWith('-')) throw new FindErr(`unknown predicate \`${t}'`);
          throw new FindErr(`paths must precede expression: \`${t}'`);
      }
    }
    if (!tokens.length) return null;
    const e = or();
    if (p < tokens.length) throw new FindErr(`unexpected extra predicate '${tokens[p]}'`);
    return e;
  }
  function hasAction(e) {
    if (!e) return false;
    if (['print', 'print0', 'delete', 'exec', 'ls'].includes(e.k)) return true;
    return hasAction(e.a) || hasAction(e.b);
  }
  def('find', {
    async run(ctx) {
      const args = ctx.args;
      let i = 0;
      const paths = [];
      while (i < args.length && !args[i].startsWith('-') && args[i] !== '(' && args[i] !== '!') paths.push(args[i++]);
      if (!paths.length) paths.push('.');
      const opts = {};
      let expr;
      try { expr = parseFind(args.slice(i), opts); }
      catch (e) { if (e instanceof FindErr) { ctx.err.write(`find: ${e.message}\n`); return 1; } throw e; }
      if (!hasAction(expr)) expr = expr ? { k: 'and', a: expr, b: { k: 'print' } } : { k: 'print' };
      const fs = ctx.fs;
      const user = ctx.user;
      const now = LA.now();
      let status = 0;
      const plusExecs = new Map();
      const toDelete = [];
      const sizeTest = (node, v) => {
        const m = v.match(/^([+-]?)(\d+)([bcwkMG]?)$/);
        if (!m) return false;
        const unit = { b: 512, c: 1, w: 2, k: 1024, M: 1048576, G: 1073741824, '': 512 }[m[3]];
        const n = parseInt(m[2], 10);
        const sz = Math.ceil(node.size / unit);
        if (m[1] === '+') return sz > n;
        if (m[1] === '-') return sz < n;
        return sz === n;
      };
      const numTest = (val, v) => {
        const m = v.match(/^([+-]?)(\d+)$/);
        if (!m) return false;
        const n = parseInt(m[2], 10);
        if (m[1] === '+') return val > n;
        if (m[1] === '-') return val < n;
        return val === n;
      };
      const ev = async (e, f) => {
        switch (e.k) {
          case 'and': return (await ev(e.a, f)) && (await ev(e.b, f));
          case 'or': return (await ev(e.a, f)) || (await ev(e.b, f));
          case 'not': return !(await ev(e.a, f));
          case 'true': return true;
          case 'false': return false;
          case 'name': return U.globRe(e.v).test(VFS.basename(f.path) || f.path);
          case 'iname': return U.globRe(e.v, 'i').test(VFS.basename(f.path) || f.path);
          case 'path': case 'wholename': return U.globRe(e.v).test(f.path);
          case 'ipath': return U.globRe(e.v, 'i').test(f.path);
          case 'regex': try { return new RegExp('^' + U.reToJs(e.v, true) + '$').test(f.path); } catch (x) { return false; }
          case 'type': {
            const t = f.node.type === 'dir' ? 'd' : f.node.type === 'link' ? 'l' : f.node.special === 'block' ? 'b' : f.node.special ? 'c' : 'f';
            return e.v.split(',').includes(t);
          }
          case 'size': return sizeTest(f.node, e.v);
          case 'user': return f.node.owner === e.v || String(fs.users.uid(f.node.owner)) === e.v;
          case 'group': return f.node.group === e.v;
          case 'uid': return String(fs.users.uid(f.node.owner)) === e.v;
          case 'gid': return String(fs.users.gidOf(f.node.group)) === e.v;
          case 'nouser': return !fs.users.exists(f.node.owner);
          case 'nogroup': return fs.users.gidOf(f.node.group) == null;
          case 'perm': {
            const m = e.v.match(/^([-/]?)([0-7]+)$/);
            if (!m) return false;
            const want = parseInt(m[2], 8), have = f.node.mode & 0o7777;
            if (m[1] === '-') return (have & want) === want;
            if (m[1] === '/') return (have & want) !== 0 || want === 0;
            return have === want;
          }
          case 'mtime': return numTest(Math.floor((now - f.node.mtime) / 86400000), e.v);
          case 'mmin': return numTest(Math.floor((now - f.node.mtime) / 60000), e.v);
          case 'newer': { const other = fs.tryGet(ctx.abs(e.v), user); return !!other && f.node.mtime > other.mtime; }
          case 'links': return numTest(nlinkOf(f.node), e.v);
          case 'empty': return f.node.type === 'dir' ? f.node.children.size === 0 : f.node.type === 'file' && f.node.size === 0;
          case 'readable': return fs.can(f.node, user, 4);
          case 'writable': return fs.can(f.node, user, 2);
          case 'executable': return fs.can(f.node, user, 1);
          case 'prune': f.prune = true; return true;
          case 'print': ctx.println(f.path); return true;
          case 'print0': ctx.print(f.path + '\0'); return true;
          case 'ls': ctx.println(`${U.padL(f.node.ino, 7)} ${U.padL(blocksOf(f.node), 4)} ${LA.modeString(f.node)} ${U.padL(nlinkOf(f.node), 3)} ${U.padR(f.node.owner, 8)} ${U.padR(f.node.group, 8)} ${U.padL(f.node.size, 8)} ${U.lsDate(f.node.mtime)} ${f.path}`); return true;
          case 'delete': toDelete.push(f); return true;
          case 'exec': {
            if (e.plus) {
              if (!plusExecs.has(e)) plusExecs.set(e, []);
              plusExecs.get(e).push(f.path);
              return true;
            }
            const argv = e.cmd.map((a) => a.split('{}').join(f.path));
            if (e.ok && !(await confirm(ctx, `< ${argv.join(' ')} ... ${f.path} > ? `))) return false;
            const st = await ctx.exec(argv, ctx.io);
            return st === 0;
          }
        }
        return false;
      };
      const minDepth = opts.mindepth || 0;
      const maxDepth = opts.maxdepth === undefined ? Infinity : opts.maxdepth;
      for (const start of paths) {
        const abs = ctx.abs(start);
        let root;
        try { root = fs.get(abs, user, true); }
        catch (e) { ctx.err.write(`find: '${start}': ${e.message}\n`); status = 1; continue; }
        const visit = async (node, disp, absP, depth) => {
          await ctx.shell.tick();
          const f = { node, path: disp, abs: absP, depth };
          if (depth >= minDepth) await ev(expr, f);
          if (node.type === 'dir' && depth < maxDepth && !f.prune) {
            if (!fs.can(node, user, 4) || !fs.can(node, user, 1)) {
              ctx.err.write(`find: '${disp}': Permission denied\n`);
              status = 1;
              return;
            }
            const kids = [...node.children.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
            for (const [name, child] of kids) {
              if (child.virtual && absP === '/' ) { /* still visit /proc */ }
              await visit(child.mount || child, disp === '/' ? '/' + name : disp.replace(/\/$/, '') + '/' + name, VFS.join(absP, name), depth + 1);
            }
          }
        };
        await visit(root, start, abs, 0);
      }
      for (const [e, list] of plusExecs) {
        const argv = [];
        for (const a of e.cmd) { if (a === '{}') argv.push(...list); else argv.push(a); }
        if (!e.cmd.includes('{}')) argv.push(...list);
        await ctx.exec(argv, ctx.io);
      }
      toDelete.sort((a, b) => b.depth - a.depth);
      for (const f of toDelete) {
        try {
          if (f.node.type === 'dir') fs.rmdir(f.abs, { user });
          else fs.unlink(f.abs, { user });
        } catch (e) { ctx.err.write(`find: cannot delete '${f.path}': ${e.message}\n`); status = 1; }
      }
      return status;
    },
  });

  /* ---------- du / df ---------- */
  def('du', {
    run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'shacSbk', params: 'd', long: { summarize: 's', 'human-readable': 'h', all: 'a', total: 'c', 'max-depth': 'd=' } });
      const maxD = o.s ? 0 : o.d !== undefined ? parseInt(o.d, 10) : Infinity;
      const fs = ctx.fs;
      let status = 0;
      let grand = 0;
      const fmt = (k) => (o.h ? (k === 0 ? '0' : U.human(k * 1024)) : String(k));
      const targets = operands.length ? operands : ['.'];
      for (const t of targets) {
        const abs = ctx.abs(t);
        let root;
        try { root = fs.get(abs, ctx.user); } catch (e) { ctx.err.write(`du: cannot access '${t}': ${e.message}\n`); status = 1; continue; }
        const walk = (node, disp, absP, depth) => {
          if (node.type !== 'dir') {
            const k = blocksOf(node);
            if (o.a && depth <= maxD) ctx.println(`${fmt(k)}\t${disp}`);
            return k;
          }
          let total = 4;
          if (!fs.can(node, ctx.user, 4) || !fs.can(node, ctx.user, 1)) {
            ctx.err.write(`du: cannot read directory '${disp}': Permission denied\n`);
            status = 1;
          } else {
            const kids = [...node.children.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
            for (const [name, child] of kids) total += walk(child.mount || child, VFS.join(disp, name), VFS.join(absP, name), depth + 1);
          }
          if (depth <= maxD) ctx.println(`${fmt(total)}\t${disp}`);
          return total;
        };
        if (root.type !== 'dir') { const k = blocksOf(root); ctx.println(`${fmt(k)}\t${t}`); grand += k; }
        else grand += walk(root, t, abs, 0);
      }
      if (o.c) ctx.println(`${fmt(grand)}\ttotal`);
      return status;
    },
  });

  def('df', {
    run(ctx) {
      const { o } = getopt(ctx.args, { flags: 'hTak', long: { 'human-readable': 'h', 'print-type': 'T', all: 'a' } });
      const rows = ctx.world.dfRows();
      const fmt = (k) => (o.h ? U.human(k * 1024) : String(k));
      const head = ['Filesystem', ...(o.T ? ['Type'] : []), o.h ? 'Size' : '1K-blocks', 'Used', o.h ? 'Avail' : 'Available', 'Use%', 'Mounted on'];
      const data = rows.map((r) => [r.fs, ...(o.T ? [r.type] : []), fmt(r.size), fmt(r.used), fmt(r.size - r.used), Math.ceil((r.used / r.size) * 100) + '%', r.mount]);
      const all = [head, ...data];
      const widths = head.map((_, i) => Math.max(i === 0 ? 14 : 5, ...all.map((r) => String(r[i]).length)));
      for (const r of all) {
        ctx.println(r.map((c, i) => {
          if (i === r.length - 1) return c;
          return i === 0 || (o.T && i === 1) ? U.padR(c, widths[i]) : U.padL(c, widths[i]);
        }).join(' '));
      }
      return 0;
    },
  });

  /* ---------- locate / updatedb ---------- */
  LA.UPDATEDB_PRUNE = ['/proc', '/sys', '/dev', '/run'];
  def('updatedb', {
    run(ctx) {
      if (ctx.user !== 'root') { ctx.err.write('updatedb: can not open a temporary file for `/var/lib/plocate/plocate.db\'\n'); return 1; }
      if (ctx.host !== ctx.world.main) return 0;
      ctx.world.updatedb();
      return 0;
    },
  });
  def('locate', {
    run(ctx) {
      const { o, operands } = getopt(ctx.args, { flags: 'icbe', params: 'ln', long: { 'ignore-case': 'i', count: 'c', limit: 'l=', basename: 'b', existing: 'e' } });
      if (!operands.length) { ctx.err.write('locate: no pattern to search for specified\n'); return 1; }
      const limit = o.l || o.n ? parseInt(o.l || o.n, 10) : Infinity;
      const tests = operands.map((p) => {
        if (U.hasGlob(p)) return (s) => U.globRe(p, o.i ? 'i' : '').test(o.b ? VFS.basename(s) : s);
        const pl = o.i ? p.toLowerCase() : p;
        return (s) => (o.i ? (o.b ? VFS.basename(s) : s).toLowerCase() : (o.b ? VFS.basename(s) : s)).includes(pl);
      });
      /* locate searches the database «updatedb» last built — not the disk. New files are missing until the
         next updatedb, and deleted ones linger (unless -e asks for existing files only). */
      const db = ctx.world.locateDb && ctx.host === ctx.world.main ? ctx.world.locateDb.paths : null;
      const paths = db || [...ctx.fs.iterate('/', 'root', { skip: (x) => LA.UPDATEDB_PRUNE.includes(x) })].map(([p]) => p);
      let count = 0;
      for (const p of paths) {
        if (p === '/') continue;
        if (!tests.some((t) => t(p))) continue;
        if (!ctx.fs.tryGet(VFS.dirname(p), ctx.user)) continue;
        if (o.e && !ctx.fs.tryGet(p, 'root', false)) continue;
        count++;
        if (count > limit) break;
        if (!o.c) ctx.println(p);
      }
      if (o.c) ctx.println(String(count));
      return count ? 0 : 1;
    },
  });

  /* ---------- chmod / chown / chgrp ---------- */
  function applyMode(spec, cur, isDir, umask) {
    if (/^[0-7]{1,4}$/.test(spec)) {
      const v = parseInt(spec, 8);
      if (spec.length <= 3 && isDir) return (cur & 0o6000) | v;
      return v;
    }
    let mode = cur;
    for (const clause of spec.split(',')) {
      const m = clause.match(/^([ugoa]*)((?:[-+=][rwxXstugo]*)+)$/);
      if (!m) throw new Error(`invalid mode: '${spec}'`);
      const who = m[1] || '';
      const ops = m[2].match(/[-+=][rwxXstugo]*/g);
      for (const opstr of ops) {
        const op = opstr[0];
        const perms = opstr.slice(1);
        let whoMask = 0;
        const w = who === '' ? 'a' : who;
        if (w.includes('u') || w.includes('a')) whoMask |= 0o4700;
        if (w.includes('g') || w.includes('a')) whoMask |= 0o2070;
        if (w.includes('o') || w.includes('a')) whoMask |= 0o1007;
        let bits = 0;
        if (/^[ugo]$/.test(perms)) {
          const src = perms === 'u' ? (mode >> 6) & 7 : perms === 'g' ? (mode >> 3) & 7 : mode & 7;
          bits = (src << 6) | (src << 3) | src;
        } else {
          for (const p of perms) {
            if (p === 'r') bits |= 0o444;
            if (p === 'w') bits |= 0o222;
            if (p === 'x') bits |= 0o111;
            if (p === 'X' && (isDir || (mode & 0o111))) bits |= 0o111;
            if (p === 's') bits |= 0o6000;
            if (p === 't') bits |= 0o1000;
          }
        }
        bits &= whoMask;
        if (who === '' && op !== '=') bits &= ~umask;
        if (op === '+') mode |= bits;
        else if (op === '-') mode &= ~bits;
        else mode = (mode & ~(whoMask & 0o777)) | bits;
      }
    }
    return mode & 0o7777;
  }
  LA.applyMode = applyMode;
  const octStr = (m) => (m & 0o7777).toString(8).padStart(4, '0');

  def('chmod', {
    run(ctx) {
      const args = ctx.args.slice();
      const flags = { R: false, v: false, c: false, f: false };
      const rest = [];
      for (const a of args) {
        if (/^-[Rvcf]+$/.test(a)) { for (const c of a.slice(1)) flags[c] = true; continue; }
        if (a === '--recursive') { flags.R = true; continue; }
        if (a === '--verbose') { flags.v = true; continue; }
        rest.push(a);
      }
      if (rest.length < 2) {
        ctx.err.write(rest.length ? `chmod: missing operand after '${rest[0]}'\n` : 'chmod: missing operand\n');
        ctx.err.write("Try 'chmod --help' for more information.\n");
        return 1;
      }
      const spec = rest[0];
      try { applyMode(spec, 0o644, false, 0); } catch (e) { ctx.err.write(`chmod: ${e.message}\nTry 'chmod --help' for more information.\n`); return 1; }
      let st = 0;
      const fs = ctx.fs;
      const one = (abs, disp) => {
        let node;
        try { node = fs.get(abs, ctx.user); }
        catch (e) { if (!flags.f) ctx.err.write(`chmod: cannot access '${disp}': ${e.message}\n`); st = 1; return null; }
        const before = node.mode;
        const after = applyMode(spec, before, node.type === 'dir', ctx.shell.umask);
        try {
          fs.chmod(abs, after, { user: ctx.user });
          if (flags.v || (flags.c && before !== after)) {
            if (before === after) ctx.println(`mode of '${disp}' retained as ${octStr(after)} (${LA.modeString(node).slice(1)})`);
            else ctx.println(`mode of '${disp}' changed from ${octStr(before)} (${LA.modeString({ type: 'file', mode: before }).slice(1)}) to ${octStr(after)} (${LA.modeString(node).slice(1)})`);
          }
        } catch (e) {
          if (!flags.f) ctx.err.write(`chmod: changing permissions of '${disp}': ${e.message}\n`);
          st = 1;
        }
        return node;
      };
      const rec = (abs, disp) => {
        const node = one(abs, disp);
        if (!node || node.type !== 'dir' || !flags.R) return;
        let entries;
        try { entries = fs.readdir(abs, ctx.user); } catch (e) { ctx.err.write(`chmod: cannot read directory '${disp}': ${e.message}\n`); st = 1; return; }
        for (const [name, child] of entries) {
          if (child.type === 'link') continue;
          rec(VFS.join(abs, name), VFS.join(disp, name));
        }
      };
      for (const f of rest.slice(1)) rec(ctx.abs(f), f);
      return st;
    },
  });

  function chownRun(ctx, groupOnly) {
    const name = groupOnly ? 'chgrp' : 'chown';
    const flags = { R: false, v: false, h: false, f: false };
    const rest = [];
    for (const a of ctx.args) {
      if (/^-[Rvhfc]+$/.test(a)) { for (const c of a.slice(1)) flags[c] = true; continue; }
      if (a === '--recursive') { flags.R = true; continue; }
      rest.push(a);
    }
    if (rest.length < 2) {
      ctx.err.write(rest.length ? `${name}: missing operand after '${rest[0]}'\n` : `${name}: missing operand\n`);
      ctx.err.write(`Try '${name} --help' for more information.\n`);
      return 1;
    }
    const fs = ctx.fs;
    let owner = null, group = null;
    if (groupOnly) group = rest[0];
    else {
      const m = rest[0].match(/^([^:.]*)(?:[:.](.*))?$/);
      owner = m[1] || null;
      if (m[2] !== undefined) group = m[2] || (owner ? fs.users.primaryGroup(owner) : null);
    }
    if (owner && !fs.users.exists(owner)) { ctx.err.write(`${name}: invalid user: '${rest[0]}'\n`); return 1; }
    if (group && fs.users.gidOf(group) == null) { ctx.err.write(groupOnly ? `chgrp: invalid group: '${group}'\n` : `chown: invalid group: '${rest[0]}'\n`); return 1; }
    let st = 0;
    const one = (abs, disp) => {
      let node;
      try { node = fs.get(abs, ctx.user, !flags.h); }
      catch (e) { ctx.err.write(`${name}: cannot access '${disp}': ${e.message}\n`); st = 1; return null; }
      try {
        const before = `${node.owner}:${node.group}`;
        fs.chown(abs, owner, group, { user: ctx.user, noFollow: flags.h });
        if (flags.v) ctx.println(`changed ownership of '${disp}' from ${before} to ${node.owner}:${node.group}`);
      } catch (e) {
        ctx.err.write(`${name}: changing ${groupOnly ? 'group' : 'ownership'} of '${disp}': ${e.message}\n`);
        st = 1;
      }
      return node;
    };
    const rec = (abs, disp) => {
      const node = one(abs, disp);
      if (!node || node.type !== 'dir' || !flags.R) return;
      let entries;
      try { entries = fs.readdir(abs, ctx.user); } catch (e) { st = 1; return; }
      for (const [n] of entries) rec(VFS.join(abs, n), VFS.join(disp, n));
    };
    for (const f of rest.slice(1)) rec(ctx.abs(f), f);
    return st;
  }
  def('chown', { run: (ctx) => chownRun(ctx, false) });
  def('chgrp', { run: (ctx) => chownRun(ctx, true) });
})();
