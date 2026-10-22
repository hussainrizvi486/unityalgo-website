/** Share the application database with local controller processes. */
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const [entry, ...args] = process.argv.slice(2);
if (!['main.py', 'ws_terminal_main.py'].includes(entry)) throw new Error('Unknown controller entry point.');
const child = spawn('env/bin/python', [entry, ...args], {
    cwd: resolve('controller'), env: { ...process.env, APP_PORT: process.env.CONTROLLER_PORT ?? '8000' }, stdio: 'inherit',
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', () => { console.error('Local controller could not start. Check controller/env.'); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
