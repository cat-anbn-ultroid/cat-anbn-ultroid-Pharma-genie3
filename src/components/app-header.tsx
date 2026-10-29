import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import logo from "@/assets/logo.png";
import { signOut } from "@/lib/session";

export function AppHeader() {
  const navigate = useNavigate();
  return (
    <header className="bg-forest text-onrisk">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 lg:px-6">
        <img src={logo} alt="" className="h-14 w-auto" />
        <div className="min-w-0 flex-1">
          <p className="font-sans text-xs font-semibold tracking-widest uppercase">Pharmagenie</p>
          <p className="truncate font-display text-lg leading-tight">CYP2C19</p>
        </div>
        <p className="hidden font-sans text-sm text-mint sm:block">XYZ123</p>
        <button
          type="button"
          onClick={() => {
            signOut();
            void navigate({ to: "/" });
          }}
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-mint px-3 font-sans text-sm font-semibold text-onrisk"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </header>
  );
}
