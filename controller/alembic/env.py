import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

from app.config import Settings
from app.models import Base
from app.models.platform import PRISMA_OWNED_TABLES

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Take the database URL from the same place the application does, rather than
# from alembic.ini. Two reasons: the ini copy drifts -- it pointed at a port
# the database has not been on for some time, so `alembic upgrade` silently
# targeted nothing -- and a URL in a checked-in ini file is a password in the
# repository. Settings loads controller/.env, so this is the running app's URL.
_settings = Settings()
_database_url = os.environ.get("DATABASE_URL") or _settings.database_url
if _database_url:
    # escape %, which ConfigParser would read as interpolation
    config.set_main_option("sqlalchemy.url", _database_url.replace("%", "%%"))

target_metadata = Base.metadata


def include_object(obj, name, type_, reflected, compare_to):
    """Keep Alembic's hands off the tables Prisma owns.

    The platform and the controller share one database. Prisma owns the
    PascalCase tables; Alembic owns the snake_case ones. Two things make this
    filter mandatory rather than tidy:

    1. Some Prisma tables are mapped here read-only (app/models/platform.py) so
       that foreign keys pointing at them resolve. Without this filter,
       autogenerate would see those mappings as Alembic's own and emit DDL to
       "fix" them -- including dropping columns it does not know about, since
       the mirror is deliberately partial.

    2. The Prisma tables that are *not* mapped here would look to autogenerate
       like tables that exist in the database but not in the model, i.e.
       candidates to DROP.

    Either would corrupt or destroy data the platform owns, so the filter
    covers every Prisma-owned table, mapped or not.
    """
    if type_ == "table" and name in PRISMA_OWNED_TABLES:
        return False
    # Columns and indexes are reached through their table, which is already
    # excluded above; this guards reflected objects reported table-first.
    if getattr(obj, "table", None) is not None and obj.table.name in PRISMA_OWNED_TABLES:
        return False
    return True


connectable = engine_from_config(
    config.get_section(config.config_ini_section, {}),
    prefix="sqlalchemy.",
    poolclass=pool.NullPool,
)

with connectable.connect() as connection:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()
