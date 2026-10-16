import { desc } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { ADMIN_LIST_LIMIT } from '@/lib/pagination';
import { formatDate } from '@/lib/admin-format';
import { AdminPageHeader } from '@/components/admin/page-header';
import { deletePostAction, togglePublishAction } from '@/app/admin/actions';
import { BlogsList, type BlogRow } from './blogs-list';

export default async function AdminBlogsPage() {
    const [posts, totalCount] = await Promise.all([
        db.query.post.findMany({ orderBy: desc(schema.post.createdAt), limit: ADMIN_LIST_LIMIT }),
        db.$count(schema.post),
    ]);

    const rows: BlogRow[] = posts.map((post) => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        published: post.published,
        updated: formatDate(post.updatedAt),
    }));

    return (
        <div>
            <AdminPageHeader
                title="Blogs"
                subtitle={
                    rows.length < totalCount
                        ? `Showing the ${rows.length} most recent of ${totalCount}`
                        : `${totalCount} total`
                }
                action={{ label: 'New Post', href: '/admin/blogs/new' }}
            />
            <BlogsList
                rows={rows}
                togglePublishAction={togglePublishAction}
                deleteAction={deletePostAction}
            />
        </div>
    );
}
