import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/pages/LoginPage";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Zetta" },
      { name: "description", content: "Acesse sua conta Zetta com e-mail, Google, Apple ou link de acesso." },
      { property: "og:title", content: "Entrar — Zetta" },
      { property: "og:description", content: "Acesse sua conta Zetta com e-mail, Google, Apple ou link de acesso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});
