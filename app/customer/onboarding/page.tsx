import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { and, eq, or, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getCustomerSession } from '@/lib/customer-session';
import { OnboardingFlow } from '@/components/customer/onboarding-flow';
import { formatCurrency } from '@/lib/pricing';

export default async function CustomerOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const session = await getCustomerSession();
  if (!session) {
    const next = `/customer/onboarding${plan ? `?plan=${encodeURIComponent(plan)}` : ''}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const user = await db.query.user.findFirst({ where: eq(schema.user.id, session.userId) });
  if (!user || user.role !== 'CUSTOMER') redirect('/login');

  const selectedPlan = plan
    ? ((await db.query.plan.findFirst({
        where: and(
          eq(schema.plan.isActive, true),
          or(
            sql`lower(${schema.plan.slug}) = ${plan.toLowerCase()}`,
            sql`lower(${schema.plan.name}) = ${plan.toLowerCase()}`,
          ),
        ),
        columns: { name: true, priceAmount: true, priceUnit: true },
        with: { currency: true },
      })) ?? null)
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
            : formatCurrency(selectedPlan.priceAmount, selectedPlan.currency)
        }
      />
    </Suspense>
  );
}
