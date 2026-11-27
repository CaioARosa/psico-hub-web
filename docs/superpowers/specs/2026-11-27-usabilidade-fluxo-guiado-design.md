# Usabilidade e Fluxo Guiado no `/admin` — Design

Data: 2026-11-27 · Projeto: `psico-hub-web` · Usuária: Lays Coelho (iPad com teclado)

## 1. Objetivo

Eliminar a fricção de uso recorrente no `/admin` para que a Lays saiba em segundos **o que fazer primeiro**, **qual a sequência de etapas até fechar o mês** e **onde cada tarefa está**, sem depender de sincronizações manuais nem trocar o filtro de mês a cada tela.

### Dores confirmadas
1. **Perdida entre 7 abas** (`Agenda`, `Painel`, `Pacientes`, `Sessões`, `Pagamentos`, `Financeiro`, `Cobrança`), com responsabilidades sobrepostas entre *Agenda × Sessões* e *Pagamentos × Financeiro × Cobrança*.
2. **Sequência de sucesso invisível**: não fica claro que o ciclo é `Pacientes → Agenda → Confirmar presenças / vincular nomes → Receber e cobrar`, nem quais pendências bloqueiam os cálculos.
3. **Sincronização manual repetitiva**: ao abrir meses anteriores, a tela exige clicar em *"Sincronizar agenda"* e exibe `—`, dando a impressão de que é preciso sincronizar em toda aba.
4. **Filtro de mês isolado por tela**: cada tela mantém seu próprio `signal` de mês; trocar de aba reseta o mês selecionado e obriga a filtrar de novo.
5. **Tabela contábil do Financeiro**: 7 colunas (`Devido`, `Recebido`, `Abatido`, `A receber`, `Em atraso`, `Crédito` + ações) com `min-w-[44rem]` geram rolagem horizontal no iPad e termos difíceis de ler rápido.
6. **Ações escondidas e falta de boas-vindas**: na `Agenda`, a linha clicável não tem indicador visual de toque; no 1º acesso não existe um guia de configuração inicial.

### Contexto de uso (iPad com teclado)
- Tela principal entre **768 px** (retrato / Split View) e **1024 px** (paisagem), com uso híbrido de **toque + teclado**.
- Nenhuma ação pode depender de `:hover`; alvos interativos têm altura mínima de **44 px** em controles principais; zero rolagem horizontal na navegação superior e no extrato do Financeiro.
- Mantém 100% da identidade visual atual (creme `#FDFBF7`, verde-sálvia `#4D6D66`, componentes Zard UI) e todas as regras de negócio existentes (`buildLedger`, `summarizeMonth`, `buildDashboard`, `buildChargeQueue`, `groupSessions`).

### Fora de escopo
- Alterações no backend (`server/`), nas Cloud Functions ou no schema/regras do Firestore.
- Envio automático de WhatsApp.
- Rebrand visual ou alteração das páginas públicas (`/`, `/links`, `/story`).

---

## 2. Entregas

Organizado em 4 blocos incrementais, cada um testável de forma independente:

| Bloco | Entrega | Foco |
| :-- | :-- | :-- |
| U1 | Núcleo compartilhado (`AdminMonthService`, `AutoSyncService` 3 meses + troca de mês, `domain/workflow.ts`, `OnboardingService`) | Fim do troca-mês, sync invisível e regras puras de fluxo |
| U2 | Navegação em 4 abas + barra de mês único + Boas-vindas / Tutorial guiado (`? Como funciona`) + redirects de rotas antigas | Clareza estrutural no iPad e onboarding interativo |
| U3 | Tela `Início` (Trilha de Sucesso viva + resumo do mês) e tela `Atendimentos` (Semana / Pendências / Mês) | "O que faço agora?" e fim da duplicidade Agenda × Sessões |
| U4 | Tela `Financeiro` para iPad (Resumo sem tabela 7 colunas / Cobrar / Pix recebidos) + ajustes em `Pacientes` | Fim do jargão contábil e ações no ponto de uso |

---

## 3. U1 — Núcleo compartilhado de Mês, Sincronização e Fluxo

