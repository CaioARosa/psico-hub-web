# Reagendar sessão e tela Agenda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Status "Reagendada" com criação da sessão nova (e do evento no Google Agenda) por uma rota do servidor, mais uma tela Agenda semanal em lista com ações rápidas.

**Architecture:** Domínio TS puro (`src/app/pages/admin/domain`) ganha o status e regras; o servidor Express (`server/`) ganha `POST /api/admin/sessions/:id/reschedule` com lógica injetável em `server/lib/reschedule.js`; o front chama a rota por um serviço HTTP e as ações do cartão viram um componente compartilhado entre Sessões e Agenda.

**Tech Stack:** Angular 22 (standalone, signals, OnPush, templates inline), ZardUI + Tailwind 4, Firestore client SDK, Vitest (`npx ng test --watch=false --include <arquivo>`); servidor Node/Express, googleapis, firebase-admin, `node --test` (rodar em `server/`: `npm test`).

**Spec:** `docs/superpowers/specs/2026-11-23-reagendar-e-agenda-design.md` (ler §2–§5 antes de cada tarefa; ela é a autoridade).

## Global Constraints

- Textos da UI e mensagens de erro em pt-BR, **exatamente** como na spec (§4 tabela, §5.2, §5.3).
- Fuso: `America/Sao_Paulo`, tratado como UTC−3 fixo (igual `domain/month.ts` e `server/lib/calendar-sync.js`).
- Status novo: `'rescheduled'`, rótulo `Reagendada`. Campos novos (todos opcionais/`null`): `rescheduledToId`, `rescheduledToStartsAt`, `statusBeforeReschedule`, `rescheduledFromId`, `rescheduledFromStartsAt`.
- Reagendável: `patientId !== null` e status ∈ {`scheduled`, `no_show`, `cancelled`}.
- Gravação no Firestore pelo front sempre via `runWrite` (`data/safe-write.ts`); chamadas HTTP autenticadas como `CalendarSyncService` (Bearer `AuthService.getIdToken()`, `apiUrl = isDevMode() ? 'http://localhost:3000' : '/api'`).
- Componentes: standalone, `ChangeDetectionStrategy.OnPush`, template inline, `input()`/`output()`, ZardUI (`z-button`, `z-select`, `z-alert`, `z-badge`, `z-date-picker`, `z-input`).
- Sem dependências novas. Sem mudança em `firestore.rules`.
- Commits pequenos, mensagem no padrão `feat(admin): ...` / `feat(server): ...`, sem empurrar (`push`) nada.

## Review Focus

1. **Navegador fora de UTC−3:** data/hora digitadas devem virar o instante certo em São Paulo — `zonedDateTime('2026-11-26','20:00')` = `2026-11-26T23:00:00.000Z` independente do TZ da máquina (teste na Task 3).
2. **Reagendar para outro mês:** a mensagem inclui `" (em dezembro)"` e a original some de "Pendentes" no mês de origem (testes nas Tasks 1 e 5).
3. **Clique duplo / status mudou entre leitura e gravação:** `commitReschedule` aborta com 409 e o evento novo é apagado (teste na Task 2).
4. **Evento original já apagado do Agenda** (`missingFromCalendar`): reagendar ainda funciona com título da sessão e 50 min (teste na Task 2).
5. **Semana que cruza meses/ano** (ex.: 28/dez–3/jan): `weekWindow` correto e o botão Sincronizar sincroniza os dois meses (testes na Task 6).

---

### Task 1: Domínio — status `rescheduled`, campos, Sessões/Financeiro/Painel

**Files:**
- Modify: `src/app/pages/admin/domain/models.ts`, `domain/session-doc.ts`, `domain/sessions-view.ts`, `domain/finance.ts` (`packageCharge`), `domain/dashboard.ts`, `painel/dashboard.component.ts` (novo card após "Cancelamentos")
- Modify (tipos): qualquer fixture `Session` em `*.spec.ts` que o compilador acusar (adicionar os 5 campos `null`)
- Test: `domain/session-doc.spec.ts`, `domain/sessions-view.spec.ts`, `domain/finance.spec.ts`, `domain/dashboard.spec.ts`

