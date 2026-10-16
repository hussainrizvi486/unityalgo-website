import Image from 'next/image';
import Link from 'next/link';

export interface BlogCardPost {
    slug: string;
    title: string;
    excerpt: string;
    coverImage: string;
    publishedAt: Date | null;
    tags: string[];
}

function formatDate(date: Date | null) {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

export function BlogCard({ post }: { post: BlogCardPost }) {
    return (
        <Link
            href={`/blog/${post.slug}`}
            className="group flex flex-col rounded border bg-muted border-border/60 overflow-hidden hover:shadow-md hover:shadow-foreground/5 hover:border-primary/25 transition-all duration-300"
        >
            <div className="aspect-16/10 bg-secondary relative overflow-hidden">
                {/* A listing renders many of these, so serving the originals
                    raw multiplies the cost by the number of posts. `sizes`
                    describes the three-column grid so each card pulls a
                    variant near its rendered width rather than the full file. */}
                {post.coverImage ? (
                    <Image
                        src={post.coverImage}
                        alt={post.title}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                ) : null}
            </div>
            <div className="p-6">
                <h3 className="text-lg text-foreground group-hover:opacity-75 transition-colors mb-2">
                    {post.title}
                </h3>
                <p className="text-sm text-foreground/70 leading-relaxed line-clamp-3">{post.excerpt}</p>
                {post.publishedAt && (
                    <span className="text-xs text-muted-foreground mt-2">{formatDate(post.publishedAt)}</span>
                )}
            </div>
        </Link>
    );
}
