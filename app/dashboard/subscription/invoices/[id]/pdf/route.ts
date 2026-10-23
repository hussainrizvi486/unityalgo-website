import { NextResponse } from 'next/server';
import { getCustomerSession } from '@/lib/customer-session';
import { customerInvoicePdfUrl } from '@/lib/customer-billing';

export const dynamic = 'force-dynamic';

/** Sends the customer to a short-lived PDF of their own settled invoice. Anyone else gets a 404. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getCustomerSession();
    if (!session) return NextResponse.redirect(new URL('/login', request.url));
    const { id } = await params;
    try {
        const url = await customerInvoicePdfUrl(session.userId, id);
        if (url) return NextResponse.redirect(url);
    } catch {
        return NextResponse.redirect(new URL(`/dashboard/subscription/invoices/${encodeURIComponent(id)}?pdf=unavailable`, request.url));
    }
    return new NextResponse('Not found', { status: 404 });
}
