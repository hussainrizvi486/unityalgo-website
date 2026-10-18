import 'dotenv/config';
import { eq, like } from 'drizzle-orm';
import { db, schema, closeDb } from '../lib/db';
import { EMAIL_EVENTS, sampleVars } from '../lib/email-events';
import { fillPlaceholders, placeholdersIn, renderEmail } from '../lib/email-render';
import { resolveEventMessage } from '../lib/email-templates';

let failed = 0;
function check(name: string, ok: boolean, detail = '') {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`);
    if (!ok) failed++;
}

// --- rendering ---
const hostile = { 'site.name': '<script>alert(1)</script> [button url="https://evil.test"]Click[/button]', 'site.url': 'https://acme.example' };
const rendered = renderEmail({ subject: 'Hi {{site.name}}\r\nBcc: x@evil.test', bodyHtml: '<p>{{site.name}}</p>[button url="{{site.url}}"]Open[/button]{{missing.value}}' }, hostile);
check('values are HTML-escaped', !rendered.html.includes('<script>') && rendered.html.includes('&lt;script&gt;'));
check('a value cannot become a shortcode', !rendered.html.includes('href="https://evil.test"') && !rendered.html.includes('<a href="https://evil'));
check('a line break in a value cannot add a mail header', !rendered.subject.includes('\n') && !rendered.subject.includes('\r'));
check('the template\'s own button is rendered', rendered.html.includes('href="https://acme.example"'));
check('an unknown placeholder becomes empty', !rendered.html.includes('missing'));
check('the text version carries the link', rendered.text.includes('Open: https://acme.example'));
check('placeholdersIn lists each name once', placeholdersIn('{{a.b}} {{ a.b }} {{c}}').join() === 'a.b,c');
check('fillPlaceholders leaves other text alone', fillPlaceholders('a {{x}} b', { x: '1' }) === 'a 1 b');

// --- every built-in message renders cleanly from its own sample values ---
for (const event of EMAIL_EVENTS) {
    const message = renderEmail({ subject: event.defaultSubject, bodyHtml: event.defaultBody }, sampleVars(event));
    const clean = !/\{\{|\[(button|callout|code|muted)/.test(message.subject + message.html) && message.text.length > 20;
    check(`built-in "${event.key}" renders`, clean, message.html.slice(0, 120));
    const used = placeholdersIn(event.defaultSubject + event.defaultBody);
    const known = new Set(event.placeholders.map((placeholder) => placeholder.key));
    check(`built-in "${event.key}" only uses its own placeholders`, used.every((name) => known.has(name)), used.filter((name) => !known.has(name)).join());
}

// --- assignment ---
const KEY = 'site_ready';
const before = await db.query.emailEvent.findFirst({ where: eq(schema.emailEvent.eventKey, KEY) });
const [template] = await db.insert(schema.emailTemplate).values({ name: 'zz-test-template', subject: 'Custom {{site.name}}', bodyHtml: '<p>Custom body for {{site.name}}</p>' }).returning();
try {
    let resolved = await resolveEventMessage(KEY);
    check('with nothing assigned the built-in message is used', resolved?.templateId == null && resolved?.template.subject === EMAIL_EVENTS.find((e) => e.key === KEY)!.defaultSubject);

    await db.insert(schema.emailEvent).values({ eventKey: KEY, templateId: template.id, enabled: true }).onConflictDoUpdate({ target: schema.emailEvent.eventKey, set: { templateId: template.id, enabled: true } });
    resolved = await resolveEventMessage(KEY);
    check('an assigned template is used', resolved?.templateId === template.id && resolved.template.subject === 'Custom {{site.name}}');

    await db.update(schema.emailTemplate).set({ isActive: false }).where(eq(schema.emailTemplate.id, template.id));
    resolved = await resolveEventMessage(KEY);
    check('an inactive template falls back to the built-in message', resolved?.templateId == null);
    await db.update(schema.emailTemplate).set({ isActive: true }).where(eq(schema.emailTemplate.id, template.id));

    await db.update(schema.emailEvent).set({ enabled: false }).where(eq(schema.emailEvent.eventKey, KEY));
    check('a switched-off event sends nothing', (await resolveEventMessage(KEY)) === null);

    await db.insert(schema.emailEvent).values({ eventKey: 'verification_code', enabled: false }).onConflictDoUpdate({ target: schema.emailEvent.eventKey, set: { enabled: false } });
    check('a required event cannot be switched off', (await resolveEventMessage('verification_code')) !== null);

    check('an event that was never emailed before stays off by default', (await resolveEventMessage('app_installed')) === null);

    await db.update(schema.emailEvent).set({ enabled: true }).where(eq(schema.emailEvent.eventKey, KEY));
    await db.delete(schema.emailTemplate).where(eq(schema.emailTemplate.id, template.id));
    resolved = await resolveEventMessage(KEY);
    check('deleting a template returns its event to the built-in message', resolved?.templateId == null);
    const after = await db.query.emailEvent.findFirst({ where: eq(schema.emailEvent.eventKey, KEY) });
    check('and clears the assignment', after?.templateId == null);
} finally {
    await db.delete(schema.emailTemplate).where(like(schema.emailTemplate.name, 'zz-test-%'));
    await db.delete(schema.emailEvent).where(eq(schema.emailEvent.eventKey, 'verification_code'));
    if (before) await db.update(schema.emailEvent).set({ templateId: before.templateId, enabled: before.enabled }).where(eq(schema.emailEvent.eventKey, KEY));
    else await db.delete(schema.emailEvent).where(eq(schema.emailEvent.eventKey, KEY));
    await closeDb();
}
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
