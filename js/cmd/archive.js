/* Linux Awakening — tar, gzip, zip. Archives are stored as structured data. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const U = LA.util;
  const VFS = LA.VFS;
  const def = LA.def;

  function nodeToEntry(fs, node, path) {
    const e = { path, type: node.type, mode: node.mode, owner: node.owner, group: node.group, mtime: node.mtime };
    if (node.type === 'file') {
      if (node.format) { e.format = node.format; e.data = JSON.parse(JSON.stringify(node.data === undefined ? null : node.data)); }
      else e.content = fs.contentOf(node);
      if (node.fixedSize) e.size = node.fixedSize;
    } else if (node.type === 'link') e.target = node.target;
    return e;
  }
  function entrySize(e) {
    if (e.type === 'dir') return 0;
    if (e.size) return e.size;
    if (e.format) return Math.floor(JSON.stringify(e.data || '').length * 0.45) + 120;
    return U.utf8len(e.content || '');
  }
  function writeEntry(fs, abs, e, user, umask) {
    if (e.type === 'dir') {
      if (!fs.tryGet(abs, user)) fs.mkdir(abs, { user, umask: user === 'root' ? 0 : umask, mode: e.mode });
      return;
    }
    if (e.type === 'link') {
      if (fs.tryGet(abs, user, false)) fs.unlink(abs, { user });
      fs.symlink(e.target, abs, { user });
      return;
    }
    const n = e.format
      ? fs.writeFile(abs, '', { user, umask, mode: e.mode, binary: { format: e.format, data: JSON.parse(JSON.stringify(e.data)) } })
      : fs.writeFile(abs, e.content || '', { user, umask, mode: e.mode });
    if (e.size) n.fixedSize = e.size;
    if (user === 'root') { n.owner = e.owner; n.group = e.group; n.mode = e.mode; }
    n.mtime = e.mtime;
  }
  LA.archive = { nodeToEntry, writeEntry, entrySize };

  /* gather entries for paths (recursively) */
  function collect(ctx, operand, entries, verbose, errors) {
    const abs = ctx.abs(operand);
    let node;
    try { node = ctx.fs.get(abs, ctx.user, false); }
    catch (e) { errors.push(`tar: ${operand}: Cannot stat: ${e.message}`); return; }
    let rel = operand.replace(/\/+$/, '') || operand;
    if (rel.startsWith('/')) { rel = rel.replace(/^\/+/, ''); entries.leadingSlash = true; }
    const walk = (n, a, r) => {
      if (n.type === 'dir') {
        entries.push(nodeToEntry(ctx.fs, n, r + '/'));
        if (verbose) verbose(r + '/');
        let kids;
        try { kids = ctx.fs.readdir(a, ctx.user); }
        catch (e) { errors.push(`tar: ${r}: Cannot open: ${e.message}`); return; }
        for (const [name, c] of kids) walk(c, VFS.join(a, name), r + '/' + name);
      } else {
        if (n.type === 'file' && !ctx.fs.can(n, ctx.user, 4)) { errors.push(`tar: ${r}: Cannot open: Permission denied`); return; }
        entries.push(nodeToEntry(ctx.fs, n, r));
        if (verbose) verbose(r);
      }
    };
    walk(node, abs, rel || '.');
  }

  function unwrap(node) {
    let fmt = node.format, data = node.data;
    if (fmt === 'gzip' && data && data.inner) { fmt = data.inner.format; data = data.inner.data; }
    return { fmt, data };
  }

  def('tar', {
    async run(ctx) {
      let args = ctx.args.slice();
      if (args[0] && !args[0].startsWith('-') && /^[a-zA-Z]+$/.test(args[0])) args[0] = '-' + args[0];
      const long = { create: 'c', extract: 'x', get: 'x', list: 't', gzip: 'z', gunzip: 'z', verbose: 'v', file: 'f=', directory: 'C=', 'keep-old-files': 'k' };
      let o, operands;
      try { ({ o, operands } = U.getopt(args, { flags: 'cxtzjJvkpPa', params: 'fC', long })); }
      catch (e) { ctx.err.write(`tar: ${e.message}\nTry 'tar --help' or 'tar --usage' for more information.\n`); return 2; }
      const modes = ['c', 'x', 't'].filter((m) => o[m]);
      if (modes.length !== 1) { ctx.err.write("tar: You must specify one of the '-Acdtrux', '--delete' or '--test-label' options\nTry 'tar --help' or 'tar --usage' for more information.\n"); return 2; }
      const mode = modes[0];
      if (!o.f) { ctx.err.write(`tar: Refusing to ${mode === 'c' ? 'write archive contents to' : 'read archive contents from'} terminal (missing -f option?)\ntar: Error is not recoverable: exiting now\n`); return 2; }
      const fs = ctx.fs;
      const user = ctx.user;
      if (mode === 'c') {
        if (!operands.length) { ctx.err.write('tar: Cowardly refusing to create an empty archive\nTry \'tar --help\' or \'tar --usage\' for more information.\n'); return 2; }
        const entries = [];
        const errors = [];
        const saved = ctx.cwd;
        if (o.C) { const d = ctx.abs(o.C); ctx.shell.cwd = d; }
        try {
          for (const op of operands) collect(ctx, op, entries, o.v ? (p) => ctx.println(p) : null, errors);
        } finally { ctx.shell.cwd = saved; }
        if (entries.leadingSlash) ctx.err.write("tar: Removing leading `/' from member names\n");
        for (const e of errors) ctx.err.write(e + '\n');
        const tarData = { entries: entries.slice() };
        const gz = o.z || /\.(tgz|tar\.gz)$/.test(o.f) && o.a;
        const binary = gz ? { format: 'gzip', data: { name: VFS.basename(o.f).replace(/\.(gz|tgz)$/, (m) => (m === '.tgz' ? '.tar' : '')), inner: { format: 'tar', data: tarData } } } : { format: 'tar', data: tarData };
        try { fs.writeFile(ctx.abs(o.f), '', { user, umask: ctx.shell.umask, binary }); }
        catch (e) { ctx.err.write(`tar: ${o.f}: Cannot open: ${e.message}\ntar: Error is not recoverable: exiting now\n`); return 2; }
        if (ctx.game) ctx.game.onArchive('create', ctx.abs(o.f), entries.map((e) => e.path));
        return errors.length ? 2 : 0;
      }
      const aabs = ctx.abs(o.f);
      let node;
      try {
        node = fs.get(aabs, user);
        if (!fs.can(node, user, 4)) throw new LA.FsError('EACCES');
      } catch (e) { ctx.err.write(`tar: ${o.f}: Cannot open: ${e.message}\ntar: Error is not recoverable: exiting now\n`); return 2; }
      const { fmt, data } = unwrap(node);
      if (fmt !== 'tar' || !data || !data.entries) {
        if (node.format === 'gzip' && !o.z) { /* auto-detected */ }
        ctx.err.write('tar: This does not look like a tar archive\ntar: Exiting with failure status due to previous errors\n');
        return 2;
      }
      let entries = data.entries;
      if (operands.length) entries = entries.filter((e) => operands.some((op) => e.path === op || e.path === op + '/' || e.path.startsWith(op.replace(/\/$/, '') + '/')));
      if (mode === 't') {
        for (const e of entries) {
          if (o.v) {
            const m = LA.modeString({ type: e.type, mode: e.mode });
            ctx.println(`${m} ${U.padR(e.owner + '/' + e.group, 13)} ${U.padL(entrySize(e), 8)} ${U.stamp(e.mtime).slice(0, 16)} ${e.path}${e.type === 'link' ? ' -> ' + e.target : ''}`);
          } else ctx.println(e.path);
        }
        if (ctx.game) ctx.game.onArchive('list', aabs, entries.map((e) => e.path));
        return 0;
      }
      const base = o.C ? ctx.abs(o.C) : ctx.cwd;
      const bnode = fs.tryGet(base, user);
      if (!bnode || bnode.type !== 'dir') { ctx.err.write(`tar: ${o.C || base}: Cannot open: No such file or directory\ntar: Error is not recoverable: exiting now\n`); return 2; }
      let st = 0;
      const written = [];
      for (const e of entries) {
        const abs = VFS.normalize(e.path, base);
        try {
          if (o.k && e.type !== 'dir' && fs.tryGet(abs, user)) { ctx.err.write(`tar: ${e.path}: Cannot open: File exists\n`); st = 2; continue; }
          const parent = VFS.dirname(abs);
          if (!fs.tryGet(parent, user)) fs.mkdir(parent, { user, parents: true, umask: ctx.shell.umask });
          writeEntry(fs, abs, e, user, ctx.shell.umask);
          written.push(abs);
          if (o.v) ctx.println(e.path);
        } catch (err) {
          ctx.err.write(`tar: ${e.path}: Cannot open: ${err.message}\n`);
          st = 2;
        }
      }
      if (st) ctx.err.write('tar: Exiting with failure status due to previous errors\n');
      if (ctx.game) ctx.game.onArchive('extract', aabs, written);
      return st;
    },
  });

  /* ---------- gzip family ---------- */
  async function gzipRun(ctx, forceDecompress, forceStdout) {
    const { o, operands } = U.getopt(ctx.args, { flags: 'dkcvlfrqt123456789', long: { decompress: 'd', keep: 'k', stdout: 'c', 'to-stdout': 'c', verbose: 'v', list: 'l', force: 'f' } });
    const dec = forceDecompress || o.d;
    const toOut = forceStdout || o.c;
    const fs = ctx.fs;
    const name = ctx.argv[0];
    if (!operands.length) {
      if (dec) { ctx.err.write(`${name}: stdin: not in gzip format\n`); return 1; }
      if (ctx.isTTY && !o.f) { ctx.err.write('gzip: compressed data not written to a terminal. Use -f to force compression.\nFor help, type: gzip -h\n'); return 1; }
      ctx.print(U.garbage(7, 80));
      return 0;
    }
    let st = 0;
    if (o.l) ctx.println('         compressed        uncompressed  ratio uncompressed_name');
    for (const f of operands) {
      const abs = ctx.abs(f);
      let node;
      try { node = fs.get(abs, ctx.user); }
      catch (e) { ctx.err.write(`${name}: ${f}: ${e.message}\n`); st = 1; continue; }
      if (node.type === 'dir') { ctx.err.write(`${name}: ${f} is a directory -- ignored\n`); st = 2; continue; }
      if (!fs.can(node, ctx.user, 4)) { ctx.err.write(`${name}: ${f}: Permission denied\n`); st = 1; continue; }
      if (o.l) {
        if (node.format !== 'gzip') { ctx.err.write(`gzip: ${f}: not in gzip format\n`); st = 1; continue; }
        const inner = node.data.inner;
        const usize = inner.format ? Math.floor(JSON.stringify(inner.data).length * 0.45) + 120 : U.utf8len(inner.content || '');
        ctx.println(`${U.padL(node.size, 19)} ${U.padL(usize, 19)} ${U.padL(((1 - node.size / Math.max(1, usize)) * 100).toFixed(1), 5)}% ${f.replace(/\.gz$/, '')}`);
        continue;
      }
      if (dec) {
        if (!/\.(gz|tgz|z)$/.test(f) && !toOut) { ctx.err.write(`${name}: ${f}: unknown suffix -- ignored\n`); st = 2; continue; }
        if (node.format !== 'gzip' || !node.data || !node.data.inner) { ctx.err.write(`${name}: ${f}: not in gzip format\n`); st = 1; continue; }
        const inner = node.data.inner;
        if (toOut) {
          ctx.print(inner.format ? U.garbage(node.ino, 120) + '\n' : inner.content || '');
          if (!inner.format && ctx.noteRead) ctx.noteRead(abs + '#gunzip');
          continue;
        }
        const out = abs.endsWith('.tgz') ? abs.replace(/\.tgz$/, '.tar') : abs.replace(/\.(gz|z)$/, '');
        if (fs.tryGet(out, ctx.user) && !o.f) { ctx.err.write(`${name}: ${VFS.basename(out)} already exists; not overwritten\n`); st = 2; continue; }
        try {
          if (inner.format) fs.writeFile(out, '', { user: ctx.user, umask: ctx.shell.umask, mode: inner.mode || 0o644, binary: { format: inner.format, data: JSON.parse(JSON.stringify(inner.data)) } });
          else fs.writeFile(out, inner.content || '', { user: ctx.user, umask: ctx.shell.umask, mode: inner.mode || 0o644 });
          if (!o.k) fs.unlink(abs, { user: ctx.user });
          if (o.v) ctx.err.write(`${f}:\t ${(40 + (node.ino % 40)).toFixed(1)}% -- replaced with ${VFS.basename(out)}\n`);
        } catch (e) { ctx.err.write(`${name}: ${f}: ${e.message}\n`); st = 1; }
        if (ctx.game) ctx.game.onGzip('decompress', out);
        continue;
      }
      if (/\.(gz|tgz)$/.test(f)) { ctx.err.write(`gzip: ${f} already has .gz suffix -- unchanged\n`); st = 2; continue; }
      const inner = node.format ? { format: node.format, data: node.data, mode: node.mode } : { content: fs.contentOf(node), mode: node.mode };
      const binary = { format: 'gzip', data: { name: VFS.basename(abs), inner: JSON.parse(JSON.stringify(inner)) } };
      if (toOut) { ctx.print(U.garbage(node.ino, 80)); continue; }
      const out = abs + '.gz';
      if (fs.tryGet(out, ctx.user) && !o.f) { ctx.err.write(`gzip: ${VFS.basename(out)} already exists; not overwritten\n`); st = 2; continue; }
      try {
        fs.writeFile(out, '', { user: ctx.user, umask: ctx.shell.umask, mode: node.mode, binary });
        if (!o.k) fs.unlink(abs, { user: ctx.user });
        if (o.v) ctx.err.write(`${f}:\t ${(35 + (node.ino % 40)).toFixed(1)}% -- replaced with ${f}.gz\n`);
      } catch (e) { ctx.err.write(`gzip: ${f}: ${e.message}\n`); st = 1; }
      if (ctx.game) ctx.game.onGzip('compress', out);
    }
    return st;
  }
  def('gzip', { run: (ctx) => gzipRun(ctx, false, false) });
  def('gunzip', { run: (ctx) => gzipRun(ctx, true, false) });
  def('zcat', { run: (ctx) => gzipRun(ctx, true, true) });

  def('zip', {
    async run(ctx) {
      const { o, operands } = U.getopt(ctx.args, { flags: 'rqjv9' , long: { recurse: 'r', quiet: 'q' } });
      if (operands.length < 2) { ctx.err.write('zip error: Nothing to do! (try: zip -r archive.zip folder)\n'); return 12; }
      let name = operands[0];
      if (!/\.zip$/.test(name)) name += '.zip';
      const entries = [];
      const errors = [];
      for (const op of operands.slice(1)) {
        const abs = ctx.abs(op);
        const node = ctx.fs.tryGet(abs, ctx.user);
        if (!node) { ctx.err.write(`\tzip warning: name not matched: ${op}\n`); continue; }
        if (node.type === 'dir' && !o.r) {
          entries.push(nodeToEntry(ctx.fs, node, op.replace(/\/$/, '') + '/'));
          continue;
        }
        collect(ctx, op, entries, null, errors);
      }
      for (const e of entries) if (!o.q) ctx.println(`  adding: ${e.path} (${e.type === 'dir' ? 'stored 0%' : `deflated ${30 + (e.path.length * 7) % 50}%`})`);
      if (!entries.length) { ctx.err.write('\nzip error: Nothing to do! (' + name + ')\n'); return 12; }
      try { ctx.fs.writeFile(ctx.abs(name), '', { user: ctx.user, umask: ctx.shell.umask, binary: { format: 'zip', data: { entries } } }); }
      catch (e) { ctx.err.write(`zip I/O error: ${e.message}\nzip error: Could not create output file (${name})\n`); return 15; }
      return 0;
    },
  });

  def('unzip', {
    async run(ctx) {
      const { o, operands } = U.getopt(ctx.args, { flags: 'lonqv', params: 'd' });
      if (!operands.length) { ctx.err.write((ctx.world.distro === 'debian' ? 'UnZip 6.00 of 20 April 2009, by Debian.' : 'UnZip 6.00 of 20 April 2009, by Info-ZIP.') + '\nUsage: unzip [-Z] [-opts[modifiers]] file[.zip] [list] [-x xlist] [-d exdir]\n'); return 0; }
      let name = operands[0];
      let abs = ctx.abs(name);
      let node = ctx.fs.tryGet(abs, ctx.user);
      if (!node && !/\.zip$/.test(name)) { abs += '.zip'; node = ctx.fs.tryGet(abs, ctx.user); }
      if (!node) { ctx.err.write(`unzip:  cannot find or open ${name}, ${name}.zip or ${name}.ZIP.\n`); return 9; }
      if (node.format !== 'zip' || !node.data) { ctx.err.write(`Archive:  ${name}\n  End-of-central-directory signature not found.  Either this file is not\n  a zipfile, or it constitutes one disk of a multi-part archive.\nunzip:  cannot find zipfile directory in ${name}.\n`); return 9; }
      const entries = node.data.entries;
      if (o.l) {
        ctx.println(`Archive:  ${name}\n  Length      Date    Time    Name\n---------  ---------- -----   ----`);
        let total = 0;
        for (const e of entries) { const s = entrySize(e); total += s; ctx.println(`${U.padL(s, 9)}  ${U.stamp(e.mtime).slice(0, 16)}   ${e.path}`); }
        ctx.println(`---------                     -------\n${U.padL(total, 9)}                     ${entries.length} file${entries.length === 1 ? '' : 's'}`);
        return 0;
      }
      if (!o.q) ctx.println(`Archive:  ${name}`);
      const base = o.d ? ctx.abs(o.d) : ctx.cwd;
      if (o.d && !ctx.fs.tryGet(base, ctx.user)) { try { ctx.fs.mkdir(base, { user: ctx.user, parents: true, umask: ctx.shell.umask }); } catch (e) { ctx.err.write(`checkdir:  cannot create extraction directory: ${o.d}\n`); return 3; } }
      let all = !!o.o, none = !!o.n;
      const written = [];
      for (const e of entries) {
        const tabs = VFS.normalize(e.path, base);
        if (e.type !== 'dir' && ctx.fs.tryGet(tabs, ctx.user)) {
          if (none) continue;
          if (!all) {
            const ans = (await ctx.ui.prompt(`replace ${e.path}? [y]es, [n]o, [A]ll, [N]one, [r]ename: `, { signal: ctx.signal })) || 'n';
            if (ans === 'A') all = true;
            else if (ans === 'N') { none = true; continue; }
            else if (!/^y/.test(ans)) continue;
          }
        }
        try {
          const parent = VFS.dirname(tabs);
          if (!ctx.fs.tryGet(parent, ctx.user)) ctx.fs.mkdir(parent, { user: ctx.user, parents: true, umask: ctx.shell.umask });
          writeEntry(ctx.fs, tabs, e, ctx.user, ctx.shell.umask);
          written.push(tabs);
          if (!o.q) ctx.println(e.type === 'dir' ? `   creating: ${e.path}` : `  inflating: ${e.path}`);
        } catch (err) { ctx.err.write(`error:  cannot create ${e.path}\n        ${err.message}\n`); }
      }
      if (ctx.game) ctx.game.onArchive('unzip', abs, written);
      return 0;
    },
  });
})();
