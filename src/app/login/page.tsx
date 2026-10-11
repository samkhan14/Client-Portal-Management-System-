import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/current";
import { homeFor } from "@/lib/authz";
import { LoginForm } from "@/app/login/login-form";

export default async function LoginPage() {
  const actor = await getActor();
  if (actor) redirect(homeFor(actor.role));
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="card p-6">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-pine-700 text-sm font-semibold text-white">N</span>
          <div>
            <p className="text-lg font-semibold">Northline</p>
            <p className="text-sm text-ink-500">Sign in to your workspace</p>
          </div>
        </div>
        <LoginForm />
        <p className="help mt-4">Access is by invitation. If you have a link, open it to join.</p>
      </div>
    </main>
  );
}