### 3.1. Mês único compartilhado (`AdminMonthService`)
- Serviço `providedIn: 'root'` que centraliza o mês ativo (`month = signal(currentMonth(new Date()))`).
- Expõe:
  - `month`: `Signal<string>` (`YYYY-MM`)
  - `isCurrentMonth`: `Signal<boolean>`
  - `setMonth(value: string)`: valida com `isValidMonth`, atualiza o sinal se mudou e dispara `autoSync.run([value])` em segundo plano (sem `force`, respeitando as 6 h de frescor).
  - `shift(delta: number)`: avança ou recua 1 mês via `shiftMonth`.
  - `resetToCurrent()`: volta para o mês atual.
- As telas `Início`, `Atendimentos` (sub-aba `Mês`) e `Financeiro` (todas as sub-abas) consomem `AdminMonthService.month()` em vez de criar sinais locais.
- Se a URL traz `?mes=YYYY-MM` válido (ex.: vindo de um link ou redirect), a tela sincroniza o `AdminMonthService` uma vez na ativação.
- `Pacientes` **não** usa mês: continua exibindo toda a carteira da clínica.

### 3.2. Sincronização automática invisível (`AutoSyncService`)
- `runOnEntry(now)` passa a sincronizar **3 meses**: `[shiftMonth(month, -1), month, shiftMonth(month, 1)]` (mês anterior + atual + próximo). Assim, fechar o mês passado na 1ª semana do mês novo já abre atualizado.
- Ao trocar de mês pelo seletor compartilhado, `AdminMonthService.setMonth` chama `autoSync.run([month])` automaticamente.
- A barra superior mostra um indicador discreto de estado da agenda:
  - Durante sync: `"Atualizando agenda…"` com ícone girando.
  - Em repouso: `"Agenda atualizada há X"` + botão ícone/compacto **`↻`** (`aria-label="Atualizar agenda agora"`) que chama `autoSync.run([month], { force: true })`.
  - Em erro de sync automático (ou manual disparado pelo topo): exibe um **toast (toastr)** flutuante no canto inferior direito (`role="alert"`), com mensagem clara em português, botão **`Tentar novamente`** e botão de fechar (`×`); nunca bloqueia a tela.
- Removidos os banners repetitivos *"Sincronize a agenda deste mês para ver o devido"* quando o sync está em andamento (enquanto sincroniza um mês sem sessões, mostra estado neutro `"Buscando sessões no Google Agenda…"`). Se após sincronizar realmente não houver sessões, exibe empty state calmo com opção de atualizar.

### 3.3. Domínio de fluxo e status humano (`domain/workflow.ts`)
Funções puras, sem dependência de Angular/DOM:

1. **`buildWorkflowState(input)`** — recebe `patients`, `sessions` (todas), `payments`, `charges`, `month`, `now`, `syncing`, `lastSyncedAt`:
   - Calcula contadores para badges das abas:
     - `atendimentosBadge`: total de sessões sem paciente no mês ativo + sessões passadas agendadas pendentes de confirmação no mês ativo + pendências abertas do mês anterior (`previousMonthPendingCount`).
     - `financeiroBadge`: total de pacientes na fila de cobrança pronta (não cobradas nos últimos 7 dias e com telefone válido) no mês ativo.
   - Monta os **4 passos da Trilha de Sucesso do mês**:
     1. `patients`: `done` se `activePatientsCount > 0`. Resumo: `"X pacientes ativos"` ou `"Cadastre seus pacientes e acordos"`. CTA: `/admin/pacientes`.
     2. `sync`: `in_progress` se `syncing`, `done` se há sessões no mês ou `lastSyncedAt !== null`, senão `pending`. Resumo: `"Agenda atualizada"` / `"Atualizando…"` / `"Aguardando sincronização"`.
     3. `sessions`: `done` se passo 2 concluído e `unidentified === 0 && pendingConfirmation === 0`. Resumo detalha exatamente o que falta (ex.: `"2 sem paciente · 3 para confirmar"`). CTA: `/admin/atendimentos?aba=pendencias`.
     4. `finance`: `done` se passo 3 concluído e `chargeableCount === 0 && toReceiveTotal === 0`. Resumo: `"X em atraso para cobrar"` ou `"R$ Y a receber"` ou `"Tudo em dia"`. CTA: `/admin/financeiro?aba=cobrar` (quando há cobranças) ou `/admin/financeiro`.
   - Expõe `allClear: boolean` (true quando os 4 passos estão concluídos — permite recolher a trilha num selo tranquilo `"Tudo em dia neste mês"`).
   - Expõe `nextStep`: o primeiro passo não concluído, usado para destacar o próximo botão principal.

