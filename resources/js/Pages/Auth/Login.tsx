import { Head, useForm } from '@inertiajs/react';
import { GuestLayout } from '@/Layouts/GuestLayout';
import { Field } from '@/Components/Field';

function Login() {
    const form = useForm({ email: '', password: '' });

    return (
        <>
            <Head title="Sign in" />
            <form
                className="mx-auto w-full max-w-md space-y-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post('/login');
                }}
            >
                <p className="text-xs uppercase tracking-[0.18em] text-teal">Welcome back</p>
                <h1 className="font-display text-4xl">Sign in</h1>
                <Field label="Email" error={form.errors.email}>
                    <input type="email" autoComplete="username" value={form.data.email} onChange={(event) => form.setData('email', event.target.value)} required />
                </Field>
                <Field label="Password" error={form.errors.password}>
                    <input type="password" autoComplete="current-password" value={form.data.password} onChange={(event) => form.setData('password', event.target.value)} required />
                </Field>
                <button type="submit" disabled={form.processing} className="rounded-full bg-clay px-5 py-2.5 font-semibold text-white disabled:opacity-50">
                    {form.processing ? 'Signing in…' : 'Enter the studio'}
                </button>
            </form>
        </>
    );
}

Login.layout = (page: React.ReactNode) => <GuestLayout>{page}</GuestLayout>;

export default Login;
