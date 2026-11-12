# Gestão do Consultório — Design

Data: 2026-11-12 · Projeto: `psico-hub-web` · Usuária: Lays Coelho (única)

## 1. Objetivo

Dar à Lays uma área privada (`/admin`) para gerir a prática clínica: quantos pacientes e sessões atendeu no mês, quanto recebeu, quanto tem a receber e quem está devendo. Hoje ela não tem nenhum controle sistematizado.

### Fatos acordados
- Pagamento sempre **direto do paciente via Pix**. Sem clínica, repasse ou comissão.
- Valor **individual por paciente** (preço social, desconto, negociado) e **pacote mensal** opcional.
- Cada paciente tem uma **frequência contratada** (sessões por mês).
- **Todas** as sessões já são marcadas no Google Agenda. O Agenda é a fonte das sessões.
- Só a Lays usa o sistema. Pacientes não veem nada.

### Fora de escopo
- Dados clínicos (prontuário, anotações de sessão). Não armazenamos nada clínico.
- Emissão de recibo ou nota fiscal.
- Conciliação automática de Pix (o registro de pagamento é manual).
- Envio automático de mensagens (o WhatsApp é aberto com texto pronto; o envio é manual).
- Múltiplos usuários ou perfis.

## 2. Fases

Cada fase é usável sozinha e tem seu próprio plano de implementação. **Este spec detalha o design das 4; o plano de implementação cobre uma fase por vez, começando pela Fase 1.**

| Fase | Entrega |
| :-- | :-- |
| 1. Núcleo | Login, cadastro de pacientes com acordo financeiro, sincronização do Agenda, confirmação de sessões |
| 2. Financeiro | Registro de Pix; resumo do mês: recebido, a receber, em atraso |
| 3. Painel | Números do mês, comparação com meses anteriores, alertas de frequência |
| 4. Cobrança | Botão por devedor que abre o WhatsApp com mensagem pronta |

## 3. Arquitetura

- **Frontend (Angular 21, standalone, signals):** rota `/admin` carregada sob demanda (`loadChildren`), protegida por `CanActivateFn` que exige usuário autenticado. Páginas públicas inalteradas. Segue os padrões existentes (Zard UI, Tailwind v4, Vitest).
- **Autenticação:** Firebase Auth com e-mail e senha. O usuário único é criado manualmente no console do Firebase; não existe tela de cadastro.
- **Dados:** Firestore na região `southamerica-east1`. O frontend lê e escreve direto no Firestore, protegido por `firestore.rules`.
- **Backend (`server/`, Express no Cloud Run):** ganha um endpoint `POST /api/admin/sync-calendar`. Ele valida o ID token do Firebase (`firebase-admin`), lê o Google Agenda com a service account já existente (`events.list`, `singleEvents: true`) e grava/atualiza `sessions` no Firestore. É a única responsabilidade nova do backend.
- **Hosting:** o rewrite `/api/**` para o Cloud Run já existe em `firebase.json`; `firestore.rules` é adicionado à configuração.

## 4. Modelo de dados (Firestore)

### `patients`
| Campo | Tipo | Observação |
| :-- | :-- | :-- |
| `name` | string | Usado para casar com o título do evento |
| `phone` | string | Para o link do WhatsApp |
| `active` | boolean | Inativos saem das listas, mas o histórico permanece |
| `agreement.type` | `per_session` \| `monthly_package` | |
| `agreement.amount` | number (centavos) | Valor por sessão ou valor do pacote |
| `agreement.sessionsPerMonth` | number | Frequência contratada; em pacote, é o nº de sessões incluídas |
| `agreement.chargeNoShow` | boolean | Padrão `false`. Se `true`, falta conta como sessão cobrável |

### `sessions`
| Campo | Tipo | Observação |
| :-- | :-- | :-- |
| `patientId` | string \| null | `null` = não identificado |
| `calendarEventId` | string | ID do documento; garante que sincronizar duas vezes não duplica |
| `startsAt` | timestamp | |
| `calendarTitle` | string | Título original do evento |
| `status` | `scheduled` \| `done` \| `no_show` \| `cancelled` | Definido pela Lays |
| `amountApplied` | number (centavos) | **Valor congelado** na criação da sessão |

### `payments`
| Campo | Tipo | Observação |
| :-- | :-- | :-- |
| `patientId` | string | |
| `amount` | number (centavos) | |
| `paidAt` | date | Data do Pix |
| `referenceMonth` | string `YYYY-MM` | Mês ao qual o pagamento se refere |
| `note` | string | Opcional |

Valores monetários são guardados em centavos (inteiros) para evitar erro de ponto flutuante.

## 5. Sincronização com o Google Agenda

