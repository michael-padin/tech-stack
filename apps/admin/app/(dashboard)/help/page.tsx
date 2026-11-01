import { APP_NAME } from "@repo/env/client";
import { STATUS_DESCRIPTIONS, STATUS_LABELS, type ItemStatus } from "@repo/types";

import { StatusPill } from "@/components/status-pill";
import { Separator } from "@repo/ui/components/separator";

export const metadata = {
  title: "Help & docs",
  description: `How the ${APP_NAME} admin dashboard works.`,
};

const STATUSES: ItemStatus[] = ["draft", "active", "archived"];

const sections = [
  {
    id: "items",
    title: "Managing items",
    kind: "items" as const,
  },
  {
    id: "status-meaning",
    title: "What each item status means",
    kind: "status" as const,
  },
  {
    id: "invites",
    title: "Inviting teammates",
    kind: "invites" as const,
  },
  {
    id: "access",
    title: "Keeping the dashboard private",
    kind: "access" as const,
  },
];

export default function HelpPage() {
  return (
    <>
      <header className="border-border/60 border-b px-4 py-6 sm:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <p className="text-muted-foreground text-[0.68rem] tracking-[0.22em] uppercase">Docs</p>
          <h1 className="display mt-2 text-3xl">Admin help</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            A quick tour of the dashboard. {APP_NAME} is an internal admin template — Items is the
            example resource you adapt to your own domain.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-y-12 px-8 py-10 lg:grid-cols-[0.7fr_2fr] lg:gap-x-16 lg:gap-y-0">
        <nav aria-label="On this page" className="lg:sticky lg:top-6 lg:self-start">
          <p className="text-muted-foreground text-[0.68rem] tracking-[0.22em] uppercase">
            On this page
          </p>
          <ol className="text-muted-foreground mt-4 space-y-2.5 font-mono text-xs tabular-nums">
            {sections.map((section, index) => (
              <li key={section.id} className="grid grid-cols-[2.25rem_1fr] items-baseline gap-x-3">
                <span className="text-foreground/60">{String(index + 1).padStart(2, "0")}</span>
                <a
                  href={`#${section.id}`}
                  className="hover:text-foreground font-sans text-sm leading-snug transition-colors"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <ol className="space-y-12">
          {sections.map((section, index) => (
            <li key={section.id} className="grid grid-cols-[2.25rem_1fr] items-baseline gap-x-5">
              <span className="text-muted-foreground font-mono text-[0.7rem] tracking-widest tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="max-w-prose">
                <h2
                  id={section.id}
                  tabIndex={-1}
                  className="display text-foreground scroll-mt-24 text-xl leading-tight"
                >
                  {section.title}
                </h2>
                <div className="mt-4">
                  {section.kind === "items" && <ItemsBody />}
                  {section.kind === "status" && <StatusMeaningBody />}
                  {section.kind === "invites" && <InvitesBody />}
                  {section.kind === "access" && <AccessBody />}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

function ItemsBody() {
  return (
    <ol className="text-muted-foreground ml-5 list-decimal space-y-2 text-sm leading-relaxed">
      <li>
        Go to <strong className="text-foreground">Items</strong> →{" "}
        <strong className="text-foreground">New item</strong>.
      </li>
      <li>
        Give it a <em>title</em> and an optional description.
      </li>
      <li>
        Pick a <strong className="text-foreground">status</strong>. New items start as{" "}
        <em>{STATUS_LABELS.draft}</em>.
      </li>
      <li>
        Save. From the edit page you can update the item or delete it. Deletes are soft — the row is
        kept for audit and can be restored.
      </li>
    </ol>
  );
}

function StatusMeaningBody() {
  return (
    <>
      <ul className="grid gap-3 text-sm leading-relaxed">
        {STATUSES.map((status) => (
          <li key={status} className="flex items-start gap-3">
            <StatusPill status={status} />
            <p className="text-muted-foreground">{STATUS_DESCRIPTIONS[status]}</p>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-4 text-xs">
        New items default to <strong className="text-foreground">{STATUS_LABELS.draft}</strong>{" "}
        until you set them active.
      </p>
    </>
  );
}

function InvitesBody() {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <p className="text-muted-foreground">
        Go to <strong className="text-foreground">Admins</strong> →{" "}
        <strong className="text-foreground">Invite teammate</strong>. Enter their email and name,
        and pick a role.
      </p>
      <p className="text-muted-foreground">
        Admins can do everything, editors can change items, and viewers can only look. We
        don&rsquo;t send a welcome email yet: copy the temporary password we generate and hand it to
        the new teammate yourself. They can change it after sign-in.
      </p>
    </div>
  );
}

function AccessBody() {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <p className="text-muted-foreground">
        There&rsquo;s no public sign-up button. The only way to get access is to be invited from
        this page. If you ever lose access, contact the developer.
      </p>
      <Separator className="my-4" />
      <p className="text-muted-foreground">
        Sessions last 7 days. Sign out from the avatar menu in the lower-left corner of the sidebar.
      </p>
    </div>
  );
}
