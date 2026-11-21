import { createFileRoute } from "@tanstack/react-router";
import { AgendaPage } from "@/pages/AgendaPage";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Órion" },
      { name: "description", content: "Agenda integrada de Brasília/DF com eventos, contatos e notas." },
      { property: "og:title", content: "Agenda — Órion" },
      { property: "og:description", content: "Agenda integrada de Brasília/DF com eventos, contatos e notas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgendaPage,
});
