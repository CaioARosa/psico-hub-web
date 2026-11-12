# Gestão do Consultório — Fase 1 (Núcleo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a área privada `/admin` com login, cadastro de pacientes (com acordo financeiro) e sessões sincronizadas do Google Agenda, que a Lays confirma como realizada, faltou ou cancelada.

**Architecture:** Frontend Angular lê/escreve direto no Firestore (protegido por regras com custom claim `admin`). O backend Express ganha só `POST /api/admin/sync-calendar`, que lê o Google Agenda e grava `sessions` via `firebase-admin`. Lógica de negócio fica em funções puras (backend em `server/lib/`, frontend em `src/app/pages/admin/domain/`), testadas isoladamente.

**Tech Stack:** Angular 21 (standalone, signals), Tailwind v4, Zard UI, Vitest (`ng test`), SDK `firebase` (modular), Express 4, `firebase-admin`, `node --test`, emulador do Firestore.

**Spec:** `docs/superpowers/specs/2026-11-12-gestao-consultorio-design.md` (seções 3, 4, 5, 7 "Fase 1", 8, 9, 10). As Fases 2–4 têm planos próprios, depois.

## Pré-requisitos (antes da Task 1)

- A árvore de trabalho tem mudanças **não commitadas suas** em `README.md`, `firebase.json`, `package.json`, `server/server.js`, `src/app/app.routes.ts`, `booking.service.ts`, além de `server/Dockerfile`, `server/.dockerignore` e `src/app/pages/feed-generator/`. As tasks 1, 4, 6 e 9 editam vários deles. **Commite ou guarde essas mudanças primeiro** (ou rode o plano numa worktree criada depois disso), para não misturar com este trabalho.
- **JDK 11+** instalado (o emulador do Firestore exige; hoje `java` não existe nesta máquina). Verificar: `java -version`.
- Node 20+ (a máquina tem v24).

## Global Constraints

- Valores monetários em **centavos inteiros** (spec §4); moeda BRL.
- Firestore na região `southamerica-east1`; coleções `patients`, `sessions`, `payments` com os campos da spec §4. Nada clínico é armazenado (spec §8).
- `sessions` usa `calendarEventId` como **ID do documento** (idempotência, spec §4/§5).
- Janela do mês e horários em **UTC-3 fixo** (`-03:00`), como o `server.js` já faz.
- Só sessões `scheduled` são alteradas pela sincronização; `done`/`no_show`/`cancelled` nunca (spec §5).
- Acesso: custom claim `admin: true`; regras negam tudo sem o claim; `/api/admin/*` responde 401 sem token válido e 403 sem o claim (spec §8).
- Frontend: componentes standalone com `ChangeDetectionStrategy.OnPush` e signals, rotas com `loadComponent`/`loadChildren`, alias `@/*` → `src/app/*`, `inject()` em vez de construtor, estilo Tailwind/Zard como `links.component.ts` (spec §3).
- Backend: CommonJS, sem TypeScript, sem dependências novas além de `firebase-admin`.
- Textos de interface em português do Brasil.
- Toda escrita no Firestore que falhar mostra mensagem de erro e permite repetir; nada aparece como salvo sem confirmação (spec §9).
- Commits em inglês, estilo convencional (`feat(admin): ...`), como o histórico do repositório.

## Review Focus

Entradas que a spec implica, mas nenhuma task testaria por conta própria (cada uma tem seu teste na task indicada):

1. **Evento de dia inteiro** no Agenda (`start.date`, sem `dateTime`) não é uma sessão e não pode quebrar a sincronização nem virar sessão (Task 3).
2. **Nomes contidos um no outro** ("Ana" e "Ana Paula"): o título "Consulta [Individual] - Ana Paula" deve vincular à Ana Paula, não ir para "não identificados" (Task 2).
3. **Virada de fuso/mês:** um evento em `2026-12-01T01:00:00Z` é 30/11 22:00 em UTC-3 e pertence a novembro (Task 3).
4. **Valor digitado em formato brasileiro** (`150,50`, `R$ 1.500`, vazio) vira centavos corretos ou erro claro, nunca `NaN` (Task 5).
5. **Sessão não identificada** não pode ser marcada como realizada antes de vincular um paciente (Task 8).

