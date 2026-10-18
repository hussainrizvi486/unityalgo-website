from sqlalchemy import select
from app.models.app_rollout import GithubAccount


def current_token(session, settings):
    """(token, source, account row). `source` is 'account', 'environment' or None."""
    row = session.scalar(select(GithubAccount).order_by(GithubAccount.connected_at.desc()).limit(1))
    if row:
        return row.token, 'account', row
    if settings.github_token:
        return settings.github_token, 'environment', None
    return None, None, None
