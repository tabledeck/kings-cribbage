import { redirect } from "react-router";
import type { Route } from "./+types/login";
import { getOptionalUserFromContext } from "~/domain/utils/global-context.server";
import { useState } from "react";
import { signIn } from "~/lib/auth-client";

export function meta() {
  return [{ title: "Login — King's Cribbage" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = getOptionalUserFromContext(context);
  if (user) throw redirect("/");
  return null;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError("Invalid email or password.");
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
      <form onSubmit={handleLogin} className="td-lobby-card auth-card">
        <h2>Sign in</h2>
        <p className="font-sans text-sm mb-4" style={{ color: "var(--ink-soft)" }}>
          Track your games on Tabledeck.
        </p>
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
          placeholder="Password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label="Password"
        />
        {error && <p className="td-error mb-3">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Signing in..." : "Sign In"}
        </button>
        <p className="auth-switch">
          No account? <a href="/signup">Sign up</a>
        </p>
        <p className="auth-switch">
          <a href="/">Play as a guest</a>
        </p>
      </form>
    </div>
  );
}
