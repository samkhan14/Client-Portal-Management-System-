import type { ReactNode } from 'react';

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
    return (
        <label className="field text-sm">
            <span className="font-semibold text-ink">{label}</span>
            {children}
            {error ? <span className="text-xs text-clay-deep">{error}</span> : null}
        </label>
    );
}
