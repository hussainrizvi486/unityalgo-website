'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

type NotificationData = {
    unread: number;
    items: {
        id: string;
        title: string;
        body: string;
        href: string | null;
        read: boolean;
        createdAt: string;
    }[];
};
export function NotificationBell({ initial }: { initial: NotificationData }) {
    const [data, setData] = useState(initial);
    const [seenInitial, setSeenInitial] = useState(initial);
    if (initial !== seenInitial) {
        setSeenInitial(initial);
        setData(initial);
    }
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        async function refresh() {
            if (document.hidden) return;
            try {
                const response = await fetch('/api/customer/notifications', {
                    signal: controller.signal,
                });
                if (response.ok) setData(await response.json());
            } catch {
                /* Retain the last known notifications during an outage. */
            }
        }
        const timer = setInterval(refresh, 30_000);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            clearInterval(timer);
            controller.abort();
            document.removeEventListener('visibilitychange', refresh);
        };
    }, []);
    async function markRead(id?: string) {
        setBusy(true);
        try {
            const response = await fetch('/api/customer/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(id ? { id } : { all: true }),
            });
            if (!response.ok) throw new Error();
            setData(await response.json());
            setError('');
        } catch {
            setError('Could not update notifications. Please try again.');
        } finally {
            setBusy(false);
        }
    }
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    aria-label={`Notifications, ${data.unread} unread`}
                >
                    <Bell className="size-5" />
                    {data.unread > 0 && (
                        <span className="absolute -right-1 -top-1 rounded-full bg-brand px-1.5 portal-text-micro text-white">
                            {data.unread > 99 ? '99+' : data.unread}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                className="w-[min(380px,calc(100vw-2rem))] p-0"
            >
                <div className="flex items-center justify-between border-b border-ink-200 p-4">
                    <h2 className="font-semibold">Notifications</h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy || !data.unread}
                        onClick={() => markRead()}
                    >
                        <CheckCheck className="size-4" />
                        Mark all read
                    </Button>
                </div>
                {error && (
                    <p role="alert" className="p-3 portal-text-caption text-error-700">
                        {error}
                    </p>
                )}
                <div className="max-h-96 overflow-y-auto">
                    {data.items.length ? (
                        data.items.map((item) => (
                            <div
                                key={item.id}
                                className={`border-b border-ink-100 p-4 last:border-0 ${item.read ? '' : 'bg-ink-50'}`}
                            >
                                <p className="portal-text-body font-semibold">
                                    {item.title}
                                </p>
                                <p className="mt-1 portal-text-caption leading-5 text-ink-600">
                                    {item.body}
                                </p>
                                <div className="mt-2 flex items-center justify-between portal-text-caption">
                                    <time
                                        dateTime={item.createdAt}
                                        className="text-ink-500"
                                    >
                                        {new Date(
                                            item.createdAt,
                                        ).toLocaleDateString()}
                                    </time>
                                    {item.href && (
                                        <Link
                                            href={item.href}
                                            className="font-medium text-brand"
                                            onClick={() => {
                                                if (!item.read)
                                                    void markRead(item.id);
                                            }}
                                        >
                                            View site
                                        </Link>
                                    )}
                                    {!item.read && (
                                        <button
                                            disabled={busy}
                                            onClick={() => markRead(item.id)}
                                            className="text-ink-600 hover:underline"
                                        >
                                            Mark read
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="p-8 text-center portal-text-body text-ink-500">
                            You are all caught up. Site updates will appear
                            here.
                        </p>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
