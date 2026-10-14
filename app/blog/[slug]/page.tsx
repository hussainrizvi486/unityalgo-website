import Image from 'next/image';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { Header, Footer } from '@/components/layouts';
import { BlogCard } from '@/components/website/blog-card';
import { prisma } from '@/lib/db';
import { generateBreadcrumbJsonLd } from '@/lib/metadata';

export const revalidate = 60;

function formatDate(date: Date | null) {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

async function getPost(slug: string) {
    return prisma.post.findUnique({ where: { slug, published: true } });
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const post = await getPost(slug);

    if (!post) {
        return { title: 'Post Not Found | UnityAlgo' };
    }

    const title = post.metaTitle || `${post.title} | UnityAlgo Blog`;
    const description = post.metaDescription || post.excerpt;
    const url = `https://www.unityalgo.com/blog/${post.slug}`;

    return {
        title,
        description,
        alternates: { canonical: url },
        openGraph: {
            title,
            description,
            url,
            siteName: 'UnityAlgo',
            images: [{ url: post.coverImage, width: 1200, height: 630, alt: post.title }],
            type: 'article',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [post.coverImage],
        },
    };
}

export default async function BlogDetailsPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const post = await getPost(slug);

    if (!post) {
        notFound();
    }

    const relatedPosts = await prisma.post.findMany({
        where: {
            published: true,
            slug: { not: post.slug },
            tags: post.tags.length > 0 ? { hasSome: post.tags } : undefined,
        },
        orderBy: { publishedAt: 'desc' },
        take: 3,
    });

    const breadcrumbs = generateBreadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Blog', path: '/blog' },
        { name: post.title, path: `/blog/${post.slug}` },
    ]);

    const articleStyle: CSSProperties | undefined = post.bgColor
        ? { backgroundColor: post.bgColor }
        : undefined;

    const proseStyle: CSSProperties | undefined = post.textColor
        ? ({
              color: post.textColor,
              '--tw-prose-body': post.textColor,
              '--tw-prose-headings': post.textColor,
              '--tw-prose-bold': post.textColor,
              '--tw-prose-counters': post.textColor,
              '--tw-prose-bullets': post.textColor,
              '--tw-prose-quotes': post.textColor,
              '--tw-prose-quote-borders': post.textColor,
              '--tw-prose-links': post.textColor,
          } as CSSProperties)
        : undefined;

    return (
        <div className="bg-background text-foreground min-h-screen overflow-hidden">
            <Script
                id="blog-post-breadcrumbs"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
            />

            <Header />

            <main>
                <article className="pt-32 pb-20 px-4" style={articleStyle}>
                    <div className="site-container site-container-reading">
            

                        <h1
                            className="text-lg md:text-3xl font-bold tracking-tight mb-6 text-balance"
                            style={post.textColor ? { color: post.textColor } : undefined}
                        >
                            {post.title}
                        </h1>

                        {post.publishedAt && (
                            <p
                                className="text-sm text-ink-400 mb-10"                            >
                                {formatDate(post.publishedAt)}
                            </p>
                        )}

                        <div className="relative aspect-[16/9] bg-ink-100 rounded-xl overflow-hidden mb-12">
                            {/* The post's LCP element — priority so it is not
                                queued behind the rest of the page's requests. */}
                            {post.coverImage ? (
                                <Image
                                    src={post.coverImage}
                                    alt={post.title}
                                    fill
                                    priority
                                    sizes="(min-width: 768px) 768px, 100vw"
                                    className="object-cover"
                                />
                            ) : null}
                        </div>

                        <div
                            className="prose prose-lg max-w-none text-ink-700 leading-relaxed [&_h2]: [&_h2]:font-bold [&_h2]:text-2xl [&_h2]:mt-10 [&_h2]:mb-4 [&_p]:mb-4 [&_a]:text-brand"
                            style={proseStyle}
                            dangerouslySetInnerHTML={{ __html: post.content }}
                        />
                    </div>
                </article>

                {relatedPosts.length > 0 && (
                    <section className="bg-ink-50 border-t border-ink-100 px-4 site-section-spacing">
                        <div className="site-container site-container-wide">
                            <h2 className="text-3xl font-bold mb-12">Related Blogs</h2>
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                {relatedPosts.map((related) => (
                                    <BlogCard key={related.id} post={related} />
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                <section className="py-16 px-4 text-center">
                    <Link href="/blog" className="text-link font-semibold hover:underline">
                        &larr; Back to all posts
                    </Link>
                </section>
            </main>

            <Footer />
        </div>
    );
}
