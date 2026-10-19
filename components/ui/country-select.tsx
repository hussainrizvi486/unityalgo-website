'use client';

import 'flag-icons/css/flag-icons.min.css';
import * as React from 'react';
import { COUNTRIES, countryCode } from '@/lib/countries';
import { Autocomplete } from '@/components/ui/autocomplete';

/** A country's flag, drawn from the bundled flag set so it looks the same on every system. */
export function Flag({ country, className }: { country: string; className?: string }) {
    const code = countryCode(country);
    if (!code) return null;
    return <span aria-hidden="true" className={`fi fi-${code} shrink-0 rounded-sm ${className ?? ''}`} />;
}

/** The country list with search and each country's flag beside its name. A value not in the list (an older free-text address) is kept as an extra option. */
export function CountrySelect({
    id,
    name,
    value,
    onValueChange,
    invalid,
    required,
}: {
    id?: string;
    name?: string;
    value: string;
    onValueChange: (value: string) => void;
    invalid?: boolean;
    required?: boolean;
}) {
    const options = React.useMemo(() => {
        const list = COUNTRIES.map(([country, code]) => ({ value: country, label: country, icon: <Flag country={country} />, keywords: [code] }));
        return value && !list.some((option) => option.value === value) ? [{ value, label: value, icon: undefined, keywords: [] as string[] }, ...list] : list;
    }, [value]);
    return (
        <Autocomplete
            id={id}
            name={name}
            options={options}
            value={value}
            onValueChange={onValueChange}
            invalid={invalid}
            required={required}
            placeholder="Select a country"
            searchPlaceholder="Search countries…"
            emptyMessage="No country matches that."
        />
    );
}
