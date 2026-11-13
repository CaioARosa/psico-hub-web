# Lays Coelho · Psicoterapia Sistêmica (`psico-hub-web`)

Plataforma web profissional e interativa da psicóloga clínica **Lays Coelho (CRP 04/67406)**, especialista em Psicoterapia Sistêmica. Desenvolvida para oferecer uma experiência acolhedora aos pacientes, permitindo agendamento direto de consultas online (individuais, de casal e familiares), consulta de horários em tempo real integrados ao Google Agenda, página de links para redes sociais e gerador de mídias para divulgação no Instagram.

---

## Sumário

- [Visão Geral e Funcionalidades](#visão-geral-e-funcionalidades)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Pré-requisitos](#pré-requisitos)
- [Começando (Guia Rápido)](#começando-guia-rápido)
  - [1. Clonar o Repositório](#1-clonar-o-repositório)
  - [2. Instalar Dependências do Frontend](#2-instalar-dependências-do-frontend)
  - [3. Instalar Dependências do Backend](#3-instalar-dependências-do-backend)
  - [4. Configurar Variáveis de Ambiente](#4-configurar-variáveis-de-ambiente)
  - [5. Executar em Ambiente Local](#5-executar-em-ambiente-local)
- [Arquitetura do Sistema](#arquitetura-do-sistema)
  - [Estrutura de Pastas](#estrutura-de-pastas)
  - [Fluxo de Agendamento e Modos de Operação](#fluxo-de-agendamento-e-modos-de-operação)
  - [Mapeamento de Rotas](#mapeamento-de-rotas)
- [Área de Gestão (`/admin`)](#área-de-gestão-admin)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
  - [Configuração do Google Calendar Service Account](#configuração-do-google-calendar-service-account)
- [Scripts Disponíveis](#scripts-disponíveis)
- [Testes Automatizados](#testes-automatizados)
- [Deploy em Produção](#deploy-em-produção)
  - [Frontend (Firebase Hosting)](#frontend-firebase-hosting)
  - [Backend (Render)](#backend-render)
- [Solução de Problemas (Troubleshooting)](#solução-de-problemas-troubleshooting)

---

## Visão Geral e Funcionalidades

- **Landing Page Institucional (`/`)**: Apresentação da abordagem sistêmica, perfil profissional, especialidades, metodologia de atendimento 100% online, depoimentos e design sensorial com paleta *Creme Quente & Verde Sálvia*.
- **Agendamento em Tempo Real**: Widget multi-etapas com seleção de serviço, calendário dinâmico, verificação de horários disponíveis via Google Calendar FreeBusy API e integração direta com WhatsApp.
- **Tolerância a Falhas com Modo Fallback**: Se as credenciais do Google Calendar não estiverem configuradas ou o backend estiver inacessível, o sistema opera de forma resiliente em **Modo Simulação/Fallback**, sem bloquear o paciente.
- **Bio Links (`/links` ou `/bio`)**: Centralizador de links rápidos para Instagram e WhatsApp com design customizado e microinterações táteis.
- **Gerador de Stories para Instagram (`/story` e `/story-image/:n`)**:
  - `/story`: Animação dinâmica de 15 segundos em formato 9:16 com pré-visualização para captura de vídeo.
  - `/story-image/1` e `/story-image/3`: Layouts estáticos de 1080x1920px com respeito estrito às zonas seguras (safe zones) do Instagram.

---

## Tecnologias Utilizadas

### Frontend
- **Framework**: [Angular 21.2+](https://angular.dev/) (Standalone Components, Signals e arquitetura reativa)
- **Estilização**: [Tailwind CSS v4](https://tailwindcss.com/) com `@tailwindcss/postcss`
- **Componentes & Design Tokens**: [Zard UI](https://zardui.com/) (`components.json`) com tipografia *Instrument Serif* e *Plus Jakarta Sans*
- **Ícones**: `@ng-icons/lucide` e componentes SVG vetoriais otimizados
- **Testes Unitários**: [Vitest](https://vitest.dev/) via `@angular/build:unit-test`

### Backend
- **Ambiente de Execução**: Node.js (v20+)
- **Framework HTTP**: Express 4
- **Integração de Agenda**: Google APIs Client Library (`googleapis`) via JWT Service Account
- **Utilitários**: CORS e Dotenv

### Infraestrutura
- **Frontend Hosting**: Firebase Hosting (com regras de rewrite para SPA)
- **Backend Hosting**: Google Cloud Run (Container serverless Node.js em southamerica-east1)

---

## Pré-requisitos

Antes de iniciar, certifique-se de possuir instalado em sua máquina:

- **Node.js**: versão `20.x` ou superior (recomendado `22.x`)
- **npm**: versão `10.x` ou superior (o projeto utiliza `npm@11.8.0`)
- **JDK 11+ (Java)**: disponível no `PATH` (necessário para rodar o emulador do Firestore em `npm run test:rules`)
- **Git** instalado e configurado

---

## Começando (Guia Rápido)

### 1. Clonar o Repositório

```bash
git clone https://github.com/CaioARosa/psico-hub-web.git
cd psico-hub-web
```

### 2. Instalar Dependências do Frontend

Na raiz do projeto:

```bash
npm install
```

### 3. Instalar Dependências do Backend

Navegue até a pasta `server/` e instale as dependências:

```bash
cd server
npm install
cd ..
```

### 4. Configurar Variáveis de Ambiente

Crie o arquivo de ambiente do backend a partir do modelo fornecido:

```bash
cp server/.env.example server/.env
```

> **Nota**: Para desenvolvimento local sem credenciais do Google, o servidor executará automaticamente em **Modo Simulação**, permitindo testar a interface de agendamento normalmente em memória.

### 5. Executar em Ambiente Local

Abra dois terminais separados (ou abas):

**Terminal 1 — Backend (API Express):**
```bash
cd server
npm start
```
*Disponível em: `http://localhost:3000`*

**Terminal 2 — Frontend (Angular Dev Server):**
```bash
npm start
```
*Disponível em: `http://localhost:4200`*

Acesse `http://localhost:4200` no seu navegador. O recarregamento é automático a cada modificação nos arquivos-fonte.

---

## Arquitetura do Sistema

### Estrutura de Pastas

```
psico-hub-web/
├── .github/                     # Workflows e automações CI/CD (quando aplicável)
├── dist/                        # Build de produção do Angular gerado após compilação
├── public/                      # Ativos estáticos públicos (favicons, manifest, imagens)
│   ├── assets/                  # Fotos da psicóloga, logos e ilustrações
│   │   ├── stories/             # Assets das animações de stories
│   │   └── story/               # Capturas para os templates de Instagram
│   └── site.webmanifest         # Configuração de PWA/Manifest
├── server/                      # Microsserviço Node.js / Express
│   ├── .env.example             # Exemplo de configuração de variáveis de ambiente
│   ├── package.json             # Dependências do backend (Express, googleapis)
│   └── server.js                # Lógica de integração com Google Calendar FreeBusy & Insert
├── src/                         # Código-fonte da aplicação Angular
│   ├── app/
│   │   ├── pages/               # Páginas e views roteadas
│   │   │   ├── home/            # Landing page principal e widget de agendamento
│   │   │   ├── links/           # Página de Bio Links para redes sociais
│   │   │   ├── story/           # Story dinâmico animado (9:16)
│   │   │   └── story-images/    # Templates estáticos de stories (9:16)
│   │   ├── shared/              # Recursos compartilhados
│   │   │   ├── components/      # Componentes UI reutilizáveis (Zard Button, etc.)
│   │   │   ├── core/            # Services (BookingService), providers e diretivas
│   │   │   ├── pipes/           # Pipes auxiliares (SafeHtmlPipe)
│   │   │   └── utils/           # Funções utilitárias (merge-classes, number, etc.)
│   │   ├── app.config.ts        # Configuração dos Providers da aplicação
│   │   ├── app.html             # Template raiz (<router-outlet />)
│   │   ├── app.routes.ts        # Definição e lazy-loading de rotas
│   │   ├── app.spec.ts          # Teste raiz da aplicação
│   │   └── app.ts               # Componente raiz standalone
│   ├── index.html               # Documento HTML principal e fontes Google Fonts
│   ├── main.ts                  # Ponto de entrada de bootstrap da aplicação Angular
│   └── styles.css               # Estilos globais e tokens de design do Tailwind v4
├── angular.json                 # Configuração do Angular CLI e builders
├── components.json              # Configuração da Zard UI
├── firebase.json                # Configuração de hospedagem no Firebase Hosting
├── package.json                 # Dependências e scripts do Frontend
├── tsconfig.json                # Configuração raiz do TypeScript e paths (@/*)
└── README.md                    # Documentação do projeto
```

### Fluxo de Agendamento e Modos de Operação

```
[Paciente no Frontend]
          │
          ▼
1. Seleciona Serviço, Data e Horário
          │
          ▼
2. BookingService consulta disponibilidade
   GET /api/availability?date=YYYY-MM-DD
          │
    ┌─────┴─────────────────────────────────┐
    ▼                                       ▼
[Modo Produção: Google Calendar]      [Modo Simulação / Fallback]
- Consulta FreeBusy na Agenda          - Carrega horários fixos de atendimento
- Subtrai horários já ocupados         - Reserva horários em memória local
    │                                       │
    └─────────────────┬─────────────────────┘
                      ▼
3. Paciente preenche Dados (Nome, WhatsApp, E-mail)
          │
          ▼
4. BookingService submete reserva: POST /api/book
          │
    ┌─────┴─────────────────────────────────┐
    ▼                                       ▼
- Insere evento no Google Agenda       - Registra log de simulação
- Define lembretes (24h e 1h antes)     - Retorna confirmação simulada
    │                                       │
    └─────────────────┬─────────────────────┘
                      ▼
5. Redirecionamento para WhatsApp com mensagem pré-formatada
```

### Mapeamento de Rotas

| Rota | Componente | Descrição |
| :--- | :--- | :--- |
| `/` | `HomeComponent` | Landing page completa com seções Sobre, Serviços, Abordagem e Agendamento |
| `/links` | `LinksComponent` | Hub de links de bio com atalhos diretos para WhatsApp e agendamento |
| `/bio` | *(Redirect)* | Redirecionamento automático permanente para `/links` |
| `/story` | `StoryComponent` | Vídeo animado de 15 segundos em formato 9:16 para divulgação no Instagram |
| `/story-image/:n` | `StoryImagesComponent` | Layouts estáticos de Stories (`:n = 1` para gancho/reflexão, `:n = 3` para CTA) |
| `/admin` | `AdminShellComponent` | Área privada de gestão (redireciona para `/admin/sessoes`; exige claim `admin`) |
| `/admin/login` | `LoginComponent` | Tela de autenticação da psicóloga (Firebase Auth E-mail/Senha) |
| `/admin/sessoes` | `SessionsComponent` | Sincronização da agenda do mês, confirmação de sessões e vínculo de pacientes |
| `/admin/pacientes` | `PatientsComponent` | Cadastro e edição de pacientes e seus acordos financeiros |
| `/admin/pagamentos` | `PaymentsComponent` | Registro de Pix (paciente, valor, data, mês de referência), histórico em tempo real, edição e exclusão |
| `/admin/financeiro` | `FinanceComponent` | Resumo do mês: recebido, a receber e em atraso por paciente, com abatimento por crédito e atalho *Registrar Pix* |
| `**` | *(Redirect)* | Redireciona qualquer rota inválida para `/` |

---

## Área de Gestão (`/admin`)

Painel privado de uso exclusivo da psicóloga para gestão operacional do consultório. O frontend Angular lê e grava diretamente no **Cloud Firestore** (protegido por regras que exigem o custom claim `admin: true`), enquanto a sincronização de eventos do Google Agenda ocorre no backend via `POST /api/admin/sync-calendar`. Nenhum dado clínico ou prontuário é armazenado.

### O que a Fase 1 entrega

- **Autenticação exclusiva (`/admin/login`)**: Login com Firebase Authentication (E-mail/Senha); o `authGuard` protege as rotas `/admin` exigindo usuário autenticado, enquanto as regras do Firestore (`firestore.rules`) e o middleware `requireAdmin` do backend exigem o custom claim `admin: true` (`401` sem token válido, `403` sem o claim `admin`).
- **Cadastro de pacientes (`/admin/pacientes`)**: Criação e edição de pacientes com status ativo/inativo e acordo financeiro configurável como valor **por sessão** (`per_session`) ou **pacote mensal** (`monthly_package`), com valores monetários armazenados em **centavos inteiros (BRL)**.
- **Sincronização do Google Agenda (`POST /api/admin/sync-calendar`)**: Importação idempotente dos eventos do mês selecionado (`YYYY-MM`, fuso fixo `-03:00`) usando `calendarEventId` como ID do documento na coleção `sessions`. Vincula automaticamente eventos a pacientes ativos pelo nome em palavras inteiras no título do evento (insensível a acentos e maiúsculas/minúsculas), ignora eventos de dia inteiro e preserva sessões já consolidadas (`done`, `no_show`, `cancelled`).
- **Confirmação de sessões (`/admin/sessoes`)**: Confirmação do status da sessão (`scheduled`, `done`, `no_show`, `cancelled`) e vinculação manual de sessões não identificadas a um paciente cadastrado (congelando `amountApplied` a partir do acordo do paciente; não há edição manual de valor por sessão na Fase 1).

### O que a Fase 2 entrega

- **Pagamentos (`/admin/pagamentos`)**: registro de Pix com paciente, valor (`150,00`), data do Pix (padrão: hoje), mês de referência (padrão: mês da data, editável) e observação opcional. O histórico é em tempo real, do mais recente ao mais antigo, com filtros por mês de referência e paciente. Editar e excluir (com confirmação) são permitidos. Pix de paciente inativo ou removido continua visível e editável; quando o cadastro não existe mais, aparece como "Paciente removido".
- **Financeiro (`/admin/financeiro`)**: escolha o mês e veja os cartões *Recebido*, *A receber* e *Em atraso*, e a tabela por paciente com devido, recebido, abatido, a receber, em atraso e crédito, mais a linha de total. O botão *Registrar Pix* abre Pagamentos já preenchido com paciente, mês e valor a receber. Em mês sem sessões, o aviso "Sincronize a agenda deste mês para ver o devido." aparece, e *Devido* e *A receber* mostram traço em vez de zero. Sessões sem paciente ficam fora dos valores; a tela informa quantas há no mês, para vinculá-las na tela Sessões.
- **Valores congelados por sessão**: cada sessão guarda o valor por sessão, o valor do pacote do mês (`packageAmountApplied`) e, ao ser marcada como *Faltou*, a regra de cobrança de faltas (`chargeNoShowApplied`). Alterar o acordo depois não muda meses já realizados.
- **Reajuste ao salvar o paciente**: ao editar um paciente, as sessões ainda *agendadas* dele recebem os valores do acordo salvo. Sessões realizadas, faltadas ou canceladas não são alteradas. Salvar de novo repete a operação com o mesmo resultado. O valor do pacote de um mês vem da primeira sessão não cancelada: se ela já foi realizada, o mês mantém o valor antigo e o novo vale a partir do mês seguinte.
- **Abatimento por crédito**: o excedente de um mês, inclusive de Pix adiantado de mês futuro, abate automaticamente os atrasos de meses anteriores, do mais antigo para o mais novo. O que sobra vira crédito do mês. A origem de cada abatimento aparece no detalhe da linha, por exemplo "R$ 100,00 abatidos com o crédito de 2026-11".

> **Deploy do backend**: o campo `packageAmountApplied` só é gravado pelo backend em produção depois que você executar `npm run deploy:backend`. Até lá, sessões criadas pelo backend não recebem o campo e usam o valor de contingência (acordo atual do paciente).

#### Limitações conhecidas (Fase 2)

- **Sessões da Fase 1**: não têm os valores congelados novos. Usam o acordo atual do paciente como contingência; se o acordo mudou antes da Fase 2, os meses antigos podem não refletir a regra da época. Sessões novas não têm esse problema.
- **Cobrar faltas**: só é congelado por sessão a partir desta fase. Faltas marcadas antes seguem o acordo atual do paciente.
- **Pix adiantado**: pode abater um atraso mais antigo que você não esperava. A tela Financeiro mostra a origem do abatimento para evitar surpresas.
- **Sem auditoria**: editar ou excluir um Pix não deixa histórico.

### Configuração Inicial no Firebase / GCP (Provisionamento único)

1. **Criar o banco Cloud Firestore**: No console do Firebase/GCP, crie o banco Firestore em modo nativo na região `southamerica-east1` (São Paulo).
2. **Ativar o Firebase Authentication**: Ative o provedor **E-mail/Senha** no Firebase Authentication e crie a conta de usuário da psicóloga.
3. **Configurar o Web App do Firebase no Frontend**: Registre um aplicativo Web no projeto Firebase, obtenha as chaves públicas com o comando abaixo e cole os valores em `src/app/pages/admin/data/firebase-config.ts`:
   ```bash
   npx firebase-tools apps:sdkconfig web
   ```
4. **Conceder o custom claim `admin: true`**: Autentique-se com Application Default Credentials (`gcloud auth application-default login`) e execute o script administrativo informando o e-mail da psicóloga:
   ```bash
   cd server && node scripts/grant-admin.js <email>
   ```
5. **Permissão IAM no Cloud Run**: Conceda o papel `roles/datastore.user` à service account utilizada pelo serviço Cloud Run (`psico-hub-backend`) para permitir que o backend leia `patients` e grave `sessions` no Firestore.
6. **Publicar as regras do Firestore**:
   ```bash
   npx firebase-tools deploy --only firestore:rules
   ```

### Testes da Área de Gestão

- **Unitários do Frontend (Vitest)**:
  ```bash
  npx ng test --watch=false
  ```
- **Unitários do Backend (`node --test`)**:
  ```bash
  cd server && npm test
  ```
- **Regras de Segurança do Firestore (Emulador local)**:
  ```bash
  npm run test:rules
  ```
  > **Pré-requisito**: O comando `npm run test:rules` executa o emulador do Firestore via `npx firebase-tools` e exige **JDK 11+ (Java)** instalado e disponível no `PATH` (`java -version`).

---

## Variáveis de Ambiente

As variáveis de ambiente devem ser declaradas no arquivo `server/.env`:

| Variável | Obrigatória | Padrão | Descrição |
| :--- | :---: | :--- | :--- |
| `PORT` | Não | `3000` | Porta onde o servidor Node.js/Express será executado |
| `GOOGLE_CALENDAR_ID` | Sim (p/ prod) | - | E-mail/Identificador da agenda no Google Calendar |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Sim (p/ prod) | - | E-mail da Service Account criada no Google Cloud |
| `GOOGLE_PRIVATE_KEY` | Sim (p/ prod) | - | Chave privada da Service Account (formato PEM com quebras de linha `\n`) |
| `FIREBASE_PROJECT_ID` | Não | `psico-hub-lays` | ID do projeto Firebase/GCP usado pelo `firebase-admin` no backend |

### Configuração do Google Calendar Service Account

Para sincronizar diretamente com a agenda do Google em produção:

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e crie um novo projeto.
2. Ative a **Google Calendar API** no menu *APIs & Services*.
3. Vá em **Credentials** > **Create Credentials** > **Service Account**.
4. Crie uma chave do tipo **JSON** para a conta de serviço e faça o download.
5. Abra o arquivo JSON baixado e copie:
   - `client_email` para `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
   - `private_key` para `GOOGLE_PRIVATE_KEY` (certifique-se de manter as aspas duplas no `.env`).
6. No Google Agenda (web), abra as configurações da agenda onde as consultas serão agendadas.
7. Em **Compartilhar com pessoas ou grupos específicos**, adicione o e-mail da sua Service Account com permissão **Fazer alterações em eventos**.
8. Copie o **ID da Agenda** (ex: `c_xxxx@group.calendar.google.com` ou o próprio e-mail) para a variável `GOOGLE_CALENDAR_ID`.

---

## Scripts Disponíveis

### Frontend (Raiz do Projeto)

| Comando | Descrição |
| :--- | :--- |
| `npm start` | Inicia o servidor local do Angular em `http://localhost:4200` |
| `npm run build` | Compila o projeto otimizado para produção na pasta `dist/lays-landing` |
| `npm run watch` | Executa o build contínuo em modo de desenvolvimento |
| `npm test` | Executa a suíte de testes unitários com Vitest |
| `npx ng test --watch=false` | Executa os testes unitários uma única vez no terminal |
| `npm run test:rules` | Executa os testes das regras do Firestore no emulador local via `npx firebase-tools` (exige JDK 11+ no `PATH`) |
| `npm run deploy` | Realiza o build de produção e faz deploy para o Firebase Hosting |

### Backend (`server/`)

| Comando | Descrição |
| :--- | :--- |
| `npm start` | Inicia a API Express utilizando `node server.js` na porta definida |
| `npm test` | Executa a suíte de testes unitários do backend com `node --test` |
| `node server.js` | Inicialização direta do servidor backend |

---

## Testes Automatizados

O projeto conta com três suítes de testes automatizados:

```bash
# 1. Testes unitários do Frontend (Vitest + jsdom, arquivos *.spec.ts)
npm test
npx ng test --watch=false

# 2. Testes unitários do Backend (node --test, arquivos server/**/*.test.js)
cd server && npm test

# 3. Testes das regras de segurança do Firestore no emulador (exige JDK 11+ no PATH)
npm run test:rules
```

---

## Deploy em Produção

### Frontend (Firebase Hosting)

O deploy do frontend é gerenciado via Firebase Hosting e configurado no arquivo `firebase.json`:

1. Instale o Firebase CLI (caso não tenha):
   ```bash
   npm install -g firebase-tools
   ```
2. Realize o login no Firebase:
   ```bash
   firebase login
   ```
3. Execute o comando de deploy automatizado:
   ```bash
   npm run deploy
   ```

O comando compila o Angular (`ng build`) e envia os artefatos da pasta `dist/lays-landing/browser` diretamente para o hosting, mantendo a regra de rewrite para SPAs (`/index.html`).

### Backend (Google Cloud Run)

A API do backend é hospedada em container no **Google Cloud Run** (região southamerica-east1 - São Paulo), com roteamento unificado no Firebase Hosting (/api/**):

1. **Deploy do backend (Cloud Run)**:
   `ash
   npm run deploy:backend
   `
2. **Deploy completo (Frontend + Backend)**:
   `ash
   npm run deploy:all
   `
3. **Variáveis de Ambiente** (GOOGLE_CALENDAR_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY):
   Configure no Console do Google Cloud Run no serviço psico-hub-backend em **Editar e implantar nova revisão** -> **Variáveis e segredos**, ou via GCP Secret Manager.

---

## Solução de Problemas (Troubleshooting)

### 1. Quebras de Linha na Chave Privada do Google (`GOOGLE_PRIVATE_KEY`)
- **Sintoma**: Erro `PEM routines:get_name:no start line` ou falha de autenticação JWT no backend.
- **Causa**: Ao colar a chave privada no `.env` ou nas variáveis do painel do Render, as quebras de linha (`\n`) podem ser escapadas como strings literais.
- **Solução**: O arquivo `server/server.js` já inclui sanitização automática (`privateKey.replace(/\\n/g, '\n')`). Certifique-se de envolver a chave com aspas duplas no arquivo `.env`.

### 2. Permissão de Acesso à Agenda do Google
- **Sintoma**: Erro 404 (`Not Found`) ou 403 (`Forbidden`) ao consultar ou criar eventos.
- **Causa**: A agenda não foi explicitamente compartilhada com o e-mail da Service Account.
- **Solução**: Acesse as configurações da agenda no Google Calendar e compartilhe-a com o endereço `GOOGLE_SERVICE_ACCOUNT_EMAIL` concedendo permissão de alteração de eventos.

### 3. Backend Inacessível e Funcionamento Offline
- **Sintoma**: Mensagem `Backend API unavailable. Falling back to local default slots.` no console do navegador.
- **Causa**: O servidor Node.js local não está em execução ou o serviço no Render está em processo de inicialização (*cold start*).
- **Solução**: Não se preocupe. O frontend ativa o modo resiliente de fallback, mantendo a interface funcionando e encaminhando a confirmação final da reserva diretamente para o WhatsApp da psicóloga.

### 4. Orçamento de Estilos em Componentes (CSS Budget Warning)
- **Sintoma**: Alerta no build: `exceeded maximum budget... Total of 6.27 kB`.
- **Causa**: O componente de story (`story.component.ts`) possui regras completas de animação e posições embutidas via `styles`.
- **Solução**: Esse aviso é inofensivo para a produção. Caso deseje suprimir o aviso, ajuste o limite `anyComponentStyle` no arquivo `angular.json`.