---

## File Structure

**Backend (`server/`)**
- `lib/patient-matching.js` — `normalizeText`, `findPatientForEvent`, `amountForNewSession` (puras)
- `lib/calendar-sync.js` — `monthWindow`, `planSessionSync` (pura), `syncMonth` (orquestra com `repo` e `calendar` injetados)
- `lib/firestore-repo.js` — `createFirestoreRepo(db)`: adaptador Firestore do `repo`
- `lib/admin-auth.js` — `requireAdmin({ verifyIdToken })` (middleware)
- `lib/firebase.js` — inicialização lazy do `firebase-admin` (`getAuth`, `getDb`)
- `scripts/grant-admin.js` — script único: dá o claim `admin` a um e-mail
- `server.js` — registra a rota (edição)
- `*.test.js` ao lado de cada módulo

**Regras e infra (raiz)**
- `firestore.rules`, `firebase.json` (edição), `test/firestore-rules/rules.test.mjs`

**Frontend (`src/app/pages/admin/`)**
- `domain/models.ts`, `domain/money.ts`, `domain/sessions-view.ts` (+ `.spec.ts`)
- `data/firebase.ts` — tokens `FIREBASE_AUTH`, `FIRESTORE`; `data/firebase-config.ts`
- `data/auth.service.ts`, `data/auth.guard.ts`
- `data/patients.service.ts`, `data/sessions.service.ts`, `data/calendar-sync.service.ts`
- `admin.routes.ts`, `admin-shell.component.ts`
- `login/login.component.ts`
- `patients/patients.component.ts`, `patients/patient-form.component.ts`
- `sessions/sessions.component.ts`

---

### Task 1: Regras do Firestore e emulador

**Files:**
- Create: `firestore.rules`, `test/firestore-rules/rules.test.mjs`
- Modify: `firebase.json` (blocos `firestore` e `emulators`), `package.json` (devDependency `@firebase/rules-unit-testing`, script `test:rules`)

**Interfaces:**
- Produces: script `npm run test:rules` verde; `firestore.rules` com `allow read, write: if request.auth != null && request.auth.token.admin == true;` em `match /{document=**}`.

- [ ] **Step 1: Instalar e configurar.** `npm i -D @firebase/rules-unit-testing`; adicionar em `firebase.json` `"firestore": { "rules": "firestore.rules" }` e `"emulators": { "firestore": { "port": 8080 }, "singleProjectMode": true }`; script `"test:rules": "npx firebase-tools emulators:exec --only firestore --project demo-psico-hub \"node --test test/firestore-rules\""`.
- [ ] **Step 2: Escrever os testes (falham: não há regras).** Em `rules.test.mjs`, com `initializeTestEnvironment` carregando `firestore.rules`: `admin lê e escreve patients, sessions e payments` (contexto `authenticatedContext('u1', { admin: true })`, usa `assertSucceeds`); `usuário autenticado sem claim admin é negado` (`authenticatedContext('u2')`, `assertFails` em leitura e escrita de `patients/x`); `anônimo é negado` (`unauthenticatedContext()`); `coleção desconhecida é negada para não-admin`.
- [ ] **Step 3: Rodar e ver falhar.** `npm run test:rules` → FAIL (arquivo de regras ausente/vazio).
- [ ] **Step 4: Criar `firestore.rules`** (`rules_version = '2'`) com a regra única descrita em Interfaces.
- [ ] **Step 5: Rodar e ver passar.** `npm run test:rules` → 4 testes PASS.
- [ ] **Step 6: Commit.** `git add firestore.rules firebase.json package.json package-lock.json test/ && git commit -m "feat(admin): add firestore security rules with admin claim"`

