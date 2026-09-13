import { PlugZap } from 'lucide-react';

/**
 * Shown when the controller API cannot be reached.
 *
 * The controller runs as a separate Python process, so it can be down while
 * the rest of the admin panel is perfectly healthy. Saying so plainly — with
 * the command to start it — is far more useful than an error boundary.
 */
export function ControllerOffline({ message }: { message: string }) {
    return (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-warning-500/40 bg-warning-50 p-8 text-center">
            <PlugZap className="h-10 w-10 text-warning-600" />
            <h2 className="mt-4 text-lg font-bold text-ink-900">Controller API unavailable</h2>
            <p className="mt-2 max-w-lg text-sm text-warning-700">{message}</p>
            <pre className="mt-5 rounded-md bg-white/70 px-4 py-3 text-left text-xs text-ink-700">
                cd controller{'\n'}
                source env/bin/activate{'\n'}
                python main.py serve
            </pre>
        </div>
    );
}