2. **`buildFinanceRows(input)`** — traduz `MonthLedgerLine[]` + `patients` + `charges` + `hasLinkedSessions` em itens legíveis para o iPad:
   - Cada item recebe um `status` claro:
     - `'overdue'` (`Em atraso`) — `hasLinkedSessions && line.overdue > 0`
     - `'open'` (`A receber`) — `hasLinkedSessions && line.overdue === 0 && line.toReceive > 0`
     - `'credit'` (`Com crédito`) — `hasLinkedSessions && line.overdue === 0 && line.toReceive === 0 && line.credit > 0`
     - `'paid'` (`Pago`) — demais casos com movimento quitado
     - `'pending_sync'` (`Aguardando sessões`) — `!hasLinkedSessions`
   - Ordenação padrão por prioridade de ação: `overdue` → `open` → `pending_sync` → `credit` → `paid` (desempate por maior valor pendente, depois ordem alfabética).
   - Gera `headline` em português simples (ex.: `"Falta R$ 300,00"`, `"Em atraso: R$ 450,00"`, `"Quitado · R$ 600,00"`, `"Crédito de R$ 150,00"`) e `subline` resumida (ex.: `"Recebido R$ 300,00 de R$ 600,00"`).
   - Mantém os valores detalhados (`due`, `received`, `abated`, `toReceive`, `overdue`, `credit`, `sources`) para o bloco expansível `"Ver cálculo"`.

### 3.4. Serviço de onboarding (`OnboardingService`)
- Chave em `localStorage`: `psico-hub:onboarding:v1:${uid}` (usa `AuthService.user()?.uid`; se ausente, não grava nem trava).
- Expõe sinais:
  - `open = signal(false)`
  - `completed`: computed/lido do storage para o `uid` atual
- `initForCurrentUser()`: abre o modal automaticamente uma única vez se o `uid` ainda não completou nem pulou o onboarding.
- `openManual()`: reabre o guia em qualquer momento (acionado pelo botão `? Como funciona`).
- `complete()` e `dismiss()`: gravam `'done'` na chave do `uid` e fecham o modal (tratando erro de `localStorage` silenciosamente em navegação privada).

---

## 4. U2 — Navegação em 4 abas, Barra de Mês Único e Tutorial Guiado

### 4.1. `AdminShellComponent`
- **Cabeçalho superior (linha 1):**
  - Marca (`Consultório`, link para `/admin/inicio`)
  - **4 abas principais** (sem rolagem horizontal em 768 px–1024 px):
    1. `Início` (`/admin/inicio`)
    2. `Atendimentos` (`/admin/atendimentos`) + badge numérico quando `atendimentosBadge > 0`
    3. `Financeiro` (`/admin/financeiro`) + badge numérico quando `financeiroBadge > 0`
    4. `Pacientes` (`/admin/pacientes`)
  - Ações à direita: botão **`? Como funciona`** (compacto com ícone `lucideCircleHelp`, texto visível em `md+`) e **`Sair`**.
- **Faixa de contexto do mês (linha 2 discreta, exibida em `Início`, `Atendimentos` e `Financeiro`; oculta em `Pacientes`):**
  - Seletor compacto: `‹` | `AppMonthPicker` (`novembro de 2026`) | `›` + botão `Voltar para mês atual` quando `!isCurrentMonth()`.
  - À direita: status discreto da agenda (`Agenda atualizada há X · ↻` ou `Atualizando agenda…`).
