import { createFileRoute } from "@tanstack/react-router";
import { handlePluggySync } from "@/server/pluggy";
import { requireUserId, unauthorized } from "@/server/auth";

export const Route = createFileRoute("/api/pluggy/$slot/sync")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const uid = await requireUserId(request);
        if (!uid) return unauthorized();
        return handlePluggySync(uid, params.slot);
      },
    },
  },
});
