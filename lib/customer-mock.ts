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
