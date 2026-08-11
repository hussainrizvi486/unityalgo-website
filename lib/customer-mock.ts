export type CustomerProfile = {
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
};

export type CustomerSubscription = {
  plan: string;
  price: string;
  status: 'Active' | 'Trial';
  nextBillingDate: string;
  purchaseDate: string;
  storeName: string;
  storeType: string;
  transactionId?: string;
  billingHistory: Array<{ id: string; date: string; description: string; amount: string; status: 'Paid' | 'Pending' }>;
};

type CustomerSession = {
  version: 1;
  user: CustomerProfile;
  subscription?: CustomerSubscription;
};

const SESSION_KEY = 'unityalgo_customer_session_v1';
const PENDING_KEY = 'unityalgo_customer_pending_v1';

export const mockVerificationCode = '123456';

export function readCustomerSession(): CustomerSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as CustomerSession;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCustomerSession(session: Omit<CustomerSession, 'version'>) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify({ version: 1, ...session }));
  window.dispatchEvent(new Event('unityalgo-customer-session'));
}

export function clearCustomerSession() {
  window.localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event('unityalgo-customer-session'));
}

export function savePendingCustomer(user: CustomerProfile) {
  window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(user));
}

export function readPendingCustomer(): CustomerProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem(PENDING_KEY);
    return value ? JSON.parse(value) as CustomerProfile : null;
  } catch {
    return null;
  }
}

export function clearPendingCustomer() {
  window.sessionStorage.removeItem(PENDING_KEY);
}

export function planPrice(plan: string) {
  return ({ Starter: 'PKR 3,500', Growth: 'PKR 7,000', Professional: 'PKR 42,000', Enterprise: 'PKR 250,000' } as Record<string, string>)[plan] ?? 'PKR 7,000';
}
