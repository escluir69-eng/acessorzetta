import { createFileRoute } from "@tanstack/react-router";
import { CarteiraPage } from "@/pages/CarteiraPage";

export const Route = createFileRoute("/_authenticated/carteira")({
  head: () => ({
    meta: [
      { title: "Carteira — Zetta" },
      { name: "description", content: "Contas bancárias, cartões de crédito e transações." },
      { property: "og:title", content: "Carteira — Zetta" },
      { property: "og:description", content: "Contas bancárias, cartões de crédito e transações." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CarteiraPage,
});
