#!/usr/bin/env bash
# Slow-site diagnostics. RUN ON THE PROXY SERVER (where Caddy runs). Read-only.
#
#   ./diag-proxy.sh <site-domain> <worker-ip> <site-port>
#   e.g. ./diag-proxy.sh sex.cloud.unityalgo.com 161.97.104.116 30004
#
# Separates "the link to the worker" from "Caddy itself" from "the app". About 60 seconds.
set -u
DOMAIN=${1:?usage: $0 <site-domain> <worker-ip> <site-port>}
WORKER=${2:?usage: $0 <site-domain> <worker-ip> <site-port>}
PORT=${3:?usage: $0 <site-domain> <worker-ip> <site-port>}
here=$(cd "$(dirname "$0")" && pwd); . "$here/lib.sh"

hr "1. This server: CPU steal, disk wait (15 s sample)"
cores=$(nproc); note "cores=$cores  $(uptime | sed 's/.*load average/load average/')"
vm_out=$(vmstat_summary 15 2>/tmp/diag.vm.$$); echo "$vm_out"
read -r st wa rq < /tmp/diag.vm.$$ 2>/dev/null || { st=0; wa=0; rq=0; }; rm -f /tmp/diag.vm.$$
awk -v s="$st" 'BEGIN{exit !(s>=5)}' && flag "CPU steal averages ${st}% on the PROXY: the provider is taking CPU from it. Every request goes through here."
awk -v w="$wa" 'BEGIN{exit !(w>=10)}' && flag "I/O wait averages ${wa}% on the proxy."

hr "2. Link to the worker ($WORKER): 60 pings"
out=$(ping -c 60 -i 0.2 "$WORKER" 2>/dev/null | awk -F'time=' '/time=/{split($2,a," "); print a[1]}')
printf '  ms: '; echo "$out" | stats
over=$(echo "$out" | awk '$1>10' | wc -l); note "replies over 10 ms: $over of $(echo "$out" | wc -l)"
[ "$over" -ge 6 ] && flag "$over of 60 pings to the worker took over 10 ms on a link that should be ~1 ms: jitter on the proxy, the worker or the path between them."

hr "3. Straight to the worker app, bypassing Caddy"
note "ping:";  timed_runs 10 -H "Host: $DOMAIN" "http://$WORKER:$PORT/api/method/ping"; d_ping=$LAST_FIRSTBYTE_P50
note "/login:"; timed_runs 5  -H "Host: $DOMAIN" "http://$WORKER:$PORT/login"; d_login=$LAST_FIRSTBYTE_P50

hr "4. Through Caddy on this machine (TLS included, internet excluded)"
note "ping:";  timed_runs 10 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/method/ping"; c_ping=$LAST_FIRSTBYTE_P50
note "/login:"; timed_runs 5  --resolve "$DOMAIN:443:127.0.0.1" --compressed "https://$DOMAIN/login"; c_login=$LAST_FIRSTBYTE_P50
extra=$(( c_ping - d_ping ))
note "Caddy adds about ${extra} ms to a ping (first byte) on top of the direct request"
[ "$extra" -ge 60 ] && flag "Caddy adds ${extra} ms per request over the direct worker path."
[ "$d_ping" -ge 100 ] && flag "Even straight to the worker, ping takes ${d_ping} ms: the delay is in the worker or the link to it."

hr "5. Caddy health"
note "service: $(systemctl is-active caddy 2>/dev/null || echo 'unknown (not a systemd service here)')"
pid=$(pidof caddy 2>/dev/null | awk '{print $1}')
[ -n "$pid" ] && grep -E 'open files' "/proc/$pid/limits" 2>/dev/null | sed 's/^/  /'
note "established connections on :443: $(ss -tn state established '( sport = :443 )' 2>/dev/null | tail -n +2 | wc -l)"
logs=$(journalctl -u caddy --since '15 min ago' --no-pager 2>/dev/null | grep -i -E 'error|timeout|dial|refused' | cut -c1-230)
if [ -z "$logs" ]; then note "no Caddy errors in the last 15 minutes (or journal not readable: try with sudo)"
else echo "$logs" | tail -6 | sed 's/^/  /'; flag "Caddy logged errors in the last 15 minutes (see above)."; fi

summary
note "Send the whole output. It contains no passwords."
