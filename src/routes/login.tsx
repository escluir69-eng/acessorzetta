import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/pages/LoginPage";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Órion" },
      { name: "description", content: "Acesse sua conta Órion com Google." },
      { property: "og:title", content: "Entrar — Órion" },
      { property: "og:description", content: "Acesse sua conta Órion com Google." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});
