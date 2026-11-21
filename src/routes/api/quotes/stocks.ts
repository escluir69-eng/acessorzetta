import { createFileRoute } from "@tanstack/react-router";
import { handleStocks } from "@/server/market";

export const Route = createFileRoute("/api/quotes/stocks")({
  server: { handlers: { GET: async () => handleStocks() } },
});
