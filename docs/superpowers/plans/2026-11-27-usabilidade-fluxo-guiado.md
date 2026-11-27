# Usabilidade e Fluxo Guiado no `/admin` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar o `/admin` em 4 abas orientadas à rotina (`Início`, `Atendimentos`, `Financeiro`, `Pacientes`), com mês único compartilhado, sincronização automática invisível com toast de erro, tutorial de boas-vindas guiado e Financeiro legível no iPad.

**Architecture:** Um núcleo compartilhado (`AdminMonthService`, `AutoSyncService` 3 meses, `OnboardingService`, `domain/workflow.ts`) alimenta o shell de 4 abas e as telas compostas (`HomeComponent`, `AtendimentosComponent`, `FinanceHubComponent`), mantendo 100% intactos os cálculos de domínio (`buildLedger`, `summarizeMonth`, `buildDashboard`, `buildChargeQueue`, `groupSessions`) e os serviços de Firestore/backend. Rotas legadas permanecem válidas por `RedirectFunction` preservando query params.

**Tech Stack:** Angular 22 (standalone, Signals, OnPush), Tailwind CSS v4, Zard UI, Lucide (`@ng-icons/lucide`), Vitest 4 (`npx ng test --watch=false`).

**Spec:** `docs/superpowers/specs/2026-11-27-usabilidade-fluxo-guiado-design.md`

## Global Constraints

- Dispositivo-alvo: **iPad com teclado** (`768 px` retrato/Split View até `1024 px` paisagem); zero rolagem horizontal na navegação superior e no extrato do Financeiro.
- Interação híbrida toque + teclado: nenhuma ação principal depende de `:hover`; alvos principais com altura mínima de `44 px` (`h-11` ou `min-h-11`).
- Identidade visual preservada: paleta creme (`#FDFBF7`), verde-sálvia (`#4D6D66`), `#D4E6E1`, componentes Zard UI existentes; sem rebrand.
- Zero alterações em `server/`, `firestore.rules`, schema do Firestore ou páginas públicas (`/`, `/links`, `/story`).
- Todas as regras de cálculo financeiro e de sessões existentes (`finance.ts`, `dashboard.ts`, `charge-queue.ts`, `sessions-view.ts`) continuam sendo a única fonte de verdade.
- Falha na sincronização automática ou disparada pelo topo exibe **toast (toastr)** flutuante (`role="alert"`) com botão `Tentar novamente` e fechar (`×`), sem bloquear a tela.
- O tutorial de boas-vindas (`OnboardingModalComponent`) ensina explicitamente que a agenda sincroniza automaticamente (mês anterior + atual + próximo na entrada e ao trocar de mês), pode ser pulado (`Pular e explorar` / `Esc`) e reaberto em `? Como funciona`.

## Review Focus

1. **Toast de erro após retry ou novo erro:** fechar o toast e disparar um novo erro deve exibi-lo novamente; um retry bem-sucedido deve fechar o toast e nunca deixar a tela travada. *(Testado na Task 3 e Task 5)*
2. **`localStorage` indisponível (Safari/iPad modo privado):** `OnboardingService` não pode lançar exceção se `getItem`/`setItem` falharem; ainda abre e fecha manualmente via `? Como funciona`. *(Testado na Task 3)*
3. **Parâmetro `?mes=` inválido ou mês repetido:** `AdminMonthService.setMonth` ignora valores inválidos e não dispara `AutoSyncService.run` quando o mês não muda. *(Testado na Task 1)*
4. **Paciente em atraso com telefone inválido ou mês sem sessões vinculadas:** `FinanceHubComponent` nunca renderiza link `wa.me` quebrado, exibe atalho para corrigir em `Pacientes` e classifica `!hasLinkedSessions` como `Aguardando sessões` (nunca `Pago`). *(Testado na Task 2 e Task 8)*
5. **Pendências esquecidas do mês anterior:** quando o mês atual está limpo mas o mês anterior tem sessões sem paciente ou sem confirmação, `buildWorkflowState` soma no badge de `Atendimentos` e `AtendimentosComponent` exibe o bloco `"Restantes de <mês anterior>"` na aba `Pendências`. *(Testado na Task 2 e Task 7)*

---

## File Structure

### Criar
- `src/app/pages/admin/data/admin-month.service.ts` (+ `.spec.ts`) — Mês ativo único compartilhado + trigger de auto-sync ao trocar de mês.
- `src/app/pages/admin/data/onboarding.service.ts` (+ `.spec.ts`) — Estado de exibição/conclusão do tutorial guiado por `uid` com fallback seguro para `localStorage`.
- `src/app/pages/admin/domain/workflow.ts` (+ `.spec.ts`) — Funções puras `buildWorkflowState` (Trilha de Sucesso + badges) e `buildFinanceRows` (tradução humana + ordenação do Financeiro).
- `src/app/pages/admin/sync-error-toast.component.ts` (+ `.spec.ts`) — Toast (toastr) flutuante para falhas de sincronização com `Tentar novamente` e fechar.
- `src/app/pages/admin/onboarding/onboarding-modal.component.ts` (+ `.spec.ts`) — Boas-vindas + tutorial de configuração guiado em 4 passos com estado real e sync inline.
- `src/app/pages/admin/inicio/home.component.ts` (+ `.spec.ts`) — Nova tela inicial (`Início`): Trilha de Sucesso viva, 4 cards essenciais, gráfico e alertas.
- `src/app/pages/admin/atendimentos/atendimentos.component.ts` (+ `.spec.ts`) — Unificação de `Agenda` + `Sessões` em 3 sub-abas (`Semana | Pendências | Mês`) com ações explícitas e vínculo inline.
- `src/app/pages/admin/financeiro/finance-hub.component.ts` (+ `.spec.ts`) — Unificação de `Financeiro` + `Cobrança` + `Pagamentos` em 3 sub-abas (`Resumo | Cobrar | Pix recebidos`) com cartões para iPad e `Ver cálculo ▾`.

