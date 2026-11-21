import { createFileRoute } from "@tanstack/react-router";
import { handleFipeConsulta } from "@/server/market";

export const Route = createFileRoute("/api/garagem/fipe-consulta")({
  server: { handlers: { POST: async ({ request }) => handleFipeConsulta(request) } },
});
