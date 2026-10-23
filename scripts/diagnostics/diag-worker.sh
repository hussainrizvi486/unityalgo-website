#!/usr/bin/env bash
# Slow-site diagnostics. RUN ON THE WORKER SERVER (where the site's containers live). Read-only.
#
#   ./diag-worker.sh <site-domain> <site-port>
#   e.g. ./diag-worker.sh sex.cloud.unityalgo.com 30004
#
# Needs: bash, curl, awk, vmstat, docker (run as a user that can use docker, or with sudo).
# Takes about 90 seconds. Prints no passwords.
set -u
DOMAIN=${1:?usage: $0 <site-domain> <site-port>}
PORT=${2:?usage: $0 <site-domain> <site-port>}
here=$(cd "$(dirname "$0")" && pwd); . "$here/lib.sh"
DOCKER=docker; docker info >/dev/null 2>&1 || DOCKER="sudo docker"

hr "1. Host: CPU steal, disk wait, memory (15 s sample)"
cores=$(nproc); note "cores=$cores  $(uptime | sed 's/.*load average/load average/')"
free -m | sed 's/^/  /'
vm_out=$(vmstat_summary 15 2>/tmp/diag.vm.$$); echo "$vm_out"
read -r st wa rq < /tmp/diag.vm.$$ 2>/dev/null || { st=0; wa=0; rq=0; }; rm -f /tmp/diag.vm.$$
awk -v s="$st" 'BEGIN{exit !(s>=5)}' && flag "CPU steal averages ${st}%: the hosting provider is taking CPU from this VM (oversold host). Container CPU graphs cannot show this."
awk -v w="$wa" 'BEGIN{exit !(w>=10)}' && flag "I/O wait averages ${wa}%: the disk is a bottleneck."
awk -v r="$rq" -v c="$cores" 'BEGIN{exit !(r>c*2)}' && flag "Run queue ${rq} is more than twice the ${cores} cores: the machine is CPU-saturated."
if [ -r /proc/pressure/cpu ]; then
    note "Pressure stall info (share of time tasks waited; 'some avg10' above ~10 is significant):"
    for f in cpu io memory; do printf '    %-7s %s\n' "$f" "$(head -1 /proc/pressure/$f)"; done
fi
swap_used=$(free -m | awk '/^Swap/ {print $3}'); [ "${swap_used:-0}" -gt 256 ] && flag "Swap in use (${swap_used} MB): memory is short, so everything slows."

hr "2. Disk latency (database commits wait for this)"
dir=${DISK_DIR:-$HOME}; tmp="$dir/.diag-disk.$$"
note "writing 300 x 4 KB synchronous blocks in $dir (same disk as /var/lib/docker on most setups; set DISK_DIR to change)"
s=$(date +%s%N); dd if=/dev/zero of="$tmp" bs=4k count=300 oflag=dsync status=none 2>/dev/null; e=$(date +%s%N); rm -f "$tmp"
ms=$(awk -v s="$s" -v e="$e" 'BEGIN {printf "%.2f", (e-s)/1e6/300}')
note "average synchronous write: ${ms} ms  (NVMe < 1 ms, good SSD 1-3 ms, network disk 5+ ms)"
awk -v m="$ms" 'BEGIN{exit !(m>=5)}' && flag "Synchronous writes take ${ms} ms each. MariaDB commits will be slow: this disk is the likely cause."
df -h "$dir" | sed 's/^/  /'

hr "3. Which site containers"
front=$($DOCKER ps --format '{{.Names}} {{.Ports}}' | awk -v p=":$PORT->" 'index($0,p){print $1; exit}')
if [ -z "$front" ]; then note "No container publishes port $PORT. Check the port in Admin > Sites."; summary; exit 1; fi
proj=${front%-frontend-1}; BACK=$proj-backend-1; DB=$proj-db-1; RC=$proj-redis-cache-1; RQ=$proj-redis-queue-1
note "project: $proj"
$DOCKER stats --no-stream --format '  {{.Name}}  cpu={{.CPUPerc}}  mem={{.MemUsage}} ({{.MemPerc}})' $($DOCKER ps -q --filter "name=$proj") 2>/dev/null
for c in $($DOCKER ps -a --filter "name=$proj" --format '{{.Names}}'); do
    r=$($DOCKER inspect -f '{{.State.OOMKilled}} {{.RestartCount}}' "$c")
    set -- $r
    [ "$1" = "true" ] && flag "$c was killed for running out of memory (its limit is too small)."
    [ "${2:-0}" -gt 0 ] && flag "$c has restarted $2 time(s)."
