'use client';
import { Lock } from 'lucide-react';
import { UpgradeDialog, type SubscriptionActionsProps } from '@/components/customer/subscription-actions';

export interface PlanApp {
    id: string;
    name: string;
    /** "Free" or "$5/mo per site". */
    price: string;
}

export interface LockedApp extends PlanApp {
    requiredPlanId: string;
    requiredPlanName: string;
}

/** The apps a plan can run, and the ones that need a higher plan with a one-click path to upgrade. */
export function SubscriptionApps({ planName, compatible, locked, actions }: { planName: string; compatible: PlanApp[]; locked: LockedApp[]; actions: SubscriptionActionsProps }) {
    if (compatible.length === 0 && locked.length === 0) return null;
    return (
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            <h3 className="text-sm font-semibold text-foreground">Apps for your {planName} plan</h3>
            {compatible.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                    {compatible.map((app) => (
                        <li key={app.id} className="rounded-full border border-border bg-muted/40 px-3 py-1 portal-text-caption">
                            <span className="font-medium">{app.name}</span> <span className="text-muted-foreground">· {app.price}</span>
                        </li>
                    ))}
                </ul>
            )}
            {locked.length > 0 && (
                <div className="mt-4 rounded-lg border border-dashed border-border p-3">
                    <p className="flex items-center gap-2 portal-text-caption font-semibold text-muted-foreground"><Lock className="size-3.5" />Need a higher plan</p>
                    <ul className="mt-2 space-y-2">
                        {locked.map((app) => {
                            const reachable = actions.upgrades.some((plan) => plan.id === app.requiredPlanId);
                            return (
                                <li key={app.id} className="flex flex-wrap items-center justify-between gap-2 portal-text-body">
                                    <span><span className="font-medium">{app.name}</span> <span className="text-muted-foreground">· {app.price} · needs {app.requiredPlanName}</span></span>
                                    {reachable && actions.canUpgrade
                                        ? <UpgradeDialog props={actions} initialPlanId={app.requiredPlanId} label={`Upgrade to ${app.requiredPlanName}`} variant="outline" />
                                        : null}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}
