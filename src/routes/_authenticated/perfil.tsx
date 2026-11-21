import { createFileRoute } from "@tanstack/react-router";
import { PerfilPage } from "@/pages/PerfilPage";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — Órion" },
      { name: "description", content: "Dados do perfil e preferências da conta." },
      { property: "og:title", content: "Perfil — Órion" },
      { property: "og:description", content: "Dados do perfil e preferências da conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PerfilPage,
});
