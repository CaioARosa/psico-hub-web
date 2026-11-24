# Automação da Agenda e Fila de Cobrança Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sincronizar a agenda sozinho ao abrir `/admin` (S1) e dar à Lays uma fila de cobrança que lembra quem já foi cobrada (C1).

**Architecture:** S1 é um `AutoSyncService` de frontend que decide por mês (`needsAutoSync`) e reaproveita o `CalendarSyncService` existente; o backend não muda. C1 adiciona a coleção `charges`, uma lógica pura `charge-queue` e uma tela `/admin/cobranca`; o envio continua manual via `wa.me`.

**Tech Stack:** Angular 22 (standalone, signals, OnPush), Firebase Firestore, Zard UI, Tailwind v4, Vitest (`npx ng test --watch=false --include=<arquivo>`).

**Spec:** `docs/superpowers/specs/2026-11-24-automacao-agenda-cobranca-design.md`

## Global Constraints

- Backend (`server/`) e `firestore.rules` **não mudam**.
- `AUTO_SYNC_AFTER_HOURS = 6`; `CHARGE_COOLDOWN_DAYS = 7`.
- Meses sincronizados ao entrar: mês atual e o próximo (`currentMonth(now)` e `shiftMonth(m, 1)`), em UTC-3.
- Valores em centavos inteiros; datas e meses em UTC-3 (`month.ts`, `datetime.ts`).
- A mensagem de cobrança **não é salva**. `charges/{patientId}_{YYYY-MM}` guarda só `patientId`, `month`, `chargedAt`, `amount`.
- Cobrança só é marcada depois de a Lays confirmar "Enviou a mensagem?".
- Textos de UI em português (BR), tom acolhedor, sem jargão financeiro ("em aberto"/"em atraso" já usados na tela).
- Componentes: `ChangeDetectionStrategy.OnPush`, standalone, Zard UI, mesmo estilo de `agenda.component.ts`. Escritas via `runWrite` (`data/safe-write.ts`).
- Cada tarefa termina com os testes dela verdes e um commit.

## Review Focus

- `lastSyncedAt` no futuro (relógio do aparelho atrasado) ou ausente: não pode virar sincronização em loop nem erro. Teste em Task 1.
- Falha ao ler `calendarSyncs` (permissão/offline): tratar como "sem registro" e tentar sincronizar o mês. Teste em Task 3.
- Duas chamadas simultâneas para o mesmo mês (shell + Agenda): uma só ida ao backend. Teste em Task 3.
- Clique duplo em "Sim, marcar como cobrada": uma única gravação e botão travado enquanto grava. Teste em Task 7.
- Fila nunca inclui: mês sem sessões vinculadas, paciente removido ou telefone inválido (esse aparece na nota "Corrija em Pacientes"). Teste em Task 5.

---

## File Structure

| Arquivo | Responsabilidade |
| :-- | :-- |
| `domain/sync-freshness.ts` (modificar) | `needsAutoSync`, `AUTO_SYNC_AFTER_HOURS`, `syncedAgoLabel` |
| `data/calendar-syncs.service.ts` (modificar) | `lastSyncedAtOnce(month)` |
| `data/auto-sync.service.ts` (criar) | Orquestra sincronização por mês, dedup, erro silencioso |
| `admin-shell.component.ts`, `agenda/agenda.component.ts`, `sessions/sessions.component.ts` (modificar) | Usam o `AutoSyncService` |
| `domain/charge-message.ts` (modificar) | `whatsappLink(phone, text)` |
| `domain/charge-doc.ts` (criar) | Formato do doc `charges`, `chargeId`, `chargeFromDoc` |
| `domain/charge-queue.ts` (criar) | `buildChargeQueue` puro |
| `data/charges.service.ts` (criar) | `watchMonth`, `markCharged` |
| `cobranca/cobranca.component.ts` (criar) | Tela da fila |
| `financeiro/finance.component.ts`, `admin.routes.ts`, `admin-shell.component.ts` (modificar) | Selo, botão "Cobrar em fila", rota e menu |

Todos os caminhos são relativos a `src/app/pages/admin/`.

---

## Parte A: S1, sincronização automática

### Task 1: Funções puras de frescor

**Files:**
- Modify: `domain/sync-freshness.ts`
- Test: `domain/sync-freshness.spec.ts`

