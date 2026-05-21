import { createFileRoute, redirect } from "@tanstack/react-router";

// The dual-camera analyze flow now lives on the home page.
export const Route = createFileRoute("/analyze")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: () => null,
});
