import { useEffect, useRef, type ReactNode } from 'react';

export function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
    const ref = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) {
            return;
        }
        if (open && !el.open) {
            el.showModal();
        }
        if (!open && el.open) {
            el.close();
        }
    }, [open]);

    return (
        <dialog
            ref={ref}
            aria-labelledby="dialog-title"
            onClose={onClose}
            className="rounded-2xl"
        >
            <div className="rounded-2xl border border-line bg-card p-5 text-ink shadow-xl">
                <div className="mb-4 flex items-start justify-between gap-4">
                    <h2 id="dialog-title" className="font-display text-2xl">
                        {title}
                    </h2>
                    <button type="button" className="rounded-full border border-line px-2 py-1 text-sm" onClick={onClose}>
                        Close
                    </button>
                </div>
                {children}
            </div>
        </dialog>
    );
}
