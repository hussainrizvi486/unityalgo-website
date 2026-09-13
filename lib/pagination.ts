export const ADMIN_PAGE_SIZE = 50;

/**
 * Hard cap on rows fetched for an admin list.
 *
 * The list views sort, search and paginate in the browser (AG Grid Community
 * has no server-side row model), so the server hands over the whole set rather
 * than one page. This bounds that: a list at the cap tells the reader it is
 * truncated instead of quietly hiding rows.
 */
export const ADMIN_LIST_LIMIT = 2000;

export function parsePage(value: string | undefined) {
    const page = Number(value);
    return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export function totalPagesFor(totalCount: number, pageSize: number = ADMIN_PAGE_SIZE) {
    return Math.max(1, Math.ceil(totalCount / pageSize));
}
