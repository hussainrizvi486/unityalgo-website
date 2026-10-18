const EXTRA = (process.env.NEXT_IMAGE_HOSTS ?? '').split(',').map((host) => host.trim()).filter(Boolean);

export const IMAGE_HOSTS = ['lh3.googleusercontent.com', 'diffco.us', 'www.sap.com', ...EXTRA];

export function imageSourceProps(src: string): { unoptimized?: true } {
    if (!/^https?:\/\//i.test(src)) return {};
    try {
        return IMAGE_HOSTS.includes(new URL(src).hostname) ? {} : { unoptimized: true };
    } catch {
        return { unoptimized: true };
    }
}
