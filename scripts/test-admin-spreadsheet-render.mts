/** Regression: opening an admin list must not read an import report before one exists. */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { SpreadsheetActions } from '../components/admin/spreadsheet-actions';
const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, async prefetch() {} };
for (const entity of ['plans', 'leads'] as const) {
    const html = renderToString(createElement(AppRouterContext.Provider, { value: router }, createElement(SpreadsheetActions, { entity })));
    assert.match(html, /Export/);
    assert.match(html, /Import/);
    assert.match(html, new RegExp(`/api/admin/spreadsheet/${entity}`));
    console.log(`ok ${entity} list spreadsheet controls render before any import`);
}
