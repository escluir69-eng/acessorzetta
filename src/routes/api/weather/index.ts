import { createFileRoute } from "@tanstack/react-router";
import { handleWeather } from "@/server/market";

export const Route = createFileRoute("/api/weather/")({
  server: { handlers: { GET: async ({ request }) => handleWeather(new URL(request.url)) } },
});