### Modificar
- `src/app/pages/admin/data/auto-sync.service.ts` (+ `.spec.ts`) — `runOnEntry` sincroniza 3 meses (anterior, atual e próximo) + `clearError()` e sinal `errorSequence` para re-disparar toast.
- `src/app/pages/admin/admin-shell.component.ts` (+ novo `.spec.ts`) — 4 abas com badges, barra de mês único (oculta em `Pacientes`), status discreto da agenda + `↻`, `? Como funciona`, `OnboardingModalComponent` e `SyncErrorToastComponent`.
- `src/app/pages/admin/admin.routes.ts` (+ novo `.spec.ts`) — Novas rotas (`inicio`, `atendimentos`, `financeiro`, `pacientes`) + redirects compatíveis das rotas legadas.
- `src/app/pages/admin/cobranca/cobranca.component.ts` (+ `.spec.ts`) — Aceita `embedded` input opcional para funcionar dentro de `FinanceHubComponent` compartilhando `AdminMonthService`.
- `src/app/pages/admin/pagamentos/payments.component.ts` (+ `.spec.ts`) — Aceita `embedded` input opcional para funcionar dentro de `FinanceHubComponent` filtrando pelo mês ativo com toggle `Ver todos os meses`.
- `src/app/pages/admin/patients/patients.component.ts` & `patient-form.component.ts` (+ `.spec.ts`) — Suporte a `?novo=1`, dica de nome igual ao Google Agenda e empty state guiado.

---

### Task 1: `AutoSyncService` (3 meses) e `AdminMonthService` (mês único)

**Files:**
- Modify: `src/app/pages/admin/data/auto-sync.service.ts`
- Modify: `src/app/pages/admin/data/auto-sync.service.spec.ts`
- Create: `src/app/pages/admin/data/admin-month.service.ts`
- Create: `src/app/pages/admin/data/admin-month.service.spec.ts`

**Interfaces:**
- Consumes: `currentMonth`, `shiftMonth`, `isValidMonth` from `../domain/month`; `AutoSyncService` from `./auto-sync.service`.
- Produces:
  - `AutoSyncService.runOnEntry(now?: Date): Promise<AutoSyncOutcome>` (sincroniza `[shiftMonth(m, -1), m, shiftMonth(m, 1)]`)
  - `AutoSyncService.errorNonce: Signal<number>` (incrementa a cada falha para reabrir toast fechado)
  - `AutoSyncService.clearError(): void`
  - `AutoSyncService.reportError(message: string): void` (registra erro de sync manual disparado pelo topo no mesmo toast)
  - `AdminMonthService` (`providedIn: 'root'`): `month: Signal<string>`, `isCurrentMonth: Signal<boolean>`, `setMonth(value: string): void`, `shift(delta: number): void`, `resetToCurrent(): void`, `syncCurrentMonthForce(): Promise<AutoSyncOutcome>`

- [ ] **Step 1: Atualizar testes de `AutoSyncService` e criar `admin-month.service.spec.ts`**

Adicionar/ajustar em `auto-sync.service.spec.ts`:
```ts
it('runOnEntry sincroniza mês anterior, atual e próximo em uma única entrada', async () => {
  const auto = service();
  const outcome = await auto.runOnEntry(new Date('2026-11-15T12:00:00.000Z'));

  expect(outcome.synced).toEqual(['2026-10', '2026-11', '2026-12']);
  expect(sync).toHaveBeenCalledTimes(3);
});

it('errorNonce incrementa em cada falha automática e clearError limpa o erro', async () => {
  sync.mockRejectedValue(new Error('falhou'));
  const auto = service();

  await auto.run(['2026-11']);
  expect(auto.error()).toBe(AUTO_SYNC_ERROR);
  expect(auto.errorNonce()).toBe(1);

  auto.clearError();
  expect(auto.error()).toBeNull();

  await auto.run(['2026-10']);
  expect(auto.error()).toBe(AUTO_SYNC_ERROR);
  expect(auto.errorNonce()).toBe(2);
});
```

Criar `src/app/pages/admin/data/admin-month.service.spec.ts`:
```ts
it('inicia no mês atual e sinaliza isCurrentMonth true', ...);
it('setMonth atualiza o mês válido e chama autoSync.run([month])', ...);
it('setMonth ignora valor inválido e não chama autoSync.run quando mês é igual ao atual', ...);
it('shift(-1) e shift(1) avançam/recuam o mês e disparam autoSync.run', ...);
it('resetToCurrent volta ao mês corrente e dispara autoSync.run se diferente', ...);
it('syncCurrentMonthForce chama autoSync.run([month], { force: true })', ...);
```

- [ ] **Step 2: Rodar testes para verificar falha**

Run: `npx ng test --watch=false --include src/app/pages/admin/data/auto-sync.service.spec.ts --include src/app/pages/admin/data/admin-month.service.spec.ts`
Expected: FAIL (teste de 3 meses falha e `admin-month.service.ts` não existe).

- [ ] **Step 3: Atualizar `AutoSyncService` e implementar `AdminMonthService`**

- Em `src/app/pages/admin/data/auto-sync.service.ts`:
  - Em `runOnEntry(now = new Date())`: passar `[shiftMonth(month, -1), month, shiftMonth(month, 1)]` para `this.run(...)`.
  - Adicionar `private readonly errorNonceState = signal(0); readonly errorNonce = this.errorNonceState.asReadonly();`, `clearError(): void { this.errorState.set(null); }` e `reportError(message: string): void { this.errorState.set(message); this.errorNonceState.update(n => n + 1); }`.
  - No `catch` de `start` (quando `!force`): chamar `this.reportError(AUTO_SYNC_ERROR)`.
