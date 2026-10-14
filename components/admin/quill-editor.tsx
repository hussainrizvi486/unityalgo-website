'use client';

import { useEffect, useRef, useState } from 'react';
import Quill, { type Range } from 'quill';
import 'quill/dist/quill.core.css';
import {
    Bold,
    Italic,
    Strikethrough,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    Quote,
    Link as LinkIcon,
    ImageUp,
    Undo,
    Redo,
} from 'lucide-react';
import { cn } from '@/utils';

interface QuillEditorProps {
    name: string;
    defaultValue?: string;
}

function ToolbarButton({
    onClick,
    active,
    disabled,
    label,
    children,
}: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            title={label}
            className={cn(
                'p-2 rounded text-ink-600 hover:bg-ink-100 disabled:opacity-40 disabled:pointer-events-none transition-colors',
                // Pressed state, not a status: neutral fill, darker ink.
                active && 'bg-ink-200 text-ink-950'
            )}
        >
            {children}
        </button>
    );
}

export function QuillEditor({ name, defaultValue }: QuillEditorProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const quillRef = useRef<Quill | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [html, setHtml] = useState(defaultValue ?? '');
    const [uploading, setUploading] = useState(false);
    const [format, setFormat] = useState<Record<string, unknown>>({});
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;

        const quill = new Quill(containerRef.current, {
            placeholder: 'Write your post content…',
            modules: {
                toolbar: false,
                history: { delay: 1000, maxStack: 100, userOnly: true },
            },
        });
        quillRef.current = quill;

        if (defaultValue) {
            quill.clipboard.dangerouslyPasteHTML(defaultValue);
        }

        const refreshState = (range?: Range | null) => {
            setHtml(quill.root.innerHTML);
            setFormat(quill.getFormat(range ?? quill.getSelection() ?? undefined));
            setCanUndo(quill.history.stack.undo.length > 0);
            setCanRedo(quill.history.stack.redo.length > 0);
        };

        quill.on('text-change', () => refreshState());
        quill.on('selection-change', (range) => refreshState(range));

        return () => {
            quillRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function uploadFile(file: File) {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Upload failed');
            return data.url as string;
        } finally {
            setUploading(false);
        }
    }

    function handleImageButtonClick() {
        fileInputRef.current?.click();
    }

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = '';
        const quill = quillRef.current;
        if (!file || !quill) return;
        try {
            const url = await uploadFile(file);
            const range = quill.getSelection(true);
            quill.insertEmbed(range.index, 'image', url, 'user');
            quill.setSelection(range.index + 1, 0, 'user');
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Upload failed');
        }
    }

    function handleSetLink() {
        const quill = quillRef.current;
        if (!quill) return;
        const range = quill.getSelection();
        if (!range) return;
        const previousUrl = quill.getFormat(range).link as string | undefined;
        const url = window.prompt('Link URL', previousUrl ?? 'https://');
        if (url === null) return;
        quill.format('link', url === '' ? false : url, 'user');
    }

    function toggleInline(key: string) {
        const quill = quillRef.current;
        if (!quill) return;
        quill.focus();
        quill.format(key, !format[key], 'user');
    }

    function toggleHeader(level: 2 | 3) {
        const quill = quillRef.current;
        if (!quill) return;
        quill.focus();
        quill.format('header', format.header === level ? false : level, 'user');
    }

    function toggleList(kind: 'bullet' | 'ordered') {
        const quill = quillRef.current;
        if (!quill) return;
        quill.focus();
        quill.format('list', format.list === kind ? false : kind, 'user');
    }

    return (
        <div className="w-full rounded border border-input overflow-hidden">
            <div className="flex flex-wrap items-center gap-1 border-b border-input bg-ink-50/60 px-2 py-1.5">
                <ToolbarButton label="Bold" active={!!format.bold} onClick={() => toggleInline('bold')}>
                    <Bold className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton label="Italic" active={!!format.italic} onClick={() => toggleInline('italic')}>
                    <Italic className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton label="Strikethrough" active={!!format.strike} onClick={() => toggleInline('strike')}>
                    <Strikethrough className="w-4 h-4" />
                </ToolbarButton>

                <div className="w-px h-5 bg-ink-200 mx-1" />

                <ToolbarButton label="Heading 2" active={format.header === 2} onClick={() => toggleHeader(2)}>
                    <Heading2 className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton label="Heading 3" active={format.header === 3} onClick={() => toggleHeader(3)}>
                    <Heading3 className="w-4 h-4" />
                </ToolbarButton>

                <div className="w-px h-5 bg-ink-200 mx-1" />

                <ToolbarButton label="Bullet List" active={format.list === 'bullet'} onClick={() => toggleList('bullet')}>
                    <List className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton label="Numbered List" active={format.list === 'ordered'} onClick={() => toggleList('ordered')}>
                    <ListOrdered className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton label="Quote" active={!!format.blockquote} onClick={() => toggleInline('blockquote')}>
                    <Quote className="w-4 h-4" />
                </ToolbarButton>

                <div className="w-px h-5 bg-ink-200 mx-1" />

                <ToolbarButton label="Link" active={!!format.link} onClick={handleSetLink}>
                    <LinkIcon className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton label="Upload image" onClick={handleImageButtonClick} disabled={uploading}>
                    <ImageUp className="w-4 h-4" />
                </ToolbarButton>

                <div className="w-px h-5 bg-ink-200 mx-1" />

                <ToolbarButton label="Undo" onClick={() => quillRef.current?.history.undo()} disabled={!canUndo}>
                    <Undo className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton label="Redo" onClick={() => quillRef.current?.history.redo()} disabled={!canRedo}>
                    <Redo className="w-4 h-4" />
                </ToolbarButton>

                {uploading && <span className="portal-text-caption text-ink-400 ml-2">Uploading…</span>}
            </div>

            <div
                ref={containerRef}
                className="[&_.ql-editor]:prose [&_.ql-editor]:prose-sm [&_.ql-editor]:max-w-none [&_.ql-editor]:min-h-80 [&_.ql-editor]:px-4 [&_.ql-editor]:py-3 [&_.ql-editor]:outline-none [&_.ql-editor.ql-blank::before]:not-italic [&_.ql-editor.ql-blank::before]:text-ink-400"
            />

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <input type="hidden" name={name} value={html} readOnly />
        </div>
    );
}
