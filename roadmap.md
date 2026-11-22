# Migração Órion → Lovable (roadmap)

## Repaginação Zetta
- [x] Aplicar nome, logos separadas e identidade visual oficial
- [x] Renovar login com e-mail, Google, Apple, link mágico e recuperação (provedores habilitados; acesso externo e entrega de e-mail não exercitados)
- [x] Completar perfil privado, avatar, aparência e Pix (salvamento, recarga e upload conferidos)
- [x] Reutilizar integração Pluggy criptografada com teste real HTTP 200; sincronização automática opcional ao abrir, uma vez ao dia
- [x] Conferir as 12 páginas e todas as abas do perfil em 360px e 412px, sem vazamento horizontal; 107 testes passaram
- [ ] Confirmar suporte à vinculação manual Google com outro e-mail — bloqueado: opção não disponível nas configurações de autenticação acessíveis; linkIdentity implementado com retorno honesto de erro
- [ ] Ativar conexões Alexa / WhatsApp — bloqueado: contas/provedores de automação não conectados; status permanece desconectado

Origem: github.com/wwwvaldomiro-oss/orion (React 19 + Express + Firebase/Firestore + Pluggy + Gemini).

## Etapas
- [x] 1. Ativar Lovable Cloud (banco + auth)
- [x] 2. Ledger de migração (.lovable/migrate-external-project/ledger.json)
- [x] 3. Schema no Cloud: tabela de documentos por usuário (espelha Firestore) + storage de anexos
- [x] 4. Adaptador Firestore→Supabase (mesma API: doc/getDoc/onSnapshot/setDoc/writeBatch) para preservar orionStore (5,9k linhas)
- [x] 5. Portar frontend: copiar src/, converter react-router-dom → TanStack Router (12 páginas + módulos garagem/pontoPlus/viagens)
- [x] 6. Auth: Firebase Auth (Google) → Lovable Cloud auth (Google)
- [x] 7. Rotas de servidor Express → server routes TanStack: /api/quotes/*, /api/sgs, /api/garagem/fipe-consulta, /api/weather/*
- [x] 8. Integrações Pluggy (serverIntegrations.ts) → server functions; segredos Pluggy via secret form
- [x] 9. Gemini (análise de notas) → Lovable AI Gateway
- [x] 10. Verificar build, typecheck, fluxo login → painel → CRUD
- [x] 11. Handoff: pedir export de dados do Firestore (CSV/JSON) ao usuário

## Bloqueios
- Dados existentes: export SQL importado e verificado; 880 registros originais preservados e 380 documentos convertidos
- Pluggy: conexão salva validada ao vivo nesta repaginação (HTTP 200), sem buscar movimentações nem reativar vínculos.

## Importação de dados recebidos
- [x] Converter e preservar os 880 registros do arquivo SQL para a conta correspondente
- [x] Gravar sem sobrescrever dados existentes e conferir totais e vínculos (380 de 380 documentos idênticos)
- [x] Verificar receitas, despesas, orçamento e carteira na conta autenticada