- Criar `src/app/pages/admin/data/admin-month.service.ts` com `month`, `isCurrentMonth`, `setMonth`, `shift`, `resetToCurrent`, `syncCurrentMonthForce`. Em `setMonth`, validar `isValidMonth(value)`, sair cedo se `value === this.month()`, atualizar o sinal e disparar `void this.autoSync.run([value])`.

- [ ] **Step 4: Rodar testes para verificar aprovação**

Run: `npx ng test --watch=false --include src/app/pages/admin/data/auto-sync.service.spec.ts --include src/app/pages/admin/data/admin-month.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/data/auto-sync.service.ts src/app/pages/admin/data/auto-sync.service.spec.ts src/app/pages/admin/data/admin-month.service.ts src/app/pages/admin/data/admin-month.service.spec.ts
git commit -m "feat(admin): adiciona mes unico compartilhado e auto-sync de 3 meses"
```

---

### Task 2: Domínio de Fluxo e Tradução do Financeiro (`domain/workflow.ts`)

**Files:**
- Create: `src/app/pages/admin/domain/workflow.ts`
- Create: `src/app/pages/admin/domain/workflow.spec.ts`

**Interfaces:**
- Consumes: `Patient`, `Payment`, `Session` (`./models`); `MonthSummary`, `PatientMonthLine`, `REMOVED_PATIENT_LABEL` (`./finance`); `buildChargeQueue` (`./charge-queue`); `groupSessions` (`./sessions-view`); `currentMonth`, `shiftMonth` (`./month`); `formatCents` (`./money`); `pixPrefillQuery` (`./pix-prefill`); `whatsappChargeUrl` (`./charge-message`).
- Produces:
  - `export type WorkflowStepId = 'patients' | 'sync' | 'sessions' | 'finance';`
  - `export type WorkflowStepStatus = 'done' | 'in_progress' | 'pending';`
  - `export interface WorkflowStep { id: WorkflowStepId; index: number; title: string; summary: string; status: WorkflowStepStatus; ctaLabel: string; route: string; queryParams?: Record<string, string>; }`
  - `export interface WorkflowState { steps: WorkflowStep[]; nextStep: WorkflowStep | null; allClear: boolean; atendimentosBadge: number; financeiroBadge: number; unidentifiedCount: number; pendingConfirmationCount: number; previousMonthPendingCount: number; previousMonth: string; }`
  - `export function buildWorkflowState(input: { patients: Patient[]; sessions: Session[]; summary: MonthSummary; charges: ReadonlyMap<string, Date>; month: string; now: Date; syncing: boolean; lastSyncedAt: Date | null }): WorkflowState`
  - `export type FinanceRowStatus = 'overdue' | 'open' | 'pending_sync' | 'credit' | 'paid';`
  - `export interface FinanceDisplayRow { line: PatientMonthLine; name: string; status: FinanceRowStatus; statusLabel: string; headline: string; subline: string; pixQuery: Record<string, string> | null; chargeUrl: string | null; chargedAt: Date | null; invalidPhone: boolean; }`
  - `export function buildFinanceRows(input: { summary: MonthSummary; patients: ReadonlyMap<string, Patient>; charges: ReadonlyMap<string, Date> }): FinanceDisplayRow[]`

- [ ] **Step 1: Escrever testes falhando em `src/app/pages/admin/domain/workflow.spec.ts`**

Cobrir:
- `buildWorkflowState`:
  - consultório vazio (`patients = []`, `sessions = []`): passo 1 (`patients`) é `nextStep`, `allClear = false`.
  - com pacientes ativos e `syncing = true`: passo 2 (`sync`) fica `'in_progress'`.
  - com sessões sem paciente + passadas sem confirmar no mês atual + 1 pendente no mês anterior: `atendimentosBadge` soma todos os 3, `previousMonthPendingCount === 1`, `nextStep.id === 'sessions'`.
  - mês atual limpo, mas mês anterior com pendência: `atendimentosBadge === 1` e `previousMonth` igual a `shiftMonth(month, -1)`.
  - sessões ok + 2 pacientes prontas para cobrar (1 recente dentro do cooldown de 7 dias ignorada): `financeiroBadge === 1`, `nextStep.id === 'finance'`.
  - tudo quitado e sem pendências: `allClear === true`, `nextStep === null`, badges `0`.
- `buildFinanceRows`:
  - classifica corretamente `'overdue'`, `'open'`, `'credit'`, `'paid'` e `'pending_sync'` (quando `!summary.hasLinkedSessions` nunca classifica como `'paid'`).
  - ordena `overdue` → `open` → `pending_sync` → `credit` → `paid`, desempate por maior valor pendente e depois nome.
  - paciente `overdue > 0` com telefone inválido gera `chargeUrl: null` e `invalidPhone: true`.
  - `headline` e `subline` trazem valores formatados em português claro sem jargão.

- [ ] **Step 2: Rodar testes para verificar falha**

Run: `npx ng test --watch=false --include src/app/pages/admin/domain/workflow.spec.ts`
Expected: FAIL (`workflow.ts` não existe).

- [ ] **Step 3: Implementar `src/app/pages/admin/domain/workflow.ts`**

Implementar `buildWorkflowState` e `buildFinanceRows` usando `groupSessions`, `buildChargeQueue`, `shiftMonth`, `currentMonth`, `formatCents`, `pixPrefillQuery` e `whatsappChargeUrl`. Garantir que `sessions` seja filtrado por `currentMonth(s.startsAt) === month` (mês ativo) e `=== previousMonth` (mês anterior) antes de chamar `groupSessions`.

- [ ] **Step 4: Rodar testes para verificar aprovação**

Run: `npx ng test --watch=false --include src/app/pages/admin/domain/workflow.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/domain/workflow.ts src/app/pages/admin/domain/workflow.spec.ts
git commit -m "feat(admin): adiciona dominio puro de trilha de sucesso e status financeiro"
```

