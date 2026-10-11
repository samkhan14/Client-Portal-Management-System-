"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function DebouncedSearch({ placeholder }: { placeholder: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const initial = params.get("q") ?? "";
  const [value, setValue] = useState(initial);

  useEffect(() => {
    const handle = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      const current = next.get("q") ?? "";
      if (current === value) return;
      if (value) next.set("q", value);
      else next.delete("q");
      next.delete("page");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    }, 300);
    return () => clearTimeout(handle);
  }, [value, params, pathname, router]);

  return (
    <input
      className="field"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      type="search"
    />
  );
}

export function SelectFilter({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <label className="block text-sm">
      <span className="label">{label}</span>
      <select
        className="field"
        value={value}
        aria-label={label}
        onChange={(event) => {
          const next = new URLSearchParams(params.toString());
          if (event.target.value) next.set(name, event.target.value);
          else next.delete(name);
          next.delete("page");
          const query = next.toString();
          router.replace(query ? `${pathname}?${query}` : pathname);
        }}
      >
        {options.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