**Interfaces:**
- Produces:
  - `type SessionStatus = 'scheduled' | 'done' | 'no_show' | 'cancelled' | 'rescheduled'`
  - `type ReschedulableStatus = 'scheduled' | 'no_show' | 'cancelled'`
  - `Session` + `rescheduledToId: string | null; rescheduledToStartsAt: Date | null; statusBeforeReschedule: ReschedulableStatus | null; rescheduledFromId: string | null; rescheduledFromStartsAt: Date | null`
  - `canReschedule(session: Session): boolean`
  - `rescheduleNote(session: Session): string | null`
  - `formatShortDateTime(date: Date): string` → `"qui, 26/nov, 20:00"` (dia da semana abreviado minúsculo sem ponto, `dd/mmm` com abreviação de `MONTH_ABBREVIATIONS`, `HH:mm`, tudo em UTC−3; implementar sem `Intl` para o dia/mês, como `monthLabel`)
  - `Dashboard.rescheduled: number`

- [ ] **Step 1: Testes que falham**
  - `session-doc.spec.ts`: `sessionFromDoc('x', { status: 'rescheduled', rescheduledToId: 'n1', rescheduledToStartsAt: new Date('2026-11-26T23:00:00Z'), statusBeforeReschedule: 'no_show' })` → `status 'rescheduled'`, campos lidos; ausentes → `null`; `statusBeforeReschedule: 'done'` (inválido) → `null`; `rescheduledToStartsAt: 'texto'` → `null`.
  - `sessions-view.spec.ts`:
    - `statusLabel('rescheduled')` = `'Reagendada'`.
    - `canReschedule`: true para scheduled/no_show/cancelled com paciente; false para done, rescheduled, e `patientId: null`.
    - `rescheduleNote` original: `{ status:'rescheduled', rescheduledToStartsAt: 2026-11-26T23:00Z, statusBeforeReschedule:'scheduled' }` → `'Reagendada para qui, 26/nov, 20:00'`; com `'no_show'` → `'Reagendada para qui, 26/nov, 20:00 (era Faltou)'`; com `'cancelled'` → `'... (era Cancelada)'`.
    - `rescheduleNote` nova: `{ status:'scheduled', rescheduledFromStartsAt: 2026-11-23T22:00Z }` → `'Reagendada de seg, 23/nov, 19:00'`; sem campos → `null`.
    - `groupSessions`: sessão `rescheduled` passada com paciente não entra em `pending`.
  - `finance.spec.ts`: pacote mensal cuja primeira sessão do mês é `rescheduled` com `packageAmountApplied: 70000` e a segunda `scheduled` com `60000` → cobra `60000`; sessão `rescheduled` com `amountApplied` e `chargeNoShowApplied: true` → cobra 0.
  - `dashboard.spec.ts`: mês com 1 `rescheduled` → `dashboard.rescheduled === 1`; não altera `cancelled`.
- [ ] **Step 2:** `npx ng test --watch=false --include src/app/pages/admin/domain/**/*.spec.ts` → FALHA (compilação/asserções).
- [ ] **Step 3: Implementar**: tipos em `models.ts`; `STATUSES` + leitura validada em `session-doc.ts` (datas via o `toDate` existente, mas devolvendo `null` quando não é Date/Timestamp); `STATUS_LABELS`, `canReschedule`, `rescheduleNote`, `formatShortDateTime`, filtro de `pending` em `sessions-view.ts`; `packageCharge` ignora `cancelled` e `rescheduled`; `rescheduled` em `buildDashboard`; card "Reagendadas" no `dashboard.component.ts` (mesmo markup dos vizinhos, `[appCountUp]="dashboard().rescheduled"`; grid continua `lg:grid-cols-4`). Corrigir fixtures que o compilador acusar.
- [ ] **Step 4:** `npx ng test --watch=false` → todos passam.
- [ ] **Step 5:** `git commit -m "feat(admin): status Reagendada no dominio, financeiro e painel"`