---

### Task 3: `OnboardingService` e `SyncErrorToastComponent` (Toastr de erro de sync)

**Files:**
- Create: `src/app/pages/admin/data/onboarding.service.ts`
- Create: `src/app/pages/admin/data/onboarding.service.spec.ts`
- Create: `src/app/pages/admin/sync-error-toast.component.ts`
- Create: `src/app/pages/admin/sync-error-toast.component.spec.ts`

**Interfaces:**
- Consumes: `AuthService` (`./auth.service`), `AutoSyncService` (`./auto-sync.service`), `AdminMonthService` (`./admin-month.service`).
- Produces:
  - `OnboardingService` (`providedIn: 'root'`): `open: Signal<boolean>`, `completed: Signal<boolean>`, `initForCurrentUser(): void`, `openManual(): void`, `complete(): void`, `dismiss(): void`. Chave `psico-hub:onboarding:v1:${uid}`.
  - `SyncErrorToastComponent` (selector `app-sync-error-toast`): observa `AutoSyncService.error()` + `errorNonce()`, renderiza toast fixo no canto inferior direito (`role="alert"`) com mensagem do erro, botão `Tentar novamente` (chama `AdminMonthService.syncCurrentMonthForce()`) e botão fechar (`×`). Reaparece automaticamente quando `errorNonce()` muda após ter sido fechado.

- [ ] **Step 1: Escrever testes falhando para `OnboardingService` e `SyncErrorToastComponent`**

Em `onboarding.service.spec.ts`:
- `initForCurrentUser` abre o modal na 1ª entrada do `uid` e não abre na 2ª entrada depois de `complete()` ou `dismiss()`.
- Usuária com `uid` diferente tem estado isolado (`psico-hub:onboarding:v1:<uid>`).
- `openManual()` abre mesmo após concluído.
- Quando `localStorage.getItem` ou `setItem` lança erro (Safari modo privado), não quebra e `openManual`/`dismiss` continuam funcionando.

Em `sync-error-toast.component.spec.ts`:
- Não renderiza alerta quando `autoSync.error()` é `null`.
- Renderiza toast com `role="alert"`, texto do erro e botão `Tentar novamente` quando `autoSync.error()` tem mensagem.
- Clicar em fechar oculta o toast; um novo incremento de `errorNonce` faz o toast reaparecer.
- Clicar em `Tentar novamente` chama `adminMonth.syncCurrentMonthForce()`; se resolver com sucesso, limpa erro e oculta toast; se falhar, atualiza mensagem do toast com o erro retornado.

- [ ] **Step 2: Rodar testes para verificar falha**

Run: `npx ng test --watch=false --include src/app/pages/admin/data/onboarding.service.spec.ts --include src/app/pages/admin/sync-error-toast.component.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `OnboardingService` e `SyncErrorToastComponent`**

- `OnboardingService`: encapsular leitura/escrita de `localStorage` em `try/catch`; usar `computed` ligado a `auth.user()` + sinal interno de versão para atualizar `completed()`.
- `SyncErrorToastComponent`: toast flutuante (`fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-50`), borda e fundo de erro claros (`bg-white border-red-300 shadow-lg`), ícone `lucideAlertCircle`, botão `Tentar novamente` com estado `loading` e botão fechar (`lucideX`, `aria-label="Fechar aviso"`). Usar `effect` em `autoSync.errorNonce()` para limpar `dismissed` e `manualError` quando novo erro chegar.

- [ ] **Step 4: Rodar testes para verificar aprovação**

Run: `npx ng test --watch=false --include src/app/pages/admin/data/onboarding.service.spec.ts --include src/app/pages/admin/sync-error-toast.component.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/data/onboarding.service.ts src/app/pages/admin/data/onboarding.service.spec.ts src/app/pages/admin/sync-error-toast.component.ts src/app/pages/admin/sync-error-toast.component.spec.ts
git commit -m "feat(admin): adiciona servico de onboarding e toast de erro de sincronizacao"
```

---

### Task 4: Boas-vindas + Tutorial de Configuração Guiado (`OnboardingModalComponent`)

**Files:**
- Create: `src/app/pages/admin/onboarding/onboarding-modal.component.ts`
- Create: `src/app/pages/admin/onboarding/onboarding-modal.component.spec.ts`

**Interfaces:**
- Consumes: `OnboardingService`, `PatientsService`, `SessionsService`, `AdminMonthService`, `AutoSyncService`, `Router`.
- Produces: `OnboardingModalComponent` (selector `app-onboarding-modal`), exibido quando `onboarding.open()` é `true`.

- [ ] **Step 1: Escrever testes falhando em `onboarding-modal.component.spec.ts`**

Cobrir:
- Não renderiza o dialog quando `onboarding.open()` é `false`.
- Quando aberto, exibe `role="dialog"`, `aria-modal="true"`, indicador `Passo 1 de 4` e botão `Pular e explorar`.
- Pressionar `Escape` ou clicar em `Pular e explorar` chama `onboarding.dismiss()`.
- Passo 2 (`Pacientes`): quando há pacientes ativos, exibe selo `"Você já tem 2 pacientes ativos"`; quando há `0`, mostra botão `"Cadastrar primeiro paciente"` que chama `onboarding.complete()` e navega para `/admin/pacientes?novo=1`.
- Passo 3 (`Google Agenda automático`): texto explica explicitamente que o sistema sincroniza automaticamente **mês passado, mês atual e próximo** ao abrir e ao trocar de mês, e que `↻` no topo serve apenas para atualizar na hora; clicar em `"Sincronizar agora"` chama `adminMonth.syncCurrentMonthForce()` e exibe o resumo (`syncSummary`).
- Passo 4 (`Rotina semanal`): clicar em `"Ir para o Início"` chama `onboarding.complete()` e navega para `/admin/inicio`.

- [ ] **Step 2: Rodar testes para verificar falha**

Run: `npx ng test --watch=false --include src/app/pages/admin/onboarding/onboarding-modal.component.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `OnboardingModalComponent`**

