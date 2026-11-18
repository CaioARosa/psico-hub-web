# Gestão do Consultório — Fase 3 (Painel) — Design

Data: 2026-11-16 · Projeto: `psico-hub-web` · Usuária: Lays Coelho (única)

Complementa `2026-11-12-gestao-consultorio-design.md` (spec geral, §6 e §7 "Fase 3") e usa o cálculo de `2026-11-13-gestao-fase-2-financeiro-design.md`. Onde este documento e o spec geral divergirem, **este vale para a Fase 3**; as divergências estão na seção 9.

## 1. Objetivo

Dar à Lays uma tela única (`/admin/painel`) que mostra como o mês está indo: quantos pacientes e sessões, quanto recebeu e quanto devia receber, previsto × realizado, a evolução dos últimos meses e quem está com frequência fora do contratado.

### Decisões acordadas
- **Receita mostra os dois números:** *Recebido* (Pix com `referenceMonth` no mês) e *Devido* (valor das sessões realizadas, pacote incluído). Ambos vêm de `summarizeMonth`, então batem com a tela Financeiro.
- **Gráfico com biblioteca:** `chart.js` + `ng2-charts`, carregados só no `PainelComponent` (já sob demanda). **Atualização 2026-11-17:** substituído pelo componente de gráfico da ZardUI (ECharts via `ngx-echarts`, commit `16eff9b`); `chart.js` e `ng2-charts` foram removidos. O ECharts continua carregado só no painel.
- **Angular 22:** o projeto é atualizado do 21 para o 22 antes do painel (etapa 0), porque o `ng2-charts@11` exige Angular ≥22.
- **Alerta de frequência:** no mês corrente compara `done + scheduled` com o contratado; em meses passados compara só `done`.
- **Cálculo no frontend**, como na Fase 2. Sem agregação no servidor e sem campo novo no Firestore.

### Fora de escopo
- Cobrança por WhatsApp (Fase 4).
- Dados clínicos, recibo, conciliação de Pix (já fora do escopo geral).
- Mudar a rota padrão do `/admin` (continua `sessoes`).

## 2. Modelo de dados

Nenhuma coleção ou campo novo. O painel só lê `patients`, `sessions` e `payments` pelos serviços existentes (`PatientsService`, `SessionsService.watchAll`, `PaymentsService`). `firestore.rules` não muda.

## 3. Regras de cálculo

Funções puras em `src/app/pages/admin/domain/dashboard.ts`, sem acesso ao Firestore. O mês de uma sessão é o de `startsAt` em UTC-3 (`currentMonth`). Sessões com `patientId = null` são ignoradas em todos os números.

Entradas: `Ledger` (de `buildLedger`), pacientes, todas as sessões, mês selecionado `M` e `now`.

| Item | Regra |
| :-- | :-- |
| Pacientes atendidos | Pacientes distintos com ≥1 sessão `done` em `M` (inclui inativos) |
| Realizadas / Faltas / Cancelamentos | Contagem das sessões de `M` com status `done`, `no_show` e `cancelled` |
| Recebido | `summarizeMonth(ledger, M).totals.received` |
| Devido (realizado) | `summarizeMonth(ledger, M).totals.due` |
| Previsto | Soma sobre pacientes **ativos**: `per_session` → `sessionsPerMonth × agreement.amount`; `monthly_package` → `agreement.amount`. Paciente com `sessionsPerMonth` ≤ 0 não entra |
| Alerta de frequência | Só pacientes **ativos** com `sessionsPerMonth > 0`. Contagem: se `M` é o mês corrente ou futuro, `done + scheduled`; se `M` é passado, só `done`. Alerta quando a contagem ≠ `sessionsPerMonth`, com a diferença assinalada ("falta 1", "sobra 2") |
| Série do gráfico | Os 6 meses terminando em `M` (inclusive), do mais antigo ao mais novo: `{ month, received, due }` por mês, usando `summarizeMonth` em cada um. Meses sem movimento aparecem com zero |

Notas:
- "Mês corrente" é `currentMonth(now)`; `now` entra como parâmetro para os testes não dependerem do relógio.
- Previsto usa o acordo **atual** do paciente (não há histórico de acordo). Para meses passados isso é aproximação; a tela rotula o cartão como "Previsto (acordos atuais)".
- Sessão `scheduled` com `missingFromCalendar = true` não conta no alerta do mês corrente.

## 4. Telas

O menu do `/admin` ganha **Painel** como primeiro item. A rota padrão continua `sessoes`.