---

### Task 2: Vínculo evento → paciente (backend)

**Files:**
- Create: `server/lib/patient-matching.js`, `server/lib/patient-matching.test.js`
- Modify: `server/package.json` (script `"test": "node --test"`)

**Interfaces:**
- Produces:
  - `normalizeText(text: string): string` — minúsculas, sem acentos (NFD), espaços colapsados, trim.
  - `findPatientForEvent(title: string, patients: Array<{ id: string, name: string, active: boolean }>): string | null`
  - `amountForNewSession(agreement: { type: 'per_session' | 'monthly_package', amount: number } | null): number`

- [ ] **Step 1: Escrever os testes (falham).** Em `patient-matching.test.js` (`node:test` + `node:assert/strict`): `normalizeText remove acento, caixa e espaços duplicados` (`'  JOSÉ   Antônio '` → `'jose antonio'`); `casa título do site` (`'Consulta [Individual] - Maria Souza'` com paciente "Maria Souza" → id dela); `ignora acento e caixa` ("josé" casa "JOSE"); `retorna null sem casamento`; `retorna null para ambiguidade real` (dois pacientes casam e nenhum nome contém o outro, ex.: "Ana Lima" e "Ana Souza" em "Ana"? — usar título `'Consulta - Ana Lima e Ana Souza'`); `nomes contidos: vence o mais longo` ("Ana" e "Ana Paula" em `'Consulta [Casal] - Ana Paula'` → id da Ana Paula); `ignora pacientes inativos`; `amountForNewSession`: `per_session` com 15000 → `15000`, `monthly_package` → `0`, `null` → `0`.
- [ ] **Step 2: Ver falhar.** `cd server && node --test lib/patient-matching.test.js` → FAIL (módulo não existe).
- [ ] **Step 3: Implementar** as 3 funções em `patient-matching.js` (`module.exports`). Regra de `findPatientForEvent`: considerar só `active`; normalizar título e nomes; candidatos = nomes contidos no título; 0 → `null`; 1 → ele; vários → o de nome mais longo **se** o nome normalizado dele contiver os de todos os outros candidatos, senão `null`.
- [ ] **Step 4: Ver passar.** Mesmo comando → todos PASS.
- [ ] **Step 5: Commit.** `git add server/lib/patient-matching.* server/package.json && git commit -m "feat(server): add event-to-patient matching"`

---

### Task 3: Planejamento e orquestração da sincronização (backend)

**Files:**
- Create: `server/lib/calendar-sync.js`, `server/lib/calendar-sync.test.js`

**Interfaces:**
- Consumes: `findPatientForEvent`, `amountForNewSession` (Task 2).
- Produces:
  - `monthWindow(month: string): { start: Date, end: Date }` — `month` em `YYYY-MM`; `start` = dia 1 às 00:00 `-03:00`, `end` = dia 1 do mês seguinte às 00:00 `-03:00`; lança `Error('Mês inválido. Formato esperado: YYYY-MM.')` se inválido.
  - `planSessionSync({ events, patients, existingSessions, window }): { upserts: Array<{ id: string, data: object }>, summary: { created: number, updated: number, unidentified: number, missing: number } }`
    - `events`: itens do `events.list` do googleapis (`{ id, status, summary, start: { dateTime?, date? } }`).
    - `patients`: `{ id, name, active, agreement }[]`; `existingSessions`: `{ id, patientId, status, startsAt: Date, missingFromCalendar: boolean }[]`.
    - Criação → `data` = `{ patientId, calendarEventId, startsAt, calendarTitle, status: 'scheduled', amountApplied, missingFromCalendar: false }`. Atualização de sessão existente `scheduled` → `{ startsAt, calendarTitle, missingFromCalendar: false }` + (`patientId`, `amountApplied` só se estava `null` e agora casou). Sessão `scheduled` na janela ausente dos eventos → `{ missingFromCalendar: true }`.
  - `syncMonth({ month, calendar, calendarId, repo }): Promise<summary>` com `repo` = `{ listPatients(): Promise<patient[]>, listSessionsBetween(start: Date, end: Date): Promise<session[]>, applyUpserts(upserts): Promise<void> }`; chama `calendar.events.list({ calendarId, timeMin, timeMax, singleEvents: true, orderBy: 'startTime', maxResults: 2500 })`.

