import 'server-only';
import ExcelJS from 'exceljs';

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;

export interface SheetColumn {
    header: string;
    width?: number;
    /** Shown on the template's "Guide" sheet. */
    note?: string;
}

export interface ImportResult {
    created: number;
    updated: number;
    skipped: number;
    errors: { line: number; message: string }[];
}

export class SpreadsheetError extends Error {}

export type Cell = string | number | boolean | Date | null;

/**
 * Cells are written as typed values, never as formulas, so text from a customer such as `=HYPERLINK(...)` is stored
 * as a string and Excel will not evaluate it.
 */
export async function buildWorkbook(sheetName: string, columns: SheetColumn[], rows: Cell[][], guide?: string[]) {
    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = columns.map((column) => ({ header: column.header, width: column.width ?? 18 }));
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF9' } };
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

    const notes = columns.filter((column) => column.note);
    if (notes.length || guide?.length) {
        const help = workbook.addWorksheet('Guide');
        help.columns = [{ header: 'Column', width: 26 }, { header: 'What to enter', width: 90 }];
        help.getRow(1).font = { bold: true };
        for (const column of notes) help.addRow([column.header, column.note]);
        if (guide?.length) {
            help.addRow([]);
            for (const line of guide) help.addRow(['', line]);
        }
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

function cellText(value: ExcelJS.CellValue): string {
    if (value == null) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') {
        if ('richText' in value) return value.richText.map((part) => part.text).join('');
        if ('result' in value) return value.result == null ? '' : cellText(value.result as ExcelJS.CellValue);
        if ('text' in value) return String(value.text ?? '');
        if ('error' in value) return '';
    }
    return String(value).trim();
}

/** Reads the first sheet into rows keyed by the expected column headers, ignoring case and punctuation. */
export async function readWorkbook(bytes: Buffer, columns: SheetColumn[]) {
    if (bytes.length === 0) throw new SpreadsheetError('The file is empty.');
    if (bytes.length > MAX_IMPORT_BYTES) throw new SpreadsheetError('The file is larger than 5 MB.');
    // An .xlsx file is a zip archive; anything else, including the older .xls format, is refused.
    if (bytes.subarray(0, 2).toString('latin1') !== 'PK') throw new SpreadsheetError('Upload an Excel .xlsx file.');

    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
    } catch {
        throw new SpreadsheetError('The file could not be read as an Excel .xlsx workbook.');
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new SpreadsheetError('The workbook has no sheets.');

    const byName = new Map(columns.map((column) => [normalize(column.header), column.header]));
    const positions = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, index) => {
        const header = byName.get(normalize(cellText(cell.value)));
        if (header && !positions.has(header)) positions.set(header, index);
    });
    if (positions.size === 0) {
        throw new SpreadsheetError(`No known columns found in row 1. Expected headers such as: ${columns.slice(0, 4).map((column) => column.header).join(', ')}.`);
    }
    if (sheet.rowCount - 1 > MAX_IMPORT_ROWS) throw new SpreadsheetError(`Import at most ${MAX_IMPORT_ROWS} rows at a time.`);

    const rows: { line: number; values: Record<string, string> }[] = [];
    for (let line = 2; line <= sheet.rowCount; line++) {
        const row = sheet.getRow(line);
        const values: Record<string, string> = {};
        for (const [header, index] of positions) values[header] = cellText(row.getCell(index).value);
        if (Object.values(values).some(Boolean)) rows.push({ line, values });
    }
    return { rows, columns: [...positions.keys()] };
}
