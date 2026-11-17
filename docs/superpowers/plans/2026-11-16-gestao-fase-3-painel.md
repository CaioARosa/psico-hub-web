# Gestão do Consultório — Fase 3 (Painel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a tela `/admin/painel` com contagens do mês, Recebido e Devido, previsto × realizado, gráfico dos últimos 6 meses e alertas de frequência, depois de atualizar o projeto para o Angular 22.

**Architecture:** Uma função pura nova (`domain/dashboard.ts`) calcula tudo a partir do `Ledger` da Fase 2, de pacientes e de sessões; a tela só exibe o resultado. O gráfico fica isolado em um componente próprio (`RevenueChartComponent`, `chart.js` + `ng2-charts@11`), com os dados e as opções em módulo puro testável. Nenhum campo, coleção ou regra de Firestore novo.

**Tech Stack:** Angular 22 (standalone, signals), TypeScript 6.0, Tailwind v4, Zard UI, Vitest (`ng test`), `chart.js@4`, `ng2-charts@11`.

**Spec:** `docs/superpowers/specs/2026-11-16-gestao-fase-3-painel-design.md` (usa o cálculo de `2026-11-13-gestao-fase-2-financeiro-design.md`).

## Pré-requisitos

- Árvore de trabalho limpa na `main` (trabalho direto na `main` já autorizado nas fases anteriores).
- Node local compatível com o Angular 22: `^22.22.3 || ^24.15.0 || >=26.0.0` (o ambiente atual tem v24.21.0).

## Global Constraints

- Valores monetários em **centavos inteiros**, moeda BRL; formatação só com `formatCents` (spec §7). Conversão para reais existe apenas nos números entregues ao Chart.js.
- Mês = `YYYY-MM` em **UTC-3 fixo** (`currentMonth`, `monthWindow` de `domain/month.ts`); `now` é parâmetro de `buildDashboard` para os testes não dependerem do relógio (spec §3).
- Sessões com `patientId = null` ficam fora de **todos** os números (spec §3).
- Previsto e alertas consideram só pacientes **ativos** com `sessionsPerMonth > 0` (spec §3).
- Alerta de frequência: mês corrente ou futuro → `done + scheduled` (sem `missingFromCalendar`); mês passado → só `done` (spec §3).
- Nenhuma coleção ou campo novo; `firestore.rules` não muda (spec §2).
- Rota padrão do `/admin` continua `sessoes`; "Painel" é o primeiro item do menu (spec §4).
- `chart.js` e `ng2-charts` carregados só pelo `PainelComponent` (já sob demanda); páginas públicas não ganham peso (spec §1, §4).
- Frontend: componentes standalone com `ChangeDetectionStrategy.OnPush`, signals, `inject()`, rotas com `loadComponent`, alias `@/*` → `src/app/*`, estilo Tailwind/Zard como `finance.component.ts`; textos em português do Brasil.
- Cores do gráfico: `#4D6D66` (Recebido) e `#D4E6E1` (Devido) (spec §4).
- Commits em inglês, estilo convencional (`feat(admin): ...`).
- Comando de um spec isolado: `npx ng test --watch=false --include "<caminho do spec>"`; suíte completa: `npx ng test --watch=false`.

## Review Focus

Entradas que o spec implica, mas nenhuma task testaria por conta própria (cada uma tem seu teste na task indicada):

1. **Sessão às 23:30 do último dia do mês (UTC-3)**, por exemplo `2026-12-01T02:30:00Z`, conta em novembro, não em dezembro (Task 2).
2. **Sessão `scheduled` com `missingFromCalendar = true`** não entra na contagem do alerta (Task 3).
3. **Paciente inativo ou com `sessionsPerMonth` 0** nunca gera alerta nem entra no previsto, mas as `done` dele contam nos atendidos (Tasks 2 e 3).
4. **Mês só com sessões sem paciente:** nenhum zero apresentado como "quitado"; Devido e Realizado viram traço, Recebido continua (Task 5).
5. **Série do gráfico atravessando o ano** (`2027-02` → `2026-09 … 2027-02`) e **mês sem movimento** com barra zero, sem omitir o mês (Tasks 2 e 4).