- **Rotas e compatibilidade (`admin.routes.ts`):**
  - `''` → redirect para `inicio`
  - `inicio`, `atendimentos`, `financeiro`, `pacientes` (lazy loaded)
  - Redirects com `RedirectFunction` preservando query params:
    - `agenda` → `/admin/atendimentos?aba=semana`
    - `sessoes` → `/admin/atendimentos` (`nao-identificados` / `pendentes` → `aba=pendencias`, `todas` → `aba=mes`, preserva `mes`)
    - `painel` → `/admin/inicio` (preserva `mes`)
    - `cobranca` → `/admin/financeiro?aba=cobrar` (preserva `mes`)
    - `pagamentos` → `/admin/financeiro?aba=pix` (preserva `mes`, `paciente`, `valor`)

### 4.2. Boas-vindas + Tutorial de Configuração Guiado (`OnboardingModalComponent`)
- Dialog acessível (`role="dialog"`, `aria-modal="true"`, fecha com `Esc` e botão `Pular e explorar`).
- Barra de progresso clara (`Passo X de 4`) com navegação `Voltar` / `Próximo`.
- Lê os dados reais do consultório para mostrar progresso verdadeiro:
  1. **Passo 1 — Como o consultório funciona aqui:** mapa visual dos 4 passos do ciclo (`1. Pacientes` → `2. Agenda` → `3. Confirmar` → `4. Receber/Cobrar`), com estimativa honesta (~2 min).
  2. **Passo 2 — Pacientes e acordos:** explica que o nome cadastrado casa com o Google Agenda e que o valor/pacote define o cálculo automático. Se já há pacientes ativos, mostra selo verde `"Você já tem X pacientes ativos ✓"`; caso contrário, botão **"Ir cadastrar primeiro paciente"** (fecha o guia e navega para `/admin/pacientes?novo=1`).
  3. **Passo 3 — Google Agenda automático:** ensina de forma simples como a sincronização funciona: ao abrir o sistema ele já busca automaticamente o **mês passado, o mês atual e o próximo** (e também atualiza sozinho quando ela troca de mês) — ela **não precisa clicar para sincronizar toda vez**, só tocar em `↻` no topo se acabou de mexer no Google Agenda agora. Também explica que eventos com nome diferente caem em `Atendimentos → Pendências`. Botão **"Sincronizar agora"** roda `AutoSyncService.run([month], { force: true })` ali mesmo e mostra o resumo (ex.: *"14 sessões encontradas"*).
  4. **Passo 4 — Sua rotina semanal:** resume os 2 gestos da semana (marcar `Realizada / Faltou` em *Atendimentos* e lançar Pix ou cobrar em *Financeiro*), lembra que o guia fica sempre em `? Como funciona`, e oferece **"Ir para o Início"**.

---

## 5. U3 — Telas `Início` e `Atendimentos`

### 5.1. `HomeComponent` (`/admin/inicio`)
Substitui o antigo `Painel` como página de entrada orientada a ação:
1. **Bloco 1 — Trilha de Sucesso do mês:**
   - Quando há etapas pendentes: card destacado com os 4 passos numerados, ícone de concluído/pendente, resumo objetivo do que falta e **um único CTA primário** no próximo passo pendente (ex.: `Resolver 4 pendências`).
   - Quando `allClear === true`: faixa compacta verde-sálvia `"Tudo em dia em novembro ✓"` com opção de expandir para rever a trilha.
2. **Bloco 2 — Resumo do mês (4 cards essenciais):**
   - `Recebido`, `A receber`, `Em atraso` e `Sessões` (`X realizadas` + `Y previstas`, com barra `Previsto × Realizado` logo abaixo).
3. **Bloco 3 — Evolução e Alertas de frequência:**
   - Reutiliza `RevenueChartComponent` (6 meses) e a lista de `Alertas de frequência` do antigo `DashboardComponent`, agora sem alertas de sync manual (o sync roda sozinho).

### 5.2. `AtendimentosComponent` (`/admin/atendimentos`)
Unifica `AgendaComponent` e `SessionsComponent` em 3 sub-abas (`?aba=semana|pendencias|mes`):
1. **`Semana` (padrão):**
   - Navegação semanal (`‹ Semana` · `Hoje` · `Semana ›`) agrupada por dia, destacando hoje.
   - **Fim das ações escondidas:** cada sessão identificada mostra um botão claro **`Ações ▾`** (ou **`Confirmar ▾`** quando já passou e ainda está agendada), com alvo de toque confortável (≥ 44 px), que abre `SessionActionsComponent` (`Realizada`, `Faltou`, `Cancelada`, `Reagendar`, `Trocar paciente`).
   - **Vínculo direto no card:** sessões sem paciente identificado (`patientId === null`) exibem o seletor `Vincular paciente` + botão `Vincular` **direto ali**, sem mandar a usuária para outra aba.
