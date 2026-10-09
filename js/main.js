/* Linux Awakening — boot sequence and wiring. */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const esc = LA.esc;

  const storage = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
    remove: (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };

  const RESERVED = new Set(['root', 'hollow', 'mara', 'wren', 'ines', 'mags', 'hal', 'osei', 'ingrid', 'juno', 'finch', 'daemon', 'bin', 'sys', 'man', 'mail', 'nobody', 'syslog', 'sshd', 'guest', 'operators', 'users', 'sudo', 'adm', 'staff']);

  async function boot(view) {
    const lines = [
      ['ROOTFALL BIOS v1991.10   (c) Kernel Works Integrated', 'fg-k2'],
      ['Memory test ........................ 2034688K OK', ''],
      ['Detecting drives ................... sda (20G)  sdb (2G)', ''],
      ['Loading kernel 6.1.0-rootfall ...... ok', ''],
      ['Mounting / (ext4) .................. ok', ''],
      ['Starting systemd ................... ok', ''],
      ['Checking user memories ............. ', ''],
    ];
    const out = view.block();
    const fast = view.speed === 'instant';
    for (const [t, cls] of lines) {
      out.insertAdjacentHTML('beforeend', `<span class="${cls}">${esc(t)}</span>${t.endsWith(' ') ? '' : '\n'}`);
      view.scroll(true);
      if (!fast) await view.pause(110);
    }
    out.insertAdjacentHTML('beforeend', '<span class="fg-r a-b">ERROR: no memories found</span>\n\n');
    if (!fast) await view.pause(500);
    const title = document.createElement('div');
    title.className = 'title-screen';
    title.innerHTML = `<pre class="banner">${esc(LA.banner('LINUX'))}\n${esc(LA.banner('AWAKENING'))}</pre><div class="tagline">a story told in a terminal</div>`;
    view.output.appendChild(title);
    view.cur = null;
    view.scroll(true);
    if (!fast) await view.pause(1100);
  }

  async function newGame(view, game) {
    await view.narrate(`Somewhere very far away, a voice.

@Voice: ...can you hear me? Don't try to move. You've been asleep a long time.
@Voice: Can you tell me your name?

:::lesson
Type your name and press **Enter**. It becomes your **username** in Rootfall, so keep it simple: lowercase letters and digits, starting with a letter (2–16 characters).
:::`);
    const name = await view.ask('\x1b[1;33myour name:\x1b[0m ', (v) => {
      const n = v.toLowerCase();
      if (!n) return 'The voice waits. (Type a name, then press Enter.)';
      if (!/^[a-z][a-z0-9_-]{1,15}$/.test(n)) return 'Rootfall\'s register is old-fashioned: lowercase letters and digits only, starting with a letter, 2–16 characters. Try again.';
      if (RESERVED.has(n)) return `"${n}" already belongs to someone in Rootfall. Choose another name.`;
      return null;
    });
    const user = name.toLowerCase();
    game.newGame(user);
    view.attach(game);
    LA.Panel.update(game);
    await game.start();
  }

  async function main() {
    const view = new LA.TerminalView();
    const game = new LA.Game(view, storage);
    view.game = game;
    LA.Panel.init(game, view);
    view.setBusy(true);
    await boot(view);

    let raw = storage.get('linux-awakening-save');
    let data = null;
    if (raw) { try { data = JSON.parse(raw); } catch (e) { data = null; } }
    if (data && data.state) {
      const st = data.state;
      const ch = LA.story.chapters[st.ch];
      const where = st.done ? 'the story is complete' : `Chapter ${ch ? ch.n : '?'}: ${ch ? ch.title : ''}`;
      await view.narrate(`:::resume\nA saved city was found for **${st.user}** — ${where}.\n:::\nPress **Enter** to continue, or type «new» to start over.`);
      const ans = await view.ask('\x1b[1;33mcontinue?\x1b[0m ', (v) => (v === '' || /^(new|n|y|yes|c|continue)$/i.test(v) ? null : 'Press Enter to continue, or type new.'));
      if (/^n(ew)?$/i.test(ans)) {
        if (window.confirm('Start a brand new game? Your saved progress will be erased.')) { storage.remove('linux-awakening-save'); data = null; }
      }
      if (data) {
        try {
          game.loadFrom(data);
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
    await newGame(view, game);
    view.onIdle();
  }

  window.addEventListener('DOMContentLoaded', () => { main().catch((e) => { console.error(e); }); });
  window.addEventListener('beforeunload', () => { if (LA.game && LA.game.state) LA.game.save(); });
})();
