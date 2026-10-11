import { Link, router, usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import type { SharedProps } from '@/types';

const links = [
    { href: '/', label: 'Desk', show: () => true },
    { href: '/projects', label: 'Projects', show: () => true },
    { href: '/tasks', label: 'Tasks', show: () => true },
    { href: '/clients', label: 'Clients', show: (props: SharedProps) => props.abilities.manage_projects },
    { href: '/team', label: 'People', show: (props: SharedProps) => props.abilities.invite },
    { href: '/invoices', label: 'Invoices', show: (props: SharedProps) => props.abilities.view_invoices },
    { href: '/settings', label: 'Agency', show: (props: SharedProps) => props.abilities.manage_organization },
];

export function InternalLayout({ children }: { children: ReactNode }) {
    const page = usePage<SharedProps>();
    const { auth, flash, unread_notifications: unread, theme } = page.props;
    const current = page.url.split('?')[0];

    const toggleTheme = () => {
        const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        document.documentElement.classList.toggle('dark', next === 'dark');
        document.documentElement.setAttribute('data-theme', next);
        router.post('/theme', { theme: next }, { preserveScroll: true });
    };

    return (
        <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
            <aside className="bg-pine text-paper lg:min-h-screen">
                <div className="flex items-center gap-3 px-5 py-6">
                    <img src="/brand/mark.jpg" alt="" className="h-11 w-11 rounded-xl object-cover" />
                    <div>
                        <p className="font-display text-lg leading-none">Northline</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#d7c4a5]">Studio desk</p>
                    </div>
                </div>
                <nav className="flex gap-2 overflow-x-auto px-3 pb-4 lg:block lg:space-y-1 lg:px-3" aria-label="Studio">
                    {links.filter((link) => link.show(page.props)).map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`block whitespace-nowrap rounded-xl px-3 py-2 text-sm ${current === link.href ? 'bg-clay text-white' : 'text-[#efe7da] hover:bg-pine-soft'}`}
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>
            </aside>
            <div>
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-muted">{auth.organization?.name ?? 'Agency'}</p>
                        <p className="text-sm">{auth.user?.name} · {auth.membership?.role_label}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/notifications" className="rounded-full border border-line px-3 py-1.5 text-sm">
                            Notices{unread ? ` (${unread})` : ''}
                        </Link>
                        <button type="button" className="rounded-full border border-line px-3 py-1.5 text-sm" onClick={toggleTheme}>
                            {theme === 'dark' || document.documentElement.classList.contains('dark') ? 'Light' : 'Dark'}
                        </button>
                        <button type="button" className="rounded-full bg-pine px-3 py-1.5 text-sm text-paper" onClick={() => router.post('/logout')}>
                            Sign out
                        </button>
                    </div>
                </header>
                <main className="mx-auto max-w-6xl px-5 py-8">
                    {flash.success ? <p className="mb-4 rounded-2xl bg-foam px-4 py-3 text-sm" role="status">{flash.success}</p> : null}
                    {flash.error ? <p className="mb-4 rounded-2xl bg-[#f3ddd8] px-4 py-3 text-sm" role="alert">{flash.error}</p> : null}
                    {children}
                </main>
            </div>
        </div>
    );
}
