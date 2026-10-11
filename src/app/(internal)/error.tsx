"use client";

export default function InternalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="card p-6">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-ink-600">Refresh the page or try the action again.</p>
      <button className="btn mt-4" type="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
