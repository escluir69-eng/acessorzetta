import { createFileRoute } from "@tanstack/react-router";
import { VeiculosPage } from "@/pages/VeiculosPage";

export const Route = createFileRoute("/_authenticated/veiculos")({
  head: () => ({
    meta: [
      { title: "Veículos — Zetta" },
      { name: "description", content: "Controle de veículos, motoristas, documentos e manutenções." },
      { property: "og:title", content: "Veículos — Zetta" },
      { property: "og:description", content: "Controle de veículos, motoristas, documentos e manutenções." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VeiculosPage,
});
