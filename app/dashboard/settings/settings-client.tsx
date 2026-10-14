'use client';
import Link from 'next/link';
import { PortalPanel } from '@/components/customer/portal-panel';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Monitor, Smartphone, LogOut } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Badge } from '@/components/ui/badge';
import { ProfileForm } from './profile/profile-form';
import { PasswordForm } from './password/password-form';
import { revokeSessionAction } from '../actions';

type Profile = {
    firstName: string;
    lastName: string;
    email: string;
    username: string;
    phone: string;
    company: string;
    companyEmail: string;
};
type Session = {
    id: string;
    userAgent: string;
    createdAt: string;
    lastSeenAt: string;
    expiresAt: string;
    current: boolean;
};
function EndSessionButton({ current }: { current: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" variant="outline" disabled={pending}>
            <LogOut className="size-4" />
            {pending
                ? 'Signing out…'
                : current
                  ? 'Sign out here'
                  : 'End session'}
        </Button>
    );
}
function SessionRow({ session }: { session: Session }) {
    const [state, action] = useActionState(
        async (_previous: { error?: string } | undefined, data: FormData) => {
            try {
                await revokeSessionAction(data);
                return {};
            } catch (error) {
                if (
                    error instanceof Error &&
                    error.message.includes('NEXT_REDIRECT')
                )
                    throw error;
                return { error: 'Could not end the session. Try again.' };
            }
        },
        undefined,
    );
    const mobile = /Android|iPhone|iPad/i.test(session.userAgent);
    const browser = /Edg\//.test(session.userAgent)
        ? 'Microsoft Edge'
        : /Firefox\//.test(session.userAgent)
          ? 'Firefox'
          : /Chrome\//.test(session.userAgent)
            ? 'Chrome'
            : /Safari\//.test(session.userAgent)
              ? 'Safari'
              : 'Browser';
    return (
        <div className="border-b border-ink-200 py-5 last:border-0">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                    {mobile ? (
                        <Smartphone className="mt-1 size-5 text-ink-500" />
                    ) : (
                        <Monitor className="mt-1 size-5 text-ink-500" />
                    )}
                    <div>
                        <p className="portal-text-body font-semibold">
                            {browser} · {mobile ? 'Mobile device' : 'Computer'}
                            {session.current && (
                                <Badge
                                    variant="brand"
                                    dot={false}
                                    className="ml-2"
                                >
                                    This session
                                </Badge>
                            )}
                        </p>
                        <p className="mt-2 portal-text-caption leading-6 text-ink-500">
                            Signed in{' '}
                            {new Date(session.createdAt).toLocaleString()}
                            <br />
                            Last active{' '}
                            {new Date(session.lastSeenAt).toLocaleString()}
                        </p>
                    </div>
                </div>
                <form action={action}>
                    <input type="hidden" name="sessionId" value={session.id} />
                    <EndSessionButton current={session.current} />
                </form>
            </div>
            {state?.error && (
                <p role="alert" className="mt-3 portal-text-body text-error-700">
                    {state.error}
                </p>
            )}
        </div>
    );
}
export function SettingsClient({
    profile,
    sessions,
    defaultTab = 'profile',
    updated = false,
}: {
    profile: Profile;
    sessions: Session[];
    defaultTab?: string;
    updated?: boolean;
}) {
    return (
        <div className="mx-auto portal-page">
            <p className="portal-text-caption font-semibold uppercase tracking-wider text-brand">
                Your account
            </p>
            <h1 className="portal-page-title mt-2">
                Settings
            </h1>
            <p className="mt-3 portal-text-body text-ink-600">
                Manage your details, signed-in devices, and account security.
            </p>
            <Tabs defaultValue={defaultTab} className="mt-8">
                <TabsList aria-label="Account settings" className="mb-6">
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                    <TabsTrigger value="sessions">Sessions</TabsTrigger>
                    <TabsTrigger value="security">Security</TabsTrigger>
                </TabsList>
                <TabsContent value="profile">
                    {updated && (
                        <Notice tone="success" className="mb-5">
                            Your profile has been updated.
                        </Notice>
                    )}
                    <div className="mb-4 rounded-lg border border-ink-200 p-4">
                        <h2 className="font-semibold">Verified email</h2>
                        <p className="mt-2 break-all portal-text-body text-ink-600">
                            {profile.email}
                        </p>
                        <p className="mt-2 portal-text-caption text-ink-500">
                            Your sign-in email is verified and cannot be edited
                            here.
                        </p>
                    </div>
                    <ProfileForm {...profile} embedded />
                    <Link
                        href="/dashboard/settings/addresses"
                        className="mt-6 inline-block portal-text-body font-medium text-brand hover:underline"
                    >
                        Manage saved addresses
                    </Link>
                </TabsContent>
                <TabsContent value="sessions">
                    <PortalPanel>
                        <h2 className="text-xl font-semibold">
                            Active login sessions
                        </h2>
                        <p className="mt-2 portal-text-body leading-6 text-ink-600">
                            End a session to sign that device out immediately.
                            Changing your password also ends your other
                            sessions.
                        </p>
                        {sessions.map((session) => (
                            <SessionRow key={session.id} session={session} />
                        ))}
                        {!sessions.length && (
                            <p className="mt-6 portal-text-body text-ink-500">
                                No active sessions.
                            </p>
                        )}
                    </PortalPanel>
                </TabsContent>
                <TabsContent value="security">
                    <PasswordForm embedded />
                </TabsContent>
            </Tabs>
        </div>
    );
}
