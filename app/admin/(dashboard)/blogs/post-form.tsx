'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { CoverImageField } from '@/components/admin/cover-image-field';
import type { PostFormState } from '@/app/admin/actions';

const QuillEditor = dynamic(
    () => import('@/components/admin/quill-editor').then((mod) => mod.QuillEditor),
    { ssr: false, loading: () => <div className="w-full rounded-md border border-input h-95 animate-pulse bg-ink-50" /> }
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

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="rounded-full bg-brand hover:brightness-90 text-white px-8">
            {pending ? 'Saving...' : label}
        </Button>
    );
}

interface PostFormProps {
    action: (prevState: PostFormState | undefined, formData: FormData) => Promise<PostFormState>;
    defaultValues?: Partial<PostFormValues>;
    submitLabel: string;
}

export function PostForm({ action, defaultValues, submitLabel }: PostFormProps) {
    const [state, formAction] = useActionState(action, undefined);

    return (
        <form action={formAction} className="space-y-6">
            <div>
                <Label htmlFor="title" className="text-sm text-ink-700 mb-1.5">
                    Title
                </Label>
                <Input id="title" name="title" required defaultValue={defaultValues?.title} />
            </div>

            <div>
                <Label htmlFor="slug" className="text-sm text-ink-700 mb-1.5">
                    Slug <span className="text-ink-400 font-normal">(optional — auto-generated from title if left blank)</span>
                </Label>
                <Input id="slug" name="slug" defaultValue={defaultValues?.slug} />
            </div>

            <div>
                <Label htmlFor="excerpt" className="text-sm text-ink-700 mb-1.5">
                    Excerpt
                </Label>
                <Textarea id="excerpt" name="excerpt" required rows={2} defaultValue={defaultValues?.excerpt} />
            </div>

            <div>
                <Label className="text-sm text-ink-700 mb-1.5">Cover Image</Label>
                <CoverImageField name="coverImage" defaultValue={defaultValues?.coverImage} />
            </div>

            <div>
                <Label className="text-sm text-ink-700 mb-1.5">Content</Label>
                <QuillEditor name="content" defaultValue={defaultValues?.content} />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <Label htmlFor="metaTitle" className="text-sm text-ink-700 mb-1.5">
                        Meta Title <span className="text-ink-400 font-normal">(optional)</span>
                    </Label>
                    <Input id="metaTitle" name="metaTitle" defaultValue={defaultValues?.metaTitle} />
                </div>
                <div>
                    <Label htmlFor="metaDescription" className="text-sm text-ink-700 mb-1.5">
                        Meta Description <span className="text-ink-400 font-normal">(optional)</span>
                    </Label>
                    <Input id="metaDescription" name="metaDescription" defaultValue={defaultValues?.metaDescription} />
                </div>
            </div>

            <Label htmlFor="published" className="text-sm text-ink-700">
                <Checkbox id="published" name="published" defaultChecked={defaultValues?.published} />
                Published
            </Label>

            {state?.error && <p className="text-sm text-error-600">{state.error}</p>}

            <div className="flex items-center gap-3">
                <SubmitButton label={submitLabel} />
                <Link href="/admin/blogs">
                    <Button type="button" variant="outline" className="rounded-full">
                        Cancel
                    </Button>
                </Link>
            </div>
        </form>
    );
}