**Interfaces:**
- Produces:
  - `export const AUTO_SYNC_AFTER_HOURS = 6;`
  - `export function needsAutoSync(lastSyncedAt: Date | null, now: Date): boolean`
  - `export function syncedAgoLabel(syncedAt: Date, now: Date): string`

- [ ] **Step 1: Escrever os testes que falham** em `sync-freshness.spec.ts` (novo `describe`), com `now = 2026-11-17T15:00:00Z` e o helper `hoursAgo` já existente:
  - `needsAutoSync(null, now)` é `true`.
  - `needsAutoSync(hoursAgo(5.9), now)` é `false`; `needsAutoSync(hoursAgo(6), now)` é `true`.
  - `needsAutoSync(new Date(now.getTime() + 3600_000), now)` é `false` (registro no futuro conta como recente).
  - `syncedAgoLabel(hoursAgo(0.01), now)` é `'agora há pouco'`; `hoursAgo(0.5)` é `'há 30 min'`; `hoursAgo(5)` é `'há 5 h'`; `hoursAgo(49)` é `'há 2 dias'`; data futura é `'agora há pouco'`.
- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx ng test --watch=false --include=src/app/pages/admin/domain/sync-freshness.spec.ts`
  Expected: FAIL (`needsAutoSync is not a function`).
- [ ] **Step 3: Implementar** as duas funções em `sync-freshness.ts`. `syncedAgoLabel`: menos de 1 min (ou futuro) → `'agora há pouco'`; menos de 60 min → `há N min`; menos de 24 h → `há N h`; senão `há N dias` (inteiros, arredondando para baixo).
- [ ] **Step 4: Rodar e ver passar** (mesmo comando). Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add src/app/pages/admin/domain/sync-freshness.ts src/app/pages/admin/domain/sync-freshness.spec.ts
  git commit -m "feat(admin): regra de sincronizacao automatica e rotulo de frescor"
  ```

### Task 2: Leitura única da última sincronização

**Files:**
- Modify: `data/calendar-syncs.service.ts`

**Interfaces:**
- Produces: `CalendarSyncsService.lastSyncedAtOnce(month: string): Promise<Date | null>`: `getDoc(doc(db, 'calendarSyncs', month))`; devolve `syncedAt.toDate()` ou `null` se não existir. Erros de leitura **propagam** (quem chama decide).

Sem spec próprio (o serviço depende do Firestore real; é coberto pelo spec do `AutoSyncService` com fake, como os demais serviços de `data/`).

- [ ] **Step 1: Implementar** `lastSyncedAtOnce` em `calendar-syncs.service.ts`, reaproveitando a mesma conversão `typeof value.toDate === 'function'` do `watchMonth`.
- [ ] **Step 2: Compilar**
  Run: `npx ng build --configuration development`
  Expected: build sem erros de tipo.
- [ ] **Step 3: Commit**
  ```bash
  git add src/app/pages/admin/data/calendar-syncs.service.ts
  git commit -m "feat(admin): leitura unica da ultima sincronizacao do mes"
  ```

### Task 3: `AutoSyncService`

**Files:**
- Create: `data/auto-sync.service.ts`
- Test: `data/auto-sync.service.spec.ts`

**Interfaces:**
- Consumes: `CalendarSyncService.sync(month): Promise<SyncResult>`; `CalendarSyncsService.lastSyncedAtOnce(month)`; `needsAutoSync`, `AUTO_SYNC_AFTER_HOURS`; `currentMonth`, `shiftMonth`; `SyncCounts`.
- Produces:
  ```ts
  export interface AutoSyncOutcome { synced: string[]; skipped: string[]; totals: SyncCounts; }
  export const AUTO_SYNC_ERROR = 'Não foi possível atualizar a agenda agora.';
  @Injectable({ providedIn: 'root' }) export class AutoSyncService {
    readonly syncing: Signal<boolean>;
    readonly lastSyncedAt: Signal<Date | null>;   // sincronização mais recente conhecida
    readonly error: Signal<string | null>;        // só erros do modo automático
    run(months: string[], options?: { force?: boolean }): Promise<AutoSyncOutcome>;
    runOnEntry(now?: Date): Promise<AutoSyncOutcome>;  // [mês atual, próximo]; só dispara uma vez por instância
  }
  ```
