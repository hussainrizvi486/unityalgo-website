import assert from 'node:assert/strict';
import { validateSiteWizard } from '../lib/site-wizard';

const ok = {
    slug: 'acme', companyName: 'Acme', country: 'Pakistan', currency: 'PKR',
    coaType: 'numbered', planId: 'p1', apps: [], email: 'a@b.co',
    password: 'twelve-chars!', confirmPassword: 'twelve-chars!',
};
assert.deepEqual(validateSiteWizard(ok), {});
for (const slug of ['ab', '1abc', 'a--b', 'abc-', 'UP', 'a_b'])
    assert.ok(validateSiteWizard({ ...ok, slug }, 0).slug, slug);
assert.ok(validateSiteWizard({ ...ok, country: 'Atlantis' }, 1).country);
assert.ok(validateSiteWizard({ ...ok, coaType: 'x' }, 1).coaType);
assert.ok(validateSiteWizard({ ...ok, planId: '' }, 2).planId);
assert.ok(validateSiteWizard({ ...ok, email: 'bad' }, 4).email);
assert.ok(validateSiteWizard({ ...ok, password: 'short', confirmPassword: 'short' }, 4).password);
assert.ok(validateSiteWizard({ ...ok, confirmPassword: 'other-password!' }, 4).confirmPassword);
assert.deepEqual(validateSiteWizard({ ...ok, email: 'bad' }, 0), {}); // other steps' errors ignored
console.log('site-wizard ok');
