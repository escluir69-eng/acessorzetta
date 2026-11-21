import { createFileRoute } from "@tanstack/react-router";
import { handlePluggyConfig } from "@/server/pluggy";
import { requireUserId, unauthorized } from "@/server/auth";

export const Route = createFileRoute("/api/pluggy/$slot/config")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const uid = await requireUserId(request);
        if (!uid) return unauthorized();
        return handlePluggyConfig(uid, params.slot, request);
      },
    },
  },
});