- Dialog responsivo para iPad (`max-w-lg w-full rounded-2xl bg-card border border-border shadow-xl p-6`), `host: { '(document:keydown.escape)': 'onEscape()' }`.
- 4 passos com barra de progresso visual (`Passo {{ step() }} de 4`), navegação `Voltar` / `Próximo`, `Pular e explorar` sempre visível e botão `×` (`aria-label="Fechar guia"`).
- No Passo 3, deixar explícito em linguagem simples como a sincronização funciona (3 meses automáticos ao abrir + automático ao trocar de mês + `↻` opcional no topo) + ação `"Sincronizar agora"` com feedback inline de sucesso ou erro.

- [ ] **Step 4: Rodar testes para verificar aprovação**

Run: `npx ng test --watch=false --include src/app/pages/admin/onboarding/onboarding-modal.component.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/onboarding/onboarding-modal.component.ts src/app/pages/admin/onboarding/onboarding-modal.component.spec.ts
git commit -m "feat(admin): adiciona tutorial de boas-vindas e configuracao guiada"
```

---

### Task 5: `AdminShellComponent` (4 abas + barra de mês único) e `admin.routes.ts`

**Files:**
- Modify: `src/app/pages/admin/admin-shell.component.ts`
- Create: `src/app/pages/admin/admin-shell.component.spec.ts`
- Modify: `src/app/pages/admin/admin.routes.ts`
- Create: `src/app/pages/admin/admin.routes.spec.ts`

**Interfaces:**
- Consumes: `AdminMonthService`, `AutoSyncService`, `OnboardingService`, `PatientsService`, `SessionsService`, `PaymentsService`, `ChargesService`, `buildWorkflowState`, `MonthPickerComponent`, `OnboardingModalComponent`, `SyncErrorToastComponent`.
- Produces:
  - Shell com 4 abas (`/admin/inicio`, `/admin/atendimentos`, `/admin/financeiro`, `/admin/pacientes`), badges reativos de `Atendimentos` e `Financeiro`, botão `? Como funciona`, barra de mês compartilhada (oculta em `/admin/pacientes`) com `‹`, `app-month-picker`, `›`, `Mês atual`, status de sync + botão `↻`, `app-onboarding-modal` e `app-sync-error-toast`.
  - Rotas oficiais + redirects compatíveis: `'' → inicio`, `agenda → atendimentos?aba=semana`, `sessoes → atendimentos` (mapeando `nao-identificados`/`pendentes` → `pendencias`, `todas` → `mes`, preservando `mes`), `painel → inicio`, `cobranca → financeiro?aba=cobrar`, `pagamentos → financeiro?aba=pix` (preservando `mes`, `paciente`, `valor`).
  - Nota: enquanto `HomeComponent`, `AtendimentosComponent` e `FinanceHubComponent` ainda não existirem nas Tasks 6–8, manter os redirects apontando para os novos destinos somente após os stubs/componentes existirem — portanto criar stubs mínimos ou implementar a rota junto com os componentes. **Melhor ordem:** criar os 3 componentes reais nas Tasks 6, 7 e 8 ANTES de trocar os `loadComponent` finais em `admin.routes.ts`? Não: podemos manter a Task 5 focada no `AdminShellComponent` + testes unitários do shell e uma função pura exportada `legacyRedirectUrl(router, legacyPath, queryParams)` em `admin-redirects.ts`, e conectar `admin.routes.ts` assim que as 3 telas existirem (ou conectar na Task 8). **Decisão limpa:** colocar `admin-redirects.ts` + `AdminShellComponent` na Task 5, mantendo `admin.routes.ts` apontando para as telas novas conforme cada Task (6, 7, 8) entrega sua tela — assim o `ng build` nunca quebra em nenhum commit intermediário!

- [ ] **Step 1: Escrever testes falhando para `admin-redirects.ts` e `AdminShellComponent`**

Criar `src/app/pages/admin/admin-redirects.spec.ts` testando `buildLegacyRedirect(path, queryParams)`:
- `agenda` → `['/admin/atendimentos']`, `{ aba: 'semana' }`
- `sessoes` com `{ mes: '2026-10', aba: 'nao-identificados' }` → `['/admin/atendimentos']`, `{ mes: '2026-10', aba: 'pendencias' }`
- `sessoes` com `{ aba: 'todas' }` → `['/admin/atendimentos']`, `{ aba: 'mes' }`
- `painel` com `{ mes: '2026-10' }` → `['/admin/inicio']`, `{ mes: '2026-10' }`
- `cobranca` com `{ mes: '2026-10' }` → `['/admin/financeiro']`, `{ aba: 'cobrar', mes: '2026-10' }`
- `pagamentos` com `{ paciente: 'p1', valor: '150,00', mes: '2026-10' }` → `['/admin/financeiro']`, `{ aba: 'pix', paciente: 'p1', valor: '150,00', mes: '2026-10' }`

Criar `src/app/pages/admin/admin-shell.component.spec.ts`:
- Renderiza exatamente as 4 abas: `Início`, `Atendimentos`, `Financeiro`, `Pacientes`.
- Exibe badges numéricos em `Atendimentos` e `Financeiro` quando há pendências/cobranças.
- Clicar em `? Como funciona` chama `onboarding.openManual()`.
- Na rota `/admin/pacientes`, oculta a barra de seleção de mês; nas demais rotas, exibe `‹`, `app-month-picker`, `›` e botão `Mês atual` quando `!isCurrentMonth()`.
- Botão `↻` chama `adminMonth.syncCurrentMonthForce()` e renderiza `app-sync-error-toast` e `app-onboarding-modal`.
- Ao montar (`afterNextRender`), chama `autoSync.runOnEntry()` e `onboarding.initForCurrentUser()`.

