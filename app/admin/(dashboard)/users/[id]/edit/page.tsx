import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { updateUserAction, updateUserPasswordAction } from '@/app/admin/actions';
import { UserForm } from '../../user-form';
import { ChangePasswordForm } from '../../change-password-form';

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await db.query.user.findFirst({ where: eq(schema.user.id, id) });

    if (!user) {
        notFound();
    }

    const boundUpdateAction = updateUserAction.bind(null, user.id);
    const boundPasswordAction = updateUserPasswordAction.bind(null, user.id);

    return (
        <div className="space-y-12">
            <div>
                <h1 className="portal-page-title mb-8">Edit User</h1>
                <UserForm
                    action={boundUpdateAction}
                    submitLabel="Save Changes"
                    defaultValues={{ email: user.email, name: user.name ?? '' }}
                />
            </div>

            <div className="portal-form-narrow pt-8 border-t border-border">
                <h2 className="text-lg mb-1">Change Password</h2>
                <p className="portal-text-body text-muted-foreground mb-6">Set a new password for {user.email}.</p>
                <ChangePasswordForm action={boundPasswordAction} />
            </div>
        </div>
    );
}
