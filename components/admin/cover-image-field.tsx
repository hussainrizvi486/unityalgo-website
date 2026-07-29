'use client';

import { useRef, useState } from 'react';
import { Upload, Link as LinkIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils';

interface CoverImageFieldProps {
    name: string;
    defaultValue?: string;
}

export function CoverImageField({ name, defaultValue }: CoverImageFieldProps) {
    const [mode, setMode] = useState<'url' | 'upload'>('url');
    const [value, setValue] = useState(defaultValue ?? '');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        setUploading(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Upload failed');
            setValue(data.url);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploading(false);
        }
    }

    return (
        <div>
            <div className="flex items-center gap-1 mb-2">
                <button
                    type="button"
                    onClick={() => setMode('url')}
                    className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
                        mode === 'url' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-100'
                    )}
                >
                    <LinkIcon className="w-3.5 h-3.5" /> URL
                </button>
                <button
                    type="button"
                    onClick={() => setMode('upload')}
                    className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
                        mode === 'upload' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-100'
                    )}
                >
                    <Upload className="w-3.5 h-3.5" /> Upload
                </button>
            </div>

            {mode === 'url' ? (
                <Input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="/images/erp-dashboard.png"
                />
            ) : (
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {uploading ? 'Uploading…' : 'Choose File'}
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    {value && <span className="text-xs text-gray-500 truncate max-w-50">{value}</span>}
                </div>
            )}

            {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}

            {value && (
                <div className="mt-3 w-40 aspect-video rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={value} alt="Cover preview" className="w-full h-full object-cover" />
                </div>
            )}

            <input type="hidden" name={name} value={value} readOnly />
        </div>
    );
}
