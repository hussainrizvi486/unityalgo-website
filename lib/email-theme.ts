import 'server-only';
import { designTokens } from '@/lib/design-tokens.generated';

/**
 * The look of the HTML emails, taken from the design tokens (the site scope: emails open outside the
 * dashboards). Email clients cannot read CSS variables, so values are inlined here from the generated copy.
 */
const t = designTokens.site;

export const emailStyle = {
    page: `font-family: ${t['font-sans'].replace(/var\(--font-[a-z]+\),\s*/g, '').replace(/"/g, "'")}; max-width: ${t['content-narrow']}; margin: 0 auto; color: ${t.foreground};`,
    muted: `color: ${t['muted-foreground']}; font-size: 0.875rem;`,
    callout: `margin: ${t.gap} 0; padding: calc(${t.gap} * 0.75) ${t.gap}; background: ${t.muted}; border-radius: ${t.radius};`,
    button: `background: ${t.primary}; color: ${t['primary-foreground']}; padding: calc(${t.gap} * 0.625) calc(${t.gap} * 1.125); border-radius: ${t.radius}; text-decoration: none;`,
    code: `font-size: 2rem; font-weight: ${t['heading-weight']}; letter-spacing: 0.2em; margin: ${t.gap} 0;`,
    gap: t.gap,
};
