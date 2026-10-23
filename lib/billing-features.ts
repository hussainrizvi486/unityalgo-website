/**
 * Customer-facing account credits are built but hidden until the admin side is ready to support them.
 * Set NEXT_PUBLIC_CREDITS_ENABLED=true (and rebuild) to show them again. The flag is public so the same
 * value is read by server code and by client components.
 */
export const CREDITS_ENABLED = process.env.NEXT_PUBLIC_CREDITS_ENABLED === 'true';

/** A client may ask to use credits; this is the only place that decides whether that is honoured. */
export const wantsCredits = (requested: unknown) => CREDITS_ENABLED && requested === true;
