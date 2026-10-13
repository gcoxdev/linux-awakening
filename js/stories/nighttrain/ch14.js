/* Night Train, Chapter 14 — Kessel Junction (w, pkill -u, usermod -L, userdel -r, diff, awk, sed, passwd, nl, the last announcement) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const pack = LA.stories.nighttrain;
  const MAIL = '/srv/meridian/manifest/mail.csv';
  const PA = '/srv/meridian/pa/announce';

  pack.add({
    n: 14, id: 'kessel', title: 'Kessel Junction', place: 'mile 147 · the border', clock: [1, 4, 16],
    unlocks: ['usermod', 'userdel', 'sed', 'nl'],
    onStart(g) {
      const n = g.fs.tryGet(PA);
      if (n) n.content = '';
    },
    intro: N`The valley floor. Kessel's lights are close now — a long platform, a customs shed, a church tower, a row of blue lamps that weren't there an hour ago.

He's logged into the train from his cabin, using the account he made for himself at three minutes past midnight. The checklist said what he meant to do at 04:30: *last sweep: cameras, recorder, this file.*

It's 04:16.`,
    steps: [
      {
        say: N`«w» shows who's logged in and what they're running.`,
        goal: 'See what he\'s doing: «w»',
        hints: ['Type «w».'],
        check: (e) => !!e.ran('w', (r) => /maint/.test(r.out)),
        solve: ['w'],
        done: N`«maint  pts/4  10.8.0.33  ...  bash /var/lib/.maint/tidy.sh»

Running his checklist. Waiting for half past four.`,
      },
      {
        say: N`Before you stop him, keep what he's running: when his account goes, its home directory goes with it. It's his file, mode «700», so copy it with sudo, make the copy yours, and read it.`,
        goal: 'Keep his checklist: «sudo cp /var/lib/.maint/tidy.sh ~/case/evidence/», «sudo chown {user}: ~/case/evidence/tidy.sh», then «cat ~/case/evidence/tidy.sh»',
        hints: ['«sudo cp /var/lib/.maint/tidy.sh ~/case/evidence/»', '«sudo chown {user}: ~/case/evidence/tidy.sh»', '«cat ~/case/evidence/tidy.sh»'],
        check: (e) => { const n = e.node(e.home + '/case/evidence/tidy.sh'); return !!n && n.owner === e.game.user && /R\.L\./.test(e.read(e.home + '/case/evidence/tidy.sh') || '') && e.didRead(e.home + '/case/evidence/tidy.sh'); },
        solve: ['sudo cp /var/lib/.maint/tidy.sh ~/case/evidence/', '$PW', 'sudo chown {user}: ~/case/evidence/tidy.sh', 'cat ~/case/evidence/tidy.sh'],
        done: N`:::art
#  [x] 23:36  car2: rattle the safe until it pages the engineer
#  [x] 23:44  watch her type the safe PIN *and* her password
#  [x] 23:46  swap the atlas for the dummy, atlas -> sack, sack -> pile
#  [x] 23:53  the rear van seals itself. walk her there.
#  [x] 00:01  doors log: lose the escort card and the rear van
#  [ ] 04:30  last sweep: cameras, recorder, this file
#  [ ] 04:41  step off at Kessel like everyone else
:::
Signed «R.L.». *Atlas → sack → pile.*

@Vesna: R.L. — and a sack. Somebody else wrote him that list. Somebody waiting at the other end.`,
        evidence: 'checklist',
      },
      {
        say: N`And the record of how he got in. «sudo grep» can read the security log; the «>» is *your* shell's, writing into your own case folder — which is fine, because you can write there.`,
        goal: 'Save every auth.log line about him: «sudo grep maint /var/log/auth.log > ~/case/evidence/maint_auth.txt»',
        hints: ['Type «sudo grep maint /var/log/auth.log > ~/case/evidence/maint_auth.txt».', 'Then «cat» it to check.'],
        check: (e) => /useradd.*maint/.test(e.read(e.home + '/case/evidence/maint_auth.txt') || '') && /10\.8\.0\.33/.test(e.read(e.home + '/case/evidence/maint_auth.txt') || ''),
        solve: ['sudo grep maint /var/log/auth.log > ~/case/evidence/maint_auth.txt', '$PW'],
        done: N`Created at 00:03 from Vesna's session; given sudo; password set; and at 03:50, «Accepted password for maint from 10.8.0.33» — cabin A3. Now it doesn't matter what happens to the account.`,
      },
      {
        say: N`End his session. «pkill -u USER» signals every process a user owns; «-KILL» (signal 9) can't be ignored or delayed.`,
        goal: 'Throw him out: «sudo pkill -KILL -u maint»',
        hints: ['Type «sudo pkill -KILL -u maint».'],
        check: (e) => !e.world.procs.some((p) => p.user === 'maint') && !e.world.sessions.some((s) => s.user === 'maint'),
        solve: ['sudo pkill -KILL -u maint', '$PW'],
        done: N`Four cars away, in cabin A3, a laptop screen says *Connection to meridian closed* — and somebody discovers the train has stopped doing what he tells it.`,
      },
      {
        say: N`He knows the password. **Lock** it so it can't be used again while you finish. «usermod» changes an account; «-L» locks its *password* — only the password. Ending sessions («pkill») and removing SSH keys are separate jobs; nobody does all three for you.`,
        goal: 'Lock the account: «sudo usermod -L maint»',
        hints: ['Type «sudo usermod -L maint».'],
        check: (e) => { const u = e.world.main.users.get('maint'); return !u || !!u.locked; },
        solve: ['sudo usermod -L maint', '$PW'],
        done: N`Locked. In «/etc/shadow» his password hash now starts with «!», so no password will ever match it. He never had a key of his own on this account — but he had someone else's. Remember that.`,
      },
      {
        say: N`Now remove it. «userdel» deletes an account; «-r» removes its home directory too — and his checklist with it. You read it first. Good.`,
        goal: 'Delete the account: «sudo userdel -r maint»',
        hints: ['Type «sudo userdel -r maint».', 'If it says the user is still in use, a process of his is still running — «sudo pkill -KILL -u maint» again.'],
        check: (e) => !e.world.main.users.exists('maint'),
        solve: ['sudo userdel -r maint', '$PW'],
        done: N`«maint» is gone: from «/etc/passwd», from «/etc/shadow», from every group.`,
      },
      {
        say: N`Check the group he added himself to. «^» in a pattern anchors it to the start of a line, so this matches only the «{admin}» group's own line in «/etc/group».`,
        goal: 'Who still has root powers? «grep \'^{admin}:\' /etc/group»',
        hints: ["Type «grep '^{admin}:' /etc/group»."],
        check: (e) => !!e.ran('grep', (r) => new RegExp(`^${e.game.distro.admin}:`, 'm').test(r.out) && !/maint/.test(r.out)),
        solve: ["grep '^{admin}:' /etc/group"],
        done: N`«{admin}:x:{adminGid}:{user},vesna». The two people who should be there. Nobody else.`,
      },
      {
        say: N`*Atlas → sack → pile.* The mail. The history said he opened the mail manifest in an editor at 00:08 — and you have a copy of the manifest from 00:00, in the recorder snapshot.`,
        goal: 'What changed in the mail manifest? «diff ~/case/recorder-0000/mail.csv /srv/meridian/manifest/mail.csv»',
        hints: ['Type «diff ~/case/recorder-0000/mail.csv /srv/meridian/manifest/mail.csv».'],
        check: (e) => !!e.tried('diff', (r) => /K-27/.test(r.out)),
        solve: ['diff ~/case/recorder-0000/mail.csv /srv/meridian/manifest/mail.csv'],
        done: N`«> K-27,R. LOWELL (POSTE RESTANTE),Kessel Junction,3.1,car2_baggage,vesna,00:08»

One extra sack, added at eight minutes past midnight, «by vesna». Addressed to *R. Lowell* — R.L. — *poste restante*: hold at the post office until collected. Bound for Kessel Junction, where it would be unloaded with the rest of the mail, signed for by the post office, and collected by someone in a day or a week.

He never needed to carry it off the train at all.`,
        evidence: 'sack',
      },
      {
        say: N`Abel signed for the Kessel mail at Calder: «~abel/kessel_mail.txt» says *six sacks, 40.5 lb*. Add up what the manifest says now. «awk -F,» splits on commas; the pattern «$1 ~ /^K-/» picks Kessel sacks; «{sum += $4}» adds up column four; «END» prints the total once at the end.`,
        goal: 'Total the Kessel mail: «awk -F, \'$1 ~ /^K-/ {sum += $4} END {print sum}\' /srv/meridian/manifest/mail.csv»',
        hints: ["Type «awk -F, '$1 ~ /^K-/ {sum += $4} END {print sum}' /srv/meridian/manifest/mail.csv»."],
        check: (e) => !!e.ran('awk', (r) => /47\.3/.test(r.out)),
        solve: ["awk -F, '$1 ~ /^K-/ {sum += $4} END {print sum}' /srv/meridian/manifest/mail.csv"],
        done: N`«47.3». Six point eight pounds more than Abel signed for.

@Ottilie: (from the corridor, where she has been standing for some time, very white) The Atlas weighs just over ten pounds in its case. Without the case — six point eight.`,
      },
      {
        say: N`Mark the sack so nobody at Kessel unloads it into the post office. «sed» is a *stream editor*: «s/OLD/NEW/» substitutes text, and an address in front — «/^K-27/» — limits it to matching lines. «$» means *end of line*, so this appends to the K-27 line. Without «-i», sed only prints the result; the file is untouched. Preview first.`,
        goal: 'Preview the change: «sed \'/^K-27/s/$/,HOLD FOR POLICE/\' /srv/meridian/manifest/mail.csv | tail -n 3»',
        hints: ["Type «sed '/^K-27/s/$/,HOLD FOR POLICE/' /srv/meridian/manifest/mail.csv | tail -n 3»."],
        check: (e) => !!e.ran('sed', (r) => !r.args.some((a) => /^-i/.test(a)) && /HOLD FOR POLICE/.test(r.out)),
        solve: ["sed '/^K-27/s/$/,HOLD FOR POLICE/' /srv/meridian/manifest/mail.csv | tail -n 3"],
        done: N`The last line ends «,HOLD FOR POLICE» on screen. On disk, nothing has changed yet. Preview, then commit: a good habit with any command that edits files.`,
      },
      {
        say: N`Now for real. «-i» edits the file *in place*. It belongs to the crew group, but Vesna wants it done as root, «so the log says who». Do it with sudo.`,
        goal: 'Apply it: «sudo sed -i \'/^K-27/s/$/,HOLD FOR POLICE/\' /srv/meridian/manifest/mail.csv»',
        hints: ["Type «sudo sed -i '/^K-27/s/$/,HOLD FOR POLICE/' /srv/meridian/manifest/mail.csv»."],
        check: (e) => /^K-27,.*HOLD FOR POLICE/m.test(e.read(MAIL) || ''),
        solve: ["sudo sed -i '/^K-27/s/$/,HOLD FOR POLICE/' /srv/meridian/manifest/mail.csv", '$PW'],
        done: N`«K-27,R. LOWELL (POSTE RESTANTE),...,HOLD FOR POLICE». Abel reads it on your screen and goes to stand guard over the baggage car with a torch, as if anybody could get past him.`,
      },
      {
        say: N`@Vesna: He still has my laptop — and my laptop has the key that let him log in as me at 23:58, no password needed. Changing my password doesn't touch that. It's in my «~/.ssh/authorized_keys». sed deletes lines too: an address and «d».`,
        goal: 'Revoke the stolen key: «sudo sed -i \'/vesna@vesna-laptop/d\' ~vesna/.ssh/authorized_keys», then check: «sudo cat ~vesna/.ssh/authorized_keys»',
        hints: ["«sudo sed -i '/vesna@vesna-laptop/d' ~vesna/.ssh/authorized_keys»", 'Then «sudo cat ~vesna/.ssh/authorized_keys» — it should no longer list vesna@vesna-laptop.'],
        check: (e) => { const t = e.read('/home/vesna/.ssh/authorized_keys'); return t !== null && !/vesna-laptop/.test(t) && e.didRead('/home/vesna/.ssh/authorized_keys'); },
        solve: ["sudo sed -i '/vesna@vesna-laptop/d' ~vesna/.ssh/authorized_keys", '$PW', 'sudo cat ~vesna/.ssh/authorized_keys'],
        done: N`Empty. The laptop in cabin A3 is now just a laptop.
@Vesna: I'll put my new key in at Port Isolde, from a machine nobody has stolen. Until then, password only — the one he's about to not know.`,
      },
      {
        say: N`@Vesna: My turn. (She leans over you.) He changed my password at two minutes past midnight. Root can reset anyone's: «sudo passwd vesna». Don't look.
You look away. She types.`,
        goal: 'Let Vesna reset her password: «sudo passwd vesna»',
        hints: ['Type «sudo passwd vesna». Vesna types the new password herself — twice.'],
        check: (e) => !!e.stepEvent('passwd', (ev) => ev.user === 'vesna'),
        solve: ['sudo passwd vesna', '$PW', { answer: 'coffee-and-coats-1847' }, { answer: 'coffee-and-coats-1847' }],
        done: N`«passwd: password updated successfully».
@Vesna: Mine again. (She stretches until her shoulders crack.) Now he's just a man in a cabin with a stolen laptop and no coat.`,
      },
      {
        setup: (g) => {
          g.fs.put(g.home + '/case/report.txt', `INCIDENT 1N47 — THEFT OF THE HALVARD ATLAS
22:41 Card 0417 (escort, car2) issued to "L. Marsh", on a forged Arden Mutual letter.
23:36 0417 opens the baggage car. 23:38 the safe's vibration alarm pages V. Kordic.
23:44 Kordic opens the safe for a fault check; "Marsh" witnesses (safe token, frame 2344).
23:46 The Atlas is swapped for a folded timetable and put in a new mail sack, K-27.
23:53 "Marsh" walks Kordic into the mail van, which seals behind her.
00:01 Using Kordic's stolen password: door log edited, camera stills deleted,
      her password changed, a sudo account "maint" created, doord stopped,
      a cleanup cron job set for 02:55, sack K-27 added to the mail manifest.
02:41 Kordic released. 04:18 "maint" removed. Sack K-27 held for police.
Evidence: ~/case and /srv/police/inbox on kessel (with checksums).
`, { owner: g.user, group: 'crew', mode: 0o640 });
        },
        say: N`Vesna has written the report — «~/case/report.txt» — and the inspector will want to refer to it line by line. «nl» numbers the lines of a file.`,
        goal: 'Number the report for the police: «nl ~/case/report.txt»',
        hints: ['Type «nl ~/case/report.txt».'],
        check: (e) => !!e.ran('nl'),
        solve: ['nl ~/case/report.txt'],
        done: N`Eleven numbered lines. A night, in eleven lines.`,
      },
      {
        say: N`@Vesna: Last job before Kessel, and it's the one that matters. Holm got a first copy at 03:56 — but half of tonight happened after that: the timelines, his checklist, the auth records, the report, the real escort's photo. We send her the *whole* case, fingerprinted, and we prove it arrived intact.
@Vesna: Step one: a checksum for every file in «~/case», saved in «~/case/SHA256SUMS». Careful — the shell creates the output file *before* the command runs, so a careless command fingerprints the manifest itself.
@Vesna: (If you turned up anything on your own tonight — the lounge smoke log, the lost-property note — copy it into «~/case/evidence» first. It counts.)`,
        goal: 'Fingerprint every file under ~/case into ~/case/SHA256SUMS — every file except SHA256SUMS itself',
        hints: ['«find» can list every file and hand them to «sha256sum»; exclude the manifest by name with «! -name SHA256SUMS».', 'From «~/case»: «find . -type f ! -name SHA256SUMS -exec sha256sum {} + > SHA256SUMS»', '(«-exec ... {} +» passes the names straight to sha256sum, so «June statement.txt» stays one name.)'],
        check: (e) => {
          const t = e.read(e.home + '/case/SHA256SUMS') || '';
          return /report\.txt/.test(t) && /timeline_0201\.txt/.test(t) && /tidy\.sh/.test(t) && /maint_auth\.txt/.test(t) && /June statement\.txt/.test(t) && !/\sSHA256SUMS$|\/SHA256SUMS$/m.test(t);
        },
        nudge: (e) => {
          const t = e.read(e.home + '/case/SHA256SUMS') || '';
          if (/SHA256SUMS$/m.test(t)) return '@Vesna: It fingerprinted itself — that line can never check out. Exclude it: «! -name SHA256SUMS».';
          if (t && !/report\.txt/.test(t)) return '@Vesna: That\'s not everything. Every file under ~/case — the evidence folder, the frames, the timelines, the report.';
          return null;
        },
        solve: ['cd ~/case', 'find . -type f ! -name SHA256SUMS -exec sha256sum {} + > SHA256SUMS'],
        done: N`One line per file, «./frames/car2/frame-2344.jpg» and «./June statement.txt» among them. Anyone can now check every file against this list — «sha256sum -c SHA256SUMS» — and see if a single byte has changed.

:::lesson
A checksum proves a file hasn't *changed* since it was fingerprinted. It doesn't prove who made it or that it's true — that's what the rest of the case is for.
:::`,
      },
      {
        say: N`@Vesna: Step two: the packet. The old «evidence.zip» is from before half of this existed. Build a fresh one of the whole case, and fingerprint the zip itself into «~/evidence.zip.sha256» so Holm can check it arrived whole.`,
        goal: 'Rebuild ~/evidence.zip from the whole case, and save its checksum in ~/evidence.zip.sha256',
        hints: ['From your home: remove the old zip, then zip the «case» folder again.', '«cd ~ && rm evidence.zip && zip -r evidence.zip case»', 'Then «sha256sum evidence.zip > evidence.zip.sha256»'],
        check: (e) => {
          const z = e.node(e.home + '/evidence.zip');
          if (!z || z.format !== 'zip' || !z.data) return false;
          const names = z.data.entries.map((x) => x.path);
          const sum = (e.read(e.home + '/evidence.zip.sha256') || '').split(/\s+/);
          return ['case/report.txt', 'case/SHA256SUMS', 'case/evidence/tidy.sh', 'case/timeline_0201.txt'].every((n) => names.includes(n)) && sum[0] === LA.util.sha256(LA.hashContent(z, e.fs)) && /evidence\.zip/.test(sum[1] || '');
        },
        nudge: (e) => (e.node(e.home + '/evidence.zip.sha256') && e.read(e.home + '/evidence.zip.sha256') && !(e.read(e.home + '/evidence.zip.sha256') || '').startsWith(LA.util.sha256(LA.hashContent(e.node(e.home + '/evidence.zip'), e.fs))) ? '@Vesna: That checksum doesn\'t match the zip any more — fingerprint it *after* you build it.' : null),
        solve: ['cd ~', 'rm evidence.zip', 'zip -r evidence.zip case', 'sha256sum evidence.zip > evidence.zip.sha256'],
        done: N`«evidence.zip» — everything — and one line beside it saying exactly what it should hash to.`,
      },
      {
        say: N`@Vesna: Step three: send both to Holm's inbox, then log in there and check the copy *on her machine* against the fingerprint. Then come home.`,
        goal: 'Deliver evidence.zip and evidence.zip.sha256 to kessel:/srv/police/inbox, verify them there with sha256sum -c, and return',
        hints: ['«scp ~/evidence.zip ~/evidence.zip.sha256 kessel:/srv/police/inbox/»', 'Then «ssh {user}@kessel», «cd /srv/police/inbox», «sha256sum -c evidence.zip.sha256»', 'Then «exit».'],
        check: (e) => {
          if (e.host === 'kessel' && e.ran('sha256sum', (r) => e.has(r, 'c') && /evidence\.zip: OK/.test(r.out))) e.mem.verified = true;
          return !!e.mem.verified && e.host === 'meridian';
        },
        nudge: (e) => (e.host === 'kessel' && e.mem.verified ? 'Verified. Now «exit» back to the train.' : e.tried('sha256sum', (r) => /FAILED/.test(r.out)) ? '@Vesna: FAILED means the zip there isn\'t the zip you fingerprinted. Send them both again.' : null),
        solve: ['scp ~/evidence.zip ~/evidence.zip.sha256 kessel:/srv/police/inbox/', 'ssh {user}@kessel', 'cd /srv/police/inbox', 'sha256sum -c evidence.zip.sha256', 'exit'],
        done: N`«evidence.zip: OK» — on Holm's machine, twenty-five miles away. Whatever happens next, the case is out of this train and provably unaltered.

The train phone rings once. Abel answers, listens, and says only: «She says she has it.»`,
      },
      {
        say: N`The brakes come on — long, gentle, all the way down the train. Blue lights slide past the window. Kessel Junction.

@Abel: One more announcement, Engineer. Your words, this time. Tell them where we are, and that nobody is to leave their cabin until the police have been through.`,
        goal: 'Make the arrival announcement in your own words: «echo "..." > /srv/meridian/pa/announce»',
        hints: ['Anything you like, as long as it goes into /srv/meridian/pa/announce.', 'For example: «echo "We are arriving at Kessel Junction. Please remain in your cabins until the police have boarded." > /srv/meridian/pa/announce»'],
        check: (e) => (e.read(PA) || '').trim().length > 5,
        solve: ['echo "We are arriving at Kessel Junction. Please remain in your cabins until the police have boarded. Thank you for your patience." > /srv/meridian/pa/announce'],
        done: (g) => `:::art
  ((( PA )))   ${(g.fs.contentOf(g.fs.get(PA)) || '').trim().replace(/[«»]/g, '')}
:::
Your words, in a flat synthetic voice, in every car of the train at once.`,
      },
    ],
    outro: N`The doors open on a platform full of police.`,
  });

  /* where the evidence a player can miss was hiding */
  const WHERE = { alibi: 'one was written down by a smoke detector', coat: 'one was in the pocket of a coat' };

  pack.epilogue = (g) => {
    const st = g.state;
    const C = pack.collect.items;
    const found = st.memories.length, total = Object.keys(C).length;
    const secretsTotal = Object.keys(g.secrets).length;
    const mins = Math.max(1, Math.round((Date.now() - st.stats.started) / 60000));
    const missed = Object.keys(C).filter((k) => !st.memories.includes(k));
    /* what actually reached the police, read off their server */
    const kfs = g.world.hosts.kessel && g.world.hosts.kessel.fs;
    const zip = kfs && kfs.tryGet('/srv/police/inbox/evidence.zip');
    const files = zip && zip.data ? zip.data.entries.filter((x) => x.type !== 'dir') : [];
    const has = (re) => files.some((x) => re.test(x.path));
    const extras = [has(/smoke\.log$/) && 'the lounge smoke-detector log', has(/lost_property/) && 'the lost-property note about the coat'].filter(Boolean);
    const packet = files.length
      ? `the packet you sent — ${files.length} files, every one fingerprinted, the archive verified on her own machine${extras.length ? `, including ${extras.join(' and ')}` : ''}`
      : 'the case file';
    return N`Inspector Dagny Holm is small, gray-haired, and walks onto the Meridian like she owns the railway. She shakes Abel's hand, hugs Vesna — who suffers it — and goes straight to cabin A3.

Mr. Lucien Marsh, whose name is not Lucien Marsh, is sitting on his bunk in his shirtsleeves with Vesna's laptop open on his knees and Vesna's radio on the pillow beside him. He looks up at the inspector, and then past her at you, and you see him understand, all at once, that the trainee read the logs.

In the baggage car, on top of the pile of Kessel mail, sack K-27 has a flat waterproof tube in it. Dr. Brandt opens it with gloves on, on the floor of the car, under Abel's torch, and doesn't say anything at all for a long time. Then she says, *"Plate thirty-one. The coastline is hand-colored,"* and starts to cry, and nobody pretends not to notice.

Holm takes the sack, the laptop, ${packet}, and a statement from June («age 12»), which runs to four pages and includes a diagram.

:::art
     _____________________________________________
    |                                             |
    |   . . . . . . . P O R T   I S O L D E . . . |    06:10
    |_____________________________________________|
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
      the sea, going pink at the edges
:::

The Meridian leaves Kessel forty minutes late and reaches Port Isolde at 06:52, as the sun comes up out of the sea. Rosa blows the horn all the way down the last mile of track for no reason anyone can find in the rulebook.

On the platform, Vesna stands beside you with a coffee in each hand and gives you one.

@Vesna: First night. Not bad.
@Vesna: Same time tomorrow? The return run leaves at eleven. Quieter, usually. (She drinks.) Usually.

June is asleep on her grandmother's suitcase with her notebook open on her chest. The last thing written in it, in large capitals, is: *LOGS DON'T LIE.*

:::certificate
MERIDIAN RAIL — CREW COMMENDATION

awarded to
${g.user}
systems engineer (no longer a trainee)

for the recovery of the Halvard Atlas, the rescue of a colleague,
and the most thorough first night in the history of the line

Commands typed: ${st.stats.commands}   ·   Hints taken: ${st.stats.hints}
Evidence found: ${found}/${total}   ·   Secrets found: ${st.secrets.length}/${secretsTotal}
Time aboard: ${mins} minute${mins === 1 ? '' : 's'}

"Logs don't lie. People who edit logs do."
:::

**THE END**${missed.length ? ` — though the case file has room for ${missed.length} more piece${missed.length === 1 ? '' : 's'} of evidence you never found${missed.map((k) => WHERE[k]).filter(Boolean).length ? ` (${missed.map((k) => WHERE[k]).filter(Boolean).join('; ')})` : ''}.` : ' — with every piece of evidence in the case file.'}

Every command is now unlocked, and the train is yours to explore${secretsTotal - st.secrets.length > 0 ? `: there are ${secretsTotal - st.secrets.length} secrets still hidden aboard` : ''}. Type «progress» to see what you found, «notebook» for everything you've learned — and remember, «man» is always there.`;
  };
})();
