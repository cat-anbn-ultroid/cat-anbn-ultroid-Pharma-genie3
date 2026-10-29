import { createFileRoute } from "@tanstack/react-router";
import { BenchScreen } from "@/components/bench-screen";
import { DeskGate } from "@/components/desk-gate";

export const Route = createFileRoute("/bench")({ component: BenchPage });

function BenchPage() {
  return (
    <DeskGate>
      <BenchScreen />
    </DeskGate>
  );
}
