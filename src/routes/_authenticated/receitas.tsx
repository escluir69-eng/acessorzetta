import { createFileRoute } from "@tanstack/react-router";
import { ReceitasPage } from "@/pages/ReceitasPage";

export const Route = createFileRoute("/_authenticated/receitas")({
  head: () => ({
    meta: [
      { title: "Receitas & Contratos — Zetta" },
      { name: "description", content: "Controle de receitas, contratos parcelados e emissão de faturas PDF/Pix." },
      { property: "og:title", content: "Receitas & Contratos — Zetta" },
      { property: "og:description", content: "Controle de receitas, contratos parcelados e emissão de faturas PDF/Pix." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReceitasPage,
});
