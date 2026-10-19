'use client';

import * as React from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/utils';

export interface AutocompleteOption {
    value: string;
    label: string;
    /** Second line in the list. Use for the detail that tells similar options apart. */
    description?: string;
    /** Shown before the label, in the list and on the trigger: a flag, a symbol, an avatar. */
    icon?: React.ReactNode;
    /** Extra words the search also matches, such as a code or an old name. */
    keywords?: string[];
    disabled?: boolean;
}

export interface AutocompleteProps {
    options: AutocompleteOption[];
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    /** Posts the chosen value in a form. */
    name?: string;
    id?: string;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
    disabled?: boolean;
    required?: boolean;
    invalid?: boolean;
    /** Adds a button that empties the choice. */
    clearable?: boolean;
    /** Rows shown before the list scrolls. The panel never grows past this, however many options there are. */
    maxVisibleRows?: number;
    className?: string;
    'aria-label'?: string;
}

const OVERSCAN = 6;

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

interface Indexed {
    option: AutocompleteOption;
    text: string;
    label: string;
}

/** Options matching `query`, best first: a label that starts with it, then a word that does, then anywhere. */
function search(items: Indexed[], query: string): AutocompleteOption[] {
    const needle = fold(query);
    if (!needle) return items.map((item) => item.option);
    const scored: [number, number, AutocompleteOption][] = [];
    items.forEach((item, position) => {
        const at = item.text.indexOf(needle);
        if (at === -1) return;
        const score = item.label.startsWith(needle) ? 0 : item.label.includes(` ${needle}`) ? 1 : at === 0 ? 2 : 3;
        scored.push([score, position, item.option]);
    });
    return scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, , option]) => option);
}

/**
 * A Select with search, for lists too long to scan. Opens a panel with a search box and a list that only renders the rows
 * in view, so thousands of options stay fast. The panel keeps one height, and the mouse wheel, arrow keys, Page Up and
 * Page Down, Home and End all move through it.
 */
