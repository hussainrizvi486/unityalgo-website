/**
 * Behind a reverse proxy the server only sees its own address in `request.url` (for example http://localhost:2424),
 * while the browser's `Origin` header carries the public address. Compare against what the proxy forwarded, so a
 * same-site request is accepted and a request from another site is not. Browsers cannot forge `Origin` from a page.
 */
function firstValue(header: string | null) {
    return header?.split(',')[0]?.trim() || null;
}

function hostOf(request: Request) {
    return firstValue(request.headers.get('x-forwarded-host')) ?? firstValue(request.headers.get('host')) ?? new URL(request.url).host;
}

/** The address the visitor used, for building absolute redirects. */
export function publicOrigin(request: Request) {
    const proto = firstValue(request.headers.get('x-forwarded-proto')) ?? new URL(request.url).protocol.replace(':', '');
    return `${proto}://${hostOf(request)}`;
}

/** True when the request was sent by a page on this same site. A missing Origin header is refused. */
export function isSameOrigin(request: Request) {
    const origin = request.headers.get('origin');
    if (!origin) return false;
    try {
        const sent = new URL(origin).host;
        return sent === hostOf(request) || sent === new URL(request.url).host;
    } catch {
        return false;
    }
}
