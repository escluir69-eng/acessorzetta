import { createFileRoute } from "@tanstack/react-router";
import { handlePluggyConfig, handlePluggyConnectToken, handlePluggyItem, handlePluggySync } from "@/server/pluggy";
import { requireUserId, unauthorized } from "@/server/auth";

export const Route = createFileRoute("/api/pluggy/$slot/connect-token")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const uid = await requireUserId(request);
        if (!uid) return unauthorized();
        const slot = params.slot;
        switch ("connect-token") {
          case "config": return handlePluggyConfig(uid, slot, request);
          case "connect-token": return handlePluggyConnectToken(uid, slot);
          case "item": return handlePluggyItem(uid, slot, request);
          default: return handlePluggySync(uid, slot);
        }
      },
    },
  },
});
