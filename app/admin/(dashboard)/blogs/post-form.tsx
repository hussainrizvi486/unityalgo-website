'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TiptapEditor } from '@/components/admin/tiptap-editor';
import { CoverImageField } from '@/components/admin/cover-image-field';
import { ColorField } from '@/components/admin/color-field';
import type { PostFormState } from '@/app/admin/actions';

export interface PostFormValues {
    id?: string;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    coverImage: string;
    tags: string;
    published: boolean;
    metaTitle: string;
    metaDescription: string;
    bgColor: string;
    textColor: string;
}

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="rounded-full bg-brand-600 hover:bg-brand-700 text-white px-8">
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
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Title
                </label>
                <Input id="title" name="title" required defaultValue={defaultValues?.title} />
            </div>

            <div>
                <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Slug <span className="text-gray-400 font-normal">(optional — auto-generated from title if left blank)</span>
                </label>
                <Input id="slug" name="slug" defaultValue={defaultValues?.slug} />
            </div>

            <div>
                <label htmlFor="excerpt" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Excerpt
                </label>
                <textarea
                    id="excerpt"
                    name="excerpt"
                    required
                    rows={2}
                    defaultValue={defaultValues?.excerpt}
                    className="w-full rounded-md border border-input px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Cover Image</label>
                <CoverImageField name="coverImage" defaultValue={defaultValues?.coverImage} />
            </div>

            <div>
                <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Tags <span className="text-gray-400 font-normal">(comma-separated)</span>
                </label>
                <Input id="tags" name="tags" defaultValue={defaultValues?.tags} placeholder="ERP, Finance, Accounting" />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Content</label>
                <TiptapEditor name="content" defaultValue={defaultValues?.content} />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="metaTitle" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Meta Title <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <Input id="metaTitle" name="metaTitle" defaultValue={defaultValues?.metaTitle} />
                </div>
                <div>
                    <label htmlFor="metaDescription" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Meta Description <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <Input id="metaDescription" name="metaDescription" defaultValue={defaultValues?.metaDescription} />
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <ColorField
                    name="bgColor"
                    label="Background Color"
                    defaultValue={defaultValues?.bgColor}
                    fallback="#ffffff"
                />
                <ColorField
                    name="textColor"
                    label="Text Color"
                    defaultValue={defaultValues?.textColor}
                    fallback="#374151"
                />
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                    type="checkbox"
                    name="published"
                    defaultChecked={defaultValues?.published}
                    className="w-4 h-4 rounded border-gray-300"
                />
                Published
            </label>

            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

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
