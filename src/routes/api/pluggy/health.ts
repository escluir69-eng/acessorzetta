import { createFileRoute } from "@tanstack/react-router";
import { handlePluggyHealth } from "@/server/pluggy";

export const Route = createFileRoute("/api/pluggy/health")({
  server: { handlers: { GET: async () => handlePluggyHealth() } },
});
