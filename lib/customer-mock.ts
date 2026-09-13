// Profile photo upload has no storage backend yet, so the picture a customer
// uploads on the Settings page is only kept in this browser's localStorage
// until a real upload API exists.
//
// The subscription half of this file is gone: it fabricated an active plan in
// localStorage from the browser's own Paddle completion event, which showed a
// customer as subscribed whether or not any money moved. Subscriptions are now
// real rows, written only by the signed Paddle webhook
// (app/api/paddle/webhook/route.ts).
const AVATAR_KEY = 'unityalgo_customer_avatar_v1';

export function readAvatarUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(AVATAR_KEY);
  } catch {
    return null;
  }
}

export function saveAvatarUrl(dataUrl: string) {
  window.localStorage.setItem(AVATAR_KEY, dataUrl);
  window.dispatchEvent(new Event('unityalgo-customer-avatar'));
}