2. **`Pendências (N)`:**
   - Mostra em ordem de prioridade:
     1. **Sessões sem paciente identificado** (do mês ativo) — com seletor inline de vínculo e ações para eventos removidos do Google Agenda.
     2. **Sessões passadas aguardando confirmação** (do mês ativo) — com botões `Realizada`, `Faltou`, `Cancelada` já abertos/visíveis em 1 toque (sem precisar expandir primeiro!).
     3. **Pendências do mês anterior** (quando existirem): bloco separado no fim da aba com título *"Restantes de [mês anterior]"* e ações diretas para resolver sem precisar trocar o mês ativo.
   - Empty state tranquilo quando `N === 0`: `"Nenhuma pendência de atendimento ✓"`.
3. **`Mês`:**
   - Lista completa de todas as sessões do mês ativo (equivalente à antiga aba `Todas` de `Sessões`), mantendo vínculo inline, tratamento de `missingFromCalendar` e `SessionActionsComponent`.

---

## 6. U4 — Tela `Financeiro` para iPad e `Pacientes`

### 6.1. `FinanceHubComponent` (`/admin/financeiro`)
Unifica `FinanceComponent`, `CobrancaComponent` e `PaymentsComponent` em 3 sub-abas (`?aba=resumo|cobrar|pix`), todas usando `AdminMonthService.month()`:

- **Cabeçalho da tela:** título `Financeiro` + botão primário **`+ Registrar Pix`** sempre visível (abre `PaymentFormComponent` inline no topo da tela, sem navegar para outro lugar; se veio com prefill de uma paciente, já abre preenchido).

1. **Sub-aba `Resumo` (padrão):**
   - 3 cartões de resumo: `Recebido`, `A receber`, `Em atraso` (mais botão rápido `"Cobrar em fila (N)"` quando houver cobranças prontas, trocando para a sub-aba `Cobrar`).
   - Filtro rápido em pílulas: **`Com pendência`** (padrão quando há pendências; senão `Todos`) | **`Todos`** | **`Pagos`**.
   - **Lista de pacientes para iPad (substitui a tabela de 7 colunas):**
     - Cada paciente é um cartão/linha sem rolagem horizontal:
       - Linha principal: **Nome** + badge de status (`Em atraso`, `A receber`, `Pago`, `Com crédito`) + **resumo humano** (`Falta R$ 300,00 · recebido R$ 300,00 de R$ 600,00`).
       - Se cobrada recentemente, mostra selo discreto `"Cobrada em dd/mm"`.
       - Barra de ações com botões claros (≥ 44 px):
         - **`Registrar Pix`** (quando `toReceive > 0 || overdue > 0`) — abre o formulário inline já preenchido com paciente, valor e mês ativo.
         - **`Cobrar no WhatsApp`** (quando `overdue > 0` e telefone válido) ou aviso acionável para corrigir telefone em `Pacientes`.
         - **`Ver cálculo ▾`** — expande a explicação em português simples:
           - *Sessões do mês (Devido):* `R$ ...`
           - *Pix recebidos no mês:* `R$ ...`
           - *Crédito de meses anteriores usado (Abatido):* `R$ ...` (com lista *"R$ X vindos de mês/ano"* quando `sources.length > 0`)
           - *A receber / Em atraso / Crédito restante:* apenas os itens > 0, sem poluir com zeros.
2. **Sub-aba `Cobrar (N)`:**
   - Reaproveita integralmente a lógica da fila 1-por-1 (`CobrancaComponent` adaptado para receber/compartilhar `AdminMonthService`), mantendo edição de mensagem, `Abrir WhatsApp`, confirmação `"Enviou a mensagem? Sim, marcar como cobrada"`, `Pular`, lista `Cobradas há menos de 7 dias` e `Sem WhatsApp válido`.
