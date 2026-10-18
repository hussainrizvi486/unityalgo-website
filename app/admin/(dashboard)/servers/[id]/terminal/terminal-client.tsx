'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, PlugZap, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mintTerminalTokenAction } from '@/app/admin/controller-actions';
import '@xterm/xterm/css/xterm.css';

type Phase = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

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

            const styles = getComputedStyle(containerRef.current);
            const term = new Terminal({
                fontSize: parseFloat(styles.getPropertyValue('--portal-terminal-font-size')),
                fontFamily: styles.getPropertyValue('--portal-terminal-font-family').trim(),
                theme: {
                    background: styles.getPropertyValue('--scrim').trim(),
                    foreground: styles.getPropertyValue('--on-scrim').trim(),
                },
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

            socket.binaryType = 'arraybuffer';

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
            <div className="flex items-center justify-between gap-3 rounded-t-xl border border-foreground bg-primary px-4 py-2.5">
                <div className="flex items-center gap-2 portal-text-caption text-primary-foreground/60">
                    <span
                        className={`h-2 w-2 rounded-full ${
                            phase === 'open' ? 'bg-success' : phase === 'connecting' ? 'bg-warning' : 'bg-muted-foreground'
                        }`}
                    />
                    {phase === 'open' ? `Connected to ${serverName}` : phase === 'connecting' ? 'Connecting…' : 'Not connected'}
                </div>
                {phase === 'idle' ? (
                    <Button size="sm" onClick={() => setAttempt((n) => n + 1)} className="gap-1.5 bg-card text-foreground hover:bg-secondary">
                        <PlugZap className="h-3.5 w-3.5" />Connect
                    </Button>
                ) : (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAttempt((n) => n + 1)}
                        disabled={phase === 'connecting'}
                        className="gap-1.5 border-primary-foreground/20 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                    >
                        {phase === 'connecting' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                        Reconnect
                    </Button>
                )}
            </div>

            <div className="rounded-b-xl border border-t-0 border-foreground bg-primary p-3">
                {phase === 'idle' ? (
                    <div className="flex h-96 items-center justify-center portal-text-body text-primary-foreground/40">
                        Press Connect to open a shell on {serverName}.
                    </div>
                ) : (
                    <div ref={containerRef} className="h-96" />
                )}
            </div>

            {message ? (
                <p className={`mt-3 portal-text-body ${phase === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>{message}</p>
            ) : null}

            <p className="mt-3 portal-text-caption text-muted-foreground">
                Access is granted by a single-server token that expires in 60 seconds; reconnecting mints a new one.
                Every session is recorded in the <Link href="/admin/logs?category=terminal" className="text-primary hover:underline">activity log</Link>.
            </p>
        </div>
    );
}