- [ ] **Step 1: Escrever os testes de `planSessionSync` e `monthWindow` (falham).** `monthWindow('2026-11')` → `start` `2026-11-01T03:00:00.000Z`, `end` `2026-12-01T03:00:00.000Z`; `monthWindow('2026-13')` e `'novembro'` lançam. `planSessionSync`: `cria sessão para evento que casa` (valor `15000` em `per_session`; `0` em `monthly_package`); `evento sem paciente vira patientId null e conta em unidentified`; `ignora evento de dia inteiro` (`start: { date: '2026-11-10' }`); `ignora evento cancelado` (`status: 'cancelled'`); `evento em 2026-12-01T01:00:00Z entra em novembro` e `um em 2026-12-01T04:00:00Z fica de fora`; `sessão existente scheduled atualiza horário e título e preserva patientId e amountApplied`; `não altera sessão done, no_show ou cancelled` (nenhum upsert para elas, mesmo com horário diferente); `sessão scheduled sem paciente tenta vincular de novo`; `sessão scheduled ausente do Agenda recebe missingFromCalendar true` e `done` ausente não recebe; `rodar duas vezes seguidas com as sessões resultantes não gera novos created` (idempotência).
- [ ] **Step 2: Ver falhar.** `cd server && node --test lib/calendar-sync.test.js` → FAIL.
- [ ] **Step 3: Implementar `monthWindow` e `planSessionSync`** (puras; `id` do upsert = `event.id`).
- [ ] **Step 4: Ver passar.**
- [ ] **Step 5: Teste de `syncMonth` com falsos (falha).** `syncMonth chama o Agenda com a janela do mês, passa pacientes e sessões ao planejamento e aplica os upserts` (calendar e repo falsos guardando chamadas; asserir `timeMin`/`timeMax` ISO, `singleEvents: true`, `applyUpserts` chamado uma vez, retorno = `summary`); `syncMonth propaga erro do Agenda sem chamar applyUpserts`.
- [ ] **Step 6: Implementar `syncMonth`; ver passar.** `cd server && npm test` → tudo PASS.
- [ ] **Step 7: Commit.** `git add server/lib/calendar-sync.* && git commit -m "feat(server): add calendar sync planning"`

---

### Task 4: Autenticação admin, Firestore e rota de sincronização (backend)

**Files:**
- Create: `server/lib/admin-auth.js`, `server/lib/admin-auth.test.js`, `server/lib/firebase.js`, `server/lib/firestore-repo.js`, `server/scripts/grant-admin.js`
- Modify: `server/server.js` (registrar rota), `server/package.json` (dependência `firebase-admin`), `server/Dockerfile` (`COPY lib ./lib`)

**Interfaces:**
- Consumes: `syncMonth` (Task 3).
- Produces:
  - `requireAdmin({ verifyIdToken }: { verifyIdToken: (token: string) => Promise<{ admin?: boolean }> }): express middleware` — lê `Authorization: Bearer <token>`; sem header ou token inválido → `401 { error }`; válido sem `admin === true` → `403 { error }`; ok → `next()`.
  - `getAuth()` / `getDb()` em `firebase.js` (lazy; `projectId` de `FIREBASE_PROJECT_ID`, padrão `psico-hub-lays`).
  - `createFirestoreRepo(db): repo` (contrato da Task 3; converte `Timestamp` ↔ `Date`; `applyUpserts` usa batch com `set(..., { merge: true })` em `sessions/{id}`, em lotes de até 400).
  - `POST /api/admin/sync-calendar` (e `/admin/sync-calendar`): body `{ month }` → `200 summary`; `400` mês inválido; `503 { error: 'Google Agenda não configurado.' }` se `!calendar`; `500` em falha do Agenda/Firestore.