- Regras de `run`:
  - Meses em sequência. Se já há sincronização em andamento para o mês, aguarda a mesma promessa e conta o mês como `skipped` (sem somar totais de novo).
  - `force: true`: sincroniza sem ler `calendarSyncs`; qualquer erro **propaga** (o componente mostra o alerta atual).
  - Sem `force`: lê `lastSyncedAtOnce`; se a leitura falha, trata como `null`; se `needsAutoSync` é falso, o mês vai para `skipped` e `lastSyncedAt` recebe a data lida; senão sincroniza. Erro de sincronização é engolido: `error` recebe `AUTO_SYNC_ERROR` e o próximo mês segue.
  - `CalendarSyncsService` é obtido com `Injector.get` **só no modo sem `force`**, para não inicializar o Firestore nos specs que só usam `force`.
  - Após cada sincronização bem-sucedida, `lastSyncedAt` recebe `new Date()`. `syncing` é verdadeiro enquanto houver ao menos uma execução ativa.

- [ ] **Step 1: Escrever os testes que falham** em `auto-sync.service.spec.ts` (fakes de `CalendarSyncService` e `CalendarSyncsService` via `TestBed`):
  - `sincroniza meses sem registro e soma os totais` (2 meses, `lastSyncedAtOnce` → `null`; `outcome.synced` é os dois, `totals.created` soma).
  - `pula mês sincronizado há menos de 6 h` (`skipped`, nenhuma chamada a `sync`, `lastSyncedAt` é a data lida).
  - `force ignora a leitura e a regra das 6 h` (nenhuma chamada a `lastSyncedAtOnce`).
  - `force propaga o erro do sync`.
  - `sem force, erro de sync vira aviso e segue para o próximo mês` (`error() === AUTO_SYNC_ERROR`, segundo mês sincroniza).
  - `falha ao ler calendarSyncs é tratada como sem registro e sincroniza` (Review Focus).
  - `duas chamadas simultâneas ao mesmo mês fazem um único sync` (Review Focus; `sync` é `vi.fn` com promessa pendente).
  - `runOnEntry usa mês atual e o seguinte em UTC-3 e só roda uma vez` (`now = 2026-11-30T23:00:00-03:00` → `['2026-11','2026-12']`; segunda chamada devolve `synced: []`).
- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx ng test --watch=false --include=src/app/pages/admin/data/auto-sync.service.spec.ts`
  Expected: FAIL (arquivo do serviço não existe).
- [ ] **Step 3: Implementar** `auto-sync.service.ts` conforme as regras acima.
- [ ] **Step 4: Rodar e ver passar** (mesmo comando). Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add src/app/pages/admin/data/auto-sync.service.ts src/app/pages/admin/data/auto-sync.service.spec.ts
  git commit -m "feat(admin): servico de sincronizacao automatica da agenda"
  ```

### Task 4: Ligar o `AutoSyncService` no shell, na Agenda e em Sessões

**Files:**
- Modify: `admin-shell.component.ts`, `agenda/agenda.component.ts`, `sessions/sessions.component.ts`
- Modify (specs): `agenda/agenda.component.spec.ts`, `sessions/sessions.component.spec.ts`

**Interfaces:**
- Consumes: `AutoSyncService` (Task 3), `syncedAgoLabel` (Task 1), `monthsInWindow` (`domain/agenda.ts`).

- [ ] **Step 1: Escrever os testes que falham**
  - `agenda.component.spec.ts` (adicionar ao `beforeEach` um fake `{ provide: CalendarSyncsService, useValue: { lastSyncedAtOnce: async () => new Date() } }` para não tocar o Firestore real):
    - `trocar de semana verifica os meses da nova semana sem forçar` (`shift(1)`; `syncCalls` vazio porque o fake devolve registro recente).
    - `Sincronizar agenda continua forçando e mostrando o resumo` (o teste existente `'Sincronizar agenda em semana que cruza meses…'` segue passando sem alteração).
    - `mostra "Atualizado" com o rótulo de frescor quando há lastSyncedAt`.
  - `sessions.component.spec.ts`: os dois testes existentes de `syncCalendar` devem continuar passando sem alteração.
- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx ng test --watch=false --include=src/app/pages/admin/agenda/agenda.component.spec.ts`
  Expected: FAIL (novos testes).
- [ ] **Step 3: Implementar**
  - `AgendaComponent.syncCalendar()` e `SessionsComponent.syncCalendar()`: trocar o loop/uso direto de `CalendarSyncService` por `autoSync.run(months, { force: true })`, usando `outcome.totals` com `syncSummary`. Mensagens e erros existentes não mudam.
  - `AgendaComponent.shift()` e `goToToday()`: após atualizar a janela, `void this.autoSync.run(monthsInWindow(this.window()))`.
  - `AgendaComponent` (cabeçalho): texto discreto "Atualizado há X" (`syncedAgoLabel(autoSync.lastSyncedAt(), now)`) e "Sincronizando…" enquanto `autoSync.syncing()` for verdadeiro; aviso pequeno com `autoSync.error()` quando houver.
  - `AdminShellComponent`: no construtor, `afterNextRender(() => void inject(AutoSyncService).runOnEntry())` (injetar o serviço como campo).
- [ ] **Step 4: Rodar e ver passar**
  Run: `npx ng test --watch=false --include=src/app/pages/admin/agenda/agenda.component.spec.ts --include=src/app/pages/admin/sessions/sessions.component.spec.ts`
  Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add src/app/pages/admin
  git commit -m "feat(admin): sincroniza a agenda sozinho ao abrir e ao trocar de semana"
  ```

---

## Parte B: C1, fila de cobrança

### Task 5: Lógica pura da fila e do link

**Files:**
- Modify: `domain/charge-message.ts`, `domain/charge-message.spec.ts`
- Create: `domain/charge-doc.ts`, `domain/charge-queue.ts`
- Test: `domain/charge-queue.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  // charge-message.ts
  export function whatsappLink(phone: string, text: string): string | null; // null se telefone inválido ou texto vazio
  // charge-doc.ts
  export interface Charge { patientId: string; month: string; chargedAt: Date; amount: number; }
  export function chargeId(patientId: string, month: string): string;       // `${patientId}_${month}`
  export function chargeToDoc(patientId: string, month: string, amount: number, chargedAt: Date): { patientId: string; month: string; chargedAt: Date; amount: number };
  export function chargeFromDoc(data: Record<string, any>): Charge;          // aceita Timestamp (.toDate) ou Date
  // charge-queue.ts
  export const CHARGE_COOLDOWN_DAYS = 7;
  export interface ChargeQueueItem { patientId: string; name: string; phone: string; totalCents: number; chargedAt: Date | null; recentlyCharged: boolean; }
  export interface ChargeQueue { items: ChargeQueueItem[]; invalidPhone: Array<{ patientId: string; name: string }>; }
  export function buildChargeQueue(input: {
    lines: PatientMonthLine[]; patients: ReadonlyMap<string, Patient>;
    charges: ReadonlyMap<string, Date>; hasLinkedSessions: boolean; now: Date;
  }): ChargeQueue;
  ```
- `whatsappChargeUrl` passa a delegar para `whatsappLink(phone, chargeMessage(...))`, mantendo o comportamento e os testes atuais.

- [ ] **Step 1: Escrever os testes que falham**
  - `charge-message.spec.ts`: `whatsappLink` monta `https://wa.me/5511988887777?text=<encoded>` e devolve `null` para telefone inválido e para texto vazio/só espaços.
  - `charge-queue.spec.ts` (linhas `PatientMonthLine` montadas à mão):
    - `entra só quem tem atraso e total é toReceive + overdue`.
    - `fora da fila: mês sem sessões vinculadas, paciente removido (não está no mapa)` (Review Focus).
    - `telefone inválido sai da fila e vai para invalidPhone` (Review Focus).
    - `ordem: nunca cobradas, depois a cobrança mais antiga, depois maior valor, desempate por nome`.
    - `cobrada há menos de 7 dias vira recentlyCharged e vai para o fim; 7 dias exatos volta a ser pendente`.
  - `charge-doc.spec.ts` (mesmo arquivo da queue ou separado): `chargeId('p1','2026-11')` é `'p1_2026-11'`; `chargeFromDoc` converte objeto com `toDate()` e `Date` puro.
- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx ng test --watch=false --include=src/app/pages/admin/domain/charge-queue.spec.ts --include=src/app/pages/admin/domain/charge-message.spec.ts`
  Expected: FAIL.
- [ ] **Step 3: Implementar** os três arquivos conforme as assinaturas. Ordenação: `recentlyCharged` falso antes; `chargedAt === null` antes; `chargedAt` crescente; `totalCents` decrescente; `name.localeCompare`.
- [ ] **Step 4: Rodar e ver passar** (mesmo comando). Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add src/app/pages/admin/domain
  git commit -m "feat(admin): logica da fila de cobranca e link de WhatsApp com texto livre"
  ```

