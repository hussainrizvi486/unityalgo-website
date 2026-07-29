'use client';

import { useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapImage from '@tiptap/extension-image';
import TiptapLink from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Table as TiptapTable } from '@tiptap/extension-table';
import TiptapTableRow from '@tiptap/extension-table-row';
import TiptapTableHeader from '@tiptap/extension-table-header';
import TiptapTableCell from '@tiptap/extension-table-cell';
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
    Table as TableIcon,
    Columns3,
    Rows3,
    Trash2,
} from 'lucide-react';
import { cn } from '@/utils';

interface TiptapEditorProps {
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
                'p-2 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none transition-colors',
                active && 'bg-brand-50 text-brand-700'
            )}
        >
            {children}
        </button>
    );
}

export function TiptapEditor({ name, defaultValue }: TiptapEditorProps) {
    const [html, setHtml] = useState(defaultValue ?? '');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit,
            TiptapLink.configure({ openOnClick: false, autolink: true }),
            TiptapImage,
            Placeholder.configure({ placeholder: 'Write your post content…' }),
            TiptapTable.configure({ resizable: true }),
            TiptapTableRow,
            TiptapTableHeader,
            TiptapTableCell,
        ],
        content: defaultValue ?? '',
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none min-h-[320px] px-4 py-3 focus:outline-none',
            },
        },
        onUpdate: ({ editor }) => setHtml(editor.getHTML()),
    });

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

    async function handleImageButtonClick() {
        fileInputRef.current?.click();
    }

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !editor) return;
        try {
            const url = await uploadFile(file);
            editor.chain().focus().setImage({ src: url }).run();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Upload failed');
        }
    }

    function handleSetLink() {
        if (!editor) return;
        const previousUrl = editor.getAttributes('link').href as string | undefined;
        const url = window.prompt('Link URL', previousUrl ?? 'https://');
        if (url === null) return;
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }

    if (!editor) {
        return <div className="w-full rounded-md border border-input h-95 animate-pulse bg-gray-50" />;
    }

    return (
        <div className="w-full rounded-md border border-input overflow-hidden">
            <div className="flex flex-wrap items-center gap-1 border-b border-input bg-gray-50/60 px-2 py-1.5">
                <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
                    <Bold className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
                    <Italic className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
                    <Strikethrough className="w-4 h-4" />
                </ToolbarButton>

                <div className="w-px h-5 bg-gray-200 mx-1" />

                <ToolbarButton
                    label="Heading 2"
                    active={editor.isActive('heading', { level: 2 })}
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                >
                    <Heading2 className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    label="Heading 3"
                    active={editor.isActive('heading', { level: 3 })}
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                >
                    <Heading3 className="w-4 h-4" />
                </ToolbarButton>

                <div className="w-px h-5 bg-gray-200 mx-1" />

                <ToolbarButton label="Bullet List" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                    <List className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton label="Numbered List" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                    <ListOrdered className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
                    <Quote className="w-4 h-4" />
                </ToolbarButton>

                <div className="w-px h-5 bg-gray-200 mx-1" />

                <ToolbarButton label="Link" active={editor.isActive('link')} onClick={handleSetLink}>
                    <LinkIcon className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton label="Upload image" onClick={handleImageButtonClick} disabled={uploading}>
                    <ImageUp className="w-4 h-4" />
                </ToolbarButton>

                <div className="w-px h-5 bg-gray-200 mx-1" />

                <ToolbarButton
                    label="Insert table"
                    active={editor.isActive('table')}
                    onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                >
                    <TableIcon className="w-4 h-4" />
                </ToolbarButton>

                {editor.isActive('table') && (
                    <>
                        <ToolbarButton label="Add column after" onClick={() => editor.chain().focus().addColumnAfter().run()}>
                            <Columns3 className="w-4 h-4" />
                        </ToolbarButton>
                        <ToolbarButton label="Add row after" onClick={() => editor.chain().focus().addRowAfter().run()}>
                            <Rows3 className="w-4 h-4" />
                        </ToolbarButton>
                        <ToolbarButton label="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>
                            <Trash2 className="w-4 h-4" />
                        </ToolbarButton>
                    </>
                )}

                <div className="w-px h-5 bg-gray-200 mx-1" />

                <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
                    <Undo className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
                    <Redo className="w-4 h-4" />
                </ToolbarButton>

                {uploading && <span className="text-xs text-gray-400 ml-2">Uploading…</span>}
            </div>

            <EditorContent editor={editor} />

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <input type="hidden" name={name} value={html} readOnly />
        </div>
    );
}
