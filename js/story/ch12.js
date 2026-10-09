/* Chapter 12 — The Lighthouse (ip, ping, dig, ss, curl, wget, ssh, scp, apt) */
(function () {
  'use strict';
  const LA = globalThis.LA;
  const N = String.raw;

  LA.story.add({
    n: 12, id: 'lighthouse', title: 'The Lighthouse', place: '10.0.0.2',
    unlocks: ['ip', 'ifconfig', 'ping', 'dig', 'host', 'nslookup', 'ss', 'netstat', 'curl', 'wget', 'ssh', 'scp', 'apt'],
    intro: N`You can't walk to the Lighthouse. It isn't *in* Rootfall at all — it's another machine, standing at the edge of the city's network, its beam sweeping out into a dark that nobody in Rootfall has ever seen.

To reach it, you have to talk across the wire.

:::art
       rootfall (you)                         lighthouse
      .-------------.     the network       .-------------.
      |  10.0.0.7   |=======================|  10.0.0.2   |
      '-------------'          |            '-------------'
                               |                   \ \ \  beam
                         10.0.0.66 (??)
:::`,
    steps: [
      {
        say: N`First, know your own address. Every machine on a network has an **IP address**. «ip a» (short for «ip address») lists your network interfaces and their addresses.`,
        goal: 'Find your own address: «ip a»',
        hints: ['Type: «ip a»'],
        check: (e) => !!e.event('ip'),
        solve: ['ip a'],
        done: N`«lo» — the loopback, 127.0.0.1, the machine talking to itself.
«eth0» — «inet 10.0.0.7/24». That's you, on the city network.

:::lesson
«ip a» shows addresses · «ip r» shows routes (where packets go) · the old command «ifconfig» does similar things and still turns up in tutorials everywhere.
:::`,
      },
      {
        say: N`Is the Lighthouse there at all? «ping» sends tiny echo requests and times the replies. Without «-c» it pings forever until you press Ctrl+C; «-c 3» sends three and stops.`,
        goal: 'Ping the Lighthouse three times: «ping -c 3 lighthouse»',
        hints: ['Type: «ping -c 3 lighthouse»'],
        check: (e) => !!e.ran('ping', (r) => r.args.some((a) => /lighthouse|10\.0\.0\.2/.test(a))),
        solve: ['ping -c 3 lighthouse'],
        done: N`Three replies, less than a millisecond each. The beam is turning.

(If you're curious, «ping 10.0.0.66» — Hollow's address — gets *no answer at all*. A firewall swallowing your pings. Press Ctrl+C to give up waiting.)`,
      },
      {
        say: N`How did your machine know «lighthouse» meant 10.0.0.2? It asked **DNS**, the city's directory of names. «dig» shows you the question and the answer.`,
        goal: 'Look up the Lighthouse in DNS: «dig lighthouse.rootfall»',
        hints: ['Type: «dig lighthouse.rootfall» (or «host lighthouse»)'],
        check: (e) => !!e.stepEvent('dns'),
        solve: ['dig lighthouse.rootfall'],
        done: N`«lighthouse.rootfall.  3600  IN  A  10.0.0.2»

:::lesson
DNS turns names into addresses. «dig NAME» gives the full answer · «dig +short NAME» just the address · «host NAME» is the friendly version · «/etc/hosts» can override DNS for a single machine.
:::`,
      },
      {
        say: N`Juno's impostor kworker — you never found out what it was doing. A program that wants to be reached from outside opens a **port** and *listens*. «ss» lists sockets; «-tulpn» is the classic combination: TCP, UDP, listening, processes, numeric. Seeing other users' processes needs root.`,
        goal: 'See what is listening on this machine: «sudo ss -tulpn»',
        hints: ['Type: «sudo ss -tulpn»'],
        check: (e) => !!e.event('sockets', (ev) => ev.root),
        solve: ['sudo ss -tulpn', '$PW'],
        done: (g) => (g.world.proc(4040) ? N`Port 22 — «sshd», the city's front door for remote logins. Normal.
Port **31337** — «kw0rker», PID **4040**. Hollow's impostor, holding a back door open for whenever he wants to come home.` : N`Port 22 — «sshd», the city's front door for remote logins. Nothing else. You already put down Juno's impostor kworker back at the Power Station — and it was holding port 31337 open as a back door. Good instincts.`),
      },
      {
        say: N`Close it.`,
        goal: 'Kill the back door (PID 4040)',
        hints: ['You know this one: «sudo kill 4040»'],
        check: (e) => !e.world.proc(4040),
        solve: ['sudo kill 4040', '$PW'],
        done: N`Port 31337 goes dark. «sudo ss -tulpn» would only show sshd now.`,
      },
      {
        say: N`The Lighthouse runs a small web server. «curl» fetches a URL and prints whatever comes back. Wren has left a notice.`,
        goal: 'Read the keeper\'s notice: «curl http://lighthouse/notice»',
        hints: ['Type: «curl http://lighthouse/notice»'],
        check: (e) => !!e.event('curl', (ev) => /notice/.test(ev.url)),
        solve: ['curl http://lighthouse/notice'],
        done: N`:::lesson
«curl URL» prints a response · «curl -o file URL» saves it · «curl -I URL» shows only the headers · «curl -s» is silent. curl speaks HTTP, HTTPS, FTP and a dozen more.
:::`,
      },
      {
        say: N`Wren has pulled Hollow's activity log for you. «wget» is built for downloading: it saves the file into your current directory, with a progress bar.`,
        goal: 'Download the log into your home: «cd ~» then «wget http://lighthouse/files/hollow_activity.log»',
        hints: ['First «cd ~»', 'Then: «wget http://lighthouse/files/hollow_activity.log»'],
        check: (e) => !!e.stepEvent('download', (ev) => /hollow_activity\.log/.test(ev.url)),
        solve: ['cd ~', 'wget http://lighthouse/files/hollow_activity.log'],
        done: N`Saved: «hollow_activity.log». You'll want that later.`,
      },
      {
        say: N`Now pay the keeper a visit. «ssh» opens a secure shell on another machine. Your key is still on her list, she says — so you shouldn't need a password.
The first time you connect, ssh will show the Lighthouse's fingerprint and ask whether to trust it. Answer «yes».`,
        goal: 'Log in to the Lighthouse as wren: «ssh wren@lighthouse»',
        hints: ['Type: «ssh wren@lighthouse», then answer «yes» to the fingerprint question.'],
        check: (e) => e.host === 'lighthouse',
        solve: ['ssh wren@lighthouse', { answer: 'yes' }],
        done: N`Look at your prompt: «wren@lighthouse». You're typing into another machine now. Every command you run happens *there*.

And look at the banner: *Last login ... from 10.0.0.66.* Not Wren.`,
      },
      {
        say: N`SSH lets someone in without a password if their **public key** is listed in «~/.ssh/authorized_keys». Let's see who Wren's account trusts.`,
        goal: 'On the Lighthouse, read the trusted keys: «cat ~/.ssh/authorized_keys»',
        hints: ['Type: «cat ~/.ssh/authorized_keys»'],
        check: (e) => e.didRead('/home/wren/.ssh/authorized_keys', 'lighthouse'),
        solve: ['cat ~/.ssh/authorized_keys'],
        done: N`Three keys. Yours. Mara's. And «hollow@nowhere».

:::lesson
SSH keys come in pairs: a **private** key that never leaves your machine («~/.ssh/id_ed25519»), and a **public** key you can hand out («id_ed25519.pub»). Any account that lists your public key in «authorized_keys» will let you in.
:::`,
      },
      {
        say: N`Remove Hollow's key. «grep -v» prints every line that does **not** match — write that into a temporary file, and if that worked («&&»), move it over the original:
«grep -v hollow ~/.ssh/authorized_keys > keys.tmp && mv keys.tmp ~/.ssh/authorized_keys»`,
        goal: 'Strip hollow\'s key from Wren\'s authorized_keys',
        hints: ['Never redirect a file into itself («> same file» empties it before grep reads it). Go via a temporary file.', 'Type: «grep -v hollow ~/.ssh/authorized_keys > keys.tmp && mv keys.tmp ~/.ssh/authorized_keys»'],
        check: (e) => { const fs = e.world.hosts.lighthouse.fs; const n = fs.tryGet('/home/wren/.ssh/authorized_keys'); return !!n && !fs.contentOf(n).includes('hollow') && fs.contentOf(n).includes('ssh-ed25519'); },
        nudge: (e) => { const fs = e.world.hosts.lighthouse.fs; const n = fs.tryGet('/home/wren/.ssh/authorized_keys'); return n && !fs.contentOf(n).trim() ? '@Tux: (Tux covers his eyes.) The file is *empty* — that happens when you redirect a file into itself. Wren will have to re-add the good keys by hand... but the hollow key is gone, at least.' : null; },
        solve: ['grep -v hollow ~/.ssh/authorized_keys > keys.tmp && mv keys.tmp ~/.ssh/authorized_keys'],
        done: N`One stolen key, gone. The Lighthouse's beam seems to steady.`,
      },
      {
        say: N`That's all you need here. «exit» closes the remote shell and drops you back home.`,
        goal: 'Leave the Lighthouse: «exit»',
        hints: ['Type: «exit»'],
        check: (e) => e.host === 'rootfall' && !!e.stepEvent('shellExit', (ev) => ev.host === 'lighthouse'),
        solve: ['exit'],
        done: N`«Connection to lighthouse closed.» Your prompt is yours again.`,
      },
      {
        say: N`Wren's README mentioned something: she kept a clean copy of your Lethe config. «scp» copies files over SSH. A remote path is written «user@host:path» — and a relative path starts in that user's home:
«scp wren@lighthouse:clean/lethe.conf ~/lethe.conf.clean»`,
        goal: 'Fetch the clean config: «scp wren@lighthouse:clean/lethe.conf ~/lethe.conf.clean»',
        hints: ['Type: «scp wren@lighthouse:clean/lethe.conf ~/lethe.conf.clean»'],
        check: (e) => /SAFE_MODE=yes/.test(e.read(e.home + '/lethe.conf.clean') || ''),
        solve: ['scp wren@lighthouse:clean/lethe.conf ~/lethe.conf.clean'],
        done: N`«lethe.conf  100%  ...» — the config exactly as you wrote it, before Hollow got his hands on it.`,
      },
      {
        say: N`A message flashes up from the Lighthouse:

@Wren: Before you go — install a guard dog. **fail2ban** watches the login logs and bans anyone who keeps guessing passwords. Software comes from packages: refresh the list with «sudo apt update», then «sudo apt install fail2ban».`,
        goal: 'Install fail2ban: «sudo apt update» then «sudo apt install fail2ban»',
        hints: ['Two commands: «sudo apt update» then «sudo apt install fail2ban»'],
        check: (e) => e.world.packages.installed.includes('fail2ban'),
        solve: ['sudo apt update', '$PW', 'sudo apt install fail2ban', '$PW'],
        done: N`«Setting up fail2ban ...» A small, grumpy service starts up and begins reading «/var/log/auth.log».

:::lesson
«apt update» refreshes the package lists · «apt install PKG» installs · «apt remove PKG» removes · «apt search WORD» finds · «apt list --installed» shows what you have. Installing and removing need root.
(There are other packages on the mirror too. «apt search» around. Some of them are... fun.)
:::`,
      },
    ],
    outro: N`@Wren: Thank you, {user}. The beam hasn't felt this steady in weeks.
@Wren: One last thing. That clean config — compare it with the one Lethe is using. Then finish this.`,
  });
})();
