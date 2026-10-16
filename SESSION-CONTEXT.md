# UnityAlgo Platform — Session Context & Architecture Handoff

**Purpose.** This file is a handoff for another Claude model (or a new engineer)
picking up this repository cold. It describes what the project *is*, how it is
put together, the conventions that are load-bearing, and what was changed in the
session that produced this document.

**Last updated:** 2 September 2026
**Branch:** `dev-2` (main branch is `main`)
**Working tree:** ~216 files modified/untracked — this is a long-running feature
branch, not a clean checkout.

> **Provenance note.** The earlier portion of the session that produced this file
> was context-compacted. Everything below was re-verified against the actual
> repository before being written down. Where a claim could not be re-verified,
> it is marked *(unverified)*.

---

## 1. What this project is

UnityAlgo is a Pakistan-focused software company site plus the platform behind
its two products. One Next.js application serves four distinct audiences:

| Surface | Route prefix | Audience |
|---|---|---|
| Marketing site | `/`, `/services/*`, `/products/*`, `/blog/*` | Public |
| Customer portal | `/dashboard/*` | Signed-in customers |
| Admin panel | `/admin/*` | Staff (`Role.ADMIN`) |
| Internal API client | — | Talks to the Python controller |

The two products:

- **UnityCommerce** — a hosted e-commerce store builder. Each customer store is a
  *tenant*: a Docker container on a worker VPS, fronted by a Caddy edge proxy,
  with its own Postgres database. Provisioning is what the Python controller does.
- **AlgoSuite** — the ERP platform (accounting, HR, inventory, CRM).
  **Always call it "AlgoSuite"** — never "UnityERP" or any other name.

---

## 2. Architecture: one repo, two runtimes, one database, one login

```
                          Browser
                             │
                             │ HTTPS
                             ▼
                 ┌───────────────────────┐
                 │  Next.js 16 (Node)     │  ← the only public surface
                 │  App Router, RSC       │
                 │  proxy.ts middleware   │
                 │  Server Actions        │
                 └───────┬───────┬────────┘
                         │       │
        internal HTTP    │       │  short-lived scoped JWT
     (static API key,    │       │  (SSH terminal only, WebSocket)
      never public)      │       │
                         ▼       ▼
                 ┌───────────────────────┐
                 │  Python / Flask        │  ← internal API, no login of its own
                 │  controller/           │
                 │  + Celery worker/beat  │
                 │  + Redis               │
                 │  SSH · Docker · Caddy  │
                 └───────────┬───────────┘
                             │
                             ▼
                 ┌───────────────────────┐
                 │   ONE Postgres DB      │
                 │  The website (Drizzle) owns PascalCase│
                 │  Alembic owns snake_case│
                 └───────────────────────┘
```

### The three rules that hold this together

1. **One database, two schema owners.**
   The website (Drizzle) owns PascalCase tables (`User`, `Plan`, `Subscription`, `Currency`, …).
   Alembic owns snake_case tables (`tenants`, `server_nodes`, `deployments`,
   `domain_mappings`, `operations`, `activity_logs`, …). There are **no name
   collisions**. Cross-tool foreign keys are real Postgres FKs written by hand in
   Alembic migrations (e.g. `tenants.user_id → "User"(id)`).
   `controller/alembic/env.py` filters website-owned tables out of autogenerate so
   Alembic never tries to drop them. **`e2e-test.ts` asserts this guard still works.**

2. **One authentication system.** The Python service has **no login and no user
   table**. Its old `admin_users` table and session-cookie auth were removed.
   Next.js authenticates everyone; requests to Python carry a static
   `CONTROLLER_INTERNAL_API_KEY`. The one exception is the browser SSH terminal
   (a WebSocket cannot be proxied through a Server Action): Next.js mints a
   short-lived `jose` JWT scoped to `{ purpose: 'terminal', serverId, exp }`
   using the same `SESSION_SECRET`, and the Python WS service verifies it.

