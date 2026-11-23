# Gestão do Consultório — Reagendar sessão e tela Agenda — Design

Data: 2026-11-23 · Projeto: `psico-hub-web` · Usuária: Lays Coelho (única)

Complementa `2026-11-12-gestao-consultorio-design.md` e `2026-11-23-vinculo-paciente-design.md`. Onde divergirem, **este vale**.

## 0. Como retomar (estado atual)

| Item | Estado |
| :-- | :-- |
| "Trocar paciente" (qualquer status) | **Feito** — commit `b19a659`. `patientChangeUpdate` em `domain/session-update.ts`, `SessionsService.changePatient`, UI inline em `sessions.component.ts` |
| Esta spec | Escrita; aguardando revisão da usuária |
| Plano de implementação | **A fazer**: `docs/superpowers/plans/2026-11-23-reagendar-e-agenda.md` (skill `writing-plans`) |
| Execução | Escolhida: **subagent-driven-development** (ledger em `.superpowers/sdd/<plano>/progress.md`) |
| Mockups | `.superpowers/brainstorm/505-1795466315/content/agenda-layout.html` (escolhida opção C) |

Próximo passo ao retomar: ler esta spec → rodar `writing-plans` sobre ela → executar com `subagent-driven-development`.

## 1. Objetivo

1. **Reagendar:** registrar que uma consulta mudou de data sem perder o histórico, sem cobrar duas vezes e sem precisar mexer no Google Agenda à mão.
2. **Agenda:** uma tela simples para a Lays ver os atendimentos da semana e agir sobre eles (confirmar, reagendar, trocar paciente).

### Decisões acordadas
- Reagendar = **a original fica com status `rescheduled` (Reagendada) e nasce uma sessão nova** na nova data.
- **O app cuida do Google Agenda:** cria o evento novo (mesmo título, descrição, lembretes e duração) e apaga o antigo.
- Pode reagendar a partir de **Agendada, Faltou e Cancelada** (com paciente). Realizada e Reagendada não.
- Conflito de horário no Agenda: **avisa mostrando os compromissos** e permite **"Reagendar mesmo assim"**.
- Nova data no passado é permitida (registrar remarcação esquecida).
- Toda a operação roda em **uma rota do servidor** (abordagem A).
- Agenda: **lista por dia** (opção C), **semana** como janela, **novo item de menu e tela inicial do `/admin`**, **ações rápidas na linha**.

### Fora de escopo
- Agenda em grade semanal/mensal, arrastar e soltar.
- Avisar o paciente (WhatsApp/e-mail) do reagendamento.
- Alterar duração ao reagendar (copia a do evento original).
- Reagendar sessão Realizada; desfazer reagendamento.
- Aprendizado de apelidos (spec de vínculo).
- Atualizar o manual em PDF (sem fonte editável no repo).

## 2. Modelo de dados

`SessionStatus` = `'scheduled' | 'done' | 'no_show' | 'cancelled' | 'rescheduled'`. Rótulo: **Reagendada**.

Campos opcionais novos em `sessions` (ausente = `null`, sem migração):

| Doc | Campo | Tipo | Nota |
| :-- | :-- | :-- | :-- |
| Original | `rescheduledToId` | string | id da sessão nova |
| Original | `rescheduledToStartsAt` | Timestamp | nova data/hora (exibição sem consulta extra) |
| Original | `statusBeforeReschedule` | `'scheduled' \| 'no_show' \| 'cancelled'` | histórico ("era Faltou") |
| Nova | `rescheduledFromId` | string | id da original |
| Nova | `rescheduledFromStartsAt` | Timestamp | data original |

- `Session` (TS) ganha os 5 campos (`string | null`, `Date | null`, status anterior `| null`). `sessionFromDoc` lê todos com validação de tipo; `STATUSES` inclui `'rescheduled'`.
- Sessão nova: `id` = id do evento novo; `calendarEventId` = mesmo id; `patientId`, `amountApplied`, `packageAmountApplied`, `calendarTitle` copiados da original; `status: 'scheduled'`; `chargeNoShowApplied: null`; `missingFromCalendar: false`.
- `firestore.rules`: sem mudança (admin-only).

## 3. Regras de negócio

