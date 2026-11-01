"use client";

import { useRouter } from "next/navigation";
import { CheckIcon, CopyIcon, MoreVerticalIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "@repo/ui/components/sonner";

import {
  banUserAction,
  removeUserAction,
  resetUserPasswordAction,
  unbanUserAction,
} from "../_actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";

import type { ActionResult } from "@/lib/action-result";

export function UserRowActions({
  userId,
  userEmail,
  banned,
}: {
  userId: string;
  userEmail?: string | null;
  banned: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmBan, setConfirmBan] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [banReason, setBanReason] = useState("Banned via dashboard");
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  function run(action: () => Promise<ActionResult>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  function handleResetConfirm() {
    setConfirmReset(false);
    startTransition(async () => {
      const result = await resetUserPasswordAction(userId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setResetResult(result.data.tempPassword);
      setShowPassword(false);
      setCopied(false);
      toast.success("Password reset.");
      router.refresh();
    });
  }

  function handleCopyCredentials() {
    if (!resetResult) return;
    const payload = userEmail ? `${userEmail}\n${resetResult}` : resetResult;
    navigator.clipboard.writeText(payload);
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" disabled={pending} aria-label="Actions">
              <MoreVerticalIcon size={14} aria-hidden="true" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Manage account</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setConfirmReset(true)}>Reset password</DropdownMenuItem>
          {banned ? (
            <DropdownMenuItem onClick={() => run(() => unbanUserAction(userId), "User unbanned.")}>
              Unban
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => {
                setBanReason("Banned via dashboard");
                setConfirmBan(true);
              }}
            >
              Ban
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmRemove(true)}>
            Remove account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset this admin&rsquo;s password?</AlertDialogTitle>
            <AlertDialogDescription>
              A new temporary password is generated and shown once. They&rsquo;ll be signed out of
              all devices and must use the new password to get back in. Share the temp password
              through your usual channel — they can change it again after signing in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetConfirm}>Reset password</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={resetResult !== null}
        onOpenChange={(v) => {
          if (!v) {
            setResetResult(null);
            setShowPassword(false);
            setCopied(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password</DialogTitle>
            <DialogDescription>
              Share these credentials manually — they won&rsquo;t be shown again. The admin should
              change their password after signing in.
            </DialogDescription>
          </DialogHeader>
          <div className="border-border/60 bg-muted/40 grid gap-1 rounded-lg border p-3 font-mono text-sm">
            {userEmail ? (
              <div>
                <span className="text-muted-foreground">email:</span> {userEmail}
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">password:</span>
              <span>{showPassword ? resetResult : "••••••••"}</span>
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
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={handleCopyCredentials}>
              {copied ? (
                <CheckIcon size={14} aria-hidden="true" />
              ) : (
                <CopyIcon size={14} aria-hidden="true" />
              )}
              {copied ? "Copied" : userEmail ? "Copy email + password" : "Copy password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the user account and all related records. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmRemove(false);
                run(() => removeUserAction(userId), "Account removed.");
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmBan} onOpenChange={setConfirmBan}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ban this user?</AlertDialogTitle>
            <AlertDialogDescription>
              The user will be signed out and unable to sign in. Add a reason so other admins know
              why.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="ban-reason">Reason</Label>
            <Textarea
              id="ban-reason"
              rows={3}
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Banned via dashboard"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const reason = banReason.trim() || "Banned via dashboard";
                setConfirmBan(false);
                run(() => banUserAction(userId, reason), "User banned.");
              }}
            >
              Ban
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