### Task 6: `ChargesService`

**Files:**
- Create: `data/charges.service.ts`

**Interfaces:**
- Consumes: `chargeId`, `chargeToDoc`, `chargeFromDoc` (Task 5); `runWrite` (`data/safe-write.ts`); `FIRESTORE`.
- Produces:
  ```ts
  export interface ChargesWatch { readonly month: string; readonly charges: Signal<ReadonlyMap<string, Date>>; readonly loaded: Signal<boolean>; readonly error: Signal<string | null>; }
  @Injectable({ providedIn: 'root' }) export class ChargesService {
    watchMonth(month: string): ChargesWatch;   // idempotente para o mesmo mês; troca de mês encerra o listener anterior (mesmo padrão de CalendarSyncsService.watchMonth). Mapa patientId → chargedAt.
    markCharged(patientId: string, month: string, amount: number): Promise<void>; // setDoc(charges/{chargeId}) via runWrite, chargedAt = new Date()
  }
  ```
  Consulta: `query(collection(db, 'charges'), where('month', '==', month))`. Mensagem de erro de leitura: `'Não foi possível carregar as cobranças.'`.

Sem spec próprio de Firestore (mesma convenção de `payments.service.ts`); o comportamento é coberto pelos specs de componentes com fake.

- [ ] **Step 1: Implementar** `charges.service.ts`.
- [ ] **Step 2: Compilar**
  Run: `npx ng build --configuration development`
  Expected: sem erros de tipo.
- [ ] **Step 3: Commit**
  ```bash
  git add src/app/pages/admin/data/charges.service.ts
  git commit -m "feat(admin): servico de cobrancas registradas"
  ```

### Task 7: Tela `CobrancaComponent`, rota e menu

**Files:**
- Create: `cobranca/cobranca.component.ts`
- Test: `cobranca/cobranca.component.spec.ts`
- Modify: `admin.routes.ts` (rota `cobranca`, `loadComponent`), `admin-shell.component.ts` (item `{ path: '/admin/cobranca', label: 'Cobrança' }` depois de Financeiro)

**Interfaces:**
- Consumes: `buildChargeQueue`, `whatsappLink`, `chargeMessage`, `ChargesService`, `buildLedger`/`summarizeMonth` (`domain/finance.ts`), `SessionsService.watchAll`, `PatientsService`, `PaymentsService`, `MonthPickerComponent`, `isValidMonth`, `currentMonth`.
- Produces (superfície testável do componente): `month: WritableSignal<string>` (inicial: `?mes=` válido ou `currentMonth(new Date())`), `queue` (computed), `pending` (itens não recentes e não pulados), `current` (primeiro de `pending` ou `null`), `awaitingId: WritableSignal<string | null>`, `saving: WritableSignal<boolean>`, `error: WritableSignal<string | null>`, `textFor(item)`, `setDraft(id, text)`, `onOpened(item)`, `confirmCharged(item): Promise<void>`, `skip(item)`.
- Comportamento:
  - Cartão da paciente atual: nome, total (`formatCents`), `<textarea>` com `textFor(item)` (padrão `chargeMessage(name, totalCents)`), link **Abrir WhatsApp** (`<a [href]="whatsappLink(phone, text)" target="_blank" rel="noopener noreferrer" (click)="onOpened(item)">`).
  - Depois de `onOpened`, o cartão mostra "Enviou a mensagem?" com **Sim, marcar como cobrada** e **Pular**.
  - `confirmCharged`: ignora se `saving()`; `markCharged(patientId, month, totalCents)`; erro → `error` com a mensagem e o botão continua disponível; sucesso → limpa `awaitingId`.
  - `pending` vazio → "Fila concluída". Lista "Cobradas há menos de 7 dias" (nome e `dd/mm`) para `recentlyCharged`. Nota "Telefone inválido. Corrija em Pacientes." para `invalidPhone`.