done

hr "4. CPU throttling of the backend (Docker's CPU limit)"
id=$($DOCKER inspect -f '{{.Id}}' "$BACKEND" 2>/dev/null || $DOCKER inspect -f '{{.Id}}' "$BACK")
for p in "/sys/fs/cgroup/system.slice/docker-$id.scope/cpu.stat" "/sys/fs/cgroup/cpu,cpuacct/docker/$id/cpu.stat" "/sys/fs/cgroup/cpu/docker/$id/cpu.stat"; do
    if [ -r "$p" ]; then
        nr=$(awk '$1=="nr_periods"{print $2}' "$p"); th=$(awk '$1=="nr_throttled"{print $2}' "$p")
        pct=$(awk -v a="$th" -v b="$nr" 'BEGIN{printf "%.1f", b?a*100/b:0}')
        note "periods=$nr throttled=$th (${pct}% of periods were cut short by the CPU limit)"
        awk -v x="$pct" 'BEGIN{exit !(x>=10)}' && flag "Backend is CPU-throttled in ${pct}% of periods: its CPU limit is too low."
        found=1; break
    fi
done
[ -z "${found:-}" ] && note "cgroup stats not readable here (try with sudo)."
note "backend limits: $($DOCKER inspect -f 'cpus(nano)={{.HostConfig.NanoCpus}} mem={{.HostConfig.Memory}}' "$BACK")"
note "gunicorn command: $($DOCKER inspect -f '{{.Config.Cmd}}' "$BACK")"
note "gunicorn processes: $($DOCKER top "$BACK" 2>/dev/null | grep -c '[g]unicorn')"