- [ ] **Step 2: Rodar testes para verificar falha**

Run: `npx ng test --watch=false --include src/app/pages/admin/admin-redirects.spec.ts --include src/app/pages/admin/admin-shell.component.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Criar `admin-redirects.ts` e atualizar `AdminShellComponent`**

- Criar `src/app/pages/admin/admin-redirects.ts` com `buildLegacyRedirect(segment, queryParams)` e helper `legacyRedirect(segment): RedirectFunction` usando `inject(Router).createUrlTree(...)`.
- Atualizar `src/app/pages/admin/admin-shell.component.ts`:
  - 4 links (`Início`, `Atendimentos`, `Financeiro`, `Pacientes`) com badges vindos de `buildWorkflowState(...)`.
  - Botão `? Como funciona` (`lucideCircleHelp`) ao lado de `Sair`.
  - Faixa de contexto do mês abaixo do header (oculta quando URL atual começa com `/admin/pacientes`, observando `Router.events` + `router.url`): botões `‹` / `app-month-picker` / `›` (`min-h-10`), `Mês atual` quando `!adminMonth.isCurrentMonth()`, e indicador de sync (`Atualizando agenda…` ou `Agenda atualizada há X` + botão `↻` com `aria-label="Atualizar agenda agora"`).
  - Incluir `<app-onboarding-modal />` e `<app-sync-error-toast />`.
  - Se `syncCurrentMonthForce()` chamado pelo botão `↻` rejeitar, chamar `this.autoSync.reportError(err instanceof Error ? err.message : AUTO_SYNC_ERROR)` para exibir o erro no mesmo `SyncErrorToastComponent`.

- [ ] **Step 4: Rodar testes para verificar aprovação**

Run: `npx ng test --watch=false --include src/app/pages/admin/admin-redirects.spec.ts --include src/app/pages/admin/admin-shell.component.spec.ts --include src/app/pages/admin/data/auto-sync.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/admin-redirects.ts src/app/pages/admin/admin-redirects.spec.ts src/app/pages/admin/admin-shell.component.ts src/app/pages/admin/admin-shell.component.spec.ts
git commit -m "feat(admin): reorganiza shell em 4 abas com mes unico, ajuda e toast de sync"
```

---

### Task 6: Tela `Início` (`HomeComponent` — Trilha de Sucesso + Resumo)

**Files:**
- Create: `src/app/pages/admin/inicio/home.component.ts`
- Create: `src/app/pages/admin/inicio/home.component.spec.ts`
- Modify: `src/app/pages/admin/admin.routes.ts` (adiciona rota `inicio`, padrão `'' → inicio`, redirect `painel → inicio`)

**Interfaces:**
- Consumes: `AdminMonthService`, `AutoSyncService`, `CalendarSyncsService`, `PatientsService`, `SessionsService`, `PaymentsService`, `ChargesService`, `buildLedger`, `summarizeMonth`, `buildDashboard`, `buildWorkflowState`, `RevenueChartComponent`.
- Produces: `HomeComponent` em `/admin/inicio`.

- [ ] **Step 1: Escrever testes falhando em `home.component.spec.ts`**

Cobrir:
- Se rota vier com `?mes=2026-10`, sincroniza `adminMonth.setMonth('2026-10')`.
- Exibe a **Trilha de Sucesso** com os 4 passos e destaca o botão primário do `nextStep` (ex.: `Resolver pendências` apontando para `/admin/atendimentos?aba=pendencias`).
- Quando `allClear === true`, exibe a faixa tranquila `"Tudo em dia"` (com botão para ver os 4 passos se quiser).
- Exibe exatamente os 4 cards essenciais (`Recebido`, `A receber`, `Em atraso`, `Sessões`), barra `Previsto × Realizado`, gráfico `app-revenue-chart` e lista de `Alertas de frequência`.
- Enquanto `autoSync.syncing()` e sem sessões no mês, exibe estado neutro `"Buscando sessões no Google Agenda…"` (nunca banner mandando clicar para sincronizar).

- [ ] **Step 2: Rodar testes para verificar falha**

Run: `npx ng test --watch=false --include src/app/pages/admin/inicio/home.component.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `HomeComponent` e ligar rota `inicio` em `admin.routes.ts`**

- Implementar `src/app/pages/admin/inicio/home.component.ts` seguindo o layout limpo para iPad (grid 2 colunas em `sm`, 4 em `lg`, `tabular-nums`, acessibilidade completa com tabela `sr-only` no gráfico).
- Atualizar `admin.routes.ts`: rota padrão `'' → inicio`, lazy `inicio` → `HomeComponent`, e `painel` usando `legacyRedirect('painel')`.

- [ ] **Step 4: Rodar testes para verificar aprovação**

Run: `npx ng test --watch=false --include src/app/pages/admin/inicio/home.component.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/inicio/home.component.ts src/app/pages/admin/inicio/home.component.spec.ts src/app/pages/admin/admin.routes.ts
git commit -m "feat(admin): cria tela Inicio com trilha de sucesso viva e resumo do mes"
```

---

### Task 7: Tela `Atendimentos` (`AtendimentosComponent` — Semana / Pendências / Mês)

**Files:**
- Create: `src/app/pages/admin/atendimentos/atendimentos.component.ts`
- Create: `src/app/pages/admin/atendimentos/atendimentos.component.spec.ts`
- Modify: `src/app/pages/admin/admin.routes.ts` (adiciona rota `atendimentos` + redirects `agenda` e `sessoes`)

