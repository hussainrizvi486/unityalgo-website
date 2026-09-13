'use client';

import * as React from 'react';
import Link from 'next/link';
import type { ICellRendererParams } from 'ag-grid-community';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AvatarInitials } from '@/components/admin/avatar-initials';
import { DeleteButton } from '@/components/admin/delete-button';
import { cn } from '@/utils';

/**
 * Cell renderers shared by every admin list.
 *
 * These exist so a page can describe *what* a column holds — a title with a
 * subtitle under it, a status badge, a row's actions — instead of repeating
 * the same flex/truncate/text-size markup ten times. Each is a thin wrapper
 * over the primitives already used elsewhere in the panel (Badge, Button,
 * DeleteButton, AvatarInitials), so the grid inherits the panel's look rather
 * than introducing a second one.
 *
 * Every renderer reads its content from `get(row)` rather than from AG Grid's
 * `value`. That keeps the two jobs separate: `valueGetter` returns plain text
 * for sorting and the quick filter, while `get` returns the rich object to
 * draw. Sorting on a React element, or searching one, would not work.
 */

/** Renderer props: AG Grid's own, plus the accessor the column supplies. */
type CellProps<Row, Value> = ICellRendererParams<Row> & { get: (row: Row) => Value };

/**
 * Vertically centres cell content; AG Grid cells are flex containers.
 *
 * `leading-normal` is load-bearing. AG Grid sets `line-height` on `.ag-cell` to
 * the row height (57px) so that a single line of plain text centres itself
 * vertically. Any text in here that does not set its own line-height inherits
 * that, so a two-line cell needs 114px inside a 57px box and the second line is
 * clipped by the cell's `overflow: hidden`. Resetting it here is what lets a
 * title sit above a subtitle.
 */
const CELL = 'flex h-full flex-col justify-center min-w-0 py-2 leading-normal';

// ---------------------------------------------------------------- text cells

export interface StackedValue {
    primary: React.ReactNode;
    secondary?: React.ReactNode;
    /** Turns the primary line into a link. */
    href?: string;
}

/**
 * A prominent first line with a dimmer second line under it — the panel's most
 * common cell (name over email, slug over date, plan over status).
 */
export function StackedCell<Row>({ data, get }: CellProps<Row, StackedValue | null>) {
    if (!data) return null;
    const value = get(data);
    if (!value) return null;
    const { primary, secondary, href } = value;
    return (
        <div className={CELL}>
            <div className="truncate text-sm font-medium text-ink-900">
                {href ? (
                    <Link href={href} className="hover:text-link hover:underline">{primary}</Link>
                ) : (
                    primary
                )}
            </div>
            {secondary != null && secondary !== '' && (
                <div className="truncate text-xs text-ink-400">{secondary}</div>
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
                <div className="truncate text-sm font-medium text-ink-900">
                    {href ? (
                        <Link href={href} className="hover:text-link hover:underline">{primary}</Link>
                    ) : (
                        primary
                    )}
                </div>
                {secondary != null && secondary !== '' && (
                    <div className="truncate text-xs text-ink-400">{secondary}</div>
                )}
            </div>
        </div>
    );
}

/**
 * Plain secondary text, truncated to one line.
 *
 * Needs no accessor — it renders AG Grid's own `value`, so a column using it
 * only has to supply a `valueGetter`.
 */
export function MutedCell({ value }: ICellRendererParams) {
    return (
        <div className={cn(CELL, 'text-ink-600')}>
            <span className="truncate">{value}</span>
        </div>
    );
}

/** Multi-line text, clamped so a long message cannot stretch the row. */
export function ClampedCell({ value }: ICellRendererParams) {
    return (
        <div className={cn(CELL, 'text-ink-600')}>
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

/**
 * The trailing column: an optional badge, link buttons, and a delete control.
 *
 * Pinned right by the pages that use it, so it stays reachable when the grid
 * scrolls horizontally on a narrow screen.
 */
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
                <Link key={action.label} href={action.href}>
                    <Button
                        size="sm"
                        variant={action.tone === 'solid' ? 'default' : 'outline'}
                        className={cn(
                            action.tone === 'solid' && 'bg-ink-900 text-white hover:bg-ink-800',
                        )}
                    >
                        {action.label}
                    </Button>
                </Link>
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