- [ ] **Step 1: Escrever os testes que falham** (fakes de Sessions/Patients/Payments como em `finance.component.spec.ts`; fake de `ChargesService` com `watchMonth` e `markCharged` espiável):
  - `mostra a primeira paciente com atraso e a mensagem pronta no textarea`.
  - `Abrir WhatsApp aponta para wa.me com o texto editado` (alterar via `setDraft`; `href` contém `encodeURIComponent` do novo texto).
  - `só pergunta "Enviou a mensagem?" depois de abrir o WhatsApp`.
  - `Sim, marcar como cobrada grava uma vez com o total e avança`.
  - `clique duplo em marcar grava uma única vez` (Review Focus; `markCharged` é promessa pendente, segundo `confirmCharged` retorna sem chamar).
  - `falha ao gravar mostra o erro e permite tentar de novo` (nada some da fila).
  - `Pular tira a paciente do passo a passo sem gravar`.
  - `sem pendentes mostra "Fila concluída"` e lista as cobradas recentemente.
- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx ng test --watch=false --include=src/app/pages/admin/cobranca/cobranca.component.spec.ts`
  Expected: FAIL (componente não existe).
- [ ] **Step 3: Implementar** o componente, a rota e o item de menu. Estilo e classes seguem `finance.component.ts` / `agenda.component.ts` (cartão `z-card`, botões `z-button`, alertas `z-alert`).
- [ ] **Step 4: Rodar e ver passar** (mesmo comando). Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add src/app/pages/admin
  git commit -m "feat(admin): tela de fila de cobranca"
  ```

### Task 8: Financeiro mostra quem já foi cobrada

**Files:**
- Modify: `financeiro/finance.component.ts`, `financeiro/finance.component.spec.ts`

**Interfaces:**
- Consumes: `ChargesService.watchMonth(month)`.
- Produces: em cada linha, `chargedAt: Date | null`; selo "Cobrada em dd/mm" (data em UTC-3, formato `dd/mm`) ao lado dos botões; botão **Cobrar em fila** no cabeçalho (`routerLink="/admin/cobranca" [queryParams]="{ mes: month() }"`).

- [ ] **Step 1: Escrever os testes que falham** em `finance.component.spec.ts` (adicionar fake de `ChargesService` ao `providers`, com mapa `p1 → 2026-11-20T15:00:00Z`):
  - `mostra o selo "Cobrada em 20/11" na linha de quem foi cobrada`.
  - `não mostra selo para quem nunca foi cobrada`.
  - `o botão Cobrar em fila leva para /admin/cobranca com o mês escolhido`.
  - Os testes existentes continuam passando.
- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx ng test --watch=false --include=src/app/pages/admin/financeiro/finance.component.spec.ts`
  Expected: FAIL (novos testes).
- [ ] **Step 3: Implementar** no `rows` computed e no template. Reaproveitar `dateKeyOf` para montar `dd/mm`.
- [ ] **Step 4: Rodar e ver passar** (mesmo comando). Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add src/app/pages/admin/financeiro
  git commit -m "feat(admin): financeiro mostra cobrancas feitas e atalho para a fila"
  ```

---

## Parte C: Fechamento

### Task 9: Documentação e verificação final

**Files:**
- Modify: `README.md` (seção "Área de Gestão": rota `/admin/cobranca` na tabela de rotas; subseção "O que a Fase 5 entrega" com S1 e C1, e a limitação "só a última cobrança do mês é guardada").
- Modify: `docs/andruia/tareas.md` (marcar T15 como parcialmente atendido: mensagem editável feita; texto salvo fora de escopo).

- [ ] **Step 1: Atualizar README e `tareas.md`.**
- [ ] **Step 2: Rodar toda a suíte do frontend**
  Run: `npx ng test --watch=false`
  Expected: todos os testes passam.
- [ ] **Step 3: Rodar a suíte do backend (não deve mudar)**
  Run: `cd server && npm test`
  Expected: todos os testes passam.
- [ ] **Step 4: Build de produção**
  Run: `npx ng build`
  Expected: build sem erros (avisos antigos de budget de CSS do story são esperados).
- [ ] **Step 5: Verificação manual no navegador** (`cd server && npm start` e `npm start` em outro terminal; entrar em `/admin`):
  - Abrir `/admin`: a rede mostra chamadas a `sync-calendar` para o mês atual e o próximo; recarregar logo em seguida **não** repete (menos de 6 h).
  - Agenda mostra "Atualizado há …"; trocar de semana para outro mês checa sem sincronizar de novo.
  - `/admin/cobranca`: editar texto, "Abrir WhatsApp", "Sim, marcar como cobrada"; o Financeiro mostra "Cobrada em dd/mm".
- [ ] **Step 6: Commit**
  ```bash
  git add README.md docs
  git commit -m "docs: documenta sincronizacao automatica e fila de cobranca"
  ```
