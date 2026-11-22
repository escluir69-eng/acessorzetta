import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/painel" });
  },
  head: () => ({
    meta: [
      { title: "Zetta — Gestão Financeira & Pessoal" },
      {
        name: "description",
        content: "Gestão financeira pessoal completa: painel, receitas, despesas, carteira e agenda.",
      },
      { property: "og:title", content: "Zetta — Gestão Financeira & Pessoal" },
      {
        property: "og:description",
        content: "Gestão financeira pessoal completa: painel, receitas, despesas, carteira e agenda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => null,
});
