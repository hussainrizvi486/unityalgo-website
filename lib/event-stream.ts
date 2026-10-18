import 'server-only';

export function eventStream(
    request: Request,
    read: () => Promise<unknown | null>,
    options: { fastMs?: number; slowMs?: number; busy?: (value: unknown) => boolean; heartbeatMs?: number } = {},
) {
    const { fastMs = 2000, slowMs = 6000, busy = () => true, heartbeatMs = 15_000 } = options;
    const encoder = new TextEncoder();

    const body = new ReadableStream<Uint8Array>({
        async start(controller) {
            let closed = false;
            let last = '';
            let lastSent = Date.now();
            const send = (text: string) => {
                if (closed) return;
                controller.enqueue(encoder.encode(text));
                lastSent = Date.now();
            };
            const close = () => {
                if (closed) return;
                closed = true;
                try { controller.close(); } catch { /* already closed */ }
            };
            request.signal.addEventListener('abort', close);
            send('retry: 3000\n\n');

            while (!closed) {
                let wait = fastMs;
                try {
                    const value = await read();
                    if (value === null) {
                        send('event: gone\ndata: {}\n\n');
                        close();
                        break;
                    }
                    const text = JSON.stringify(value);
                    if (text !== last) {
                        last = text;
                        send(`data: ${text}\n\n`);
                    }
                    wait = busy(value) ? fastMs : slowMs;
                } catch {
                    wait = slowMs;
                }
                // A comment line keeps proxies from closing a quiet connection.
                if (Date.now() - lastSent > heartbeatMs) send(': keep-alive\n\n');
                await new Promise((resolve) => setTimeout(resolve, wait));
            }
        },
        cancel() {
            /* the browser went away; the loop sees `closed` through the abort listener */
        },
    });

    return new Response(body, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'private, no-store, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
