import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-20">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-ink-600">That page is not available.</p>
      <Link className="btn mt-4" href="/">
        Go home
      </Link>
    </main>
  );
}
