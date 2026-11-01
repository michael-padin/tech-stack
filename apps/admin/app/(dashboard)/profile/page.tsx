import { Suspense } from "react";

import { requireSession } from "@repo/auth/next";

import { ActiveSessionsCard, ActiveSessionsCardSkeleton } from "./_components/active-sessions-card";
import { ProfileForm } from "./_components/profile-form";

export const metadata = {
  title: "Your profile",
};

export default async function ProfilePage() {
  // requireSession gates the page (every role has a profile). Its data is needed for the form below, so
  // it stays outside Suspense — the rest of the shell can't render anyway
  // until we know who's signed in. The session-list query DOES stream:
  // header + form render immediately, the active-sessions card flushes
  // in once Better Auth returns the list.
  const session = await requireSession();
  const user = session.user;

  return (
    <>
      <header className="border-border/60 border-b">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-8 sm:py-6">
          <h1 className="text-lg leading-tight font-semibold sm:text-xl">Your profile</h1>
          <p className="text-muted-foreground mt-0.5 max-w-prose text-xs sm:text-sm">
            Update your display name, rotate your password, and review the devices currently signed
            in as you.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-6">
          <ProfileForm userId={user.id} initialName={user.name ?? ""} email={user.email ?? ""} />
          <Suspense fallback={<ActiveSessionsCardSkeleton />}>
            <ActiveSessionsCard />
          </Suspense>
        </div>
      </main>
    </>
  );
}