3. **Two cookies, deliberately.** `unityalgo_admin_session` and
   `unityalgo_customer_session` are separate. Sign-in is *unified* at `/login`
   for both roles, but the cookies stay isolated so an admin session cannot be
   replayed as a customer session or vice versa. `proxy.ts` enforces this.
   `e2e-test.ts` has a "Cross-role session isolation" block asserting it.

---

## 3. Repository layout

```
/
├── app/                    Next.js App Router
│   ├── admin/(dashboard)/  Admin panel (route group)
│   ├── dashboard/          Customer portal
│   ├── login/              Unified sign-in (both roles)
│   ├── customer/           register, onboarding, forgot-password
│   ├── products/           algosuite, unitycommerce
│   ├── services/           6 service pages
│   ├── blog/               list + [slug]
│   ├── api/                paddle/webhook, admin/upload, email
│   ├── theme-preview/      Living design-system reference (see §7)
│   ├── globals.css         ALL design tokens live here (@theme)
│   └── (the database client lives in lib/db.ts; the schema in db/schema.ts)
├── components/
│   ├── ui/                 shadcn-style primitives
│   ├── admin/              Admin-only compositions
│   ├── website/            Marketing sections
│   ├── customer/           Portal flows
│   └── layouts/            header.tsx, footer.tsx
├── lib/                    Server + shared logic (see §5)
├── controller/             The Python/Flask service (see §4)
├── db/                     Drizzle schema, relations, migrations (legacy Prisma ones archived)
├── scripts/                tsx operational + test scripts
├── proxy.ts                Next.js middleware (auth gate)
└── public/images/          Marketing artwork
```

### Path aliases
`@/` → repo root. So `@/lib/db`, `@/components/ui/button`,
`@/db/schema`. **`tsx` scripts only resolve `@/` when run from
the repo root** — a script placed outside `scripts/` will fail to resolve aliases.

---

## 4. The Python controller (`controller/`)

Flask + SQLAlchemy + Alembic + Celery + Redis. Runs as its own OS process
(gunicorn), not inside Node. Manages the infrastructure behind UnityCommerce
tenants over SSH (Paramiko).

```
controller/
├── app/
│   ├── controller/   Business logic: server, tenant, deployment, domain, log,
│   │                 database_connection, dashboard
│   ├── models/       SQLAlchemy models + types.py (EncryptedString TypeDecorator)
│   ├── routes/       Flask blueprints (/api/v1/*)
│   ├── services/     ssh_service, docker_service, postgres_service,
│   │                 caddy_admin_client, health_check_service, crypto (Fernet),
│   │                 activity_logger, proxy_configuration_service
│   ├── tasks/        Celery tasks (long-running provisioning/migration/backup)
│   └── api_auth.py   Internal API-key gate (NOT a login system)
├── alembic/versions/ Hand-written migrations
├── ws_terminal_main.py  SSH-terminal WebSocket service
└── main.py / gunicorn.conf.py
```

**Runs on `http://localhost:8000` by default** (`CONTROLLER_API_URL`).
When it is not running, `scripts/e2e-test.ts` **skips** its ~41 assertions and
reports a lower total (84 instead of 125). A lower number with 0 failures
usually means "controller offline", not "coverage lost" — check the skip lines.

**Encryption at rest.** Node-side secrets use AES-256-GCM (`lib/secret-box.ts`,
keyed by `CREDENTIAL_ENCRYPTION_KEY`). Python-side secrets use Fernet
(`controller/app/services/crypto.py`). Two mechanisms because two runtimes; both
are real, neither is a placeholder.

---

## 5. Key `lib/` modules

