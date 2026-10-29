import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LoginScreen } from "@/components/login-screen";
import { isAuthed } from "@/lib/session";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const navigate = useNavigate();
  useEffect(() => {
    if (isAuthed()) void navigate({ to: "/bench", replace: true });
  }, [navigate]);
  return <LoginScreen />;
}
