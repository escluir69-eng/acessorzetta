import { createFileRoute } from "@tanstack/react-router";
import { handleFiscalLookup } from "@/server/fiscal";
import { requireUserId, unauthorized } from "@/server/auth";

export const Route = createFileRoute("/api/fiscal/lookup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const uid = await requireUserId(request);
        if (!uid) return unauthorized();
        return handleFiscalLookup(request);
      },
    },
  },
});
