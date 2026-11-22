import { createFileRoute } from "@tanstack/react-router";
import { ComprasPage } from "@/pages/ComprasPage";

export const Route = createFileRoute("/_authenticated/compras")({
  head: () => ({
    meta: [
      { title: "Lista de Compras — Zetta" },
      { name: "description", content: "Listas de compras organizadas por loja." },
      { property: "og:title", content: "Lista de Compras — Zetta" },
      { property: "og:description", content: "Listas de compras organizadas por loja." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComprasPage,
});
