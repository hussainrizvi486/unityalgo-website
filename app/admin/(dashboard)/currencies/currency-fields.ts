import type { AdminFormField } from '@/components/admin/dynamic-form';
import { NUMBER_FORMATS } from '@/lib/currency';

/**
 * The currency form, as data.
 *
 * One definition drives both the new and edit screens, so the two cannot drift.
 * `tab`, `section` and `column` are breaks: every field after one belongs to it.
 */
export function currencyFormFields(values?: {
    code?: string;
    name?: string;
    symbol?: string;
    numberFormat?: string;
    isActive?: boolean;
    sortOrder?: number;
}): AdminFormField[] {
    return [
        { type: 'section', label: 'Identity', description: 'How this currency is named and written.' },
        { type: 'column' },
        {
            type: 'text', name: 'code', label: 'Code', required: true,
            defaultValue: values?.code, placeholder: 'USD',
            help: 'Three to eight letters. Uppercased on save.',
        },
        {
            type: 'text', name: 'symbol', label: 'Symbol', required: true,
            defaultValue: values?.symbol, placeholder: '$',
        },
        { type: 'column' },
        {
            type: 'text', name: 'name', label: 'Currency name', required: true,
            defaultValue: values?.name, placeholder: 'US Dollar',
        },
        {
            type: 'number', name: 'sortOrder', label: 'Display order',
            defaultValue: values?.sortOrder ?? 0, min: 0,
            help: 'Lower numbers appear first in pickers.',
        },

        { type: 'section', label: 'Formatting', description: 'How amounts are grouped and punctuated.' },
        {
            type: 'select', name: 'numberFormat', label: 'Number format', required: true,
            defaultValue: values?.numberFormat ?? NUMBER_FORMATS[0],
            fullWidth: true,
            options: [
                { value: '#,###.##', label: '#,###.##  —  1,234,567.89 (thousands)' },
                { value: '#,##,###.##', label: '#,##,###.##  —  12,34,567.89 (lakh/crore)' },
                { value: '####.##', label: '####.##  —  1234567.89 (no grouping)' },
                { value: '#.###,##', label: '#.###,##  —  1.234.567,89 (European)' },
            ],
        },

        { type: 'section', label: 'Status' },
        {
            type: 'checkbox', name: 'isActive', label: 'Enabled',
            defaultChecked: values?.isActive ?? true,
            help: 'A disabled currency stays on any plan already using it, but cannot be chosen for new ones.',
        },
    ];
}
