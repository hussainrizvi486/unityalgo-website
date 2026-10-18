import json
import re
import urllib.error
import urllib.parse
import urllib.request

from app.errors import NotFoundError, ValidationError, ApiError

REPO_URL = re.compile(r'^https://github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+?)(?:\.git)?/?$')
APP_NAME = re.compile(r'^[a-z][a-z0-9_]{0,99}$')
BRANCH = re.compile(r'^[A-Za-z0-9._/-]{1,120}$')
COMMIT = re.compile(r'^[0-9a-f]{40}$')
# Frappe's own `app_name = "x"` line in <package>/hooks.py.
HOOKS_APP_NAME = re.compile(r'^\s*app_name\s*=\s*["\']([A-Za-z0-9_]+)["\']', re.M)
HOOKS_FIELD = r'^\s*%s\s*=\s*["\'](.*?)["\']\s*$'
VERSION_ASSIGN = re.compile(r'^\s*__version__\s*=\s*["\']([^"\']+)["\']', re.M)


def parse_repo_url(url):
    """(owner, repo) from https://github.com/owner/repo, or a ValidationError."""
    match = REPO_URL.fullmatch((url or '').strip())
    if not match:
        raise ValidationError('Enter a GitHub repository address like https://github.com/frappe/hrms.')
    return match.group(1), match.group(2)


def clean_branch(branch):
    branch = (branch or '').strip()
    if branch and (not BRANCH.fullmatch(branch) or '..' in branch or branch.startswith(('-', '/')) or branch.endswith(('/', '.lock'))):
        raise ValidationError('That is not a valid branch name.')
    return branch


def version_tuple(text):
    parts = re.findall(r'\d+', str(text))[:3]
    return tuple(int(part) for part in parts) + (0,) * (3 - len(parts))


def range_allows(spec, major):
    clauses = [clause.strip() for clause in str(spec).split(',') if clause.strip()]
    if not clauses:
        return True

    def satisfied(version, clause):
        match = re.fullmatch(r'(>=|<=|==|~=|!=|>|<|\^|~)?\s*v?([0-9][0-9A-Za-z.\-*]*)', clause)
        if not match:
            return True
        op, wanted = match.group(1) or '==', version_tuple(match.group(2).replace('*', '0'))
        if op == '>=':
            return version >= wanted
        if op == '>':
            return version > wanted
        if op == '<=':
            return version <= wanted
        if op == '<':
            return version < wanted
        if op == '!=':
            return version != wanted
        if op in ('^', '~=', '~'):
            return version >= wanted and version[0] == wanted[0]
        if '*' in match.group(2):
            return version[0] == wanted[0]
        return version == wanted

    return any(all(satisfied(candidate, clause) for clause in clauses) for candidate in ((major, 0, 0), (major, 99, 99)))


def branch_major(branch):
    match = re.search(r'(?:version|release|v)[-_/]?(\d{2})\b', branch or '')
    return int(match.group(1)) if match else None


def toml_frappe_range(text):
    """The frappe requirement under [tool.bench.frappe-dependencies] in a pyproject.toml, if any."""
    try:
        import tomllib
        data = tomllib.loads(text)
    except Exception:
        return None
    dependencies = (data.get('tool', {}).get('bench', {}) or {}).get('frappe-dependencies') or {}
    value = dependencies.get('frappe')
    return str(value) if value else None


def assess_compatibility(branch, frappe_range, majors):
    label = ' or '.join(str(major) for major in majors) or 'the installed version'
    if frappe_range and majors:
        if any(range_allows(frappe_range, major) for major in majors):
            return {'status': 'compatible', 'reason': f'Declares support for Frappe {frappe_range}.'}
        return {'status': 'incompatible', 'reason': f'This app requires Frappe {frappe_range}, but this platform runs Frappe {label}.'}
    claimed = branch_major(branch)
    if claimed is not None and majors:
        if claimed in majors:
            return {'status': 'compatible', 'reason': f'Branch {branch} targets Frappe {claimed}.'}
        return {'status': 'incompatible', 'reason': f'Branch {branch} targets Frappe {claimed}, but this platform runs Frappe {label}. Choose a version-{majors[0]} branch.'}
    return {'status': 'unknown', 'reason': f'The repository does not declare which Frappe version this branch supports. Confirm it works with Frappe {label} before installing.'}