---

## File Structure

**Frontend (`src/app/pages/admin/`)**
- `domain/month.ts` — ganha `shiftMonth` e `monthLabel` (edição)
- `domain/dashboard.ts` — `buildDashboard` e tipos (novo)
- `painel/revenue-chart-data.ts` — dados e opções do gráfico, puros (novo)
- `painel/revenue-chart.component.ts` — wrapper do `ng2-charts` (novo)
- `painel/dashboard.component.ts` — a tela (novo)
- `admin.routes.ts`, `admin-shell.component.ts` — rota e menu (edição)
- `*.spec.ts` ao lado de cada módulo novo

**Raiz**
- `package.json`, `package-lock.json`, `tsconfig*.json` — Angular 22 e dependências do gráfico (edição)
- `README.md` — versão do Angular, rota, seção "O que a Fase 3 entrega" (edição)

---

### Task 1: Atualizar o projeto para o Angular 22

**Files:**
- Modify: `package.json`, `package-lock.json`, `tsconfig.json` / `tsconfig.app.json` / `tsconfig.spec.json`, `angular.json` (apenas o que o `ng update` e o TypeScript 6 exigirem), código em `src/` que o compilador novo rejeitar
- Modify: `README.md:49` (versão do Angular)

**Interfaces:**
- Produces: projeto em `@angular/*` 22.x, `@angular/cdk` 22.x e `typescript` `>=6.0 <6.1`, com `ng build` e `ng test` verdes. As tasks seguintes assumem isso; o `ng2-charts@11` exige `@angular/cdk >=22`.

- [ ] **Step 1: Registrar a linha de base**

Run: `git status --short` → saída vazia. Depois `node --version` → deve atender a `^22.22.3 || ^24.15.0 || >=26`. Depois `npx ng test --watch=false` e `npx ng build`.
Expected: tudo verde no Angular 21 (anote o nº de testes passando para comparar no fim).

- [ ] **Step 2: Rodar a atualização**

Run: `npx ng update @angular/core@22 @angular/cli@22` e aceitar as migrações sugeridas. Se o comando não subir `@angular/cdk` e `typescript`, rodar `npm install @angular/cdk@^22 "typescript@~6.0.0"`. O `@angular/build@22` pede `typescript >=6.0 <6.1`.
Expected: `npm ls @angular/core @angular/cdk @angular/cli @angular/build typescript` mostra todos em 22.x (TypeScript 6.0.x), sem `invalid`/`UNMET`.

- [ ] **Step 3: Fazer o build e a suíte passarem**

Run: `npx ng build` e `npx ng test --watch=false`; corrigir somente o que a atualização quebrou (erros de TypeScript 6, opções de `tsconfig` removidas, APIs renomeadas, componentes Zard sob `src/app/shared/components` que dependam de API do CDK alterada). Não refatorar nada além disso.
Expected: `ng build` sem erros; `ng test` com o mesmo nº de testes da linha de base, todos passando.

- [ ] **Step 4: Atualizar a versão no README**

Em `README.md:49`, trocar `Angular 21.2+` por `Angular 22+`.

- [ ] **Step 5: Commit**

```bash
git status --short
git add -A
git commit -m "build: upgrade Angular to 22"
```

**Gatilho do plano B (spec §6):** se não ficar verde após três tentativas de correção, **parar**, listar o erro e a suposição duvidosa e avisar o usuário antes de qualquer outra ação. O plano B é ficar no Angular 21 e usar `ng2-charts@10` na Task 4; descartar as mudanças da Task 1 só depois da confirmação do usuário.

---

### Task 2: Domínio do painel — contagens, valores e série

**Files:**
- Modify: `src/app/pages/admin/domain/month.ts`
- Create: `src/app/pages/admin/domain/dashboard.ts`
- Test: `src/app/pages/admin/domain/month.spec.ts`, `src/app/pages/admin/domain/dashboard.spec.ts`

