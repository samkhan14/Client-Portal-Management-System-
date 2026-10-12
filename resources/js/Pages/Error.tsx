import { Head, Link } from '@inertiajs/react';

const copy: Record<number, string> = {
    403: 'You do not have access to that record.',
    404: 'That record is not in your workspace.',
    500: 'Something went wrong while loading this page.',
    503: 'The studio desk is briefly unavailable.',
};

export default function ErrorPage({ status }: { status: number }) {
    return (
        <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
            <Head title="Something needs attention" />
            <img src="/brand/mark.jpg" alt="" className="mb-6 h-14 w-14 rounded-2xl object-cover" />
            <p className="text-xs uppercase tracking-[0.18em] text-teal">Northline</p>
            <h1 className="mt-2 font-display text-5xl">{status}</h1>
            <p className="mt-3 text-muted">{copy[status] ?? 'The request could not be completed.'}</p>
            <Link href="/login" className="mt-6 text-sm font-semibold text-clay">Return to sign in</Link>
        </main>
    );
}
