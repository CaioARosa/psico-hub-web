# Gestão do Consultório — Vínculo sessão → paciente — Design

Data: 2026-11-23 · Projeto: `psico-hub-web` · Usuária: Lays Coelho (única)

Complementa `2026-11-12-gestao-consultorio-design.md` (§5 "Vínculo com paciente" e §6 tela Sessões). Onde divergirem, **este vale**.

## 1. Objetivo

A Lays quase não precisar vincular sessões à mão e, quando precisar, conseguir sem ajuda.

### Contexto
- Ela cria os eventos no Agenda com o padrão `Psicoterapia <nome>`, e o nome costuma ser **mais curto** que o cadastrado (cadastro "Maria Aparecida Souza", título "Psicoterapia Maria" ou "Psicoterapia Maria Souza").
- A regra atual exige o nome cadastrado **inteiro** no título, então essas sessões caem em "Não identificados".
- O vínculo manual é feito sessão por sessão (seletor + botão dentro de cada cartão) e não é lembrado: no mês seguinte o mesmo título falha de novo.

### Decisões acordadas
- **Três regras automáticas, em ordem:** apelido aprendido → nome completo (regra atual) → nome parcial (nova). Só vincula com **um** candidato; empate vira sugestão.
- **Aprendizado:** todo vínculo manual guarda o título como apelido do paciente.
- **Tela agrupada por título**, com sugestão pré-selecionada e vínculo em lote.
- **"Trocar paciente"** em sessões agendadas já vinculadas, para corrigir vínculo automático errado.
- Risco aceito: compromisso pessoal ≤ 2h com o primeiro nome de um paciente (ex.: "Café com Maria") pode ser vinculado; a correção é "Trocar paciente".

### Fora de escopo
- Status "Reagendada" (spec separada, a seguir).
- Tela para ver/remover apelidos no cadastro do paciente.
- Aplicar o vínculo manual em outros meses na hora (eles resolvem na próxima sincronização).
- Casal/família com pagador diferente.

## 2. Modelo de dados

`patients` ganha um campo opcional:

| Campo | Tipo | Nota |
| :-- | :-- | :-- |
| `aliases` | string[] | Títulos normalizados (§3) vinculados à mão a este paciente. Ausente = `[]`. Sem migração |

- `Patient` (TS) ganha `aliases: string[]`; `patientFromDoc` lê `data.aliases` filtrando só strings (ausente → `[]`).
- `patientToDoc`/`newPatientDoc` **não** escrevem `aliases`; editar o paciente (`updateDoc` parcial) preserva o campo.
- Um mesmo apelido nunca fica em dois pacientes: quem grava um apelido o remove dos demais (§4).
- `sessions` não muda. `firestore.rules` não muda (regra atual é só admin).

## 3. Regras do vínculo automático

### Normalização
`normalizeTitle(text)`: NFD, remove diacríticos, minúsculas, todo caractere que não é letra/dígito vira espaço, colapsa espaços, `trim`. É o `toWords` atual de `server/lib/patient-matching.js`. Ex.: `"Psicoterapia  Mári!"` → `"psicoterapia mari"`.

### Ordem (só pacientes **ativos**)
Cada regra produz candidatos; a primeira regra com candidato **único** vence. Regra com 2+ candidatos empatados para a avaliação: sessão fica sem paciente (as regras seguintes não rodam).

1. **Apelido:** `normalizeTitle(título)` está em `aliases` do paciente.
2. **Nome completo:** regra atual de `findPatientForEvent` (nome inteiro como palavras contíguas no título; nomes contidos → vence o mais longo; homônimos → ambíguo).
3. **Nome parcial:** para cada paciente com palavras `N` (normalizadas), procura no título cada posição `i` onde `T[i] = N[0]` (primeiro nome). A partir dela, avança nas palavras do título enquanto cada palavra aparece em `N` depois da anterior (subsequência em ordem). Pontuação = número de palavras casadas, máximo entre as posições. Candidatos = pacientes com pontuação ≥ 1; vence a maior pontuação; empate na maior = ambíguo.

| Título | Ativos | Resultado |
| :-- | :-- | :-- |
| `Psicoterapia Maria` | Maria Aparecida Souza, João Lima | Maria Aparecida Souza (regra 3) |
| `Psicoterapia Maria Souza` | Maria Aparecida Souza, Maria Lima | Maria Aparecida Souza (2 × 1) |
| `Psicoterapia Maria` | Maria Aparecida Souza, Maria Lima | ambíguo → sem paciente |
| `Psicoterapia Souza` | Maria Aparecida Souza | sem paciente (sem primeiro nome) |
| `Psicoterapia Mariana` | Maria Souza | sem paciente (palavra inteira) |
| `Psicoterapia Mari` | Mariana (apelido `psicoterapia mari`) | Mariana (regra 1) |
| `Consulta [Individual] - Ana Paula` | Ana, Ana Paula | Ana Paula (regra 2, inalterada) |

### Onde vive
- **Servidor:** `server/lib/patient-matching.js` — `normalizeTitle`, `findPatientForEvent(title, patients)` passa a aplicar as três regras (mesma assinatura, devolve id ou `null`).
- **Front:** `src/app/pages/admin/domain/patient-matching.ts` espelha a regra (como `money.ts` espelha o servidor) e expõe:
  - `normalizeTitle(text): string`
  - `suggestPatients(title, patients): Patient[]` — candidatos da primeira regra que tiver algum (único ou empatados; na regra 3, só os de maior pontuação), em ordem de nome. Vazio se nenhuma regra tem candidato.

