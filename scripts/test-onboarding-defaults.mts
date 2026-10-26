import assert from 'node:assert/strict';
import { slugFromName, validateSiteWizard } from '../lib/site-wizard';
import { validateRegistration, validateField } from '../lib/registration-validation';
import { parsePlanMetadataText, readPlanRestrictions } from '../lib/plan-metadata';
import { isSameOrigin, publicOrigin } from '../lib/request-origin';

let n = 0; const ok = (name: string, fn: () => void) => { fn(); n++; console.log(`ok ${name}`); };
const wizard = (slug: string) => validateSiteWizard({ slug, companyName: 'x', country: 'United States', currency: 'USD', coaType: 'standard', planId: 'p', apps: [], email: 'a@b.co', password: 'x'.repeat(12), confirmPassword: 'x'.repeat(12) }, 0).slug;

ok('the suggested site name always passes the wizard\'s own rules', () => {
    for (const name of ['Acme Trading', 'Acme Trading Pvt Ltd', 'Zeta & Sons LLC', '  Ünïcode Café  ', '123 Numbers First', 'AB', 'A very long company name that goes on and on and on forever and ever amen', 'Big---Hyphens  Co.', 'The Shop Inc']) {
        const slug = slugFromName(name);
        if (slug) assert.equal(wizard(slug), undefined, `${name} -> ${slug}`);
    }
});
ok('company names become readable site names', () => {
    assert.equal(slugFromName('Acme Trading Pvt Ltd'), 'acme-trading');
    assert.equal(slugFromName('Zeta & Sons LLC'), 'zeta-and-sons');
    assert.equal(slugFromName('Ünïcode Café'), 'unicode-cafe');
    assert.equal(slugFromName('123 Numbers First'), 'numbers-first');
    assert.equal(slugFromName('Big---Hyphens  Co.'), 'big-hyphens');
});
ok('a name that cannot make a valid site name suggests nothing instead of something invalid', () => {
    assert.equal(slugFromName(''), ''); assert.equal(slugFromName('AB'), ''); assert.equal(slugFromName('１２３'), ''); assert.equal(slugFromName('!!!'), '');
});
ok('a company that is only a legal word still gets a name', () => assert.equal(slugFromName('Limited Holdings'), 'limited-holdings'));
ok('a long company name is cut to the allowed length without a trailing hyphen', () => {
    const slug = slugFromName('Extraordinarily Long Company Name For Testing The Length Limit Properly Today');
    assert.ok(slug.length <= 48 && !slug.endsWith('-') && wizard(slug) === undefined, slug);
});
ok('registration requires a company name of sensible length', () => {
    const base = { firstName: 'Ada', lastName: 'Lovelace', phone: '+44 20 7946 0958', password: 'Password1' };
    assert.equal(validateRegistration({ ...base, company: 'Analytical Engines Ltd' }).company, undefined);
    assert.match(validateRegistration({ ...base, company: '' }).company ?? '', /required/);
    assert.match(validateRegistration({ ...base, company: ' ' }).company ?? '', /required/);
    assert.match(validateRegistration({ ...base, company: 'A' }).company ?? '', /at least 2/);
    assert.match(validateRegistration({ ...base, company: 'x'.repeat(101) }).company ?? '', /100/);
    assert.equal(validateField('company', '  Acme  '), null);
});

const req = (headers: Record<string, string>, url = 'http://localhost:2424/api/customer/notifications') => new Request(url, { method: 'POST', headers });
ok('behind the proxy, a request from the public site is accepted (the cause of the notification error)', () => {
    assert.ok(isSameOrigin(req({ origin: 'https://cloud.unityalgo.com', host: 'cloud.unityalgo.com', 'x-forwarded-proto': 'https' })));
    assert.ok(isSameOrigin(req({ origin: 'https://cloud.unityalgo.com', 'x-forwarded-host': 'cloud.unityalgo.com', 'x-forwarded-proto': 'https' })));
});
ok('without a proxy, the plain local address still works', () => assert.ok(isSameOrigin(req({ origin: 'http://localhost:2424' }))));
ok('a request from another site, or with no Origin, is refused', () => {
    assert.ok(!isSameOrigin(req({ origin: 'https://evil.example', host: 'cloud.unityalgo.com', 'x-forwarded-proto': 'https' })));
    assert.ok(!isSameOrigin(req({ host: 'cloud.unityalgo.com' })));
    assert.ok(!isSameOrigin(req({ origin: 'not a url', host: 'cloud.unityalgo.com' })));
    assert.ok(!isSameOrigin(req({ origin: 'https://cloud.unityalgo.com.evil.example', host: 'cloud.unityalgo.com' })));
});
ok('redirects are built from the address the visitor used', () => {
    assert.equal(publicOrigin(req({ host: 'cloud.unityalgo.com', 'x-forwarded-proto': 'https' })), 'https://cloud.unityalgo.com');
    assert.equal(publicOrigin(req({ 'x-forwarded-host': 'cloud.unityalgo.com, internal', 'x-forwarded-proto': 'https, http' })), 'https://cloud.unityalgo.com');
    assert.equal(publicOrigin(req({})), 'http://localhost:2424');
});
ok('plan metadata: blank means none, and a good object is kept as written', () => {
    assert.deepEqual(parsePlanMetadataText('  '), { ok: true, value: {} });
    const text = '{"restrictions":{"modules":["Accounting"],"roles":["Accounts User"]},"note":"kept"}';
    const result = parsePlanMetadataText(text);
    assert.ok(result.ok);
    assert.deepEqual(result.value, JSON.parse(text));
    assert.deepEqual(parsePlanMetadataText('{"defaults":{"country":"Pakistan"}}'), { ok: true, value: { defaults: { country: 'Pakistan' } } });
});
ok('plan metadata: mistakes are reported, not ignored', () => {
    for (const bad of ['{', '[]', '"x"', '{"restrictions":[]}', '{"restrictions":{"colour":[]}}', '{"restrictions":{"modules":"Accounting"}}', '{"restrictions":{"modules":[5]}}', '{"restrictions":{"roles":["<script>"]}}', '{"restrictions":{"roles":[""]}}', `{"restrictions":{"modules":[${Array.from({ length: 101 }, (_, i) => `"M${i}"`).join(',')}]}}`]) {
        assert.equal(parsePlanMetadataText(bad).ok, false, bad.slice(0, 60));
    }
});
ok('plan restrictions: the site setup reads clean, de-duplicated names and never throws', () => {
    assert.deepEqual(readPlanRestrictions(null), { modules: [], roles: [] });
    assert.deepEqual(readPlanRestrictions('nonsense'), { modules: [], roles: [] });
    assert.deepEqual(readPlanRestrictions({}), { modules: [], roles: [] });
    assert.deepEqual(readPlanRestrictions({ restrictions: { modules: [' Accounting ', 'Accounting', 'Stock  Ledger', 7, '<x>'], roles: ['Accounts User'] } }), { modules: ['Accounting', 'Stock Ledger'], roles: ['Accounts User'] });
    assert.deepEqual(readPlanRestrictions({ restrictions: { modules: 'Accounting' } }), { modules: [], roles: [] });
});
console.log(`${n} onboarding and origin checks passed`);
