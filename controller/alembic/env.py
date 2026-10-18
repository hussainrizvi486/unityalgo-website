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

_settings = Settings()
_database_url = os.environ.get("DATABASE_URL") or _settings.database_url
if _database_url:
    # escape %, which ConfigParser would read as interpolation
    config.set_main_option("sqlalchemy.url", _database_url.replace("%", "%%"))

target_metadata = Base.metadata


def include_object(obj, name, type_, reflected, compare_to):
    if type_ == "table" and name in PRISMA_OWNED_TABLES:
        return False
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
