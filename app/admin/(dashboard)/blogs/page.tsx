import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminPagination } from '@/components/admin/pagination';
import { ADMIN_PAGE_SIZE, parsePage, totalPagesFor } from '@/lib/pagination';
import { deletePostAction, togglePublishAction } from '@/app/admin/actions';

interface BlogsPageProps {
    searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}

export default async function AdminBlogsPage({ searchParams }: BlogsPageProps) {
    const params = await searchParams;
    const currentPage = parsePage(params.page);
    const q = params.q?.trim() ?? '';
    const status = params.status ?? '';

    const where: Prisma.PostWhereInput = {
        ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
        ...(status === 'published' ? { published: true } : {}),
        ...(status === 'draft' ? { published: false } : {}),
    };

    const [posts, totalCount] = await Promise.all([
        prisma.post.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (currentPage - 1) * ADMIN_PAGE_SIZE,
            take: ADMIN_PAGE_SIZE,
        }),
        prisma.post.count({ where }),
    ]);

    const totalPages = totalPagesFor(totalCount);

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Blogs</h1>
                    <p className="text-sm text-gray-500 mt-1">{totalCount} total</p>
                </div>
                <Link href="/admin/blogs/new">
                    <Button className="rounded-full bg-brand-600 hover:bg-brand-700 text-white">New Post</Button>
                </Link>
            </div>

            <form className="flex flex-wrap items-end gap-3 mb-6">
                <div className="flex-1 min-w-48">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Search title</label>
                    <Input name="q" defaultValue={q} placeholder="Search blogs…" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
                    <select
                        name="status"
                        defaultValue={status}
                        className="h-9 rounded-md border border-input px-3 text-sm bg-white"
                    >
                        <option value="">All</option>
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                    </select>
                </div>
                <Button type="submit" variant="outline" className="rounded-md">
                    Filter
                </Button>
                {(q || status) && (
                    <Link href="/admin/blogs" className="text-sm text-gray-500 hover:text-gray-700 mb-2">
                        Clear
                    </Link>
                )}
            </form>

            {posts.length === 0 ? (
                <p className="text-gray-500 text-center py-20">No blog posts found.</p>
            ) : (
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-left text-gray-500 uppercase text-xs tracking-wide">
                            <tr>
                                <th className="px-6 py-4">Title</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Updated</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {posts.map((post) => (
                                <tr key={post.id}>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{post.title}</div>
                                        <div className="text-gray-400 text-xs">/blog/{post.slug}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span
                                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${post.published
                                                ? 'bg-green-50 text-green-700'
                                                : 'bg-gray-100 text-gray-500'
                                                }`}
                                        >
                                            {post.published ? 'Published' : 'Draft'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">
                                        {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(post.updatedAt)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link href={`/admin/blogs/${post.id}/edit`}>
                                                <Button size="sm" variant="outline" className="rounded-full">
                                                    Edit
                                                </Button>
                                            </Link>
                                            <form action={togglePublishAction}>
                                                <input type="hidden" name="id" value={post.id} />
                                                <Button size="sm" variant="outline" className="rounded-full" type="submit">
                                                    {post.published ? 'Unpublish' : 'Publish'}
                                                </Button>
                                            </form>
                                            <form action={deletePostAction}>
                                                <input type="hidden" name="id" value={post.id} />
                                                <Button size="sm" variant="destructive" className="rounded-full" type="submit">
                                                    Delete
                                                </Button>
                                            </form>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <AdminPagination
                basePath="/admin/blogs"
                currentPage={currentPage}
                totalPages={totalPages}
                searchParams={{ q, status }}
            />
        </div>
    );
}
