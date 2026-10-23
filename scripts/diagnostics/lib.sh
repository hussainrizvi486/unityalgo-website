# Shared helpers for the diagnostics scripts. Sourced, not run.
# Everything here is read-only: nothing is installed, restarted or changed.

hr()   { printf '\n=== %s ===\n' "$*"; }
note() { printf '  %s\n' "$*"; }
FINDINGS=()
flag() { FINDINGS+=("$*"); printf '  !! %s\n' "$*"; }

# stats: reads one number per line on stdin, prints "n=.. min=.. avg=.. p50=.. p95=.. max=.."
stats() {
    sort -n | awk '{v[NR]=$1; s+=$1} END {
        if (!NR) { print "no samples"; exit }
        printf "n=%d min=%.1f avg=%.1f p50=%.1f p95=%.1f max=%.1f\n", NR, v[1], s/NR, v[int((NR+1)/2)], v[int(NR*0.95)>0?int(NR*0.95):1], v[NR]
    }'
}

# curl timing line, in milliseconds, for: connect, tls, first byte, total. Extra args go to curl.
CURL_FMT='%{time_connect} %{time_appconnect} %{time_starttransfer} %{time_total} %{http_code} %{size_download} %{http_version}'
timed() { curl -s -o /dev/null -m 60 -w "$CURL_FMT\n" "$@"; }

# summarise N timed() runs of the same request: prints stats for first byte and total (ms)
timed_runs() {
    local n=$1; shift
    local out i
    out=$(for i in $(seq "$n"); do timed "$@"; done)
    printf '  first-byte ms: '; echo "$out" | awk '{print $3*1000}' | stats
    printf '  total ms:      '; echo "$out" | awk '{print $4*1000}' | stats
    printf '  connect/tls ms (avg): '; echo "$out" | awk '{c+=$1*1000; t+=($2>0?($2-$1)*1000:0)} END {printf "%.0f / %.0f\n", c/NR, t/NR}'
    # Rough server time: first byte minus connection setup minus one round trip for the request itself.
    LAST_SERVER_MS=$(echo "$out" | awk '{print ($3-$1-($2>0?$2-$1:0)-$1)*1000}' | sort -n | awk '{v[NR]=$1} END {x=v[int((NR+1)/2)]; print (x<0?0:int(x))}')
    printf '  estimated server time (median): %s ms\n' "$LAST_SERVER_MS"
    printf '  http codes: '; echo "$out" | awk '{print $5}' | sort | uniq -c | tr '\n' ' '; echo
    LAST_FIRSTBYTE_P50=$(echo "$out" | awk '{print $3*1000}' | sort -n | awk '{v[NR]=$1} END {print int(v[int((NR+1)/2)])}')
}

# vmstat_summary SECONDS: averages of CPU states over the window (skips the since-boot line)
vmstat_summary() {
    local secs=${1:-15}
    vmstat 1 "$secs" | awk '
        NR==2 { for (i=1;i<=NF;i++) col[$i]=i; next }
        NR<=3 { next }
        { n++; for (k in col) sum[k]+=$col[k]; if ($col["st"]>mx) mx=$col["st"]; if ($col["wa"]>mw) mw=$col["wa"] }
        END {
            if (!n) { print "no vmstat samples"; exit }
            printf "  samples=%d  run-queue=%.1f  user=%.0f%% sys=%.0f%% idle=%.0f%%  iowait=%.1f%% (max %d%%)  steal=%.1f%% (max %d%%)  swap-in/out=%.0f/%.0f\n",
                n, sum["r"]/n, sum["us"]/n, sum["sy"]/n, sum["id"]/n, sum["wa"]/n, mw, sum["st"]/n, mx, sum["si"]/n, sum["so"]/n
            printf "%.2f %.2f %.2f\n", sum["st"]/n, sum["wa"]/n, sum["r"]/n > "/dev/stderr"
        }'
}

summary() {
    hr "SUMMARY"
    if [ "${#FINDINGS[@]}" -eq 0 ]; then
        note "No single obvious cause found by these checks. Send the full output."
    else
        local f; for f in "${FINDINGS[@]}"; do printf '  - %s\n' "$f"; done
    fi
}