### Task 2: Servidor — `rescheduleSession`, repo e rota

**Files:**
- Create: `server/lib/reschedule.js`, `server/lib/reschedule.test.js`
- Modify: `server/lib/firestore-repo.js` (+ `getSession`, `commitReschedule`), `server/lib/firestore-repo.test.js`, `server/server.js` (rota)

**Interfaces:**
- Produces:
  - `rescheduleSession({ sessionId, startsAt, force, calendar, calendarId, repo }) → Promise<{ status: number, body: object }>`
  - repo: `getSession(id) → Promise<object | null>` (`startsAt` como `Date`); `commitReschedule({ originalId, newId, newData, originalUpdate }) → Promise<void>`, lança `Error` com `code = 'NOT_RESCHEDULABLE'` se, dentro da transação, a original não existe ou status ∉ {scheduled, no_show, cancelled}.
  - Rota: `POST ['/api/admin/sessions/:id/reschedule', '/admin/sessions/:id/reschedule']` com `requireAdmin`; `res.status(status).json(body)`.
  - 200 body: `{ newSessionId, startsAt }` (ISO); 409 conflito: `{ error: 'Já existe compromisso nesse horário.', conflicts: [{ title, startsAt, endsAt }] }` (ISO).

- [ ] **Step 1: Testes que falham** em `reschedule.test.js` com `calendar` e `repo` falsos (objetos com funções que registram chamadas, como em `calendar-sync.test.js`):
  - cada linha da tabela de validação da spec §4 (status + `error` exato), incluindo `calendar: null` → 503;
  - sucesso: evento original `{ summary:'Psicoterapia Ana', description:'d', reminders:{useDefault:true}, start 2026-11-23T22:00Z, end 22:50Z }`, `startsAt:'2026-11-26T20:00:00-03:00'` → `events.insert` com mesmo summary/description/reminders, `start.dateTime` `2026-11-26T23:00:00.000Z`, `end` +50 min, `timeZone 'America/Sao_Paulo'`; `commitReschedule` recebe `newData` (`patientId`, `amountApplied`, `packageAmountApplied`, `calendarTitle` copiados; `status:'scheduled'`; `chargeNoShowApplied:null`; `missingFromCalendar:false`; `calendarEventId:newId`; `rescheduledFromId`; `rescheduledFromStartsAt`) e `originalUpdate` (`status:'rescheduled'`, `rescheduledToId`, `rescheduledToStartsAt`, `statusBeforeReschedule` = status anterior); `events.delete` do antigo; 200.
  - `events.get` rejeita com `{ code: 404 }` → usa `session.calendarTitle` e 50 min.
  - conflitos: `events.list` devolve [próprio evento, cancelado, dia inteiro, `{ summary:'Psicoterapia Bruno', start/end dateTime }`] → 409 só com Bruno; com `force:true` → 200.
  - `commitReschedule` lança → `events.delete` do **novo** e 500 `Falha ao reagendar. Tente novamente.`; com `code 'NOT_RESCHEDULABLE'` → apaga o novo e 409 `Esta sessão não pode ser reagendada.`
  - `events.delete` do antigo rejeita → ainda 200.
  - `firestore-repo.test.js`: `commitReschedule` com db falso cuja transação lê original `status:'done'` → lança `NOT_RESCHEDULABLE` e não grava (testar via função pura exportada `planRescheduleCommit(existingData, args)` que devolve `{ writes }` ou lança — mesmo estilo de `resolveUpsertWrite`).
