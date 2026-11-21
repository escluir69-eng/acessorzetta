# Migração Órion → Lovable (roadmap)

Origem: github.com/wwwvaldomiro-oss/orion (React 19 + Express + Firebase/Firestore + Pluggy + Gemini).

## Etapas
- [ ] 1. Ativar Lovable Cloud (banco + auth)
- [ ] 2. Ledger de migração (.lovable/migrate-external-project/ledger.json)
- [ ] 3. Schema no Cloud: tabela de documentos por usuário (espelha Firestore) + storage de anexos
- [ ] 4. Adaptador Firestore→Supabase (mesma API: doc/getDoc/onSnapshot/setDoc/writeBatch) para preservar orionStore (5,9k linhas)
- [ ] 5. Portar frontend: copiar src/, converter react-router-dom → TanStack Router (12 páginas + módulos garagem/pontoPlus/viagens)
- [ ] 6. Auth: Firebase Auth (Google) → Lovable Cloud auth (Google)
- [ ] 7. Rotas de servidor Express → server routes TanStack: /api/quotes/*, /api/sgs, /api/garagem/fipe-consulta, /api/weather/*
- [ ] 8. Integrações Pluggy (serverIntegrations.ts) → server functions; segredos Pluggy via secret form
- [ ] 9. Gemini (análise de notas) → Lovable AI Gateway
- [ ] 10. Verificar build, typecheck, fluxo login → painel → CRUD
- [ ] 11. Handoff: pedir export de dados do Firestore (CSV/JSON) ao usuário

## Bloqueios
- Dados existentes: aguardando export do Firestore pelo usuário
- Credenciais Pluggy: pedir via secret form na verificação
