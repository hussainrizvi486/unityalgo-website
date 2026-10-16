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

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="">
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
        <form action={formAction} className="portal-stack">
            <div>
                <Label htmlFor="title" className="portal-text-body text-foreground/80 mb-1.5">
                    Title
                </Label>
                <Input id="title" name="title" required defaultValue={defaultValues?.title} />
            </div>

            <div>
                <Label htmlFor="slug" className="portal-text-body text-foreground/80 mb-1.5">
                    Slug <span className="text-muted-foreground font-normal">(optional — auto-generated from title if left blank)</span>
                </Label>
                <Input id="slug" name="slug" defaultValue={defaultValues?.slug} />
            </div>

            <div>
                <Label htmlFor="excerpt" className="portal-text-body text-foreground/80 mb-1.5">
                    Excerpt
                </Label>
                <Textarea id="excerpt" name="excerpt" required rows={2} defaultValue={defaultValues?.excerpt} />
            </div>

            <div>
                <Label className="portal-text-body text-foreground/80 mb-1.5">Cover Image</Label>
                <CoverImageField name="coverImage" defaultValue={defaultValues?.coverImage} />
            </div>

            <div>
                <Label className="portal-text-body text-foreground/80 mb-1.5">Content</Label>
                <QuillEditor name="content" defaultValue={defaultValues?.content} />
            </div>

            <div className="grid md:grid-cols-2 gap-gap-lg">
                <div>
                    <Label htmlFor="metaTitle" className="portal-text-body text-foreground/80 mb-1.5">
                        Meta Title <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input id="metaTitle" name="metaTitle" defaultValue={defaultValues?.metaTitle} />
                </div>
                <div>
                    <Label htmlFor="metaDescription" className="portal-text-body text-foreground/80 mb-1.5">
                        Meta Description <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input id="metaDescription" name="metaDescription" defaultValue={defaultValues?.metaDescription} />
                </div>
            </div>

            <Label htmlFor="published" className="portal-text-body text-foreground/80">
                <Checkbox id="published" name="published" defaultChecked={defaultValues?.published} />
                Published
            </Label>

            {state?.error && <p className="portal-text-body text-destructive">{state.error}</p>}

            <div className="flex items-center gap-3">
                <SubmitButton label={submitLabel} />
                <Button asChild type="button" variant="outline" ><Link href="/admin/blogs">
                        Cancel
                    </Link></Button>
            </div>
        </form>
    );
}
