"use client";

import { useActionState, useRef } from "react";
import type { ActionState } from "@/lib/action-state";

const initial: ActionState = { error: "" };

export function ActionForm({
  action,
  csrf,
  submitLabel,
  pendingLabel = "Saving…",
  children,
  hidden,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  csrf: string;
  submitLabel: string;
  pendingLabel?: string;
  children: React.ReactNode;
  hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="csrf" value={csrf} />
      {hidden
        ? Object.entries(hidden).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)
        : null}
      {children}
      {state.error ? (
        <p role="alert" className="text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      {state.link ? (
        <p role="status" className="break-all rounded-md bg-pine-50 px-3 py-2 text-sm text-pine-800">
          Invitation link: <a className="font-semibold underline" href={state.link}>{state.link}</a>
        </p>
      ) : null}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}

export function DialogForm({
  title,
  trigger,
  action,
  csrf,
  submitLabel,
  hidden,
  children,
}: {
  title: string;
  trigger: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  csrf: string;
  submitLabel: string;
  hidden?: Record<string, string>;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => ref.current?.showModal()}>
        {trigger}
      </button>
      <dialog ref={ref} className="w-[min(32rem,calc(100%-2rem))] rounded-xl border border-line p-0 backdrop:bg-ink-950/40" aria-labelledby="dialog-title">
        <div className="p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 id="dialog-title" className="text-lg font-semibold">
              {title}
            </h2>
            <button type="button" className="btn-quiet" onClick={() => ref.current?.close()}>
              Close
            </button>
          </div>
          <ActionForm action={action} csrf={csrf} submitLabel={submitLabel} hidden={hidden}>
            {children}
          </ActionForm>
        </div>
      </dialog>
    </>
  );
}
