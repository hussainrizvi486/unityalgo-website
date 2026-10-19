
import os
import sys

os.environ.setdefault("PGGSSENCMODE", "disable")
from typing import ClassVar

from app.config import settings
from app.db import database
from app.router import ApiRouter


class ControllerCLI:
    def __init__(self, config=None, db=None):
        self.settings = config or settings
        self.db = db or database

    def check_database(self, role):
        mode = os.getenv("DB_STARTUP_CHECK", "strict").strip().lower()
        if mode == "off":
            return None
        ok, lines = self.db.startup_check()
        print("\n".join(lines), file=sys.stdout if ok else sys.stderr)
        if ok:
            return None
        if mode == "warn":
            print(f"DB_STARTUP_CHECK=warn: starting the {role} anyway.", file=sys.stderr)
            return None
        print(
            f"The {role} was not started because the database is unreachable. "
            "Fix the problem above, or set DB_STARTUP_CHECK=warn to start regardless.",
            file=sys.stderr,
        )
        return 1

    def serve(self, *_args):
        failed = self.check_database("API server")
        if failed:
            return failed
        print(
            f"{self.settings.app_name} listening on "
            f"http://{self.settings.app_host}:{self.settings.app_port}"
        )
        ApiRouter(self.settings, self.db).run()

    def migrate(self, *_args):
        self.db.migrate()

    def rollback(self, *args):
        self.db.rollback(args[0] if args else "-1")

    def makemigration(self, *args):
        if not args:
            print('usage: python main.py makemigration "message"')
            return 1
        self.db.make_migration(" ".join(args))

    def revision(self, *_args):
        self.db.current_revision()

    def sshcheck(self, *args):
        if not args:
            print("usage: python main.py sshcheck <ip> [user] [password]")
            return 1
        from app.errors import ApiError
        from app.models.server import ServerNode
        from app.services import SSHService

        node = ServerNode(
            name=args[0],
            ip_address=args[0],
            ssh_port=self.settings.ssh_port,
            ssh_user=args[1] if len(args) > 1 else self.settings.ssh_user,
            ssh_password=args[2] if len(args) > 2 else self.settings.ssh_password,
            ssh_key_path=self.settings.ssh_key_path,
        )
        try:
            report = SSHService(node, self.settings).check()
        except ApiError as exc:
            print(f"{args[0]}: {exc.message}")
            return 1
        for key in ("host", "port", "auth_method", "user", "hostname", "os",
                    "docker_installed", "docker_version", "docker_error"):
            if report.get(key) is not None:
                print(f"  {key:<17} {report[key]}")
        return 0

    def worker(self, *args):
        failed = self.check_database("worker")
        if failed:
            return failed
        from app.tasks.celery_app import celery_app

        celery_app.worker_main(["worker", "--loglevel=info", *args])

    def beat(self, *args):
        failed = self.check_database("scheduler")
        if failed:
            return failed
        from app.tasks.celery_app import celery_app

        celery_app.start(["beat", "--loglevel=info", *args])

    def routes(self, *_args):
        for methods, rule, endpoint in ApiRouter(self.settings, self.db).routes():
            print(f"{methods:<20} {rule:<40} {endpoint}")

    def config(self, *_args):
        print(f"app:        {self.settings.app_name} ({self.settings.app_env})")
        print(f"listen:     {self.settings.app_host}:{self.settings.app_port}")
        print(f"database:   {self.settings.safe_database_url()}")
        print(f"redis:      {self.settings.redis_url}")
        print(f"domain:     {self.settings.base_domain}")
        print(f"env file:   {self.settings.env_file}")
        print(f"db reachable: {self.db.check_connection()}")

    COMMANDS: ClassVar[dict] = {
        "serve": "serve",
        "runserver": "serve",
        "migrate": "migrate",
        "rollback": "rollback",
        "makemigration": "makemigration",
        "revision": "revision",
        "sshcheck": "sshcheck",
        "worker": "worker",
        "beat": "beat",
        "routes": "routes",
        "config": "config",
    }

    def run(self, argv):
        args = argv[1:]
        if not args:
            return self.serve()
        command = self.COMMANDS.get(args[0])
        if command is None:
            print(f"unknown command '{args[0]}'")
            print(f"available: {', '.join(sorted(set(self.COMMANDS)))}")
            return 1
        return getattr(self, command)(*args[1:])


if __name__ == "__main__":
    sys.exit(ControllerCLI().run(sys.argv) or 0)
