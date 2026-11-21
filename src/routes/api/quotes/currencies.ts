import { createFileRoute } from "@tanstack/react-router";
import { handleCurrencies } from "@/server/market";

export const Route = createFileRoute("/api/quotes/currencies")({
  server: { handlers: { GET: async () => handleCurrencies() } },
});
