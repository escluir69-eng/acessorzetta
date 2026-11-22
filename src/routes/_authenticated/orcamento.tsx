import { createFileRoute } from "@tanstack/react-router";
import { OrcamentoPage } from "@/pages/OrcamentoPage";

export const Route = createFileRoute("/_authenticated/orcamento")({
  head: () => ({
    meta: [
      { title: "Planejamento Orçamentário — Zetta" },
      { name: "description", content: "Planejamento e metas do orçamento pessoal." },
      { property: "og:title", content: "Planejamento Orçamentário — Zetta" },
      { property: "og:description", content: "Planejamento e metas do orçamento pessoal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrcamentoPage,
});
