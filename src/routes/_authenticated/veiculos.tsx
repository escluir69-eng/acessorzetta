import { createFileRoute } from "@tanstack/react-router";
import { VeiculosPage } from "@/pages/VeiculosPage";

export const Route = createFileRoute("/_authenticated/veiculos")({
  head: () => ({
    meta: [
      { title: "Veículos — Órion" },
      { name: "description", content: "Controle de veículos, motoristas, documentos e manutenções." },
      { property: "og:title", content: "Veículos — Órion" },
      { property: "og:description", content: "Controle de veículos, motoristas, documentos e manutenções." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VeiculosPage,
});
