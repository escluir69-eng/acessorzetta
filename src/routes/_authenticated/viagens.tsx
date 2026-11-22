import { createFileRoute } from "@tanstack/react-router";
import { ViagensPage } from "@/pages/ViagensPage";

export const Route = createFileRoute("/_authenticated/viagens")({
  head: () => ({
    meta: [
      { title: "Viagens — Zetta" },
      { name: "description", content: "Planejamento de viagens, rotas e comparativo de transportes." },
      { property: "og:title", content: "Viagens — Zetta" },
      { property: "og:description", content: "Planejamento de viagens, rotas e comparativo de transportes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ViagensPage,
});
