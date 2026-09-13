import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { updateUserAction, updateUserPasswordAction } from '@/app/admin/actions';
import { UserForm } from '../../user-form';
import { ChangePasswordForm } from '../../change-password-form';

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
        notFound();
    }

    const boundUpdateAction = updateUserAction.bind(null, user.id);
    const boundPasswordAction = updateUserPasswordAction.bind(null, user.id);

    return (
        <div className="space-y-12">
            <div>
                <h1 className="text-2xl font-bold mb-8">Edit User</h1>
                <UserForm
                    action={boundUpdateAction}
                    submitLabel="Save Changes"
                    defaultValues={{ email: user.email, name: user.name ?? '' }}
                />
            </div>

            <div className="max-w-lg pt-8 border-t border-ink-200">
                <h2 className="text-lg font-bold mb-1">Change Password</h2>
                <p className="text-sm text-ink-500 mb-6">Set a new password for {user.email}.</p>
                <ChangePasswordForm action={boundPasswordAction} />
            </div>
        </div>
    );
}
