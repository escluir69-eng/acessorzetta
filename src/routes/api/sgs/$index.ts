import { createFileRoute } from "@tanstack/react-router";
import { handleSgs } from "@/server/market";

export const Route = createFileRoute("/api/sgs/$index")({
  server: { handlers: { GET: async ({ params }) => handleSgs(params.index) } },
});