| File | Responsibility |
|---|---|
| `db.ts` | The Drizzle client (`db`) over one `pg` pool, plus `isUniqueViolation`, `errorText`, `one` |
| `auth.ts`, `admin-session.ts` | Admin session mint/verify; `requireAdmin()` re-checks the role |
| `customer-auth.ts`, `customer-session.ts` | Customer equivalents |
| `controller-client.ts` | Typed fetch wrapper for the Python API; Server-Action-only |
| `controller-status.ts` | Reachability probe, drives the "controller offline" UI |
| `currency.ts` | `NUMBER_FORMATS`, `patternParts()`, `formatCurrencyAmount()` |
| `numeric-input.ts` | Parse/format/validate behind `SmartInput` (see §6) |
| `paddle.ts`, `paddle-catalog.ts` | Paddle API + webhook HMAC verification |
| `secret-box.ts` | AES-256-GCM seal/open |
| `mail-accounts.ts`, `email.ts` | SMTP account resolution + sending |
| `tickets.ts`, `comments.ts` | Support ticket + polymorphic comment helpers |
| `metadata.ts` | `generatePageMetadata`, `generateBreadcrumbJsonLd` |

**`NUMBER_FORMATS` lives in `lib/currency.ts`, not in an action file.** A
`'use server'` file may only export async functions; exporting the const array
from `app/admin/currency-actions.ts` is a build error. This has bitten before.

---

## 6. Design system & the two input components

### Tokens
**Every colour token is defined once in `app/globals.css` under `@theme`.**
Brand is a crimson `#8C181B` with `brand-deep/press/soft/subdued` variants, a
gold secondary, true-grayscale `ink-50…ink-950` neutrals, and semantic aliases
(`--color-background`, `--color-muted`, `--color-accent`, sidebar tokens, …).

Convention: **buttons and cards fill with neutral `ink-900`, not brand.** Brand
is reserved for links, icons, badges and small accents.

### `components/ui/smart-input.tsx` — one field for all numeric types

Replaces every `type="number"` in the admin panel (there are now **zero**).

- Always `type="text"`. `type="number"` cannot show a grouping separator or a
  symbol, and returns `""` for anything the browser dislikes — making a mistyped
  value indistinguishable from a cleared one.
- Renders **two** inputs: the visible one (no `name`) shows `$1,234.50`; a hidden
  one carries `name` and the canonical `1234.5`. Server actions never see
  formatting.
- Formatting appears on **blur**, disappears on **focus**.
- `kind`: `text | integer | decimal | currency | percent`.
- Validation runs on blur once `touched`, surfaced via `aria-invalid` +
  a `role="alert"` message. No separate `isError` prop to forget.

Two subtleties that are easy to break:

1. **Select-on-focus is a `useLayoutEffect`, not a `requestAnimationFrame`.**
   Focusing swaps `$1,234.50` for `1234.5`; writing the shorter string into the
   DOM node collapses the selection to its end, so the next keystroke *appends*
   to the old value (this produced `70,000,587` from typing `587`). The select
   must happen in the same synchronous commit as the value swap. It is also
   guarded on `document.activeElement === element`, because `select()` *also*
   focuses — an unguarded call drags focus back out of the next field.
2. **`fromStored()` is not `toCanonical()`.** A stored value is always canonical
   (`.` decimal point) regardless of how the field displays it. Running it through
   `toCanonical` in a `#.###,##` (European) currency reads every `.` as a
   thousands separator and **multiplies the price by 100**. This was a real
   production bug, found by the theme-preview page.

`lib/numeric-input.ts` holds the pure logic and is unit-tested (47 assertions).

### `components/ui/autocomplete.tsx` — filtering combobox
Built on the existing Radix **Popover** (no new dependency). Type to filter,
↑/↓/Enter/Esc, full combobox ARIA. Same hidden-input contract as `SmartInput`,
so a form receives `pk` rather than the `Pakistan` the user read.
Focus must stay in the input, so `PopoverContent` uses
`onOpenAutoFocus={(e) => e.preventDefault()}`.

### `components/ui/dropdown-menu.tsx` — action menu
Also built on Popover rather than `@radix-ui/react-dropdown-menu`. Roving
arrow-key focus that skips `[data-disabled]` items. No typeahead, no submenus —
nothing in the app needs them yet.