export function Autocomplete({
    options,
    value: controlled,
    defaultValue = '',
    onValueChange,
    name,
    id,
    placeholder = 'Select…',
    searchPlaceholder = 'Search…',
    emptyMessage = 'No matches.',
    disabled,
    required,
    invalid,
    clearable,
    maxVisibleRows = 8,
    className,
    'aria-label': ariaLabel,
}: AutocompleteProps) {
    const uid = React.useId();
    const listId = `${uid}-list`;
    const [inner, setInner] = React.useState(defaultValue);
    const value = controlled ?? inner;
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const [active, setActive] = React.useState(0);
    const [scrollTop, setScrollTop] = React.useState(0);
    const [rowHeight, setRowHeight] = React.useState(36);
    const listRef = React.useRef<HTMLDivElement>(null);
    const triggerRef = React.useRef<HTMLButtonElement>(null);

    const indexed = React.useMemo<Indexed[]>(
        () => options.map((option) => ({
            option,
            label: fold(option.label),
            text: fold([option.label, option.description, option.value, ...(option.keywords ?? [])].filter(Boolean).join(' ')),
        })),
        [options],
    );
    const matches = React.useMemo(() => search(indexed, query), [indexed, query]);
    const hasDescriptions = React.useMemo(() => options.some((option) => option.description), [options]);
    const selected = options.find((option) => option.value === value);

    const rows = Math.min(matches.length, maxVisibleRows);
    const height = rows * rowHeight;
    const activeIndex = matches.length === 0 ? 0 : Math.min(active, matches.length - 1);

    function reveal(index: number) {
        const list = listRef.current;
        if (!list) return;
        const top = index * rowHeight;
        if (top < list.scrollTop) list.scrollTop = top;
        else if (top + rowHeight > list.scrollTop + height) list.scrollTop = top + rowHeight - height;
    }

    function move(to: number) {
        if (matches.length === 0) return;
        let next = Math.max(0, Math.min(matches.length - 1, to));
        // Skip options that cannot be chosen.
        const step = to >= activeIndex ? 1 : -1;
        while (matches[next]?.disabled && next + step >= 0 && next + step < matches.length) next += step;
        setActive(next);
        reveal(next);
    }

    function openPanel(next: boolean) {
        setOpen(next);
        if (next) {
            const at = Math.max(0, options.findIndex((option) => option.value === value));
            setQuery('');
            setActive(at);
            setScrollTop(0);
            requestAnimationFrame(() => {
                const list = listRef.current;
                if (!list) return;
                list.scrollTop = Math.max(0, at * rowHeight - height / 2);
                setScrollTop(list.scrollTop);
            });
        }
    }

    function commit(option: AutocompleteOption | undefined) {
        if (!option || option.disabled) return;
        if (controlled === undefined) setInner(option.value);
        onValueChange?.(option.value);
        setOpen(false);
        triggerRef.current?.focus();
    }

    function clear() {
        if (controlled === undefined) setInner('');
        onValueChange?.('');
        triggerRef.current?.focus();
    }

    function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        const page = Math.max(1, rows - 1);
        switch (event.key) {
            case 'ArrowDown': event.preventDefault(); move(activeIndex + 1); break;
            case 'ArrowUp': event.preventDefault(); move(activeIndex - 1); break;
            case 'PageDown': event.preventDefault(); move(activeIndex + page); break;
            case 'PageUp': event.preventDefault(); move(activeIndex - page); break;
            case 'Home': if (!query) { event.preventDefault(); move(0); } break;
            case 'End': if (!query) { event.preventDefault(); move(matches.length - 1); } break;
            case 'Enter': event.preventDefault(); commit(matches[activeIndex]); break;
        }
    }

    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
    const end = Math.min(matches.length, Math.ceil((scrollTop + height) / rowHeight) + OVERSCAN);
    const rowClass = hasDescriptions ? 'h-12' : 'h-9';

    return (
        <div className={cn('relative', className)}>
            <Popover open={open} onOpenChange={openPanel}>
                <PopoverTrigger asChild>
                    <button
                        ref={triggerRef}
                        id={id}
                        type="button"
                        role="combobox"
                        aria-label={ariaLabel}
                        aria-haspopup="listbox"
                        aria-expanded={open}
                        aria-controls={open ? listId : undefined}
                        aria-invalid={invalid || undefined}
                        aria-required={required || undefined}
                        disabled={disabled}
                        onKeyDown={(event) => {
                            // Typing on the closed field opens the search with that letter already in it.
                            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && event.key !== ' ') {
                                event.preventDefault();
                                openPanel(true);
                                setQuery(event.key);
                            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                                event.preventDefault();
                                openPanel(true);
                            }
                        }}
                        className={cn(
                            'flex w-full min-w-0 items-center justify-between gap-2 border border-input bg-background text-left transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50',
                            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 aria-invalid:border-destructive aria-invalid:ring-destructive/20',
                            'h-9 rounded px-3 text-sm',
                            clearable && selected && 'pr-9',
                        )}
                    >
                        <span className={cn('flex min-w-0 items-center gap-2', !selected && 'text-muted-foreground')}>
                            {selected?.icon}
                            <span className="truncate">{selected?.label ?? placeholder}</span>
                        </span>
                        <ChevronDown className="size-4 shrink-0 opacity-50" />
                    </button>
                </PopoverTrigger>

                <PopoverContent
                    align="start"
                    sideOffset={4}
                    className="w-[var(--radix-popover-trigger-width)] min-w-48 p-0"
                    onCloseAutoFocus={(event) => { event.preventDefault(); triggerRef.current?.focus(); }}
                >
                    <div className="flex items-center gap-2 border-b border-border px-3">
                        <Search className="size-4 shrink-0 text-muted-foreground" />
                        <input
                            autoFocus
                            role="combobox"
                            aria-expanded
                            aria-controls={listId}
                            aria-autocomplete="list"
                            aria-activedescendant={matches[activeIndex] ? `${uid}-opt-${activeIndex}` : undefined}
                            autoComplete="off"
                            spellCheck={false}
                            value={query}
                            placeholder={searchPlaceholder}
                            onChange={(event) => { setQuery(event.target.value); setActive(0); setScrollTop(0); if (listRef.current) listRef.current.scrollTop = 0; }}
                            onKeyDown={onSearchKeyDown}
                            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                    </div>

                    <div ref={(node) => { if (node?.offsetHeight) setRowHeight(node.offsetHeight); }} aria-hidden className={cn('pointer-events-none invisible absolute', rowClass)} />

                    {matches.length === 0 ? (
                        <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
                    ) : (
                        <div
                            ref={listRef}
                            id={listId}
                            role="listbox"
                            aria-label={ariaLabel}
                            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
                            style={{ height }}
                            className="relative overflow-y-auto overscroll-contain p-0"
                        >
                            <div style={{ height: matches.length * rowHeight }} className="relative">
                                {matches.slice(start, end).map((option, offset) => {
                                    const index = start + offset;
                                    const chosen = option.value === value;
                                    return (
                                        <div
                                            key={option.value}
                                            id={`${uid}-opt-${index}`}
                                            role="option"
                                            aria-selected={chosen}
                                            aria-disabled={option.disabled || undefined}
                                            data-active={index === activeIndex}
                                            style={{ position: 'absolute', top: index * rowHeight, left: 0, right: 0, height: rowHeight }}
                                            onMouseDown={(event) => event.preventDefault()}
                                            onMouseMove={() => { if (index !== activeIndex) setActive(index); }}
                                            onClick={() => commit(option)}
                                            className={cn(
                                                'flex cursor-pointer items-center gap-2 px-3 text-sm',
                                                index === activeIndex && 'bg-secondary',
                                                option.disabled && 'cursor-not-allowed opacity-50',
                                            )}
                                        >
                                            {option.icon}
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-foreground">{option.label}</span>
                                                {option.description && <span className="block truncate text-xs text-muted-foreground">{option.description}</span>}
                                            </span>
                                            <Check className={cn('size-4 shrink-0 text-primary', !chosen && 'invisible')} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {matches.length > maxVisibleRows && (
                        <p className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
                            {matches.length.toLocaleString()} {query ? 'matches' : 'options'}
                        </p>
                    )}
                </PopoverContent>
            </Popover>

            {clearable && selected && !disabled && (
                <button
                    type="button"
                    aria-label="Clear"
                    onClick={clear}
                    className="absolute right-8 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                >
                    <X className="size-3.5" />
                </button>
            )}

            {name && <input type="hidden" name={name} value={value} />}
            {required && (
                <input
                    tabIndex={-1}
                    aria-hidden
                    required
                    value={value}
                    onChange={() => undefined}
                    onFocus={() => triggerRef.current?.focus()}
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0"
                />
            )}
        </div>
    );
}