**Interfaces:**
- Consumes: `buildLedger`, `summarizeMonth`, `Ledger` de `domain/finance.ts`; `currentMonth` de `domain/month.ts`; `Patient`, `Session` de `domain/models.ts`.
- Produces, em `domain/month.ts`:
  - `shiftMonth(month: string, delta: number): string` — soma `delta` meses a um `YYYY-MM`; lança para mês inválido, como `monthWindow`.
  - `monthLabel(month: string): string` — `'2026-11'` → `'nov/26'`; abreviações fixas `jan fev mar abr mai jun jul ago set out nov dez` (não usar `Intl`, que varia com o ICU); lança para mês inválido.
- Produces, em `domain/dashboard.ts`:

```ts
export interface FrequencyAlert {
  patientId: string;
  name: string;
  contracted: number;
  counted: number;
  /** counted − contracted: negativo = falta, positivo = sobra. */
  difference: number;
}
export interface DashboardPoint { month: string; received: number; due: number }
export interface Dashboard {
  month: string;
  patientsAttended: number;
  done: number;
  noShow: number;
  cancelled: number;
  received: number;
  due: number;
  expected: number;
  hasSessions: boolean;
  hasLinkedSessions: boolean;
  unlinkedSessions: number;
  /** true quando o mês é o corrente ou futuro (o alerta conta `done + scheduled`). */
  countsScheduled: boolean;
  alerts: FrequencyAlert[];
  series: DashboardPoint[];
}
export function buildDashboard(input: {
  ledger: Ledger; patients: Patient[]; sessions: Session[]; month: string; now: Date;
}): Dashboard
```

Nesta task `alerts` é sempre `[]` (a Task 3 o preenche).

- [ ] **Step 1: Write the failing tests de `month.ts`**

Em `month.spec.ts`, novos `describe`:
- `shiftMonth`: `shiftMonth('2026-11', 1) === '2026-12'`; `shiftMonth('2026-12', 1) === '2027-01'`; `shiftMonth('2026-01', -1) === '2025-12'`; `shiftMonth('2026-11', -5) === '2026-06'`; `shiftMonth('2026-11', 0) === '2026-11'`; lança para `''`, `'2026-13'`, `'novembro'`.
- `monthLabel`: `'2026-11'` → `'nov/26'`; `'2027-01'` → `'jan/27'`; `'2026-09'` → `'set/26'`; lança para `'2026-13'`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx ng test --watch=false --include "src/app/pages/admin/domain/month.spec.ts"`
Expected: FAIL (`shiftMonth`/`monthLabel` não exportados).

- [ ] **Step 3: Implement `shiftMonth` and `monthLabel` in `domain/month.ts`**

Reusar a validação `MONTH` existente e a mesma mensagem de erro de `monthWindow`. `shiftMonth` converte para índice de mês absoluto (`ano * 12 + mês − 1`) e volta.

- [ ] **Step 4: Run to verify they pass**

Run: o mesmo comando do Step 2. Expected: PASS.

- [ ] **Step 5: Write the failing tests de `buildDashboard`**

Em `dashboard.spec.ts`, com helpers `patient`, `session`, `payment` no estilo de `finance.spec.ts` e `now = new Date('2026-11-17T15:00:00Z')`. Cenário base de `2026-11`: Ana (`per_session` 15000, 4/mês, `chargeNoShow: false`, ativa); Bruno (`monthly_package` 60000, 4/mês, ativo); Carla (`per_session` 10000, 4/mês, **inativa**). Sessões de novembro: Ana 2 `done` (`amountApplied` 15000), 1 `no_show`, 1 `cancelled`; Bruno 1 `done` (`packageAmountApplied` 60000, `amountApplied` 0); Carla 1 `done` (10000); 1 `done` sem paciente. Pix: Ana 15000 em `2026-11`.
- `conta atendidos distintos e status só de sessões com paciente`: `patientsAttended === 3` (Ana, Bruno e Carla; inativa conta), `done === 4`, `noShow === 1`, `cancelled === 1`.
- `Recebido e Devido vêm do resumo do mês`: `received === 15000`; `due === 100000` (Ana 30000 + Bruno 60000 + Carla 10000); ambos iguais a `summarizeMonth(ledger, '2026-11').totals.received/.due`.
- `previsto soma só pacientes ativos`: `expected === 120000` (Ana 4×15000 + Bruno 60000; Carla fora).
- `paciente com sessionsPerMonth 0 não entra no previsto`: com Ana em `sessionsPerMonth: 0`, `expected === 60000`.
- `sessão às 23:30 do último dia (UTC-3) conta no mês anterior`: sessão `done` em `2026-12-01T02:30:00Z` entra em `month: '2026-11'` e não em `'2026-12'`.
- `flags de sessões`: mês sem nenhuma sessão → `hasSessions === false`; mês só com sessão sem paciente → `hasSessions === true`, `hasLinkedSessions === false`, `unlinkedSessions === 1`.
- `countsScheduled`: `true` para `'2026-11'` (corrente) e `'2026-12'` (futuro); `false` para `'2026-10'`.
- `série dos 6 meses termina no mês selecionado`: para `'2026-11'` os meses são `['2026-06','2026-07','2026-08','2026-09','2026-10','2026-11']`; o último ponto é `{ month: '2026-11', received: 15000, due: 100000 }`.
- `série atravessa o ano e mantém meses sem movimento`: para `'2027-02'` os meses são `['2026-09','2026-10','2026-11','2026-12','2027-01','2027-02']`; `'2027-01'` e `'2027-02'` com `received: 0` e `due: 0`.
- `alerts é lista vazia nesta etapa`: `alerts` igual a `[]` (substituído pelos testes da Task 3).

- [ ] **Step 6: Run to verify they fail**

Run: `npx ng test --watch=false --include "src/app/pages/admin/domain/dashboard.spec.ts"`
Expected: FAIL (módulo `./dashboard` inexistente).

- [ ] **Step 7: Implement `buildDashboard` in `domain/dashboard.ts`**

Filtrar `sessions` para `patientId !== null` e `currentMonth(startsAt) === month` antes de contar. `received`/`due` e as flags (`hasSessions`, `hasLinkedSessions`, `unlinkedSessions`) vêm direto de `summarizeMonth(ledger, month)`. `expected`: ver a regra da tabela do spec §3. A série usa `shiftMonth(month, −5 … 0)` e `summarizeMonth` por mês. `countsScheduled = month >= currentMonth(now)` (comparação de strings `YYYY-MM`). `alerts: []`.

- [ ] **Step 8: Run to verify they pass**

Run: o comando do Step 6. Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app/pages/admin/domain/month.ts src/app/pages/admin/domain/month.spec.ts src/app/pages/admin/domain/dashboard.ts src/app/pages/admin/domain/dashboard.spec.ts
git commit -m "feat(admin): add dashboard calculation"
```

