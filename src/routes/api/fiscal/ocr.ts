import { createFileRoute } from "@tanstack/react-router";
import { handleFiscalOcr } from "@/server/fiscal";
import { requireUserId, unauthorized } from "@/server/auth";

export const Route = createFileRoute("/api/fiscal/ocr")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const uid = await requireUserId(request);
        if (!uid) return unauthorized();
        return handleFiscalOcr(request);
      },
    },
  },
});
