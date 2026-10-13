/* Linux Awakening — the story menu, boot sequence and wiring. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const esc = LA.esc;

  const storage = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    remove: (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  /* the distro new games are built as: ?distro=arch, else the menu's last choice, else Debian */
  const DISTRO_KEY = 'linux-awakening-distro';
  const chosenDistro = () => {
    const v = storage.get(DISTRO_KEY);
    return LA.DISTROS[v] ? v : 'debian';
  };
  { const q = new URLSearchParams(location.search).get('distro'); if (LA.DISTROS[q]) storage.set(DISTRO_KEY, q); }
  /* stories keep one save each; the Practice Range keeps one profile per distro */
  const saveKeyOf = (pack) => {
    const base = pack.saveKey || 'linux-awakening-save-' + pack.id;
    const d = chosenDistro();
    return pack.isPractice && d !== 'debian' ? `${base}-${d}` : base;
  };
  const readSave = (pack) => {
    const raw = storage.get(saveKeyOf(pack));
    if (!raw) return null;
    try { const d = JSON.parse(raw); return d && d.state ? d : null; } catch (e) { return null; }
  };

  /* ---------------- the menu ---------------- */
  function renderDistros() {
    const box = document.getElementById('distroOptions');
    const cur = chosenDistro();
    box.innerHTML = LA.DISTRO_ORDER.map((id) => {
      const d = LA.DISTROS[id];
      return `<button type="button" role="radio" class="distro-opt${id === cur ? ' on' : ''}" aria-checked="${id === cur}" tabindex="${id === cur ? 0 : -1}" data-distro="${id}"><span class="distro-name">${esc(d.label)}</span><span class="distro-pm">${esc(d.pm)}</span></button>`;
    }).join('');
    const d = LA.DISTROS[cur];
    document.getElementById('distroNote').innerHTML = `<strong>${esc(d.label)}</strong> family: ${esc(d.family)}. ${LA.inlineMarkup(d.blurb)}.`;
  }

  function showMenu() {
    document.title = 'Linux Awakening — choose a story';
    document.getElementById('menu').classList.remove('hidden');
    renderDistros();
    renderCards();
    document.getElementById('distroOptions').addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-distro]');
      if (!b) return;
      storage.set(DISTRO_KEY, b.dataset.distro);
      renderDistros();
      renderCards();
      const on = document.querySelector('.distro-opt.on');
      if (on) on.focus();
    });
    document.getElementById('distroOptions').addEventListener('keydown', (ev) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(ev.key)) return;
      ev.preventDefault();
      const i = LA.DISTRO_ORDER.indexOf(chosenDistro());
      const n = LA.DISTRO_ORDER[(i + (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 1) + LA.DISTRO_ORDER.length) % LA.DISTRO_ORDER.length];
      storage.set(DISTRO_KEY, n);
      renderDistros();
      renderCards();
      document.querySelector('.distro-opt.on').focus();
    });
    document.getElementById('storyGrid').addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-restart]');
      if (!b) return;
      const pack = LA.stories[b.dataset.restart];
      if (!window.confirm(pack.isPractice ? `Start the Practice Range over on ${LA.DISTROS[chosenDistro()].label}? Your rank, XP and badges for this distro will be erased (other distros keep theirs).` : `Start ${pack.title} over from the beginning, on ${LA.DISTROS[chosenDistro()].label}? Your saved progress in this story will be erased.`)) return;
      storage.remove(saveKeyOf(pack));
      location.href = '?story=' + encodeURIComponent(pack.id);
    });
  }

  function renderCards() {
    const grid = document.getElementById('storyGrid');
    const cur = chosenDistro();
    grid.innerHTML = '';
    for (const pack of Object.values(LA.stories)) {
      const steps = pack.chapters.reduce((n, c) => n + c.steps.length, 0);
      const cmds = new Set(pack.chapters.flatMap((c) => c.unlocks || [])).size;
      const save = readSave(pack);
      let saveText = '';
      let facts = [`${pack.chapters.length} chapters`, `${steps} steps`, `${cmds} commands`];
      if (pack.isPractice) {
        const P = LA.practice;
        facts = [`${P.tasksFor(cur).length} task types`, `${P.TOPICS.length} topics`, `${P.allCommands(cur).length} commands`];
        if (save) saveText = `Saved: ${save.state.user} · ${P.rankOf(save.state.xp)[1]} · ${save.state.xp} XP · ${save.state.stats.solved} solved`;
        else saveText = 'Each distro keeps its own rank and progress.';
      } else if (save) {
        const st = save.state;
        const ch = pack.chapters[st.ch];
        saveText = st.done ? `✓ Finished as ${st.user} — free play` : `Saved: ${st.user}, Chapter ${ch ? ch.n : '?'} · ${ch ? ch.title : ''}`;
      }
      if (pack.pace) facts.push(pack.pace);
      /* a save keeps the distro it was started on */
      const savedOn = save ? (save.state.distro || (save.world && save.world.distro) || 'debian') : null;
      if (save) saveText += ` · ${LA.DISTROS[savedOn].label}`;
      const other = save && savedOn !== cur ? `Continue keeps ${LA.DISTROS[savedOn].short}; Start over uses ${LA.DISTROS[cur].short}.` : '';
      const card = document.createElement('article');
      card.className = 'story-card';
      if (pack.accent) card.style.setProperty('--accent', pack.accent);
      card.innerHTML = `
        ${pack.cardArt ? `<pre class="story-art" aria-hidden="true">${esc(pack.cardArt)}</pre>` : ''}
        <h2 class="story-name">${esc(pack.title)}</h2>
        <p class="story-tagline">${esc(pack.tagline || '')}</p>
        <p class="story-blurb">${esc(pack.blurb || '')}</p>
        <div class="story-facts">${facts.map((f) => `<span>${esc(f)}</span>`).join('')}</div>
        <div class="story-save">${esc(saveText)}${other ? `<span class="story-other">${esc(other)}</span>` : ''}</div>
        <div class="story-actions">
          <a class="btn primary" href="?story=${encodeURIComponent(pack.id)}">${save ? (save.state.done ? 'Revisit' : 'Continue') : pack.isPractice ? 'Start practising' : 'Start'}</a>
          ${save ? `<button class="btn ghost" data-restart="${esc(pack.id)}">Start over</button>` : ''}
        </div>`;
      grid.appendChild(card);
    }
  }

  /* ---------------- a story ---------------- */
  async function boot(view, pack) {
    const B = pack.boot || {};
    const out = view.block();
    const fast = view.speed === 'instant';
    for (const [t, cls] of B.lines || []) {
      out.insertAdjacentHTML('beforeend', `<span class="${cls}">${esc(t)}</span>${t.endsWith(' ') ? '' : '\n'}`);
      view.scroll(true);
      if (!fast) await view.pause(110);
    }
    if (B.error) out.insertAdjacentHTML('beforeend', `<span class="fg-r a-b">${esc(B.error)}</span>\n\n`);
    if (B.ok) out.insertAdjacentHTML('beforeend', `<span class="fg-g a-b">${esc(B.ok)}</span>\n\n`);
    if (!fast) await view.pause(500);
    const title = document.createElement('div');
    title.className = 'title-screen';
    title.innerHTML = `<pre class="banner">${(B.banner || ['LINUX']).map((w) => esc(LA.banner(w))).join('\n')}</pre><div class="tagline">${esc(B.tagline || '')}</div>`;
    view.output.appendChild(title);
    view.cur = null;
    view.scroll(true);
    if (!fast) await view.pause(1100);
  }

  async function newGame(view, game) {
    const pack = game.pack;
    const reserved = new Set(pack.reserved || []);
    await view.narrate(pack.nameIntro);
    const name = await view.ask(`\x1b[1;33m${pack.namePrompt || 'your name:'}\x1b[0m `, (v) => {
      const n = v.toLowerCase();
      if (!n) return pack.nameWait || 'Type a name, then press Enter.';
      if (!/^[a-z][a-z0-9_-]{1,15}$/.test(n)) return pack.nameRules || 'Use lowercase letters and digits, starting with a letter, 2–16 characters.';
      if (reserved.has(n)) return pack.nameTaken ? pack.nameTaken(n) : `"${n}" is already taken. Choose another name.`;
      return null;
    });
    game.newGame(name.toLowerCase());
    view.attach(game);
    LA.Panel.update(game);
    await game.start();
  }

  async function play(pack) {
    document.getElementById('app').classList.remove('hidden');
    document.title = `${pack.title} — Linux Awakening`;
    document.getElementById('brandStory').textContent = pack.title;
    const view = new LA.TerminalView();
    LA.distroId = chosenDistro();
    const game = new (pack.Game || LA.Game)(view, storage, pack.id);
    const showDistro = () => { document.getElementById('brandStory').textContent = `${pack.title} · ${LA.distro(game.distroId).label}`; };
    view.game = game;
    LA.Panel.init(game, view);
    view.setBusy(true);
    await boot(view, pack);

    let data = readSave(pack);
    if (data) {
      const st = data.state;
      const ch = pack.chapters[st.ch];
      const savedDistro = LA.DISTROS[st.distro || (data.world && data.world.distro)] || LA.DISTROS.debian;
      const where = pack.isPractice ? `${LA.practice.rankOf(st.xp)[1]}, ${st.xp} XP` : st.done ? 'the story is complete' : `Chapter ${ch ? ch.n : '?'}: ${ch ? ch.title : ''}`;
      await view.narrate(`:::resume\n${pack.savedLabel || 'A saved game'} was found for **${st.user}** — ${where} (${savedDistro.label}).\n:::\nPress **Enter** to continue, or type «new» to start over${savedDistro.id !== chosenDistro() ? ` on ${LA.DISTROS[chosenDistro()].label}` : ''}.`);
      const ans = await view.ask('\x1b[1;33mcontinue?\x1b[0m ', (v) => (v === '' || /^(new|n|y|yes|c|continue)$/i.test(v) ? null : 'Press Enter to continue, or type new.'));
      if (/^n(ew)?$/i.test(ans)) {
        if (window.confirm(pack.isPractice ? 'Start over? Your rank, XP and badges will be erased.' : 'Start a brand new game? Your saved progress in this story will be erased.')) { storage.remove(saveKeyOf(pack)); data = null; }
      }
      if (data) {
        try {
          game.loadFrom(data);
          showDistro();
          view.attach(game);
          LA.Panel.update(game);
          view.clear();
          await game.resume();
          view.onIdle();
          return;
        } catch (e) {
          console.error(e);
          view.write('\x1b[31mThat save could not be loaded; starting fresh.\x1b[0m\n', 'out');
        }
      }
    }
    LA.distroId = chosenDistro();
    showDistro();
    await newGame(view, game);
    view.onIdle();
  }

  function main() {
    const id = new URLSearchParams(location.search).get('story');
    if (id && LA.stories[id]) return play(LA.stories[id]);
    showMenu();
    return Promise.resolve();
  }

  window.addEventListener('DOMContentLoaded', () => { main().catch((e) => { console.error(e); }); });
  window.addEventListener('beforeunload', () => { if (LA.game && LA.game.state) LA.game.save(); });
})();