---

### Task 3: Domínio do painel — alertas de frequência

**Files:**
- Modify: `src/app/pages/admin/domain/dashboard.ts`
- Test: `src/app/pages/admin/domain/dashboard.spec.ts`

**Interfaces:**
- Consumes: `buildDashboard`, `FrequencyAlert`, `Dashboard.countsScheduled` da Task 2.
- Produces: `Dashboard.alerts` preenchido, ordenado por `name` (`localeCompare` com `'pt-BR'`, desempate por `patientId`).

- [ ] **Step 1: Write the failing tests**

Em `dashboard.spec.ts`, mesmo cenário e `now = 2026-11-17T15:00:00Z`; remover o teste `alerts é lista vazia nesta etapa`. Ana: 4/mês, ativa; Bruno: 4/mês, ativo.
- `mês corrente conta realizadas + agendadas e aponta falta`: Ana com 2 `done` + 1 `scheduled` em novembro → alerta `{ patientId: 'p1', name: 'Ana', contracted: 4, counted: 3, difference: -1 }`.
- `aponta sobra`: Bruno com 5 `done` em novembro → `{ contracted: 4, counted: 5, difference: 1 }`.
- `sem alerta quando bate`: Ana com 3 `done` + 1 `scheduled` → `alerts` vazio.
- `agendada ausente do Agenda não conta`: Ana com 3 `done` + 1 `scheduled` com `missingFromCalendar: true` → `counted: 3`, alerta de falta 1.
- `faltou e cancelada não contam`: Ana com 2 `done` + 1 `no_show` + 1 `cancelled` → `counted: 2`, `difference: -2`.
- `mês passado conta só realizadas`: `month: '2026-10'`, Ana com 3 `done` + 1 `scheduled` em outubro → `counted: 3`, `difference: -1`.
- `mês futuro conta realizadas + agendadas`: `month: '2026-12'`, Ana com 4 `scheduled` → `alerts` vazio; com 3 `scheduled` → falta 1.
- `inativo não gera alerta`: Carla inativa com 1 `done` → sem alerta para Carla.
- `sessionsPerMonth 0 não gera alerta`: paciente ativo com `sessionsPerMonth: 0` e 2 `done` → sem alerta.
- `sessão sem paciente não conta para ninguém`.
- `paciente ativo sem nenhuma sessão no mês` com `sessionsPerMonth: 4` → alerta `counted: 0`, `difference: -4`.
- `ordena por nome em pt-BR`: Ana, Álvaro, Bruno com falta → ordem `Álvaro, Ana, Bruno`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx ng test --watch=false --include "src/app/pages/admin/domain/dashboard.spec.ts"`
Expected: FAIL (`alerts` vem vazio).

- [ ] **Step 3: Implement the alerts in `buildDashboard`**

Para cada paciente `active` com `agreement.sessionsPerMonth > 0`, contar as sessões do mês dele: `done`, mais `scheduled` com `missingFromCalendar === false` quando `countsScheduled`. Gerar alerta se `counted !== contracted`. Ordenar como descrito em Interfaces.

- [ ] **Step 4: Run to verify they pass**

Run: o comando do Step 2. Expected: PASS (todos os testes de `dashboard.spec.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/domain/dashboard.ts src/app/pages/admin/domain/dashboard.spec.ts
git commit -m "feat(admin): add frequency alerts to dashboard"
```

---

### Task 4: Gráfico de Recebido × Devido

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/app/pages/admin/painel/revenue-chart-data.ts`, `src/app/pages/admin/painel/revenue-chart.component.ts`
- Test: `src/app/pages/admin/painel/revenue-chart-data.spec.ts`