- [ ] **Step 2:** `cd server; npm test` → FALHA.
- [ ] **Step 3: Implementar** `reschedule.js` (reaproveitar `reminders` de `buildBookingEvent` para o fallback, extraindo uma constante exportada em `booking-event.js` se preciso), repo (`db.runTransaction`) e rota em `server.js` ao lado de `sync-calendar`.
- [ ] **Step 4:** `cd server; npm test` → todos passam.
- [ ] **Step 5:** `git commit -m "feat(server): rota de reagendamento com Google Agenda e transacao"`

### Task 3: Front — `zonedDateTime`, erros e `RescheduleService`

**Files:**
- Create: `src/app/pages/admin/domain/datetime.ts` (+ `.spec.ts`), `data/reschedule-errors.ts` (+ `.spec.ts`), `data/reschedule.service.ts`

**Interfaces:**
- Produces:
  - `zonedDateTime(dateKey: string, time: string): Date` (`'YYYY-MM-DD'`, `'HH:mm'`, UTC−3); lança para formato inválido.
  - `dateKeyOf(date: Date): string` e `timeOf(date: Date): string` (em UTC−3) — usados para preencher o formulário.
  - `rescheduleErrorMessage(status: number, body?: { error?: string }): string`
  - `RescheduleService.reschedule(sessionId: string, startsAt: Date, force?: boolean): Promise<RescheduleResult>`; `RescheduleResult = { kind: 'ok'; newSessionId: string; startsAt: Date } | { kind: 'conflict'; conflicts: { title: string; startsAt: Date; endsAt: Date }[] }`

- [ ] **Step 1: Testes que falham**
  - `zonedDateTime('2026-11-26','20:00').toISOString()` = `'2026-11-26T23:00:00.000Z'`; `('2026-12-31','22:30')` = `'2027-01-01T01:30:00.000Z'`; `('26/11/2026','20:00')` lança; `dateKeyOf(new Date('2026-11-27T01:00:00Z'))` = `'2026-11-26'`; `timeOf` idem = `'22:00'`.
  - `rescheduleErrorMessage(422, { error: 'Vincule um paciente antes de reagendar.' })` devolve o texto do body; `(401)` e `(403)` = o mesmo texto de `syncErrorMessage(401)`/`(403)`; `(0)` = mensagem de sem conexão de `syncErrorMessage(0)`; `(500)` sem body = `'Falha ao reagendar. Tente novamente.'`.
- [ ] **Step 2:** rodar os 2 specs → FALHA.
- [ ] **Step 3: Implementar.** `RescheduleService` espelha `CalendarSyncService`: POST `${apiUrl}/admin/sessions/${id}/reschedule` com `{ startsAt: startsAt.toISOString(), force }`; `HttpErrorResponse` 409 com `error.conflicts` (array) → `{ kind:'conflict', ... }` com datas convertidas; outros → `throw new Error(rescheduleErrorMessage(err.status, err.error))`.
- [ ] **Step 4:** specs passam; `npx ng test --watch=false` verde.
- [ ] **Step 5:** `git commit -m "feat(admin): servico de reagendamento e conversao de data/hora"`

### Task 4: Extrair `SessionActionsComponent` (sem mudar comportamento)

**Files:**
- Create: `src/app/pages/admin/sessions/session-actions.component.ts` (+ `.spec.ts`)
- Modify: `sessions/sessions.component.ts`, `sessions/sessions.component.spec.ts`

**Interfaces:**
- Produces: `<app-session-actions [session]="s" [patients]="patients" (done)="..." (failed)="..." />`
  - `session = input.required<Session>()`, `patients = input.required<Patient[]>()`
  - `done = output<string | null>()` (mensagem de sucesso ou `null`), `failed = output<string>()`
  - Interno: botões Realizada/Faltou/Cancelada (chamam `SessionsService.setStatus`), bloco "Trocar paciente" (movido de `sessions.component.ts`: `changingId`/`changeSelection`/`changeOptions`/`saveChangePatient`, mesmos ids `change-patient-<id>` e textos).
  - Mantêm-se em `sessions.component.ts`: vínculo de sessão sem paciente, "Removida do Agenda" (Manter/Cancelar sessão/Remover), flash, `actionError` (alimentado por `failed`).

