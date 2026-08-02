import { LoginForm } from './login-form';

export default function AdminLoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-ink-50 px-4">
            <div className="w-full max-w-sm bg-white border border-ink-100 rounded-2xl shadow-sm p-8">
                <h1 className="text-2xl font-bold  mb-2">Admin Login</h1>
                <p className="text-sm text-ink-500 mb-8">Sign in to manage the UnityAlgo blog.</p>
                <LoginForm />
            </div>
        </div>
    );
}
