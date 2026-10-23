#!/usr/bin/env bash
# Slow-site diagnostics. RUN ON YOUR OWN COMPUTER (macOS or Linux). Read-only.
#
#   ./diag-client.sh <site-domain>
#   e.g. ./diag-client.sh sex.cloud.unityalgo.com
#
# Shows what you actually get over the public internet and whether requests queue. About 40 seconds.
set -u
DOMAIN=${1:?usage: $0 <site-domain>}
here=$(cd "$(dirname "$0")" && pwd); . "$here/lib.sh"

hr "1. Distance"
ip=$(curl -s -o /dev/null -w '%{remote_ip}' "https://$DOMAIN/api/method/ping")
note "$DOMAIN -> $ip"
ping -c 15 "$ip" 2>/dev/null | awk -F'time=' '/time=/{split($2,a," "); print a[1]}' > /tmp/diag.ping.$$
printf '  ping ms: '; stats < /tmp/diag.ping.$$; rm -f /tmp/diag.ping.$$

hr "2. The public path, 8 requests each"
note "ping (almost no server work):"
timed_runs 8 --compressed "https://$DOMAIN/api/method/ping"; ping_srv=$LAST_SERVER_MS
note "/login (renders a page, ~350 KB uncompressed):"
timed_runs 8 --compressed "https://$DOMAIN/login"; login_srv=$LAST_SERVER_MS
[ "$ping_srv" -ge 250 ] && flag "A trivial ping needs about ${ping_srv} ms of server time (healthy: 20-100 ms through a proxy)."
[ "$login_srv" -ge 800 ] && flag "The login page needs about ${login_srv} ms of server time (healthy: 150-400 ms). The slowness is on the server, not in your connection."
note "A cold start on a new connection pays: connect (1 round trip) + tls (1-2) + first byte (1 + server time)."

hr "3. Do requests queue? 1 request vs 12 at once (ping)"
one=$(timed --compressed "https://$DOMAIN/api/method/ping" | awk '{print $4*1000}')
tmpd=$(mktemp -d)
for i in $(seq 12); do ( timed --compressed "https://$DOMAIN/api/method/ping" | awk '{print $4*1000}' > "$tmpd/$i" ) & done; wait
note "single request: ${one} ms"
printf '  12 at once, per-request ms: '; cat "$tmpd"/* | stats
slow=$(cat "$tmpd"/* | sort -n | tail -1 | cut -d. -f1); rm -rf "$tmpd"
[ "${slow:-0}" -gt $(( ${one%.*} * 4 )) ] && flag "12 simultaneous requests are much slower than one (${slow} ms vs ${one%.*} ms): the server handles few requests at once, so the page's many requests queue."

hr "4. Is the slowness the same every time? 20 pings, 1 per second"
for i in $(seq 20); do timed --compressed "https://$DOMAIN/api/method/ping" | awk '{print $3*1000}'; sleep 1; done | stats
note "p95 far above p50 means occasional stalls (a busy host or jitter), not steady slowness."

summary
note "Send the whole output."
