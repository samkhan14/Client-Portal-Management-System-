import { usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import type { SharedProps } from '@/types';

export function GuestLayout({ children }: { children: ReactNode }) {
    const { flash } = usePage<SharedProps>().props;

    return (
        <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
            <section className="relative hidden overflow-hidden bg-pine text-paper lg:flex lg:flex-col lg:justify-between lg:p-12">
                <img src="/brand/wordmark.jpg" alt="Northline Studio" className="h-16 w-auto object-contain object-left" />
                <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-[#d7c4a5]">Client Portal Management System</p>
                    <h1 className="mt-4 max-w-md font-display text-5xl leading-tight">A calm desk for agency work and client review.</h1>
                </div>
                <img src="/brand/overview.jpg" alt="" className="mt-8 h-48 w-full rounded-3xl object-cover" />
            </section>
            <section className="flex flex-col justify-center px-6 py-12">
                <img src="/brand/mark.jpg" alt="" className="mb-6 h-14 w-14 rounded-2xl object-cover lg:hidden" />
                {flash.success ? <p className="mb-4 rounded-2xl bg-foam px-4 py-3 text-sm">{flash.success}</p> : null}
                {flash.error ? <p className="mb-4 rounded-2xl bg-[#f3ddd8] px-4 py-3 text-sm">{flash.error}</p> : null}
                {children}
            </section>
        </div>
    );
}