**Interfaces:**
- Consumes: `DashboardPoint` (Task 2), `monthLabel` (Task 2), `formatCents` de `domain/money.ts`.
- Produces:
  - `revenueChartData(series: DashboardPoint[]): ChartData<'bar'>` — `labels` = `monthLabel` de cada ponto; dois datasets, na ordem `Recebido` (`#4D6D66`) e `Devido` (`#D4E6E1`), com `data` em **reais** (`cents / 100`).
  - `revenueChartOptions(): ChartOptions<'bar'>` — responsivo, eixo Y com `beginAtZero` e `ticks.callback` formatando com `formatCents(valor * 100)`, tooltip `callbacks.label` no formato `"Recebido: R$ 150,00"`.
  - `revenueChartLabel(series: DashboardPoint[]): string` — texto de `aria-label`: `"Gráfico de barras com o recebido e o devido de nov/26 a dez/26"` (primeiro e último rótulo; para série vazia, `"Gráfico de barras sem dados"`).
  - `RevenueChartComponent` (`app-revenue-chart`): `series = input.required<DashboardPoint[]>()`; renderiza um `<canvas baseChart type="bar" role="img">` com `aria-label` vindo de `revenueChartLabel`.

- [ ] **Step 1: Install the dependencies**

Run: `npm install chart.js@^4.6 ng2-charts@^11`
Expected: instala sem aviso de peer dependency (`npm ls ng2-charts chart.js` sem `invalid`). Se houver conflito de peer com o Angular, **parar** e avisar (Task 1 deve ter deixado `@angular/*` e `@angular/cdk` em 22).

- [ ] **Step 2: Write the failing tests**

