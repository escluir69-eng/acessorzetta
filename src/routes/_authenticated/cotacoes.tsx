import { createFileRoute } from "@tanstack/react-router";
import { BolsaPage } from "@/pages/BolsaPage";

export const Route = createFileRoute("/_authenticated/cotacoes")({
  head: () => ({
    meta: [
      { title: "Bolsa & Moedas — Zetta" },
      { name: "description", content: "Cotações da B3, moedas e indicadores econômicos." },
      { property: "og:title", content: "Bolsa & Moedas — Zetta" },
      { property: "og:description", content: "Cotações da B3, moedas e indicadores econômicos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BolsaPage,
});
