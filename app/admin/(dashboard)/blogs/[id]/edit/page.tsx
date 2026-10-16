import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { updatePostAction } from '@/app/admin/actions';
import { PostForm } from '../../post-form';

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const post = await db.query.post.findFirst({ where: eq(schema.post.id, id) });

    if (!post) {
        notFound();
    }

    const boundUpdateAction = updatePostAction.bind(null, post.id);

    return (
        <div>
            <h1 className="portal-page-title mb-8">Edit Post</h1>
            <PostForm
                action={boundUpdateAction}
                submitLabel="Save Changes"
                defaultValues={{
                    title: post.title,
                    slug: post.slug,
                    excerpt: post.excerpt,
                    content: post.content,
                    coverImage: post.coverImage,
                    published: post.published,
                    metaTitle: post.metaTitle ?? '',
                    metaDescription: post.metaDescription ?? '',
                }}
            />
        </div>
    );
}
