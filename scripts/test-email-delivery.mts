import assert from 'node:assert/strict';
import { Resolver } from 'node:dns/promises';
import { getEmailDeliveryWarning } from '../lib/email-delivery';

const original = Resolver.prototype.resolveTxt;
try {
    Resolver.prototype.resolveTxt = async () => [['v=spf1 include:_spf.mx.cloudflare.net ~all']];
    assert.match((await getEmailDeliveryWarning('smtp.hostinger.com', 'test@example.com'))!, /add Hostinger to the existing SPF record/);
    Resolver.prototype.resolveTxt = async () => [['v=spf1 include:_spf.mx.cloudflare.net ', 'include:_spf.mail.hostinger.com ~all']];
    assert.equal(await getEmailDeliveryWarning('smtp.hostinger.com', 'test@example.com'), null);
    Resolver.prototype.resolveTxt = async () => [['v=spf1 include:_spf.mail.hostinger.com ~all'], ['v=spf1 include:_spf.mx.cloudflare.net ~all']];
    assert.match((await getEmailDeliveryWarning('smtp.hostinger.com', 'test@example.com'))!, /multiple SPF records/);
    Resolver.prototype.resolveTxt = async () => { throw new Error('DNS unavailable'); };
    assert.match((await getEmailDeliveryWarning('smtp.hostinger.com', 'test@example.com'))!, /Could not check SPF/);
    assert.equal(await getEmailDeliveryWarning('smtp.example.com', 'test@example.com'), null);
    assert.equal(await getEmailDeliveryWarning('smtp.hostinger.com', 'invalid'), null);
    console.log('Email delivery diagnostics: 6 checks passed.');
} finally {
    Resolver.prototype.resolveTxt = original;
}
