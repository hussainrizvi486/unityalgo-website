import os

# A Unix socket by default (filesystem permissions are the access control; put a reverse proxy in front if the website
# must reach it over HTTP). Set GUNICORN_BIND=127.0.0.1:8000 to listen on the loopback instead.
bind = os.getenv("GUNICORN_BIND", "unix:/run/controller-server/gunicorn.sock")
workers = int(os.getenv("GUNICORN_WORKERS", "4"))
worker_class = "sync"
timeout = 120
graceful_timeout = 30
keepalive = 5
umask = 0o007
accesslog = "-"
errorlog = "-"