### Sincronização (`planSessionSync`)
- Usa o novo `findPatientForEvent` na criação e na nova tentativa de sessões `scheduled` sem paciente (pontos já existentes).
- `summary` ganha `autoLinked`: sessões que saem desta sincronização com paciente que não tinham antes (criadas já vinculadas + sem paciente que passaram a casar).
- **Correção (`firestore-repo.js`, `resolveUpsertWrite`):** upsert de criação sobre doc existente `scheduled` com `patientId` nulo passa a gravar também `patientId`, `amountApplied` e `packageAmountApplied` do upsert quando `patientId` não é nulo. Doc existente com paciente continua só com `startsAt`, `calendarTitle`, `missingFromCalendar`.

## 4. Vínculo manual e aprendizado (front)

`SessionsService` troca `linkPatient(id, patient)` por:

- `linkTitle(title: string, patient: Patient): Promise<number>` — num único `writeBatch`:
  1. toda sessão do mês observado com `patientId = null`, `status = 'scheduled'` e `normalizeTitle(calendarTitle) = normalizeTitle(title)` recebe `patientId` e `pricingForAgreement(patient.agreement)`;
  2. `patients/{patient.id}`: `aliases` ← `arrayUnion(chave)`;
  3. todo outro paciente que tem a chave: `aliases` ← `arrayRemove(chave)`.
  Devolve quantas sessões vinculou. Chave vazia (título só com pontuação) não vira apelido; as sessões são vinculadas mesmo assim.
- `changePatient(id: string, patient: Patient): Promise<void>` — só para sessão conhecida `scheduled` com paciente (senão erro); mesmo batch: sessão recebe `patientId` + preço do novo paciente; a chave do título vai para o novo paciente e sai dos demais.

Erros seguem `runWrite`/`SAVE_ERROR`.

## 5. Tela Sessões

### Aviso no topo
Com ≥1 sessão sem paciente no mês, em qualquer aba: alerta "N sessão(ões) sem paciente neste mês." com botão **Resolver agora** que ativa a aba "Não identificados".

### Aba "Não identificados" — agrupada por título
`groupUnidentified(sessions, patients): UnidentifiedGroup[]` (domínio, puro): agrupa sessões `patientId = null` pela chave normalizada; cada grupo tem `key`, `title` (o `calendarTitle` da primeira), `sessions` (ordenadas), `suggestions` (`suggestPatients`). Grupos em ordem da primeira sessão.

Cartão por grupo:
- Título do evento e "N sessões · 3, 10, 17 e 24/nov".
- Seletor de paciente ativo, **pré-selecionado** quando há sugestão única; sugestões aparecem primeiro na lista, marcadas "Sugestão".
- Botão **Vincular N sessões** (singular com 1), desabilitado sem seleção.
- Microcopy: "As próximas sessões \"<título>\" serão vinculadas automaticamente."
- Link **Paciente novo? Cadastrar paciente** → `/admin/pacientes?novo=<nome>`; com nenhuma sugestão, o link ganha destaque. `<nome>` = título sem o prefixo `Psicoterapia` ou `Consulta [..] -` (`nameFromTitle`, domínio).
- Sessão do grupo com `missingFromCalendar` mantém **Remover** (comportamento atual).

`PatientsComponent`: com query param `novo`, abre o formulário de criação com o nome preenchido e limpa o param.

### Aba "Todas" e "Pendentes"
- Sessão sem paciente: em vez do seletor, selo **Sem paciente** e link **Resolver** (ativa a aba "Não identificados").
- Sessão `scheduled` com paciente: ação discreta **Trocar paciente** que abre seletor + **Salvar** no próprio cartão e chama `changePatient`.

### Resumo da sincronização
`syncSummary`: `3 novas · 2 vinculadas automaticamente · 1 sem paciente · 0 removidas do Agenda` (`autoLinked` ausente → 0; singular/plural como hoje).

### Notas existentes
`unlinkedNote` (Painel/Financeiro) não muda.

## 6. Testes

- **Servidor (`node --test`):** `patient-matching.test.js` — tabela do §3, ordem das regras (apelido vence nome parcial; empate numa regra não cai na seguinte), inativos ignorados, apelido em inativo ignorado. `calendar-sync.test.js` — `autoLinked` na criação e na nova tentativa. `firestore-repo.test.js` — correção do `resolveUpsertWrite`.
- **Domínio TS:** `patient-matching.spec.ts` (mesma tabela + `suggestPatients`), `groupUnidentified`, `nameFromTitle`, `syncSummary`, `patientFromDoc` com/sem `aliases`.
- **Componente Sessões:** aviso e "Resolver agora"; cartão agrupado com pré-seleção; "Vincular N sessões" chama `linkTitle`; selo "Sem paciente" na aba Todas; "Trocar paciente" chama `changePatient`.
- **Pacientes:** `?novo=Maria` abre o formulário com o nome.

## 7. Ordem de implementação

1. Servidor: regras + `autoLinked` + correção do repo.
2. Domínio TS: `patient-matching.ts`, `groupUnidentified`, `nameFromTitle`, `aliases` no modelo, `syncSummary`.
3. `SessionsService`: `linkTitle` e `changePatient`.
4. Tela Sessões (aviso, aba agrupada, selo, trocar paciente) e `?novo=` em Pacientes.
5. Manual do usuário: atualizar a seção de Sessões.
