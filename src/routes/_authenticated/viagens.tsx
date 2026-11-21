import { createFileRoute } from "@tanstack/react-router";
import { ViagensPage } from "@/pages/ViagensPage";

export const Route = createFileRoute("/_authenticated/viagens")({
  head: () => ({
    meta: [
      { title: "Viagens — Órion" },
      { name: "description", content: "Planejamento de viagens, rotas e comparativo de transportes." },
      { property: "og:title", content: "Viagens — Órion" },
      { property: "og:description", content: "Planejamento de viagens, rotas e comparativo de transportes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ViagensPage,
});
