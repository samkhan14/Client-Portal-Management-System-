const tones: Record<string, string> = {
    PLANNING: 'bg-foam text-teal',
    IN_PROGRESS: 'bg-[#e7efe4] text-[#24543a] dark:bg-[#1e3328] dark:text-[#d5eadc]',
    WAITING_ON_CLIENT: 'bg-[#f8e7d4] text-clay-deep dark:bg-[#3a2a1d] dark:text-[#f3c7a4]',
    ON_HOLD: 'bg-[#ece7dc] text-muted',
    COMPLETED: 'bg-[#dceee8] text-teal dark:bg-[#1c3330] dark:text-[#d5ece6]',
    CANCELLED: 'bg-[#f3ddd8] text-[#8a3b2b]',
    TODO: 'bg-foam text-teal',
    BLOCKED: 'bg-[#f3ddd8] text-[#8a3b2b]',
    IN_REVIEW: 'bg-[#f8e7d4] text-clay-deep',
    DONE: 'bg-[#dceee8] text-teal',
    DRAFT: 'bg-[#ece7dc] text-muted',
    SUBMITTED: 'bg-[#f8e7d4] text-clay-deep',
    APPROVED: 'bg-[#dceee8] text-teal',
    CHANGES_REQUESTED: 'bg-[#f3ddd8] text-[#8a3b2b]',
    UNPAID: 'bg-[#f8e7d4] text-clay-deep',
    PAID: 'bg-[#dceee8] text-teal',
    VOID: 'bg-[#ece7dc] text-muted',
    OPEN: 'bg-[#f8e7d4] text-clay-deep',
    ACCEPTED: 'bg-[#dceee8] text-teal',
    DECLINED: 'bg-[#ece7dc] text-muted',
    LOW: 'bg-foam text-teal',
    NORMAL: 'bg-[#ece7dc] text-ink',
    HIGH: 'bg-[#f8e7d4] text-clay-deep',
    URGENT: 'bg-[#f3ddd8] text-[#8a3b2b]',
};

export function Badge({ value, label }: { value: string; label: string }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${tones[value] ?? 'bg-foam text-teal'}`}>
            {label}
        </span>
    );
}
