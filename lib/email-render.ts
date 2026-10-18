import { emailStyle } from '@/lib/email-theme';

export type EmailVars = Record<string, string | number | null | undefined>;

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function fillPlaceholders(text: string, vars: EmailVars, escape: (value: string) => string = (v) => v) {
    return text.replace(PLACEHOLDER, (_match, name: string) => escape(String(vars[name] ?? '')));
}

/** The placeholder names a piece of text uses. */
export function placeholdersIn(text: string): string[] {
    return [...new Set([...text.matchAll(PLACEHOLDER)].map((match) => match[1]))];
}

function expandShortcodes(body: string) {
    return body
        .replace(/\[button\s+url="([^"]*)"\s*\]([\s\S]*?)\[\/button\]/gi, (_m, url: string, label: string) =>
            `<p style="margin: calc(${emailStyle.gap} * 1.5) 0;"><a href="${url}" style="${emailStyle.button}">${label}</a></p>`)
        .replace(/\[callout\]([\s\S]*?)\[\/callout\]/gi, (_m, inner: string) => `<p style="${emailStyle.callout}"><strong>${inner}</strong></p>`)
        .replace(/\[code\]([\s\S]*?)\[\/code\]/gi, (_m, inner: string) => `<p style="${emailStyle.code}">${inner}</p>`)
        .replace(/\[muted\]([\s\S]*?)\[\/muted\]/gi, (_m, inner: string) => `<p style="${emailStyle.muted}">${inner}</p>`);
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

function htmlToText(html: string) {
    return html
        .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, url: string, label: string) => `${label.replace(/<[^>]+>/g, '')}: ${url}`)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export interface RenderedEmail {
    subject: string;
    html: string;
    text: string;
}

export function renderEmail(template: { subject: string; bodyHtml: string }, vars: EmailVars): RenderedEmail {
    const body = fillPlaceholders(expandShortcodes(template.bodyHtml), vars, escapeHtml);
    return {
        subject: fillPlaceholders(template.subject, vars).replace(/[\r\n]+/g, ' ').trim(),
        html: `<div style="${emailStyle.page}">${body}</div>`,
        text: htmlToText(body),
    };
}
