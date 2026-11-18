# Revisão estruturada — Fase 3 (Painel) e link de cobrança da Fase 4

Data: 2026-11-17 · Método: `multi-agent-brainstorming`, aplicado **depois** da implementação (o design foi feito em outro computador; spec `docs/superpowers/specs/2026-11-16-gestao-fase-3-painel-design.md`).

## 1. Estado verificado

| Verificação | Resultado |
| :-- | :-- |
| `cd server && npm test` | 64/64 |
| `npx ng test --watch=false` | 342/342 (30 arquivos) |
| `npm run test:rules` (JDK 21) | 4/4 |
| `npm run build` | OK; único aviso é o orçamento de CSS do `story.component.ts`, já conhecido |
| Página pública (`home`) carrega biblioteca de gráfico? | Não. O ECharts fica num bloco sob demanda, só no painel (~226 kB transferidos) |

## 2. Rodada de revisão

### Cético
- **C1.** A spec (§1 e §11) escolheu `chart.js` + `ng2-charts@11`, e esse foi o motivo para subir o Angular para a versão 22. O commit `16eff9b` trocou o gráfico pelo da ZardUI (ECharts). Resultado: `chart.js` e `ng2-charts` continuam no `package.json`, mas só são usados por tipos e por `revenueChartData`/`revenueChartOptions`, que hoje só os testes chamam.
- **C2.** No mês corrente, o alerta conta `done + scheduled`. Se a agenda das próximas semanas ainda não foi sincronizada, o painel mostra "falta 1" sem que nada esteja errado.
- **C3.** "Previsto" usa o acordo atual também em meses passados. A tela avisa ("acordos atuais") e a spec registra isso em §8.

### Guardião de Restrições
- **G1.** O peso do ECharts é aceitável numa área privada de uso único e não atinge a página pública. Sem objeção.
- **G2.** O gráfico converte centavos em reais com `/ 100` só para exibir; os valores e cálculos continuam inteiros. Sem objeção.
- **G3.** O painel não cria consulta, índice nem regra nova no Firestore. Sem objeção.

### Defensor do Usuário
- **U1.** A mensagem de cobrança usa só o primeiro nome e o total, e é enviada manualmente; o texto pode ser editado no próprio WhatsApp antes de enviar. Adequada ao tom terapêutico.
- **U2.** Em casal ou família, o telefone cadastrado pode não ser o de quem paga. O link vai para o telefone do cadastro.
- **U3.** C2 visto pela Lays: um alerta falso no começo do mês ensina a ignorar alertas.

## 3. Decision Log

| # | Objeção | Decisão do Árbitro | Justificativa |
| :-- | :-- | :-- | :-- |
| C1 | Dependências e código de gráfico mortos | **Aceita** | Remover `chart.js`, `ng2-charts`, `revenueChartData`, `revenueChartOptions` e os testes deles; atualizar a spec §1/§11 para registrar ECharts/ZardUI |
| C2/U3 | Alerta falso por agenda não sincronizada | **Aceita, mitigação simples** | Mostrar no bloco de alertas a data da última sincronização do mês ou o aviso "sincronize a agenda" quando o mês corrente tiver poucas sessões futuras. A forma exata fica para o plano |
| C3 | Previsto com acordo atual | **Rejeitada** | Limitação já documentada e sinalizada na tela; o custo de um histórico de acordos não se justifica agora |
| U2 | Telefone de quem paga | **Rejeitada por ora** | Já está no backlog como T7 (modalidade e pagador) |
| G1–G3, U1 | — | Sem objeção | — |

## 3.1 Resolução (2026-11-17)

- **R1 feita** (`e3292af`): `chart.js` e `ng2-charts` removidos com as duas funções mortas; spec e README atualizados.
- **R2 feita:** o backend grava `calendarSyncs/{mês}` após cada sincronização; `domain/sync-freshness.ts` classifica a sincronização (passado / sem registro / recente / antiga a partir de 3 dias) e o painel mostra a hora ou um aviso com atalho para Sessões. Suposição: 3 dias é o limite em que sessões novas começam a ser marcadas sem sincronizar; ajustar `STALE_AFTER_DAYS` se não for o hábito da Lays.

## 4. Disposição

**APPROVED com ajustes:** o design e a implementação da Fase 3 estão aceitos. Faltam duas tarefas pequenas:

1. **R1. Limpeza do gráfico (C1)** — cerca de 30 min: remover as duas dependências e as funções mortas, rodar `npm install`, os testes e o build, e atualizar a spec.
2. **R2. Aviso contra alerta falso (C2)** — cerca de 1 h: decidir o sinal (data da última sincronização ou contagem de sessões futuras) e cobrir com teste em `dashboard.ts`.
