"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/actions/app";
import { ROLE_LABEL } from "@/lib/constants";
import type { OrgRole } from "@prisma/client";

export function AppShell({
  organizationName,
  userName,
  role,
  csrf,
  unread,
  links,
  children,
}: {
  organizationName: string;
  userName: string;
  role: OrgRole;
  csrf: string;
  unread: number;
  links: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {links.map((link) => {
        const active = pathname === link.href || (link.href !== "/dashboard" && link.href !== "/portal" && pathname.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-sm font-medium ${active ? "bg-white/10 text-white" : "text-ink-400 hover:bg-white/5 hover:text-white"}`}
            onClick={() => setOpen(false)}
          >
            {link.label}
            {link.href.endsWith("/notifications") && unread > 0 ? (
              <span className="ml-2 rounded-full bg-pine-700 px-1.5 py-0.5 text-xs text-white">{unread}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-[16rem_1fr]">
      <aside className="bg-ink-950 text-white md:min-h-screen">
        <div className="flex items-center justify-between px-4 py-4">
          <Link href={links[0]?.href ?? "/"} className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-pine-700 text-sm font-semibold">N</span>
            <span className="text-sm font-semibold tracking-wide">Northline</span>
          </Link>
          <button
            type="button"
            className="btn-quiet text-white md:hidden"
            aria-expanded={open}
            aria-controls="primary-nav"
            onClick={() => setOpen((value) => !value)}
          >
            Menu
          </button>
        </div>
        <div id="primary-nav" className={`${open ? "block" : "hidden"} px-3 pb-4 md:block`}>
          {nav}
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 md:px-8">
          <div>
            <p className="text-sm font-semibold text-ink-900">{organizationName}</p>
            <p className="text-xs text-ink-500">
              {userName} · {ROLE_LABEL[role]}
            </p>
          </div>
          <form action={logoutAction}>
            <input type="hidden" name="csrf" value={csrf} />
            <button className="btn-secondary" type="submit">
              Sign out
            </button>
          </form>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
