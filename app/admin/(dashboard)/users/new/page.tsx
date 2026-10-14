import { createUserAction } from '@/app/admin/actions';
import { UserForm } from '../user-form';

export default function NewUserPage() {
    return (
        <div>
            <h1 className="portal-page-title mb-8">New User</h1>
            <UserForm action={createUserAction} submitLabel="Create User" includePassword />
        </div>
    );
}
