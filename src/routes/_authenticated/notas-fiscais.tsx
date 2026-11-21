import { createFileRoute } from "@tanstack/react-router";
import { NotasFiscaisPage } from "@/pages/NotasFiscaisPage";

export const Route = createFileRoute("/_authenticated/notas-fiscais")({
  head: () => ({
    meta: [
      { title: "Notas Fiscais — Órion" },
      { name: "description", content: "Registro e análise de notas fiscais e comprovantes." },
      { property: "og:title", content: "Notas Fiscais — Órion" },
      { property: "og:description", content: "Registro e análise de notas fiscais e comprovantes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotasFiscaisPage,
});
