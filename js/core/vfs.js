/* Linux Awakening — virtual filesystem with unix permissions. */
(function () {
  'use strict';
  const LA = (globalThis.LA = globalThis.LA || {});
  const U = LA.util;

  const ERRORS = {
    ENOENT: 'No such file or directory', ENOTDIR: 'Not a directory', EISDIR: 'Is a directory',
    EACCES: 'Permission denied', EEXIST: 'File exists', ENOTEMPTY: 'Directory not empty',
    EPERM: 'Operation not permitted', EINVAL: 'Invalid argument', ELOOP: 'Too many levels of symbolic links',
    EBUSY: 'Device or resource busy', EROFS: 'Read-only file system',
  };
  class FsError extends Error {
    constructor(code, path) { super(ERRORS[code] || code); this.code = code; this.path = path; }
  }
  LA.FsError = FsError;
  LA.FS_ERRORS = ERRORS;

  let nextIno = 1000;
  class Node {
    constructor(type, name, o = {}) {
      this.type = type;
      this.name = name;
      this.ino = o.ino || nextIno++;
      this.mode = o.mode != null ? o.mode : type === 'dir' ? 0o755 : type === 'link' ? 0o777 : 0o644;
      this.owner = o.owner || 'root';
      this.group = o.group || this.owner;
      this.mtime = o.mtime || LA.now();
      this.parent = null;
      if (type === 'dir') this.children = new Map();
      else if (type === 'file') {
        this.content = o.content || '';
        if (o.format) this.format = o.format;
        if (o.data !== undefined) this.data = o.data;
        if (o.special) this.special = o.special;
        if (o.size) this.fixedSize = o.size;
      } else if (type === 'link') this.target = o.target;
      if (o.immutable) this.immutable = true;
      if (o.pinned) this.pinned = true;
    }
    get size() {
      if (this.type === 'dir') return 4096;
      if (this.type === 'link') return this.target.length;
      if (this.special) return 0;
      if (this.fixedSize) return this.fixedSize;
      if (this.format) return Math.max(64, Math.floor(JSON.stringify(this.data || '').length * 0.45) + 120);
      return U.utf8len(this.content);
    }
    get isDir() { return this.type === 'dir'; }
  }
  LA.Node = Node;

  /* user / group registry */
  class Users {
    constructor(o) {
      this.users = o.users; // name -> {uid,gid,home,shell,gecos,locked}
      this.groups = o.groups; // name -> {gid, members:[]}
      this.ghosts = o.ghosts || {}; // deleted user/group name -> numeric id (files keep the number)
    }
    /* what ls shows: the name, or the bare number once the account is gone */
    display(name) { return this.users[name] ? name : this.ghosts[name] !== undefined ? String(this.ghosts[name]) : name; }
    displayGroup(name) { return this.groups[name] ? name : this.ghosts['g:' + name] !== undefined ? String(this.ghosts['g:' + name]) : name; }
    get(name) { return this.users[name] || null; }
    exists(name) { return !!this.users[name]; }
    uid(name) { return this.users[name] ? this.users[name].uid : null; }
    gidOf(group) { return this.groups[group] ? this.groups[group].gid : null; }
    groupByGid(gid) { return Object.keys(this.groups).find((g) => this.groups[g].gid === gid) || String(gid); }
    userByUid(uid) { return Object.keys(this.users).find((u) => this.users[u].uid === uid) || String(uid); }
    primaryGroup(name) { const u = this.users[name]; return u ? this.groupByGid(u.gid) : name; }
    inGroup(user, group) {
      if (this.primaryGroup(user) === group) return true;
      const g = this.groups[group];
      return !!(g && g.members.includes(user));
    }
    groupsOf(user) {
      const res = [this.primaryGroup(user)];
      for (const [g, v] of Object.entries(this.groups)) if (v.members.includes(user) && !res.includes(g)) res.push(g);
      return res;
    }
    toJSON() { return { users: this.users, groups: this.groups, ghosts: this.ghosts }; }
  }
  LA.Users = Users;

  class VFS {
    constructor(root, users) {
      this.root = root;
      this.users = users;
    }

    static normalize(p, cwd = '/') {
      if (p === undefined || p === null || p === '') p = '.';
      const abs = p.startsWith('/') ? p : (cwd.endsWith('/') ? cwd : cwd + '/') + p;
      const out = [];
      for (const part of abs.split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') out.pop();
        else out.push(part);
      }
      return '/' + out.join('/');
    }
    static basename(p) {
      if (p === '/') return '/';
      const t = p.replace(/\/+$/, '');
      return t.slice(t.lastIndexOf('/') + 1) || '/';
    }
    static dirname(p) {
      const t = p.replace(/\/+$/, '');
      const i = t.lastIndexOf('/');
      if (i < 0) return '.';
      if (i === 0) return '/';
      return t.slice(0, i);
    }
    static join(a, b) {
      if (!a) return b;
      if (a.endsWith('/')) return a + b;
      return a + '/' + b;
    }

    /* permission check: bit 4=r 2=w 1=x */
    can(node, user, bit) {
      if (user === 'root') {
        if (bit !== 1) return true;
        return node.type === 'dir' || (node.mode & 0o111) !== 0;
      }
      const m = node.mode;
      if (node.owner === user) return ((m >> 6) & bit) !== 0;
      if (this.users.inGroup(user, node.group)) return ((m >> 3) & bit) !== 0;
      return (m & bit) !== 0;
    }

    /* Walk an absolute (normalized) path. Returns {node, parent, name, path}. */
    walk(path, user = 'root', follow = true, allowMissing = false) {
      const queue = path.split('/').filter((x) => x && x !== '.');
      let stack = [this.root];
      let names = [];
      let links = 0;
      while (queue.length) {
        const comp = queue.shift();
        const cur = stack[stack.length - 1];
        if (comp === '..') {
          if (stack.length > 1) { stack.pop(); names.pop(); }
          continue;
        }
        if (cur.type !== 'dir') throw new FsError('ENOTDIR', path);
        if (!this.can(cur, user, 1)) throw new FsError('EACCES', path);
        let child = cur.children.get(comp);
        if (!child) {
          if (allowMissing && queue.length === 0) return { node: null, parent: cur, name: comp, path: '/' + names.concat(comp).join('/') };
          throw new FsError('ENOENT', path);
        }
        if (child.mount) child = child.mount;
        if (child.type === 'link' && (queue.length > 0 || follow)) {
          if (++links > 40) throw new FsError('ELOOP', path);
          const t = child.target;
          if (t.startsWith('/')) { stack = [this.root]; names = []; }
          queue.unshift(...t.split('/').filter((x) => x && x !== '.'));
          continue;
        }
        stack.push(child);
        names.push(comp);
      }
      return { node: stack[stack.length - 1], parent: stack.length > 1 ? stack[stack.length - 2] : null, name: names.length ? names[names.length - 1] : '/', path: '/' + names.join('/') };
    }

    get(path, user = 'root', follow = true) { return this.walk(path, user, follow).node; }
    tryGet(path, user = 'root', follow = true) {
      try { return this.walk(path, user, follow).node; } catch (e) { return null; }
    }
    exists(path) { return !!this.tryGet(path, 'root', true); }
    realpath(path, user = 'root') { return this.walk(path, user, true).path; }
    isDir(path, user = 'root') { const n = this.tryGet(path, user); return !!n && n.type === 'dir'; }

    readdir(path, user = 'root') {
      const n = this.get(path, user, true);
      if (n.type !== 'dir') throw new FsError('ENOTDIR', path);
      if (!this.can(n, user, 4)) throw new FsError('EACCES', path);
      return [...n.children.entries()].map(([k, v]) => [k, v.mount || v]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    }

    readFile(path, user = 'root') {
      const n = this.get(path, user, true);
      if (n.type === 'dir') throw new FsError('EISDIR', path);
      if (!this.can(n, user, 4)) throw new FsError('EACCES', path);
      return this.contentOf(n);
    }
    contentOf(n) {
      if (n.special === 'null') return '';
      if (n.special === 'zero') return '\0\0\0\0\0\0\0\0';
      if (n.special === 'random') return U.garbage(Math.floor(Math.random() * 1e9), 64) + '\n';
      if (n.special) return '';
      if (n.format) return U.garbage(n.ino * 7919 + n.size, Math.min(600, n.size)) + '\n';
      return n.content;
    }

    attach(parent, node) {
      parent.children.set(node.name, node);
      node.parent = parent;
      parent.mtime = LA.now();
    }

    /* inside a filesystem mounted read-only? (mount roots carry the flag; even root can't write there) */
    _ro(node, path) {
      for (let p = node; p; p = p.parent) if (p.readonly) throw new FsError('EROFS', path);
    }
    _checkCreate(parent, user, path) {
      this._ro(parent, path);
      if (!this.can(parent, user, 2)) throw new FsError('EACCES', path);
      if (parent.immutable) throw new FsError('EPERM', path);
    }

    writeFile(path, content, o = {}) {
      const user = o.user || 'root';
      const w = this.walk(path, user, true, true);
      if (w.node) {
        const n = w.node;
        if (n.type === 'dir') throw new FsError('EISDIR', path);
        if (n.special) return n;
        this._ro(n, path);
        if (!this.can(n, user, 2)) throw new FsError('EACCES', path);
        if (n.immutable) throw new FsError('EPERM', path);
        if (o.binary) { n.format = o.binary.format; n.data = o.binary.data; n.content = ''; delete n.fixedSize; }
        else {
          if (n.format) { delete n.format; delete n.data; n.content = ''; }
          n.content = o.append ? n.content + content : content;
          delete n.fixedSize;
        }
        n.mtime = LA.now();
        return n;
      }
      const parent = w.parent;
      if (parent.type !== 'dir') throw new FsError('ENOTDIR', path);
      this._checkCreate(parent, user, path);
      const mode = (o.mode != null ? o.mode : 0o666) & ~(o.umask != null ? o.umask : 0o022);
      const n = new Node('file', w.name, { content: o.binary ? '' : content, owner: user, group: this.groupFor(parent, user), mode });
      if (o.binary) { n.format = o.binary.format; n.data = o.binary.data; }
      this.attach(parent, n);
      return n;
    }

    /* the group of something new: the directory's own group if it is setgid (shared team folders), else the creator's */
    groupFor(parent, user) { return parent && parent.mode & 0o2000 ? parent.group : this.users.primaryGroup(user); }

    mkdir(path, o = {}) {
      const user = o.user || 'root';
      const mode = (o.mode != null ? o.mode : 0o777) & ~(o.umask != null ? o.umask : 0o022);
      if (o.parents) {
        const parts = path.split('/').filter(Boolean);
        let cur = '';
        let made = [];
        for (const p of parts) {
          cur += '/' + p;
          const n = this.tryGet(cur, user);
          if (n) {
            if (n.type !== 'dir') throw new FsError('ENOTDIR', cur);
            continue;
          }
          this.mkdir(cur, { user, mode: o.mode, umask: o.umask });
          made.push(cur);
        }
        return made;
      }
      const w = this.walk(path, user, true, true);
      if (w.node) throw new FsError('EEXIST', path);
      if (w.parent.type !== 'dir') throw new FsError('ENOTDIR', path);
      this._checkCreate(w.parent, user, path);
      /* in a setgid directory, new directories take its group and stay setgid themselves */
      const n = new Node('dir', w.name, { owner: user, group: this.groupFor(w.parent, user), mode: mode | (w.parent.mode & 0o2000) });
      this.attach(w.parent, n);
      return [path];
    }

    _checkDelete(parent, node, user, path) {
      this._ro(parent, path);
      if (!this.can(parent, user, 2)) throw new FsError('EACCES', path);
      if (parent.immutable || node.immutable || node.pinned) throw new FsError('EPERM', path);
      if ((parent.mode & 0o1000) && user !== 'root' && node.owner !== user && parent.owner !== user) throw new FsError('EPERM', path);
    }

    rmdir(path, o = {}) {
      const user = o.user || 'root';
      const w = this.walk(path, user, false);
      const n = w.node;
      if (n === this.root) throw new FsError('EBUSY', path);
      if (n.type !== 'dir') throw new FsError('ENOTDIR', path);
      if (n.children.size) throw new FsError('ENOTEMPTY', path);
      const parentNode = w.parent;
      const holder = this._holder(parentNode, w.name);
      if (holder && holder.mount) throw new FsError('EBUSY', path);
      this._checkDelete(parentNode, n, user, path);
      parentNode.children.delete(w.name);
      parentNode.mtime = LA.now();
    }
    _holder(parent, name) { return parent && parent.children ? parent.children.get(name) : null; }

    unlink(path, o = {}) {
      const user = o.user || 'root';
      const w = this.walk(path, user, false);
      const n = w.node;
      if (n.type === 'dir') throw new FsError('EISDIR', path);
      this._checkDelete(w.parent, n, user, path);
      w.parent.children.delete(w.name);
      w.parent.mtime = LA.now();
    }

    rename(src, dst, o = {}) {
      const user = o.user || 'root';
      const s = this.walk(src, user, false);
      if (s.node === this.root) throw new FsError('EBUSY', src);
      this._checkDelete(s.parent, s.node, user, src);
      const d = this.walk(dst, user, false, true);
      if (d.parent.type !== 'dir') throw new FsError('ENOTDIR', dst);
      // moving a directory inside itself?
      if (s.node.type === 'dir') {
        let p = d.parent;
        while (p) { if (p === s.node) throw new FsError('EINVAL', dst); p = p.parent; }
      }
      this._checkCreate(d.parent, user, dst);
      if (d.node) {
        if (d.node === s.node) return;
        if (d.node.type === 'dir') {
          if (s.node.type !== 'dir') throw new FsError('EISDIR', dst);
          if (d.node.children.size) throw new FsError('ENOTEMPTY', dst);
        } else if (s.node.type === 'dir') throw new FsError('ENOTDIR', dst);
        if (d.node.immutable) throw new FsError('EPERM', dst);
      }
      s.parent.children.delete(s.name);
      s.parent.mtime = LA.now();
      s.node.name = d.name;
      this.attach(d.parent, s.node);
    }

    symlink(target, path, o = {}) {
      const user = o.user || 'root';
      const w = this.walk(path, user, false, true);
      if (w.node) throw new FsError('EEXIST', path);
      this._checkCreate(w.parent, user, path);
      const n = new Node('link', w.name, { target, owner: user, group: this.groupFor(w.parent, user) });
      this.attach(w.parent, n);
      return n;
    }

    /* copy a single file node to dst path (creating/overwriting) */
    copyFile(srcNode, dst, o = {}) {
      const user = o.user || 'root';
      if (srcNode.format) {
        const n = this.writeFile(dst, '', { user, umask: o.umask, mode: srcNode.mode, binary: { format: srcNode.format, data: JSON.parse(JSON.stringify(srcNode.data === undefined ? null : srcNode.data)) } });
        if (srcNode.fixedSize) n.fixedSize = srcNode.fixedSize;
        return n;
      }
      const n = this.writeFile(dst, this.contentOf(srcNode), { user, umask: o.umask, mode: srcNode.mode });
      if (srcNode.fixedSize) n.fixedSize = srcNode.fixedSize;
      return n;
    }

    chmod(path, mode, o = {}) {
      const user = o.user || 'root';
      const n = this.get(path, user, true);
      this._ro(n, path);
      if (user !== 'root' && n.owner !== user) throw new FsError('EPERM', path);
      if (n.immutable || n.pinned) throw new FsError('EPERM', path);
      n.mode = mode & 0o7777;
    }

    chown(path, owner, group, o = {}) {
      const user = o.user || 'root';
      const n = this.get(path, user, !o.noFollow);
      this._ro(n, path);
      if (n.immutable || n.pinned) throw new FsError('EPERM', path);
      if (user !== 'root') {
        if (owner && owner !== n.owner) throw new FsError('EPERM', path);
        if (n.owner !== user) throw new FsError('EPERM', path);
        if (group && !this.users.inGroup(user, group)) throw new FsError('EPERM', path);
      }
      if (owner) n.owner = owner;
      if (group) n.group = group;
    }

    touch(path, o = {}) {
      const user = o.user || 'root';
      const n = this.tryGet(path, user);
      if (n) {
        this._ro(n, path);
        if (user !== 'root' && n.owner !== user && !this.can(n, user, 2)) throw new FsError('EACCES', path);
        n.mtime = LA.now();
        return n;
      }
      return this.writeFile(path, '', { user, umask: o.umask });
    }

    /* walk every node below path (used by find/locate/du). cb(path,node,depth) */
    *iterate(path, user = 'root', o = {}) {
      const start = this.get(path, user, true);
      const stack = [[path, start, 0]];
      while (stack.length) {
        const [p, n, depth] = stack.pop();
        yield [p, n, depth, null];
        if (n.type === 'dir' && (o.maxDepth === undefined || depth < o.maxDepth)) {
          if (!this.can(n, user, 4) || !this.can(n, user, 1)) {
            if (depth > 0 || p !== path || true) yield [p, n, depth, 'EACCES'];
            continue;
          }
          const kids = [...n.children.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
          for (const [k, v] of kids) {
            if (o.skip && o.skip(VFS.join(p, k))) continue;
            stack.push([VFS.join(p, k), v.mount || v, depth + 1]);
          }
        }
      }
    }

    /* ---------- convenience builders (world construction, run as root) ---------- */
    mkdirp(path, o = {}) {
      const parts = path.split('/').filter(Boolean);
      let cur = this.root;
      for (const p of parts) {
        let c = cur.children.get(p);
        if (!c) {
          c = new Node('dir', p, { owner: o.owner, group: o.group, mode: o.mode, mtime: o.mtime });
          this.attach(cur, c);
        }
        if (c.mount) c = c.mount;
        cur = c;
      }
      return cur;
    }
    dir(path, o = {}) {
      const n = this.mkdirp(path, {});
      if (o.mode != null) n.mode = o.mode;
      if (o.owner) { n.owner = o.owner; n.group = o.group || o.owner; }
      if (o.group) n.group = o.group;
      if (o.immutable) n.immutable = true;
      if (o.pinned) n.pinned = true;
      if (o.mtime) n.mtime = o.mtime;
      return n;
    }
    put(path, content, o = {}) {
      const parent = this.mkdirp(VFS.dirname(path));
      const name = VFS.basename(path);
      const n = new Node('file', name, Object.assign({}, o, { content }));
      if (o.owner && !o.group) n.group = o.owner;
      this.attach(parent, n);
      if (o.mtime) n.mtime = o.mtime;
      return n;
    }
    link(path, target, o = {}) {
      const parent = this.mkdirp(VFS.dirname(path));
      const n = new Node('link', VFS.basename(path), { target, owner: o.owner, group: o.group });
      this.attach(parent, n);
      return n;
    }
    remove(path) {
      const n = this.tryGet(path, 'root', false);
      if (n && n.parent) { n.parent.children.delete(n.name); }
    }
  }
  LA.VFS = VFS;

  /* ---------- serialization ---------- */
  VFS.serialize = function ser(n, skip) {
    const o = { t: n.type[0], n: n.name, m: n.mode, o: n.owner, g: n.group, mt: n.mtime };
    if (n.immutable) o.i = 1;
    if (n.pinned) o.p = 1;
    if (n.type === 'dir') {
      o.c = [];
      for (const [k, ch] of n.children) {
        if (ch.virtual) continue;
        const so = ser(ch, skip);
        so.n = k;
        o.c.push(so);
      }
    } else if (n.type === 'file') {
      if (n.content) o.x = n.content;
      if (n.format) { o.f = n.format; o.d = n.data; }
      if (n.special) o.s = n.special;
      if (n.fixedSize) o.z = n.fixedSize;
    } else o.l = n.target;
    return o;
  };
  VFS.deserialize = function des(o) {
    const type = o.t === 'd' ? 'dir' : o.t === 'f' ? 'file' : 'link';
    const n = new Node(type, o.n, { mode: o.m, owner: o.o, group: o.g, mtime: o.mt, target: o.l, content: o.x, format: o.f, data: o.d, special: o.s, size: o.z, immutable: !!o.i, pinned: !!o.p });
    if (o.c) for (const c of o.c) { const ch = des(c); n.children.set(ch.name, ch); ch.parent = n; }
    return n;
  };

  /* permissions string like drwxr-xr-x */
  LA.modeString = (n) => {
    const t = n.type === 'dir' ? 'd' : n.type === 'link' ? 'l' : n.special === 'block' ? 'b' : n.special ? 'c' : '-';
    const m = n.mode;
    const r = (b, ch) => (m & b ? ch : '-');
    let s = t + r(0o400, 'r') + r(0o200, 'w');
    s += m & 0o4000 ? (m & 0o100 ? 's' : 'S') : r(0o100, 'x');
    s += r(0o40, 'r') + r(0o20, 'w');
    s += m & 0o2000 ? (m & 0o10 ? 's' : 'S') : r(0o10, 'x');
    s += r(0o4, 'r') + r(0o2, 'w');
    s += m & 0o1000 ? (m & 0o1 ? 't' : 'T') : r(0o1, 'x');
    return s;
  };
})();
