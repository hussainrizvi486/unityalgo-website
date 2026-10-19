'use client';

import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ImageIcon, PencilLine, Rows3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Notice } from '@/components/ui/notice';
import { Badge } from '@/components/ui/badge';
import { CoverImageField } from '@/components/admin/cover-image-field';
import { InlineText } from '@/components/admin/inline-text';
import { cn } from '@/utils';
import type { PostFormState } from '@/app/admin/actions';

const QuillEditor = dynamic(
    () => import('@/components/admin/quill-editor').then((mod) => mod.QuillEditor),
    { ssr: false, loading: () => <div className="w-full rounded border border-input h-95 animate-pulse bg-muted" /> }
);

export interface PostFormValues {
    id?: string;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    coverImage: string;
    published: boolean;
    metaTitle: string;
    metaDescription: string;
}

const EMPTY: PostFormValues = { title: '', slug: '', excerpt: '', content: '', coverImage: '', published: false, metaTitle: '', metaDescription: '' };

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? 'Saving...' : label}
        </Button>
    );
}

interface PostFormProps {
    action: (prevState: PostFormState | undefined, formData: FormData) => Promise<PostFormState>;
    defaultValues?: Partial<PostFormValues>;
    submitLabel: string;
}

type Mode = 'fields' | 'inline';

/**
 * One state for the whole post, two ways to edit it. "Fields" is the usual form; "Inline" shows the post as readers see it
 * and lets you click the title, summary and body to type there. Both read and write the same values, and what is saved is
 * always that state, so switching views never loses an edit. Everything is posted from hidden inputs for the same reason.
 */
export function PostForm({ action, defaultValues, submitLabel }: PostFormProps) {
    const [state, formAction] = useActionState(action, undefined);
    const initial = React.useMemo<PostFormValues>(() => ({ ...EMPTY, ...defaultValues }), [defaultValues]);
    const [values, setValues] = React.useState<PostFormValues>(initial);
    const [mode, setMode] = React.useState<Mode>('fields');
    const [coverOpen, setCoverOpen] = React.useState(false);
    const submitting = React.useRef(false);
    const set = <K extends keyof PostFormValues>(key: K, value: PostFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));

    const dirty = (Object.keys(EMPTY) as (keyof PostFormValues)[]).some((key) => values[key] !== initial[key]);

    React.useEffect(() => {
        submitting.current = false;
    }, [state]);

    // Warn before leaving with edits that have not been saved.
    React.useEffect(() => {
        if (!dirty) return;
        const warn = (event: BeforeUnloadEvent) => {
            if (submitting.current) return;
            event.preventDefault();
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    return (
        <form action={formAction} onSubmit={() => { submitting.current = true; }} className="portal-stack">
            {(['title', 'slug', 'excerpt', 'content', 'coverImage', 'metaTitle', 'metaDescription'] as const).map((key) => (
                <input key={key} type="hidden" name={key} value={values[key]} />
            ))}
            {values.published && <input type="hidden" name="published" value="on" />}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div role="radiogroup" aria-label="Editing view" className="inline-flex rounded-lg bg-muted p-1">
                    {([['fields', 'Fields', Rows3], ['inline', 'Inline editing', PencilLine]] as const).map(([value, label, Icon]) => (
                        <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={mode === value}
                            onClick={() => setMode(value)}
                            className={cn(
                                'inline-flex items-center gap-2 rounded-md px-3 py-1.5 portal-text-body font-medium transition-colors',
                                mode === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground/80',
                            )}
                        >
                            <Icon className="size-4" />{label}
                        </button>
                    ))}
                </div>
                {dirty && <Badge variant="warning">Unsaved changes</Badge>}
            </div>

            {mode === 'fields' ? (
                <>
                    <div>
                        <Label htmlFor="title" className="portal-text-body text-foreground/80 mb-1.5">Title</Label>
                        <Input id="title" required value={values.title} onChange={(event) => set('title', event.target.value)} />
                    </div>
                    <div>
                        <Label htmlFor="excerpt" className="portal-text-body text-foreground/80 mb-1.5">Excerpt</Label>
                        <Textarea id="excerpt" required rows={2} value={values.excerpt} onChange={(event) => set('excerpt', event.target.value)} />
                    </div>
                    <div>
                        <Label className="portal-text-body text-foreground/80 mb-1.5">Cover Image</Label>
                        <CoverImageField value={values.coverImage} onValueChange={(value) => set('coverImage', value)} />
                    </div>
                </>
            ) : (
                <article className="mx-auto w-full max-w-3xl rounded-xl border border-border p-card">
                    <p className="mb-4 portal-text-caption text-muted-foreground">Click the title, the summary or the text below and type. Changes are kept if you switch back to Fields.</p>
                    <div className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
                        {values.coverImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={values.coverImage} alt="Cover" referrerPolicy="no-referrer" className="size-full object-cover" />
                        ) : (
                            <div className="flex size-full items-center justify-center gap-2 text-muted-foreground"><ImageIcon className="size-5" />No cover image</div>
                        )}
                        <Button type="button" size="sm" variant="outline" className="absolute right-3 top-3 bg-card" onClick={() => setCoverOpen((open) => !open)}>
                            {coverOpen ? 'Done' : 'Change cover'}
                        </Button>
                    </div>
                    {coverOpen && (
                        <div className="mt-3">
                            <CoverImageField value={values.coverImage} onValueChange={(value) => set('coverImage', value)} />
                        </div>
                    )}
                    <InlineText label="Title" value={values.title} onChange={(value) => set('title', value)} placeholder="Post title" className="mt-6 text-3xl font-semibold leading-tight" />
                    <InlineText label="Excerpt" multiline value={values.excerpt} onChange={(value) => set('excerpt', value)} placeholder="A short summary shown in lists and search results" className="mt-3 text-lg text-muted-foreground" />
                </article>
            )}

            <div>
                <Label className="portal-text-body text-foreground/80 mb-1.5">Content</Label>
                <QuillEditor defaultValue={initial.content} onChange={(html) => set('content', html)} />
            </div>

            <div className="grid gap-gap-lg md:grid-cols-2">
                <div className="md:col-span-2">
                    <Label htmlFor="slug" className="portal-text-body text-foreground/80 mb-1.5">
                        Slug <span className="text-muted-foreground font-normal">(optional — auto-generated from title if left blank)</span>
                    </Label>
                    <Input id="slug" value={values.slug} onChange={(event) => set('slug', event.target.value)} />
                </div>
                <div>
                    <Label htmlFor="metaTitle" className="portal-text-body text-foreground/80 mb-1.5">
                        Meta Title <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input id="metaTitle" value={values.metaTitle} onChange={(event) => set('metaTitle', event.target.value)} />
                </div>
                <div>
                    <Label htmlFor="metaDescription" className="portal-text-body text-foreground/80 mb-1.5">
                        Meta Description <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input id="metaDescription" value={values.metaDescription} onChange={(event) => set('metaDescription', event.target.value)} />
                </div>
            </div>

            <Label htmlFor="published" className="portal-text-body text-foreground/80">
                <Checkbox id="published" checked={values.published} onCheckedChange={(checked) => set('published', checked === true)} />
                Published
            </Label>

            {state?.error && <Notice tone="error">{state.error}</Notice>}

            <div className="flex items-center gap-3">
                <SubmitButton label={submitLabel} />
                <Button asChild type="button" variant="outline"><Link href="/admin/blogs">Cancel</Link></Button>
            </div>
        </form>
    );
}
