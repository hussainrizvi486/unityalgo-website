'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';

interface ColorFieldProps {
    name: string;
    label: string;
    defaultValue?: string;
    fallback: string;
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function ColorField({ name, label, defaultValue, fallback }: ColorFieldProps) {
    const [value, setValue] = useState(defaultValue ?? '');
    const swatchValue = HEX_RE.test(value) ? value : fallback;

    return (
        <div>
            <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1.5">
                {label} <span className="text-gray-400 font-normal">(optional — leave blank for default)</span>
            </label>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    aria-label={`${label} swatch`}
                    value={swatchValue}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-9 h-9 rounded-md border border-input cursor-pointer bg-transparent p-0.5 shrink-0"
                />
                <Input
                    id={name}
                    name={name}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="#ffffff"
                    className="font-mono"
                />
                {value && (
                    <button
                        type="button"
                        onClick={() => setValue('')}
                        className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
                    >
                        Clear
                    </button>
                )}
            </div>
        </div>
    );
}
