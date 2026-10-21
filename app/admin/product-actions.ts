'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, errorText, one, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import type { AdminFormState } from '@/components/admin/dynamic-form';
import { slugify } from '@/lib/slug';

function readFields(formData: FormData) {
    const label = String(formData.get('label') ?? '').trim();
    return {
        label,
        slug: slugify(String(formData.get('slug') ?? '') || label),
        tagline: String(formData.get('tagline') ?? '').trim() || null,
        isActive: formData.get('isActive') === 'on',
        showOnLanding: formData.get('showOnLanding') === 'on',
        sortOrder: Number.parseInt(String(formData.get('sortOrder') ?? '0'), 10) || 0,
    };
}

function validate(fields: ReturnType<typeof readFields>) {
    if (!fields.label || fields.label.length > 100) return 'Enter a product name of up to 100 characters.';
    if (!/^[a-z][a-z0-9-]{1,60}$/.test(fields.slug)) return 'The slug must start with a letter and use only lowercase letters, numbers and hyphens.';
    if (fields.tagline && fields.tagline.length > 200) return 'The tagline can be up to 200 characters.';
    return null;
}

function friendly(error: unknown) {
    return errorText(error).includes('Product_slug_key')
        ? 'A product with that slug already exists.'
        : 'Could not save the product. Check the values and try again.';
}

function refresh() {
    revalidatePath('/admin/products');
    revalidatePath('/admin/plans');
    revalidatePath('/dashboard/plans');
    revalidatePath('/');
}

export async function createProductAction(_prev: AdminFormState | undefined, formData: FormData): Promise<AdminFormState> {
    await requireAdmin();
    const fields = readFields(formData);
    const invalid = validate(fields);
    if (invalid) return { error: invalid };
    try {
        // Plans, add-ons and subscriptions reference a product by id, so the id is the slug and never changes.
        await db.insert(schema.product).values({ id: fields.slug, ...fields });
    } catch (error) {
        return { error: errorText(error).includes('Product_pkey') ? 'A product with that slug already exists.' : friendly(error) };
    }
    refresh();
    redirect('/admin/products');
}

export async function updateProductAction(_prev: AdminFormState | undefined, formData: FormData): Promise<AdminFormState> {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    if (!id) return { error: 'Missing product id.' };
    const fields = readFields(formData);
    const invalid = validate(fields);
    if (invalid) return { error: invalid };
    try {
        one(await db.update(schema.product).set(fields).where(eq(schema.product.id, id)).returning({ id: schema.product.id }), 'Product');
    } catch (error) {
        return { error: friendly(error) };
    }
    refresh();
    redirect('/admin/products');
}

export async function deleteProductAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    if (!id) return;
    const [plans, addOns, subscriptions] = await Promise.all([
        db.$count(schema.plan, eq(schema.plan.productId, id)),
        db.$count(schema.addOn, eq(schema.addOn.productId, id)),
        db.$count(schema.subscription, eq(schema.subscription.productId, id)),
    ]);
    if (plans || addOns || subscriptions) {
        const parts = [plans && `${plans} plan${plans === 1 ? '' : 's'}`, addOns && `${addOns} add-on${addOns === 1 ? '' : 's'}`, subscriptions && `${subscriptions} subscription${subscriptions === 1 ? '' : 's'}`].filter(Boolean);
        redirect('/admin/products?error=' + encodeURIComponent(`This product is still used by ${parts.join(', ')}. Disable it instead.`));
    }
    await db.delete(schema.product).where(eq(schema.product.id, id));
    refresh();
}

export async function toggleProductActiveAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    const product = id ? await db.query.product.findFirst({ where: eq(schema.product.id, id) }) : null;
    if (!product) return;
    await db.update(schema.product).set({ isActive: !product.isActive }).where(eq(schema.product.id, id));
    refresh();
}