hr "5. The app, timed on this server (no proxy, no internet): 10 x ping, 5 x /login"
note "/api/method/ping needs almost no database work"
timed_runs 10 -H "Host: $DOMAIN" "http://127.0.0.1:$PORT/api/method/ping"; ping_p50=$LAST_FIRSTBYTE_P50
note "/login renders a full page"
timed_runs 5 -H "Host: $DOMAIN" "http://127.0.0.1:$PORT/login"; login_p50=$LAST_FIRSTBYTE_P50
[ "$ping_p50" -ge 100 ] && flag "A trivial ping takes ${ping_p50} ms on the server itself (healthy: 15-40 ms). The app is slow before any network is involved."
[ "$login_p50" -ge 800 ] && flag "The login page needs ${login_p50} ms on the server itself."
note "8 pings at the same time (does it queue?):"
tmpd=$(mktemp -d); s=$(date +%s%N)
for i in 1 2 3 4 5 6 7 8; do ( timed -H "Host: $DOMAIN" "http://127.0.0.1:$PORT/api/method/ping" | awk '{print $4*1000}' > "$tmpd/$i" ) & done; wait
e=$(date +%s%N); printf '  per-request ms: '; cat "$tmpd"/* | stats; rm -rf "$tmpd"
note "all 8 finished in $(( (e-s)/1000000 )) ms. If that is far above a single ping, requests queue behind too few workers."

hr "6. Database (from inside the containers)"
if ! $DOCKER inspect "$DB" >/dev/null 2>&1; then
    note "No bundled db container: this site uses an external database."
    note "db_host: $($DOCKER exec "$BACK" sh -c "grep -o '\"db_host\": *\"[^\"]*\"' sites/common_site_config.json" 2>/dev/null)"
    flag "External database in use: every query pays the network round trip to it. Check its latency from this server with ping."
else
    PW=$($DOCKER exec "$DB" printenv MARIADB_ROOT_PASSWORD 2>/dev/null)
    q() { $DOCKER exec -e MYSQL_PWD="$PW" "$DB" mariadb -uroot -N -e "$1" 2>/dev/null; }
    q "SHOW GLOBAL VARIABLES WHERE Variable_name IN ('skip_name_resolve','innodb_buffer_pool_size','max_connections','innodb_flush_log_at_trx_commit','slow_query_log','long_query_time','innodb_flush_method')" | awk '{printf "  %-34s %s\n", $1, $2}'
    status=$(q "SHOW GLOBAL STATUS WHERE Variable_name IN ('Innodb_buffer_pool_reads','Innodb_buffer_pool_read_requests','Threads_connected','Max_used_connections','Slow_queries','Connections','Aborted_connects','Created_tmp_disk_tables','Questions','Uptime')")
    echo "$status" | awk '{printf "  %-34s %s\n", $1, $2}'
    echo "$status" | awk '$1=="Innodb_buffer_pool_reads"{r=$2} $1=="Innodb_buffer_pool_read_requests"{q=$2} END{ if (q>0) printf "  buffer pool hit ratio: %.2f%% (below ~99%% means the pool is too small and queries read the disk)\n", 100-100*r/q }'
    pool=$(q "SELECT @@innodb_buffer_pool_size/1024/1024" | cut -d. -f1)
    [ "${pool:-0}" -le 160 ] && flag "InnoDB buffer pool is only ${pool} MB: the database keeps going to disk."
    [ "$(q "SELECT @@skip_name_resolve")" = "0" ] && flag "skip_name_resolve is OFF: MariaDB does a DNS lookup on every new connection, and Frappe opens one per request."
    hr_ratio=$(echo "$status" | awk '$1=="Innodb_buffer_pool_reads"{r=$2} $1=="Innodb_buffer_pool_read_requests"{q=$2} END{ if (q>0) printf "%d", 100-100*r/q }')
    [ -n "$hr_ratio" ] && [ "$hr_ratio" -lt 98 ] && flag "Buffer pool hit ratio is under 98%."

    note "connection time, from inside the db container (ms, 10 tries):"
    for mode in "socket" "tcp"; do
        host=""; [ "$mode" = tcp ] && host="-h127.0.0.1"
        printf '    %-6s ' "$mode"
        $DOCKER exec -e MYSQL_PWD="$PW" "$DB" bash -c "for i in \$(seq 10); do s=\$(date +%s%N); mariadb -uroot $host -e 'select 1' >/dev/null 2>&1; e=\$(date +%s%N); echo \$(( (e-s)/1000000 )); done" | stats
    done
    note "connection time the way Frappe does it: from the backend container to the 'db' service (ms, 10 tries):"
    $DOCKER exec -e DBPW="$PW" "$BACK" sh -c 'PY=env/bin/python; [ -x $PY ] || PY=python; $PY - <<PYEOF
import os, time, json
try:
    import pymysql
except ImportError:
    print("    pymysql not available in the image"); raise SystemExit
host = json.load(open("sites/common_site_config.json")).get("db_host", "db")
times = []
for _ in range(10):
    t = time.time()
    c = pymysql.connect(host=host, user="root", password=os.environ["DBPW"], connect_timeout=15)
    c.cursor().execute("select 1"); c.close()
    times.append((time.time() - t) * 1000)
times.sort()
print("    host=%s  min=%.1f p50=%.1f max=%.1f ms" % (host, times[0], times[len(times)//2], times[-1]))
PYEOF' 2>&1 | sed 's/^/  /'
    unset PW
fi

hr "7. Redis latency (3 s each)"
for r in "$RC" "$RQ"; do
    printf '  %-34s ' "${r#$proj-}"
    $DOCKER exec "$r" sh -c 'timeout 3 redis-cli --latency 2>/dev/null | tr "\r" "\n" | tail -1' 2>/dev/null || echo "n/a"
done

hr "8. Recent backend errors"
$DOCKER logs --tail 300 "$BACK" 2>&1 | grep -i -E 'timeout|killed|error|traceback|critical' | tail -8 | cut -c1-220 | sed 's/^/  /'
note "(empty above means no recent errors)"

summary
note "Send the whole output. It contains no passwords."
