'use client';

import 'flag-icons/css/flag-icons.min.css';
import { COUNTRIES, countryCode } from '@/lib/countries';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function Flag({ country, className }: { country: string; className?: string }) {
    const code = countryCode(country);
    if (!code) return null;
    return <span aria-hidden="true" className={`fi fi-${code} shrink-0 rounded-sm ${className ?? ''}`} />;
}

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
    const known = COUNTRIES.some((country) => country[0] === value);
    return (
        <Select name={name} value={value} onValueChange={onValueChange} required={required}>
            <SelectTrigger id={id} aria-invalid={invalid}>
                <SelectValue placeholder="Select a country" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
                {value && !known && <SelectItem value={value}>{value}</SelectItem>}
                {COUNTRIES.map(([country]) => (
                    <SelectItem key={country} value={country}>
                        <span className="flex items-center gap-2"><Flag country={country} />{country}</span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