Em `revenue-chart-data.spec.ts`, com série `[{ month: '2026-10', received: 0, due: 15000 }, { month: '2026-11', received: 15000, due: 100000 }]`:
- `usa rótulos curtos de mês`: `labels` igual a `['out/26', 'nov/26']`.
- `converte centavos para reais e mantém a ordem Recebido, Devido`: `datasets[0].label === 'Recebido'`, `data` `[0, 150]`; `datasets[1].label === 'Devido'`, `data` `[150, 1000]`.
- `usa as cores da paleta`: `datasets[0].backgroundColor === '#4D6D66'`, `datasets[1].backgroundColor === '#D4E6E1'`.
- `mês sem movimento fica com barra zero`: ponto `{ month: '2027-01', received: 0, due: 0 }` → `data` `[0]` nos dois datasets.
- `tooltip e eixo Y formatam em reais`: o `label` do tooltip para `{ dataset: { label: 'Recebido' }, parsed: { y: 150 } }` normalizado (espaços) é `'Recebido: R$ 150,00'`; `ticks.callback(150)` normalizado é `'R$ 150,00'`.
- `aria-label cita o primeiro e o último mês`: `'Gráfico de barras com o recebido e o devido de out/26 a nov/26'`; série vazia → `'Gráfico de barras sem dados'`.

- [ ] **Step 3: Run to verify they fail**

Run: `npx ng test --watch=false --include "src/app/pages/admin/painel/revenue-chart-data.spec.ts"`
Expected: FAIL (módulo inexistente).

- [ ] **Step 4: Implement `revenue-chart-data.ts`**

Importar só tipos de `chart.js` (`import type { ChartData, ChartOptions } from 'chart.js'`), para o módulo puro não carregar o Chart.js nos testes.

- [ ] **Step 5: Run to verify they pass**

Run: o comando do Step 3. Expected: PASS.

- [ ] **Step 6: Implement `RevenueChartComponent`**

Standalone, `OnPush`. Registrar **somente** `BarController`, `BarElement`, `CategoryScale`, `LinearScale`, `Legend` e `Tooltip` de `chart.js`, usando a API de registro do `ng2-charts` instalado (ler os tipos de `node_modules/ng2-charts`; não usar `withDefaultRegisterables`, para o bundle ficar enxuto), no `providers` do próprio componente. Dados e opções vêm de `revenueChartData(series())` e `revenueChartOptions()`. Este componente não tem teste unitário: o jsdom não renderiza `canvas`; o `DashboardComponent` o substitui por um stub nos testes (Task 5).

- [ ] **Step 7: Verify the build**