### `components/admin/dynamic-form.tsx` — array-driven admin form
`tab`, `section`, `column` are **breaks, not containers** (ERP form-builder
style): fields belong to whichever break last preceded them, and `buildLayout()`
turns the flat list into tabs → sections → columns. A caller never closes
anything. Numeric field types route to `SmartInput`.

---

## 7. `/theme-preview` — the living design-system reference

A single page documenting the whole system, grouped as Foundations →
Components → Admin patterns → Composed. ~2000 lines. Each section names the
source file it documents.

**The rule that makes it useful: it renders the real components, never
re-styled copies.** Hand-rolled copies had previously drifted from the shipping
components, so the page documented a badge the app did not ship. The live
`AdminDynamicForm` is rendered there from a field array with a stub action.

Building it out found two real defects in shipping code:
- the `fromStored` currency bug above;
- **every Radix `SelectTrigger` was `h-8 px-2` while `Input` was `h-9 px-3`**,
  so a select beside a text field was 4px short with a different focus ring in
  every admin form. Both are now aligned.

---

## 8. Data model (website)

```
User (Role: ADMIN | CUSTOMER)
 ├── Address[]            (isDefault)
 ├── Subscription[]       → Plan → Product, Currency
 │    └── SubscriptionAddOn[] → AddOn
 ├── BillingRecord[]      (optional subscriptionId / tenantId)
 ├── SupportTicket[] → Comment[]   (polymorphic comments)
 ├── EmailVerification[]  (VerificationPurpose)
 └── Post[]               (blog author)

Product (table, was an enum) — has showOnLanding
Currency  — code/name/symbol/numberFormat/isActive/sortOrder
Plan      — priceAmount + currencyId, features[], paddlePriceId, showcase flags
PaddleEvent — webhook idempotency
EmailAccount (EmailPurpose: TRANSACTIONAL | SUPPORT | BILLING | MARKETING)
ContactSubmission, Post
```

Alembic side (snake_case): `tenants`, `server_nodes`, `deployments`,
`domain_mappings`, `operations`, `activity_logs`, `tenant_backups`,
`tenant_migrations`, `database_connections`, `database_clusters`.
`tenants.user_id → "User"(id)`, `tenants.subscription_id → "Subscription"(id)`.

**Migrations are generated.** `npm run db:generate` diffs `db/schema.ts` against the last snapshot; `npm run db:migrate` applies them (`npm run db:baseline` first on a database that predates Drizzle). The migrations Prisma ran before the move are archived in
`db/legacy-prisma-migrations/`.

---

## 9. Billing (Paddle)

- **The webhook is the only thing that grants a subscription.**
  `app/api/paddle/webhook/route.ts` verifies the `ts=…;h1=…` HMAC signature.
  A previous `purchasePlanAction` granted `ACTIVE` with no payment — that is fixed
  and must not regress.
- `transaction.completed` sends `billing_period`; `subscription.*` sends
  `current_billing_period`. **Read both** — reading only the first leaves a stale
  renewal date.
- Amounts are in **minor units**.
- `PaddleEvent` gives idempotency; sandbox and production have different API bases.

---

## 10. Standing constraints from the user (still in force)

1. SMTP configuration stays in **environment variables** — never hardcoded.
2. Customer registration must **never** let a user select or elevate their own role.
3. The registration form must not assign or modify other roles.
4. Passwords use the application's standard hashing (bcrypt).
5. **Do not duplicate databases or create separate authentication systems**
   without a strong technical reason.
6. Do not merge or modify the two projects until a plan is reviewed and approved.

**Design/content constraints**
- Call the ERP **"AlgoSuite"** everywhere.
- Regional market: **Pakistan first**.
- **Do not** include team size anywhere.
- **No proofs, testimonials or client logos exist** — do not invent them.
- Do not add new Services pages.
- The earlier "no reddish colours in hero sections" constraint was **explicitly
  reversed** and has since been superseded again (see §11).

---

## 11. Work completed in this session

