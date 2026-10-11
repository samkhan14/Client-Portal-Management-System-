"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ProjectTabs({ base, tabs }: { base: string; tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Project sections" className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((tab) => {
        const href = `${base}${tab.href}`;
        const active = tab.href === "" ? pathname === base : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${active ? "border-pine-700 text-pine-800" : "border-transparent text-ink-500 hover:text-ink-800"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
