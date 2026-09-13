                              INTERNET
                                 │
                                 ▼
                     shop.acme.com  (DNS)
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   PROXY VPS     │   role = 'proxy'
                        │   (Caddy)       │   admin API: 127.0.0.1:2019
                        └────────┬────────┘   (never public)
                                 │
                    reads its routing table,
                    forwards the request to →
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  WORKER VPS     │   role = 'worker'
                        │  tenant_acme    │
                        │  container      │
                        └─────────────────┘

═══════════════════════════════════════════════════════  live customer traffic
                                                            (controller not involved)


                        ┌─────────────────┐
                        │   CONTROLLER    │
                        │  (Flask + DB)   │
                        └───┬─────────┬───┘
                            │         │
                  SSH (existing)   SSH tunnel → Caddy admin API
                            │         │
                            ▼         ▼
                   ┌─────────────┐ ┌─────────────┐
                   │ WORKER VPS  │ │  PROXY VPS  │
                   │ docker run  │ │ push routes │
                   └─────────────┘ └─────────────┘

═══════════════════════════════════════════════════════  only when something CHANGES
                                                            (create/provision/migrate/delete)
