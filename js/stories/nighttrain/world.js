/* Night Train — builds the Meridian's onboard server (and Kessel Junction's, beyond the tunnel). */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const U = LA.util;
  const R = String.raw;
  const pack = LA.stories.nighttrain;

  const HOUR = 3600000;
  const CARS = ['car1_locomotive', 'car2_baggage', 'car3_dining', 'car4_lounge', 'car5_sleeper_a', 'car6_sleeper_b', 'car7_staff', 'car8_mail'];
  pack.CARS = CARS;

  /* the passengers, cabin by cabin */
  const PASSENGERS = [
    ['A1', 'Haldor Brekke', '1101', 'Port Isolde'], ['A2', 'Sunniva Dahl', '1102', 'Kessel Junction'],
    ['A3', 'Lucien Marsh', '1103', 'Port Isolde'], ['A4', 'Tomasz Wierzbicki', '1104', 'Port Isolde'],
    ['A5', 'Dr Ottilie Brandt', '1105', 'Port Isolde'], ['A7', 'Priya Raman', '1107', 'Stellmark'],
    ['A7', 'Dev Raman', '1117', 'Stellmark'], ['A8', 'Fr Anselm Quist', '1108', 'Port Isolde'],
    ['B9', 'Greta Lindholm', '1209', 'Port Isolde'], ['B10', 'Oskar Varga', '1210', 'Kessel Junction'],
    ['B10', 'Edit Varga', '1220', 'Kessel Junction'], ['B11', 'Constance Fairley', '1211', 'Port Isolde'],
    ['B13', 'Rui Moreira', '1213', 'Port Isolde'], ['B14', 'Rosalind Castellanos', '1214', 'Port Isolde'],
    ['B14', 'June Castellanos', '1224', 'Port Isolde'], ['B15', 'Kofi Asante', '1215', 'Kessel Junction'],
    ['B16', 'Henrike Aalto', '1216', 'Port Isolde'], ['B16', 'Mikko Aalto', '1226', 'Port Isolde'],
  ];
  const CARDS = [
    ['0101', 'OKONKWO A', 'STAFF-MANAGER', 'ALL'], ['0102', 'BELTRAN R', 'STAFF-DRIVER', 'car1 car2'],
    ['0103', 'DIALLO A', 'STAFF-CATERING', 'car3 car4'], ['0201', 'KORDIC V', 'STAFF-ENGINEER', 'ALL'],
    ['0202', null, 'STAFF-ENGINEER-TRAINEE', 'ALL'], ['0417', 'MARSH L (ARDEN MUTUAL)', 'ESCORT-TEMP', 'car2'],
  ];
  const MAIL = [
    ['K-21', 'KESSEL JCT POST OFFICE', 'Kessel Junction', '3.4', 'car2_baggage', 'abel', '22:31'],
    ['K-22', 'KESSEL JCT POST OFFICE', 'Kessel Junction', '2.9', 'car2_baggage', 'abel', '22:31'],
    ['K-23', 'BRANDVOLD PHARMACY', 'Kessel Junction', '4.1', 'car2_baggage', 'abel', '22:32'],
    ['K-24', 'KESSEL JCT POST OFFICE', 'Kessel Junction', '2.6', 'car2_baggage', 'abel', '22:32'],
    ['K-25', 'CUSTOMS OFFICE KESSEL', 'Kessel Junction', '1.8', 'car2_baggage', 'abel', '22:33'],
    ['K-26', 'KESSEL JCT POST OFFICE', 'Kessel Junction', '3.6', 'car2_baggage', 'abel', '22:33'],
    ['P-01', 'ISOLDE FISH MARKET', 'Port Isolde', '12.0', 'car8_mail', 'abel', '22:20'],
    ['P-02', 'ISOLDE FISH MARKET', 'Port Isolde', '12.0', 'car8_mail', 'abel', '22:20'],
    ['P-03', 'HOSPITAL OF ST BRIGID', 'Port Isolde', '6.5', 'car8_mail', 'abel', '22:21'],
    ['P-04', 'ISOLDE CENTRAL POST', 'Port Isolde', '8.2', 'car8_mail', 'abel', '22:22'],
    ['P-05', 'ISOLDE CENTRAL POST', 'Port Isolde', '7.7', 'car8_mail', 'abel', '22:22'],
    ['P-06', 'CAFE LIND (FLOWERS)', 'Port Isolde', '5.0', 'car8_mail', 'abel', '22:24'],
  ];
  const SACK_27 = ['K-27', 'R. LOWELL (POSTE RESTANTE)', 'Kessel Junction', '3.1', 'car2_baggage', 'vesna', '00:08'];
  pack.SACK_27 = SACK_27;
  const mailCsv = (rows) => 'sack,addressee,destination,weight_kg,car,added_by,added\n' + rows.map((r) => r.join(',')).join('\n') + '\n';

  /* the recorder's snapshots: every 15 minutes from 23:45 until Rosa unplugs it at Stellmark */
  pack.SNAPSHOTS = ['2345', '0000', '0015', '0030', '0045', '0100', '0115', '0130', '0145', '0200', '0215', '0230', '0245'];
  /* clock helper for "tonight": times from noon onward belong to the evening before the story starts */
  pack.nightClock = (night) => (h, m, s = 0) => { const d = new Date(night); if (h >= 12) d.setDate(d.getDate() - 1); d.setHours(h, m, s, 0); return d.getTime(); };
  /* recorder.log as it stands at time «until» — no entry for a snapshot that hasn't happened yet */
  pack.recorderLines = (T, until) => pack.SNAPSHOTS
    .map((x) => [x, T(Number(x.slice(0, 2)), Number(x.slice(2)), 30)])
    .filter(([, t]) => t <= until)
    .map(([x, t]) => `${U.strftime('%H:%M:%S', new Date(t))} recorder-sync: snapshot ${x} -> loco-recorder (doors, manifests) ok${x.endsWith('00') ? ' + cctv archive' : ''}`)
    .join('\n') + '\n';

  const KEY_YOU = (u) => `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIM3r1d14nTr41nN1ghtSh1ftTr41n33Kq7Zx ${u}@meridian`;
  const KEY_VESNA = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIVk0rd1cS3n10rEng1n33rL4pt0pZr2Wq9 vesna@vesna-laptop';

  pack.buildWorld = function buildWorld(u) {
    const w = new LA.World();
    const buildStart = LA.now();
    w.username = u;
    const User = u.charAt(0).toUpperCase() + u.slice(1);
    /* "tonight": the story starts at 00:14; times from noon onward belong to the evening before */
    const NIGHT = LA.now();
    w.flags.night = NIGHT;
    const T = pack.nightClock(NIGHT);
    const hms = (t) => U.strftime('%H:%M:%S', new Date(t));
    const old = T(12, 0) - 200 * 24 * HOUR;
    w.bootTime = T(19, 12, 4);
    Object.assign(w.sys, {
      os: 'Meridian Onboard GNU/Linux 12', kernel: '6.1.0-meridian', build: '2026', tz: 'CET', domain: 'rail',
      cpu: 'Railbox RX-4 industrial', vendor: 'RailboxSystems', mirror: 'pkg-cache.meridian.rail', security: 'pkg-cache.meridian.rail/security',
      packager: 'Meridian Rail IT <it@meridian.rail>', web: 'nginx/1.22.1', rootSizeKb: 30831000, rootUsedKb: 12700000, grows: ['/var/lib/cctv'],
    });

    const B = LA.baseSystem(w, {
      old,
      host: { name: 'meridian', fqdn: 'meridian.rail', ip: '10.8.0.1', mac: '52:54:00:8a:14:01' },
      os: { pretty: 'Meridian Onboard GNU/Linux 12 (bookworm)', name: 'Meridian Onboard GNU/Linux', id: 'meridian', version: '12', url: 'http://it.meridian.rail/' },
      people: {
        [u]: { uid: 1000, gid: 1000, home: '/home/' + u, shell: '/bin/bash', gecos: `${User},,,Systems Engineer (trainee)` },
        vesna: { uid: 1001, gid: 1001, home: '/home/vesna', shell: '/bin/bash', gecos: 'Vesna Kordic,,,Senior Systems Engineer' },
        abel: { uid: 1002, gid: 1002, home: '/home/abel', shell: '/bin/bash', gecos: 'Abel Okonkwo,,,Train Manager' },
        rosa: { uid: 1003, gid: 1003, home: '/home/rosa', shell: '/bin/bash', gecos: 'Rosa Beltran,,,Driver' },
        amadou: { uid: 1004, gid: 1004, home: '/home/amadou', shell: '/bin/bash', gecos: 'Amadou Diallo,,,Chef' },
        maint: { uid: 1005, gid: 1005, home: '/var/lib/.maint', shell: '/bin/bash', gecos: '' },
        kiosk: { uid: 1100, gid: 1100, home: '/var/lib/kiosk', shell: '/usr/local/bin/kioskmenu', gecos: 'Mail car parcel kiosk,,,' },
        cctv: { uid: 997, gid: 997, home: '/var/lib/cctv', shell: '/usr/sbin/nologin', gecos: 'CCTV recorder' },
      },
      groups: { crew: { gid: 1500, members: [u, 'vesna', 'abel', 'rosa', 'amadou'] } },
      members: { sudo: [u, 'vesna', 'maint'], adm: [u, 'vesna'], users: [u, 'vesna', 'abel', 'rosa', 'amadou'] },
      dirs: [],
      blockDevices: [],
      hosts: '10.8.0.12\tvesna-laptop\n10.8.0.33\tcabin-a3\n10.20.0.5\tkessel kessel.rail',
      dns: '10.8.0.1',
      timezone: 'Europe/Isolde',
      motd: `
  __  __ ___ ___ ___ ___ ___   _   _  _
 |  \/  | __| _ \_ _|   \_ _| /_\ | \| |   1N47  Calder -> Port Isolde
 | |\/| | _||   /| || |) | | / _ \| .\` |   onboard systems — crew only
 |_|  |_|___|_|_\___|___/___/_/ \_\_|\_|

`,
    });
    const { fs, D, F, E, P, svc } = B;
    const rand = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    w.passwords.meridian = { [u]: 'brass-lantern-9', vesna: rand(), abel: 'platform-nine', rosa: rand(), amadou: rand(), maint: rand(), root: rand() };

    /* ================= the cards, the passengers, the mail ================= */
    D('/etc/meridian', { mode: 0o750, group: 'crew' });
    const cardRows = CARDS.map(([c, who, role, acc]) => [c, who || u.toUpperCase(), role, acc]);
    for (const [cab, name, card] of PASSENGERS) cardRows.push([card, name.toUpperCase(), 'PASSENGER-' + cab, 'public cabin_' + cab]);
    const issued = (c) => (c === '0417' ? `${U.strftime('%F', new Date(T(22, 41)))} 22:41` : c.startsWith('1') ? `${U.strftime('%F', new Date(T(22, 0)))} 22:05` : `${U.strftime('%F', new Date(T(19, 30)))} 19:30`);
    E('meridian/cards.csv', 'card,holder,role,access,issued\n' + cardRows.map((r) => r.concat(issued(r[0])).join(',')).join('\n') + '\n', { mode: 0o640, group: 'crew', mtime: T(22, 41) });
    E('meridian/doord.conf', '# doord — electronic door controller. Doors read their state from /srv/meridian/cars/*/door\n#\n# modes:\n#   normal  passenger doors: any valid card opens them, locally\n#   staff   staff cards only, locally\n#   sealed  customs cargo seal. From OUTSIDE a staff card opens it (and is logged).\n#           Once shut it relocks itself, and the INSIDE reader stays disabled until\n#           doord sends a remote release, or the customs key is used at Kessel.\n#\n# If doord stops, card readers keep working locally. What stops is the remote\n# release, so a sealed door that is shut stays shut.\n#\ncar1_locomotive  staff\ncar2_baggage     staff\ncar3_dining      normal\ncar4_lounge      normal\ncar5_sleeper_a   normal\ncar6_sleeper_b   normal\ncar7_staff       staff\ncar8_mail        sealed     # customs seal: Calder -> Kessel\n');
    E('meridian/recorder.conf', '# copies of the logs and the manifests go to the event recorder in the\n# locomotive every 15 minutes (see /opt/meridian/bin/recorder-sync)\ntarget=loco-recorder:/snapshots\ninterval=15m\n');
    E('meridian/stations.txt', `# Station servers on the 1N47 route, and the host-key fingerprint each one should
# present. Crew accounts on them are created when you join the line; your key is
# copied there for you. If ssh shows a different fingerprint, answer "no".
calder.rail      10.20.0.2   ${LA.hostFingerprint('10.20.0.2')}
hallin.rail      10.20.0.3   ${LA.hostFingerprint('10.20.0.3')}
stellmark.rail   10.20.0.4   ${LA.hostFingerprint('10.20.0.4')}
kessel.rail      10.20.0.5   ${LA.hostFingerprint('10.20.0.5')}
isolde.rail      10.20.0.6   ${LA.hostFingerprint('10.20.0.6')}
`, { mode: 0o640, group: 'crew' });
    E('meridian/cctv.conf', 'car2_baggage   stills   every=120s\ncar3_dining    video\ncar4_lounge    video\ncar5_sleeper_a video\ncar6_sleeper_b video\n');
    E('logrotate.d/meridian', '/var/log/meridian/doors.log {\n    hourly\n    rotate 24\n    compress\n    delaycompress\n    postrotate\n        cd /var/log/meridian && sha256sum doors.log.1 doors.log.2.gz > SHA256SUMS\n    endscript\n}\n');

    /* ================= the door log ================= */
    const rng = U.rng(1847);
    const evs = [];
    const ev = (t, card, door, action) => evs.push({ t, card, door, action: action || 'OPEN' });
    /* passengers wandering to the dining car and back */
    const walk = (t, card, cab, to) => {
      const car = cab[0] === 'A' ? 5 : 6;
      const path = []; for (let c = car - 1; c >= to; c--) path.push(c);
      ev(t, card, 'cabin_' + cab);
      let s = t + 20000;
      for (const c of path) { ev(s, card, CARS[c - 1]); s += 18000 + Math.floor(rng() * 9000); }
      return s;
    };
    const back = (t, card, cab, from) => {
      const car = cab[0] === 'A' ? 5 : 6;
      let s = t;
      for (let c = from + 1; c <= car; c++) { ev(s, card, CARS[c - 1]); s += 18000 + Math.floor(rng() * 9000); }
      ev(s, card, 'cabin_' + cab);
    };
    const roamers = PASSENGERS.filter((p) => !['1103', '1211', '1224'].includes(p[2]));
    for (const [from, to] of [[22, 23], [23, 24], [24, 24.25]]) {
      const n = from === 22 ? 26 : from === 23 ? 19 : 2;
      for (let i = 0; i < n; i++) {
        const p = roamers[Math.floor(rng() * roamers.length)];
        const start = T(0, 0) + (from - 24) * HOUR + Math.floor(rng() * (to - from) * HOUR * 0.8);
        if (from === 24 && start > T(0, 9)) continue;
        const dest = rng() < 0.6 ? 3 : 4;
        const arr = walk(start, p[2], p[0], dest);
        back(arr + 10 * 60000 + Math.floor(rng() * 25 * 60000), p[2], p[0], dest);
      }
    }
    /* boarding: everyone opens their cabin once */
    PASSENGERS.forEach(([cab, , card], i) => ev(T(22, 4) + i * 71000, card, 'cabin_' + cab));
    /* the crew */
    ev(T(22, 18), '0101', 'car8_mail'); ev(T(22, 26), '0101', 'car8_mail', 'LOCKED');
    ev(T(22, 30), '0101', 'car2_baggage'); ev(T(22, 34), '0101', 'car2_baggage', 'CLOSED');
    ev(T(22, 40), '0103', 'car3_dining'); ev(T(23, 2), '0103', 'car4_lounge'); ev(T(23, 40), '0103', 'car3_dining');
    /* the escort inspection before departure — the one entry for 0417 he never thought to delete */
    ev(T(22, 51, 40), '1105', 'car3_dining'); ev(T(22, 52, 3), '0417', 'car2_baggage'); ev(T(22, 52, 31), '0101', 'car2_baggage');
    ev(T(23, 5, 12), '0417', 'car2_baggage', 'CLOSED'); ev(T(23, 6, 30), '1105', 'cabin_A5');
    /* 23:35 — Marsh goes forward */
    ev(T(23, 35, 12), '1103', 'cabin_A3'); ev(T(23, 35, 40), '1103', 'car4_lounge'); ev(T(23, 36, 2), '1103', 'car3_dining');
    ev(T(23, 36, 30), '0417', 'car2_baggage');
    /* 23:41 — Vesna is paged and walks forward from the staff car */
    ev(T(23, 41, 5), '0201', 'car6_sleeper_b'); ev(T(23, 41, 31), '0201', 'car5_sleeper_a'); ev(T(23, 42, 2), '0201', 'car4_lounge');
    ev(T(23, 42, 30), '0201', 'car3_dining'); ev(T(23, 42, 55), '0201', 'car2_baggage');
    /* Constance steps out for a cigarette */
    ev(T(23, 48, 31), '1211', 'cabin_B11'); ev(T(23, 48, 50), '1211', 'car5_sleeper_a'); ev(T(23, 49, 2), '1211', 'car4_lounge');
    ev(T(23, 57, 40), '1211', 'car5_sleeper_a'); ev(T(23, 58, 4), '1211', 'car6_sleeper_b'); ev(T(23, 58, 15), '1211', 'cabin_B11');
    /* 23:51 — back toward the staff car, Marsh a few steps behind */
    ev(T(23, 51, 5), '0201', 'car3_dining'); ev(T(23, 51, 8), '0417', 'car2_baggage', 'CLOSED');
    ev(T(23, 51, 44), '0201', 'car4_lounge'); ev(T(23, 52, 10), '0201', 'car5_sleeper_a'); ev(T(23, 52, 31), '0201', 'car6_sleeper_b');
    ev(T(23, 52, 55), '0201', 'car7_staff');
    ev(T(23, 52, 21), '1224', 'cabin_B14'); ev(T(23, 54, 2), '1224', 'cabin_B14');
    ev(T(23, 53, 20), '0201', 'car8_mail');
    ev(T(23, 53, 34), '----', 'car8_mail', 'LOCKED');
    ev(T(23, 54, 40), '1103', 'cabin_A3');
    /* after midnight */
    for (const [k, c] of [[6, 10], [5, 31], [4, 55], [3, 20]]) ev(T(0, 10, 0) + (6 - k) * 26000 + c * 100, '0101', CARS[k - 1]);
    ev(T(0, 11, 12), '1105', 'cabin_A5'); ev(T(0, 11, 18), '1105', 'car4_lounge'); ev(T(0, 11, 30), '1105', 'car3_dining');
    ev(T(0, 12, 5), '0101', 'car2_baggage');
    for (const [k, c] of [[3, 0], [4, 1], [5, 2], [6, 3]]) ev(T(0, 12, 50) + c * 21000, '0101', CARS[k - 1]);
    ev(T(0, 13, 40), '0101', 'car7_staff');
    evs.sort((a, b) => a.t - b.t);
    const line = (e) => `${hms(e.t)} ${e.card} ${e.door} ${e.action}`;
    const inHour = (h) => evs.filter((e) => new Date(e.t).getHours() === h && e.t <= T(0, 14));
    const log2 = inHour(22).map(line).join('\n') + '\n';
    const log1orig = inHour(23).map(line).join('\n') + '\n';
    const log1 = inHour(23).filter((e) => e.card !== '0417' && e.door !== 'car8_mail').map(line).join('\n') + '\n';
    const log0 = inHour(0).map(line).join('\n') + '\n';
    w.flags.marshLines = evs.filter((e) => new Date(e.t).getHours() === 23 && (e.card === '0417' || e.door === 'car8_mail')).map(line);

    D('/var/log/meridian', { mode: 0o750, group: 'adm' });
    const LG = (p, c, x = {}) => F('/var/log/meridian/' + p, c, Object.assign({ mode: 0o640, group: 'adm' }, x));
    LG('doors.log', log0, { mtime: T(0, 13, 40) });
    LG('doors.log.1', log1, { mtime: T(0, 1, 12) });
    fs.put('/var/log/meridian/doors.log.2.gz', '', { format: 'gzip', data: { name: 'doors.log.2', inner: { content: log2, mode: 0o640 } }, mode: 0o640, group: 'adm', mtime: T(23, 0) });
    const gz2 = fs.tryGet('/var/log/meridian/doors.log.2.gz');
    LG('SHA256SUMS', `${U.sha256(log1orig)}  doors.log.1\n${U.sha256(LA.hashContent(gz2, fs))}  doors.log.2.gz\n`, { mode: 0o644, mtime: T(0, 0, 0) });
    LG('cctv.log', [
      `${hms(T(19, 13))} cctvd: cameras online: car2(stills/120s) car3 car4 car5 car6`,
      `${hms(T(0, 0, 30))} cctvd: car2: archive car2-23 written to recorder`,
      `${hms(T(0, 1, 40))} cctvd: car2: 15 stills removed (unlink by uid 0)`,
      `${hms(T(0, 12, 6))} cctvd: car2: motion`,
    ].join('\n') + '\n', { mtime: T(0, 12, 6) });
    LG('recorder.log', pack.recorderLines(T, T(0, 14)), { mtime: T(0, 0, 30) });

    /* ================= /srv/meridian — the train ================= */
    D('/srv/meridian', { mode: 0o775, group: 'crew' });
    const S = (p, c, x = {}) => F('/srv/meridian/' + p, c, Object.assign({ mode: 0o664, group: 'crew', mtime: T(19, 40) }, x));
    S('README', `/srv/meridian — the train, as the server sees it

  cars/        one directory per carriage, front to back: status, door, temp
  manifest/    who is aboard (passengers.csv) and what (mail.csv)
  pa/          write a line into pa/announce and it goes out on the speakers
  timetable.txt
`);
    S('timetable.txt', `MERIDIAN 1N47 — CALDER CENTRAL to PORT ISOLDE

dep  Calder Central       23:30
     Ashford Viaduct      00:30   (pass)
     Lake Varn            01:15   (pass)
arr  Hallin Junction      01:38   dep 01:41
     Brennholt Pass       02:10   (summit, 1,940 m)
arr  Stellmark            02:58   dep 03:02
     Merrow Tunnel        03:30 - 03:52
arr  Kessel Junction      04:40   dep 04:55   border · customs · mail exchange
arr  Port Isolde          06:10

No radio between Calder and the far end of the Merrow Tunnel.
`, { mode: 0o644 });
    const carInfo = {
      car1_locomotive: ['LOCOMOTIVE', 'Driver: R. Beltran. Event recorder aboard (snapshots every 15 min).', 'LOCKED', 18.5],
      car2_baggage: ['BAGGAGE', '', 'LOCKED', 9.0],
      car3_dining: ['DINING CAR', 'Chef: A. Diallo. Kitchen closed 00:30; coffee all night.', 'CLOSED', 21.0],
      car4_lounge: ['LOUNGE / OBSERVATION', 'Glass roof. Smoke detector: armed.', 'CLOSED', 20.5],
      car5_sleeper_a: ['SLEEPER A (cabins A1-A8)', '', 'CLOSED', 21.5],
      car6_sleeper_b: ['SLEEPER B (cabins B9-B16)', '', 'CLOSED', 21.5],
      car7_staff: ['STAFF CAR', 'Crew bunks. Server rack 7 (this machine).', 'LOCKED', 22.0],
      car8_mail: ['MAIL VAN (refrigerated)', 'SEALED by customs at Calder; seal opens at Kessel Junction.\nReefer: +4 C (perishables).\nParcel kiosk: ttyS3.', 'LOCKED', 4.0],
    };
    CARS.forEach((c, i) => {
      const [name, extra, door, temp] = carInfo[c];
      D(`/srv/meridian/cars/${c}`, { mode: 0o775, group: 'crew' });
      const status = c === 'car2_baggage'
        ? `CAR 2 — BAGGAGE\nSafe:         CLOSED, locked\nLast opened:  00:12:05 by card 0101 (A. Okonkwo) + conservator PIN\nLast check:   CONTENTS MISMATCH\n              Atlas case present. Atlas missing.\n              Inside the case: a railway timetable, folded to size, wrapped in tissue.\nKessel mail:  sacks K-21 to K-26 (see manifest/mail.csv)\n`
        : `CAR ${i + 1} — ${name}\n${extra ? extra + '\n' : ''}`;
      S(`cars/${c}/status`, status, { mtime: c === 'car2_baggage' ? T(0, 12, 40) : T(19, 40) });
      /* sealed doors can only be released by root */
      S(`cars/${c}/door`, door + '\n', c === 'car8_mail' ? { mtime: T(23, 53, 34), mode: 0o644, group: 'root' } : { mtime: T(23, 30) });
      S(`cars/${c}/temp`, temp.toFixed(1) + '\n', { mode: 0o644 });
    });
    S('cars/car2_baggage/.fault_ticket', `FAULT TICKET #2291
raised:     ${hms(T(23, 38, 4))}  car2_baggage  safe vibration sensor (level 3)
paged:      0201 (V. Kordic)
acknowledged by 0201 at ${hms(T(23, 39, 50))}: "on my way. probably the viaduct joints again"
closed:     —
`, { mtime: T(23, 39, 50) });
    S('cars/car2_baggage/safe.log', `${hms(T(22, 52, 31))} OPEN  card=0101 pin=OK  token=${U.b64encode('witness=0417,1105 reason=escort-inspection')}
${hms(T(23, 5, 2))} CLOSE card=0101
${hms(T(23, 38, 4))} ALARM vibration level=3
${hms(T(23, 44, 12))} OPEN  card=0201 pin=OK  token=${U.b64encode('witness=0417 reason=fault-check')}
${hms(T(23, 47, 40))} CLOSE card=0201
${hms(T(0, 12, 5))} OPEN  card=0101 pin=OK  token=${U.b64encode('witness=1105 reason=hourly-check')}
${hms(T(0, 12, 33))} CHECK contents=MISMATCH weight_expected=4.62kg weight_found=0.31kg
${hms(T(0, 12, 40))} CLOSE card=0101
`, { mode: 0o640, mtime: T(0, 12, 40) });
    fs.put('/srv/meridian/cars/car2_baggage/decoy.jpg', '', { format: 'jpeg', data: { comment: 'Photographed by O. Brandt 00:13 — contents of the Atlas case: Meridian timetable (this season), folded, in conservation tissue', size: '1600x1200' }, mode: 0o644, group: 'crew', mtime: T(0, 13, 10), size: 1311722 });
    fs.put('/srv/meridian/cars/car2_baggage/certificate', '', { format: 'pdf', data: { title: 'Certificate of Provenance — The Halvard Atlas (1683)', body: 'Lot 112. 41 engraved maps, hand-coloured. Insured value 2,400,000. Conservator: Dr O. Brandt.', pages: 3 }, mode: 0o644, group: 'crew', mtime: T(21, 50), size: 284113 });
    S('cars/car3_dining/menu.txt', `DINING CAR — LATE MENU
  Mountain bread, salted butter ............ 4
  Fish soup, Port Isolde style ............. 9
  Amadou's stew (ask him what's in it) ..... 11
  Coffee, all night ......................... 2
`);
    S('cars/car3_dining/orders.log', `${hms(T(23, 20))} A3   2 x coffee, black          (Mr Marsh: "one for the engineer later")
${hms(T(23, 31))} B11  red wine
${hms(T(23, 46))} A1   stew
${hms(T(0, 20))} A3   1 x coffee, black          (paid cash. changed his coat?)
`, { mtime: T(0, 20) });
    S('cars/car3_dining/.stew', `AMADOU'S GRANDMOTHER'S STEW (do not show the company)
  lamb, a lot of it · 2 onions · 1 whole head of garlic
  smoked paprika · tomatoes · one spoon of honey · peanut butter (yes)
  cook it until the train reaches the sea.
`, { mode: 0o644 });
    S('cars/car4_lounge/smoke.log', `${hms(T(21, 10))} detector armed
${hms(T(23, 49, 10))} SMOKE level=2 (cigarette?) duration=4m40s
${hms(T(23, 53, 50))} clear
`, { mode: 0o644, mtime: T(23, 53, 50) });
    S('cars/car4_lounge/guestbook.txt', `THE MERIDIAN — LOUNGE GUESTBOOK
"Woke at Brennholt to snow on the glass roof. Unforgettable." — G. L.
"The stew. Dear god, the stew." — anon.
"I have ridden this train 41 times and the viaduct never gets old." — J. C., age 12
`, { mode: 0o666 });
    S('cars/car5_sleeper_a/cabins.txt', PASSENGERS.filter((p) => p[0][0] === 'A').map((p) => `${p[0]}  ${p[1]}`).join('\n') + '\nA6  (empty)\n');
    S('cars/car6_sleeper_b/cabins.txt', PASSENGERS.filter((p) => p[0][0] === 'B').map((p) => `${p[0]}  ${p[1]}`).join('\n') + '\nB12 (empty)\n');
    S('cars/car7_staff/rota.txt', `CREW — 1N47 tonight
  A. Okonkwo     train manager
  R. Beltran     driver
  A. Diallo      chef
  V. Kordic      systems engineer        card 0201
  ${u.padEnd(14)} systems engineer (trainee, first night)   card 0202
`);
    S('cars/car8_mail/kiosk.txt', `Parcel kiosk on serial console ttyS3. Account: kiosk. Its login program is
/usr/local/bin/kioskmenu, which only offers the parcel functions:
  scan · label · status (shows ps) · note (adds a line to a note in /tmp) ·
  wait N (sleep) · printer-test PATTERN (runs yes PATTERN until power-off)
No shell, no sudo, no kill.
`);
    D('/srv/meridian/cars/.car9', { mode: 0o755, mtime: old });
    F('/srv/meridian/cars/.car9/manifest.txt', `CAR 9 — not on any consist since 1961.
The old crews swear it still runs on foggy nights, coupled behind the last car,
lights on, nobody aboard. If you are reading this, you found it.
Leave it a coin.
`, { mtime: old });
    D('/srv/meridian/manifest', { mode: 0o775, group: 'crew' });
    S('manifest/passengers.csv', 'cabin,name,card,boarded,destination\n' + PASSENGERS.map(([c, n, card, d]) => `${c},${n},${card},Calder Central,${d}`).join('\n') + '\n', { mtime: T(22, 5) });
    S('manifest/mail.csv', mailCsv(MAIL.concat([SACK_27])), { mtime: T(0, 8, 12) });
    D('/srv/meridian/pa', { mode: 0o775, group: 'crew' });
    S('pa/announce', '');
    S('pa/README', 'Whatever is written into announce is read out on every speaker in the train.\n  echo "text" > /srv/meridian/pa/announce\n');

    /* ================= tools ================= */
    D('/opt/meridian'); D('/opt/meridian/bin');
    F('/usr/local/bin/safectl', `#!/bin/bash
# safectl — status of the baggage car safe
case "$1" in
  status|"") cat /srv/meridian/cars/car2_baggage/status ;;
  log)       cat /srv/meridian/cars/car2_baggage/safe.log ;;
  *)         echo "usage: safectl [status|log]" >&2; exit 2 ;;
esac
`, { mode: 0o755 });
    F('/opt/meridian/bin/recorder-sync', R`#!/bin/bash
# recorder-sync — every 15 minutes, copy the door logs and the manifests to the
# event recorder in the locomotive (loco-recorder, on the train network).
stamp=$(date +%H%M)
ssh -q loco-recorder mkdir -p /snapshots/$stamp
scp -q /var/log/meridian/doors.log* /srv/meridian/manifest/*.csv loco-recorder:/snapshots/$stamp/
# on the hour, the last hour of baggage-car stills goes across as one archive
if [ "$(date +%M)" = "00" ]; then
    hour=$(date -d '1 hour ago' +%H)
    tar -czf /run/recorder/car2-$hour.tar.gz -C /var/lib/cctv car2
    scp -q /run/recorder/car2-$hour.tar.gz loco-recorder:/cctv/ && rm -f /run/recorder/car2-$hour.tar.gz
fi
`, { mode: 0o755 });
    for (const b of ['doord', 'cctvd', 'reefer']) F('/usr/sbin/' + b, '', { format: 'elf', data: { cmd: b }, mode: 0o755 });
    F('/usr/local/bin/kioskmenu', '', { format: 'elf', data: { cmd: 'kioskmenu' }, mode: 0o755 });
    E('systemd/system/doord.service', '[Unit]\nDescription=Meridian door controller\n\n[Service]\nExecStart=/usr/sbin/doord --conf /etc/meridian/doord.conf\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n');
    E('systemd/system/cctvd.service', '[Unit]\nDescription=Meridian CCTV recorder\n\n[Service]\nExecStart=/usr/sbin/cctvd --conf /etc/meridian/cctv.conf\nRestart=always\n\n[Install]\nWantedBy=multi-user.target\n');
    E('systemd/system/reefer.service', '[Unit]\nDescription=Mail van refrigeration (car8)\n\n[Service]\nExecStart=/usr/sbin/reefer --car car8_mail --setpoint 4\nRestart=always\n\n[Install]\nWantedBy=multi-user.target\n');
    fs.link('/etc/systemd/system/multi-user.target.wants/cctvd.service', '/etc/systemd/system/cctvd.service');
    fs.link('/etc/systemd/system/multi-user.target.wants/reefer.service', '/etc/systemd/system/reefer.service');

    /* ================= the cameras (and the disk they fill) ================= */
    D('/var/lib/cctv', { mode: 0o755, owner: 'cctv', group: 'cctv' });
    const comments = {
      2336: 'CAM2 23:36:30 baggage car - 1 person: adult male, tall, grey overcoat; at safe',
      2338: 'CAM2 23:38:04 baggage car - 1 person: adult male, grey overcoat; hand on safe door',
      2340: 'CAM2 23:40:00 baggage car - 1 person: adult male, grey overcoat; seated on mail sacks',
      2342: 'CAM2 23:42:55 baggage car - 2 persons: staff (orange hi-vis), adult male (grey overcoat)',
      2344: 'CAM2 23:44:12 baggage car - 2 persons: staff (orange hi-vis) at safe keypad, safe OPEN; adult male (grey overcoat) beside her, holding flat case',
      2346: 'CAM2 23:46:20 baggage car - 2 persons: staff closing safe; adult male (grey overcoat) at mail sacks K-21..K-26',
      2348: 'CAM2 23:48:00 baggage car - 2 persons: adult male (grey overcoat) pointing toward rear of train',
      2350: 'CAM2 23:50:40 baggage car - 2 persons leaving toward car3',
    };
    const frame = (hhmm) => ({ format: 'jpeg', data: { comment: comments[hhmm] || `CAM2 ${String(hhmm).padStart(4, '0').replace(/(..)(..)/, '$1:$2')}:00 baggage car - ${hhmm >= 2352 || hhmm < 1200 ? '0 persons' : '0 persons; safe closed'}`, size: '1280x720' }, size: 1180000 + (hhmm % 97) * 1301 });
    const frames = [];
    for (let t = T(22, 0); t <= T(0, 14); t += 120000) frames.push(Number(U.strftime('%H%M', new Date(t))));
    for (const k of Object.keys(comments)) if (!frames.includes(Number(k))) frames.push(Number(k));
    frames.sort((a, b) => ((a < 1200 ? a + 2400 : a) - (b < 1200 ? b + 2400 : b)));
    D('/var/lib/cctv/car2', { mode: 0o755, owner: 'cctv', group: 'cctv' });
    const gone = (f) => f >= 2330 && f <= 2359;
    for (const f of frames) {
      if (gone(f)) continue;
      const name = `frame-${String(f).padStart(4, '0')}.jpg`;
      const x = frame(f);
      fs.put('/var/lib/cctv/car2/' + name, '', { format: x.format, data: x.data, size: x.size, owner: 'cctv', group: 'cctv', mode: 0o644, mtime: T(Math.floor(f / 100), f % 100) });
    }
    for (const cam of ['car3_dining', 'car4_lounge', 'car5_sleeper_a', 'car6_sleeper_b']) {
      D('/var/lib/cctv/' + cam, { mode: 0o755, owner: 'cctv', group: 'cctv' });
      for (let t = T(19, 15), i = 0; t <= T(0, 0); t += 10 * 60000, i++) {
        fs.put(`/var/lib/cctv/${cam}/seg-${U.strftime('%H%M', new Date(t))}.mp4`, '', { format: 'mp4', data: { cam }, size: 142000000 + i * 911, owner: 'cctv', group: 'cctv', mode: 0o644, mtime: t + 600000 });
      }
    }

    /* ================= homes ================= */
    const home = '/home/' + u;
    D(home, { owner: u, group: u, mode: 0o755, mtime: T(19, 50) });
    const Y = (p, c, x = {}) => F(home + '/' + p, c, Object.assign({ owner: u, group: u, mode: 0o644, mtime: T(19, 50) }, x));
    Y('README_FIRST.txt', `Welcome aboard. Read this before you touch anything.                — V.

This server is called meridian. As far as computers go, it IS the train:
  /srv/meridian/       the train itself: cars, manifests, timetable, PA
  /var/log/meridian/   what the train remembers: doors, safe, cameras
  /etc/meridian/       how the train is set up (keycards, doors)
  /usr/local/bin/      the little tools we wrote (safectl, ...)

Your account:        ${u}
Temporary password:  brass-lantern-9      <- change it on your first shift

My rules. There are four.
  1. Look before you touch. ls, cat, less. Then decide.
  2. Never work on the only copy of anything.
  3. If something is strange, write down the time.
  4. Logs don't lie. People who edit logs do.

If I'm not at the desk I'm walking the train. Page me: 0201.
`, { mtime: T(18, 2) });
    Y('.bashrc', R`# ~/.bashrc: executed by bash(1) for non-login shells.
case $- in
    *i*) ;;
      *) return;;
esac
HISTCONTROL=ignoreboth
HISTSIZE=1000
PS1='${LA.distroPS1(w.distro)}'
alias ls='ls --color=auto'
alias grep='grep --color=auto'
`);
    Y('.profile', '# ~/.profile\nif [ -n "$BASH_VERSION" ]; then\n    if [ -f "$HOME/.bashrc" ]; then\n        . "$HOME/.bashrc"\n    fi\nfi\nif [ -d "$HOME/bin" ] ; then\n    PATH="$HOME/bin:$PATH"\nfi\n');
    Y('.bash_history', 'ls\ncat README_FIRST.txt\nexit\n', { mode: 0o600 });
    D(home + '/.ssh', { owner: u, group: u, mode: 0o700 });
    Y('.ssh/id_ed25519', '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\nQyNTUxOQAAACBtcmVyaWRpYW4tdHJhaW5lZS1rZXktZG8tbm90LXNoYXJlAAAAmE1lcmlk\naWFuVHJhaW5lZUtleUFBQUFDM056YUMxbFpESTFOVEU1QUFBQUlNM3IxZDE0blRyNDFu\n-----END OPENSSH PRIVATE KEY-----\n', { mode: 0o600 });
    Y('.ssh/id_ed25519.pub', KEY_YOU(u) + '\n');

    D('/home/vesna', { owner: 'vesna', group: 'vesna', mode: 0o700, mtime: T(0, 9, 55) });
    const V = (p, c, x = {}) => F('/home/vesna/' + p, c, Object.assign({ owner: 'vesna', group: 'vesna', mode: 0o600, mtime: T(21, 10) }, x));
    V('notes.txt', `tonight — 1N47
- atlas in the car2 safe. conservator Dr Brandt (A5) holds the PIN.
- escort: L. Marsh, "Arden Mutual". turned up at 22:40 with a letter saying
  the real escort, a Mr Vos, was ill and he'd been sent instead. Abel
  issued him 0417 (car2 only, until 06:30).
- Marsh asked me three things before we left Calder:
    which car the Kessel mail sacks ride in          (car2, with the safe)
    whether the cameras record sound                 (no)
    whether the train keeps any logs off this server (I said no. That isn't
                                                      true — the loco recorder
                                                      does. Habit. Never tell
                                                      strangers about backups.)
- new trainee starts tonight. good. I need someone to say this to.
`, { mtime: T(23, 20) });
    V('todo.txt', '- rotate my laptop key\n- teach the trainee the recorder\n- stop Amadou feeding the driver stew at 3am\n');
    V('.bash_history', `cd /var/log/meridian
tail -n 20 doors.log
sudo systemctl status cctvd
less /etc/meridian/cards.csv
cd ~
vim notes.txt
cd /var/log/meridian
ls
sudo sed -i '/0417/d; /car8_mail/d' doors.log.1
sudo rm /var/lib/cctv/car2/frame-233*.jpg /var/lib/cctv/car2/frame-234*.jpg /var/lib/cctv/car2/frame-235*.jpg
sudo passwd vesna
sudo useradd -m -d /var/lib/.maint -s /bin/bash -G sudo maint
sudo passwd maint
mkdir /tmp/.t
nano /tmp/.t/hold.sh
chmod +x /tmp/.t/hold.sh
sudo nohup /tmp/.t/hold.sh &
sudo systemctl stop doord
sudo systemctl disable doord
sudo crontab -e
sudo nano /srv/meridian/manifest/mail.csv
exit
`, { mtime: T(0, 9, 55) });
    D('/home/vesna/.ssh', { owner: 'vesna', group: 'vesna', mode: 0o700 });
    V('.ssh/authorized_keys', KEY_VESNA + '\n');
    D('/home/abel', { owner: 'abel', group: 'crew', mode: 0o750 });
    F('/home/abel/cards_issued.txt', `TEMPORARY CARDS — 1N47
22:41  0417  L. MARSH, Arden Mutual — escort for the Halvard Atlas (car2 only, until 06:30)
             (said Mr P. Vos was taken ill; produced a letter on Arden paper signed "P. Vos")
`, { owner: 'abel', group: 'crew', mode: 0o640, mtime: T(22, 42) });
    F('/home/abel/kessel_mail.txt', 'KESSEL MAIL — handed over at Kessel Junction\nsacks K-21 to K-26 · 6 sacks · 18.4 kg total · checked and signed A.O. 22:34\n', { owner: 'abel', group: 'crew', mode: 0o640, mtime: T(22, 34) });
    D('/home/rosa', { owner: 'rosa', group: 'rosa', mode: 0o750 });
    D('/home/amadou', { owner: 'amadou', group: 'amadou', mode: 0o750 });
    D('/var/lib/kiosk', { owner: 'kiosk', group: 'kiosk', mode: 0o750 });
    D('/var/lib/.maint', { owner: 'maint', group: 'maint', mode: 0o755, mtime: T(0, 3, 30) });
    F('/var/lib/.maint/.bashrc', '# ~/.bashrc\n', { owner: 'maint', group: 'maint', mtime: T(0, 3, 30) });
    F('/var/lib/.maint/tidy.sh', `#!/bin/bash
# the list. do it in this order. do NOT improvise.  — R.L.
#  [x] 23:36  car2: rattle the safe until it pages the engineer
#  [x] 23:44  watch her type the safe PIN *and* her password
#  [x] 23:46  swap the atlas for the dummy, atlas -> sack, sack -> pile
#  [x] 23:53  the rear van seals itself. walk her there.
#  [x] 00:01  doors log: lose the escort card and the rear van
#  [x] 00:03  a key of your own (maint) — hers will be changed
#  [x] 00:06  keep the door daemon down until Kessel
#  [x] 00:08  the sack on the manifest, poste restante, Kessel
#  [ ] 04:30  last sweep: cameras, recorder, this file
#  [ ] 04:41  step off at Kessel like everyone else
sleep 3600
`, { owner: 'maint', group: 'maint', mode: 0o700, mtime: T(0, 3, 50) });
    D('/tmp/.t', { owner: 'vesna', group: 'vesna', mode: 0o755, mtime: T(0, 6, 2) });
    F('/tmp/.t/hold.sh', '#!/bin/bash\n# keep doord down\nwhile true; do\n    systemctl is-active --quiet doord && systemctl stop doord\n    sleep 20\ndone\n', { owner: 'vesna', group: 'vesna', mode: 0o755, mtime: T(0, 6, 2) });

    /* ================= cron ================= */
    F(LA.cronSpool(w) + '/root', `# DO NOT EDIT THIS FILE - edit the master and reinstall.
# m h  dom mon dow   command
*/15 * * * * /opt/meridian/bin/recorder-sync
55 2 * * * rm -rf /var/lib/cctv/car2 /var/log/meridian/doors.log.2.gz
`, { owner: 'root', group: 'crontab', mode: 0o600, mtime: T(0, 7, 20) });

    /* ================= system logs ================= */
    const syslogLines = [];
    const SL = (t, s) => syslogLines.push(`${U.syslogDate(t)} meridian ${s}`);
    SL(w.bootTime, 'kernel: Linux version 6.1.0-meridian (builder@meridian) #1 SMP PREEMPT_DYNAMIC 2026');
    SL(T(19, 13), 'cctvd[611]: cameras online');
    SL(T(23, 30), 'doord[602]: departure: car doors to travel mode');
    SL(T(23, 38, 4), 'safed[640]: ALARM car2 safe vibration level 3 — paging 0201');
    SL(T(23, 45, 30), 'CRON[1840]: (root) CMD (/opt/meridian/bin/recorder-sync)');
    SL(T(23, 53, 34), 'doord[602]: car8_mail: door closed, seal mode: LOCKED');
    SL(T(23, 58, 40), 'sshd[1902]: Accepted publickey for vesna from 10.8.0.12 port 51122 ssh2');
    SL(T(0, 0, 0), 'logrotate[1931]: rotating /var/log/meridian/doors.log');
    SL(T(0, 0, 30), 'CRON[1934]: (root) CMD (/opt/meridian/bin/recorder-sync)');
    SL(T(0, 6, 31), 'systemd[1]: Stopping doord.service - Meridian door controller...');
    SL(T(0, 6, 31), 'systemd[1]: Stopped doord.service - Meridian door controller.');
    SL(T(0, 9, 55), 'sshd[1902]: pam_unix(sshd:session): session closed for user vesna');
    SL(T(0, 12, 5), 'safed[640]: car2 safe opened by 0101');
    SL(T(0, 12, 33), 'safed[640]: CONTENTS MISMATCH car2 safe');
    SL(T(0, 11, 2), 'login[2140]: LOGIN ON ttyS3 BY kiosk');
    F('/var/log/syslog', syslogLines.join('\n') + '\n', { owner: 'syslog', group: 'adm', mode: 0o640, mtime: T(0, 11, 2) });
    const auth = [];
    const AU = (t, s) => auth.push(`${U.syslogDate(t)} meridian ${s}`);
    AU(T(19, 50), `sshd[702]: Accepted password for ${u} from 10.8.0.7 port 40112 ssh2`);
    AU(T(23, 58, 40), 'sshd[1902]: Accepted publickey for vesna from 10.8.0.12 port 51122 ssh2');
    AU(T(0, 1, 12), "sudo:    vesna : TTY=pts/2 ; PWD=/var/log/meridian ; USER=root ; COMMAND=/usr/bin/sed -i /0417/d; /car8_mail/d doors.log.1");
    AU(T(0, 1, 40), 'sudo:    vesna : TTY=pts/2 ; PWD=/var/log/meridian ; USER=root ; COMMAND=/usr/bin/rm /var/lib/cctv/car2/frame-2330.jpg ...');
    AU(T(0, 2, 18), 'sudo:    vesna : TTY=pts/2 ; PWD=/var/log/meridian ; USER=root ; COMMAND=/usr/bin/passwd vesna');
    AU(T(0, 2, 30), 'passwd[1960]: pam_unix(passwd:chauthtok): password changed for vesna');
    AU(T(0, 3, 30), 'sudo:    vesna : TTY=pts/2 ; PWD=/var/log/meridian ; USER=root ; COMMAND=/usr/sbin/useradd -m -d /var/lib/.maint -s /bin/bash -G sudo maint');
    AU(T(0, 3, 30), 'useradd[1971]: new group: name=maint, GID=1005');
    AU(T(0, 3, 30), 'useradd[1971]: new user: name=maint, UID=1005, GID=1005, home=/var/lib/.maint, shell=/bin/bash, from=/dev/pts/2');
    AU(T(0, 3, 30), `useradd[1971]: add 'maint' to group '${LA.distro(w).admin}'`);
    AU(T(0, 3, 51), 'passwd[1975]: pam_unix(passwd:chauthtok): password changed for maint');
    AU(T(0, 6, 2), 'sudo:    vesna : TTY=pts/2 ; PWD=/var/log/meridian ; USER=root ; COMMAND=/usr/bin/nohup /tmp/.t/hold.sh');
    AU(T(0, 6, 31), 'sudo:    vesna : TTY=pts/2 ; PWD=/var/log/meridian ; USER=root ; COMMAND=/usr/bin/systemctl stop doord');
    AU(T(0, 6, 40), 'sudo:    vesna : TTY=pts/2 ; PWD=/var/log/meridian ; USER=root ; COMMAND=/usr/bin/systemctl disable doord');
    AU(T(0, 7, 20), 'sudo:    vesna : TTY=pts/2 ; PWD=/var/log/meridian ; USER=root ; COMMAND=/usr/bin/crontab -e');
    AU(T(0, 8, 12), 'sudo:    vesna : TTY=pts/2 ; PWD=/var/log/meridian ; USER=root ; COMMAND=/usr/bin/nano /srv/meridian/manifest/mail.csv');
    AU(T(0, 9, 55), 'sshd[1902]: pam_unix(sshd:session): session closed for user vesna');
    AU(T(0, 11, 2), 'login[2140]: pam_unix(login:session): session opened for user kiosk(uid=1100) by LOGIN(uid=0)');
    F('/var/log/auth.log', auth.join('\n') + '\n', { owner: 'syslog', group: 'adm', mode: 0o640, mtime: T(0, 11, 2) });
    F('/var/log/kern.log', `${U.syslogDate(w.bootTime)} meridian kernel: Linux version 6.1.0-meridian\n${U.syslogDate(w.bootTime + 1500)} meridian kernel: ttyS3: serial console (mail van kiosk)\n`, { owner: 'syslog', group: 'adm', mode: 0o640 });

    /* ================= processes, services, sessions ================= */
    P({ pid: 602, user: 'root', comm: 'doord', args: '/usr/sbin/doord --conf /etc/meridian/doord.conf', stat: 'Ss', start: w.bootTime + 4000, service: 'doord', onKill: 'serviceDied' });
    w.reap(602);
    P({ pid: 611, user: 'cctv', comm: 'cctvd', args: '/usr/sbin/cctvd --conf /etc/meridian/cctv.conf', stat: 'Ssl', cpu: 3.1, mem: 4.2, vsz: 412000, rss: 86000, start: w.bootTime + 5000, cputime: 1900, service: 'cctvd', onKill: 'serviceDied' });
    P({ pid: 623, user: 'root', comm: 'reefer', args: '/usr/sbin/reefer --car car8_mail --setpoint 4', stat: 'Ss', cpu: 0.4, start: w.bootTime + 5200, service: 'reefer', onKill: 'serviceDied' });
    P({ pid: 640, user: 'root', comm: 'safed', args: '/usr/sbin/safed', stat: 'Ss', start: w.bootTime + 5400 });
    P({ pid: 2071, ppid: 1, user: 'root', comm: 'hold.sh', args: '/bin/bash /tmp/.t/hold.sh', stat: 'S', start: T(0, 6, 2), cputime: 2, onKill: 'holdDied' });
    P({ pid: 2140, user: 'root', comm: 'login', args: '/bin/login -p --', tty: 'ttyS3', stat: 'Ss', start: T(0, 11, 2) });
    P({ pid: 2144, ppid: 2140, user: 'kiosk', comm: 'kioskmenu', args: '/usr/local/bin/kioskmenu', tty: 'ttyS3', stat: 'Ss+', start: T(0, 11, 4) });
    w.nextPid = 2301;
    svc('doord', { desc: 'Meridian door controller', unit: '/etc/systemd/system/doord.service', active: false, enabled: false, since: T(0, 6, 31), comm: 'doord', exec: '/usr/sbin/doord --conf /etc/meridian/doord.conf', memory: '2.2M', cpuStr: '3.010s', onStart: 'doordStarted' });
    svc('cctvd', { desc: 'Meridian CCTV recorder', unit: '/etc/systemd/system/cctvd.service', mainPid: 611, restart: 'always', comm: 'cctvd', exec: '/usr/sbin/cctvd --conf /etc/meridian/cctv.conf', user: 'cctv', memory: '84.0M', cpuStr: '31min 40.112s' });
    svc('reefer', { desc: 'Mail van refrigeration (car8)', unit: '/etc/systemd/system/reefer.service', mainPid: 623, restart: 'always', comm: 'reefer', exec: '/usr/sbin/reefer --car car8_mail --setpoint 4', memory: '1.0M', cpuStr: '40.020s' });
    w.log('meridian', 'systemd', 1, 'Started doord.service - Meridian door controller.', 'doord', true, w.bootTime + 4000);
    w.log('meridian', 'doord', 602, 'loaded 8 doors from /etc/meridian/doord.conf', 'doord', true, w.bootTime + 4100);
    w.log('meridian', 'doord', 602, 'departure: car doors to travel mode', 'doord', true, T(23, 30));
    w.log('meridian', 'doord', 602, 'car8_mail: door closed, seal mode: LOCKED', 'doord', true, T(23, 53, 34));
    w.log('meridian', 'sudo', null, 'vesna : TTY=pts/2 ; PWD=/var/log/meridian ; USER=root ; COMMAND=/usr/bin/systemctl stop doord', 'doord', true, T(0, 6, 31));
    w.log('meridian', 'systemd', 1, 'Stopping doord.service - Meridian door controller...', 'doord', true, T(0, 6, 31));
    w.log('meridian', 'doord', 602, 'caught SIGTERM; doors keep their last state', 'doord', true, T(0, 6, 31));
    w.log('meridian', 'systemd', 1, 'doord.service: Deactivated successfully.', 'doord', true, T(0, 6, 31));
    w.log('meridian', 'systemd', 1, 'Stopped doord.service - Meridian door controller.', 'doord', true, T(0, 6, 31));
    w.log('meridian', 'sudo', null, 'vesna : TTY=pts/2 ; PWD=/var/log/meridian ; USER=root ; COMMAND=/usr/bin/systemctl disable doord', 'doord', true, T(0, 6, 40));
    w.log('meridian', 'systemd', 1, 'Started cctvd.service - Meridian CCTV recorder.', 'cctvd', true, w.bootTime + 5000);
    w.log('meridian', 'cctvd', 611, 'car2: 15 stills removed (unlink by uid 0)', 'cctvd', true, T(0, 1, 40));
    w.journal.sort((a, b) => a.t - b.t);
    w.sessions = [];
    w.wtmp = [
      { user: 'vesna', tty: 'pts/0', from: '10.8.0.12', at: T(19, 31), host: 'meridian', out: '- 23:20  (03:49)' },
      { user: u, tty: 'pts/1', from: '10.8.0.7', at: T(19, 50), host: 'meridian', out: '- 21:02  (01:12)' },
      { user: 'vesna', tty: 'pts/2', from: '10.8.0.12', at: T(23, 58, 40), host: 'meridian', out: '- 00:09  (00:11)' },
    ];
    w.addSession({ user: 'kiosk', tty: 'ttyS3', from: '', host: 'meridian', at: T(0, 11, 2), idle: '1:12m', what: 'kioskmenu' });
    w.sockets.push({ proto: 'tcp', state: 'LISTEN', local: '0.0.0.0:8554', peer: '0.0.0.0:*', pid: 611, comm: 'cctvd', user: 'cctv', host: 'meridian' });

    /* ================= the event recorder (plugged in later) ================= */
    const rec = new LA.Node('dir', 'recorder', { mode: 0o755, mtime: T(1, 0) });
    const rfs = new LA.VFS(rec, fs.users);
    const RF = (p, c, x = {}) => rfs.put(p, c, Object.assign({ mode: 0o644, mtime: T(1, 0) }, x));
    RF('/README.TXT', 'MERIDIAN 1N47 — LOCOMOTIVE EVENT RECORDER\nSnapshots of /var/log/meridian and /srv/meridian/manifest every 15 minutes.\nCCTV stills are archived hourly as tar.gz.\nREMOVE ONLY WITH THE TRAIN STOPPED OR WITH THE DRIVER\'S PERMISSION.\n');
    const snap = (stamp, t, withLog1, mailRows, doors) => {
      rfs.dir('/snapshots/' + stamp, { mtime: t });
      RF(`/snapshots/${stamp}/doors.log`, doors, { mtime: t });
      if (withLog1) RF(`/snapshots/${stamp}/doors.log.1`, withLog1, { mtime: t });
      RF(`/snapshots/${stamp}/mail.csv`, mailCsv(mailRows), { mtime: t });
      RF(`/snapshots/${stamp}/passengers.csv`, fs.contentOf(fs.get('/srv/meridian/manifest/passengers.csv')), { mtime: t });
    };
    const upTo = (t) => inHour(23).filter((e) => e.t <= t).map(line).join('\n') + '\n';
    snap('2345', T(23, 45, 30), null, MAIL, upTo(T(23, 45, 30)));
    snap('0000', T(0, 0, 30), log1orig, MAIL, '');
    /* from 00:15 on, every copy carries his edits: the recorder faithfully backs up whatever is on the server */
    for (const t of pack.SNAPSHOTS.slice(2)) snap(t, T(Number(t.slice(0, 2)), Number(t.slice(2)), 30), log1, MAIL.concat([SACK_27]), log0);
    rfs.dir('/cctv', { mtime: T(0, 0, 30) });
    const tarFrames = frames.filter((f) => f >= 2300 && f <= 2359).map((f) => {
      const x = frame(f);
      return { path: `car2/frame-${f}.jpg`, type: 'file', mode: 0o644, owner: 'cctv', group: 'cctv', mtime: T(23, f % 100), format: x.format, data: x.data, size: x.size };
    });
    rfs.put('/cctv/car2-23.tar.gz', '', { format: 'gzip', data: { name: 'car2-23.tar', inner: { format: 'tar', data: { entries: [{ path: 'car2/', type: 'dir', mode: 0o755, owner: 'cctv', group: 'cctv', mtime: T(0, 0) }].concat(tarFrames) } } }, mode: 0o644, mtime: T(0, 0, 30), size: 41022331 });
    rfs.put('/cctv/car2-22.tar.gz', '', { format: 'gzip', data: { name: 'car2-22.tar', inner: { format: 'tar', data: { entries: frames.filter((f) => f >= 2200 && f < 2300).map((f) => { const x = frame(f); return { path: `car2/frame-${f}.jpg`, type: 'file', mode: 0o644, owner: 'cctv', group: 'cctv', mtime: T(22, f % 100), format: x.format, data: x.data, size: x.size }; }) } } }, mode: 0o644, mtime: T(23, 0, 30), size: 35120044 });
    /* not a device yet: Rosa carries it back from the locomotive in chapter 10 */
    w.devices.unplugged_recorder = rec;
    w.devStats.sdb1 = { size: 7756800, used: 1203324, type: 'vfat' };
    w.disks = [
      { name: 'sda', majmin: '8:0', rm: '0', size: '30G', parts: [
        { name: 'sda1', majmin: '8:1', size: '29G', fstype: 'ext4', uuid: '1847a1b2-0c4d-4e5f-9a00-merid1an0001', fixedMount: '/' },
        { name: 'sda2', majmin: '8:2', size: '1G', fstype: 'swap', uuid: 'swap0000-1847-4000-8000-000000000002', fixedMount: '[SWAP]' },
      ] },
    ];
    w.fstabList = [{ dev: '/dev/sda1', path: '/' }];
    D('/mnt/recorder', { mode: 0o755 });

    /* ================= Kessel Junction (beyond the tunnel) ================= */
    const kusers = new LA.Users({
      users: {
        root: { uid: 0, gid: 0, home: '/root', shell: '/bin/bash', gecos: 'root' },
        sshd: { uid: 105, gid: 65534, home: '/run/sshd', shell: '/usr/sbin/nologin', gecos: '' },
        bente: { uid: 1000, gid: 1000, home: '/home/bente', shell: '/bin/bash', gecos: 'Bente Brandvold,,,Stationmaster' },
        holm: { uid: 1001, gid: 1001, home: '/home/holm', shell: '/bin/bash', gecos: 'Dagny Holm,,,Inspector, Kessel police' },
        [u]: { uid: 2000, gid: 2000, home: '/home/' + u, shell: '/bin/bash', gecos: `${User},,,Meridian crew` },
        nobody: { uid: 65534, gid: 65534, home: '/nonexistent', shell: '/usr/sbin/nologin', gecos: 'nobody' },
      },
      groups: LA.adaptGroups({ root: { gid: 0, members: [] }, sudo: { gid: 27, members: ['bente'] }, police: { gid: 1100, members: ['holm', u] }, bente: { gid: 1000, members: [] }, holm: { gid: 1001, members: [] }, [u]: { gid: 2000, members: [] }, nogroup: { gid: 65534, members: [] } }, w.distro),
    });
    const kroot = new LA.Node('dir', '/', { mtime: old });
    const kfs = new LA.VFS(kroot, kusers);
    w.hosts.kessel = { name: 'kessel', fqdn: 'kessel.rail', ip: '10.20.0.5', mac: '52:54:00:6e:05:05', users: kusers, fs: kfs };
    w.passwords.kessel = { bente: rand(), holm: rand(), root: rand(), [u]: rand() };
    for (const d of ['/etc', '/home', '/usr', '/usr/bin', '/var', '/var/log', '/tmp', '/root', '/srv']) kfs.dir(d, { mode: d === '/tmp' ? 0o1777 : d === '/root' ? 0o700 : 0o755, immutable: true });
    for (const name of Object.keys(LA.commands)) {
      const c = LA.commands[name];
      if ((c.builtin && !['echo', 'pwd', 'printf', 'kill', 'test', '[', 'true', 'false'].includes(name)) || LA.foreignCmd(name, w.distro) || c.meta || ['htop', 'cowsay', 'fortune', 'sl', 'neofetch', 'cmatrix', 'fail2ban-client', 'beacon', 'kw0rker', 'lethe', 'xyzzy', 'pet'].includes(name)) continue;
      kfs.put('/usr/bin/' + name, '', { format: 'elf', data: { cmd: name }, mode: 0o755, mtime: old });
    }
    kfs.link('/bin', 'usr/bin');
    kfs.put('/etc/hostname', 'kessel\n');
    kfs.put('/etc/passwd', ''); kfs.put('/etc/group', ''); kfs.put('/etc/shadow', '', { mode: 0o640 });
    kfs.put('/etc/motd', R`
   _  _______ ____ ____ _____ _          KESSEL JUNCTION — border station
  | |/ / ____/ ___/ ___| ____| |         stationmaster: B. Brandvold
  | ' /|  _| \___ \___ \  _| | |
  | . \| |___ ___) |__) | |___| |___     police evidence drop: /srv/police
  |_|\_\_____|____/____/|_____|_____|

`);
    kfs.dir('/home/' + u, { owner: u, group: u, mode: 0o755 });
    kfs.dir('/home/' + u + '/.ssh', { owner: u, group: u, mode: 0o700 });
    kfs.put('/home/' + u + '/.ssh/authorized_keys', KEY_YOU(u) + '\n', { owner: u, group: u, mode: 0o600 });
    kfs.dir('/srv/police', { owner: 'holm', group: 'police', mode: 0o775 });
    kfs.dir('/srv/police/inbox', { owner: 'holm', group: 'police', mode: 0o3775 });
    kfs.put('/srv/police/README.txt', `KESSEL JUNCTION POLICE — evidence drop

To the crew of the Meridian (1N47):

Your stationmaster's radio call reached me at 03:54. Inspector Dagny Holm.
Put whatever you have in /srv/police/inbox — copies, not originals, and with
checksums, if your engineer is the one I think she is.

My officers will be on the platform when you arrive at 04:40. Do NOT let
anybody off the train before we board, and do not confront anyone.
Nobody is a hero at five in the morning.

                                                        — D. Holm
`, { owner: 'holm', group: 'police', mode: 0o644 });
    kfs.put('/var/log/auth.log', '', { mode: 0o640 });
    w.syncAccounts(w.hosts.kessel);
    w.syncAccounts(w.hosts.meridian);

    for (const r of [fs.root, kroot, rec]) LA.settleMtimes(r, buildStart, old);
    pack.worldStatic(w);
    return w;
  };

  /* non-serialised data: the network, which depends on whether the radio link is up */
  pack.worldStatic = function (w) {
    const radio = !!w.flags.radio;
    /* dates on the outside world's pages follow the story's night, whatever day the game was started */
    const T = pack.nightClock(w.flags.night || LA.now());
    const eve = new Date(T(18, 5));
    const nth = (d) => d + (d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th');
    const sale = new Date(eve.getTime() + 4 * 86400000);
    const dm = (d) => `${d.getDate()} ${U.MON[d.getMonth()]}`;
    const m = w.hosts.meridian;
    m.ifaces = [
      { name: 'eth0', ip: '10.8.0.1', prefix: 24, mac: '52:54:00:8a:14:01', up: true, brd: '10.8.0.255' },
      { name: 'radio0', ip: '172.16.40.2', prefix: 30, mac: '', p2p: true, up: radio, mtu: 1400 },
    ];
    m.routes = radio
      ? ['default via 172.16.40.1 dev radio0 proto static metric 50 ', '10.8.0.0/24 dev eth0 proto kernel scope link src 10.8.0.1 ', '172.16.40.0/30 dev radio0 proto kernel scope link src 172.16.40.2 ']
      : ['10.8.0.0/24 dev eth0 proto kernel scope link src 10.8.0.1 '];
    m.neigh = '10.8.0.12 dev eth0 lladdr 3c:22:fb:0a:11:12 STALE\n10.8.0.33 dev eth0 lladdr a4:83:e7:5d:02:33 REACHABLE\n10.8.0.7 dev eth0 lladdr 52:54:00:8a:14:07 REACHABLE';
    w.net = [
      { names: ['meridian', 'meridian.rail'], ip: '10.8.0.1', up: true, latency: 0.04, hostKey: 'meridian', ptr: 'meridian.rail' },
      { names: ['vesna-laptop', 'vesna-laptop.meridian.rail'], ip: '10.8.0.12', up: true, latency: 2.1, ptr: 'vesna-laptop.meridian.rail' },
      { names: ['cabin-a3', 'cabin-a3.meridian.rail'], ip: '10.8.0.33', up: true, latency: 3.4, icmp: false, ptr: 'cabin-a3.meridian.rail' },
      { names: ['pkg-cache', 'pkg-cache.meridian.rail'], ip: '10.8.0.2', up: true, latency: 0.3, ptr: 'pkg-cache.meridian.rail' },
      { names: ['kessel', 'kessel.rail'], ip: '10.20.0.5', up: radio, latency: 41.3, ssh: true, hostKey: 'kessel', ptr: 'kessel.rail' },
      { names: ['auction.isolde', 'www.halloway-penn.isolde', 'halloway-penn.isolde'], ip: '203.0.113.40', up: radio, latency: 58.7, http: true, hostKey: 'auction', ptr: 'www.halloway-penn.isolde' },
    ];
    w.txt = { 'meridian.rail': 'train=1N47; built=1987; motto=we get there in the end', 'kessel.rail': 'border=yes; customs=24h' };
    w.http = {
      auction: {
        '/': { type: 'text/html', body: '<!DOCTYPE html>\n<html><head><title>Halloway &amp; Penn — Port Isolde</title></head>\n<body>\n<h1>Halloway &amp; Penn</h1>\n<p>Fine maps, books and manuscripts since 1871.</p>\n<ul><li><a href="/lots/halvard-atlas">Lot 112 — The Halvard Atlas (1683)</a></li></ul>\n</body></html>\n' },
        '/lots/halvard-atlas': { body: `HALLOWAY & PENN — SALE OF FINE MAPS · PORT ISOLDE · ${dm(sale).toUpperCase()}

LOT 112   THE HALVARD ATLAS (1683)
          41 engraved maps, hand-coloured. Estimate on request.

IN TRANSIT
The atlas travels to Port Isolde aboard the Meridian sleeper (1N47) on the
night of the ${nth(eve.getDate())}, in the custody of Dr Ottilie Brandt, conservator, and
accompanied by the insurer's escort:

    Mr Pieter Vos, Arden Mutual (escort licence AM-2291)

Update, ${dm(eve)}, 18:05: Arden Mutual confirm that Mr Vos is unwell and will
NOT be travelling. Arden are not sending a substitute; Dr Brandt will travel
alone and the train crew have been informed.        (Arden Mutual, claims desk)

Photograph of the escort for the crew: /lots/halvard-atlas/escort.jpg
` },
        '/lots/halvard-atlas/escort.jpg': { type: 'image/jpeg', body: '', binary: { format: 'jpeg', data: { comment: 'Pieter Vos, Arden Mutual escort AM-2291 — 1.66 m, bald, glasses, 61 years old', size: '600x800' } } },
        '/robots.txt': { body: 'User-agent: *\nDisallow: /staff/\n' },
        '/staff': { body: 'HALLOWAY & PENN — STAFF NOTICES\n\n* The coffee machine is not broken, it is "descaling". It has been descaling since March.\n* Whoever keeps bidding on lot 112 from the office computer as a joke: we can see you, Gerald.\n' },
      },
    };
  };

  /* the train's own reactions: a door daemon that won't stay up, a flare that goes out, an intruder who is cut off */
  pack.worldHooks = {
    doordStarted(s, pid) {
      if (this.procs.some((p) => p.comm === 'hold.sh')) {
        this.log(this.mainName, 'hold.sh', 2071, 'doord is active — stopping it', 'doord');
        this.stopService('doord');
        return;
      }
      this.log(this.mainName, 'doord', pid, 'loaded 8 doors from /etc/meridian/doord.conf', 'doord');
      this.log(this.mainName, 'doord', pid, 'car8_mail: sealed — waiting for a remote release in /srv/meridian/cars/car8_mail/door', 'doord');
    },
    holdDied() { this.log(this.mainName, 'kernel', null, 'hold.sh[2071]: terminated', 'kernel', true); },
    flareDied() { this.flags.flareOut = true; },
    /* his login shell dies: the whole session goes with it */
    maintGone() {
      this.removeSession((s) => s.user === 'maint');
      this.procs = this.procs.filter((p) => p.user !== 'maint' && p.pid !== 3100);
      this.sockets = this.sockets.filter((s) => !(s.peer && s.peer.startsWith('10.8.0.33')));
      const w = this.wtmp.find((x) => x.user === 'maint' && !x.out);
      if (w) w.out = `- ${U.strftime('%H:%M', new Date(LA.now()))}  (killed)`;
    },
  };
})();
