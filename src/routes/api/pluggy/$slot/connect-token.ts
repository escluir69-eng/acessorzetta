import { createFileRoute } from "@tanstack/react-router";
import { handlePluggyConnectToken } from "@/server/pluggy";
import { requireUserId, unauthorized } from "@/server/auth";

export const Route = createFileRoute("/api/pluggy/$slot/connect-token")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const uid = await requireUserId(request);
        if (!uid) return unauthorized();
        return handlePluggyConnectToken(uid, params.slot);
      },
    },
  },
});
