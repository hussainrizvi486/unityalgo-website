import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { verifyCustomerSessionToken, CUSTOMER_SESSION_COOKIE } from '@/lib/customer-auth';
import { OnboardingFlow } from '@/components/customer/onboarding-flow';
import { formatCurrency } from '@/lib/pricing';

export default async function CustomerOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  const session = token ? await verifyCustomerSessionToken(token) : null;
  if (!session) {
    const next = `/customer/onboarding${plan ? `?plan=${encodeURIComponent(plan)}` : ''}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.role !== 'CUSTOMER') redirect('/login');

  // The price shown has to be the price charged, so it comes from the same
  // plan row checkout resolves. It used to come from a hard-coded table that
  // no longer matched the plans admins edit.
  const selectedPlan = plan
    ? await prisma.plan.findFirst({
        where: {
          isActive: true,
          OR: [
            { slug: { equals: plan, mode: 'insensitive' } },
            { name: { equals: plan, mode: 'insensitive' } },
          ],
        },
        select: { name: true, priceAmount: true, priceUnit: true },
      })
    : null;

  return (
    <Suspense>
      <OnboardingFlow
        profile={{
          firstName: user.firstName || user.name || 'Customer',
          lastName: user.lastName || '',
          email: user.email,
        }}
        planName={selectedPlan?.name ?? plan ?? ''}
        planPrice={
          selectedPlan?.priceAmount == null
            ? null
            : formatCurrency(selectedPlan.priceAmount)
        }
      />
    </Suspense>
  );
}
