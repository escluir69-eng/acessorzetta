import { createFileRoute } from "@tanstack/react-router";
import { handleStockSymbol } from "@/server/market";

export const Route = createFileRoute("/api/quotes/stock/$symbol")({
  server: { handlers: { GET: async ({ params }) => handleStockSymbol(params.symbol) } },
});
