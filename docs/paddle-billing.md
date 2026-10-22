# Paddle billing implementation

## Delivered foundation

- Server-owned checkout transactions and customer mapping; concurrent checkout attempts cannot silently create another transaction.
- Existing subscriptions route through a short-lived subscription-update preview, with prorated immediate billing and payment-failure protection. Quantities and app items are preserved.
- Durable operation state records accepted, rejected, and uncertain outcomes. Unknown outcomes block further subscription mutations until reconciliation confirms them or an operator resolves them.
- Authenticated customer portal for payment methods, invoices, cancellation, and provider-supported lifecycle actions.
- Signed webhook inbox, atomic duplicate processing, canonical provider reads, subscription freshness protection, transaction/adjustment snapshots, cumulative approved refunds, native credit balance synchronization.
- Durable trial-conversion outbox for legacy subscriptions, plus explicit per-site subscriptions and paid resource updates for linked sites.
- Audited, currency-specific account-credit grants, reservations, consumption and releases; admin assignment, customer balances/history, checkout/upgrade redemption and next-renewal scheduling.

## Admin-issued account credits

The credit system is newly built: admins grant non-cash plan credits to a customer in an active billing currency, with a required reason and idempotent operation key. Customer and admin pages show balances and activity. These are promotional/support allowances, not customer-purchased stored money and not Paddle's native customer balance.

Customers can check **Use available account credits** when choosing a plan. The server reserves up to the matching-currency plan price and attaches a private, price-restricted, one-time Paddle discount to the server-created transaction. Partial credits reduce checkout; sufficient credits can reduce the invoice to zero. Payment-method requirements and activation still follow Paddle checkout. The ledger consumes only the actual `details.totals.discount` after a canonical completed transaction, and returns any unused reservation. Abandoned open checkouts retain their reservations until canceled; a confirmed cancellation archives the discount before releasing credits.

For upgrades, the server previews Paddle's normal proration, reserves available matching-currency credits, creates a price-restricted one-period discount, and calibrates the nominal discount against Paddle previews because the discount itself may be prorated. It rejects a discount larger than the reservation. The UI displays the actual discounted amount and resulting payment. On successful mutation the temporary subscription discount is removed with `do_not_bill`, so it cannot reduce an unrelated later bill. A failed removal remains in a durable cleanup queue and blocks further app/plan mutations. Declined updates return reserved credits; ambiguous outcomes retain them until reconciliation. Customers can cancel a preview to return its credits immediately. Quotes expire after two minutes and are claimed atomically against confirmation before maintenance releases their reservations.

Customers can separately select **Use credits on next renewal**. This reserves credits ahead of collection and schedules a discount for exactly the next billing period. It does not rely on receiving a webhook before Paddle charges. Scheduling requires an active subscription without another discount/scheduled change and at least one hour before renewal. While credits are scheduled, release them first to change plans or apps. Release is allowed only while the original next-billing date is unchanged and no linked invoice exists. Renewals that are already processing keep credits reserved until confirmed. This action covers one renewal; remaining credits can be scheduled again afterward.

Credits cannot be stacked with another subscription discount. Currencies are never converted. Discounts follow Paddle's tax rules: displayed credit usage is the invoice discount amount, and Paddle recalculates tax. Existing tax-inclusive pricing can make the actual discount smaller than its nominal face amount; the unused reservation returns to the customer. Cash refunds do not automatically recreate admin-granted credits; an admin can grant a separate audited correction. Native Paddle billing credits remain independently provider-managed and are never debited from this ledger.

Configure the Paddle customer portal for payments, invoices and cancellation. Do not enable independently managed plan/quantity changes in a portal product collection while a reusable account-credit discount is reserved: platform mutation guards cannot intercept changes made directly in Paddle's dashboard or an external portal. The maximum-one-period discount and cleanup worker limit its lifetime; unusual provider-side reuse is detected instead of silently overdrawing a wallet.

The legacy `AddOn` catalog (separate from paid app installations) still attaches/removes local records without Paddle billing. Migrating that catalog to provider-backed recurring/one-time prices remains required before advertising complete add-on billing. Existing per-seat checkout still begins at quantity one; seat-selection UI is outside this foundation.

## Database deployment

Apply the committed Drizzle migrations 0008–0014 through the normal deployment migration process (`npm run db:migrate`). They add billing operation/provider records, credit accounts/entries, PAUSED subscription state, provider freshness fields, a trial-conversion outbox, credit redemptions and UTC billing defaults. Do not run schema push against the shared controller database. Migrations were tested against an isolated PostgreSQL instance and applied to the local application database. Deployment environments still require their normal migration step.

## Required worker

Webhook acknowledgment only persists an event. **Deploy the worker with this change**, otherwise payments will remain pending locally.

Choose one scheduler:

