#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const ALLOW = new Set(['app/globals.css', 'lib/design-tokens.generated.ts']);

const RULES = [
    ['literal colour', /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b(?![-\w])/g, (line) => /href=|id=|url\(|#[a-z]+-/.test(line) && !/#[0-9a-fA-F]{6}\b/.test(line)],
    ['literal colour function', /\b(?:rgba?|hsla?|oklch|oklab)\(\s*\d/g],
    ['retired palette class', /(?<![\w-])(?:[a-z-]+:)*(?:text|bg|border|ring|divide|from|to|via|fill|stroke|outline|shadow|decoration)-(?:ink|brand|gold|link|white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-[a-z0-9]+)?(?:\/\d+)?(?![\w-])/g],
    ['retired status shade', /(?<![\w-])(?:text|bg|border|ring|from|to|via)-(?:success|warning|error|info)-\d{2,3}(?![\w-])/g],
    ['retired theme variable', /var\(--color-(?:ink|brand|gold|link|success|warning|error|info)/g],
    ['arbitrary length in a class', /(?<![\w-])[a-z:&>*()\[\]=-]*-\[(?![^\]]*var\(--)[^\]\s]*\d(?:px|rem|em)\b[^\]]*\]/g],
];

function* files(dir) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (name === 'node_modules' || name === '.next') continue;
        if (statSync(path).isDirectory()) yield* files(path);
        else if (/\.(tsx?|css)$/.test(name)) yield path;
    }
}

const problems = [];
for (const top of ['app', 'components', 'lib']) {
    for (const file of files(join(root, top))) {
        const rel = relative(root, file);
        if (ALLOW.has(rel)) continue;
        readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
            if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;                       // comments
            for (const [label, pattern, skip] of RULES) {
                for (const match of line.matchAll(pattern)) {
                    if (skip?.(line)) continue;
                    problems.push(`${rel}:${index + 1}  ${label}: ${match[0]}`);
                }
            }
        });
    }
}

if (problems.length) {
    console.error(problems.join('\n'));
    console.error(`\n${problems.length} hardcoded value(s). Use a design token (see app/globals.css).`);
    process.exit(1);
}
console.log('No hardcoded design values.');
