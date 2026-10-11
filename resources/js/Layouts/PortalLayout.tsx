import { Link, router, usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import type { SharedProps } from '@/types';

export function PortalLayout({ children }: { children: ReactNode }) {
    const { auth, flash, unread_notifications: unread } = usePage<SharedProps>().props;

    const toggleTheme = () => {
        const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        document.documentElement.classList.toggle('dark', next === 'dark');
        document.documentElement.setAttribute('data-theme', next);
        router.post('/theme', { theme: next }, { preserveScroll: true });
    };

    return (
        <div className="min-h-screen">
            <header className="border-b border-line bg-card">
                <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <Link href="/portal" className="flex min-w-0 items-center gap-3">
                        <img src="/brand/mark.jpg" alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
                        <span className="min-w-0">
                            <span className="block font-display text-xl leading-none">Northline</span>
                            <span className="text-xs uppercase tracking-[0.16em] text-muted">Client portal</span>
                        </span>
                    </Link>
                    <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Portal">
                        <Link href="/portal" className="rounded-full px-3 py-1.5 hover:bg-paper">Overview</Link>
                        <Link href="/notifications" className="rounded-full px-3 py-1.5 hover:bg-paper">Notices{unread ? ` (${unread})` : ''}</Link>
                        <button type="button" className="rounded-full border border-line px-3 py-1.5" onClick={toggleTheme}>Theme</button>
                        <button type="button" className="rounded-full bg-clay px-3 py-1.5 font-semibold text-white" onClick={() => router.post('/logout')}>Sign out</button>
                    </nav>
                </div>
            </header>
            <main className="mx-auto min-w-0 max-w-5xl px-4 py-6 sm:px-5 sm:py-8">
                <p className="mb-6 text-sm text-muted">{auth.user?.name} · {auth.membership?.role_label}</p>
                {flash.success ? <p className="mb-4 rounded-2xl bg-foam px-4 py-3 text-sm" role="status">{flash.success}</p> : null}
                {children}
            </main>
        </div>
    );
}
