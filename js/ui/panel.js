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
      $('storyBtn').addEventListener('click', () => run(game.isPractice ? 'skip' : 'story'));
      if (game.pack.isPractice) this.initPractice(run);
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
        const tb = ev.target.closest('button[data-topic]');
        if (tb) { if (tb.dataset.topic !== game.state.topic) run('topic ' + tb.dataset.topic); return; }
        const li = ev.target.closest('button[data-idx]');
        if (!li || !game.state || li.disabled || view.busy) return;
        const idx = parseInt(li.dataset.idx, 10);
        const ch = game.chapters[idx];
        const C = game.pack.collect;
        if (!window.confirm(`Replay from Chapter ${ch.n}: ${ch.title}?\n\n${LA.flavor('replayNote', 'The world will be rebuilt as it was at the start of that chapter.')} Your ${C.label.toLowerCase()} and secrets are kept; files you created will be reset.`)) return;
        document.body.classList.remove('panel-open');
        const veil = document.createElement('div');
        veil.className = 'veil';
        const rewinding = LA.flavor('rewinding', 'Rewinding…');
        veil.innerHTML = `<div class="veil-box"><div class="spinner"></div><div class="veil-text">${esc(rewinding)}</div></div>`;
        document.body.appendChild(veil);
        view.setBusy(true);
        await new Promise((r) => setTimeout(r, 50));
        try {
          await game.jumpTo(idx, (p) => { veil.querySelector('.veil-text').textContent = `${rewinding} ${Math.round(p * 100)}%`; });
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
        if (!window.confirm(`Start ${game.pack.title} over from the very beginning? Your saved progress in this story will be erased.`)) return;
        try { localStorage.removeItem(game.saveKey); } catch (e) { /* ignore */ }
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
    /* the Practice Range reuses the panel's cards for rank, task, score and topics */
    initPractice(run) {
      $('goalHead').textContent = 'Task';
      $('storyBtn').textContent = '⏭ Skip';
      $('storyBtn').title = 'A different task (this one comes back later)';
      /* the rest of the practice controls, next to Hint and Skip */
      const actions = document.querySelector('.goal-actions');
      const mk = (id, label, title, cmd, cls) => {
        const b = document.createElement('button');
        b.className = 'btn' + (cls ? ' ' + cls : '');
        b.id = id; b.type = 'button'; b.textContent = label; b.title = title;
        b.addEventListener('click', () => run(cmd));
        actions.appendChild(b);
        return b;
      };
      mk('nextBtn', '▶ Next task', 'A new task (the machine stays as it is until you click)', 'next', 'primary hidden');
      mk('checkBtn', '✔ Check', 'What is done and what is missing', 'check', 'ghost');
      mk('retryBtn', '↺ Retry', 'This task again on a clean machine', 'retry', 'ghost');
      mk('solutionBtn', '👁 Answer', 'Show an answer (the task then earns no XP)', 'solution', 'ghost');
      $('collectHead').textContent = 'Score';
      $('chaptersHead').innerHTML = '<span>Topics</span> <label class="level-pick">Difficulty <select id="levelSel" aria-label="Difficulty"><option value="auto">Auto</option><option value="1">★</option><option value="2">★★</option><option value="3">★★★</option><option value="4">★★★★</option></select></label>';
      $('levelSel').addEventListener('change', (ev) => run('level ' + ev.target.value));
      $('notebookNote').innerHTML = '<input id="nbFilter" class="nb-filter" type="search" placeholder="filter" aria-label="Filter commands">';
      $('nbFilter').addEventListener('input', () => this.filterNotebook());
      /* topics are used far more often than the notebook: put them first */
      const topicsCard = $('chapters').closest('.card'), notebookCard = $('notebook').closest('.card');
      notebookCard.parentNode.insertBefore(topicsCard, notebookCard);
      $('freeplayRow').classList.add('hidden');
      $('panel').setAttribute('aria-label', 'Practice panel');
    },
    filterNotebook() {
      const f = (($('nbFilter') || {}).value || '').trim().toLowerCase();
      for (const b of $('notebook').querySelectorAll('.chip')) b.classList.toggle('hidden', !!f && !b.dataset.cmd.includes(f));
    },
    updatePractice(game) {
      const P = LA.practice, st = game.state;
      const [floor, rank] = P.rankOf(st.xp);
      const next = P.nextRank(st.xp);
      $('chapterEyebrow').textContent = 'Rank';
      $('chapterTitle').textContent = rank;
      $('chapterPlace').textContent = `${st.xp} XP${next ? ` · ${next[0] - st.xp} to ${next[1]}` : ' · top rank'}`;
      $('progressBar').style.width = (next ? Math.round(((st.xp - floor) / (next[0] - floor)) * 100) : 100) + '%';
      $('progressLabel').textContent = `Streak ×${st.streak} · best ${st.best}`;
      $('topChapter').textContent = `${rank} · ${st.xp} XP${st.streak > 1 ? ` · streak ${st.streak}` : ''}`;
      const T = game.task;
      if (T) {
        const tpl = T.tpl;
        const stars = '★'.repeat(tpl.level) + '☆'.repeat(4 - tpl.level);
        const parts = tpl.parts ? `<ul class="task-parts">${tpl.parts.map((p, i) => `<li class="${T.parts[i] ? 'done' : ''}">${T.parts[i] ? '✓' : '○'} ${LA.inlineMarkup(game.fmt(game.f(p.text)))}</li>`).join('')}</ul>` : '';
        const note = T.solved ? '<div class="task-done">✓ Solved — look around, then <strong>Next task</strong>.</div>' : st.task && st.task.revealed ? '<div class="muted task-note">Answer shown — this one earns no XP.</div>' : '';
        $('goalText').innerHTML = `<div class="task-meta"><span class="stars">${stars}</span> ${esc(tpl.title)}</div>${LA.inlineMarkup(game.fmt(game.f(tpl.prompt)))}${parts}${note}`;
      } else $('goalText').textContent = '—';
      const solved = !!(T && T.solved);
      $('nextBtn').classList.toggle('hidden', !solved);
      for (const id of ['hintBtn', 'storyBtn', 'checkBtn', 'solutionBtn']) $(id).classList.toggle('hidden', solved);
      $('levelSel').value = st.level ? String(st.level) : 'auto';
      const have = game.levelsFor(st.topic);
      for (const o of $('levelSel').options) if (o.value !== 'auto') o.disabled = !have.includes(+o.value);
      $('memCount').textContent = st.stats.solved;
      $('memLabel').textContent = 'solved';
      $('secretCount').textContent = st.badges.length;
      $('secretLabel').textContent = `badges /${Object.keys(P.BADGES).length}`;
      $('cmdCount').textContent = st.stats.commands;
      $('collectLabel').textContent = '';
      const lv = ['not yet used', 'tried', 'practiced: 3 times on your own', 'mastered: 6 times on your own, in 3+ tasks'];
      $('notebook').innerHTML = P.allCommands(game.distroId).map((name) => {
        const m = P.masteryLevel(st, name);
        return `<button class="chip m${m}" data-cmd="${esc(name)}" title="${esc((LA.man[name] ? LA.man[name].desc + ' — ' : '') + lv[m])}">${esc(name)}</button>`;
      }).join('');
      this.filterNotebook();
      const topics = [['mix', 'Everything', 'a mix, favoring what you practice least']].concat(P.TOPICS);
      /* the list is rebuilt after every command: keep keyboard focus where it was */
      const focused = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.topic : null;
      $('chapters').innerHTML = topics.map(([id, label, ex]) => {
        const all = P.tasksFor(game.distroId).filter((t) => id === 'mix' || t.topic === id);
        const done = all.filter((t) => st.independent[t.id]).length;
        const cur = st.topic === id;
        return `<li class="${cur ? 'current' : done === all.length ? 'done' : 'reached'}"><button type="button" data-topic="${id}" title="${esc(ex)}" aria-label="${esc(label)}: ${done} of ${all.length} task types solved on your own${cur ? ' (current topic)' : ''}"><span class="mark">${cur ? '▶' : done === all.length ? '✓' : '○'}</span><span class="t">${esc(label)}</span><span class="n">${done}/${all.length}</span></button></li>`;
      }).join('');
      if (focused) { const b = $('chapters').querySelector(`button[data-topic="${focused}"]`); if (b) b.focus(); }
      $('saveNote').innerHTML = game.saveOk === false
        ? '<strong class="warn">Progress is not being saved.</strong> This browser\'s storage is full or blocked.'
        : 'Type <code>help</code> for every control, <code>task list</code> for the task library, <code>progress</code> for your stats. Your work saves automatically, machine and all.';
    },
    update(game) {
      game = game || this.game;
      if (!game || !game.state) return;
      if (game.isPractice) { this.updatePractice(game); return; }
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
        $('chapterTitle').textContent = LA.flavor('epilogueTitle', 'The End');
        $('chapterPlace').textContent = LA.flavor('epiloguePlace', '');
        $('progressBar').style.width = '100%';
        $('progressLabel').textContent = 'Story complete — free play';
        $('topChapter').textContent = 'Free play';
        $('goalText').innerHTML = 'Explore freely. Type <code class="k">progress</code> to see what you found, <code class="k">notebook</code> for everything you learned.';
      }
      const C = game.pack.collect;
      $('memCount').textContent = st.memories.length;
      $('memLabel').textContent = `${C.label.toLowerCase()} /${Object.keys(C.items).length}`;
      $('secretCount').textContent = st.secrets.length;
      $('secretLabel').textContent = `secrets /${Object.keys(game.secrets).length}`;
      $('cmdCount').textContent = st.stats.commands;
      const current = new Set(ch ? ch.unlocks || [] : []);
      const chips = [];
      for (const c of game.chapters) {
        for (const name of c.unlocks || []) {
          if (!st.unlocked.includes(name) && !st.freeplay) continue;
          const label = game.cmdLabel(name);
          chips.push(`<button class="chip${current.has(name) && !st.done ? ' new' : ''}" data-cmd="${esc(label)}" title="${esc(LA.man[label] ? LA.man[label].desc : '')}">${esc(label)}</button>`);
        }
      }
      $('notebook').innerHTML = chips.join('') || '<span class="muted">Nothing yet.</span>';
      $('chapters').innerHTML = game.chapters.map((c, i) => {
        const reached = i <= (st.maxCh || 0) || st.done;
        const cls = st.done || i < st.ch ? 'done' : i === st.ch ? 'current' : reached ? 'reached' : 'locked';
        const mark = cls === 'done' ? '✓' : cls === 'current' ? '▶' : cls === 'locked' ? '·' : '○';
        /* real buttons, so chapter replay works from the keyboard and is announced properly */
        return `<li class="${cls}"><button type="button" data-idx="${i}"${reached ? '' : ' disabled'} title="${reached ? 'Replay from here' : 'Not reached yet'}" aria-label="Chapter ${c.n}: ${reached ? esc(c.title) : 'not reached yet'}${cls === 'current' ? ' (current)' : ''}${reached ? ' — replay from here' : ''}"><span class="mark">${mark}</span><span class="n">${c.n}</span><span class="t">${reached ? esc(c.title) : '???'}</span></button></li>`;
      }).join('');
      $('freeplayChk').checked = !!st.freeplay;
      $('saveNote').innerHTML = game.saveOk === false
        ? '<strong class="warn">Progress is not being saved.</strong> This browser\'s storage is full or blocked (private windows often do this). Free some space or use a normal window to keep your place.'
        : 'Type <code>help</code> any time. Progress saves automatically in this browser.';
    },
  };
  LA.Panel = Panel;
})();
