/* Linux Awakening — the side panel. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const esc = LA.esc;
  const $ = (id) => document.getElementById(id);

  const Panel = {
    game: null,
    view: null,
    init(game, view) {
      this.game = game;
      this.view = view;
      const run = (cmd) => {
        if (!game.console || view.busy || view.typing || view.askState || LA.UI.overlayOpen) return;
        if (game.console.pending) return;
        view.input.value = cmd;
        view.submit();
        document.body.classList.remove('panel-open');
      };
      $('hintBtn').addEventListener('click', () => run('hint'));
      $('storyBtn').addEventListener('click', () => run('story'));
      $('menuBtn').addEventListener('click', () => document.body.classList.toggle('panel-open'));
      document.querySelector('.stage').addEventListener('click', (ev) => {
        if (document.body.classList.contains('panel-open') && !ev.target.closest('.panel')) document.body.classList.remove('panel-open');
      });
      $('notebook').addEventListener('click', (ev) => {
        const b = ev.target.closest('button[data-cmd]');
        if (!b || LA.UI.overlayOpen) return;
        const name = b.dataset.cmd;
        const page = LA.man[name];
        if (page) LA.UI.pager(LA.renderMan(name, page, true), { title: `Manual page ${name}(${page.section || 1})`, name: 'man' });
      });
      $('chapters').addEventListener('click', async (ev) => {
        const li = ev.target.closest('li[data-idx]');
        if (!li || !game.state || li.classList.contains('locked') || view.busy) return;
        const idx = parseInt(li.dataset.idx, 10);
        const ch = game.chapters[idx];
        if (!window.confirm(`Replay from Chapter ${ch.n}: ${ch.title}?\n\nThe city will be rebuilt as it was at the start of that chapter. Your memories and secrets are kept; files you created will be reset.`)) return;
        document.body.classList.remove('panel-open');
        const veil = document.createElement('div');
        veil.className = 'veil';
        veil.innerHTML = '<div class="veil-box"><div class="spinner"></div><div class="veil-text">Rewinding Rootfall…</div></div>';
        document.body.appendChild(veil);
        view.setBusy(true);
        await new Promise((r) => setTimeout(r, 50));
        try {
          await game.jumpTo(idx, (p) => { veil.querySelector('.veil-text').textContent = `Rewinding Rootfall… ${Math.round(p * 100)}%`; });
        } catch (e) {
          console.error(e);
          view.toast('Could not replay that chapter.');
        }
        veil.remove();
        view.onIdle();
      });
      const settings = this.loadSettings();
      $('speedSel').value = settings.speed;
      $('fontSel').value = String(settings.font);
      $('crtChk').checked = settings.crt;
      this.applySettings(settings);
      const save = () => {
        const s = { speed: $('speedSel').value, font: parseInt($('fontSel').value, 10), crt: $('crtChk').checked };
        this.applySettings(s);
        try { localStorage.setItem('linux-awakening-settings', JSON.stringify(s)); } catch (e) { /* private mode */ }
      };
      $('speedSel').addEventListener('change', save);
      $('fontSel').addEventListener('change', save);
      $('crtChk').addEventListener('change', save);
      $('freeplayChk').addEventListener('change', (ev) => {
        if (!game.state) return;
        if (ev.target.checked && !game.state.done && !window.confirm('Free play unlocks every command right now. The story continues as normal — you just won\'t be told "not yet". Turn it on?')) { ev.target.checked = false; return; }
        game.setFreeplay(ev.target.checked);
      });
      $('resetBtn').addEventListener('click', () => {
        if (!window.confirm('Start over from the very beginning? Your saved progress will be erased.')) return;
        try { localStorage.removeItem('linux-awakening-save'); } catch (e) { /* ignore */ }
        location.reload();
      });
    },
    loadSettings() {
      let s = {};
      try { s = JSON.parse(localStorage.getItem('linux-awakening-settings') || '{}'); } catch (e) { s = {}; }
      const narrow = window.innerWidth < 700;
      return { speed: s.speed || 'normal', font: s.font || (narrow ? 13 : 15), crt: s.crt !== undefined ? s.crt : true };
    },
    applySettings(s) {
      this.view.speed = s.speed;
      document.documentElement.style.setProperty('--fs', s.font + 'px');
      document.body.classList.toggle('crt', !!s.crt);
      this.view.charWidth = 0;
    },
    update(game) {
      game = game || this.game;
      if (!game || !game.state) return;
      const st = game.state;
      const ch = game.curChapter();
      const total = game.chapters.length;
      if (ch && !st.done) {
        $('chapterEyebrow').textContent = `Chapter ${ch.n} of ${total}`;
        $('chapterTitle').textContent = ch.title;
        $('chapterPlace').textContent = ch.place || '';
        const pct = Math.round((st.step / ch.steps.length) * 100);
        $('progressBar').style.width = pct + '%';
        $('progressLabel').textContent = `Step ${Math.min(st.step + 1, ch.steps.length)} of ${ch.steps.length}`;
        $('topChapter').textContent = `Ch.${ch.n} · ${ch.title}`;
        const step = game.curStep();
        $('goalText').innerHTML = step ? LA.inlineMarkup(game.fmt(step.goal)) : '—';
      } else {
        $('chapterEyebrow').textContent = 'Epilogue';
        $('chapterTitle').textContent = 'The Operator';
        $('chapterPlace').textContent = 'Rootfall remembers.';
        $('progressBar').style.width = '100%';
        $('progressLabel').textContent = 'Story complete — free play';
        $('topChapter').textContent = 'Free play';
        $('goalText').innerHTML = 'Explore freely. Type <code class="k">progress</code> to see what you found, <code class="k">notebook</code> for everything you learned.';
      }
      $('memCount').textContent = st.memories.length;
      $('secretCount').textContent = st.secrets.length;
      $('secretLabel').textContent = `secrets /${Object.keys(LA.SECRETS).length}`;
      $('cmdCount').textContent = st.stats.commands;
      const current = new Set(ch ? ch.unlocks || [] : []);
      const chips = [];
      for (const c of game.chapters) {
        for (const name of c.unlocks || []) {
          if (!st.unlocked.includes(name) && !st.freeplay) continue;
          chips.push(`<button class="chip${current.has(name) && !st.done ? ' new' : ''}" data-cmd="${esc(name)}" title="${esc(LA.man[name] ? LA.man[name].desc : '')}">${esc(name)}</button>`);
        }
      }
      $('notebook').innerHTML = chips.join('') || '<span class="muted">Nothing yet.</span>';
      $('chapters').innerHTML = game.chapters.map((c, i) => {
        const reached = i <= (st.maxCh || 0) || st.done;
        const cls = st.done || i < st.ch ? 'done' : i === st.ch ? 'current' : reached ? 'reached' : 'locked';
        const mark = cls === 'done' ? '✓' : cls === 'current' ? '▶' : cls === 'locked' ? '·' : '○';
        return `<li data-idx="${i}" class="${cls === 'locked' ? 'locked' : cls}" title="${reached ? 'Replay from here' : 'Not reached yet'}"><span class="mark">${mark}</span><span class="n">${c.n}</span><span class="t">${reached ? esc(c.title) : '???'}</span></li>`;
      }).join('');
      $('freeplayChk').checked = !!st.freeplay;
    },
  };
  LA.Panel = Panel;
})();
