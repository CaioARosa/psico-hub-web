# Gestão do Consultório — Fase 2 (Financeiro) — Design

Data: 2026-11-13 · Projeto: `psico-hub-web` · Usuária: Lays Coelho (única)

Complementa `2026-11-12-gestao-consultorio-design.md` (spec geral, §6 e §7 "Fase 2"). Onde este documento e o spec geral divergirem, **este vale para a Fase 2**; as divergências estão listadas na seção 9.

## 1. Objetivo

Permitir que a Lays registre os Pix recebidos e veja, por mês e por paciente, quanto foi **recebido**, quanto **falta receber** e quanto está **em atraso**, sem planilha. A Fase 1 já entrega pacientes, acordos financeiros e sessões confirmadas; a Fase 2 usa esses dados.

### Decisões acordadas
- **Pacote mensal:** o valor do mês fica congelado na sessão (campo novo `packageAmountApplied`). Mudar o preço do pacote depois não altera meses passados.
- **Crédito:** o excedente de qualquer mês, inclusive Pix adiantado de mês futuro, abate automaticamente os atrasos dos meses anteriores a ele, do mais antigo para o mais novo. O que sobrar fica como crédito daquele mês.
- **Mês de referência:** a Lays escolhe o mês ao registrar o Pix (padrão: mês da data do pagamento).
- **Correções:** o Pix pode ser editado e excluído (exclusão com confirmação), sem histórico de alterações.

### Fora de escopo
- Painel, gráficos e alertas de frequência (Fase 3).
- Lembrete de cobrança e mensagem de WhatsApp (Fase 4; a lista "em atraso" desta fase será a fonte dela).
- Estorno ou lançamento negativo, trilha de auditoria e conciliação automática de Pix.
- Congelar `chargeNoShow` por sessão (limitação conhecida, seção 8).
- Agregação de valores no servidor: o cálculo é feito no frontend.

## 2. Modelo de dados

### `sessions` — campo novo
| Campo | Tipo | Observação |
| :-- | :-- | :-- |
| `packageAmountApplied` | number (centavos) \| ausente | Valor do pacote vigente quando a sessão é criada ou vinculada a um paciente. `monthly_package` → `agreement.amount`; `per_session`, sessão sem paciente → `0`. Sessões criadas antes da Fase 2 não têm o campo (ver "reserva" na seção 3) |

Quem grava o campo: o backend (`planSessionSync`, ao criar a sessão e ao vincular uma sessão `scheduled` antes sem paciente) e o frontend (`linkPatient`, ao vincular manualmente). Ambos usam a mesma regra, como já ocorre com `amountApplied`. Sessões já vinculadas não são regravadas.

### `payments` (coleção já prevista no spec geral §4)
| Campo | Tipo | Observação |
| :-- | :-- | :-- |
| `patientId` | string | |
| `amount` | number (centavos) | Inteiro maior que zero |
| `paidAt` | string `YYYY-MM-DD` | Texto, para não depender de fuso |
| `referenceMonth` | string `YYYY-MM` | Mês ao qual o pagamento se refere |
| `note` | string | Opcional; vazio quando não informado |

As regras do Firestore já cobrem `payments` (qualquer coleção, apenas com o claim `admin`). Nenhuma regra nova.

## 3. Cálculo financeiro

Funções puras em `src/app/pages/admin/domain/finance.ts`, sem acesso ao Firestore. Entradas: pacientes, **todas** as sessões e **todos** os pagamentos. Sessões sem paciente (`patientId = null`) são ignoradas.

### Devido de um paciente em um mês `m`
`due(m) = perSessionDue(m) + packageDue(m)`

