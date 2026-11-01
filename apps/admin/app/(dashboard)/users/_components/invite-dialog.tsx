"use client";

import { useRouter } from "next/navigation";
import { CheckIcon, CopyIcon, MailIcon, PlusIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "@repo/ui/components/sonner";

import { ROLE_DESCRIPTIONS, ROLE_LABELS, appRoleSchema, type AppRole } from "@repo/types";

import { inviteUserAction } from "../_actions";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/native-select";

export function InviteDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AppRole>("viewer");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isMountedRef = useRef(true);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  function reset() {
    setEmail("");
    setName("");
    setRole("viewer");
    setTempPassword(null);
    setCopied(false);
    setShowPassword(false);
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = null;
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const { tempPassword: pw } = await inviteUserAction({ email, name, role });
        setTempPassword(pw);
        toast.success("Account created.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Invite failed");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <PlusIcon size={14} aria-hidden="true" />
            <span>
              Invite<span className="hidden sm:inline"> teammate</span>
            </span>
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <MailIcon size={16} aria-hidden="true" className="inline" /> Invite a teammate
          </DialogTitle>
          <DialogDescription>
            We don&rsquo;t send an email yet — copy the temporary password below and share it
            through your usual channel. They can change it after their first sign-in.
          </DialogDescription>
        </DialogHeader>

        {tempPassword ? (
          <div className="grid gap-3">
            <p className="text-sm">
              Account created for <strong>{email}</strong>. Share these credentials:
            </p>
            <div className="border-border/60 bg-muted/40 grid gap-1 rounded-lg border p-3 font-mono text-sm">
              <div>
                <span className="text-muted-foreground">email:</span> {email}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">password:</span>
                <span>{showPassword ? tempPassword : "••••••••"}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 px-2 text-xs"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </Button>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(`${email}\n${tempPassword}`);
                setCopied(true);
                if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
                copyTimeoutRef.current = setTimeout(() => {
                  if (isMountedRef.current) setCopied(false);
                }, 1500);
              }}
            >
              {copied ? (
                <CheckIcon size={14} aria-hidden="true" />
              ) : (
                <CopyIcon size={14} aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy email + password"}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="invite-name">Name</Label>
              <Input
                id="invite-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Maria Cruz"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <NativeSelect
                id="invite-role"
                value={role}
                onChange={(e) => setRole(appRoleSchema.parse(e.target.value))}
                aria-describedby="invite-role-description"
              >
                {appRoleSchema.options.map((option) => (
                  <NativeSelectOption key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <p id="invite-role-description" className="text-muted-foreground text-xs">
                {ROLE_DESCRIPTIONS[role]}
              </p>
            </div>
            <DialogFooter className="mt-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create account"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
