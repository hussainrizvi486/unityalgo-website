'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, PlugZap, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mintTerminalTokenAction } from '@/app/admin/controller-actions';
import '@xterm/xterm/css/xterm.css';

type Phase = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

/**
 * Browser SSH terminal, talking directly to the controller's WebSocket
 * service.
 *
 * This is the one place the browser contacts the controller without going
 * through a Server Action — a WebSocket cannot be proxied through one. It
 * therefore never sees the internal API key: instead it asks the server for a
 * short-lived grant (mintTerminalTokenAction), scoped to this one server and
 * valid for ~60 seconds, and presents that on the handshake.
 *
 * xterm.js is imported dynamically because it touches `window` at module
 * scope, which would break server rendering.
 */
export function TerminalClient({ serverId, serverName }: { serverId: string; serverName: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const [phase, setPhase] = useState<Phase>('idle');
    const [message, setMessage] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (attempt === 0) return;

        let disposed = false;
        let cleanupFns: Array<() => void> = [];

        (async () => {
            setPhase('connecting');
            setMessage(null);

            const { Terminal } = await import('@xterm/xterm');
            const { FitAddon } = await import('@xterm/addon-fit');
            if (disposed || !containerRef.current) return;

            const term = new Terminal({
                fontSize: 13,
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                theme: { background: '#151515', foreground: '#F0F0F0' },
                cursorBlink: true,
            });
            const fit = new FitAddon();
            term.loadAddon(fit);
            term.open(containerRef.current);
            fit.fit();

            let grant: { token: string; url: string };
            try {
                grant = await mintTerminalTokenAction(serverId);
            } catch {
                if (!disposed) {
                    setPhase('error');
                    setMessage('Could not obtain a terminal grant.');
                }
                term.dispose();
                return;
            }
            if (disposed) {
                term.dispose();
                return;
            }

            const socket = new WebSocket(
                `${grant.url}/ws/terminal/${serverId}?token=${encodeURIComponent(grant.token)}`,
            );
            socketRef.current = socket;

            socket.onopen = () => {
                if (disposed) return;
                setPhase('open');
                // Tell the PTY our size, using the control-frame convention the
                // Python side expects (a JSON frame starting with `{"resize"`).
                const send = () => {
                    fit.fit();
                    socket.send(JSON.stringify({ resize: [term.cols, term.rows] }));
                };
                send();
                const onResize = () => send();
                window.addEventListener('resize', onResize);
                cleanupFns.push(() => window.removeEventListener('resize', onResize));
                term.focus();
            };

            // The PTY writes raw bytes, so frames arrive binary. Take them as
            // ArrayBuffer rather than the default Blob: Blob.text() is async,
            // and awaiting it per frame lets two chunks resolve out of order,
            // which scrambles terminal output.
            socket.binaryType = 'arraybuffer';

            // A single UTF-8 character can be split across two frames, so the
            // decoder is kept across messages with stream: true — decoding
            // each frame independently would corrupt any multi-byte character
            // that straddles a boundary.
            const decoder = new TextDecoder('utf-8');

            socket.onmessage = (event) => {
                if (typeof event.data === 'string') {
                    term.write(event.data);
                } else {
                    term.write(decoder.decode(event.data as ArrayBuffer, { stream: true }));
                }
            };

            socket.onerror = () => {
                if (disposed) return;
                setPhase('error');
                setMessage('WebSocket error. Is the terminal service running (python ws_terminal_main.py)?');
            };

            socket.onclose = (event) => {
                if (disposed) return;
                setPhase('closed');
                setMessage(
                    event.code === 1008 || event.code === 1011
                        ? `Connection refused: ${event.reason || 'unauthorized'}`
                        : `Session ended${event.reason ? `: ${event.reason}` : ''}.`,
                );
            };

            const keystrokes = term.onData((data) => {
                if (socket.readyState === WebSocket.OPEN) socket.send(data);
            });
            cleanupFns.push(() => keystrokes.dispose());
            cleanupFns.push(() => term.dispose());
        })();

        return () => {
            disposed = true;
            cleanupFns.forEach((fn) => fn());
            cleanupFns = [];
            socketRef.current?.close();
            socketRef.current = null;
        };
    }, [serverId, attempt]);

    return (
        <div>
            <div className="flex items-center justify-between gap-3 rounded-t-xl border border-ink-800 bg-ink-950 px-4 py-2.5">
                <div className="flex items-center gap-2 text-xs text-white/60">
                    <span
                        className={`h-2 w-2 rounded-full ${
                            phase === 'open' ? 'bg-success-500' : phase === 'connecting' ? 'bg-warning-500' : 'bg-ink-500'
                        }`}
                    />
                    {phase === 'open' ? `Connected to ${serverName}` : phase === 'connecting' ? 'Connecting…' : 'Not connected'}
                </div>
                {phase === 'idle' ? (
                    <Button size="sm" onClick={() => setAttempt((n) => n + 1)} className="gap-1.5 bg-white text-ink-900 hover:bg-ink-100">
                        <PlugZap className="h-3.5 w-3.5" />Connect
                    </Button>
                ) : (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAttempt((n) => n + 1)}
                        disabled={phase === 'connecting'}
                        className="gap-1.5 border-white/20 bg-transparent text-white hover:bg-white/10"
                    >
                        {phase === 'connecting' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                        Reconnect
                    </Button>
                )}
            </div>

            <div className="rounded-b-xl border border-t-0 border-ink-800 bg-ink-950 p-3">
                {phase === 'idle' ? (
                    <div className="flex h-96 items-center justify-center text-sm text-white/40">
                        Press Connect to open a shell on {serverName}.
                    </div>
                ) : (
                    <div ref={containerRef} className="h-96" />
                )}
            </div>

            {message ? (
                <p className={`mt-3 text-sm ${phase === 'error' ? 'text-error-700' : 'text-ink-500'}`}>{message}</p>
            ) : null}

            <p className="mt-3 text-xs text-ink-400">
                Access is granted by a single-server token that expires in 60 seconds; reconnecting mints a new one.
                Every session is recorded in the <a href="/admin/logs?category=terminal" className="text-link hover:underline">activity log</a>.
            </p>
        </div>
    );
}