- **Financeiro (`domain/finance.ts`):** `sessionCharge` já devolve 0 para tudo que não é `done`/`no_show` → `rescheduled` nunca cobra (inclusive falta cobrada que foi reagendada). `packageCharge`: "primeira sessão não cancelada" passa a ignorar **`cancelled` e `rescheduled`**.
- **Painel (`domain/dashboard.ts`):** novo contador `rescheduled` (Reagendadas) ao lado de Faltas/Canceladas; exibido no `dashboard.component`. Alerta de frequência inalterado (conta `done` + `scheduled`).
- **Sessões (`domain/sessions-view.ts`):** `statusLabel('rescheduled') = 'Reagendada'`; `canReschedule(s)` = `patientId !== null` e status ∈ {scheduled, no_show, cancelled}; `rescheduleNote(s)` → `"Reagendada para qui, 26/nov, 20:00"` (+ `" (era Faltou)"`/`" (era Cancelada)"`) na original, `"Reagendada de seg, 23/nov, 19:00"` na nova, `null` caso contrário; `groupSessions` exclui `rescheduled` de "Pendentes".
- **Reprecificação (`RepriceService`):** só mexe em `scheduled` → inalterada.
- **Sincronização (servidor):** inalterada; ignora status ≠ `scheduled` e o evento novo já existe como sessão `scheduled` com o mesmo id.

## 4. Servidor — `POST /api/admin/sessions/:id/reschedule`

Rota em `server/server.js` com `requireAdmin` (igual `sync-calendar`), aceitando também `/admin/sessions/:id/reschedule`. Corpo: `{ startsAt: string (ISO com offset), force?: boolean }`. Lógica em `server/lib/reschedule.js`:

`rescheduleSession({ sessionId, startsAt, force, calendar, calendarId, repo })` → `{ status, body }` (a rota só repassa).

1. **Validações (nada é gravado):**

   | Caso | HTTP | `error` |
   | :-- | :-- | :-- |
   | Agenda não configurado (`!calendar`) | 503 | `Google Agenda não configurado.` |
   | `startsAt` ausente/inválido | 400 | `Data/hora inválida.` |
   | Sessão não existe | 404 | `Sessão não encontrada.` |
   | Sem paciente | 422 | `Vincule um paciente antes de reagendar.` |
   | Status `done`/`rescheduled` | 409 | `Esta sessão não pode ser reagendada.` |
   | `startsAt` igual ao atual | 400 | `Escolha uma data/hora diferente da atual.` |

2. **Evento original:** `calendar.events.get({ calendarId, eventId: session.id })`. Copia `summary`, `description`, `reminders` e duração (`end - start`). Se 404/410: `summary = session.calendarTitle`, 50 min, sem descrição, lembretes padrão de `booking-event.js`.
3. **Conflitos:** `calendar.events.list({ timeMin: novoInício, timeMax: novoFim, singleEvents: true })`; descarta o próprio evento original, `status === 'cancelled'` e eventos sem `start.dateTime` (dia inteiro). Se houver e `!force` → **409** `{ error: 'Já existe compromisso nesse horário.', conflicts: [{ title, startsAt, endsAt }] }` (ISO).
4. **Cria o evento novo:** `events.insert` com `start/end` em `America/Sao_Paulo`.
5. **Grava:** `repo.commitReschedule({ originalId, newId, newData, originalUpdate })` em **transação**: relê a original; se status não permite mais → aborta com 409 (e apaga o evento novo). Grava `sessions/{newId}` (set) e atualiza a original (`status: 'rescheduled'`, `rescheduledToId`, `rescheduledToStartsAt`, `statusBeforeReschedule`). Falha → `events.delete` do novo (best effort) e **500** `Falha ao reagendar. Tente novamente.`
6. **Apaga o evento antigo:** `events.delete`; 404/410 ignorado; outro erro só `console.error` (não falha a resposta).
7. **200** `{ newSessionId, startsAt }`.

`firestore-repo.js` ganha `getSession(id)` (com `toDate` em `startsAt`) e `commitReschedule(...)`.

## 5. Front

### 5.1 Serviço
`data/reschedule.service.ts`: `reschedule(sessionId, startsAt: Date, force = false): Promise<RescheduleResult>` com `RescheduleResult = { kind: 'ok', newSessionId, startsAt: Date } | { kind: 'conflict', conflicts: { title, startsAt: Date, endsAt: Date }[] }`. Token via `AuthService.getIdToken()` e `apiUrl` como `CalendarSyncService`. Demais erros → `throw new Error(rescheduleErrorMessage(status, body))` em `data/reschedule-errors.ts` (usa `body.error` do servidor quando houver; 401/403 → mensagem de sessão expirada igual `syncErrorMessage`; 0 → sem conexão).

Conversão data+hora → `Date`: função pura `domain/datetime.ts` `zonedDateTime(dateKey 'YYYY-MM-DD', time 'HH:mm')` em `America/Sao_Paulo` (UTC−3 fixo, como `monthWindow`).