- [ ] **Step 1:** Mover para `session-actions.component.spec.ts` os testes de status e do `describe('Trocar paciente')` de `sessions.component.spec.ts`, adaptados para montar o componente filho com `fixture.componentRef.setInput('session', ...)` e `setInput('patients', ...)`; adicionar: `failed` emite a mensagem quando `setStatus` lança; botões de status desabilitados quando `session.status === 'rescheduled'`. Em `sessions.component.spec.ts`, manter um teste que confere que cada cartão renderiza `app-session-actions`.
- [ ] **Step 2:** rodar os 2 specs → FALHA (componente inexistente).
- [ ] **Step 3:** Criar o componente movendo o código; `sessions.component.ts` usa-o dentro do cartão.
- [ ] **Step 4:** `npx ng test --watch=false` verde (contagem total de testes ≥ a anterior).
- [ ] **Step 5:** `git commit -m "refactor(admin): extrai acoes da sessao para componente compartilhado"`

### Task 5: Reagendar na UI + selo/nota em Sessões

**Files:**
- Modify: `sessions/session-actions.component.ts` (+ spec), `sessions/sessions.component.ts` (+ spec)

**Interfaces:**
- Consumes: `canReschedule`, `rescheduleNote`, `formatShortDateTime` (Task 1); `RescheduleService`, `zonedDateTime`, `dateKeyOf`, `timeOf` (Task 3); `SessionActionsComponent` (Task 4); `currentMonth` (`domain/month.ts`).
- Produces: mensagem de sucesso exata `"Reagendada para {formatShortDateTime(novo)}."` + `" (em {nome do mês por extenso minúsculo})"` quando `currentMonth(novo) !== currentMonth(original)`.

- [ ] **Step 1: Testes que falham** (`session-actions.component.spec.ts`, `RescheduleService` falso):
  - botão **Reagendar** existe para scheduled/no_show/cancelled com paciente; ausente para done/rescheduled.
  - abrir → data padrão = original + 7 dias (`dateKeyOf`), hora = `timeOf(original)`; texto de apoio exato da spec §5.2.
  - Reagendar (fake `ok`) → chamou `reschedule(id, zonedDateTime(data, hora), false)`; emite `done` com `'Reagendada para qui, 03/dez, 19:00. (em dezembro)'` para original `2026-11-26T22:00Z` (exemplo: escolher data `2026-12-03`).
  - fake `conflict` com `[{ title:'Psicoterapia Bruno', startsAt 2026-12-03T22:00Z, endsAt 22:50Z }]` → texto `Já existe compromisso nesse horário:` e `• Psicoterapia Bruno — 03/dez, 19:00–19:50`; **Reagendar mesmo assim** → chamada com `force=true`; **Escolher outro horário** → alerta some, formulário continua.
  - erro lançado → `failed` emite a mensagem.
  - `sessions.component.spec.ts`: sessão `rescheduled` mostra selo `Reagendada` e o texto de `rescheduleNote`; sessão nova mostra `Reagendada de ...`; `done` do filho aparece num `z-alert` de status.
- [ ] **Step 2:** rodar os specs → FALHA.
- [ ] **Step 3: Implementar** formulário inline (`z-date-picker` como em `pagamentos/payment-form.component.ts` linhas 121–130; `<input z-input type="time">`), alerta âmbar de conflito, selo `bg-slate-100 text-slate-700` e faixa lateral `[data-status='rescheduled']::before { background-color: #64748b; }`. Nomes de mês por extenso: constante local `['janeiro', …, 'dezembro']`.
- [ ] **Step 4:** `npx ng test --watch=false` verde; `npx ng build` sem erro novo.
- [ ] **Step 5:** `git commit -m "feat(admin): reagendar sessao com aviso de conflito"`

### Task 6: Tela Agenda + rota/menu + deep link para Sessões

