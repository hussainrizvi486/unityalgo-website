import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { AdminPagination } from '@/components/admin/pagination';
import { DeleteButton } from '@/components/admin/delete-button';
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
                    <p className="text-sm text-ink-500 mt-1">{totalCount} total</p>
                </div>
                <Link href="/admin/blogs/new">
                    <Button className="rounded-full bg-brand hover:brightness-90 text-white">New Post</Button>
                </Link>
            </div>

            <form className="flex flex-wrap items-end gap-3 mb-6">
                <div className="flex-1 min-w-48">
                    <Label htmlFor="q" className="text-xs text-ink-500 mb-1.5">Search title</Label>
                    <Input id="q" name="q" defaultValue={q} placeholder="Search blogs…" />
                </div>
                <div>
                    <Label htmlFor="status" className="text-xs text-ink-500 mb-1.5">Status</Label>
                    <Select name="status" defaultValue={status || 'all'}>
                        <SelectTrigger id="status" className="w-40">
                            <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="published">Published</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button type="submit" variant="outline" className="rounded-md">
                    Filter
                </Button>
                {(q || (status && status !== 'all')) && (
                    <Link href="/admin/blogs" className="text-sm text-ink-500 hover:text-ink-700 mb-2">
                        Clear
                    </Link>
                )}
            </form>

            {posts.length === 0 ? (
                <p className="text-ink-500 text-center py-20">No blog posts found.</p>
            ) : (
                <div className="bg-white border border-ink-100 rounded-2xl overflow-hidden">
                    <Table>
                        <TableHeader className="bg-ink-50 text-ink-500 uppercase text-xs tracking-wide [&_th]:h-auto">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="px-6 py-4">Title</TableHead>
                                <TableHead className="px-6 py-4">Status</TableHead>
                                <TableHead className="px-6 py-4">Updated</TableHead>
                                <TableHead className="px-6 py-4 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-ink-100">
                            {posts.map((post) => (
                                <TableRow key={post.id}>
                                    <TableCell className="px-6 py-4 whitespace-normal">
                                        <div className="font-medium text-ink-900">{post.title}</div>
                                        <div className="text-ink-400 text-xs">/blog/{post.slug}</div>
                                    </TableCell>
                                    <TableCell className="px-6 py-4">
                                        <span
                                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${post.published
                                                ? 'bg-success-50 text-success-600'
                                                : 'bg-ink-100 text-ink-500'
                                                }`}
                                        >
                                            {post.published ? 'Published' : 'Draft'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="px-6 py-4 text-ink-500">
                                        {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(post.updatedAt)}
                                    </TableCell>
                                    <TableCell className="px-6 py-4">
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
                                            <DeleteButton
                                                action={deletePostAction}
                                                id={post.id}
                                                title="Delete this post?"
                                                description={`"${post.title}" will be permanently deleted. This action cannot be undone.`}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
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
