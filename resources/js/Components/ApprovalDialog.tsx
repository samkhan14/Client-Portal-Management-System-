import { useForm } from '@inertiajs/react';
import { useState } from 'react';
import { Dialog } from '@/Components/Dialog';

export function ApprovalDialog({ versionId, title }: { versionId: number; title: string }) {
    const [open, setOpen] = useState(false);
    const [decision, setDecision] = useState<'approve' | 'changes'>('approve');
    const form = useForm({ decision_note: '' });

    return (
        <>
            <button type="button" className="rounded-full bg-clay px-3 py-1.5 text-sm font-semibold text-white" onClick={() => setOpen(true)}>
                Review
            </button>
            <Dialog open={open} title={`Review ${title}`} onClose={() => setOpen(false)}>
                <form
                    className="space-y-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const url = decision === 'approve' ? `/portal/deliverable-versions/${versionId}/approve` : `/portal/deliverable-versions/${versionId}/changes`;
                        form.post(url, { preserveScroll: true, onSuccess: () => setOpen(false) });
                    }}
                >
                    <div className="flex gap-2">
                        <button type="button" className={`rounded-full px-3 py-1 text-sm ${decision === 'approve' ? 'bg-teal text-white' : 'border border-line'}`} onClick={() => setDecision('approve')}>
                            Approve
                        </button>
                        <button type="button" className={`rounded-full px-3 py-1 text-sm ${decision === 'changes' ? 'bg-clay text-white' : 'border border-line'}`} onClick={() => setDecision('changes')}>
                            Request changes
                        </button>
                    </div>
                    <textarea className="input min-h-24" required value={form.data.decision_note} onChange={(event) => form.setData('decision_note', event.target.value)} aria-label="Decision note" placeholder="What should the studio know?" />
                    {form.errors.decision_note ? <p className="text-xs text-clay-deep">{form.errors.decision_note}</p> : null}
                    {(form.errors as Record<string, string | undefined>).decision ? <p className="text-xs text-clay-deep">{(form.errors as Record<string, string | undefined>).decision}</p> : null}
                    <button type="submit" disabled={form.processing} className="rounded-full bg-pine px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">
                        {form.processing ? 'Saving…' : 'Record decision'}
                    </button>
                    <p className="text-xs text-muted">This records a review decision. It is not an electronic signature.</p>
                </form>
            </Dialog>
        </>
    );
}