**Interfaces:**
- Consumes: `AdminMonthService`, `AutoSyncService`, `SessionsService`, `PatientsService`, `SessionActionsComponent`, `groupByDay`, `weekWindow`, `shiftWeek`, `weekLabel`, `monthsInWindow`, `groupSessions`, `canConfirm`, `statusLabel`, `rescheduleNote`, `formatSessionDateTime`, `currentMonth`, `shiftMonth`, `monthLabel`.
- Produces: `AtendimentosComponent` em `/admin/atendimentos` com query params `?aba=semana|pendencias|mes` e `?mes=YYYY-MM`.

- [ ] **Step 1: Escrever testes falhando em `atendimentos.component.spec.ts`**

Cobrir:
- Abre na sub-aba `Semana` por padrão; respeita `?aba=pendencias` e `?aba=mes`, e `?mes=2026-10` sincroniza `AdminMonthService`.
- Na aba `Semana`:
  - Sessão identificada mostra botão explícito `Ações` / `Confirmar` (`min-h-10`) que expande `app-session-actions` sem exigir descoberta de clique oculto na linha.
  - Sessão sem paciente (`patientId === null`) exibe o seletor `Vincular paciente` + botão `Vincular` **diretamente no card** (sem link `"Resolver em Sessões"`), e clicar em `Vincular` chama `sessionsService.linkPatient`.
- Na aba `Pendências`:
  - Lista sessões sem paciente primeiro, depois sessões passadas aguardando confirmação (com botões `Realizada / Faltou / Cancelada` imediatamente visíveis, sem expandir).
  - Quando o mês anterior tem sessões sem paciente ou sem confirmação, exibe seção separada `"Restantes de <mês anterior>"` com as mesmas ações diretas.
  - Quando não há pendências, mostra empty state `"Nenhuma pendência de atendimento"`.
- Na aba `Mês`: lista todas as sessões do mês ativo (`AdminMonthService.month()`), incluindo tratamento de `missingFromCalendar` (`Manter` / `Cancelar sessão` / `Remover`).

- [ ] **Step 2: Rodar testes para verificar falha**

Run: `npx ng test --watch=false --include src/app/pages/admin/atendimentos/atendimentos.component.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `AtendimentosComponent` e ligar rotas em `admin.routes.ts`**

- Usar `sessionsService.watchAll()` para alimentar `Semana`, `Pendências` (mês ativo + mês anterior) e `Mês` (filtrado por `adminMonth.month()`), evitando múltiplos listeners por mês e mantendo o filtro sempre sincronizado com `AdminMonthService`.
- Usar segmented tabs acessíveis (`role="tablist"` / `role="tab"`, altura confortável para toque no iPad) para `Semana`, `Pendências (N)` e `Mês`.
- Atualizar `admin.routes.ts` adicionando `atendimentos` e redirects `agenda` / `sessoes` via `legacyRedirect`.

- [ ] **Step 4: Rodar testes para verificar aprovação**

Run: `npx ng test --watch=false --include src/app/pages/admin/atendimentos/atendimentos.component.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/atendimentos/atendimentos.component.ts src/app/pages/admin/atendimentos/atendimentos.component.spec.ts src/app/pages/admin/admin.routes.ts
git commit -m "feat(admin): unifica Agenda e Sessoes na tela Atendimentos"
```

---

### Task 8: Tela `Financeiro` para iPad (`FinanceHubComponent` — Resumo / Cobrar / Pix)

**Files:**
- Modify: `src/app/pages/admin/cobranca/cobranca.component.ts` (+ `.spec.ts`)
- Modify: `src/app/pages/admin/pagamentos/payments.component.ts` (+ `.spec.ts`)
- Create: `src/app/pages/admin/financeiro/finance-hub.component.ts`
- Create: `src/app/pages/admin/financeiro/finance-hub.component.spec.ts`
- Modify: `src/app/pages/admin/admin.routes.ts` (troca `financeiro` para `FinanceHubComponent` e adiciona redirects `cobranca` e `pagamentos`)

**Interfaces:**
- Consumes: `AdminMonthService`, `SessionsService`, `PatientsService`, `PaymentsService`, `ChargesService`, `buildLedger`, `summarizeMonth`, `buildFinanceRows`, `buildChargeQueue`, `PaymentFormComponent`, `CobrancaComponent`, `PaymentsComponent`, `parsePixPrefill`.
- Produces:
  - `CobrancaComponent` com `embedded = input(false)` (quando `true`, oculta header/month-picker próprios e acompanha `AdminMonthService.month()`).
  - `PaymentsComponent` com `embedded = input(false)` (quando `true`, oculta header próprio, inicia filtrando pelo `AdminMonthService.month()` com toggle `Ver todos os meses` / `Só <mês>`).
  - `FinanceHubComponent` em `/admin/financeiro` com sub-abas `?aba=resumo|cobrar|pix`, botão `+ Registrar Pix` sempre visível abrindo `PaymentFormComponent` inline no topo, e lista de cartões para iPad (zero `<table>` de 7 colunas) com filtro `Com pendência | Todos | Pagos` e botão `Ver cálculo ▾`.

- [ ] **Step 1: Escrever testes falhando para modo `embedded` e `FinanceHubComponent`**

Em `cobranca.component.spec.ts` e `payments.component.spec.ts`:
- Verificar que com `embedded = true`, acompanham `AdminMonthService.month()` sem renderizar cabeçalho duplicado; `PaymentsComponent` mostra botão `"Ver todos os meses"` para alternar entre mês ativo e histórico completo.

Em `finance-hub.component.spec.ts`:
- Abre em `Resumo` por padrão; respeita `?aba=cobrar` e `?aba=pix`, e prefill de Pix na URL abre o formulário inline já preenchido.
- Não renderiza `<table>` de 7 colunas; renderiza lista de cartões/linhas com nome, badge de status (`Em atraso`, `A receber`, `Pago`, `Com crédito`, `Aguardando sessões`) e resumo humano.
- Filtro rápido começa em `Com pendência` quando há itens `overdue`/`open` e alterna entre `Com pendência`, `Todos` e `Pagos`.
- Clicar em `Ver cálculo` expande os valores detalhados em português claro (incluindo origem de crédito abatido quando `sources.length > 0`).
- Clicar em `Registrar Pix` no cartão da paciente abre `app-payment-form` inline já preenchido com aquela paciente, valor e mês ativo (sem navegar para outra rota).
- Paciente `overdue > 0` com telefone inválido não gera link `wa.me` e mostra link para `/admin/pacientes`.
- Botão `Cobrar em fila (N)` troca para a sub-aba `Cobrar`.

- [ ] **Step 2: Rodar testes para verificar falha**

Run: `npx ng test --watch=false --include src/app/pages/admin/financeiro/finance-hub.component.spec.ts --include src/app/pages/admin/cobranca/cobranca.component.spec.ts --include src/app/pages/admin/pagamentos/payments.component.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Adaptar `CobrancaComponent` e `PaymentsComponent`, implementar `FinanceHubComponent` e finalizar `admin.routes.ts`**

