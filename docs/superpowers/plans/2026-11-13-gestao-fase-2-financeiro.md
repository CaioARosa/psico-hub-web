# Gestão do Consultório — Fase 2 (Financeiro) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que a Lays registre Pix e veja, por mês e por paciente, o recebido, o a receber e o em atraso, com valores congelados por sessão e abatimento automático de atrasos por crédito.

**Architecture:** Os valores do acordo (valor por sessão, valor do pacote, "cobrar faltas") passam a ser gravados na própria sessão; o cálculo financeiro é feito no frontend por funções puras sobre todas as sessões, pacientes e pagamentos (listeners em tempo real). O backend só ganha o campo novo `packageAmountApplied` na sincronização. Duas telas novas: *Pagamentos* e *Financeiro*.

**Tech Stack:** Angular 21 (standalone, signals), Tailwind v4, Zard UI, Vitest (`ng test`), SDK `firebase` (Firestore), Express, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-13-gestao-fase-2-financeiro-design.md` (complementa `2026-11-12-gestao-consultorio-design.md`).

## Pré-requisitos

- Árvore de trabalho limpa na `main` (trabalho direto na `main` já autorizado pelo usuário).
- A Fase 1 está concluída e publicada (`c3bd1f6`). O cálculo e as telas novas não dependem de deploy, mas **a gravação de `packageAmountApplied` pelo backend só vale em produção depois que o usuário fizer o deploy do Cloud Run** (fora do escopo dos agentes).

## Global Constraints

- Valores monetários em **centavos inteiros**, moeda BRL; nenhuma divisão no cálculo financeiro (spec §7).
- Mês = `YYYY-MM` em **UTC-3 fixo** (`currentMonth` e `monthWindow` de `domain/month.ts`); datas do Pix como texto `YYYY-MM-DD` (spec §2).
- Meses passados nunca mudam: `done`, `no_show` e `cancelled` jamais são regravadas por reajuste de acordo; só `scheduled` (spec §1, "Reajuste do acordo").
- `payments`: `patientId`, `amount` (inteiro > 0), `paidAt`, `referenceMonth`, `note` (spec §2). Nenhuma regra nova no Firestore.
- Toda escrita no Firestore passa por `runWrite` (`data/safe-write.ts`: timeout de 10 s, mensagem em português, nova tentativa possível); id de documento novo gerado uma vez por formulário (`newId()`).
- Frontend: componentes standalone com `ChangeDetectionStrategy.OnPush` e signals, `inject()`, rotas com `loadComponent`, alias `@/*` → `src/app/*`, estilo Tailwind/Zard como `patients.component.ts`; textos de interface em português do Brasil.
- Backend: CommonJS, sem dependências novas.
- Commits em inglês, estilo convencional (`feat(admin): ...`).
- Comando de um spec isolado: `npx ng test --watch=false --include "<caminho do spec>"`; suíte completa: `npx ng test --watch=false`; backend: `cd server; node --test`.

## Review Focus

Entradas que o spec implica, mas nenhuma task testaria por conta própria (cada uma tem seu teste na task indicada):

1. **Mês só com sessões canceladas** não gera cobrança de pacote nem de sessão (Task 3).
2. **Sessão às 23:30 do último dia do mês (UTC-3)**, por exemplo `2026-12-01T02:30:00Z`, pertence ao mês anterior (Task 3).
3. **Pix com data impossível** (`2026-02-31`) ou **valor zero** é rejeitado com mensagem clara, nunca gravado (Task 4).
4. **Pix de paciente inativo ou inexistente** continua visível e editável no histórico, com o nome ou "Paciente removido" (Task 4).
5. **Salvar o paciente duas vezes** (ou depois de falha) reprecifica as sessões `scheduled` de forma idempotente e **nunca toca** sessões confirmadas (Task 2).

---

## File Structure

**Backend (`server/lib/`)**
- `patient-matching.js` — ganha `packageAmountForNewSession` (edição)
- `calendar-sync.js` — grava `packageAmountApplied` (edição)

**Frontend (`src/app/pages/admin/`)**
- `domain/models.ts` — `Session` ganha 2 campos; novo `Payment` (edição)
- `domain/money.ts` — `packageAmountForNewSession`, `pricingForAgreement`, `centsToInput` (edição)
- `domain/session-doc.ts` — mapeia os campos novos (edição)
- `domain/session-update.ts` — `sessionStatusUpdate` (novo)
- `domain/reprice.ts` — `planReprice` (novo)
- `domain/finance.ts` — cálculo financeiro (novo)
- `domain/payment-doc.ts`, `domain/payment-form.ts`, `domain/pix-prefill.ts`, `domain/payments-view.ts` (novos)
- `data/reprice.service.ts` (novo); `data/patients.service.ts`, `data/sessions.service.ts` (edição)
- `data/payments.service.ts` (novo)
- `pagamentos/payments.component.ts`, `pagamentos/payment-form.component.ts` (novos)
- `financeiro/finance.component.ts` (novo)
- `admin.routes.ts`, `admin-shell.component.ts` (edição)
- `*.spec.ts` ao lado de cada módulo novo

---

### Task 1: Valor do pacote na sessão (backend)

**Files:**
- Modify: `server/lib/patient-matching.js`, `server/lib/calendar-sync.js`
- Test: `server/lib/patient-matching.test.js`, `server/lib/calendar-sync.test.js`

**Interfaces:**
- Produces: `packageAmountForNewSession(agreement: { type, amount } | null): number` — `monthly_package` → `agreement.amount`; `per_session` ou `null` → `0`. Exportada junto das demais.
- `planSessionSync`: o `data` de **criação** passa a incluir `packageAmountApplied`; o `data` de **atualização** inclui `packageAmountApplied` apenas quando a sessão estava sem paciente e agora casou (mesmo ponto onde já grava `patientId` e `amountApplied`).

- [ ] **Step 1: Escrever os testes (falham).** Em `patient-matching.test.js`: `packageAmountForNewSession: monthly_package devolve o valor do pacote` (`{type:'monthly_package', amount:60000}` → `60000`), `per_session devolve 0`, `sem acordo devolve 0`. Em `calendar-sync.test.js`: `cria sessão de pacote com packageAmountApplied do acordo` (`amountApplied` `0`, `packageAmountApplied` `60000`), `cria sessão por sessão com packageAmountApplied 0` (com `amountApplied` `15000`), `evento sem paciente cria sessão com packageAmountApplied 0`, `sessão scheduled sem paciente que passa a casar recebe packageAmountApplied`, `sessão scheduled que já tem paciente não recebe packageAmountApplied na atualização` (o `data` não tem a chave).
- [ ] **Step 2: Ver falhar.** `cd server; node --test lib/patient-matching.test.js lib/calendar-sync.test.js` → FAIL.
- [ ] **Step 3: Implementar** `packageAmountForNewSession` em `patient-matching.js` e usar nos dois pontos de `planSessionSync` (criação e vínculo). Ajustar os testes existentes que comparam o `data` de criação por igualdade exata para incluir o campo novo.
- [ ] **Step 4: Ver passar.** `cd server; node --test` → todos PASS.
- [ ] **Step 5: Commit.** `git add server/lib && git commit -m "feat(server): freeze package amount on sessions"`

---

### Task 2: Valores congelados e reajuste no frontend

**Files:**
- Modify: `domain/models.ts`, `domain/money.ts`, `domain/session-doc.ts`, `domain/patient-form.ts` (usar `centsToInput`), `data/patients.service.ts`, `data/sessions.service.ts`, e as fixtures de `Session` em `domain/session-doc.spec.ts`, `domain/sessions-view.spec.ts`, `sessions/sessions.component.spec.ts`
- Create: `domain/session-update.ts`, `domain/reprice.ts`, `data/reprice.service.ts`
- Test: `domain/money.spec.ts`, `domain/session-doc.spec.ts`, `domain/session-update.spec.ts`, `domain/reprice.spec.ts`

**Interfaces:**
- `Session` ganha `packageAmountApplied: number | null` e `chargeNoShowApplied: boolean | null` (`null` = sessão antiga, sem o campo).
- `money.ts`: `packageAmountForNewSession(agreement: Agreement | null): number` (mesma regra do backend); `pricingForAgreement(agreement: Agreement | null): { amountApplied: number; packageAmountApplied: number }`; `centsToInput(cents: number): string` (`15050` → `'150,50'`).
- `session-update.ts`: `sessionStatusUpdate(status: Exclude<SessionStatus, 'scheduled'>, patient: Patient): Record<string, unknown>` — `{ status }`, e, quando `status === 'no_show'`, também `chargeNoShowApplied: patient.agreement.chargeNoShow`.
- `reprice.ts`: `planReprice(sessions: Session[], agreement: Agreement): Array<{ id: string; amountApplied: number; packageAmountApplied: number }>` — uma entrada por sessão `scheduled`, com os valores de `pricingForAgreement(agreement)`; demais status são ignorados.
- `RepriceService.repriceScheduled(patientId: string, agreement: Agreement): Promise<void>` — consulta `sessions` com `patientId == id` e `status == 'scheduled'` (dois filtros de igualdade), aplica `planReprice` em `writeBatch` de até 400 e rejeita com `'Paciente salvo, mas não foi possível atualizar as sessões agendadas. Salve novamente.'` em qualquer falha (leitura e escrita com timeout de 10 s via `withTimeout`).
- `PatientsService.update(id, input)`: grava o paciente (como hoje) e, em seguida, chama `repriceScheduled(id, input.agreement)`; a mensagem de erro do reajuste sobe para o formulário, que já a exibe e permanece aberto.
- `SessionsService.linkPatient(id, patient)`: grava `patientId` e `...pricingForAgreement(patient.agreement)`. `SessionsService.setStatus(id, status)`: mantém a assinatura, procura o paciente em `PatientsService.patients()` e grava `sessionStatusUpdate(status, patient)`; rejeita com `'Paciente não encontrado. Atualize a página e tente novamente.'` se o paciente não estiver na lista.

- [ ] **Step 1: Escrever os testes (falham).**
  - `money.spec.ts`: `pricingForAgreement` (`per_session`/15000 → `{15000, 0}`; `monthly_package`/60000 → `{0, 60000}`; `null` → `{0, 0}`), `packageAmountForNewSession`, `centsToInput` (`15050` → `'150,50'`, `60005` → `'600,05'`, `0` → `'0,00'`).
  - `session-doc.spec.ts`: campos ausentes → `packageAmountApplied: null` e `chargeNoShowApplied: null`; campos presentes são lidos (`60000`, `true`).
  - `session-update.spec.ts`: `no_show` com `chargeNoShow: true` → `{ status: 'no_show', chargeNoShowApplied: true }`; com `false` → `chargeNoShowApplied: false`; `done` e `cancelled` → só `{ status }` (sem a chave `chargeNoShowApplied`).
  - `reprice.spec.ts`: só `scheduled` entra (uma `done`, uma `no_show` e uma `cancelled` ficam de fora); `per_session` → `{amountApplied: 18000, packageAmountApplied: 0}`; `monthly_package` → `{0, 60000}`; trocar de `per_session` para pacote zera `amountApplied`; lista vazia → `[]`; chamar duas vezes com a mesma entrada dá o mesmo resultado (idempotente). (Review Focus 5.)
- [ ] **Step 2: Ver falhar.** `npx ng test --watch=false --include "src/app/pages/admin/domain/money.spec.ts"` e os demais specs acima → FAIL.
- [ ] **Step 3: Implementar** as funções puras (`money.ts`, `session-doc.ts`, `session-update.ts`, `reprice.ts`), ajustar `models.ts` e as três fixtures de `Session` (`null` nos campos novos), e trocar a conversão inline em `patient-form.ts` por `centsToInput`.
- [ ] **Step 4: Ver passar** os specs e rodar a suíte completa (`npx ng test --watch=false`) sem regressões.
- [ ] **Step 5: Implementar a ligação ao Firestore** (`RepriceService`, `PatientsService.update`, `SessionsService.linkPatient` e `setStatus`). Sem emulador, a verificação é `npm run build` limpo; dizer no relatório que o Firestore não foi exercitado.
- [ ] **Step 6: Commit.** `git add src/app/pages/admin && git commit -m "feat(admin): freeze session pricing and reprice scheduled sessions"`

---

### Task 3: Cálculo financeiro (funções puras)

**Files:**
- Modify: `domain/models.ts` (adicionar `Payment`)
- Create: `domain/finance.ts`
- Test: `domain/finance.spec.ts`

**Interfaces:**
- Consumes: `Patient`, `Session`, `currentMonth(date)` de `domain/month.ts`.
- `models.ts`: `interface Payment { id: string; patientId: string; amount: number; paidAt: string; referenceMonth: string; note: string }`.
- `finance.ts` exporta:
  - `interface MonthAllocation { month: string; due: number; received: number; abated: number; toReceive: number; credit: number; sources: Array<{ fromMonth: string; amount: number }> }`
  - `dueByMonth(patient: Patient, sessions: Session[]): Map<string, number>` — regras da spec §3 (sessões de outros pacientes e sem paciente são ignoradas; mês pela data em UTC-3).
  - `allocateCredits(due: Map<string, number>, received: Map<string, number>): MonthAllocation[]` — ordenado por mês crescente; percorre do mais antigo ao mais novo com fila de déficits, como na spec §3.
  - `interface PatientMonthLine { patientId: string; month: string; due: number; received: number; abated: number; toReceive: number; overdue: number; credit: number; sources: MonthAllocation['sources'] }`
  - `interface MonthSummary { month: string; received: number; toReceive: number; overdue: number; hasSessions: boolean; lines: PatientMonthLine[] }`
  - `type Ledger` (tipo exportado, opaco para quem consome: guarda as alocações por paciente, os meses com sessões e os nomes dos pacientes)
  - `buildLedger(input: { patients: Patient[]; sessions: Session[]; payments: Payment[] }): Ledger` e `summarizeMonth(ledger: Ledger, month: string): MonthSummary` — `lines` só com pacientes que têm movimento no mês (devido, recebido, a receber, em atraso ou crédito maiores que zero), ordenadas pelo nome do paciente; `overdue` de cada linha é a soma de `toReceive` dos meses anteriores; os totais do resumo são a soma das linhas; `hasSessions` é verdadeiro se **qualquer** sessão (de qualquer paciente, inclusive sem paciente) cai no mês.

- [ ] **Step 1: Escrever os testes (falham).** Em `finance.spec.ts`, com helpers que montam paciente e sessão:
  - **Devido por sessão:** só `done` conta (`2 × 15000` → `30000`); `no_show` conta com `chargeNoShowApplied: true` e não conta com `false`; `no_show` sem o campo (`null`) segue o `chargeNoShow` atual do paciente; trocar o `chargeNoShow` do paciente não muda um `no_show` que tem `chargeNoShowApplied`; `cancelled` e `scheduled` nunca contam.
  - **Devido de pacote:** vale o `packageAmountApplied` da primeira sessão do mês, por data, que não seja `cancelled` (primeira cancelada e segunda `scheduled` com `60000` → `60000`); mês só com sessões `cancelled` → sem devido (Review Focus 1); o valor de novembro não muda quando dezembro tem `packageAmountApplied: 70000`; sessão com `packageAmountApplied: null` usa `agreement.amount` se o acordo atual é pacote e `0` se é por sessão; duas sessões no mês contam o pacote uma vez só.
  - **Mês pela data (UTC-3):** sessão `done` em `2026-12-01T02:30:00Z` entra em `2026-11`; em `2026-12-01T03:00:00Z`, em `2026-12` (Review Focus 2).
  - **Abatimento:** (a) outubro devido `30000`, recebido `10000`; novembro devido `15000`, recebido `35000` → outubro `abated 20000`, `toReceive 0`, `sources [{fromMonth:'2026-11', amount:20000}]`, novembro `credit 0`; (b) Pix adiantado de dezembro (`15000`, sem devido) abate parte do déficit de outubro (`20000`) → outubro `toReceive 5000`, dezembro `credit 0`; (c) sobra vira crédito (`Pix 50000` contra déficit `20000` → `credit 30000`); (d) vários déficits são abatidos do mais antigo ao mais novo; (e) crédito de mês antigo não abate déficit de mês posterior (setembro com crédito `10000`, outubro com déficit `20000` → outubro `toReceive 20000`); (f) `toReceive` nunca negativo.
  - **Pacientes isolados:** o Pix de A não abate déficit de B.
  - **Resumo:** `summarizeMonth` tem `received`, `toReceive` e `overdue` iguais à soma das linhas; `overdue(M)` soma os `toReceive` de meses anteriores; paciente sem movimento no mês não aparece; paciente inativo com Pix aparece; `hasSessions` falso quando o mês não tem nenhuma sessão.
- [ ] **Step 2: Ver falhar.** `npx ng test --watch=false --include "src/app/pages/admin/domain/finance.spec.ts"` → FAIL.
- [ ] **Step 3: Implementar** as funções com as assinaturas acima, sem acesso ao Firestore. Usar inteiros em tudo.
- [ ] **Step 4: Ver passar** o spec e a suíte completa.
- [ ] **Step 5: Commit.** `git add src/app/pages/admin/domain && git commit -m "feat(admin): add finance calculation with credit allocation"`

---

### Task 4: Pagamentos (serviço e tela)

**Files:**
- Create: `domain/payment-doc.ts`, `domain/payment-form.ts`, `domain/payments-view.ts`, `domain/pix-prefill.ts`, `data/payments.service.ts`, `pagamentos/payments.component.ts`, `pagamentos/payment-form.component.ts` (em `src/app/pages/admin/`)
- Modify: `admin.routes.ts` (rota `pagamentos`), `admin-shell.component.ts` (link *Pagamentos*)
- Test: `domain/payment-doc.spec.ts`, `domain/payment-form.spec.ts`, `domain/payments-view.spec.ts`, `domain/pix-prefill.spec.ts`

**Interfaces:**
- Consumes: `Payment`, `Patient`, `parseBRLToCents`, `centsToInput`, `isValidMonth`, `currentMonth`, `matchesSearch`/`normalizeSearch` (`domain/text.ts`), `runWrite`, `FIRESTORE`, `PatientsService.patients`.
- `payment-doc.ts`: `paymentFromDoc(id: string, data: Record<string, any>): Payment` (tolera campos ausentes; `amount` numérico, `note` `''`); `paymentToDoc(input: PaymentInput): { patientId; amount; paidAt; referenceMonth; note }`.
- `payment-form.ts`: `type PaymentInput = Omit<Payment, 'id'>`; `interface PaymentFormValue { patientId: string; amount: string; paidAt: string; referenceMonth: string; note: string }`; `toPaymentInput(value): { ok: true; value: PaymentInput } | { ok: false; errors: Partial<Record<'patientId' | 'amount' | 'paidAt' | 'referenceMonth', string>> }`; `paymentToFormValue(payment: Payment): PaymentFormValue`; `isValidIsoDate(text: string): boolean` (data real no formato `YYYY-MM-DD`, ano bissexto incluído); `referenceMonthOf(paidAt: string): string` (`paidAt.slice(0, 7)` se a data é válida, senão `''`); `todayIso(now: Date): string` (data em UTC-3). Mensagens: `'Escolha o paciente.'`, `'Valor inválido. Use o formato 150,00.'`, `'O valor deve ser maior que zero.'`, `'Informe a data do Pix.'`, `'Informe o mês de referência.'`; `note` com `trim`.
- `payments-view.ts`: `filterPayments(payments: Payment[], filters: { month: string; patientId: string }): Payment[]` — `''` em um filtro significa "todos"; ordem preservada.
- `pix-prefill.ts`: `interface PixPrefill { patientId: string; referenceMonth: string; amount: string }`; `parsePixPrefill(params: { get(name: string): string | null }): PixPrefill | null` — lê `paciente`, `mes` (válido por `isValidMonth`) e `valor` (centavos inteiros > 0, devolvido com `centsToInput`); qualquer item ausente ou inválido → `null`; `pixPrefillQuery(line: { patientId: string; month: string; toReceive: number }): Record<string, string>` — gera `{ paciente, mes, valor }`.
- `PaymentsService`: `payments: Signal<Payment[]>` (listener em `payments` ordenado por `paidAt` decrescente), `error: Signal<string | null>` (`'Não foi possível carregar os pagamentos.'`), `loaded: Signal<boolean>`, `newId(): string`, `create(id: string, input: PaymentInput): Promise<void>` (`setDoc`), `update(id: string, input: PaymentInput): Promise<void>` (`updateDoc`), `remove(id: string): Promise<void>` (`deleteDoc`), todas via `runWrite`.
- Rota `/admin/pagamentos`; link *Pagamentos* no shell. Tela: formulário (paciente — todos, inclusive inativos; valor; data do Pix com padrão `todayIso`; mês de referência com padrão `referenceMonthOf(paidAt)` enquanto a usuária não o alterar; observação) e histórico em tempo real com filtros de mês e de paciente, *Editar* e *Excluir* (confirmação na própria linha, como em `patients.component.ts`); linha de paciente inexistente mostra "Paciente removido". Lê `parsePixPrefill` dos query params ao abrir e, se houver, abre o formulário já preenchido. Cancelar permanece habilitado durante o salvamento; o id do Pix novo é gerado uma vez por formulário.

- [ ] **Step 1: Escrever os testes (falham).**
  - `payment-form.spec.ts`: `aceita um Pix válido e converte o valor para centavos` (`'150,50'` → `15050`); `rejeita valor zero` (mensagem de maior que zero); `rejeita valor fora do formato`; `rejeita data impossível` (`'2026-02-31'`, `'2026-13-01'`) e `aceita '2024-02-29'` e `'2026-02-28'` (Review Focus 3); `rejeita mês de referência fora de YYYY-MM`; `exige paciente`; `acumula vários erros`; `paymentToFormValue` devolve o valor como `'150,50'`; `referenceMonthOf('2026-11-27')` → `'2026-11'` e `referenceMonthOf('2026-02-31')` → `''`; `todayIso` de `2026-12-01T02:30:00Z` → `'2026-11-30'`.
  - `payment-doc.spec.ts`: ida e volta com valores reais; campos ausentes viram `amount 0` e `note ''`.
  - `payments-view.spec.ts`: filtro por mês, por paciente, pelos dois, e sem filtro devolve tudo.
  - `pix-prefill.spec.ts`: `parsePixPrefill` com `paciente=p1&mes=2026-11&valor=15000` → `{patientId:'p1', referenceMonth:'2026-11', amount:'150,00'}`; `valor=0`, `valor=abc`, `mes=2026-13` e parâmetro ausente → `null`; `pixPrefillQuery` e `parsePixPrefill` são inversas (ida e volta).
- [ ] **Step 2: Ver falhar** cada spec com o comando de spec isolado.
- [ ] **Step 3: Implementar** as funções puras; ver os specs passarem.
- [ ] **Step 4: Implementar `PaymentsService` e as duas telas**, a rota e o link do menu. Pix de paciente inativo ou removido continua listado e editável (Review Focus 4). Verificar com `npm run build` limpo e, se houver ferramenta de navegador, que `/admin/pagamentos` redireciona ao login quando deslogado; dizer no relatório o que não pôde ser verificado sem uma sessão autenticada.
- [ ] **Step 5: Rodar a suíte completa** e o build.
- [ ] **Step 6: Commit.** `git add src/app/pages/admin && git commit -m "feat(admin): add payments registration"`

---

### Task 5: Financeiro (resumo do mês)

**Files:**
- Create: `financeiro/finance.component.ts`, `financeiro/finance.component.spec.ts` (em `src/app/pages/admin/`)
- Modify: `data/sessions.service.ts` (`watchAll`), `admin.routes.ts` (rota `financeiro`), `admin-shell.component.ts` (link *Financeiro*), `README.md`

**Interfaces:**
- Consumes: `buildLedger`, `summarizeMonth` (Task 3); `PaymentsService.payments`, `PatientsService.patients`; `pixPrefillQuery` (Task 4); `currentMonth`, `formatCents`.
- `SessionsService.watchAll(): { sessions: Signal<Session[]>; loaded: Signal<boolean>; error: Signal<string | null> }` — listener em **toda** a coleção `sessions`, ordenado por `startsAt`, criado na primeira chamada e reaproveitado nas seguintes; erro `'Não foi possível carregar as sessões.'`.
- Rota `/admin/financeiro`; link *Financeiro* no shell. Tela: seletor de mês (padrão `currentMonth(new Date())`), três cartões (*Recebido*, *A receber*, *Em atraso*) e tabela por paciente com as colunas devido, recebido, abatido, a receber, em atraso e crédito, mais linha de total; linha expansível com as origens do abatimento (`"R$ 100,00 abatidos com o crédito de 2026-11"`); botão *Registrar Pix* (link para `/admin/pagamentos` com `pixPrefillQuery`) nas linhas com `toReceive > 0`; aviso `"Sincronize a agenda deste mês para ver o devido."` quando `hasSessions` é falso; estados de carregando, erro e vazio em português.

- [ ] **Step 1: Escrever o teste do componente (falha).** `finance.component.spec.ts`, com `SessionsService`, `PatientsService` e `PaymentsService` falsos (como em `sessions.component.spec.ts`): `mostra os cartões e a tabela do mês` (valores exatos formatados com `formatCents`); `o total da tabela bate com os cartões`; `mostra o aviso quando o mês não tem sessões`; `o botão Registrar Pix leva paciente, mês e valor a receber` (o `href`/`queryParams` contém `paciente`, `mes` e `valor` esperados); `trocar o mês recalcula a tabela`; `a explicação do abatimento cita o mês de origem`.
- [ ] **Step 2: Ver falhar.** `npx ng test --watch=false --include "src/app/pages/admin/financeiro/finance.component.spec.ts"` → FAIL.
- [ ] **Step 3: Implementar `watchAll`, o componente, a rota e o link do menu.** O cálculo vem de `computed` sobre os signals dos três serviços (nenhuma lógica financeira dentro do componente).
- [ ] **Step 4: Ver passar** o spec, a suíte completa e `npm run build`.
- [ ] **Step 5: Atualizar o `README.md`:** na seção "Área de Gestão (`/admin`)", descrever as telas *Pagamentos* e *Financeiro*, a regra do abatimento por crédito, os valores congelados por sessão, o reajuste das sessões agendadas ao salvar o paciente, as limitações da spec §8 e a necessidade de redeploy do backend (`npm run deploy:backend`) para gravar `packageAmountApplied` em produção; incluir as novas rotas na tabela de rotas.
- [ ] **Step 6: Commit.** `git add src/app/pages/admin README.md && git commit -m "feat(admin): add monthly finance summary"`
