"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { BrandLoader } from "./BrandLoader";
import { Icon } from "./Icon";

type Action = (formData: FormData) => void | Promise<void>;

function Submit({ label, pendingLabel, loaderLabel }: { label: string; pendingLabel: string; loaderLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button className={"btn btn-green btn-lg btn-block" + (pending ? " is-loading" : "")} type="submit" disabled={pending}>
        {pending ? (
          <>
            <span className="btn-spinner" aria-hidden />
            {pendingLabel}
          </>
        ) : (
          <>
            {label}
            <Icon name="arrow" size={18} />
          </>
        )}
      </button>
      {pending ? <BrandLoader label={loaderLabel} /> : null}
    </>
  );
}

export function AuthForm({
  mode,
  action,
  error,
}: {
  mode: "login" | "signup";
  action: Action;
  error?: string;
}) {
  const [show, setShow] = useState(false);
  const login = mode === "login";

  return (
    <form action={action} className="auth-form">
      {error ? (
        <div className="alert" role="alert">
          <Icon name="alert" size={18} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="auth-field">
        <label htmlFor="email">Email address</label>
        <div className="input-icon">
          <Icon name="mail" />
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete={login ? "username" : "email"}
            placeholder="you@company.com"
            autoFocus
          />
        </div>
      </div>

      <div className="auth-field">
        <label htmlFor="password">Password</label>
        <div className="input-icon">
          <Icon name="lock" />
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            required
            minLength={6}
            autoComplete={login ? "current-password" : "new-password"}
            placeholder={login ? "Enter your password" : "At least 6 characters"}
          />
          <button
            type="button"
            className="input-toggle"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
          >
            <Icon name={show ? "eyeOff" : "eye"} />
          </button>
        </div>
      </div>

      <Submit
        label={login ? "Sign in" : "Create account"}
        pendingLabel={login ? "Signing in…" : "Creating account…"}
        loaderLabel={login ? "Signing you in" : "Setting up your workspace"}
      />

      <p className="auth-switch">
        {login ? (
          <>
            New here? <Link href="/signup">Create an account</Link>
          </>
        ) : (
          <>
            Already registered? <Link href="/login">Sign in</Link>
          </>
        )}
      </p>
    </form>
  );
}
