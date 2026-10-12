/* Night Train, Chapter 13 — Out of the Tunnel (ip, ping, dig, host, curl, wget, ssh, scp, ss) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;
  const pack = LA.stories.nighttrain;
  const LOT = 'http://auction.isolde/lots/halvard-atlas';

  pack.add({
    n: 13, id: 'tunnel', title: 'Out of the Tunnel', place: 'km 214 · the Kessel valley', clock: [1, 3, 54],
    unlocks: ['ip', 'ping', 'dig', 'host', 'curl', 'wget', 'ssh', 'scp', 'ss'],
    onStart(g) {
      const w = g.world;
      w.flags.radio = true;
      pack.worldStatic(w);
      if (w.flags.intruder) return;
      w.flags.intruder = true;
      /* 03:50 — while everyone watched the tunnel walls, someone logged in from cabin A3 */
      const at = LA.now() - 4 * 60000;
      w.spawn({ pid: 3100, user: 'root', comm: 'sshd', args: 'sshd: maint [priv]', stat: 'Ss', start: at, onKill: 'maintGone' });
      w.spawn({ pid: 3101, ppid: 3100, user: 'maint', comm: 'bash', args: 'bash /var/lib/.maint/tidy.sh', tty: 'pts/4', stat: 'S+', start: at + 3000, onKill: 'maintGone' });
      w.spawn({ pid: 3102, ppid: 3101, user: 'maint', comm: 'sleep', args: 'sleep 3600', tty: 'pts/4', stat: 'S+', start: at + 3100 });
      w.addSession({ user: 'maint', tty: 'pts/4', from: '10.8.0.33', host: 'meridian', at, idle: '3:58', what: 'bash /var/lib/.maint/tidy.sh' });
      w.sockets.push({ proto: 'tcp', state: 'ESTAB', local: '10.8.0.1:22', peer: '10.8.0.33:51544', pid: 3100, comm: 'sshd', user: 'root', host: 'meridian' });
      const a = g.fs.tryGet('/var/log/auth.log');
      if (a) a.content += `${LA.util.syslogDate(at)} meridian sshd[3100]: Accepted password for maint from 10.8.0.33 port 51544 ssh2\n`;
    },
    intro: N`Out into the valley, and the whole train exhales. Phones start buzzing in sleeper B — people who'd forgotten there was an outside world.

@Vesna: Radio's up. First, tell somebody with handcuffs what's happened. Abel's calling the stationmaster at Kessel on the train phone. We send the evidence ourselves.`,
    steps: [
      {
        say: N`Check the network side of this machine. «ip a» (short for «ip address») lists the network interfaces and their addresses.`,
        goal: 'List the interfaces: «ip a»',
        hints: ['Type «ip a».'],
        check: (e) => !!e.ran('ip', (r) => /radio0/.test(r.out)),
        solve: ['ip a'],
        done: N`«eth0» — «10.8.0.1/24», the train's own network: cabins, laptops, the kiosk.
«radio0» — «state UP», «172.16.40.2/30». An hour ago it said DOWN and had no address at all.`,
      },
      {
        say: N`Being connected isn't the same as having a way out. «ip r» shows the **routing table** — where packets for each destination go.`,
        goal: 'Show the routes: «ip r»',
        hints: ['Type «ip r».'],
        check: (e) => !!e.ran('ip', (r) => /^r/.test(r.args.filter((a) => !a.startsWith('-'))[0] || '') && /default/.test(r.out)),
        solve: ['ip r'],
        done: N`«default via 172.16.40.1 dev radio0» — anything that isn't on the train goes out over the radio. Inside the tunnel that line simply wasn't there: no default route, no way out.`,
      },
      {
        say: N`Is Kessel Junction's server there? «ping» sends small echo requests and times the replies; «-c 3» sends three and stops.`,
        goal: 'Ping the station: «ping -c 3 kessel»',
        hints: ['Type «ping -c 3 kessel».'],
        check: (e) => !!e.ran('ping', (r) => /bytes from/.test(r.out)),
        solve: ['ping -c 3 kessel'],
        done: N`Three replies, about forty milliseconds each — slow, by computer standards, as radio links are. But there.`,
      },
      {
        say: N`Names become addresses through **DNS**. «dig» shows the full question and answer; «host» is the short, friendly version.`,
        goal: 'Look up the station with «dig kessel.rail», then the auction house with «host www.halloway-penn.isolde»',
        hints: ['«dig kessel.rail»', 'then «host www.halloway-penn.isolde»'],
        check: (e) => e.stepRan('dig') && e.stepRan('host'),
        solve: ['dig kessel.rail', 'host www.halloway-penn.isolde'],
        done: N`«kessel.rail. 3600 IN A 10.20.0.5» and «www.halloway-penn.isolde has address 203.0.113.40».

@Vesna: Halloway & Penn — the auction house the Atlas was going to. They'll have a page for the lot.`,
      },
      {
        say: N`«curl» fetches a URL and prints whatever comes back.`,
        goal: 'Read the auction lot page: «curl http://auction.isolde/lots/halvard-atlas»',
        hints: ['Type «curl http://auction.isolde/lots/halvard-atlas».'],
        check: (e) => !!e.event('curl', (ev) => /halvard-atlas$/.test(ev.url)),
        solve: ['curl ' + LOT],
        done: N`*"...accompanied by the insurer's escort: **Mr Pieter Vos**, Arden Mutual."*
*"Update, 10 Oct, 18:05: Arden Mutual confirm that Mr Vos is unwell and will NOT be travelling. **Arden are not sending a substitute.**"*

@Abel: (very still) He had a letter. Signed P. Vos.
@Vesna: He had a letter signed by a man who was in bed with flu. There is no Mr Marsh of Arden Mutual. There never was.`,
        evidence: 'impostor',
      },
      {
        say: N`The page links a photograph of the real escort. «wget» is built for downloading: it saves a URL into a file in your current directory. Then ask «file» what you've got.`,
        goal: 'Download the photo and identify it: «wget http://auction.isolde/lots/halvard-atlas/escort.jpg», then «file escort.jpg»',
        hints: ['«wget http://auction.isolde/lots/halvard-atlas/escort.jpg»', 'then «file escort.jpg»'],
        check: (e) => !!e.stepEvent('download', (ev) => /escort\.jpg$/.test(ev.url)) && e.stepRan('file'),
        solve: ['wget ' + LOT + '/escort.jpg', 'file escort.jpg'],
        done: N`«JPEG image data ... comment: "Pieter Vos, Arden Mutual escort AM-2291 - 1.66 m, bald, glasses, 61 years old"»

@June: The man in the grey coat was *tall*. And he had hair. Lots of hair. Very shiny.`,
      },
      {
        say: N`Kessel's police said — through the stationmaster, through Abel — to look on their server. Every crew member has an account on the station servers along the line; it's how the train files its border paperwork, and your key was copied there when you joined.
«ssh» opens a secure shell on another machine. The first time you connect, ssh shows the machine's **host key fingerprint** and asks whether to trust it. Don't just say yes: the railway publishes each station's fingerprint in «/etc/meridian/stations.txt». Compare them first.`,
        goal: 'Check Kessel\'s fingerprint in «/etc/meridian/stations.txt», then «ssh {user}@kessel» and answer «yes» only if it matches',
        hints: ['«grep kessel /etc/meridian/stations.txt» shows the fingerprint to expect.', 'Then «ssh {user}@kessel», compare, and answer «yes».'],
        check: (e) => e.host === 'kessel',
        solve: ['grep kessel /etc/meridian/stations.txt', 'ssh {user}@kessel', { answer: 'yes' }],
        done: N`The fingerprints match, character for character. Had they not, «no» would have been the right answer: someone could be sitting between you and the machine you meant to reach.

Look at your prompt: «{user}@kessel». Every command you type now runs forty kilometres away, in a station building at the border.`,
      },
      {
        say: N`The banner mentioned «/srv/police». Read what's there.`,
        goal: 'Read the police note: «cat /srv/police/README.txt»',
        hints: ['Type «cat /srv/police/README.txt».'],
        check: (e) => e.didRead('/srv/police/README.txt', 'kessel'),
        solve: ['cat /srv/police/README.txt'],
        done: N`*"Put whatever you have in /srv/police/inbox — copies, not originals, and with checksums, if your engineer is the one I think she is... Do NOT let anybody off the train before we board, and do not confront anyone. Nobody is a hero at five in the morning. — D. Holm"*

@Vesna: (reading over your shoulder) Dagny Holm. We were at school together. She's going to be insufferable about this.`,
      },
      {
        say: N`Come back to the train. «exit» closes the remote shell.`,
        goal: 'Leave the station\'s server: «exit»',
        hints: ['Type «exit».'],
        check: (e) => e.host === 'meridian' && !!e.stepEvent('shellExit', (ev) => ev.host === 'kessel'),
        solve: ['exit'],
        done: N`«Connection to kessel closed.» Your prompt says «meridian» again.`,
      },
      {
        say: N`«scp» copies files over SSH. A remote path is written «host:path». You can give it several files at once — the last argument is the destination.`,
        goal: 'Send the evidence and Marsh\'s timeline: «scp ~/evidence.zip ~/case/timeline_0417.txt kessel:/srv/police/inbox/»',
        hints: ['Type «scp ~/evidence.zip ~/case/timeline_0417.txt kessel:/srv/police/inbox/».'],
        check: (e) => { const k = e.world.hosts.kessel.fs; return !!k.tryGet('/srv/police/inbox/evidence.zip') && !!k.tryGet('/srv/police/inbox/timeline_0417.txt'); },
        solve: ['scp ~/evidence.zip ~/case/timeline_0417.txt kessel:/srv/police/inbox/'],
        done: N`«evidence.zip 100%» · «timeline_0417.txt 100%».

Ninety seconds later the train phone rings. Abel listens, says «Yes, Inspector» four times, and hangs up.
@Abel: Officers on the platform at Kessel. Nobody off until they're aboard. And — she says well done.`,
      },
      {
        say: N`@Vesna: One more habit before we relax: look at who's connected to this box. «ss» lists network connections; «-t» TCP, «-n» numbers instead of names, «-p» the process behind each one — which, for other people's processes, needs root.`,
        goal: 'Check the live connections: «sudo ss -tnp»',
        hints: ['Type «sudo ss -tnp».'],
        check: (e) => !!e.event('sockets', (ev) => ev.root) && /10\.8\.0\.33/.test(e.out()),
        solve: ['sudo ss -tnp', '$PW'],
        done: N`«ESTAB  10.8.0.1:22  10.8.0.33:51544  users:(("sshd",pid=3100,...))»

An SSH connection to this server, open right now, from «10.8.0.33».
@June: That's in the hosts file. «cabin-a3».

Nobody says anything for a moment. Somewhere ahead, Rosa sounds the horn for a level crossing.
@Vesna: He's *in* here. Right now. While we've been reading his mail.`,
      },
    ],
    outro: N`@Abel: Twenty minutes to Kessel.
@Vesna: Then we have twenty minutes to throw him out of my train.`,
  });
})();
