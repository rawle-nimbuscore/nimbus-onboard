import { createFileRoute } from "@tanstack/react-router";
import { IntakeApp } from "@/components/intake/intake-app";

export const Route = createFileRoute("/onboard")({
  component: Onboard,
});

function Onboard() {
  return <IntakeApp />;
}
