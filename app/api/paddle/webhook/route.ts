import { NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { asRecord, asString } from '@/lib/paddle-data';
import { HANDLED_PADDLE_EVENTS, paddleWebhookSecret, verifyPaddleSignature } from '@/lib/paddle';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    const rawBody = await request.text();
    const secret = paddleWebhookSecret();
    if (!secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    if (!verifyPaddleSignature(rawBody, request.headers.get('paddle-signature'), secret)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    let event: Record<string, unknown>;
    try { event = asRecord(JSON.parse(rawBody)); }
    catch { return NextResponse.json({ error: 'Malformed payload' }, { status: 400 }); }
    const id = asString(event.event_id);
    const type = asString(event.event_type);
    if (!id || !type || !asString(asRecord(event.data).id)) {
        return NextResponse.json({ error: 'Malformed payload' }, { status: 400 });
    }
    try {
        const handled = HANDLED_PADDLE_EVENTS.has(type);
        await db.insert(schema.paddleEvent).values({
            id, eventType: type, payload: event, status: handled ? 'PENDING' : 'IGNORED',
            ...(handled ? {} : { processedAt: new Date() }),
        }).onConflictDoNothing();

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: 'Could not persist event' }, { status: 503 });
    }
}