Run: `npx ng build`
Expected: sem erros (o componente ainda não é usado por nenhuma rota; o build só confirma que compila).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/app/pages/admin/painel/revenue-chart-data.ts src/app/pages/admin/painel/revenue-chart-data.spec.ts src/app/pages/admin/painel/revenue-chart.component.ts
git commit -m "feat(admin): add revenue chart component"
```

---

### Task 5: Tela Painel, rota e menu

**Files:**
- Create: `src/app/pages/admin/painel/dashboard.component.ts`
- Modify: `src/app/pages/admin/admin.routes.ts`, `src/app/pages/admin/admin-shell.component.ts`
- Test: `src/app/pages/admin/painel/dashboard.component.spec.ts`

**Interfaces:**
- Consumes: `buildDashboard`, `buildLedger`, `Dashboard` (Tasks 2 e 3); `RevenueChartComponent` (Task 4); `monthLabel`; `PatientsService`, `PaymentsService`, `SessionsService.watchAll()`; `currentMonth`, `isValidMonth`, `formatCents`.
- Produces: `DashboardComponent` (`app-admin-dashboard`, rota `/admin/painel`) com:
  - `month = signal(currentMonth(new Date()))` e `setMonth(value: string): void` (mesmo comportamento do `FinanceComponent`: mês inválido restaura o valor do `<input id="dashboard-month" type="month">`, mês igual não faz nada);
  - `ready`, `loadError`, `ledger` e `dashboard` como `computed`.

Estrutura da tela (ordem e textos exatos):
- `<h1>` "Painel" e o seletor de mês (rótulo "Mês").
- Erro: `<p role="alert">` com a mensagem; carregando: "Carregando painel...".
- Avisos: `!hasSessions` → "Sincronize a agenda deste mês para ver o devido."; `unlinkedSessions > 0` → a mesma nota do Financeiro ("1 sessão sem paciente neste mês. Vincule-a na tela Sessões para entrar no cálculo." / "N sessões sem paciente neste mês. Vincule-as na tela Sessões para entrarem no cálculo.").
- Cartões em `<dl>` com `<dt>` exatos: `Pacientes atendidos`, `Realizadas`, `Faltas`, `Cancelamentos`, `Recebido`, `Devido`, `Previsto (acordos atuais)`. `Devido` mostra `—` quando `!hasLinkedSessions`; `Recebido` e `Previsto (acordos atuais)` sempre mostram valor.
- Bloco "Previsto × Realizado": `Realizado` (= `due`, ou `—` sem sessões vinculadas) ao lado de `Previsto`, com uma barra simples de largura `min(100, due/expected)` (só visual, `aria-hidden`); sem barra quando `—` ou `expected === 0`.
- Gráfico: `<app-revenue-chart [series]="dashboard().series">` e, ao lado, `<table class="sr-only">` com `<caption>` "Recebido e devido nos últimos 6 meses" e uma linha por ponto (`monthLabel`, Recebido, Devido).
- Alertas de frequência: `<ul>` com uma linha por alerta, `"{nome}: contratado {contracted}, {previstas|realizadas} {counted} (falta {n}|sobra {n})"` (`previstas` quando `countsScheduled`, senão `realizadas`); sem alertas: "Nenhum alerta de frequência neste mês".

- [ ] **Step 1: Write the failing tests**

Em `dashboard.component.spec.ts`, mesmo esquema de fakes e helpers de `finance.component.spec.ts` (`fakeSessions` com `watchAll`, `fakePatients`, `fakePayments`, `provideRouter([])`, `cardValue` por `<dt>`, `openMonth`), mais o stub do gráfico: `TestBed.overrideComponent(DashboardComponent, { remove: { imports: [RevenueChartComponent] }, add: { imports: [StubChartComponent] } })`, com `StubChartComponent` de seletor `app-revenue-chart` e `series = input<DashboardPoint[]>()`. Cenário: Ana (per_session 15000, 4/mês, `chargeNoShow: false`), Bruno (pacote 60000, 4/mês); novembro de 2026: Ana com 2 `done` + 1 `scheduled`, Bruno com 1 `done` (`packageAmountApplied` 60000); Pix de Ana de 15000 em `2026-11`; `now` fixo com `vi.useFakeTimers()` em `2026-11-17T15:00:00Z`.
- `mostra os cartões com os valores exatos`: `Pacientes atendidos` `2`, `Realizadas` `3`, `Faltas` `0`, `Cancelamentos` `0`, `Recebido` `money(15000)`, `Devido` `money(90000)`, `Previsto (acordos atuais)` `money(120000)`.
- `Recebido e Devido batem com o Financeiro`: instanciar também `summarizeMonth(buildLedger(...), '2026-11')` e comparar `totals.received`/`totals.due` com os cartões.
- `mostra o previsto × realizado`: o bloco contém `money(90000)` e `money(120000)`.
- `lista os alertas com a contagem do mês corrente`: Ana (2 `done` + 1 `scheduled`) → texto contém `Ana Paula: contratado 4, previstas 3 (falta 1)`; Bruno (1 `done`) → `Bruno Lima: contratado 4, previstas 1 (falta 3)`.
- `mês passado usa "realizadas"`: abrir `2026-10` com Ana com 3 `done` em outubro → `Ana Paula: contratado 4, realizadas 3 (falta 1)`.
- `sem alertas mostra o estado vazio`: com os dois pacientes em 4 sessões → "Nenhum alerta de frequência neste mês".
- `a tabela sr-only repete a série`: contém `nov/26`, `out/26` e `money(15000)` (Recebido de novembro); o stub recebe 6 pontos.
- `mês sem sessões mostra o aviso e não apresenta zero como quitado`: `2026-12` → texto "Sincronize a agenda deste mês para ver o devido." e `Devido` `—`.
- `mês só com sessão sem paciente: Devido e Realizado viram traço, Recebido continua`: `2026-12` com uma sessão `done` sem paciente e um Pix de 50000 em `2026-12` → nota "1 sessão sem paciente neste mês.", sem o aviso de sincronização, `Devido` `—`, `Recebido` `money(50000)`, bloco "Realizado" `—`, `Previsto (acordos atuais)` ainda com valor.
- `mês inválido no seletor volta ao mês da tela`: igual ao do Financeiro, com `#dashboard-month`.
- `trocar o mês recalcula`: `2026-10` muda `Realizadas`.
- `abre no mês atual em UTC-3`: `2026-12-01T02:30Z` abre `2026-11`.
- `mostra carregando e erro`: `sessionsLoaded.set(false)` → "Carregando painel..."; `sessionsError.set('Não foi possível carregar as sessões.')` → `[role="alert"]` com o texto, sem cartões.

