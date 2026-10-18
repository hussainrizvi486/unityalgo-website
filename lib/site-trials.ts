import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { controller } from '@/lib/controller-client';

export interface TrialEligibility {
    subscribed: Set<string>;
    /** Plans whose one free trial the customer has used. */
    used: Set<string>;
}

export async function trialEligibility(userId: string): Promise<TrialEligibility> {
    const [subscriptions, trials] = await Promise.all([
        db
            .select({ planId: schema.subscription.planId })
            .from(schema.subscription)
            .where(and(eq(schema.subscription.userId, userId), eq(schema.subscription.status, 'ACTIVE'))),
        controller.sites.trials(userId).catch(() => ({ used_plan_ids: [] as string[] })),
    ]);
    return {
        subscribed: new Set(subscriptions.map((row) => row.planId)),
        used: new Set(trials.used_plan_ids),
    };
}

export function trialDaysFor(plan: { id: string; trialDays: number | null }, eligibility: TrialEligibility): number {
    if (!plan.trialDays || plan.trialDays < 1) return 0;
    if (eligibility.subscribed.has(plan.id) || eligibility.used.has(plan.id)) return 0;
    return plan.trialDays;
}
