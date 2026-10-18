import Image from 'next/image';
import { imageSourceProps } from '@/lib/image-hosts';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { Header, Footer } from '@/components/layouts';
import { BlogCard } from '@/components/website/blog-card';
import { and, arrayOverlaps, desc, eq, ne } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { generateBreadcrumbJsonLd } from '@/lib/metadata';

export const revalidate = 60;

function formatDate(date: Date | null) {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

async function getPost(slug: string) {
    return db.query.post.findFirst({ where: and(eq(schema.post.slug, slug), eq(schema.post.published, true)) });
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

    const tags = post.tags ?? [];
    const relatedPosts = await db.query.post.findMany({
        where: and(
            eq(schema.post.published, true),
            ne(schema.post.slug, post.slug),
            // Sharing at least one tag; with no tags of its own, any other post will do.
            tags.length > 0 ? arrayOverlaps(schema.post.tags, tags) : undefined,
        ),
        orderBy: desc(schema.post.publishedAt),
        limit: 3,
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
                <article className="pt-hero pb-section px-page" style={articleStyle}>
                    <div className="site-container site-container-reading">
            

                        <h1
                            className="text-lg md:text-3xl tracking-tight mb-6 text-balance"
                            style={post.textColor ? { color: post.textColor } : undefined}
                        >
                            {post.title}
                        </h1>

                        {post.publishedAt && (
                            <p
                                className="text-sm text-muted-foreground mb-10"                            >
                                {formatDate(post.publishedAt)}
                            </p>
                        )}

                        <div className="relative aspect-16/9 bg-secondary rounded-xl overflow-hidden mb-12">
                            {}
                            {post.coverImage ? (
                                <Image
                                    src={post.coverImage}
                                    {...imageSourceProps(post.coverImage)}
                                    alt={post.title}
                                    fill
                                    priority
                                    sizes="(min-width: 768px) 768px, 100vw"
                                    className="object-cover"
                                />
                            ) : null}
                        </div>

                        <div
                            className="prose prose-lg max-w-none text-foreground/80 leading-relaxed [&_h2]: [&_h2]:font-bold [&_h2]:text-2xl [&_h2]:mt-10 [&_h2]:mb-4 [&_p]:mb-4 [&_a]:text-primary"
                            style={proseStyle}
                            dangerouslySetInnerHTML={{ __html: post.content }}
                        />
                    </div>
                </article>

                {relatedPosts.length > 0 && (
                    <section className="bg-muted border-t border-border/60 px-page site-section-spacing">
                        <div className="site-container site-container-wide">
                            <h2 className="text-3xl mb-12">Related Blogs</h2>
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-gap-xl">
                                {relatedPosts.map((related) => (
                                    <BlogCard key={related.id} post={related} />
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                <section className="py-section px-page text-center">
                    <Link href="/blog" className="text-primary font-semibold hover:underline">
                        &larr; Back to all posts
                    </Link>
                </section>
            </main>

            <Footer />
        </div>
    );
}