**Files:**
- Create: `src/app/pages/admin/domain/agenda.ts` (+ spec), `src/app/pages/admin/agenda/agenda.component.ts` (+ spec)
- Modify: `admin.routes.ts` (rota `agenda`, `redirectTo: 'agenda'`), `admin-shell.component.ts` (item `{ path: '/admin/agenda', label: 'Agenda' }` primeiro na lista da linha ~102), `sessions/sessions.component.ts` (+ spec: ler query params `mes` e `aba`)

**Interfaces:**
- Consumes: `SessionsService.watchAll()`, `PatientsService.patients`, `CalendarSyncService.sync`, `syncSummary`, `SessionActionsComponent`, `rescheduleNote`, `statusLabel`.
- Produces:
  - `weekWindow(date: Date): { start: Date; end: Date }` — segunda 00:00 UTC−3 até a segunda seguinte.
  - `shiftWeek(start: Date, delta: number): Date`
  - `monthsInWindow(window): string[]` (`YYYY-MM`, 1 ou 2 itens)
  - `weekLabel(window): string` → `'23 – 29 nov 2026'`; cruzando mês `'30 nov – 6 dez 2026'`; cruzando ano `'28 dez 2026 – 3 jan 2027'`
  - `groupByDay(sessions: Session[], window, now: Date): AgendaDay[]`, `AgendaDay = { dayKey: string; label: string; isToday: boolean; sessions: Session[] }`; `label` = `'Hoje · seg, 23/nov'` ou `'ter, 24/nov'`.
  - Sessões: `?mes=YYYY-MM&aba=nao-identificados` define mês e aba ativa (aba: `todas` | `pendentes` | `nao-identificados`).

- [ ] **Step 1: Testes que falham**
  - `agenda.spec.ts`: `weekWindow(new Date('2026-11-25T15:00:00Z'))` → start `2026-11-23T03:00:00.000Z`, end `2026-11-30T03:00:00.000Z`; domingo `2026-11-30T02:00:00Z` (= dom 29 23:00 BRT) → mesma semana; `weekWindow(new Date('2027-01-01T12:00:00Z'))` start `2026-12-28T03:00:00.000Z`; `monthsInWindow` dessa = `['2026-12','2027-01']`; `weekLabel` nos 3 formatos; `groupByDay` ordena por hora, omite dias vazios, marca `isToday`, ignora sessões fora da janela.
  - `agenda.component.spec.ts` (fakes como em `sessions.component.spec.ts`): mostra dias da semana atual; **Semana ›** mostra a semana seguinte; **Hoje** volta; clicar numa linha com paciente renderiza `app-session-actions` só nela (clicar em outra fecha a primeira); linha sem paciente mostra `Paciente não identificado` e link `Resolver em Sessões` com `href` contendo `/admin/sessoes?mes=2026-11&aba=nao-identificados`; semana vazia → `Nenhuma sessão nesta semana.`; **Sincronizar agenda** numa semana que cruza meses chama `sync` para os 2 meses e mostra `syncSummary` (somar os resultados).
  - `sessions.component.spec.ts`: com `ActivatedRoute` de query `{ mes: '2026-10', aba: 'nao-identificados' }` → `month() === '2026-10'` e `activeTab() === 'unidentified'`.
- [ ] **Step 2:** rodar os specs → FALHA.
- [ ] **Step 3: Implementar** domínio, componente (cabeçalho + botões, lista conforme mockup C em `.superpowers/brainstorm/505-1795466315/content/agenda-layout.html`, skeleton ao carregar), rota/redirect/menu e leitura de query params em Sessões (o `z-tab-group` precisa abrir na aba certa: usar o input de índice selecionado do ZardUI tabs, se existir; senão, registrar a limitação no relatório).
- [ ] **Step 4:** `npx ng test --watch=false` verde; `cd server; npm test` verde; `npx ng build` sem erro novo.
- [ ] **Step 5:** `git commit -m "feat(admin): tela Agenda semanal com acoes rapidas"`
