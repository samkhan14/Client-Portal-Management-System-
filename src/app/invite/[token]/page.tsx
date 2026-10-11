import { previewInvitation } from "@/server/org";
import { ROLE_LABEL } from "@/lib/constants";
import { AcceptForm } from "@/app/invite/[token]/accept-form";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await previewInvitation(token);
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="card p-6">
        <p className="text-lg font-semibold">Join Northline</p>
        {invite ? (
          <>
            <p className="mt-2 text-sm text-ink-600">
              {invite.email} is invited to {invite.organizationName}
              {invite.clientCompanyName ? ` for ${invite.clientCompanyName}` : ""} as {ROLE_LABEL[invite.role]}.
            </p>
            <div className="mt-4">
              <AcceptForm token={token} hasAccount={invite.hasAccount} />
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-ink-600" role="alert">
            This invitation is invalid or has expired.
          </p>
        )}
      </div>
    </main>
  );
}
