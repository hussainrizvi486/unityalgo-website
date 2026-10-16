"""Connect a GitHub account to the App Store so private repositories can be used and API limits are higher."""
import re
from flask import Blueprint
from sqlalchemy import delete
from app.routes.base import BaseView
from app.errors import ApiError, ValidationError
from app.models.app_rollout import GithubAccount
from app.services.github_account import current_token
from app.services.github_service import GitHubClient

# Classic (ghp_…), fine-grained (github_pat_…), OAuth and app tokens are all letters, digits and underscores.
TOKEN = re.compile(r'^[A-Za-z0-9_]{20,255}$')


def serialize(row, source, live=None, problem=None):
    data = {'connected': source is not None, 'source': source, 'problem': problem}
    if row:
        data.update({'login': row.login, 'name': row.name, 'avatar_url': row.avatar_url, 'html_url': row.html_url, 'scopes': row.scopes,
                     'connected_by': row.connected_by, 'connected_at': row.connected_at.isoformat() if row.connected_at else None})
    if live:
        data.update({'login': live['login'], 'name': live['name'], 'avatar_url': live['avatar_url'], 'html_url': live['html_url'], 'scopes': live['scopes'],
                     'rate_limit': live['rate_limit'], 'rate_remaining': live['rate_remaining']})
    return data


class GithubAccountView(BaseView):
    def get(self):
        """Who is connected, checked against GitHub so a revoked or expired token shows up here."""
        with self.session() as session:
            token, source, row = current_token(session, self.settings)
            snapshot = serialize(row, source) if source else {'connected': False, 'source': None, 'problem': None}
        if token:
            try:
                live = GitHubClient(token, timeout=10).account()
                snapshot = {**snapshot, **{k: live[k] for k in ('login', 'name', 'avatar_url', 'html_url', 'scopes', 'rate_limit', 'rate_remaining')}}
            except ApiError as exc:
                snapshot['problem'] = exc.message
        return self.ok(snapshot)

    def put(self):
        """Body: token, connected_by?. Checks the token with GitHub, then stores it encrypted, replacing any earlier account."""
        data = self.json_body()
        token = str(data.get('token', '')).strip() if isinstance(data, dict) else ''
        if not TOKEN.fullmatch(token):
            raise ValidationError('That does not look like a GitHub token. Paste a personal access token (ghp_… or github_pat_…).')
        try:
            account = GitHubClient(token, timeout=15).account()
        except ApiError as exc:
            raise ValidationError('GitHub rejected that token. Check that it is correct and has not expired.' if exc.status_code == 502 and 'rejected' in exc.message else exc.message)
        with self.session() as session:
            session.execute(delete(GithubAccount))
            session.add(GithubAccount(login=account['login'], name=account['name'], avatar_url=account['avatar_url'], html_url=account['html_url'],
                                      scopes=account['scopes'][:300], token=token, connected_by=str(data.get('connected_by') or '')[:100] or None))
        return self.ok({**{k: account[k] for k in ('login', 'name', 'avatar_url', 'html_url', 'scopes')}, 'connected': True, 'source': 'account'})

    def delete(self):
        with self.session() as session:
            session.execute(delete(GithubAccount))
        return self.no_content()


class GithubRepositoriesView(BaseView):
    """GET /repositories. What the connected account can read, for the add-application picker."""
    def get(self):
        with self.session() as session:
            token, _, _ = current_token(session, self.settings)
        if not token:
            return self.ok({'results': [], 'connected': False})
        return self.ok({'results': GitHubClient(token, timeout=20).repositories(), 'connected': True})


class GithubRoutes:
    @classmethod
    def blueprint(cls, db=None, config=None):
        bp = Blueprint('github', __name__, url_prefix='/api/v1/github')
        for path, view, name in [('/account', GithubAccountView, 'account'), ('/repositories', GithubRepositoriesView, 'repositories')]:
            bp.add_url_rule(path, view_func=view.as_view(name, db=db, config=config))
        return bp
