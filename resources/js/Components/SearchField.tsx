import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

export function SearchField({ initial }: { initial: string }) {
    const [value, setValue] = useState(initial);
    const first = useRef(true);

    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        const handle = window.setTimeout(() => {
            const params = new URLSearchParams(window.location.search);
            if (value.trim()) {
                params.set('q', value.trim());
            } else {
                params.delete('q');
            }
            params.delete('page');
            router.get(`${window.location.pathname}?${params.toString()}`, {}, { preserveState: true, preserveScroll: true, replace: true });
        }, 300);
        return () => window.clearTimeout(handle);
    }, [value]);

    return (
        <input
            className="input"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Search"
            aria-label="Search"
            type="search"
        />
    );
}

export function applyFilter(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value) {
        params.set(key, value);
    } else {
        params.delete(key);
    }
    params.delete('page');
    router.get(`${window.location.pathname}?${params.toString()}`, {}, { preserveState: true, preserveScroll: true, replace: true });
}
