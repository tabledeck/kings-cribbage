import { redirect } from "react-router";
import type { Route } from "./+types/signup";
import { getOptionalUserFromContext } from "~/domain/utils/global-context.server";
import { useState } from "react";
import { signUp } from "~/lib/auth-client";

export function meta() {
  return [{ title: "Sign Up — King's Cribbage" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = getOptionalUserFromContext(context);
  if (user) throw redirect("/");
  return null;
}

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await signUp.email({ name, email, password });
      if (result.error) {
        setError(result.error.message ?? "Sign up failed.");
      } else {
        window.location.href = "/";
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="td-surface auth-page">
      <form onSubmit={handleSignup} className="td-lobby-card auth-card">
        <h2>Create account</h2>
        <p className="font-sans text-sm mb-4" style={{ color: "var(--ink-soft)" }}>
          Save your King's Cribbage games.
        </p>
        <input
          type="text"
          placeholder="Display name"
          required
          autoComplete="nickname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Display name"
        />
        <input
          type="email"
          placeholder="Email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email"
        />
        <input
          type="password"
          placeholder="Password (min 8 characters)"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label="Password"
        />
        {error && <p className="td-error mb-3">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Creating account..." : "Create Account"}
        </button>
        <p className="auth-switch">
          Already have an account? <a href="/login">Sign in</a>
        </p>
      </form>
    </div>
  );
}
