'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/utils';

/**
 * A text field that filters a list of options as you type.
 *
 * This is the control a `<Select>` cannot be: a select is fine for five plans,
 * but not for four hundred countries or every customer in the database, where
 * the only workable way in is to type a few letters.
 *
 * Like `<SmartInput>`, the visible field carries no `name` — a hidden input
 * holds the chosen option's value, so a server action receives `pk` rather
 * than the `Pakistan` the person read. The two controls deliberately share
 * that contract so form code does not have to care which one it is posting.
 */

export interface AutocompleteOption {
    value: string;
    label: string;
    /** Second line in the list. Use for the detail that disambiguates duplicates. */
    description?: string;
    disabled?: boolean;
}

export interface AutocompleteProps {
    name: string;
    options: AutocompleteOption[];
    defaultValue?: string;
    placeholder?: string;
    /** Shown when nothing matches what has been typed. */
    emptyMessage?: string;
    disabled?: boolean;
    required?: boolean;
    invalid?: boolean;
    id?: string;
    className?: string;
    /**
     * Accept text that matches no option. Off by default: a field backed by a
     * fixed list should not silently post a value the server cannot resolve.
     */
    allowCustomValue?: boolean;
    onValueChange?: (value: string) => void;
}

function normalise(text: string) {
    return text.toLowerCase().trim();
}

export function Autocomplete({
    name,
    options,
    defaultValue,
    placeholder = 'Search…',
    emptyMessage = 'No matches.',
    disabled,
    required,
    invalid,
    id,
    className,
    allowCustomValue = false,
    onValueChange,
}: AutocompleteProps) {
    const selectedOption = options.find((option) => option.value === defaultValue);

    const [value, setValue] = React.useState(defaultValue ?? '');
    const [query, setQuery] = React.useState(selectedOption?.label ?? '');
    const [open, setOpen] = React.useState(false);
    const [rawActiveIndex, setActiveIndex] = React.useState(0);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const listRef = React.useRef<HTMLDivElement>(null);
    const listId = `${name}-listbox`;

    // While the list is closed the field shows the chosen label in full; typing
    // reopens it and the same string becomes the filter.
    const matches = React.useMemo(() => {
        const needle = normalise(query);
        if (!needle || normalise(selectedLabelOf(options, value)) === needle) return options;
        return options.filter(
            (option) =>
                normalise(option.label).includes(needle) ||
                normalise(option.description ?? '').includes(needle),
        );
    }, [options, query, value]);

    // Typing narrows the list, so the stored index can outrun it. Clamping on
    // read rather than in an effect keeps the render consistent with the list
    // it is describing — an effect would paint one frame with
    // aria-activedescendant pointing at an option that is no longer there.
    const activeIndex = matches.length === 0 ? 0 : Math.min(rawActiveIndex, matches.length - 1);

    React.useEffect(() => {
        if (!open) return;
        listRef.current
            ?.querySelector('[data-active="true"]')
            ?.scrollIntoView({ block: 'nearest' });
    }, [open, activeIndex]);

    function commit(option: AutocompleteOption) {
        if (option.disabled) return;
        setValue(option.value);
        setQuery(option.label);
        setOpen(false);
        onValueChange?.(option.value);
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) { setOpen(true); return; }
            const step = event.key === 'ArrowDown' ? 1 : -1;
            setActiveIndex((index) => {
                if (matches.length === 0) return 0;
                return (index + step + matches.length) % matches.length;
            });
            return;
        }
        if (event.key === 'Enter' && open) {
            const option = matches[activeIndex];
            if (option) { event.preventDefault(); commit(option); }
            return;
        }
        if (event.key === 'Escape' && open) {
            event.preventDefault();
            setOpen(false);
        }
    }

    function handleBlur() {
        // Leaving the field with a half-typed filter would show text that does
        // not match what is posted, so settle on one or the other.
        const exact = options.find((option) => normalise(option.label) === normalise(query));
        if (exact) { commit(exact); return; }
        if (allowCustomValue) { setValue(query); onValueChange?.(query); return; }
        setQuery(selectedLabelOf(options, value));
    }

    return (
        <div className={cn('relative', className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverAnchor asChild>
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                        <Input
                            id={id}
                            ref={inputRef}
                            role="combobox"
                            aria-expanded={open}
                            aria-controls={listId}
                            aria-autocomplete="list"
                            aria-activedescendant={open && matches[activeIndex] ? `${name}-option-${activeIndex}` : undefined}
                            aria-invalid={invalid || undefined}
                            autoComplete="off"
                            className="pl-9 pr-9"
                            placeholder={placeholder}
                            disabled={disabled}
                            required={required}
                            value={query}
                            onChange={(event) => {
                                setQuery(event.target.value);
                                setOpen(true);
                                setActiveIndex(0);
                            }}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setOpen(true)}
                            onBlur={handleBlur}
                        />
                        <button
                            type="button"
                            tabIndex={-1}
                            aria-hidden
                            disabled={disabled}
                            onClick={() => { setOpen((v) => !v); inputRef.current?.focus(); }}
                            className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded text-ink-400 hover:text-ink-600 disabled:pointer-events-none"
                        >
                            <ChevronsUpDown className="size-4" />
                        </button>
                    </div>
                </PopoverAnchor>

                <PopoverContent
                    align="start"
                    sideOffset={4}
                    // Focus has to stay in the input for typing to keep working,
                    // so the popover must not pull it into the list on open.
                    onOpenAutoFocus={(event) => event.preventDefault()}
                    className="w-[var(--radix-popover-trigger-width)] min-w-[12rem] p-1"
                >
                    <div ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto">
                        {matches.length === 0 ? (
                            <p className="px-3 py-6 text-center text-sm text-ink-400">{emptyMessage}</p>
                        ) : (
                            matches.map((option, index) => {
                                const active = index === activeIndex;
                                const chosen = option.value === value;
                                return (
                                    <div
                                        key={option.value}
                                        id={`${name}-option-${index}`}
                                        role="option"
                                        aria-selected={chosen}
                                        aria-disabled={option.disabled || undefined}
                                        data-active={active}
                                        // Mouse down would blur the input and close the
                                        // list before the click could land.
                                        onMouseDown={(event) => event.preventDefault()}
                                        onMouseEnter={() => setActiveIndex(index)}
                                        onClick={() => commit(option)}
                                        className={cn(
                                            'flex cursor-pointer items-start gap-2 rounded px-2.5 py-2 text-sm',
                                            active && 'bg-ink-100',
                                            option.disabled && 'cursor-not-allowed opacity-50',
                                        )}
                                    >
                                        <Check className={cn('mt-0.5 size-4 shrink-0 text-brand', !chosen && 'invisible')} />
                                        <span className="min-w-0">
                                            <span className="block truncate text-ink-800">{option.label}</span>
                                            {option.description && (
                                                <span className="block truncate text-xs text-ink-400">{option.description}</span>
                                            )}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </PopoverContent>
            </Popover>

            <input type="hidden" name={name} value={value} />
        </div>
    );
}

function selectedLabelOf(options: AutocompleteOption[], value: string) {
    return options.find((option) => option.value === value)?.label ?? '';
}
