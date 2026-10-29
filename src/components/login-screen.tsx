import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import logo from "@/assets/logo.png";
import { signIn } from "@/lib/session";

export function LoginScreen() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!signIn(username, password)) {
      setError("Those credentials are not on this desk.");
      return;
    }
    void navigate({ to: "/bench" });
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="flex flex-col justify-between bg-forest px-6 py-8 text-paper lg:px-12 lg:py-12">
        <p className="text-sm font-semibold tracking-widest uppercase">Pharmagenie</p>
        <img
          src={logo}
          alt="Pharmagenie mark: a capsule wrapped around a DNA helix"
          className="mx-auto my-8 w-full max-w-md"
        />
        <p className="max-w-sm text-base leading-relaxed text-mint">
          A CYP2C19 bench. Read a VCF, then retrieve only what is in the guideline file you loaded.
        </p>
      </section>
      <section className="flex items-center bg-bg px-6 py-10 lg:px-16">
        <form onSubmit={onSubmit} className="w-full max-w-md">
          <p className="text-sm font-semibold tracking-wide text-sage uppercase">Prototype desk</p>
          <h1 className="mt-2 text-4xl text-ink">Sign in</h1>
          <p className="mt-3 text-base leading-relaxed text-muted">
            This lock is local to the browser. Calls are not sent to an account server.
          </p>
          <label className="mt-8 block text-sm font-semibold text-ink" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="mt-2 h-12 w-full rounded-lg border border-line bg-surface px-3 text-base text-ink"
          />
          <label className="mt-4 block text-sm font-semibold text-ink" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 h-12 w-full rounded-lg border border-line bg-surface px-3 text-base text-ink"
          />
          {error ? (
            <p className="mt-4 text-sm font-semibold text-clay" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="mt-6 h-12 w-full rounded-lg bg-forest text-base font-semibold text-paper"
          >
            Enter the bench
          </button>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Desk login <span className="font-semibold text-ink">XYZ123</span>
            <span className="px-1">·</span>
            password <span className="font-semibold text-ink">0000</span>
          </p>
        </form>
      </section>
    </main>
  );
}