def order_branches(names, default):
    def key(name):
        major = branch_major(name)
        return (name != default, major is None, -(major or 0), name.startswith(('mergify/', 'dependabot/')), name)
    return sorted(names, key=key)


class GitHubClient:
    API = 'https://api.github.com'
    RAW = 'https://raw.githubusercontent.com'

    def __init__(self, token=None, majors=None, timeout=15, opener=None):
        self.token = token
        self.majors = list(majors or [])
        self.timeout = timeout
        self.opener = opener or urllib.request.urlopen

    # -- transport -----------------------------------------------------------------
    def _fetch(self, url, accept, with_headers=False):
        headers = {'Accept': accept, 'User-Agent': 'unityalgo-app-store', 'X-GitHub-Api-Version': '2022-11-28'}
        if self.token and url.startswith(self.API):
            headers['Authorization'] = 'Bearer ' + self.token
        try:
            with self.opener(urllib.request.Request(url, headers=headers), timeout=self.timeout) as response:
                body = response.read().decode('utf-8', 'replace')
                if with_headers:
                    received = getattr(response, 'headers', None)
                    return body, {key: received.get(key) for key in ('X-OAuth-Scopes', 'X-RateLimit-Limit', 'X-RateLimit-Remaining')} if received is not None else {}
                return body
        except urllib.error.HTTPError as exc:
            if exc.code == 401:
                raise ApiError('GitHub rejected the saved token. Reconnect your GitHub account.', 502)
            if exc.code == 404:
                raise NotFoundError('GitHub could not find that. The repository, branch or file may not exist, or the connected account cannot see it.' if self.token
                                    else 'GitHub could not find that. The repository, branch or file may not exist, or the repository is private (connect a GitHub account to use private repositories).')
            if exc.code in (403, 429):
                raise ApiError('GitHub is limiting requests right now. Wait a few minutes' + ('.' if self.token else ', or connect a GitHub account for a higher limit.'), 503)
            raise ApiError(f'GitHub returned an error ({exc.code}).', 502)
        except (urllib.error.URLError, TimeoutError, OSError):
            raise ApiError('Could not reach GitHub from the controller. Check its internet access.', 502)

    def _json(self, path):
        return json.loads(self._fetch(self.API + path, 'application/vnd.github+json'))

    def _raw(self, owner, repo, ref, path):
        """File text at a commit, or None when the file does not exist."""
        try:
            if self.token:
                return self._fetch(f'{self.API}/repos/{owner}/{repo}/contents/{urllib.parse.quote(path)}?ref={ref}', 'application/vnd.github.raw+json')
            return self._fetch(f'{self.RAW}/{owner}/{repo}/{ref}/{urllib.parse.quote(path)}', 'text/plain')
        except NotFoundError:
            return None

    # -- queries -------------------------------------------------------------------
    def repository(self, owner, repo):
        data = self._json(f'/repos/{owner}/{repo}')
        if data.get('private') and not self.token:
            raise ValidationError('This repository is private. Connect a GitHub account that can read it.')
        if data.get('archived'):
            raise ValidationError('This repository is archived, so it will not receive fixes. Choose an active one.')
        return data

    def branches(self, owner, repo):
        names = []
        for page in (1, 2, 3):
            chunk = self._json(f'/repos/{owner}/{repo}/branches?per_page=100&page={page}')
            names += [item['name'] for item in chunk]
            if len(chunk) < 100:
                break
        return names

    def commit(self, owner, repo, ref):
        data = self._json(f'/repos/{owner}/{repo}/commits/{urllib.parse.quote(ref, safe="")}')
        return {'sha': data['sha'], 'message': (data['commit']['message'] or '').split('\n')[0][:200],
                'date': (data['commit'].get('committer') or {}).get('date'), 'author': (data['commit'].get('author') or {}).get('name')}

    def compare(self, owner, repo, base, head):
        try:
            data = self._json(f'/repos/{owner}/{repo}/compare/{base}...{head}')
        except ApiError:
            return None
        return {'ahead_by': data.get('ahead_by'), 'behind_by': data.get('behind_by'), 'status': data.get('status')}

    def _package(self, owner, repo, ref, repo_name):
        tree = self._json(f'/repos/{owner}/{repo}/git/trees/{ref}')
        folders = [item['path'] for item in tree.get('tree', []) if item['type'] == 'tree' and not item['path'].startswith('.')]
        candidates = sorted(folders, key=lambda name: (name.replace('-', '_') != repo_name.replace('-', '_'), name))
        for folder in candidates:
            hooks = self._raw(owner, repo, ref, f'{folder}/hooks.py')
            if hooks:
                match = HOOKS_APP_NAME.search(hooks)
                return folder, (match.group(1) if match else folder), hooks
        return None, None, None

    def inspect(self, url, branch=None):
        """Everything the App Store shows about a repository on one branch."""
        owner, repo = parse_repo_url(url)
        branch = clean_branch(branch)
        data = self.repository(owner, repo)
        branches = self.branches(owner, repo)
        chosen = branch or data.get('default_branch') or (branches[0] if branches else '')
        if chosen not in branches:
            raise ValidationError(f'The branch "{chosen}" does not exist in this repository.')
        head = self.commit(owner, repo, chosen)
        folder, app_name, hooks = self._package(owner, repo, head['sha'], repo)
        if not folder:
            raise ValidationError('This does not look like a Frappe app: no package with a hooks.py file was found at the top of the repository.')
        if not APP_NAME.fullmatch(app_name):
            raise ValidationError('The app declares an unsupported name in hooks.py.')
        pyproject = self._raw(owner, repo, head['sha'], 'pyproject.toml')
        frappe_range = toml_frappe_range(pyproject) if pyproject else None
        init = self._raw(owner, repo, head['sha'], f'{folder}/__init__.py') or ''
        version = VERSION_ASSIGN.search(init)
        title = re.search(HOOKS_FIELD % 'app_title', hooks, re.M)
        description = re.search(HOOKS_FIELD % 'app_description', hooks, re.M)
        publisher = re.search(HOOKS_FIELD % 'app_publisher', hooks, re.M)
        return {
            'repo_url': f'https://github.com/{owner}/{repo}', 'owner': owner, 'repo': repo,
            'app_name': app_name, 'title': (title.group(1) if title else app_name.replace('_', ' ').title())[:100],
            'description': (data.get('description') or (description.group(1) if description else '') or '')[:2000],
            'publisher': (publisher.group(1) if publisher else owner)[:100],
            'stars': data.get('stargazers_count', 0), 'license': (data.get('license') or {}).get('spdx_id'),
            'default_branch': data.get('default_branch'), 'branches': order_branches(branches, data.get('default_branch')), 'branch': chosen,
            'commit': head, 'version': version.group(1) if version else None,
            'frappe_range': frappe_range,
            'compatibility': assess_compatibility(chosen, frappe_range, self.majors),
            'target_majors': self.majors,
            'html_url': data.get('html_url'), 'private': bool(data.get('private')),
        }

    # -- the connected account ------------------------------------------------------
    def account(self):
        body, headers = self._fetch(self.API + '/user', 'application/vnd.github+json', with_headers=True)
        data = json.loads(body)
        return {'login': data['login'], 'name': data.get('name'), 'avatar_url': data.get('avatar_url'), 'html_url': data.get('html_url'),
                'scopes': headers.get('X-OAuth-Scopes') or '', 'rate_limit': headers.get('X-RateLimit-Limit'), 'rate_remaining': headers.get('X-RateLimit-Remaining')}

    def repositories(self, limit=100):
        """Repositories the account can read, most recently pushed first. Archived ones are left out."""
        data = self._json(f'/user/repos?per_page={min(limit, 100)}&sort=pushed&affiliation=owner,collaborator,organization_member')
        return [{'full_name': item['full_name'], 'private': bool(item.get('private')), 'description': (item.get('description') or '')[:200],
                 'default_branch': item.get('default_branch'), 'html_url': item.get('html_url'), 'pushed_at': item.get('pushed_at')}
                for item in data if not item.get('archived')]
