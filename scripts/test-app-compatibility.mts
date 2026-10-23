import assert from 'node:assert/strict';
import { appsBlockingPlan, isCompatible, isLowerPlan, requiredPlan, upgradeTarget, type PlanTier } from '../lib/app-compatibility';

const starter: PlanTier = { id: 'starter', name: 'Starter', productId: 'algosuite', sortOrder: 1 };
const growth: PlanTier = { id: 'growth', name: 'Growth', productId: 'algosuite', sortOrder: 2 };
const enterprise: PlanTier = { id: 'enterprise', name: 'Enterprise', productId: 'algosuite', sortOrder: 3 };
const other: PlanTier = { id: 'launch', name: 'Launch', productId: 'commerce', sortOrder: 1 };
const plans = [enterprise, starter, growth, other];
let n = 0; const ok = (name: string, fn: () => void) => { fn(); n++; console.log(`ok ${name}`); };

ok('an app with no minimum works on every plan', () => { for (const plan of plans) assert.ok(isCompatible({ minPlanId: null }, plan, plans)); });
ok('a plan at or above the minimum can use the app', () => {
    const app = { minPlanId: 'growth' };
    assert.ok(!isCompatible(app, starter, plans)); assert.ok(isCompatible(app, growth, plans)); assert.ok(isCompatible(app, enterprise, plans));
});
ok('the upgrade prompt names the cheapest plan that works, and only when needed', () => {
    const app = { minPlanId: 'growth' };
    assert.equal(upgradeTarget(app, starter, plans)?.id, 'growth');
    assert.equal(upgradeTarget(app, growth, plans), null);
    assert.equal(upgradeTarget({ minPlanId: null }, starter, plans), null);
});
ok('a deleted or unknown minimum plan never blocks an app', () => {
    assert.equal(requiredPlan({ minPlanId: 'gone' }, plans), null);
    assert.ok(isCompatible({ minPlanId: 'gone' }, starter, plans));
});
ok('tiers are per product: another product is never blocked by this one', () => assert.ok(isCompatible({ minPlanId: 'growth' }, other, plans)));
ok('a site with no known plan is not blocked', () => assert.ok(isCompatible({ minPlanId: 'growth' }, null, plans)));
ok('a downgrade is blocked by installed apps the lower plan cannot run', () => {
    const installed = [{ name: 'Free', minPlanId: null }, { name: 'Pro tool', minPlanId: 'growth' }, { name: 'Top tool', minPlanId: 'enterprise' }];
    assert.deepEqual(appsBlockingPlan(installed, starter, plans).map((app) => app.name), ['Pro tool', 'Top tool']);
    assert.deepEqual(appsBlockingPlan(installed, growth, plans).map((app) => app.name), ['Top tool']);
    assert.deepEqual(appsBlockingPlan(installed, enterprise, plans), []);
});
ok('lower-plan detection', () => { assert.ok(isLowerPlan(growth, starter, plans)); assert.ok(!isLowerPlan(starter, growth, plans)); });
console.log(`${n} app compatibility checks passed`);
