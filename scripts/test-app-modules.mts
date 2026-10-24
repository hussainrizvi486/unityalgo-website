import assert from 'node:assert/strict';
import { installKeyFor, moduleKey, parseModuleList, unionModules } from '../lib/app-modules';

let n = 0; const ok = (name: string, fn: () => void) => { fn(); n++; console.log(`ok ${name}`); };

ok('module names typed one per line or comma-separated are cleaned and de-duplicated', () => {
    assert.deepEqual(parseModuleList('Manufacturing\n  Selling \nManufacturing,Stock Settings\n\n').modules, ['Manufacturing', 'Selling', 'Stock Settings']);
    assert.deepEqual(parseModuleList('').modules, []);
    assert.deepEqual(parseModuleList('  Two   Spaces ').modules, ['Two Spaces']);
});
ok('an unsafe or malformed module name is rejected with the name in the message', () => {
    for (const bad of ['; drop table', 'x'.repeat(61), '"quoted"', '<script>', '-leading']) {
        const result = parseModuleList(`Good\n${bad}`);
        assert.ok(result.error && result.modules.length === 0, bad);
    }
    assert.match(parseModuleList('Fine\n$$bad').error ?? '', /\$\$bad/);
});
ok('too many modules are refused', () => assert.match(parseModuleList(Array.from({ length: 101 }, (_, i) => `Module ${i}`).join('\n')).error ?? '', /at most 100/));
ok('an entry is recognised on a site by app name, or by id for a module', () => {
    assert.equal(installKeyFor({ appType: 'application', id: 'a1', frappeAppName: 'hrms' }), 'hrms');
    assert.equal(installKeyFor({ appType: 'module', id: 'a2', frappeAppName: null }), moduleKey('a2'));
    assert.equal(installKeyFor({ appType: 'application', id: 'a3', frappeAppName: null }), '');
});
ok('the union keeps every module once', () => assert.deepEqual(unionModules([['A', 'B'], ['B', 'C'], []]), ['A', 'B', 'C']));
console.log(`${n} app module checks passed`);