### 5.2 Componente de ações compartilhado
`sessions/session-actions.component.ts` (novo, standalone, OnPush). Entradas: `session: Session`, `patients: Patient[]`. Saídas: `done: string` (mensagem de sucesso opcional) e `failed: string` (erro). Contém:
- Botões **Realizada / Faltou / Cancelada** (comportamento atual; desabilitados em `rescheduled` e sem paciente).
- **Trocar paciente** (movido de `sessions.component.ts`, mesmo comportamento e textos).
- **Reagendar** (só se `canReschedule`): formulário inline com `z-date-picker` (padrão: data original + 7 dias), `<input type="time" z-input>` (padrão: horário original), texto "A sessão de {dd/mmm} fica como Reagendada e não é cobrada. O evento no Google Agenda é movido.", botões **Reagendar** (loading) e **Cancelar**.
  - Conflito: alerta âmbar "Já existe compromisso nesse horário:" + lista `• {título} — {dd/mmm}, {HH:mm}–{HH:mm}` + **Reagendar mesmo assim** (`force: true`) e **Escolher outro horário** (fecha o alerta, mantém o formulário).
  - Sucesso: fecha e emite `done` com `"Reagendada para {ddd, dd/mmm, HH:mm}."` (+ `" (em {mês})"` se mudou de mês).

`sessions.component.ts` passa a usar `<app-session-actions>` no cartão (remove o código movido), mostra a mensagem de `done` num alerta de status, selo **Reagendada** (`bg-slate-100 text-slate-700`, faixa lateral `#64748b`) e a linha `rescheduleNote`.

### 5.3 Tela Agenda
- Rota `agenda` em `admin.routes.ts`; `''` redireciona para `agenda`; item **Agenda** primeiro no menu do layout admin.
- `domain/agenda.ts` (puro): `weekWindow(date)` → `{ start, end }` de segunda 00:00 a segunda seguinte em UTC−3; `shiftWeek(start, ±1)`; `groupByDay(sessions, window, now)` → `[{ dayKey, label: 'Hoje · seg, 23/nov' | 'ter, 24/nov', isToday, sessions }]` só dias com sessão, em ordem.
- `agenda/agenda.component.ts`: `watchAll()` filtrado pela janela; cabeçalho "23 – 29 nov 2026" + **‹ Semana / Hoje / Semana ›** + **Sincronizar agenda** (sincroniza o(s) mês(es) da semana via `CalendarSyncService.sync`, mostra `syncSummary`).
- Linha: hora (tabular), paciente, selo de status. `rescheduled` esmaecida com `rescheduleNote`. Sem paciente: "Paciente não identificado" + link **Resolver em Sessões** → `/admin/sessoes?mes=YYYY-MM&aba=nao-identificados` (Sessões passa a ler esses query params).
- Clique na linha (com paciente) abre `<app-session-actions>` abaixo dela; uma aberta por vez; mensagens `done`/`failed` aparecem no topo.
- Vazio: "Nenhuma sessão nesta semana." Carregando: skeletons como em Sessões.

## 6. Testes

- **Servidor (`node --test`):** `reschedule.test.js` — cada validação da tabela; cópia de título/descrição/duração; fallback sem evento original; 409 com conflitos (filtra próprio evento, cancelados, dia inteiro); `force` ignora conflito; falha no commit apaga evento novo e devolve 500; falha ao apagar antigo não derruba 200. `firestore-repo.test.js` — `commitReschedule` aborta se status mudou.
- **Domínio TS:** `session-doc` (status e 5 campos), `sessions-view` (`canReschedule`, `rescheduleNote`, Pendentes sem Reagendadas), `finance` (rescheduled não cobra; pacote ignora rescheduled), `dashboard` (contador), `datetime`, `agenda` (`weekWindow` em virada de mês/ano e domingo; `groupByDay`).
- **Front:** `reschedule-errors.spec.ts`; `session-actions.component.spec.ts` (status, trocar paciente — migrar testes existentes —, reagendar ok/conflito/mesmo assim/outro horário, botão só em status certos); `sessions.component.spec.ts` (usa o componente, selo e nota); `agenda.component.spec.ts` (semana, navegação, linha abre/fecha, link Resolver).

## 7. Ordem de implementação

1. Domínio: status `rescheduled` + campos (`models`, `session-doc`), `sessions-view`, `finance`, `dashboard` (+ exibição no painel).
2. Servidor: `reschedule.js`, repo (`getSession`, `commitReschedule`), rota.
3. Front dados: `datetime.ts`, `reschedule-errors.ts`, `reschedule.service.ts`.
4. Extrair `session-actions.component.ts` (status + trocar paciente, testes migrados) sem mudar comportamento.
5. Reagendar no `session-actions` + selo/nota em Sessões.
6. Agenda: `agenda.ts`, `agenda.component.ts`, rota/menu/redirect, query params em Sessões.
