'use client';

import { useRef, useState } from 'react';
import { Upload, Link as LinkIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface CoverImageFieldProps {
    /** When set, the address is also posted under this name. */
    name?: string;
    defaultValue?: string;
    /** Controlled use: the parent owns the address. */
    value?: string;
    onValueChange?: (value: string) => void;
}

export function CoverImageField({ name, defaultValue, value: controlled, onValueChange }: CoverImageFieldProps) {
    const [inner, setInner] = useState(defaultValue ?? '');
    const value = controlled ?? inner;
    const setValue = (next: string) => {
        setInner(next);
        onValueChange?.(next);
    };
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
            <Tabs defaultValue="url">
                <TabsList className="mb-2">
                    <TabsTrigger value="url">
                        <LinkIcon className="w-3.5 h-3.5" /> URL
                    </TabsTrigger>
                    <TabsTrigger value="upload">
                        <Upload className="w-3.5 h-3.5" /> Upload
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="url">
                    <Input
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="/images/erp-dashboard.png"
                    />
                </TabsContent>
                <TabsContent value="upload">
                    <div className="flex items-center gap-3">
                        <Button
                            type="button"
                            variant="outline"
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
                        {value && <span className="portal-text-caption text-muted-foreground truncate max-w-50">{value}</span>}
                    </div>
                </TabsContent>
            </Tabs>

            {error && <p className="portal-text-caption text-destructive mt-1.5">{error}</p>}

            {value && (
                <div className="mt-3 w-40 aspect-video rounded-md overflow-hidden border border-border/60 bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={value} alt="Cover preview" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </div>
            )}

            {name && <input type="hidden" name={name} value={value} readOnly />}
        </div>
    );
}
