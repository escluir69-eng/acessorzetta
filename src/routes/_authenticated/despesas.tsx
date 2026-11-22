import { createFileRoute } from "@tanstack/react-router";
import { DespesasPage } from "@/pages/DespesasPage";

export const Route = createFileRoute("/_authenticated/despesas")({
  head: () => ({
    meta: [
      { title: "Despesas — Zetta" },
      { name: "description", content: "Grade anual de despesas e acompanhamento de gastos." },
      { property: "og:title", content: "Despesas — Zetta" },
      { property: "og:description", content: "Grade anual de despesas e acompanhamento de gastos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DespesasPage,
});
