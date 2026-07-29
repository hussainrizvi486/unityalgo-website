export const ADMIN_PAGE_SIZE = 50;

export function parsePage(value: string | undefined) {
    const page = Number(value);
    return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export function totalPagesFor(totalCount: number, pageSize: number = ADMIN_PAGE_SIZE) {
    return Math.max(1, Math.ceil(totalCount / pageSize));
}
