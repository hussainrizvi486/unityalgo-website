import 'dotenv/config';
import { runBillingWorker } from '../lib/billing-worker';
import { reconcilePaddleSubscription, reconcilePaddleTransaction, reconcileAllPaddleBilling } from '../lib/paddle-sync';
import { closeDb } from '../lib/db';
try {
    const argument = process.argv[2];
    if (argument === '--reconcile-all') await reconcileAllPaddleBilling();
    else if (argument && argument !== '--watch') {
        if (/^sub_[a-z0-9]+$/.test(argument)) await reconcilePaddleSubscription(argument);
        else if (/^txn_[a-z0-9]+$/.test(argument)) await reconcilePaddleTransaction(argument);
        else throw new Error('Expected --watch, --reconcile-all, or a Paddle subscription/transaction ID.');
    }
    do {
        try { console.log(await runBillingWorker()); }
        catch (error) { console.error(error instanceof Error ? error.message : 'Billing worker failed.'); if (argument !== '--watch') throw error; }
        if (argument !== '--watch') break;
        await new Promise((resolve) => setTimeout(resolve, 60_000));
    } while (true);
} finally { await closeDb(); }
