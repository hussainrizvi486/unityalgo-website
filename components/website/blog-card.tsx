// import Image from 'next/image';
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
            className="group flex flex-col rounded-md border bg-ink-50 border-ink-100 overflow-hidden hover:shadow-md hover:shadow-ink-900/5 hover:border-brand/25 transition-all duration-300"
        >
            <div className="aspect-16/10 bg-ink-100 relative overflow-hidden">
                <img
                    src={post.coverImage}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
            </div>
            <div className="p-6">
                <h3 className="text-lg font-bold text-ink-900 group-hover:opacity-75 transition-colors mb-2">
                    {post.title}
                </h3>
                <p className="text-sm text-ink-600 leading-relaxed line-clamp-3">{post.excerpt}</p>
                {post.publishedAt && (
                    <span className="text-xs text-ink-400 mt-2">{formatDate(post.publishedAt)}</span>
                )}
            </div>
        </Link>
    );
}
