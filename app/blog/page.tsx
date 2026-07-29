import Link from 'next/link';
import { Metadata } from 'next';
import { Header, Footer } from '@/components/layouts';
import { BlogCard } from '@/components/website/blog-card';
import { prisma } from '@/lib/db';
import { generatePageMetadata } from '@/lib/metadata';
import { cn } from '@/utils';

export const metadata: Metadata = generatePageMetadata({
    title: 'Blog | UnityAlgo',
    description:
        'Insights on ERP implementation, financial management, manufacturing, retail operations, and enterprise application development from the UnityAlgo team.',
    keywords: ['UnityAlgo Blog', 'ERP Insights', 'Enterprise Software Blog', 'Digital Transformation Articles'],
    path: '/blog',
});

const PAGE_SIZE = 6;

export const revalidate = 60;

export default async function BlogListingPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const params = await searchParams;
    const currentPage = Math.max(1, Number(params.page) || 1);

    const [posts, totalCount] = await Promise.all([
        prisma.post.findMany({
            where: { published: true },
            orderBy: { publishedAt: 'desc' },
            skip: (currentPage - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
        }),
        prisma.post.count({ where: { published: true } }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    return (
        <div className="bg-background text-foreground min-h-screen overflow-hidden">
            <Header />

            <main className="max-w-5xl mx-auto">
                <section className="pt-28 pb-16 md:pb-20 px-4">
                    <div className="container mx-auto max-w-6xl text-center flex items-center flex-col  mb-6">
                        <h1 className="text-xl md:text-3xl font-bold">
                            Browse our thoughts
                        </h1>
                        <div className='h-1 w-36 bg-brand-600'></div>

                    </div>
                </section>

                <section className="pb-24 px-4">
                    <div className="container mx-auto max-w-6xl">
                        {posts.length === 0 ? (
                            <p className="text-center text-gray-500 py-24">
                                No blog posts published yet. Check back soon.
                            </p>
                        ) : (
                            <>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    {posts.map((post) => (
                                        <BlogCard key={post.id} post={post} />
                                    ))}
                                </div>

                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-2 mt-16">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                            <Link
                                                key={page}
                                                href={page === 1 ? '/blog' : `/blog?page=${page}`}
                                                className={cn(
                                                    'w-10 h-10 flex items-center justify-center rounded-full text-sm font-bold transition-colors ',
                                                    page === currentPage
                                                        ? 'bg-brand-600 text-white'
                                                        : 'text-gray-600 hover:bg-gray-100'
                                                )}
                                            >
                                                {page}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
