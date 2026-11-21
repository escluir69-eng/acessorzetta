import { createFileRoute } from "@tanstack/react-router";
import { handlePluggyItem } from "@/server/pluggy";
import { requireUserId, unauthorized } from "@/server/auth";

export const Route = createFileRoute("/api/pluggy/$slot/item")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const uid = await requireUserId(request);
        if (!uid) return unauthorized();
        return handlePluggyItem(uid, params.slot, request);
      },
    },
  },
});
