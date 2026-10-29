import { createFileRoute, redirect } from "@tanstack/react-router";
import { IntakeApp } from "@/components/intake/intake-app";

const servedAtOnboard = import.meta.env.BASE_URL === "/onboard/";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (servedAtOnboard) return;
    throw redirect({ to: "/onboard" });
  },
  component: servedAtOnboard ? IntakeApp : function Redirecting() {
    return null;
  },
});