- `perSessionDue(m)`: soma de `amountApplied` das sessões do mês com status `done`; sessões `no_show` entram só se o paciente tem `agreement.chargeNoShow = true` (valor do acordo atual). Sessões de pacote têm `amountApplied = 0`, então não somam aqui.
- `packageDue(m)`: o valor efetivo do pacote da **primeira sessão do mês, por data, que não seja `cancelled`** (inclui `scheduled`, `done` e `no_show`). Valor efetivo de uma sessão = `packageAmountApplied`, ou, se o campo não existe, `agreement.amount` do paciente quando o acordo atual é `monthly_package`, senão `0` (reserva para sessões antigas).
- O mês de uma sessão é o de `startsAt` em UTC-3.

### Recebido
`received(m)` = soma de `payments.amount` do paciente com `referenceMonth = m`.

### Abatimento por crédito
Para cada paciente, os meses com `due`, `received` ou sessões são percorridos **do mais antigo ao mais novo**, com uma fila de déficits abertos:

1. `net(m) = received(m) − due(m)`.
2. Se `net(m) < 0`: entra na fila o déficit `{ month: m, remaining: −net(m) }`.
3. Se `net(m) > 0`: o excedente abate a fila, do déficit mais antigo ao mais novo, até acabar um dos dois. O que sobrar é `credit(m)`.

Como a fila só contém meses anteriores a `m` no momento em que `m` é processado, o crédito de um mês nunca abate meses posteriores. Pix adiantado de um mês futuro, porém, abate os déficits dos meses anteriores a ele, inclusive o mês atual.

### Resultado por paciente e mês
- `abated(m)`: total que os créditos de meses posteriores abateram do déficit de `m`.
- `toReceive(m)` = `max(0, due(m) − received(m)) − abated(m)`, nunca negativo.
- `credit(m)`: excedente que sobrou depois de abater a fila.
- `overdue(M)` = soma de `toReceive(m)` para os meses `m < M`.
- `abatementSources(m)`: lista `{ fromMonth, amount }` dos créditos que abateram `m`, usada na explicação da tela.

### Resumo do mês `M` (todos os pacientes)
Cartões: *Recebido* = soma de `received(M)`; *A receber* = soma de `toReceive(M)`; *Em atraso* = soma de `overdue(M)`. As linhas da tabela somam exatamente os cartões.

## 4. Telas

O menu do `/admin` ganha **Financeiro** e **Pagamentos**. A tela padrão continua sendo *Sessões*.

### Financeiro (`/admin/financeiro`)
- Seletor de mês (padrão: mês atual em UTC-3), cartões *Recebido / A receber / Em atraso* e tabela por paciente.
- Colunas: paciente, devido, recebido, abatido, a receber, em atraso, crédito; linha de total. Aparecem só pacientes com movimento (devido, pagamento, ou saldo em atraso).
- Detalhe da linha, expansível: explica os abatimentos ("R$ 100,00 abatidos com o crédito de 2026-11").
- Botão **Registrar Pix** em cada linha com saldo: abre o formulário de Pagamentos com paciente, mês de referência e valor (`toReceive` do mês) já preenchidos.
- **Aviso de mês sem sessões:** se não há nenhuma sessão no mês selecionado (de qualquer paciente), mostra "Sincronize a agenda deste mês para ver o devido" em vez de apresentar zeros como se estivesse quitado.

### Pagamentos (`/admin/pagamentos`)
- Formulário: paciente (todos, inclusive inativos), valor (maior que zero, formato `150,00`, via `parseBRLToCents`), data do Pix (padrão: hoje), mês de referência (padrão: mês da data, editável), observação (opcional).
- Histórico em tempo real, mais recente primeiro, com filtro por mês de referência e por paciente. Cada linha tem *Editar* e *Excluir*; excluir pede confirmação na própria linha.

### Gravação
Mesmo padrão da Fase 1: toda escrita passa por `runWrite` (timeout de 10 s, mensagem em português, nova tentativa possível). O id do Pix novo é gerado uma vez ao abrir o formulário e reutilizado nas tentativas, de modo que repetir não duplica.

## 5. Carregamento de dados

