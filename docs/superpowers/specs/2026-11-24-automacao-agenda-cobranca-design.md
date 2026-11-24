# Automação da Agenda e Fila de Cobrança — Design

Data: 2026-11-24 · Projeto: `psico-hub-web` · Usuária: Lays Coelho (única)

## 1. Objetivo

Reduzir o trabalho manual da Lays em dois passos do `/admin`:

1. **Sincronizar a agenda**: hoje é um botão clicado à mão (Agenda e Sessões).
2. **Cobrar pacientes em atraso**: hoje é um link `wa.me` por paciente, com texto fixo e sem registro de quem já foi cobrado.

### Fatos acordados
- A maior dor da Lays são as tarefas manuais; os passos que mais incomodam são sincronizar e cobrar.
- O envio da cobrança continua **manual**: o sistema só abre o WhatsApp com texto pronto.
- Só a Lays usa o sistema. Nada clínico é armazenado.

### Fora de escopo
- Envio automático pela API do WhatsApp Business.
- Sincronização agendada no servidor (Cloud Scheduler).
- Histórico de várias cobranças por mês (o documento guarda só a última).
- Modelos de mensagem salvos.
- Mudanças no backend (`server/`).

## 2. Entregas

Duas etapas independentes, cada uma com seu commit e seu deploy.

| Etapa | Entrega | Estimativa |
| :-- | :-- | :-- |
| S1 | Sincronização automática ao abrir `/admin` | ~1,5 h |
| C1 | Fila de cobrança com registro de quem foi cobrada | ~4 h |

## 3. S1 — Sincronização automática

### Comportamento
- Ao abrir `/admin`, sincroniza sozinho o **mês atual e o próximo**.
- Antes de sincronizar cada mês, lê `calendarSyncs/{YYYY-MM}`. Se `syncedAt` tem **menos de 6 h**, pula.
- Ao trocar de semana na Agenda para outro mês, repete a mesma checagem.
- Os botões "Sincronizar agenda" (Agenda e Sessões) continuam e **forçam** a sincronização, sem checar as 6 h.

### Peças
1. `domain/sync-freshness.ts`: função pura `needsAutoSync(lastSyncedAt, now)` e constante `AUTO_SYNC_AFTER_HOURS = 6`.
2. `CalendarSyncsService`: novo `lastSyncedAtOnce(month)` (leitura única com `getDoc`). O `watchMonth` guarda um único listener e não serve aqui.
3. `AutoSyncService` (novo, `providedIn: 'root'`): `run(months, { force })`. Junta chamadas simultâneas do mesmo mês em uma só. Expõe os sinais `syncing` e `lastResult`. Usa o `CalendarSyncService` existente.
4. `AdminShellComponent` dispara `run` uma vez ao entrar. `AgendaComponent` e `SessionsComponent` trocam a lógica duplicada de `syncCalendar()` por chamadas ao `AutoSyncService`.

### Erros e UI
- Falha na sincronização automática não bloqueia nada: aviso pequeno "Não foi possível atualizar a agenda agora".
- A Agenda mostra "Atualizado há X" no cabeçalho e um indicador "Sincronizando…".
- Falha na sincronização manual continua mostrando o alerta atual.
- O backend não muda; `POST /api/admin/sync-calendar` já é idempotente.

### Testes (Vitest)
- `needsAutoSync`: limite de 6 h, sem registro, mês passado.
- `AutoSyncService` com fakes: pula quando recente, força, dedup de chamadas, falha parcial entre meses.
- Specs existentes de Agenda e Sessões ajustados para o novo serviço.

## 4. C1 — Fila de cobrança

### Fluxo
1. A Lays abre **Cobrança** (novo item no menu, rota `/admin/cobranca`, aceita `?mes=YYYY-MM`) e vê uma paciente em atraso por vez: nome, total devido e mensagem pronta.
2. Edita o texto se quiser e clica em **Abrir WhatsApp** (nova aba, `noopener noreferrer`).
3. O cartão pergunta "Enviou a mensagem?" com **Sim, marcar como cobrada** ou **Pular**. Só marca depois da confirmação, para não registrar cobrança aberta e não enviada.
4. Passa para a próxima. No fim: "Fila concluída".

### Dados
- Nova coleção `charges`, ID `{patientId}_{YYYY-MM}`.
- Campos: `patientId` (string), `month` (string `YYYY-MM`), `chargedAt` (timestamp), `amount` (centavos, total cobrado).
- O **texto da mensagem não é salvo** (minimização, LGPD).
- `firestore.rules` não muda: a regra `/{document=**}` já exige o claim `admin`.

### Peças
1. `domain/charge-queue.ts` (função pura): monta a fila a partir do resumo do Financeiro.
   - Entram pacientes com `toReceive + overdue > 0` e telefone válido.
   - Ordem: nunca cobradas primeiro, depois a cobrança mais antiga, depois o maior valor.
   - Cobrada há menos de **7 dias** (`CHARGE_COOLDOWN_DAYS = 7`) fica marcada "cobrada recentemente" e vai para o fim.
2. `domain/charge-message.ts`: nova `whatsappLink(phone, text)` aceitando texto livre. `chargeMessage` e `whatsappChargeUrl` permanecem; o Financeiro continua usando a última.
3. `ChargesService` (novo): `watch(month)` devolve o mapa `patientId → chargedAt`; `markCharged(patientId, month, amount)` grava com o padrão `safe-write` existente.
4. `CobrancaComponent` (novo, lazy em `admin.routes.ts`, item no menu do `AdminShell`).
5. `FinanceComponent`: botão **Cobrar em fila** e selo "Cobrada em dd/mm" ao lado da paciente.

### Erros
- Falha ao gravar: o erro aparece e o botão permite tentar de novo; nada é dado como cobrado sem confirmação do Firestore.
- Telefone inválido: a paciente fica fora da fila, com a nota "Corrija em Pacientes".
- Pix que quita o atraso: a paciente sai da fila sozinha, pois o cálculo vem do mesmo `finance.ts`.

### Testes (Vitest)
- `charge-queue`: ordem, cooldown de 7 dias, telefone inválido, paciente quitada.
- `whatsappLink`: normalização do número e codificação do texto.
- `ChargesService`: formato do documento e ID.
- `CobrancaComponent`: fluxo abrir, confirmar e pular; erro de gravação.

## 5. Riscos

| Risco | Cuidado |
| :-- | :-- |
| Cold start do Cloud Run atrasa a sincronização ao abrir | Roda em segundo plano, sem bloquear; indicador "Sincronizando…". |
| Disparos simultâneos (shell e Agenda) | `AutoSyncService` junta chamadas do mesmo mês; backend é idempotente. |
| Relógio do aparelho errado distorce as 6 h | Aceito: pior caso é uma sincronização a mais ou a menos. |
| Cobrança marcada sem ter sido enviada | Só marca após a confirmação "Enviou a mensagem?". |
| Dado de saúde (LGPD) | `charges` guarda só paciente, mês, data e valor; sem texto e sem dado clínico. |

## 6. Critérios de sucesso
- Ao abrir `/admin`, a agenda do mês atual e do próximo está atualizada sem clicar em nada.
- A Lays cobra todas as pacientes em atraso em uma tela só, sabendo quem já foi cobrada.
- `npx ng test --watch=false` e `cd server && npm test` passam; o backend não muda.

## 7. Premissas
- Volume pequeno (dezenas de pacientes), dentro do plano gratuito do Firebase.
- A leitura extra de `calendarSyncs` ao abrir o painel (2 documentos) é desprezível.
- A rota padrão do `/admin` continua `/admin/agenda`.