- [ ] **Step 1: Escrever os testes do middleware (falham).** `401 sem header Authorization`, `401 quando verifyIdToken rejeita`, `403 quando o token não tem admin`, `chama next e expõe req.admin quando admin é true` (req/res falsos).
- [ ] **Step 2: Ver falhar; implementar `admin-auth.js`; ver passar.**
- [ ] **Step 3: Instalar** `cd server && npm i firebase-admin`.
- [ ] **Step 4: Implementar `firebase.js`, `firestore-repo.js`** e a rota em `server.js` (usar `requireAdmin({ verifyIdToken: t => getAuth().verifyIdToken(t) })`, `syncMonth` com `calendar`, `calendarId` e `createFirestoreRepo(getDb())` já existentes no arquivo). Adicionar `COPY lib ./lib` ao `Dockerfile`.
- [ ] **Step 5: Implementar `scripts/grant-admin.js`:** uso `node scripts/grant-admin.js <email>`; busca o usuário por e-mail e chama `setCustomUserClaims(uid, { admin: true })`; imprime confirmação; sai com código 1 e mensagem se o e-mail não existe ou falta o argumento.
- [ ] **Step 6: Verificação manual da rota.** Subir `cd server && npm start` e rodar `curl -s -o NUL -w "%{http_code}" -X POST http://localhost:3000/api/admin/sync-calendar -H "Content-Type: application/json" -d "{\"month\":\"2026-11\"}"` → `401`. `npm test` → tudo PASS.
- [ ] **Step 7: Commit.** `git add server/ && git commit -m "feat(server): add admin calendar sync endpoint"`

---

### Task 5: Modelos e dinheiro (frontend)

**Files:**
- Create: `src/app/pages/admin/domain/models.ts`, `src/app/pages/admin/domain/money.ts`, `src/app/pages/admin/domain/money.spec.ts`

**Interfaces:**
- Produces (`models.ts`):
  - `type AgreementType = 'per_session' | 'monthly_package'`
  - `interface Agreement { type: AgreementType; amount: number; sessionsPerMonth: number; chargeNoShow: boolean }`
  - `interface Patient { id: string; name: string; phone: string; active: boolean; agreement: Agreement }`
  - `type SessionStatus = 'scheduled' | 'done' | 'no_show' | 'cancelled'`
  - `interface Session { id: string; patientId: string | null; startsAt: Date; calendarTitle: string; status: SessionStatus; amountApplied: number; missingFromCalendar: boolean }`
