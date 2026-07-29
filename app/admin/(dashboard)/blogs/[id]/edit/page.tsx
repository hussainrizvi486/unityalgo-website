import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { updatePostAction } from '@/app/admin/actions';
import { PostForm } from '../../post-form';

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const post = await prisma.post.findUnique({ where: { id } });

    if (!post) {
        notFound();
    }

    const boundUpdateAction = updatePostAction.bind(null, post.id);

    return (
        <div>
            <h1 className="text-2xl font-bold mb-8">Edit Post</h1>
            <PostForm
                action={boundUpdateAction}
                submitLabel="Save Changes"
                defaultValues={{
                    title: post.title,
                    slug: post.slug,
                    excerpt: post.excerpt,
                    content: post.content,
                    coverImage: post.coverImage,
                    tags: post.tags.join(', '),
                    published: post.published,
                    metaTitle: post.metaTitle ?? '',
                    metaDescription: post.metaDescription ?? '',
                    bgColor: post.bgColor ?? '',
                    textColor: post.textColor ?? '',
                }}
            />
        </div>
    );
}
