import { createFileRoute } from "@tanstack/react-router";
import { handleWeatherSearch } from "@/server/market";

export const Route = createFileRoute("/api/weather/search/")({
  server: { handlers: { GET: async ({ request }) => handleWeatherSearch(new URL(request.url)) } },
});
