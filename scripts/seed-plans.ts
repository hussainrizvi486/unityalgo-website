import 'dotenv/config';
import { PrismaClient, type PriceUnit, type AddOnPricingType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Placeholder pricing — the source brief only gave "$X" placeholders for
// most tiers. Edit real numbers afterwards from /admin/plans and
// /admin/addons; this script is safe to re-run (upserts on productId+slug).
interface PlanSeed {
  productId: string;
  name: string;
  slug: string;
  tagline: string;
  priceUnit: PriceUnit;
  priceAmount: number | null;
  transactionFeePercent: number | null;
  userLimit: number | null;
  features: string[];
  sortOrder: number;
}

interface AddOnSeed {
  productId: string;
  name: string;
  slug: string;
  description: string;
  pricingType: AddOnPricingType;
  priceAmount: number | null;
  sortOrder: number;
}

const plans: PlanSeed[] = [
  {
    productId: 'algo_suite',
    name: 'Starter',
    slug: 'starter',
    tagline: 'Small businesses, single location',
    priceUnit: 'PER_USER_MONTHLY',
    priceAmount: 29,
    transactionFeePercent: null,
    userLimit: 5,
    features: ['Accounting + Inventory (core only)', 'Email support, business hours'],
    sortOrder: 0,
  },
  {
    productId: 'algo_suite',
    name: 'Growth',
    slug: 'growth',
    tagline: 'Growing SMBs, multi-department',
    priceUnit: 'PER_USER_MONTHLY',
    priceAmount: 49,
    transactionFeePercent: null,
    userLimit: 25,
    features: ['Accounting + HR + Inventory + CRM', 'Priority email + chat support'],
    sortOrder: 1,
  },
  {
    productId: 'algo_suite',
    name: 'Enterprise',
    slug: 'enterprise',
    tagline: 'Larger orgs, healthcare/complex ops',
    priceUnit: 'PER_USER_MONTHLY',
    priceAmount: null,
    transactionFeePercent: null,
    userLimit: null,
    features: ['Full suite + custom module access', 'Dedicated account manager, SLA-backed support'],
    sortOrder: 2,
  },
  {
    productId: 'unity_commerce',
    name: 'Launch',
    slug: 'launch',
    tagline: 'New/small stores',
    priceUnit: 'FLAT_MONTHLY',
    priceAmount: 49,
    transactionFeePercent: 2,
    userLimit: null,
    features: ['1 store', 'Standard themes', 'Basic checkout'],
    sortOrder: 0,
  },
  {
    productId: 'unity_commerce',
    name: 'Scale',
    slug: 'scale',
    tagline: 'Established stores',
    priceUnit: 'FLAT_MONTHLY',
    priceAmount: 99,
    transactionFeePercent: 1,
    userLimit: null,
    features: ['Multiple themes', 'Custom domain', 'Abandoned cart tools'],
    sortOrder: 1,
  },
  {
    productId: 'unity_commerce',
    name: 'Enterprise',
    slug: 'enterprise',
    tagline: 'High-volume/multi-brand',
    priceUnit: 'FLAT_MONTHLY',
    priceAmount: null,
    transactionFeePercent: null,
    userLimit: null,
    features: ['Custom checkout flows', 'API access', 'White-label options'],
    sortOrder: 2,
  },
];

const addOns: AddOnSeed[] = [
  {
    productId: 'algo_suite',
    name: 'Custom module development',
    slug: 'custom-module-development',
    description: 'Bespoke module work from the ERP Customization service — scoped per project, not a recurring subscription.',
    pricingType: 'ONE_TIME',
    priceAmount: null,
    sortOrder: 0,
  },
  {
    productId: 'algo_suite',
    name: 'Healthcare compliance pack',
    slug: 'healthcare-compliance-pack',
    description: 'Healthcare-specific compliance and workflow pack.',
    pricingType: 'FLAT_MONTHLY',
    priceAmount: 99,
    sortOrder: 1,
  },
  {
    productId: 'algo_suite',
    name: 'Advanced reporting & BI dashboard',
    slug: 'advanced-reporting-bi-dashboard',
    description: 'Advanced reporting and BI dashboard on top of your existing modules.',
    pricingType: 'FLAT_MONTHLY',
    priceAmount: 59,
    sortOrder: 2,
  },
  {
    productId: 'algo_suite',
    name: 'Data migration & onboarding',
    slug: 'data-migration-onboarding',
    description: 'One-time guided data migration and onboarding.',
    pricingType: 'ONE_TIME',
    priceAmount: 499,
    sortOrder: 3,
  },
];

async function main() {
  for (const plan of plans) {
    const { productId, slug, ...data } = plan;
    await prisma.plan.upsert({
      where: { productId_slug: { productId, slug } },
      update: data,
      create: { productId, slug, ...data },
    });
    console.log(`Plan ready: ${plan.productId} / ${plan.name}`);
  }

  for (const addOn of addOns) {
    const { productId, slug, ...data } = addOn;
    await prisma.addOn.upsert({
      where: { productId_slug: { productId, slug } },
      update: data,
      create: { productId, slug, ...data },
    });
    console.log(`Add-on ready: ${addOn.productId} / ${addOn.name}`);
  }
}

main()
  .catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