- Produces (`money.ts`):
  - `parseBRLToCents(input: string): number | null` — aceita `150`, `150,5`, `150,50`, `R$ 1.500`, `1.500,00`; vazio, negativo, letras ou mais de 2 casas → `null`.
  - `formatCents(cents: number): string` — `15000` → `R$ 150,00` (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`).
  - `amountForNewSession(agreement: Agreement | null): number` — mesma regra do backend (`per_session` → `amount`; senão `0`).

- [ ] **Step 1: Escrever os testes (falham).** `parseBRLToCents`: `'150'`→`15000`, `'150,5'`→`15050`, `'150,50'`→`15050`, `'R$ 1.500'`→`150000`, `'1.500,00'`→`150000`, `''`→`null`, `'abc'`→`null`, `'-10'`→`null`, `'10,999'`→`null`. `formatCents(15000)` contém `150,00`. `amountForNewSession`: `per_session`/15000 → `15000`; `monthly_package` → `0`; `null` → `0`.
- [ ] **Step 2: Ver falhar.** `npx ng test --watch=false --include "src/app/pages/admin/domain/money.spec.ts"` → FAIL.
- [ ] **Step 3: Implementar** `models.ts` e `money.ts`.
- [ ] **Step 4: Ver passar** (mesmo comando).
- [ ] **Step 5: Commit.** `git add src/app/pages/admin/domain && git commit -m "feat(admin): add domain models and money helpers"`

---

### Task 6: Firebase, login, guard e shell de `/admin`

**Files:**
- Create: `data/firebase-config.ts`, `data/firebase.ts`, `data/auth.service.ts`, `data/auth.guard.ts`, `data/auth.guard.spec.ts`, `admin.routes.ts`, `admin-shell.component.ts`, `login/login.component.ts` (tudo em `src/app/pages/admin/`)
- Modify: `package.json` (dependência `firebase`), `src/app/app.routes.ts` (rota `admin` antes de `**`)

**Interfaces:**
- Produces:
  - `FIREBASE_AUTH: InjectionToken<Auth>`, `FIRESTORE: InjectionToken<Firestore>` (factory inicializa o app com `firebaseConfig`; Firestore com `getFirestore(app)`).
  - `AuthService`: `user: Signal<User | null>`, `whenReady(): Promise<void>` (resolve após o primeiro `onAuthStateChanged`), `login(email: string, password: string): Promise<void>`, `logout(): Promise<void>`, `getIdToken(): Promise<string>`.
  - `authGuard: CanActivateFn` — espera `whenReady()`; logado → `true`; senão `UrlTree` para `/admin/login`.
  - Rotas: `/admin/login` (público) e `/admin` (shell, `canActivate: [authGuard]`) com filhos `pacientes`, `sessoes` e redirect vazio → `sessoes`. Shell: navegação *Pacientes* / *Sessões* e botão *Sair*.

- [ ] **Step 1: Instalar** `npm i firebase`. Criar `firebase-config.ts` exportando `firebaseConfig` com as chaves **públicas** do app web (copiar do console: Configurações do projeto → Seus apps; a Lays/você registra o app web uma vez).
- [ ] **Step 2: Escrever os testes do guard (falham).** `authGuard permite acesso quando há usuário` e `authGuard redireciona para /admin/login quando não há usuário` (`TestBed` com `AuthService` falso: `whenReady` resolvido e `user` como signal; `Router` real com `provideRouter([])`; executar com `TestBed.runInInjectionContext`).
- [ ] **Step 3: Ver falhar.** `npx ng test --watch=false --include "src/app/pages/admin/data/auth.guard.spec.ts"` → FAIL.
- [ ] **Step 4: Implementar** `firebase.ts`, `auth.service.ts`, `auth.guard.ts`.
- [ ] **Step 5: Ver passar.**
- [ ] **Step 6: Implementar** `login.component.ts` (e-mail, senha, botão *Entrar*, mensagem de erro em PT-BR para credenciais inválidas; sucesso navega para `/admin`), `admin-shell.component.ts` e `admin.routes.ts`; registrar em `app.routes.ts`: `{ path: 'admin', loadChildren: () => import('./pages/admin/admin.routes').then(m => m.ADMIN_ROUTES) }`.
- [ ] **Step 7: Verificação.** `npm run build` sem erros; `npm start`, abrir `http://localhost:4200/admin` → redireciona para `/admin/login`.
- [ ] **Step 8: Commit.** `git add package.json package-lock.json src/app && git commit -m "feat(admin): add firebase auth, guard and admin shell"`

---

### Task 7: Pacientes (lista, busca e formulário)

**Files:**
- Create: `data/patients.service.ts`, `patients/patients.component.ts`, `patients/patient-form.component.ts`, `domain/patient-form.ts`, `domain/patient-form.spec.ts` (em `src/app/pages/admin/`)

**Interfaces:**
- Consumes: `Patient`, `Agreement`, `parseBRLToCents`, `FIRESTORE`.
- Produces:
  - `interface PatientFormValue { name: string; phone: string; type: AgreementType; amount: string; sessionsPerMonth: string; chargeNoShow: boolean }`
  - `toPatientInput(value: PatientFormValue): { ok: true, value: Omit<Patient, 'id' | 'active'> } | { ok: false, errors: Partial<Record<'name' | 'phone' | 'amount' | 'sessionsPerMonth', string>> }` — nome obrigatório (trim); telefone obrigatório; `amount` via `parseBRLToCents` (inválido → erro); `sessionsPerMonth` inteiro ≥ 1.
  - `PatientsService`: `patients: Signal<Patient[]>` (listener em tempo real de `patients` ordenado por `name`), `create(input): Promise<void>`, `update(id: string, input): Promise<void>`, `setActive(id: string, active: boolean): Promise<void>`. Novo paciente nasce `active: true`.

- [ ] **Step 1: Escrever os testes de `toPatientInput` (falham).** `aceita valores válidos e converte o valor para centavos` (`'150,50'` → `15050`, `sessionsPerMonth: '4'` → `4`); `rejeita nome vazio`; `rejeita valor inválido`; `rejeita sessões por mês zero, negativo ou decimal`; `preserva o tipo monthly_package e chargeNoShow`.
- [ ] **Step 2: Ver falhar → implementar `patient-form.ts` → ver passar.** `npx ng test --watch=false --include "src/app/pages/admin/domain/patient-form.spec.ts"`
- [ ] **Step 3: Implementar `PatientsService`** (Firestore: `onSnapshot` para o signal; `addDoc`/`updateDoc`).
- [ ] **Step 4: Implementar `patients.component.ts`** (busca por nome sem acento/caixa; lista com nome, acordo resumido via `formatCents` e sessões/mês; botões *Novo*, *Editar*, *Inativar/Reativar*; inativos escondidos por padrão com opção *mostrar inativos*) e `patient-form.component.ts` (campos da spec §7, interruptor *Cobrar faltas*, erros por campo).
- [ ] **Step 5: Verificação manual.** `npm start`, logar, criar um paciente "Maria Souza" com `per_session`, `R$ 150,00`, `4` sessões/mês → aparece na lista e persiste ao recarregar.
- [ ] **Step 6: Commit.** `git add src/app/pages/admin && git commit -m "feat(admin): add patients management"`

---

### Task 8: Sessões (sincronizar, confirmar, vincular)

**Files:**
- Create: `data/sessions.service.ts`, `data/calendar-sync.service.ts`, `domain/sessions-view.ts`, `domain/sessions-view.spec.ts`, `sessions/sessions.component.ts` (em `src/app/pages/admin/`)

**Interfaces:**
- Consumes: `Session`, `Patient`, `amountForNewSession`, `AuthService.getIdToken`, `FIRESTORE`.
- Produces:
  - `groupSessions(sessions: Session[], now: Date): { all: Session[]; pending: Session[]; unidentified: Session[] }` — `all` ordenado por `startsAt` crescente; `pending` = `scheduled`, com paciente, `startsAt < now`; `unidentified` = `patientId === null`.
  - `canConfirm(session: Session): boolean` — `false` se `patientId === null`.
  - `SessionsService`: `sessionsOfMonth(month: string): Signal<Session[]>` (listener em `sessions` com `startsAt` na janela do mês em UTC-3), `setStatus(id: string, status: Exclude<SessionStatus, 'scheduled'>): Promise<void>` (recusa se `!canConfirm`), `linkPatient(id: string, patient: Patient): Promise<void>` (grava `patientId` e `amountApplied = amountForNewSession(patient.agreement)`), `clearMissing(id: string): Promise<void>` (grava `missingFromCalendar: false`).
  - `CalendarSyncService.sync(month: string): Promise<{ created: number; updated: number; unidentified: number; missing: number }>` — `POST` em `${apiUrl}/admin/sync-calendar` (mesmo `apiUrl` do `BookingService`) com `Authorization: Bearer <idToken>`; erro HTTP → rejeita com mensagem em PT-BR (503 → "Google Agenda não configurado.", demais → "Falha ao sincronizar a agenda. Tente novamente.").

- [ ] **Step 1: Escrever os testes de `groupSessions`/`canConfirm` (falham).** `all vem ordenado por data`; `pending só inclui scheduled passadas com paciente`; `unidentified inclui sessões sem paciente de qualquer status`; `canConfirm é false sem paciente e true com paciente`.
- [ ] **Step 2: Ver falhar → implementar `sessions-view.ts` → ver passar.** `npx ng test --watch=false --include "src/app/pages/admin/domain/sessions-view.spec.ts"`
- [ ] **Step 3: Implementar `SessionsService` e `CalendarSyncService`.**
- [ ] **Step 4: Implementar `sessions.component.ts`:** seletor de mês (padrão mês atual); botão *Sincronizar agenda* com estado de carregando e resumo do resultado ("3 novas, 1 sem paciente"); abas *Todas*, *Pendentes de confirmação*, *Não identificados*; ações *Realizada / Faltou / Cancelada* desabilitadas quando `!canConfirm`; em *Não identificados*, um seletor de paciente (ativos) que chama `linkPatient`; sessões com `missingFromCalendar` mostram selo "Removida do Agenda" com ações *Manter* (`clearMissing`) e *Cancelar sessão* (`setStatus(id, 'cancelled')`, desabilitada se `!canConfirm`).
- [ ] **Step 5: Verificação ponta a ponta local.** Backend em modo simulação responde 503 → a tela mostra "Google Agenda não configurado."; com credenciais reais e o emulador/projeto, sincronizar traz as sessões do mês.
- [ ] **Step 6: Commit.** `git add src/app/pages/admin && git commit -m "feat(admin): add sessions sync and confirmation"`

---

### Task 9: Ativação em produção e documentação

**Files:**
- Modify: `README.md` (seção "Área de Gestão (`/admin`)": rota, pré-requisitos, `npm run test:rules`, `npm test` no backend, variáveis `FIREBASE_PROJECT_ID`), `server/.env.example` (`FIREBASE_PROJECT_ID`)

**Interfaces:**
- Consumes: tudo acima.
- Produces: ambiente de produção funcionando com a conta da Lays.

- [ ] **Step 1: Provisionar (manual, uma vez, no console/CLI):** (a) criar o banco Firestore em `southamerica-east1`; (b) ativar Authentication → método E-mail/senha e criar o usuário da Lays; (c) `cd server && node scripts/grant-admin.js <email-da-lays>` com credenciais do projeto (`gcloud auth application-default login`); (d) dar à service account do Cloud Run `psico-hub-backend` o papel `roles/datastore.user`; (e) `firebase deploy --only firestore:rules`.
- [ ] **Step 2: Deploy.** `npm run deploy:all`.
- [ ] **Step 3: Verificação em produção.** `https://<domínio>/admin` → login da Lays → cadastrar 1 paciente → *Sincronizar agenda* → as sessões do mês aparecem → marcar uma como *Realizada*. Em janela anônima, `/admin/sessoes` redireciona para o login e uma leitura direta ao Firestore sem login falha.
- [ ] **Step 4: Documentar** no README e `.env.example`.
- [ ] **Step 5: Rodar tudo.** `npm test` (se aplicável `npx ng test --watch=false`), `cd server && npm test`, `npm run test:rules` → verdes; `npm run build` sem erros.
- [ ] **Step 6: Commit.** `git add README.md server/.env.example && git commit -m "docs(admin): document management area setup"`
