import 'dotenv/config';
import { diagnoseConnectionError, runDatabaseStartupCheck, safeDatabaseUrl } from '../lib/db-startup-check';

let failed = 0;
function check(name: string, ok: boolean, detail = '') {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`);
    if (!ok) failed++;
}

const cases: [Record<string, string>, string][] = [
    [{ code: '28P01', message: 'password authentication failed for user "x"' }, 'username or password'],
    [{ code: '3D000', message: 'database "foo" does not exist' }, 'no database with that name'],
    [{ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:5432' }, 'Nothing is accepting connections'],
    [{ code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND nope' }, 'could not be resolved'],
    [{ code: '28000', message: 'no pg_hba.conf entry' }, 'pg_hba.conf'],
    [{ code: '53300', message: 'too many clients' }, 'out of connections'],
];
for (const [error, expected] of cases) check(`diagnoses ${error.code}`, diagnoseConnectionError(error).includes(expected), diagnoseConnectionError(error));
check('an unknown failure still says something', diagnoseConnectionError(new Error('odd')).includes('does not recognise'));
check('hides the password', !safeDatabaseUrl('postgresql://u:secret@h:5432/d').includes('secret'));

const down = await runDatabaseStartupCheck('postgresql://nobody:secret@127.0.0.1:1/missing');
check('an unreachable database fails with a diagnosis', !down.ok && down.lines.some((line) => line.includes('diagnosis:')));
check('and never prints the password', !down.lines.join('\n').includes('secret'));

const up = await runDatabaseStartupCheck();
check('the configured database passes', up.ok, up.lines.join(' | '));

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