- Run `npm run billing:worker` each minute from the deployed application directory, with server environment loaded.
- Or send an authenticated POST to `/api/internal/billing` each minute with `Authorization: Bearer <BILLING_WORKER_SECRET>`.

Use one scheduler; jobs use database locks and are duplicate-safe. The HTTP worker is bounded for hosted execution. Monitor backlog size and increase worker capacity if arrival volume exceeds processing capacity. Credit maintenance releases expired/rejected reservations and removes completed temporary discounts. Failed events/outbox actions stop automatic retries at 20 attempts and require operational investigation; unresolved ownership must never be acknowledged as processed. Retry count alone is not a resolution.

A targeted repair is available as `npm run billing:worker -- sub_<id>`. It reads the canonical subscription and paginates its transactions and adjustments. It also repairs native credit snapshots and queues trial conversion. Schedule `npm run billing:worker -- --reconcile-all` daily. It reconciles known subscriptions and discovers missed initial payments through server-owned customer mappings. A transaction can also be repaired directly with `npm run billing:worker -- txn_<id>`.

## Paddle setup

Configure `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, and `NEXT_PUBLIC_PADDLE_ENV` (sandbox first). Keep sandbox and live databases/keys/destinations isolated. The API key needs access to customers, transactions, subscription reads/writes, adjustments, customer credit balances, customer portal sessions, and discount read/write access. Configure an approved/default checkout payment URL in Paddle.

Subscribe the webhook destination at `/api/paddle/webhook` to the event names in `lib/paddle.ts`: completed/updated/billed/canceled/failed/past-due transactions; created/updated/activated/trialing/canceled/paused/resumed/past-due subscriptions; created/updated adjustments. Transaction failures update invoices from canonical state; they never independently activate or deactivate subscriptions. Native customer credits are fetched after transaction/adjustment processing.

Scheduled cancellation retains access until the provider subscription becomes canceled. PAUSED is stored distinctly. The UI currently permits only active subscriptions to switch plans; trial transitions, billing-interval changes and resource compatibility need dedicated acceptance checks. Downgrades through this UI are immediate and prorated, explicitly disclosed in the confirmation.

## Operational recovery

- `BillingOperation.UNKNOWN` means do not retry the charge blindly. Inspect Paddle and use reconciliation; a matching canonical target plan resolves an unknown upgrade automatically.
- The worker marks PROCESSING operations older than five minutes UNKNOWN and checks canonical subscription state for uncertain upgrades. Confirmed rejections or unresolved outcomes still require operator review; the worker never retries a charge blindly.
- Server-created checkouts persist ownership before being offered to the browser. A webhook can recover a missing local transaction record using the stored operation, mapped customer, and price verification.
- Pending checkout selection is intentionally reused. To choose a different plan, the previous draft/ready transaction must be canceled in Paddle; the plan selector exposes a cancel-unfinished-checkout action when another plan is blocked by that draft.
- Canonical provider records retain monetary strings exactly. The legacy BillingRecord remains a major-unit display/report projection.
- Existing per-site app purchase compensation remains a separate legacy flow. This change serializes app mutations against plan changes, but a provider success followed by a database failure still requires reconciliation rather than assuming distributed rollback.

## Verification

`npm run test:paddle:billing` requires `BILLING_TEST_DATABASE_URL` pointing at an isolated PostgreSQL instance on 127.0.0.1:55439. The runner creates a unique temporary database, applies every committed migration, mocks every Paddle request (unexpected endpoints fail), runs integration checks, then drops that database. Never point this at the application database.

The isolated suite now includes 41 checks, including ledger concurrency, partial/full-credit purchases, canceled checkouts, credit-funded proration, expired/declined upgrades, renewal allocation/release, and duplicate settlement. Site checks cover encrypted setup ownership, no provisioning before payment, immutable checkout linkage, canonical payment confirmation, duplicate workers, hosting retries, independent site subscriptions, paid resource changes, grace periods, billing suspension recovery, abandoned orders, worker monitoring, and explicit free trials. A non-UTC database timezone regression verifies that fresh operations are not falsely treated as crashed.

## Site setup and payment

AlgoSuite plan selection opens site setup with that plan selected. The customer completes Site, Company, Plan, Apps, and Account, then continues to Payment. Saving details creates a durable SiteOrder; it does not call site creation. Pending setups can be resumed from Sites.

Account credentials are encrypted using SESSION_SECRET (at least 32 characters) with owner-bound authenticated encryption. Keep this secret stable while setups are pending; changing it requires recovering or re-entering pending credentials. Credentials are removed after the controller accepts provisioning.

The payment action freezes the setup and creates a server-owned Paddle transaction linked to its order. Account credits use the same checkout discount and settlement flow as other subscription purchases. Paddle checkout displays the final tax and amount due. A browser checkout callback only requests verification: canonical completed transaction data, matching ownership/price, and zero remaining balance authorize provisioning. Each new paid site creates its own subscription; an existing site is upgraded using its linked subscription rather than creating a new one. Explicit free trial plans retain their no-payment trial path.

After confirmation the order becomes READY. The payment page and billing worker can both start provisioning, guarded by a database lock and the controller's stable request key. Failed hosting calls remain queued for retry without charging again. Run the billing worker continuously on its documented schedule so payments can finish provisioning after the browser closes. Hosting capabilities and site name availability are checked before checkout; unavailable hosting blocks payment.

`npm run test:paddle:sandbox:credits` uses the configured sandbox credentials to create isolated test catalog/customer records, preview partial/full credit purchases, create unpaid drafts, and preview prorated/next-renewal discounts where an active USD sandbox subscription is available. It never collects a payment and cancels/archives the test records afterward. Partial/full preview and draft checks, prorated preview, and next-renewal preview have been validated against Paddle's sandbox. Real sandbox browser checkout, full controller provisioning, a $0.98 prorated upgrade, actual resource changes (1 to 2 vCPU, 2 to 4 GB RAM, 10 to 20 GB storage), and cancellation-driven site deactivation have been verified with a disposable site on 2026-10-22. Card authentication, retry timing, portal configuration and live-environment acceptance remain separate checks.


## Per-site upgrades and lifecycle

`Subscription.siteOrderId` identifies the purchased setup and `siteId` identifies its provisioned controller site. Both are unique. Legacy product-level subscriptions retain their partial user/product uniqueness; new site subscriptions can coexist for the same product. Migration backfills only unambiguous paid site purchases. Existing sites can bind a single matching unassigned active legacy subscription when the owner requests an upgrade; ambiguous historical links require support rather than guessing.

The site's Change plan dialog only offers active, Paddle-mapped paid plans. It previews the exact linked subscription and checks controller capacity/user limits without queuing work. Confirmation repeats that preflight, applies Paddle's prorated mutation with payment-failure protection, and waits for a canonical completed, zero-balance transaction containing the target price. The worker queues the controller update and observes the actual resulting plan before recording appliedPlanId. App purchases also use the site's linked subscription. A browser success event or subscription item change alone never authorizes higher site limits.

Past-due subscriptions receive a three-day grace period from the first observed past-due state. Repeated events do not extend it. At expiry, or when a subscription is paused/canceled, the worker deactivates that linked site without deleting its data. Scheduled cancellations keep access until Paddle becomes canceled. Payment recovery reactivates only billing-owned suspensions; manual deactivations remain manual. Customer start/restart/reactivate/retry actions cannot bypass an expired billing restriction. A canceled subscription must be resolved through a supported provider recovery/replacement process; it is never charged again automatically.

Unpaid site setups can be canceled from the payment page. After 24 hours the worker attempts expiry: Paddle draft/ready transactions must be canceled first, credit cleanup must finish, and only then are the reserved site name and encrypted credentials released. Completed, collecting or uncertain payments retain their reservation for reconciliation; paid sites cannot be canceled through setup cleanup.

## Local worker and monitoring

`npm run dev:all` now includes the billing worker and passes the root application database configuration to controller processes. Alternatively run `npm run billing:worker -- --watch` continuously (one pass per minute). Pending site transactions and upgrades are reconciled during normal worker runs, so local tests do not require an inbound webhook tunnel. Full reconciliation runs daily to recover missed lifecycle events. Webhooks remain the prompt update mechanism for production renewals, cancellation and overdue states.

Open Admin → Payments → Billing processing status (`/admin/billing-status`) for worker completion, queued/failed events, uncertain outcomes, paid provisioning, pending resource changes and grace-period counts. Authenticated GET `/api/internal/billing` returns health; configure your deployment monitor to alert on non-200 responses. POST runs processing. Both require `Authorization: Bearer <BILLING_WORKER_SECRET>`. A random secret has been configured in the local ignored .env. Production scheduling and external alert delivery must be configured on the deployment platform; the repository cannot install those without a deployment target.

When a public HTTPS URL is available, run `npm run billing:webhook -- https://your-app.example`. This creates/updates the explicitly configured Paddle notification destination and writes its signing secret into .env without printing it. Restart the application afterward. The API key needs notification-setting read/write permissions in addition to billing permissions. Localhost cannot receive inbound Paddle notifications; use a tunnel URL or the deployed app URL. Sandbox and live destinations and secrets must remain separate.

The opt-in `npm run test:paddle:site:sandbox -- setup` creates a disposable local customer and sandbox catalog, then prints its local payment page. Complete that page with Paddle's published sandbox test card. `status` verifies the resulting site and subscription; `upgrade` previews and commits a sandbox upgrade for that exact fixture; `cancel` tests cancellation-driven deactivation; `cleanup` cancels its subscription, queues deletion of its test site and archives only its test catalog. The fixture is stored with restricted permissions in /tmp/unityalgo-site-billing-sandbox.json. Audit records are retained. It refuses live configuration.