### a) `SmartInput` (`components/ui/smart-input.tsx`, `lib/numeric-input.ts`)
Built the single configurable numeric/text input; adopted in
`AdminDynamicForm` and 7 admin forms; **0 `type="number"` remain** in
`app/admin` or `components/admin`. Fixed the caret/selection bug (§6) and the
`fromStored` currency bug. Unit tests: 47/47. Browser tests: 21/21.

### b) `/theme-preview` expansion (1409 → ~2071 lines)
Added: Text Inputs & Fields (states, anatomy, adornments), Numeric & Currency
Inputs, Selects & Autocomplete, Checkboxes & Toggles, Full Form Layout (live
`AdminDynamicForm`), Dropdowns & Menus, Surfaces & Background Colors, expanded
Cards (stat/list/selectable/summary) and Sections & Page Shells, expanded Buttons.
Built `autocomplete.tsx` and `dropdown-menu.tsx` because previewing a component
the app does not ship would document a fiction.
Aligned `SelectTrigger` to `Input` (`h-9 px-3` + matching focus ring).
Verified 36/36 in the browser.

### c) UnityCommerce page rebuild (`app/products/unitycommerce/`)
Restructured to **four sections** at the user's explicit direction:

1. **Hero** — heading changed to *"Build the brand you've always dreamed of."*
   Store mockup is browser chrome around an `ImagePlaceholder` (artwork pending),
   with an overlapping portrait phone frame.
2. **Themes Preview** — 10 portrait cards in a grid. A grid, not a slider:
   ten cards fit on roughly one screen and a slider would hide the range behind
   an interaction while adding keyboard/SR work.
3. **Pricing** — content, structure, toggle, add-ons table and billing policy
   **unchanged**; only recoloured.
4. **Build fast on UnityCommerce** — three steps using
   `/images/add-products.avif`, `/images/customize-store.jpg`,
   `/images/setup-payments.jpg`. **Note the filename is `add-products` (plural)** —
   the user's spec said `add-product`, which does not exist.
   Portrait `aspect-[3/4]` frames; the old final CTA was folded in here.

**Removed** (user-approved): the interactive capability showcase, features list,
comparison-vs-builders table, the 26-item FAQ, and the old final CTA.
⚠️ **That FAQ was substantial indexable content — the page's SEO surface is now
much smaller.** Nothing links to the removed anchors and there was no FAQ
structured data.

Images: 6.5 MB of source art → **111 KB delivered** as WebP via `next/image`.
Total page weight 0.21 MB.

**Colour history on this page (three passes, in order):**
1. Dark ground with crimson accents (added a `--color-brand-light` token
   because `brand-soft` is only ~2.6:1 on `ink-950`).
2. *"remove red colors … use black and white only"* → all brand utilities
   removed; the `--color-brand-light` token deleted as dead. Featured pricing
   card switched from red fill to inversion.
3. *"remove the black from hero section pricing section"* → **current state**:
   alternating **white hero → black themes → white pricing → black closing**.
   `ImagePlaceholder` gained a `tone` prop for this.

**The page is currently monochrome.** A test asserts it: it walks every element
in `<main>`, parses computed `color`, `backgroundColor`, border colours,
`boxShadow` and `backgroundImage` (gradients hid the red glows), and fails on
any channel spread > 8.

The `Logo` in the header/footer is **still red** — it is `/logo.svg` behind a
shared component used site-wide, so changing it would affect every page. Left
alone deliberately; flagged to the user.

### d) Earlier in the session (pre-compaction, partially *unverified*)
Login unification to `/login` (old `/admin/login` and `/customer/login` deleted,
permanent redirects added in `next.config.ts`); Currency table + admin CRUD +
sidebar entry; `Product.showOnLanding`; FK indexes; Paddle checkout integration;
email accounts + SMTP; hero 3D work; admin panel shadcn restyle; a codebase-wide
performance pass (landing images 3.42 MB → 0.04 MB; mobile landing JS
1.71 MB → 0.77 MB by keeping three.js off phones; admin form pages
~1.96 MB → ~0.90 MB by splitting AG Grid behind `next/dynamic`).

---

## 12. Verification: how to check your work

