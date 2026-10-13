#!/usr/bin/env node
/* Free-form shell behavior checks + every secret. Usage: node test/commands.js [-v] */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const s of [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !s.includes('/ui/') && !s.endsWith('main.js'))) require(path.join(root, s));
const LA = globalThis.LA;
LA.timeScale = 0;
const verbose = process.argv.includes('-v');

const CASES = [
  // [command, expectation (string = must contain, RegExp, or fn(out) => bool)]
  ['cd /tmp && pwd', '/tmp'],
  ['echo $((2**10)) $((17 % 5)) $(( (3+4)*2 ))', '1024 2 14'],
  ["printf '%05.1f|%-4s|%x\\n' 3.14159 ab 255", '003.1|ab  |ff'],
  ['seq -s, 1 5', '1,2,3,4,5'],
  ['echo hello | tr a-z A-Z', 'HELLO'],
  ["echo 'a,b,c' | cut -d, -f2", /^b$/m],
  ["printf 'b\\na\\nc\\na\\n' | sort | uniq -c", '      2 a'],
  ["printf '3\\n10\\n2\\n' | sort -n | tail -1", /^10$/m],
  ["echo 'one two three' | awk '{print $2}'", /^two$/m],
  ["echo x=1 | sed 's/1/2/'", 'x=2'],
  ['ls /nonexist; echo "status=$?"', 'status=2'],
  ['false || echo fallback', 'fallback'],
  ['true && echo ok', 'ok'],
  ['for i in {1..3}; do echo -n $i; done; echo', /^123$/m],
  ['x=hello; echo ${#x} ${x^^} ${x:1:3} ${x/l/L} ${y:-dflt}', '5 HELLO ell heLlo dflt'],
  ['case foo.txt in *.txt) echo text;; *) echo other;; esac', /^text$/m],
  ['f(){ local a=1; echo "in:$a"; }; f; echo "out:[$a]"', (o) => o.includes('in:1') && o.includes('out:[]')],
  ['echo $(echo nested $(echo deep))', 'nested deep'],
  ['mkdir -p a/b/c && touch a/b/c/f && find a -type f', 'a/b/c/f'],
  ['tree a', '└── c'],
  ['cp -r a b && ls b/b/c', /^f$/m],
  ['mv b c && ls -d c', /^c$/m],
  ['rm -r a c; ls a', 'No such file or directory'],
  ['echo test > t.txt; wc -c t.txt', '5 t.txt'],
  ['ln -s t.txt link; readlink link; cat link', (o) => o.includes('t.txt') && o.includes('test')],
  ["chmod 600 t.txt; stat -c '%a %U' t.txt", '600 kit'],
  ['ls -l t.txt', '-rw------- 1 kit kit'],
  ['chmod u+x,g+r t.txt; ls -l t.txt', '-rwxr-----'],
  ["printf 'a\\nb\\n' > x; printf 'a\\nc\\n' > y; diff x y", (o) => o.includes('2c2') && o.includes('< b') && o.includes('> c')],
  ['diff -u x y', (o) => /-b\n\+c/.test(o)],
  ['tar -czf t.tgz t.txt x && tar -tzf t.tgz', (o) => o.includes('t.txt') && o.includes('x')],
  ['mkdir out && tar -xzf t.tgz -C out && cat out/x', 'a\nb'],
  ['gzip -k t.txt && ls t.txt.gz && zcat t.txt.gz', (o) => o.includes('t.txt.gz') && o.includes('test')],
  ['echo hi | base64; echo aGkK | base64 -d', (o) => o.includes('aGkK') && /^hi$/m.test(o)],
  ['echo abc | rev', 'cba'],
  ['head -c 3 t.txt; echo', /^tes$/m],
  ['grep -c root /etc/passwd', /^\d+$/m],
  ["grep -E '^(root|kit):' /etc/passwd | wc -l", /^2$/m],
  ['grep -v -c xyz123 /etc/hostname', '1'],
  ['whoami; id -u', 'kit\n1000'],
  ['which ls; type cd; type -t grep', (o) => o.includes('/usr/bin/ls') && o.includes('cd is a shell builtin') && o.includes('file')],
  ['expr 6 \\* 7', '42'],
  ["echo '2^8' | bc; echo 'scale=2; 10/3' | bc", (o) => o.includes('256') && o.includes('3.33')],
  ['echo a b c | xargs -n1', 'a\nb\nc'],
  ["find /etc -maxdepth 1 -name 'host*' | sort", '/etc/hostname\n/etc/hosts'],
  ['kill -l | head -1', 'SIGHUP'],
  ['set -- x y z; echo $# $2', '3 y'],
  ['echo val | { read v; echo got $v; }', 'got val'],
  ['while read l; do echo "<$l>"; done <<< "a"', '<a>'],
  ["cat <<'EOF'\n$HOME stays\nEOF", '$HOME stays'],
  ['cat <<EOF\nhome=$HOME\nEOF', 'home=/home/kit'],
  ['ls -la /tmp | head -2', 'total'],
  ['du -sh /etc', /K\s+\/etc/],
  ['df -h | head -1', 'Filesystem'],
  ['uname -r; hostname', '6.1.0-rootfall\nrootfall'],
  ['uptime', ' up '],
  ['free -m', 'Mem:'],
  ['cal', 'Su Mo Tu We Th Fr Sa'],
  ['man -k copy', 'cp (1)'],
  ['whatis ls', 'list directory contents'],
  ['echo "a  b" | tr -s " "', 'a b'],
  ["echo 'k:v' | awk -F: '{print $2 \"!\"}'", 'v!'],
  ["printf 'x 1\\ny 2\\nx 3\\n' | awk '{s[$1]+=$2} END {for (k in s) print k, s[k]}' | sort", 'x 4\ny 2'],
  ["printf 'l1\\nl2\\nl3\\n' | sed -n '2p'", /^l2$/m],
  ["printf 'keep\\nhollow\\n' | sed '/hollow/d'", (o) => o.includes('keep') && !o.includes('hollow')],
  ["echo 'a/b' | sed 's|/|_|g'", 'a_b'],
  ["echo hello | sed -E 's/(h)(e)/\\2\\1/'", 'ehllo'],
  ["printf 'b 2\\na 10\\nc 1\\n' | sort -k2 -n | head -1", 'c 1'],
  ['echo one; echo two >&2', (o) => o.includes('one') && o.includes('two')],
  ['ls /root 2>/dev/null || echo denied', 'denied'],
  ['ls /root > o.txt 2>&1; cat o.txt', 'Permission denied'],
  ['echo "a b" > "sp ace.txt"; ls sp*', 'sp ace.txt'],
  ['ls nomatch*.zz', "cannot access 'nomatch*.zz'"],
  ['cd ~ 2>&1', 'Permission denied'],
  ['cd /etc; cd -', '/tmp'],
  ['n=0; while true; do n=$((n+1)); [ $n -ge 5 ] && break; done; echo $n', /^5$/m],
  ['for f in /etc/host*; do basename $f; done', 'hostname\nhosts'],
  ['[[ abc =~ ^a.c$ ]] && echo match', 'match'],
  ['test -d /etc && echo dir', 'dir'],
  ['[ 3 -gt 2 ] && [ -z "" ] && echo yes', 'yes'],
  ['echo $USER $HOME $SHELL', 'kit /home/kit /bin/bash'],
  ['export FOO=bar; bash -c \'echo child:$FOO\'', 'child:bar'],
  ['BAR=1; bash -c \'echo child:[$BAR]\'', 'child:[]'],
  ['alias g=grep', ''],
  ['g -c root /etc/passwd', /^\d+$/m],
  ['history | tail -1', 'history'],
  ['ps', 'PID TTY'],
  ['pgrep -l lethe', 'lethe'],
  ['sort /etc/passwd | head -1 | cut -d: -f1', /^\w/m],
  ['column -t -s: <<< "a:bb:c"', 'a  bb  c'],
  ['paste -sd+ <<< $(seq 3)', '1+2+3'],
  ['nl /etc/hostname', '     1\trootfall'],
  ['tac <<< $(printf "1\\n2")', '2\n1'],
  ['md5sum /etc/hostname', /^[0-9a-f]{32}  \/etc\/hostname$/m],
  ['echo -n abc | sha256sum', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ['file /usr/bin/ls /etc/hostname /tmp', (o) => o.includes('ELF 64-bit') && o.includes('ASCII text') && o.includes('directory')],
  ['ping -c 2 lighthouse', '2 packets transmitted, 2 received'],
  ['ping -c 1 google.com', 'Temporary failure in name resolution'],
  ['dig +short lighthouse', '10.0.0.2'],
  ['curl -s http://lighthouse/status', '"keeper":"wren"'],
  ['curl http://lighthouse/nope', '404 Not Found'],
  ['ip r', 'default via 10.0.0.1'],
  ['ss -t', 'ESTAB'],
  ['who | wc -l', /^3$/m],
  ['last hollow | head -1', 'hollow'],
  ['systemctl is-active lethe', 'active'],
  ['journalctl -u lethe -n 2', 'lethe'],
  ['crontab -l', '0 6 * * *'],
  ['lsblk -f', 'UNDERCROFT'],
  ['mount | head -1', '/dev/sda1 on / type ext4'],
  ['dmesg', 'Operation not permitted'],
  ['apt search penguin', ''],
  ['apt list --installed | head -3', 'Listing'],
  ['cat /etc/shadow', 'Permission denied'],
  ['rm -f /etc/passwd', 'Permission denied'],
  ['touch /etc/new', 'Permission denied'],
  ['date +%Y', String(new Date().getFullYear())],
];

const SECRETS = [
  'cat /hospital/floor3/room307/.under_pillow',
  'cat /hospital/floor3/room309/mr_finch.txt',
  'cat /usr/share/doc/.restricted_section/forbidden_index.txt',
  'cd /opt/.arcade && ./bin/sl && ./bin/fortune && ./bin/cowsay -f tux moo; cd /tmp',
  'apt moo',
  'vim /tmp/v.txt',
  'rm -rf /',
  ':(){ :|:& };:',
  'xyzzy',
  'cat /dev/null',
  'dig TXT tux.rootfall',
  'curl http://lighthouse/robots.txt; curl http://lighthouse/keeper-only/',
  'pet tux',
];

async function main() {
  const view = new LA.HeadlessView();
  view.write = function (s) { this.out += s; };
  const game = new LA.Game(view, null);
  game.newGame('kit');
  await game.start();
  game.setFreeplay(true);
  LA.stories.rootfall.plugBackup(game); // the Undercroft disk is only attached from chapter 9 on
  const con = game.console;
  let fails = 0;
  const run = async (cmd) => {
    const before = view.out.length;
    for (const line of cmd.split('\n').length > 1 && !cmd.includes('<<') ? cmd.split('\n') : [cmd]) await con.submit(line);
    if (con.pending) { await con.submit(game.password()); }
    return LA.util.stripAnsi(view.out.slice(before));
  };
  for (const [cmd, exp] of CASES) {
    const out = await run(cmd);
    const body = out.split('\n').slice(1).join('\n');
    const ok = exp instanceof RegExp ? exp.test(body) : typeof exp === 'function' ? exp(body) : body.includes(exp);
    if (!ok) { fails++; console.log(`✗ ${cmd}\n  expected: ${exp}\n  got: ${JSON.stringify(body.slice(0, 400))}`); }
    else if (verbose) console.log(`✓ ${cmd}`);
  }
  // sudo-gated secrets
  for (const s of SECRETS) await run(s);
  await run('sudo make me a sandwich');
  game.chapters.find((c) => c.id === 'root').onStart(game); // the plan only appears in the last chapter
  await run('sudo cat /var/.hollow/plan.txt');
  await run('sudo apt install neofetch cmatrix');
  await run('neofetch');
  await run('cmatrix');
  const missing = Object.keys(game.pack.secrets).filter((k) => !game.state.secrets.includes(k));
  if (missing.length) { fails++; console.log('✗ secrets not triggered: ' + missing.join(', ')); }
  console.log(`${CASES.length - (fails - (missing.length ? 1 : 0))}/${CASES.length} command checks passed · secrets ${game.state.secrets.length}/${Object.keys(game.pack.secrets).length}`);
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
