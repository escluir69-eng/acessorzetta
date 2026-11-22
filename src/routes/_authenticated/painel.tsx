import { createFileRoute } from "@tanstack/react-router";
import { PainelPage } from "@/pages/PainelPage";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel Financeiro — Zetta" },
      { name: "description", content: "Visão geral das finanças: saldos, receitas, despesas e compromissos do mês." },
      { property: "og:title", content: "Painel Financeiro — Zetta" },
      { property: "og:description", content: "Visão geral das finanças: saldos, receitas, despesas e compromissos do mês." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PainelPage,
});