```bash
npx tsc --noEmit                                  # must be clean
npm run lint                                      # 0 errors; 4 known warnings
BASE_URL=http://localhost:3000 npx tsx scripts/e2e-test.ts
```

`scripts/e2e-test.ts` is the real safety net: routing/auth gates, cross-role
session isolation, customer data flows, admin panel, controller API, SSH terminal
auth, and the schema-ownership guard. It namespaces everything it creates with
`E2E_PREFIX` and tears down on failure, so it is safe to re-run against a dev DB.

**Known-good baselines at the time of writing:**
- `tsc`: clean *except* a pre-existing break in `components/layouts/header.tsx`
  introduced by an in-flight user edit (see §13).
- `lint`: 0 errors, 4 warnings (unused vars in
  `dashboard/settings/settings-client.tsx`, `website/contact-section.tsx`,
  `website/hero-section.tsx`, `lib/controller-client.ts`).
- `e2e-test.ts`: **84/84** with the Python controller offline;
  **125/125** with it running.

### Admin accounts
```bash
npm run admin:list
npm run admin:create -- <email> <password> "<name>"
npm run admin:delete -- <email>
```
Create a throwaway admin for browser testing and **delete it afterwards**.
Do not guess the real admin's password.

### Browser testing
Playwright is used directly from the scratchpad (not a configured suite).
Traps hit repeatedly in this session, worth remembering:
- `[role="alert"]` also matches Next's **route announcer** — scope to `form [role="alert"]`.
- `button[type="submit"]` also matches the sidebar's **Log out** button.
- `page.fill()` on a controlled formatted input can expose real caret bugs —
  when it behaves oddly, suspect the component before the harness.
- Screenshotting a live WebGL canvas needs `preserveDrawingBuffer`.

---

## 13. Open items / known issues

1. **`components/layouts/header.tsx` does not typecheck.**
   `productLinks` now has a single entry whose `status` is `null`, so inside
   `{link.status && …}` TypeScript narrows `link` itself to `never` and line 107
   errors. Fix by annotating the array:
   ```ts
   const productLinks: { name: string; href: string; desc: string; status: string | null }[] = [
   ```
   This came from a user edit in progress and was deliberately not touched.

2. **The landing page's plans section is empty.** Hiding `unity_commerce` from
   the landing removed the only product with active plans (`algo_suite` has none).

3. **UnityCommerce hero/theme artwork is placeholder.** Swap each
   `<ImagePlaceholder>` for an `<Image>` and delete the component — it is local
   to `client.tsx` for exactly that reason. The old real screenshots still exist
   at `public/images/unitycommerce/`.

4. **Not started / offered:** incoming mail (IMAP fetch loop, storage, mailbox
   UI); row editing in the database browser; deleting ~3.3 MB of verified-dead
   public assets; profiling the hero's main-thread blocking on real hardware;
   adopting `AdminDynamicForm` for the remaining hand-written admin forms.

5. **Deferred by plan:** the query-console (arbitrary SQL) hardening pass;
   production DB target and hosting topology were explicitly left undecided.

---

## 14. Gotchas that cost time in this session

- Drizzle has no generate step, so the dev server never holds a stale client after a schema change.
- **`'use server'` files may only export async functions.** Move constants to `lib/`.
- **`alembic.ini` had a hardcoded `sqlalchemy.url`** on the wrong port with a
  plaintext password. `env.py` now reads `DATABASE_URL`. Do not reintroduce it.
- **The controller has a `writable_fields` whitelist** on its update endpoint —
  adding a column is not enough to make it settable.
- **Float precision causes hydration mismatches.** The browser truncates a style
  attribute to 6 significant digits; `.toFixed(2)` any animated inline value.
  Prefer `backgroundColor` over the `background` shorthand.
- **Do not overwrite an untracked file with `cat >` without reading it first.**
  This clobbered an existing `lib/admin-session.ts`.
- **Measure before optimising, and revert changes that do not measure.**
  Deferring the 3D mount past first paint produced no LCP improvement and was
  reverted rather than kept.