### Painel (`/admin/painel`)
- Cabeçalho com título e seletor de mês (padrão: mês atual em UTC-3), no mesmo formato do Financeiro, reaproveitando `isValidMonth`.
- **Cartões:** Pacientes atendidos, Realizadas, Faltas, Cancelamentos, Recebido, Devido, Previsto (acordos atuais).
- **Previsto × Realizado:** linha ou barra única comparando Previsto e Devido do mês.
- **Gráfico:** barras agrupadas Recebido × Devido dos 6 meses; rótulos do eixo X como `nov/26`, eixo Y em reais; cores da paleta do admin (`#4D6D66` e `#D4E6E1`).
- **Alertas de frequência:** lista com paciente, contratado, contado e a diferença. Sem alertas: "Nenhum alerta de frequência neste mês".
- **Avisos reaproveitados do Financeiro:**
  - mês sem nenhuma sessão: "Sincronize a agenda deste mês para ver o devido." (no lugar de zeros);
  - sessões sem paciente: nota com a contagem;
  - sem sessão vinculada no mês: valores derivados do devido (Devido, Previsto × Realizado) aparecem como traço (—); *Recebido* continua sendo mostrado, pois é fato.

### Acessibilidade do gráfico
O `canvas` recebe `role="img"` e `aria-label` descritivo. Uma tabela `sr-only` repete os 6 meses com Recebido e Devido, e continua disponível se o Chart.js falhar ao montar.

## 5. Carregamento de dados

O painel usa os mesmos listeners da Fase 2 (`SessionsService.watchAll()`, `PatientsService`, `PaymentsService`), com `DestroyRef` já tratado nos serviços. O `ledger` é um `computed`, e o resultado do painel é outro `computed` sobre ele e sobre o mês selecionado. Nenhuma consulta nova, nenhum índice novo.

## 6. Atualização para o Angular 22 (etapa 0)

- Escopo: `ng update @angular/core @angular/cli` e ajustes decorrentes (TypeScript, `@angular/cdk`, `@angular/build`, Vitest, Zard UI se necessário).
- Commit próprio, antes de qualquer código do painel, com `ng build` e `ng test` verdes.
- **Plano B:** se a atualização travar, ficamos no Angular 21 com `ng2-charts@10` (suporta Angular ≥21) e o desenvolvimento do painel segue igual. A mudança é comunicada antes de seguir.

## 7. Erros e casos de borda

- **Falha ao carregar:** mensagem de erro (`role="alert"`), como no Financeiro; enquanto carrega, "Carregando painel...".
- **Paciente sem `sessionsPerMonth` válido:** sem previsto e sem alerta.
- **Mês futuro:** previsto aparece, realizado zerado, alerta usa `done + scheduled`.
- **Paciente inativo:** fora do previsto e dos alertas; suas sessões `done` contam nas contagens.
- **Mês sem movimento no gráfico:** barra zero, mês não é omitido.
- **Valores monetários:** sempre em centavos inteiros e formatados com `formatCents`; nenhuma divisão.

## 8. Limitações conhecidas

- Previsto usa o acordo atual; meses antigos podem divergir do que valia na época.
- Sem histórico de acordos, o alerta de um mês passado também usa `sessionsPerMonth` atual.
- O gráfico mostra 6 meses fixos; não há seletor de período.

## 9. Divergências do spec geral

- §6 "Alerta de frequência": passa de "`done` ≠ `sessionsPerMonth`" para `done + scheduled` no mês corrente e `done` em meses passados, para não alertar quase todos os pacientes no meio do mês.
- §7 Fase 3 "receita": mostra **Recebido** e **Devido**.
- Previsto e alertas consideram só pacientes ativos.

## 10. Testes

- **`dashboard.ts` (Vitest):**
  - Contagens por status, pacientes distintos, sessão sem paciente ignorada.
  - Previsto por sessão e por pacote; paciente inativo fora; `sessionsPerMonth` ≤ 0 fora.
  - Alertas: mês corrente (`done + scheduled`) com falta e sobra; mês passado (`done`); sem alerta quando igual; `scheduled` com `missingFromCalendar` ignorada; inativo ignorado.
  - Série de 6 meses, incluindo virada de ano e meses sem movimento.
  - Consistência: Recebido e Devido iguais a `summarizeMonth`; virada de mês em UTC-3 (sessão às 23:30 do último dia).
- **`DashboardComponent` (dados falsos):** cartões com os números esperados; aviso de mês sem sessões; traço quando não há sessão vinculada; lista de alertas e estado vazio; estado de erro.
- **Etapa 0:** `ng build` e `ng test` verdes após a atualização.

## 11. Ordem de entrega

Cada etapa tem commit próprio.

1. **Angular 22:** atualizar, corrigir, build e testes verdes.
2. **Domínio:** `dashboard.ts` com testes, sem tela.
3. **Tela:** `DashboardComponent`, rota `painel`, item de menu e gráfico (`chart.js` + `ng2-charts@11`).
4. **Fechamento:** README atualizado e verificação final.