- [ ] **Step 2: Run to verify they fail**

Run: `npx ng test --watch=false --include "src/app/pages/admin/painel/dashboard.component.spec.ts"`
Expected: FAIL (componente inexistente).

- [ ] **Step 3: Implement `DashboardComponent`**

Seguir `finance.component.ts` (mesmos listeners, `ready`/`loadError`/`ledger` como `computed`, mesmo `setMonth`, mesmas classes Tailwind de cartões). `dashboard = computed(() => buildDashboard({ ledger, patients, sessions, month: this.month(), now: this.now }))`, com `private readonly now = new Date()` criado no construtor. Importar `RevenueChartComponent` no `imports`.

- [ ] **Step 4: Run to verify they pass**

Run: o comando do Step 2. Expected: PASS.

- [ ] **Step 5: Add the route and the menu item**

Em `admin.routes.ts`, adicionar `painel` (`loadComponent` → `DashboardComponent`) entre os filhos, **sem** mudar o redirect padrão (`sessoes`). Em `admin-shell.component.ts`, adicionar o link "Painel" (`/admin/painel`, mesmas classes dos outros) como **primeiro** item do `nav`.

- [ ] **Step 6: Verify the build and the full suite**

Run: `npx ng build` e `npx ng test --watch=false`.
Expected: build sem erros; suíte inteira verde. Em `ng build`, o `chart.js` deve aparecer só no chunk lazy do painel (conferir na saída: o `main` não cresce com ele).

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/admin/painel/dashboard.component.ts src/app/pages/admin/painel/dashboard.component.spec.ts src/app/pages/admin/admin.routes.ts src/app/pages/admin/admin-shell.component.ts
git commit -m "feat(admin): add dashboard page"
```

---

### Task 6: README e verificação final

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: tudo das Tasks 1 a 5.
- Produces: documentação da Fase 3 e evidência de que a suíte e o build estão verdes.

- [ ] **Step 1: Atualizar o README**

- Na tabela de rotas (`README.md:225-231`), adicionar a linha `| /admin/painel | DashboardComponent | Números do mês, previsto × realizado, gráfico dos últimos 6 meses e alertas de frequência |`.
- Depois da lista "Limitações conhecidas (Fase 2)" (antes de "Configuração Inicial no Firebase / GCP"), adicionar a seção `### O que a Fase 3 entrega` com: os cartões e o significado de cada um; Recebido e Devido (iguais aos do Financeiro); o previsto (acordos atuais, só ativos); o gráfico de 6 meses; a regra dos alertas (`done + scheduled` no mês corrente e futuro, `done` em meses passados, sem `missingFromCalendar`); o aviso de mês sem sessões e o traço sem sessões vinculadas. Fechar com `#### Limitações conhecidas (Fase 3)` com os três itens de spec §8.

- [ ] **Step 2: Verificação final**

Run: `npx ng test --watch=false`, `npx ng build` e `cd server; node --test`.
Expected: os três verdes. A suíte do front tem os testes da linha de base da Task 1 mais os novos; a do backend não foi tocada.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(admin): document dashboard phase"
git status --short
```

Expected: `git status --short` sem saída.

- [ ] **Step 4: Conferência visual (usuário)**

O gráfico não é coberto por teste automatizado (o jsdom não desenha `canvas`). Depois do build, o usuário abre `npm start`, entra em `/admin/painel` e confere: barras Recebido e Devido, rótulos `nov/26`, tooltip em reais e que as páginas públicas não carregam o Chart.js.
