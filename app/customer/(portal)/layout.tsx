import { CustomerShell } from '@/components/customer/customer-shell';

export default function CustomerPortalLayout({ children }: { children: React.ReactNode }) {
  return <CustomerShell>{children}</CustomerShell>;
}
