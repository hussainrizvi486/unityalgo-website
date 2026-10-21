import type { AdminFormField } from '@/components/admin/dynamic-form';

export function productFormFields(values?: {
    label?: string;
    slug?: string;
    tagline?: string | null;
    isActive?: boolean;
    showOnLanding?: boolean;
    sortOrder?: number;
}, editing = false): AdminFormField[] {
    return [
        { type: 'section', label: 'Product', description: 'What customers see when choosing a plan.' },
        { type: 'column' },
        { type: 'text', name: 'label', label: 'Name', required: true, defaultValue: values?.label, placeholder: 'AlgoSuite' },
        {
            type: 'text', name: 'slug', label: 'Slug', defaultValue: values?.slug, placeholder: 'algosuite',
            help: editing
                ? 'Used in page addresses. Plans and subscriptions keep pointing at this product when it changes.'
                : 'Lowercase letters, numbers and hyphens. Also becomes the product id, so it cannot be changed later. Taken from the name when left blank.',
        },
        { type: 'column' },
        { type: 'text', name: 'tagline', label: 'Tagline', defaultValue: values?.tagline ?? '', placeholder: 'ERP hosting without the setup' },
        { type: 'number', name: 'sortOrder', label: 'Display order', defaultValue: values?.sortOrder ?? 0, min: 0, help: 'Lower numbers appear first.' },
        { type: 'section', label: 'Visibility' },
        {
            type: 'checkbox', name: 'isActive', label: 'Active', defaultChecked: values?.isActive ?? true,
            help: 'Inactive products are hidden from customers and cannot get new plans.',
        },
        {
            type: 'checkbox', name: 'showOnLanding', label: 'Show on the website', defaultChecked: values?.showOnLanding ?? true,
            help: 'Lists the product and its plans in the public pricing section.',
        },
    ];
}
