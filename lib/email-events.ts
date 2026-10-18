import type { EmailPurpose } from '@/db/types';

export interface EmailPlaceholder {
    key: string;
    label: string;
    sample: string;
}

export interface EmailEventDef {
    key: string;
    label: string;
    description: string;
    /** Which kind of mailbox sends it (see Admin > Email accounts). */
    purpose: EmailPurpose;
    defaultEnabled: boolean;
    required?: boolean;
    placeholders: EmailPlaceholder[];
    defaultSubject: string;
    defaultBody: string;
}

const PLATFORM: EmailPlaceholder[] = [
    { key: 'platform.name', label: 'Platform name', sample: 'UnityAlgo' },
    { key: 'platform.url', label: 'Platform address', sample: 'https://www.unityalgo.com' },
    { key: 'user.name', label: 'Customer name', sample: 'Sara Khan' },
    { key: 'user.email', label: 'Customer email', sample: 'sara@example.com' },
];

const SITE: EmailPlaceholder[] = [
    ...PLATFORM,
    { key: 'site.name', label: 'Site name', sample: 'acme' },
    { key: 'site.domain', label: 'Site address', sample: 'acme.cloud.unityalgo.com' },
    { key: 'site.url', label: 'Link that opens the site', sample: 'https://acme.cloud.unityalgo.com' },
    { key: 'site.details_url', label: 'Link to the site page in the portal', sample: 'https://www.unityalgo.com/dashboard/sites/1' },
    { key: 'site.plan', label: 'Plan', sample: 'Starter' },
    { key: 'site.owner_email', label: 'Email used to sign in to the site', sample: 'sara@example.com' },
    { key: 'site.status', label: 'Status', sample: 'ready' },
    { key: 'site.error', label: 'Error message (failures)', sample: 'Deployment stopped at "Start and check health".' },
];

const TRIAL: EmailPlaceholder[] = [
    ...SITE,
    { key: 'trial.days_left', label: 'Days left in the trial', sample: '3' },
    { key: 'trial.days_left_text', label: 'Days left, worded ("3 days")', sample: '3 days' },
    { key: 'trial.ends_at', label: 'Date the trial ends', sample: '20 Oct 2026' },
    { key: 'plans_url', label: 'Link to the plans page', sample: 'https://www.unityalgo.com/dashboard/plans' },
];

const APP: EmailPlaceholder[] = [
    ...SITE,
    { key: 'app.name', label: 'App name', sample: 'Payments' },
    { key: 'app.detail', label: 'What happened, in a sentence', sample: 'The app is ready to use.' },
];

const SITE_FOOTER = '[muted]Site: {{site.name}}<br/>Address: {{site.domain}}<br/>Plan: {{site.plan}}[/muted]';