- Em `CobrancaComponent`: adicionar `readonly embedded = input(false);`, sincronizar `month` com `AdminMonthService.month()` quando `embedded()`, ocultar `<header>` quando `embedded()`.
- Em `PaymentsComponent`: adicionar `readonly embedded = input(false);` e sinal `showAllMonths = signal(false);`; quando `embedded()` e `!showAllMonths()`, filtra por `adminMonth.month()`, exibindo botão `"Ver todos os meses"` / `"Filtrar por <mês>"`.
- Implementar `FinanceHubComponent` com 3 sub-abas (`Resumo`, `Cobrar (N)`, `Pix recebidos`), formulário inline de Pix no topo, cartões limpos para iPad e bloco expansível `Ver cálculo ▾`.
- Atualizar `admin.routes.ts`: `financeiro → FinanceHubComponent`, `cobranca → legacyRedirect('cobranca')`, `pagamentos → legacyRedirect('pagamentos')`.

- [ ] **Step 4: Rodar testes para verificar aprovação**

Run: `npx ng test --watch=false --include src/app/pages/admin/financeiro/finance-hub.component.spec.ts --include src/app/pages/admin/cobranca/cobranca.component.spec.ts --include src/app/pages/admin/pagamentos/payments.component.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/cobranca/cobranca.component.ts src/app/pages/admin/cobranca/cobranca.component.spec.ts src/app/pages/admin/pagamentos/payments.component.ts src/app/pages/admin/pagamentos/payments.component.spec.ts src/app/pages/admin/financeiro/finance-hub.component.ts src/app/pages/admin/financeiro/finance-hub.component.spec.ts src/app/pages/admin/admin.routes.ts
git commit -m "feat(admin): cria Financeiro simplificado para iPad com Cobrar e Pix integrados"
```

---

### Task 9: Ajustes em `Pacientes` + Verificação Completa (Testes, Build, iPad e Impeccable)

**Files:**
- Modify: `src/app/pages/admin/patients/patients.component.ts`
- Modify: `src/app/pages/admin/patients/patients.component.spec.ts`
- Modify: `src/app/pages/admin/patients/patient-form.component.ts`

**Interfaces:**
- Consumes: `ActivatedRoute` (`?novo=1`).
- Produces: abertura automática do formulário de novo paciente quando `?novo=1`, dica inline no campo Nome sobre casar com o Google Agenda, e empty state guiado com CTA direto `+ Novo paciente`.

- [ ] **Step 1: Escrever testes falhando em `patients.component.spec.ts`**

Adicionar casos:
- Com query param `?novo=1`, `PatientsComponent` já abre o formulário de novo paciente automaticamente.
- Formulário exibe a dica `"Use o mesmo nome do Google Agenda"` junto ao campo Nome.
- Quando não há pacientes cadastrados, empty state explica que cadastrar pacientes é o Passo 1 e oferece botão direto `Novo paciente`.

- [ ] **Step 2: Rodar testes para verificar falha**

Run: `npx ng test --watch=false --include src/app/pages/admin/patients/patients.component.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar ajustes em `PatientsComponent` e `PatientFormComponent`**

- Ler `route?.snapshot?.queryParamMap?.get('novo') === '1'` em `PatientsComponent` para inicializar `form` em `{ mode: 'create' }`.
- Adicionar `<p id="patient-name-hint" class="text-xs text-muted-foreground">Use o mesmo nome usado no Google Agenda para vincular as sessões automaticamente.</p>` em `PatientFormComponent` (conectado via `aria-describedby`).
- Tornar o empty state inicial acionável com botão `Novo paciente` quando não há busca ativa.

- [ ] **Step 4: Rodar suite completa, build de produção e detector Impeccable**

1. `npx ng test --watch=false` — Expected: 100% PASS, zero regressões.
2. `npx ng build` — Expected: build limpo sem erros de compilação ou orçamento.
3. Rodar detector Impeccable sobre os novos/alterados templates do `/admin`:
   `C:\Users\caiorosa\.config\opencode\skills\impeccable\scripts\impeccable.cmd detect --json src/app/pages/admin`
   Corrigir quaisquer achados reais de contraste/acessibilidade/layout.
4. Verificar visualmente no navegador (ou Playwright) em **768×1024** (iPad retrato) e **1024×768** (iPad paisagem):
   - Zero overflow horizontal (`scrollWidth <= clientWidth`) no cabeçalho e no Financeiro.
   - Alvos de toque principais ≥ 44 px.

- [ ] **Step 5: Commit final**

```bash
git add src/app/pages/admin/patients/patients.component.ts src/app/pages/admin/patients/patients.component.spec.ts src/app/pages/admin/patients/patient-form.component.ts
git commit -m "feat(admin): melhora onboarding e dica de agenda na tela de Pacientes"
```