1. A Lays clica em "Sincronizar agenda" na tela de Sessões, escolhendo o mês (padrão: mês atual).
2. O frontend chama `POST /api/admin/sync-calendar` com `{ month }` e o ID token.
3. O backend busca os eventos do mês e, para cada evento:
   - **Vínculo com paciente:** compara o título do evento com `patients.name`, sem diferenciar maiúsculas e acentos, por substring. Os eventos criados pelo site têm título `Consulta [serviço] - Nome`, que já casa.
   - Se exatamente **um** paciente casa: cria/atualiza a sessão com `patientId` e `amountApplied` (valor do acordo na criação).
   - Se **nenhum ou mais de um** casa: grava com `patientId = null` (aba "Não identificados").
4. **Regras de atualização:** só sessões ainda `scheduled` são atualizadas (horário, título). Sessões já marcadas como `done`, `no_show` ou `cancelled` nunca são alteradas pela sincronização. Eventos removidos do Agenda não apagam sessões existentes; ficam sinalizados na tela para decisão dela.
5. Sessões `scheduled` com data passada aparecem em "Pendentes de confirmação".

## 6. Regras de cálculo (mês de referência M)

- **Devido (por sessão):** soma de `amountApplied` das sessões `done` do mês; se `chargeNoShow = true`, também as `no_show`. `cancelled` nunca gera valor.
- **Devido (pacote):** `agreement.amount` do paciente no mês, independente do número de sessões. Se a agenda mostrar mais sessões `done` que `sessionsPerMonth`, o sistema exibe alerta, mas **não altera o valor**.
- **Recebido:** soma de `payments.amount` com `referenceMonth = M`.
- **A receber (M):** Devido(M) − Recebido(M), por paciente, nunca negativo na exibição (excedente aparece como crédito).
- **Em atraso:** soma de A receber de todos os meses **anteriores** a M com saldo positivo.
- **Previsto (por sessão):** `sessionsPerMonth × agreement.amount`, exibido ao lado do realizado.
- **Alerta de frequência (Fase 3):** paciente com sessões `done` do mês diferentes de `sessionsPerMonth`.

Esta lógica fica em funções puras e isoladas (sem acesso a Firestore), cobertas por testes unitários.

## 7. Telas

### Fase 1
- **Login.**
- **Pacientes:** lista com busca; formulário com nome, telefone, tipo de acordo, valor, sessões por mês e interruptor "cobrar faltas".
- **Sessões:** botão "Sincronizar agenda"; lista do mês com ações *Realizada / Faltou / Cancelada*; abas "Pendentes de confirmação" e "Não identificados" (onde ela vincula a um paciente).

### Fase 2
- **Pagamentos:** formulário de Pix (paciente, valor, data, mês de referência, observação) e histórico.
- **Resumo do mês:** cartões *Recebido*, *A receber*, *Em atraso* e tabela por paciente.

### Fase 3
- **Painel:** pacientes atendidos, sessões realizadas, faltas, cancelamentos, receita; previsto × realizado; gráfico simples dos últimos meses; alertas de frequência.

### Fase 4
- **Cobrança:** em cada devedor, botão que abre `wa.me/<telefone>` com mensagem pronta (nome e valor preenchidos). O envio é manual.

## 8. Segurança e privacidade (LGPD)

- **Acesso único:** `firestore.rules` permite leitura/escrita somente se `request.auth.uid` for o UID da Lays; todo o resto é negado.
- **Minimização:** apenas nome, telefone e dados financeiros. Nada clínico.
- **Região:** Firestore em `southamerica-east1`.
- **Backend:** `/api/admin/*` rejeita (401) requisições sem ID token válido do Firebase e com UID diferente do autorizado.
- **Segredos:** a service account continua em variáveis de ambiente/Secret Manager, nunca no frontend.

## 9. Tratamento de erros

- **Agenda indisponível ou falha de API:** mensagem clara; dados já salvos permanecem visíveis. O modo de simulação existente continua válido para desenvolvimento.
- **Sincronização repetida:** idempotente (chave `calendarEventId`).
- **Evento sem paciente ou ambíguo:** vai para "Não identificados"; nunca é descartado.
- **Falha ao gravar no Firestore:** o erro é exibido e a ação pode ser repetida; nada é marcado como salvo sem confirmação.

## 10. Testes

- **Cálculos financeiros (Vitest):** recebido, a receber, em atraso, pacote com excesso de sessões, `chargeNoShow`, cancelamento, crédito, virada de mês.
- **Vínculo evento → paciente (Vitest):** acento, caixa, zero/um/vários casamentos, formato `Consulta [serviço] - Nome`.
- **Regras do Firestore:** testadas no emulador (usuária autorizada acessa; anônimo e outro UID são negados).
- **Sincronização:** testada contra Agenda simulada (idempotência, não sobrescrever sessões confirmadas).

## 11. Premissas assumidas

- Os títulos dos eventos no Agenda contêm o nome do paciente (confirmar com a Lays ao implementar a Fase 1; se não, ajustamos a regra de vínculo).
- Volume pequeno (dezenas de pacientes), dentro do plano gratuito do Firebase.
- Moeda única: BRL.
