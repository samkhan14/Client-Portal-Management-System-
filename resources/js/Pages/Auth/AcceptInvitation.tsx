import { Head, useForm } from '@inertiajs/react';
import { GuestLayout } from '@/Layouts/GuestLayout';
import { Field } from '@/Components/Field';

function AcceptInvitation({
    token,
    valid,
    message,
    needs_account,
    email,
    role_label,
    organization,
}: {
    token: string;
    valid: boolean;
    message: string | null;
    needs_account: boolean;
    email?: string;
    role_label?: string;
    organization?: string;
}) {
    const form = useForm({ name: '', password: '' });

    return (
        <>
            <Head title="Invitation" />
            <div className="mx-auto w-full max-w-md space-y-4">
                <h1 className="font-display text-4xl">Invitation</h1>
                {!valid ? <p className="text-sm">{message}</p> : null}
                {valid ? (
                    <>
                        <p className="text-sm text-muted">
                            {email} is invited to {organization} as {role_label}.
                        </p>
                        <form
                            className="space-y-4"
                            onSubmit={(event) => {
                                event.preventDefault();
                                form.post(`/invitations/${token}`);
                            }}
                        >
                            {needs_account ? (
                                <>
                                    <Field label="Your name" error={form.errors.name}>
                                        <input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} required />
                                    </Field>
                                    <Field label="Password" error={form.errors.password}>
                                        <input type="password" value={form.data.password} onChange={(event) => form.setData('password', event.target.value)} required minLength={8} />
                                    </Field>
                                </>
                            ) : (
                                <p className="text-sm">Sign in with this email first if you already have an account, then accept.</p>
                            )}
                            {(form.errors as Record<string, string | undefined>).invitation ? <p className="text-sm text-clay-deep">{(form.errors as Record<string, string | undefined>).invitation}</p> : null}
                            <button type="submit" disabled={form.processing} className="rounded-full bg-pine px-5 py-2.5 font-semibold text-paper disabled:opacity-50">
                                {form.processing ? 'Accepting…' : 'Accept invitation'}
                            </button>
                        </form>
                    </>
                ) : null}
            </div>
        </>
    );
}

AcceptInvitation.layout = (page: React.ReactNode) => <GuestLayout>{page}</GuestLayout>;

export default AcceptInvitation;
