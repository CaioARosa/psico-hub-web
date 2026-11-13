# Diagnóstico de Evolução — Gestão do Consultório

Data: 2026-11-12 · Escopo: Fase 1 (Núcleo) · Base: spec `docs/superpowers/specs/2026-11-12-gestao-consultorio-design.md` e plano `docs/superpowers/plans/2026-11-12-gestao-fase-1-nucleo.md`

## 1. Veredito

A ideia é válida para o escopo: uma área privada para a Lays controlar sessões, acordos e pagamentos, com dados financeiros em centavos e sincronização idempotente com o Google Agenda. A lógica central está implementada e testada.

Três pontos impedem ir para produção: a segurança das regras não foi testada, a premissa de vínculo (nome no título do evento) não foi confirmada, e há um conflito entre a spec ("nada clínico") e o código atual.

## 2. Estado verificado

| Item | Resultado |
| :-- | :-- |
| Testes do backend (`cd server && npm test`) | 51/51 passam |
| Middleware `requireAdmin` (401 sem token, 403 sem claim) | Implementado conforme spec §8 |
| `monthWindow` (UTC-3 fixo) e `planSessionSync` | Implementados; cobrem dia inteiro, cancelado, virada de mês |
| Idempotência (`calendarEventId` como ID do doc) | Implementada em `firestore-repo.js` |
| Regras do Firestore (`firestore.rules`) | Corretas, mas **não testadas** (ver item 2.1) |
| Testes de regras (`npm run test:rules`) | **Não rodam**: Java ausente nesta máquina |
| Testes do frontend (`npx ng test --watch=false`) | 98/98 passam (após `npm install`; o `firebase` não estava instalado depois do pull) |

## 3. Diagnóstico por área

### 3.1 Bloqueadores

1. **Premissa de vínculo não confirmada.** Toda a sincronização depende de o título do evento conter o nome do paciente. A spec (§11) pede confirmação com a Lays. Se não contiver, quase todas as sessões caem em "Não identificados".
2. **Regras do Firestore sem teste.** O emulador exige JDK 11+. Sem ele, a única barreira de acesso aos dados não é verificada.
3. **Conflito de privacidade.** O `POST /api/book` grava no Google Agenda o e-mail e o campo "Notas/Queixas" do paciente (`server/server.js`, linhas ~174-180). A spec diz "nada clínico é armazenado". Queixas são dado de saúde (LGPD, art. 11).

### 3.2 Melhorias de segurança

- `/api/book` e `/api/availability` são públicos, sem rate limit, e o CORS está aberto (`app.use(cors())`).
- `verifyIdToken` não usa `checkRevoked`; uma sessão revogada continua válida até expirar.
- As regras aceitam qualquer tipo em qualquer campo. Para uma usuária só, o risco é baixo, mas validar tipos (`amount` inteiro ≥ 0, `status` no enum) protege contra erro de escrita no cliente.

### 3.3 Lacunas funcionais (baixa prioridade)

- Evento movido para outro mês: a sessão aparece como "Removida do Agenda" no mês antigo até o mês novo ser sincronizado.
- Sessão já existente sem paciente, recriada por mudança de mês, não tenta o vínculo de novo (o caminho de atualização não chama `findPatientForEvent`).
- `missingFromCalendar` é marcado a partir de uma única leitura do Agenda. Se a leitura falhar parcialmente, pode marcar sessões indevidamente (hoje a falha propaga e não grava, o que é correto).

### 3.4 Documentação desatualizada

- `README.md` ainda cita Render na seção de troubleshooting (a infra é Cloud Run).
- `src/app/pages/admin/data/firebase-config.ts` tem comentário "PENDING", mas as chaves já estão preenchidas.
- A árvore de pastas do README não inclui `/admin`.

## 4. Squad sugerido

| Expert | Função |
| :-- | :-- |
| `@security-auditor` | Revisar `/api/book`, rate limit, `checkRevoked` e regras |
| `@legal-advisor` | Validar tratamento de dado de saúde (LGPD) e sigilo profissional |
| `@test-automator` | Ativar o emulador e cobrir os caminhos de borda da sincronização |
| `@ui-ux-pro-max` | Revisar telas de Sessões e Pacientes na Fase 1 |

## 5. Plano de ação

1. Confirmar com a Lays que o título do evento contém o nome do paciente (2 min).
2. Instalar JDK 17 e rodar `npm run test:rules` (cerca de 10 min).
3. Decidir o destino do campo "Notas/Queixas" em `/api/book`: remover do evento ou atualizar a spec (cerca de 30 min para remover).
4. Validar com profissional jurídico o enquadramento LGPD e a guarda de dados (cerca de 1 semana, externo).
5. Aplicar rate limit e `checkRevoked` no backend (cerca de 1 hora).
6. Atualizar README (Render → Cloud Run; seção `/admin`; `firebase-config.ts`) (cerca de 20 min).

## 6. Premissas

- A Lays é a única usuária; não há perfis.
- Volume de dezenas de pacientes, dentro do plano gratuito do Firebase.
- Os itens 2 e 3 de "Bloqueadores" não foram verificados em produção.
