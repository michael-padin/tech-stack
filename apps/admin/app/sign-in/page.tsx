"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent, type KeyboardEvent } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { signIn } from "@repo/auth/client";
import { APP_NAME, env as clientEnv } from "@repo/env/client";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@repo/ui/components/input-group";
import { Label } from "@repo/ui/components/label";
import { Spinner } from "@repo/ui/components/spinner";

const SUPPORT_EMAIL = "support@example.com";
const WEB_URL = clientEnv.NEXT_PUBLIC_WEB_URL ?? "/";

export default function AdminSignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

// Only same-origin paths: "/items" is fine, "//evil.com" and "https://…" are not.
function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  return value;
}

function SignInForm() {
  const params = useSearchParams();
  const redirectTo = safeRedirect(params.get("redirect"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await signIn.email({
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    if (error) {
      setError(
        error.message ??
          `That email and password didn't match. Email ${SUPPORT_EMAIL} if you're locked out.`,
      );
      return;
    }
    // Full navigation, not router.push: the client router may hold a prefetched
    // (signed-out) response for the target — a redirect back here — and replay
    // it. A document load renders the target fresh with the new session cookie.
    window.location.assign(redirectTo);
  }

  function handleCapsLock(e: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState("CapsLock"));
  }

  const passwordDescribedBy =
    [error ? "signin-error" : null, capsLock ? "caps-lock-hint" : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <main className="relative grid min-h-svh lg:h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:overflow-hidden">
      <div className="relative flex items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
        <Link
          href={WEB_URL}
          aria-label={`${APP_NAME} home`}
          className="text-muted-foreground hover:text-foreground absolute top-6 left-6 inline-flex items-center gap-2 text-sm font-medium sm:top-8 sm:left-10 lg:left-14"
        >
          <BrandMark />
          {APP_NAME}
        </Link>
        <div className="w-full max-w-sm">
          <p className="text-muted-foreground flex items-center gap-2 text-[0.68rem] tracking-[0.22em] uppercase">
            <BrandMark />
            {APP_NAME} · Admin
          </p>
          <h1 className="mt-4 text-[2.25rem] leading-[1.05] font-semibold tracking-tight sm:text-[2.5rem]">
            Welcome back.
          </h1>
          <p className="text-muted-foreground mt-3 max-w-[30ch] text-sm leading-relaxed">
            Sign in to manage the dashboard. For invited admins only.{" "}
            <Link
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-foreground underline-offset-4 hover:underline"
            >
              Request access
            </Link>
            .
          </p>

          <form onSubmit={onSubmit} className="mt-8 grid gap-5" aria-busy={submitting}>
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-describedby={error ? "signin-error" : undefined}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <InputGroup>
                <InputGroupInput
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={handleCapsLock}
                  onKeyDown={handleCapsLock}
                  aria-describedby={passwordDescribedBy}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <EyeOffIcon aria-hidden="true" />
                    ) : (
                      <EyeIcon aria-hidden="true" />
                    )}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              {capsLock ? (
                <output id="caps-lock-hint" className="text-muted-foreground block text-xs">
                  Caps Lock is on.
                </output>
              ) : null}
            </div>

            {error ? (
              <p id="signin-error" className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={submitting} size="lg">
              {submitting ? <Spinner data-icon="inline-start" /> : null}
              {submitting ? "Signing in" : "Sign in"}
            </Button>
            <span aria-live="polite" className="sr-only">
              {submitting ? "Signing in" : ""}
            </span>
          </form>

          <div className="border-border/60 mt-10 flex items-center justify-between gap-3 border-t pt-5">
            <p className="text-muted-foreground text-xs">
              Locked out?{" "}
              <Link
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-foreground underline-offset-4 hover:underline"
              >
                {SUPPORT_EMAIL}
              </Link>
            </p>
            <p className="text-muted-foreground font-mono text-[0.6rem] tracking-[0.18em] uppercase">
              v0.1
            </p>
          </div>
        </div>
      </div>

      <aside
        className="bg-muted/30 border-border/60 relative hidden overflow-hidden lg:flex lg:border-l"
        aria-hidden="true"
      >
        <SignInIllustration />
      </aside>
    </main>
  );
}

function BrandMark() {
  return (
    <svg viewBox="0 0 16 16" className="text-primary h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <rect
        x="1.5"
        y="1.5"
        width="13"
        height="13"
        rx="3.5"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1.2"
      />
      <circle cx="8" cy="8" r="2.6" fill="currentColor" />
    </svg>
  );
}

function SignInIllustration() {
  // A restrained, neutral abstract composition: a faint dot grid, a soft
  // off-centre glow, and a few concentric rings — built entirely from theme
  // tokens so it re-skins with the palette. No product semantics.
  return (
    <svg viewBox="0 0 480 720" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <defs>
        {/* Dot grid — quiet textural background */}
        <pattern id="signin-dot-grid" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.85" fill="currentColor" />
        </pattern>
        {/* Soft glow behind the rings */}
        <radialGradient id="signin-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.1" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </radialGradient>
        {/* Edge vignette toward the background colour */}
        <radialGradient id="signin-vignette" cx="58%" cy="40%" r="85%">
          <stop offset="55%" stopColor="transparent" />
          <stop offset="100%" stopColor="var(--background)" stopOpacity="0.5" />
        </radialGradient>
      </defs>

      {/* Dot grid background, deliberately faint */}
      <rect
        width="480"
        height="720"
        className="text-muted-foreground"
        fill="url(#signin-dot-grid)"
        opacity="0.2"
      />

      {/* Off-centre glow */}
      <rect x="120" y="180" width="360" height="360" fill="url(#signin-glow)" />

      {/* Concentric rings — a calm geometric focal point */}
      <g transform="translate(300 360)" fill="none" stroke="var(--primary)">
        <circle r="150" strokeOpacity="0.1" strokeWidth="1" />
        <circle r="110" strokeOpacity="0.16" strokeWidth="1" />
        <circle r="70" strokeOpacity="0.22" strokeWidth="1" />
        <circle r="30" strokeOpacity="0.28" strokeWidth="1" />
        <circle r="4" fill="var(--primary)" fillOpacity="0.5" stroke="none" />
      </g>

      {/* A single quiet hairline crossing the canvas for depth */}
      <line
        x1="0"
        y1="220"
        x2="480"
        y2="180"
        stroke="var(--border)"
        strokeOpacity="0.6"
        strokeWidth="1"
      />

      {/* Edge vignette */}
      <rect width="480" height="720" fill="url(#signin-vignette)" />

      {/* Corner brackets — editorial framing */}
      <g stroke="var(--muted-foreground)" strokeOpacity="0.4" strokeWidth="1" fill="none">
        <path d="M 32 32 L 32 56 M 32 32 L 56 32" />
        <path d="M 448 32 L 448 56 M 448 32 L 424 32" />
        <path d="M 32 688 L 32 664 M 32 688 L 56 688" />
        <path d="M 448 688 L 448 664 M 448 688 L 424 688" />
      </g>

      {/* Eyebrow */}
      <line
        x1="68"
        y1="46"
        x2="88"
        y2="46"
        stroke="var(--primary)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <text
        x="96"
        y="50"
        fontSize="9.5"
        fontFamily="var(--font-mono, ui-monospace, monospace)"
        fill="var(--foreground)"
        fontWeight="600"
        letterSpacing="3"
      >
        {APP_NAME.toUpperCase()}
      </text>
      <text
        x="68"
        y="64"
        fontSize="8.5"
        fontFamily="var(--font-mono, ui-monospace, monospace)"
        fill="var(--muted-foreground)"
        opacity="0.7"
        letterSpacing="2.2"
      >
        INTERNAL TOOLS
      </text>

      {/* Footer caption */}
      <text
        x="68"
        y="676"
        fontSize="9"
        fontFamily="var(--font-mono, ui-monospace, monospace)"
        fill="var(--muted-foreground)"
        letterSpacing="2"
      >
        ADMIN
      </text>
    </svg>
  );
}