3. **Sub-aba `Pix recebidos`:**
   - Reaproveita a listagem, busca por paciente, edição e exclusão de `PaymentsComponent`.
   - Por padrão filtra pelo **mês ativo** (`AdminMonthService.month()`), com botão **`Ver todos os meses`** para consulta histórica completa.

### 6.2. `PatientsComponent` e `PatientFormComponent` (`/admin/pacientes`)
- Aceita query param `?novo=1` (usado pelo passo 2 do Onboarding) para já abrir o formulário de novo paciente pronto para digitar.
- No campo **Nome** do formulário, adiciona dica inline: *"Use o mesmo nome usado no Google Agenda para vincular as sessões automaticamente."*
- No empty state sem pacientes, mostra mensagem guiada: *"Passo 1 do consultório: cadastre seus pacientes e acordos para o sistema calcular valores e vincular a agenda."* com botão direto **`+ Novo paciente`**.

---

## 7. Erros, Resiliência e Testes

### Tratamento de erro
- **Falha no sync automático:** nunca bloqueia visualização de dados em cache/Firestore; dispara um **toast (toastr)** com a mensagem do erro, botão `Tentar novamente` e botão fechar (`×`).
- **Falha ao gravar (vínculo, status, Pix, cobrança):** mantém o padrão `SAVE_ERROR` / `safe-write`, preserva o estado do formulário aberto e permite reenviar.
- **Falha de `localStorage` no onboarding:** capturada com `try/catch`; o tutorial continua abrindo manualmente pelo `? Como funciona`.

### Estratégia de testes (Vitest + checagem visual)
- **Unitários de domínio (novos):**
  - `domain/workflow.spec.ts`: todos os 4 estados da trilha, `allClear`, badges de `Atendimentos` (incluindo pendência do mês anterior) e `Financeiro`, classificação e ordenação de `buildFinanceRows`, geração de texto humano e detalhamento.
- **Unitários de serviços (novos/atualizados):**
  - `data/admin-month.service.spec.ts`: mudança de mês dispara `AutoSyncService.run([month])`, `shift`, `resetToCurrent`, ignora mês inválido.
  - `data/auto-sync.service.spec.ts`: `runOnEntry` sincroniza 3 meses (anterior, atual e próximo).
  - `data/onboarding.service.spec.ts`: namespace por `uid`, abre 1x, respeita `dismiss`/`complete`, reabre via `openManual`, resiste a falha de `localStorage`.
- **Testes de componentes:**
  - `AdminShellComponent` (4 abas, badges, seletor de mês oculto em Pacientes, botão `? Como funciona`).
  - `OnboardingModalComponent` (4 passos, detecção de estado real, sync inline, `Esc` / pular).
  - `HomeComponent`, `AtendimentosComponent`, `FinanceHubComponent`, `PatientsComponent` (`?novo=1`).
  - Redirects de rotas legadas em `admin.routes.ts`.
- **Verificação final:**
  - `npx ng test --watch=false` e `npx ng build` passando sem erros.
  - Inspeção visual em largura de iPad (**768×1024** retrato e **1024×768** paisagem) confirmando zero rolagem horizontal nas abas e no Financeiro e alvos de toque ≥ 44 px.
  - Execução do detector Impeccable (`impeccable detect --json`) nos alvos alterados.

---

## 8. Critérios de sucesso

1. No 1º acesso, a Lays vê o Boas-vindas guiado em 4 passos (pulável e reabrível em `? Como funciona`) com feedback real do que já está pronto.
2. Em qualquer acesso posterior, abre em `Início` vendo exatamente qual é o próximo passo do mês sem precisar adivinhar qual aba abrir.
3. Escolher um mês (ex.: mês anterior) mantém todas as abas (`Início`, `Atendimentos`, `Financeiro`) naquele mês e sincroniza o Google Agenda automaticamente sem pedir clique manual.
4. No iPad (768 px e 1024 px), todas as 4 abas cabem na barra superior e o `Financeiro` não exige rolagem horizontal nem conhecimento de jargão contábil para agir.
5. `npx ng test --watch=false` e `npx ng build` passam sem regressão e sem alterações em `server/`.