export const EMAIL_EVENTS: EmailEventDef[] = [
    {
        key: 'verification_code',
        label: 'Verification code',
        description: 'Sent when someone registers or resets a password, with the one-time code.',
        purpose: 'TRANSACTIONAL',
        defaultEnabled: true,
        required: true,
        placeholders: [...PLATFORM, { key: 'otp', label: 'One-time code', sample: '482913' }, { key: 'expires_minutes', label: 'Minutes the code is valid', sample: '10' }],
        defaultSubject: 'Verify your {{platform.name}} account',
        defaultBody: "<p>Your {{platform.name}} verification code is:</p>\n[code]{{otp}}[/code]\n[muted]This code expires in {{expires_minutes}} minutes. If you didn't request this, you can ignore this email.[/muted]",
    },
    {
        key: 'registration_existing_account',
        label: 'Registration attempt for an existing account',
        description: 'Sent instead of a code when someone starts registering with an address that already has an account, so the sign-up page cannot be used to find out who is a customer.',
        purpose: 'TRANSACTIONAL',
        defaultEnabled: true,
        required: true,
        placeholders: [...PLATFORM, { key: 'login_url', label: 'Link to the sign-in page', sample: 'https://www.unityalgo.com/login' }],
        defaultSubject: 'You already have a {{platform.name}} account',
        defaultBody: "<p>Someone asked to create a {{platform.name}} account with {{user.email}}, but you already have one.</p>\n[callout]You already have an account[/callout]\n<p>Sign in with this address. If you have forgotten your password, use \"Forgot password\" on the sign-in page. If this was not you, you can ignore this email.</p>\n[button url=\"{{login_url}}\"]Sign in[/button]",
    },
    {
        key: 'site_initiated',
        label: 'Site requested',
        description: 'Sent as soon as a customer asks for a new site.',
        purpose: 'TRANSACTIONAL',
        defaultEnabled: true,
        placeholders: SITE,
        defaultSubject: 'We received your request for {{site.name}}',
        defaultBody: `<p>Your ERP site request for {{site.name}} ({{site.domain}}) has been received.</p>\n[callout]Site creation initiated[/callout]\n<p>Nothing else is needed. We will email you when deployment starts and when the site is ready.</p>\n[button url="{{site.details_url}}"]Track progress[/button]\n${SITE_FOOTER}`,
    },
    {
        key: 'site_started',
        label: 'Deployment started',
        description: 'Sent when a server has been assigned and the site starts deploying.',
        purpose: 'TRANSACTIONAL',
        defaultEnabled: true,
        placeholders: SITE,
        defaultSubject: 'Deployment started for {{site.name}}',
        defaultBody: `<p>A server has been assigned and deployment of {{site.name}} has begun.</p>\n[callout]Deployment started[/callout]\n<p>This usually takes several minutes. You can follow each step on your site page.</p>\n[button url="{{site.details_url}}"]View progress[/button]\n${SITE_FOOTER}`,
    },
    {
        key: 'site_milestone',
        label: 'Installing the site',
        description: 'Sent when the longest step, installing and setting up the company, begins.',
        purpose: 'TRANSACTIONAL',
        defaultEnabled: true,
        placeholders: SITE,
        defaultSubject: '{{site.name}} is being installed',
        defaultBody: `<p>Servers are ready and AlgoSuite is now being installed and configured for {{site.name}}.</p>\n[callout]Installing AlgoSuite and setting up your company[/callout]\n<p>The longest step is underway. Final checks and HTTPS routing follow.</p>\n[button url="{{site.details_url}}"]View progress[/button]\n${SITE_FOOTER}`,
    },
    {
        key: 'site_ready',
        label: 'Site ready',
        description: 'Sent when the site is live and the customer can sign in.',
        purpose: 'TRANSACTIONAL',
        defaultEnabled: true,
        placeholders: SITE,
        defaultSubject: '{{site.name}} is ready',
        defaultBody: `<p>Your ERP site is live at {{site.domain}}.</p>\n[callout]Deployment completed successfully[/callout]\n<p>Sign in with {{site.owner_email}} and the password you chose during setup.</p>\n[button url="{{site.url}}"]Open your ERP site[/button]\n${SITE_FOOTER}`,
    },
    {
        key: 'site_failed',
        label: 'Deployment failed',
        description: 'Sent when a site could not be deployed.',
        purpose: 'TRANSACTIONAL',
        defaultEnabled: true,
        placeholders: SITE,
        defaultSubject: '{{site.name}} could not be deployed',
        defaultBody: `<p>Deployment of {{site.name}} ({{site.domain}}) did not complete.</p>\n[callout]Deployment failed[/callout]\n<p>{{site.error}} Open your site page to retry. If it fails again, reply to this email or contact support.</p>\n[button url="{{site.details_url}}"]Review and retry[/button]\n${SITE_FOOTER}`,
    },
    {
        key: 'site_trial_ending',
        label: 'Free trial ending soon',
        description: 'Sent a few days before a free trial ends.',
        purpose: 'BILLING',
        defaultEnabled: true,
        placeholders: TRIAL,
        defaultSubject: 'Your free trial of {{site.name}} ends in {{trial.days_left_text}}',
        defaultBody: `<p>The free trial of {{site.name}} ({{site.domain}}) is about to end.</p>\n[callout]{{trial.days_left_text}} left[/callout]\n<p>Subscribe to {{site.plan}} before it ends to keep using the site. If you do not, the site is switched off. Your data is kept.</p>\n[button url="{{plans_url}}"]Choose a plan[/button]\n${SITE_FOOTER}`,
    },
    {
        key: 'site_trial_ended',
        label: 'Free trial ended',
        description: 'Sent when a free trial ends without a subscription and the site is switched off.',
        purpose: 'BILLING',
        defaultEnabled: true,
        placeholders: TRIAL,
        defaultSubject: 'Your free trial of {{site.name}} has ended',
        defaultBody: `<p>The free trial of {{site.name}} ({{site.domain}}) has ended and the site has been switched off.</p>\n[callout]Trial ended[/callout]\n<p>Your data is kept. Subscribe to {{site.plan}} to use the site again.</p>\n[button url="{{plans_url}}"]Subscribe[/button]\n${SITE_FOOTER}`,
    },
    {
        key: 'site_trial_converted',
        label: 'Trial converted to a subscription',
        description: 'Sent when a customer subscribes during their trial.',
        purpose: 'BILLING',
        defaultEnabled: true,
        placeholders: TRIAL,
        defaultSubject: 'Thanks for subscribing: {{site.name}} stays on',
        defaultBody: `<p>Your subscription is active, so the free trial of {{site.name}} is over and the site carries on as normal.</p>\n[callout]Subscribed[/callout]\n<p>Nothing else is needed.</p>\n[button url="{{site.details_url}}"]Open your site page[/button]\n${SITE_FOOTER}`,
    },
    {
        key: 'app_installed',
        label: 'App installed',
        description: 'Sent when an app finishes installing on a customer\'s site.',
        purpose: 'TRANSACTIONAL',
        defaultEnabled: false,
        placeholders: APP,
        defaultSubject: '{{app.name}} is installed on {{site.name}}',
        defaultBody: `<p>{{app.name}} has been installed on {{site.name}}.</p>\n[callout]{{app.detail}}[/callout]\n[button url="{{site.details_url}}"]Open your site page[/button]\n${SITE_FOOTER}`,
    },
    {
        key: 'app_failed',
        label: 'App install failed',
        description: 'Sent when an app could not be installed. The site is returned to how it was.',
        purpose: 'TRANSACTIONAL',
        defaultEnabled: false,
        placeholders: APP,
        defaultSubject: '{{app.name}} could not be installed on {{site.name}}',
        defaultBody: `<p>{{app.name}} could not be installed on {{site.name}}.</p>\n[callout]{{app.detail}}[/callout]\n[button url="{{site.details_url}}"]Open your site page[/button]\n${SITE_FOOTER}`,
    },
    {
        key: 'app_removed',
        label: 'App removed',
        description: 'Sent when an app has been removed from a site.',
        purpose: 'TRANSACTIONAL',
        defaultEnabled: false,
        placeholders: APP,
        defaultSubject: '{{app.name}} was removed from {{site.name}}',
        defaultBody: `<p>{{app.name}} has been removed from {{site.name}}.</p>\n[callout]{{app.detail}}[/callout]\n[button url="{{site.details_url}}"]Open your site page[/button]\n${SITE_FOOTER}`,
    },
    {
        key: 'app_removal_failed',
        label: 'App removal failed',
        description: 'Sent when an app could not be removed. The site is returned to how it was.',
        purpose: 'TRANSACTIONAL',
        defaultEnabled: false,
        placeholders: APP,
        defaultSubject: '{{app.name}} could not be removed from {{site.name}}',
        defaultBody: `<p>{{app.name}} could not be removed from {{site.name}}.</p>\n[callout]{{app.detail}}[/callout]\n[button url="{{site.details_url}}"]Open your site page[/button]\n${SITE_FOOTER}`,
    },
];

export const findEmailEvent = (key: string) => EMAIL_EVENTS.find((event) => event.key === key) ?? null;

/** Sample values for previewing an event's message. */
export const sampleVars = (event: EmailEventDef): Record<string, string> =>
    Object.fromEntries(event.placeholders.map((placeholder) => [placeholder.key, placeholder.sample]));
