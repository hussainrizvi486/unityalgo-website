'use client';

import { Notice } from '@/components/ui/notice';
import * as React from 'react';
import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SmartInput } from '@/components/ui/smart-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { cn } from '@/utils';

/**
 * An admin form described by an array instead of written out in JSX.
 *
 * Every admin form here was a hand-written block of markup, so the same label,
 * spacing and error handling was reimplemented per screen and drifted between
 * them. A form is now a list of fields, and this renders it.
 *
 * The layout markers — tab, section, column — are breaks rather than
 * containers, which is how ERP form builders describe a layout and how anyone
 * coming from one will expect to write it: fields belong to whichever break
 * last preceded them. `buildLayout` turns that flat list into the nesting the
 * markup needs, so a caller never has to close anything.
 */

interface FieldBase {
    name: string;
    label: string;
    /** Sits under the control. Use for a constraint the label cannot carry. */
    help?: React.ReactNode;
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
    /** Ignore the enclosing columns and run the full width of the section. */
    fullWidth?: boolean;
}

export type AdminFormField =
    | { type: 'tab'; label: string }
    | { type: 'section'; label?: string; description?: string }
    | { type: 'column' }
    | (FieldBase & {
        type: 'text' | 'email' | 'url' | 'password' | 'date';
        defaultValue?: string | number;
    })
    // Numeric kinds all render the same text field; only the formatting and
    // the character filtering differ. See components/ui/smart-input.tsx.
    | (FieldBase & {
        type: 'number' | 'integer' | 'decimal' | 'currency' | 'percent';
        defaultValue?: string | number | null;
        min?: number;
        max?: number;
        decimals?: number;
        allowNegative?: boolean;
        /** Currency pattern and symbol, for `currency`. */
        numberFormat?: string | null;
        symbol?: string | null;
    })
    | (FieldBase & { type: 'textarea'; defaultValue?: string; rows?: number })
    | (FieldBase & {
        type: 'select';
        defaultValue?: string;
        options: { value: string; label: string }[];
    })
    | (FieldBase & { type: 'checkbox'; defaultChecked?: boolean });

export interface AdminFormState {
    error?: string;
    success?: string;
}

type Column = { fields: AdminFormField[] };
type Section = { label?: string; description?: string; columns: Column[] };
type Tab = { label: string; sections: Section[] };

/**
 * Turns the flat list of fields and breaks into tabs → sections → columns.
 *
 * A form with no breaks at all still produces one tab, one section and one
 * column, so the simple case needs no ceremony from the caller.
 */
function buildLayout(fields: AdminFormField[]): Tab[] {
    const tabs: Tab[] = [];
    let tab: Tab | null = null;
    let section: Section | null = null;
    let column: Column | null = null;

    const openTab = (label: string) => {
        tab = { label, sections: [] };
        tabs.push(tab);
        section = null;
        column = null;
    };
    const openSection = (label?: string, description?: string) => {
        if (!tab) openTab('');
        section = { label, description, columns: [] };
        tab!.sections.push(section);
        column = null;
    };
    const openColumn = () => {
        if (!section) openSection();
        column = { fields: [] };
        section!.columns.push(column);
    };

    for (const field of fields) {
        if (field.type === 'tab') { openTab(field.label); continue; }
        if (field.type === 'section') { openSection(field.label, field.description); continue; }
        if (field.type === 'column') { openColumn(); continue; }
        if (!column) openColumn();
        column!.fields.push(field);
    }
    return tabs;
}

