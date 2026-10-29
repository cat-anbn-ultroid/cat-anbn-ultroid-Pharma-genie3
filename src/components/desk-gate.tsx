import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import logo from "@/assets/logo.png";
import { isAuthed } from "@/lib/session";

export function DeskGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthed()) {
      void navigate({ to: "/", replace: true });
      return;
    }
    setReady(true);
  }, [navigate]);

  if (!ready) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-forest px-6 text-onrisk">
        <img src={logo} alt="" className="w-full max-w-xs" />
        <p className="mt-4 font-sans text-sm tracking-widest uppercase">Opening the bench</p>
      </main>
    );
  }

  return children;
}
