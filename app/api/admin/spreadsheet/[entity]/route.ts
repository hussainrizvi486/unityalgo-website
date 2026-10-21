import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdminSession } from '@/lib/admin-session';
import { MAX_IMPORT_BYTES, SpreadsheetError, XLSX_TYPE, buildWorkbook, readWorkbook } from '@/lib/spreadsheet';
import { ENTITIES, exportLeads, exportPlans, importLeads, importPlans } from '@/lib/spreadsheet-entities';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ entity: string }> };

async function resolve(request: NextRequest, context: Context) {
    if (!(await isAdminSession())) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    const { entity } = await context.params;
    if (entity !== 'leads' && entity !== 'plans') return { error: NextResponse.json({ error: 'Unknown data type' }, { status: 404 }) };
    return { entity, definition: ENTITIES[entity] };
}

/** Downloads the data as .xlsx, or an empty template with `?template=1`. */
export async function GET(request: NextRequest, context: Context) {
    const found = await resolve(request, context);
    if ('error' in found) return found.error;
    const { entity, definition } = found;
    const url = new URL(request.url);
    const template = url.searchParams.get('template') === '1';

    const rows = template ? [] : entity === 'leads' ? await exportLeads(url.searchParams.get('status') ?? undefined) : await exportPlans();
    const bytes = await buildWorkbook(definition.sheet, [...definition.columns], rows, [
        'Row 1 holds the column names: keep them as they are. Column order does not matter and unused columns can be removed.',
        'Rows with a problem are skipped and listed after the import, the rest are saved.',
    ]);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(bytes), {
        headers: {
            'Content-Type': XLSX_TYPE,
            'Content-Disposition': `attachment; filename="${definition.file}${template ? '-template' : `-${stamp}`}.xlsx"`,
            'Cache-Control': 'no-store',
        },
    });
}

/** Imports an uploaded .xlsx file and reports what changed. */
export async function POST(request: NextRequest, context: Context) {
    const found = await resolve(request, context);
    if ('error' in found) return found.error;
    const { entity, definition } = found;

    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    if (file.size > MAX_IMPORT_BYTES) return NextResponse.json({ error: 'The file is larger than 5 MB.' }, { status: 400 });

    try {
        const { rows, columns } = await readWorkbook(Buffer.from(await file.arrayBuffer()), [...definition.columns]);
        const result = entity === 'leads' ? await importLeads(rows, new Set(columns)) : await importPlans(rows, new Set(columns));
        if (entity === 'leads') revalidatePath('/admin/leads');
        else {
            revalidatePath('/admin/plans');
            revalidatePath('/dashboard/plans');
            revalidatePath('/');
        }
        return NextResponse.json({ ...result, total: rows.length });
    } catch (error) {
        if (error instanceof SpreadsheetError) return NextResponse.json({ error: error.message }, { status: 400 });
        console.error('Spreadsheet import failed:', error);
        return NextResponse.json({ error: 'The import failed. Nothing further was saved.' }, { status: 500 });
    }
}