function FieldControl({ field }: { field: AdminFormField }) {
    if (field.type === 'tab' || field.type === 'section' || field.type === 'column') return null;

    const id = `field-${field.name}`;

    if (field.type === 'checkbox') {
        return (
            <label htmlFor={id} className="flex items-start gap-2.5 portal-text-body text-foreground/80">
                <Checkbox
                    id={id}
                    name={field.name}
                    defaultChecked={field.defaultChecked}
                    disabled={field.disabled}
                    className="mt-0.5"
                />
                <span>
                    {field.label}
                    {field.help ? <span className="block portal-text-caption text-muted-foreground">{field.help}</span> : null}
                </span>
            </label>
        );
    }

    return (
        <div className={cn(field.fullWidth && 'md:col-span-full')}>
            <Label htmlFor={id} className="mb-1.5 portal-text-body text-foreground/80">
                {field.label}
                {!field.required ? <span className="ml-1 font-normal text-muted-foreground">(optional)</span> : null}
            </Label>

            {field.type === 'textarea' ? (
                <Textarea
                    id={id}
                    name={field.name}
                    rows={field.rows ?? 4}
                    required={field.required}
                    disabled={field.disabled}
                    placeholder={field.placeholder}
                    defaultValue={field.defaultValue}
                />
            ) : field.type === 'number' || field.type === 'integer' || field.type === 'decimal'
                || field.type === 'currency' || field.type === 'percent' ? (
                <SmartInput
                    id={id}
                    name={field.name}
                    // `number` is the loose alias; it behaves as a decimal.
                    kind={field.type === 'number' ? 'decimal' : field.type}
                    defaultValue={field.defaultValue}
                    numberFormat={field.numberFormat}
                    symbol={field.symbol}
                    decimals={field.decimals}
                    allowNegative={field.allowNegative}
                    min={field.min}
                    max={field.max}
                    required={field.required}
                    disabled={field.disabled}
                    placeholder={field.placeholder}
                />
            ) : field.type === 'select' ? (
                <Select name={field.name} defaultValue={field.defaultValue} disabled={field.disabled}>
                    <SelectTrigger id={id}><SelectValue placeholder={field.placeholder} /></SelectTrigger>
                    <SelectContent>
                        {field.options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            ) : (
                <Input
                    id={id}
                    name={field.name}
                    type={field.type}
                    required={field.required}
                    disabled={field.disabled}
                    placeholder={field.placeholder}
                    // ?? undefined: a null default means "no value", and React
                    // treats null on defaultValue as an uncontrolled reset.
                    defaultValue={field.defaultValue ?? undefined}
                />
            )}

            {field.help ? <p className="mt-1.5 portal-text-caption text-muted-foreground">{field.help}</p> : null}
        </div>
    );
}

function SectionBlock({ section }: { section: Section }) {
    return (
        <section className="portal-fields border-t border-border pt-7 first:border-0 first:pt-0">
            {section.label || section.description ? (
                <div>
                    {section.label ? (
                        <h2 className="portal-text-body text-foreground">{section.label}</h2>
                    ) : null}
                    {section.description ? (
                        <p className="mt-1 portal-text-caption text-muted-foreground">{section.description}</p>
                    ) : null}
                </div>
            ) : null}
            <div
                className="grid gap-gap-lg"
                // Column count comes from how many breaks the caller wrote, so
                // a two-column section and a four-column one need no extra prop.
                style={{ ['--cols' as string]: section.columns.length }}
            >
                <div className={cn('grid gap-gap-lg', section.columns.length > 1 && 'md:grid-cols-[repeat(var(--cols),minmax(0,1fr))]')}>
                    {section.columns.map((column, i) => (
                        <div key={i} className="portal-fields">
                            {column.fields.map((field) => (
                                <FieldControl key={('name' in field && field.name) || i} field={field} />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="">
            {pending ? 'Saving…' : label}
        </Button>
    );
}

export function AdminDynamicForm({
    fields,
    action,
    submitLabel,
    cancelHref,
    hidden,
    children,
}: {
    fields: AdminFormField[];
    action: (prev: AdminFormState | undefined, formData: FormData) => Promise<AdminFormState>;
    submitLabel: string;
    cancelHref: string;
    /** Values posted with the form but never shown, such as the record id. */
    hidden?: Record<string, string | undefined>;
    /** Extra controls beside the submit button, e.g. a Sync action. */
    children?: React.ReactNode;
}) {
    const [state, formAction] = useActionState(action, undefined);
    const tabs = React.useMemo(() => buildLayout(fields), [fields]);
    const tabbed = tabs.length > 1 || Boolean(tabs[0]?.label);

    const body = tabbed ? (
        <Tabs defaultValue={tabs[0]?.label ?? '0'}>
            <TabsList className="mb-6">
                {tabs.map((tab) => (
                    <TabsTrigger key={tab.label} value={tab.label}>{tab.label}</TabsTrigger>
                ))}
            </TabsList>
            {tabs.map((tab) => (
                <TabsContent key={tab.label} value={tab.label} className="space-y-7">
                    {tab.sections.map((section, i) => <SectionBlock key={i} section={section} />)}
                </TabsContent>
            ))}
        </Tabs>
    ) : (
        <div className="space-y-7">
            {tabs[0]?.sections.map((section, i) => <SectionBlock key={i} section={section} />)}
        </div>
    );

    return (
        <form action={formAction} className="portal-detail space-y-gap-xl">
            {Object.entries(hidden ?? {}).map(([name, value]) =>
                value === undefined ? null : <input key={name} type="hidden" name={name} value={value} />,
            )}

            {state?.error ? (
                <Notice tone="error">{state.error}</Notice>
            ) : null}
            {state?.success ? (
                <Notice tone="success">{state.success}</Notice>
            ) : null}

            {body}

            <div className="flex items-center gap-3 border-t border-border pt-6">
                <SubmitButton label={submitLabel} />
                <Button asChild type="button" variant="outline"><Link href={cancelHref}>Cancel</Link></Button>
                {children}
            </div>
        </form>
    );
}