O resumo precisa de todas as sessões e todos os pagamentos para calcular os abatimentos. Um serviço mantém um listener em tempo real de `payments` (ordenado por `paidAt`) e outro de `sessions` completo (ordenado por `startsAt`), ambos encerrados com `DestroyRef`. O volume de um consultório é pequeno (dezenas de pacientes, poucas sessões por semana). Nenhuma consulta nova precisa de índice composto.

## 6. Backend

`server/lib/patient-matching.js` ganha `packageAmountForNewSession(agreement)` (`monthly_package` → `agreement.amount`; caso contrário, inclusive `null` → `0`). `planSessionSync` grava `packageAmountApplied` na criação e no vínculo de sessões antes sem paciente. O cliente repete a regra em `domain/money.ts`, com teste, como já é feito para `amountForNewSession`.

## 7. Erros e casos de borda

- **Valor do Pix inválido** (zero, negativo, fora do formato), **data inválida** e **mês fora de `YYYY-MM`**: rejeitados com mensagem em português antes de gravar.
- **Falha ao carregar** (listener): mensagem de erro; **falha ao gravar**: mensagem e nova tentativa.
- **Pagamento de paciente inexistente:** a linha mostra "Paciente removido" e continua editável.
- **Mês sem sessões:** aviso da seção 4.
- Valores sempre em centavos inteiros; nenhuma divisão no cálculo.

## 8. Limitações conhecidas

- `chargeNoShow` vale pelo acordo atual do paciente, não por sessão: se ela alterar o interruptor, meses passados podem mudar.
- Sessões criadas antes da Fase 2 usam a reserva da seção 3 (valor atual do pacote). Se o preço do pacote já tiver mudado antes desta fase, esses meses antigos não refletem o valor da época.
- Sem trilha de auditoria: editar ou excluir um Pix não deixa histórico.
- Um Pix adiantado pode abater um atraso mais antigo que a Lays não esperava; a tela explica a origem do abatimento para não haver surpresa.

## 9. Divergências do spec geral

- §6 "Devido (pacote)": passa de "`agreement.amount` do paciente no mês" para o valor congelado na primeira sessão não cancelada do mês.
- §6 "A receber / Em atraso": passa a considerar o abatimento por crédito de qualquer mês (inclusive adiantado) contra meses anteriores.
- §6 "Devido (por sessão)": mantém a regra, e `no_show` segue o interruptor do acordo atual.
- §4 `sessions`: ganha `packageAmountApplied`.

## 10. Testes

- **`finance.ts` (Vitest):**
  - Devido por sessão: só `done`; `no_show` apenas com `chargeNoShow`; `cancelled` nunca.
  - Devido de pacote: primeira sessão não cancelada; ignora `cancelled`; mês só com sessões `cancelled` não gera cobrança; reserva para sessão sem `packageAmountApplied`; mudança de preço não altera mês antigo.
  - Abatimento: excedente abate o déficit mais antigo primeiro; abate vários déficits em ordem; sobra vira crédito; crédito de mês futuro abate o mês atual e os anteriores; crédito de mês antigo não abate mês posterior; `toReceive` nunca negativo; pacientes isolados entre si.
  - Resumo: os cartões batem com a soma das linhas; mês de virada UTC-3 (sessão em 23:30 do último dia).
- **Formulário de Pix e mapeamento do documento:** valor, data, mês e padrão do mês de referência.
- **Backend (`node --test`):** `packageAmountApplied` na criação, no vínculo automático e em sessão sem paciente.
- **Tela Financeiro (componente, dados falsos):** cartões e tabela mostram os números esperados; aviso de mês sem sessões; botão *Registrar Pix* leva os valores pré-preenchidos.

## 11. Ordem de entrega

1. Valor do pacote na sessão: campo `packageAmountApplied` no backend, no mapeamento do documento e no vínculo manual.
2. Cálculo financeiro: `finance.ts` com testes, sem tela.
3. Pagamentos: serviço (listener, criar, editar, excluir) e a tela *Pagamentos*.
4. Financeiro: a tela de resumo, o botão *Registrar Pix* nas linhas e a atualização do README.

Cada etapa é utilizável e testável sozinha.
