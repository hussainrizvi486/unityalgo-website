'use client';

import * as React from 'react';
import Link from 'next/link';
import type { ICellRendererParams } from 'ag-grid-community';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AvatarInitials } from '@/components/admin/avatar-initials';
import { DeleteButton } from '@/components/admin/delete-button';
import { cn } from '@/utils';

/** Renderer props: AG Grid's own, plus the accessor the column supplies. */
type CellProps<Row, Value> = ICellRendererParams<Row> & { get: (row: Row) => Value };

const CELL = 'flex h-full flex-col justify-center min-w-0 py-2 leading-normal';

// ---------------------------------------------------------------- text cells

export interface StackedValue {
    primary: React.ReactNode;
    secondary?: React.ReactNode;
    /** Turns the primary line into a link. */
    href?: string;
}

export function StackedCell<Row>({ data, get }: CellProps<Row, StackedValue | null>) {
    if (!data) return null;
    const value = get(data);
    if (!value) return null;
    const { primary, secondary, href } = value;
    return (
        <div className={CELL}>
            <div className="truncate portal-text-body font-medium text-foreground">
                {href ? (
                    <Link href={href} className="hover:text-primary hover:underline">{primary}</Link>
                ) : (
                    primary
                )}
            </div>
            {secondary != null && secondary !== '' && (
                <div className="truncate portal-text-caption text-muted-foreground">{secondary}</div>
            )}
        </div>
    );
}

/** Like StackedCell, but leading with the round initials avatar. */
export function AvatarCell<Row>({ data, get }: CellProps<Row, StackedValue | null>) {
    if (!data) return null;
    const value = get(data);
    if (!value) return null;
    const { primary, secondary, href } = value;
    return (
        <div className="flex h-full items-center gap-3 min-w-0 leading-normal">
            <AvatarInitials name={typeof primary === 'string' ? primary : ''} />
            <div className="min-w-0">
                <div className="truncate portal-text-body font-medium text-foreground">
                    {href ? (
                        <Link href={href} className="hover:text-primary hover:underline">{primary}</Link>
                    ) : (
                        primary
                    )}
                </div>
                {secondary != null && secondary !== '' && (
                    <div className="truncate portal-text-caption text-muted-foreground">{secondary}</div>
                )}
            </div>
        </div>
    );
}

export function MutedCell({ value }: ICellRendererParams) {
    return (
        <div className={cn(CELL, 'text-foreground/70')}>
            <span className="truncate">{value}</span>
        </div>
    );
}

/** Multi-line text, clamped so a long message cannot stretch the row. */
export function ClampedCell({ value }: ICellRendererParams) {
    return (
        <div className={cn(CELL, 'text-foreground/70')}>
            <p className="line-clamp-2 whitespace-normal leading-snug">{value}</p>
        </div>
    );
}

// --------------------------------------------------------------- badge cells

type BadgeVariant = 'neutral' | 'success' | 'info' | 'warning' | 'error' | 'brand';

export interface BadgeValue {
    label: string;
    variant?: BadgeVariant;
    /** Second badge on the same row, e.g. "default" next to a status. */
    extra?: { label: string; variant?: BadgeVariant };
    dot?: boolean;
}

export function BadgeCell<Row>({ data, get }: CellProps<Row, BadgeValue | null>) {
    if (!data) return null;
    const value = get(data);
    if (!value) return null;
    return (
        <div className="flex h-full flex-wrap items-center gap-1.5">
            <Badge variant={value.variant ?? 'neutral'} dot={value.dot}>{value.label}</Badge>
            {value.extra && (
                <Badge variant={value.extra.variant ?? 'neutral'} dot={false}>{value.extra.label}</Badge>
            )}
        </div>
    );
}

// -------------------------------------------------------------- action cells

export interface RowAction {
    label: string;
    href: string;
    /** `outline` is the default; use `solid` for the row's primary action. */
    tone?: 'outline' | 'solid';
}

export interface DeleteAction {
    /** Server action; DeleteButton posts the id as a hidden form field. */
    action: (formData: FormData) => void | Promise<void>;
    id: string;
    title: string;
    description: string;
    disabled?: boolean;
}

/** A button that posts to a server action rather than navigating. */
export interface SubmitAction {
    label: string;
    action: (formData: FormData) => void | Promise<void>;
    /** Posted as the hidden `id` field, matching the panel's other forms. */
    id: string;
}

export interface ActionsValue {
    /** Rendered before the buttons, e.g. a status badge. */
    badge?: BadgeValue;
    actions?: RowAction[];
    submits?: SubmitAction[];
    remove?: DeleteAction;
}

export function ActionsCell<Row>({ data, get }: CellProps<Row, ActionsValue | null>) {
    if (!data) return null;
    const value = get(data);
    if (!value) return null;
    return (
        <div className="flex h-full items-center justify-end gap-2">
            {value.badge && (
                <Badge variant={value.badge.variant ?? 'neutral'} dot={value.badge.dot}>
                    {value.badge.label}
                </Badge>
            )}
            {value.actions?.map((action) => (
                <Button asChild key={action.label}
                        size="sm"
                        variant={action.tone === 'solid' ? 'default' : 'outline'}
                        className={cn(
                            action.tone === 'solid' && 'bg-primary text-primary-foreground hover:bg-primary/90',
                        )}
                    ><Link href={action.href}>
                        {action.label}
                    </Link></Button>
            ))}
            {value.submits?.map((submit) => (
                <form key={submit.label} action={submit.action}>
                    <input type="hidden" name="id" value={submit.id} />
                    <Button type="submit" size="sm" variant="outline" >
                        {submit.label}
                    </Button>
                </form>
            ))}
            {value.remove && (
                <DeleteButton
                    action={value.remove.action}
                    id={value.remove.id}
                    title={value.remove.title}
                    description={value.remove.description}
                    disabled={value.remove.disabled}
                />
            )}
        </div>
    );
}
