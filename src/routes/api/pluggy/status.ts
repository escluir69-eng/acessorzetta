import { createFileRoute } from "@tanstack/react-router";
import { handlePluggyStatus } from "@/server/pluggy";
import { requireUserId, unauthorized } from "@/server/auth";

export const Route = createFileRoute("/api/pluggy/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const uid = await requireUserId(request);
        if (!uid) return unauthorized();
        return handlePluggyStatus(uid);
      },
    },
  },
});
