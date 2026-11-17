import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface FeedSlide {
  slideNumber: number;
  totalSlides: number;
  tag?: string;
  title: string;
  highlightText?: string;
  body: string[];
  photoUrl?: string;
  bulletPoints?: string[];
  ctaText?: string;
}

export interface FeedPost {
  id: string;
  category: string;
  title: string;
  badge: string;
  description: string;
  caption: string;
  slides: FeedSlide[];
}

export interface HighlightCover {
  id: string;
  title: string;
  subtitle: string;
  iconSvg: string;
}

@Component({
  selector: 'app-feed-generator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-[#131715] text-[#FDFBF7] py-8 px-4 sm:px-6">
      <!-- Barra superior / Header -->
      <header class="max-w-6xl mx-auto mb-8 border-b border-white/10 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <span class="px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase bg-[#4D6D66]/30 text-[#A3B899] rounded-full border border-[#4D6D66]/40">
              Kit de Lançamento Orgânico
            </span>
            <span class="text-xs text-white/50">Instagram &#64;lays.psi</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-display font-light text-white tracking-tight">
            Gerador de Posts do Feed (4:5) & Capas de Destaques
          </h1>
          <p class="text-sm text-white/60 mt-1 max-w-2xl">
            Artes prontas na proporção vertical oficial (1080x1350). Escolha a visualização, copie a legenda completa e capture os slides para publicar no perfil.
          </p>
        </div>

        <!-- Seletor de abas -->
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            (click)="currentTab.set('post1')"
            [class.active-tab]="currentTab() === 'post1'"
            class="tab-btn">
            1. Quem Sou
          </button>
          <button
            type="button"
            (click)="currentTab.set('post2')"
            [class.active-tab]="currentTab() === 'post2'"
            class="tab-btn">
            2. Terapia Online
          </button>
          <button
            type="button"
            (click)="currentTab.set('post3')"
            [class.active-tab]="currentTab() === 'post3'"
            class="tab-btn">
            3. Abordagem Sistêmica
          </button>
          <button
            type="button"
            (click)="currentTab.set('highlights')"
            [class.active-tab]="currentTab() === 'highlights'"
            class="tab-btn">
            Capas de Destaques
          </button>
        </div>
      </header>

      <!-- Conteúdo principal -->
      <main class="max-w-6xl mx-auto">
        @if (currentTab() !== 'highlights') {
          <!-- Exibição do Carrossel Ativo -->
          @if (activePost(); as post) {
            <section class="space-y-6">
              <!-- Header do Post com Copiar Legenda -->
              <div class="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs font-medium text-[#A3B899]">{{ post.badge }}</span>
                    <span class="text-white/30">•</span>
                    <span class="text-xs text-white/60">{{ post.slides.length }} slides em proporção 4:5</span>
                  </div>
                  <h2 class="text-xl font-medium text-white">{{ post.title }}</h2>
                  <p class="text-xs text-white/60 mt-0.5">{{ post.description }}</p>
                </div>

                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    (click)="copyCaption(post.caption)"
                    class="px-4 py-2.5 bg-[#4D6D66] hover:bg-[#3f5a54] active:scale-95 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-md">
                    @if (copied()) {
                      <svg class="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Legenda Copiada!</span>
                    } @else {
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                      </svg>
                      <span>Copiar Legenda do Post</span>
                    }
                  </button>
                </div>
              </div>

              <!-- Grid de Slides 4:5 -->
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                @for (slide of post.slides; track slide.slideNumber) {
                  <article class="flex flex-col items-center">
                    <span class="text-xs font-mono text-white/40 mb-2">Slide {{ slide.slideNumber }} de {{ slide.totalSlides }}</span>

                    <!-- Card Slide (4:5 Ratio) -->
                    <div class="slide-card group relative">
                      <!-- Fundo com Blobs elegantes -->
                      <div class="slide-blob b1"></div>
                      <div class="slide-blob b2"></div>

                      <!-- Conteúdo do Slide -->
                      <div class="slide-inner">
                        <!-- Topo com Logo e Tag -->
                        <div class="flex items-center justify-between w-full border-b border-[#4D6D66]/15 pb-3">
                          <div class="flex items-center gap-2">
                            <img src="assets/tree-logo.png" alt="Lays Coelho" class="w-5 h-5 object-contain" />
                            <span class="text-[10px] tracking-wider uppercase font-semibold text-[#4D6D66]">&#64;lays.psi</span>
                          </div>
                          @if (slide.tag) {
                            <span class="text-[9px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full bg-[#4D6D66]/10 text-[#4D6D66]">
                              {{ slide.tag }}
                            </span>
                          }
                        </div>

                        <!-- Foto personalizada no Slide 1 do Post 1 -->
                        @if (slide.photoUrl) {
                          <div class="my-3 w-28 h-28 rounded-full p-1 border-2 border-[#4D6D66]/30 overflow-hidden shadow-sm mx-auto shrink-0 bg-white">
                            <img [src]="slide.photoUrl" alt="Lays Coelho" class="w-full h-full object-cover rounded-full" />
                          </div>
                        }

                        <!-- Título e Destaque -->
                        <div class="my-auto space-y-3">
                          <h3 class="font-display text-2xl sm:text-[1.65rem] leading-[1.12] text-[#1C221F]" [innerHTML]="slide.title"></h3>
                          
                          @if (slide.highlightText) {
                            <p class="text-xs italic font-medium text-[#4D6D66] border-l-2 border-[#4D6D66] pl-2.5 py-0.5">
                              {{ slide.highlightText }}
                            </p>
                          }

                          <!-- Parágrafos de texto -->
                          @for (p of slide.body; track p) {
                            <p class="text-[11.5px] leading-relaxed text-[#556661] font-light">
                              {{ p }}
                            </p>
                          }

                          <!-- Lista de pontos -->
                          @if (slide.bulletPoints && slide.bulletPoints.length > 0) {
                            <ul class="space-y-2 mt-3 text-left">
                              @for (point of slide.bulletPoints; track point) {
                                <li class="text-[11px] leading-snug text-[#1C221F] flex items-start gap-2 bg-white/70 p-2 rounded-lg border border-[#4D6D66]/15 shadow-2xs">
                                  <span class="w-1.5 h-1.5 rounded-full bg-[#4D6D66] mt-1 shrink-0"></span>
                                  <span>{{ point }}</span>
                                </li>
                              }
                            </ul>
                          }
                        </div>

                        <!-- Rodapé do Slide -->
                        <div class="w-full pt-3 border-t border-[#4D6D66]/15 flex items-center justify-between text-[10px] text-[#8F9C99]">
                          <span>CRP 04/67406</span>
                          @if (slide.ctaText) {
                            <span class="font-semibold text-[#4D6D66]">{{ slide.ctaText }}</span>
                          } @else {
                            <span>{{ slide.slideNumber }}/{{ slide.totalSlides }}</span>
                          }
                        </div>
                      </div>
                    </div>
                  </article>
                }
              </div>

              <!-- Visualização da Legenda Completa -->
              <div class="bg-white/5 border border-white/10 rounded-2xl p-5 mt-6">
                <h4 class="text-xs uppercase tracking-wider text-[#A3B899] font-semibold mb-2">Texto da Legenda para Copiar:</h4>
                <pre class="text-xs text-white/80 whitespace-pre-wrap font-sans bg-black/30 p-4 rounded-xl border border-white/5 leading-relaxed">{{ post.caption }}</pre>
              </div>
            </section>
          }
        } @else {
          <!-- Exibição das Capas de Destaques -->
          <section class="space-y-8">
            <div class="bg-white/5 border border-white/10 rounded-2xl p-5">
              <span class="text-xs font-medium text-[#A3B899]">Bio & Destaques</span>
              <h2 class="text-xl font-medium text-white mt-1">4 Capas Essenciais para o Perfil</h2>
              <p class="text-xs text-white/60 mt-1">
                Utilize para organizar a vitrine do perfil logo abaixo da biografia. Proporção 1:1 pronta para recorte circular no Instagram.
              </p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              @for (cover of highlights(); track cover.id) {
                <div class="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col items-center text-center">
                  <span class="text-xs font-mono text-white/50 mb-3">{{ cover.title }}</span>

                  <!-- Card Destaque Quadrado (1:1) -->
                  <div class="highlight-card relative group">
                    <div class="slide-blob b1"></div>
                    <div class="slide-blob b2"></div>
                    
                    <div class="highlight-circle">
                      <div class="w-10 h-10 text-[#4D6D66] flex items-center justify-center" [innerHTML]="cover.iconSvg"></div>
                    </div>

                    <div class="text-center z-10 mt-3">
                      <h4 class="font-display text-lg text-[#1C221F]">{{ cover.title }}</h4>
                      <p class="text-[10px] text-[#556661] mt-0.5 uppercase tracking-wider font-semibold">{{ cover.subtitle }}</p>
                    </div>

                    <div class="absolute bottom-2 text-[9px] text-[#8F9C99]">layspsi.com.br</div>
                  </div>

                  <p class="text-[11px] text-white/60 mt-3">Capa para Destaque: <strong>{{ cover.title }}</strong></p>
                </div>
              }
            </div>
          </section>
        }
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .tab-btn {
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 500;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.2s;
    }
    .tab-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
    }
    .active-tab {
      background: #4D6D66 !important;
      color: #fff !important;
      border-color: #6E8B75 !important;
      box-shadow: 0 2px 10px rgba(77, 109, 102, 0.4);
    }

    /* Dimensão 4:5 oficial do Feed (Escala de 270x337.5px para prévia nítida) */
    .slide-card {
      width: 260px;
      height: 325px;
      aspect-ratio: 4/5;
      background: #FDFBF7;
      color: #1C221F;
      border-radius: 14px;
      overflow: hidden;
      position: relative;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .slide-inner {
      position: absolute;
      inset: 0;
      padding: 16px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      z-index: 2;
    }

    .slide-blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(16px);
      pointer-events: none;
      z-index: 1;
    }
    .b1 {
      width: 160px;
      height: 160px;
      top: -30px;
      right: -30px;
      background: radial-gradient(circle, rgba(212, 230, 225, 0.7), transparent 70%);
    }
    .b2 {
      width: 140px;
      height: 140px;
      bottom: -20px;
      left: -20px;
      background: radial-gradient(circle, rgba(77, 109, 102, 0.15), transparent 70%);
    }

    /* Capas de Destaques (1:1) */
    .highlight-card {
      width: 200px;
      height: 200px;
      aspect-ratio: 1/1;
      background: #FDFBF7;
      border-radius: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .highlight-circle {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: #D4E6E1;
      border: 2px solid #4D6D66;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      box-shadow: 0 4px 12px rgba(77, 109, 102, 0.2);
    }
  `]
})
export class FeedGeneratorComponent {
  readonly currentTab = signal<'post1' | 'post2' | 'post3' | 'highlights'>('post1');
  readonly copied = signal(false);

  readonly posts = signal<Record<'post1' | 'post2' | 'post3', FeedPost>>({
    post1: {
      id: 'post1',
      category: 'Apresentação & Posicionamento',
      badge: 'Post Fixado 1',
      title: 'Quem Sou: Lays Coelho',
      description: 'Humaniza o perfil, valida a autoridade técnica (CRP) e gera conexão imediata com novos visitantes.',
      caption: `Prazer, sou a Lays Coelho. 🌿\n\nSou psicóloga clínica (CRP 04/67406) com foco na Abordagem Sistêmica. Minha prática clínica é guiada pela compreensão de que ninguém adoece ou sofre no vazio: nossas dores, bloqueios e angústias estão profundamente conectados às nossas histórias, vínculos familiares e relações cotidianas.\n\nAcredito em uma psicologia que não rotula, mas acolhe; que não busca culpados, mas sim a construção de caminhos mais leves e autênticos para o seu presente.\n\n✨ Atendimentos 100% online em todo o Brasil e exterior\n🛋️ Psicoterapia Individual, de Casal e Familiar\n\nSe você sente que é hora de cuidar das suas relações e de si mesmo, o primeiro passo pode ser hoje.\n\n👉 Acesse o link da bio (layspsi.com.br) ou envie uma mensagem direta para saber mais e agendar sua sessão.\n\n#PsicologiaClinica #TerapiaSistemica #SaudeEmocional #TerapiaOnline #LaysCoelhoPsi #Autoconhecimento`,
      slides: [
        {
          slideNumber: 1,
          totalSlides: 4,
          tag: 'Apresentação',
          photoUrl: 'assets/lays_coelho_profile3.jpeg',
          title: 'Prazer, sou a <br/><em>Lays Coelho</em>.',
          highlightText: 'Psicóloga Clínica · CRP 04/67406',
          body: [
            'Seja muito bem-vindo(a) ao meu espaço profissional de escuta e acolhimento.',
          ],
        },
        {
          slideNumber: 2,
          totalSlides: 4,
          tag: 'Meu Olhar',
          title: 'Você não é um<br/><em>sintoma isolado</em>.',
          body: [
            'Na abordagem sistêmica, olhamos para quem você é dentro do seu contexto: seus vínculos familiares, sua história e suas relações.',
            'Entender de onde vêm os pesos é o que nos liberta para viver o presente com mais leveza.',
          ],
        },
        {
          slideNumber: 3,
          totalSlides: 4,
          tag: 'Na Prática',
          title: 'O que você encontra<br/><em>na terapia?</em>',
          body: [],
          bulletPoints: [
            'Espaço seguro, sigiloso e sem julgamentos',
            'Compreensão profunda de padrões repetitivos',
            'Desenvolvimento de limites saudáveis',
            'Recursos internos para lidar com a ansiedade',
          ],
        },
        {
          slideNumber: 4,
          totalSlides: 4,
          tag: 'Primeiro Passo',
          title: 'Cuidar de você<br/><em>pode começar hoje.</em>',
          body: [
            'Atendimento 100% online para todo o Brasil e brasileiros no exterior.',
            'Sessões individuais, de casal e familiares.',
          ],
          ctaText: 'Link na bio · Agende',
        },
      ],
    },
    post2: {
      id: 'post2',
      category: 'Serviço & Desmistificação',
      badge: 'Post Fixado 2',
      title: 'Como Funciona a Terapia Online',
      description: 'Quebra objeções sobre sessões à distância e ensina o fluxo do agendamento automatizado.',
      caption: `"Terapia online funciona mesmo?"\n\nEssa é uma das dúvidas mais comuns de quem está pensando em iniciar o processo terapêutico. A resposta é: sim, com a mesma eficácia, sigilo e profundidade do modelo presencial!\n\nAs vantagens que meus pacientes mais valorizam:\n1️⃣ Sem deslocamento ou estresse de trânsito\n2️⃣ No conforto e privacidade do seu próprio espaço\n3️⃣ Continuidade mesmo em viagens ou mudanças de cidade\n\nE para agendar, é simples:\n1. Acesse layspsi.com.br pelo link da bio\n2. Escolha o serviço e veja os horários disponíveis em tempo real\n3. Confirme direto pelo WhatsApp com suporte humanizado\n\nVocê não precisa saber exatamente o que dizer para começar. O espaço de escuta é construído juntos.\n\n#TerapiaOnline #SaudeMental #PsicologiaOnline #AgendamentoOnline #PsicologaOnline`,
      slides: [
        {
          slideNumber: 1,
          totalSlides: 4,
          tag: 'Dúvida Comum',
          title: 'A terapia online<br/><em>funciona mesmo?</em>',
          highlightText: 'O que você precisa saber antes de começar',
          body: [
            'Muitas pessoas têm receio de que o vínculo seja distante. Mas a prática mostra exatamente o oposto.',
          ],
        },
        {
          slideNumber: 2,
          totalSlides: 4,
          tag: 'Segurança & Sigilo',
          title: 'Mesmo rigor ético e<br/><em>acolhimento real</em>.',
          body: [],
          bulletPoints: [
            'Sigilo total e ambiente seguro garantido',
            'Reconhecida e regulamentada pelo Conselho de Psicologia',
            'Sessões de 50 minutos por videochamada privada',
          ],
        },
        {
          slideNumber: 3,
          totalSlides: 4,
          tag: 'Passo a Passo',
          title: 'Agende online em<br/><em>menos de 1 minuto</em>:',
          body: [],
          bulletPoints: [
            '1. Escolha a modalidade (Individual, Casal ou Família)',
            '2. Selecione data e horário livres na agenda',
            '3. Confirmação instantânea pelo WhatsApp',
          ],
        },
        {
          slideNumber: 4,
          totalSlides: 4,
          tag: 'Inicie',
          title: 'O seu momento<br/><em>no seu ritmo</em>.',
          body: [
            'Você só precisa de fones de ouvido e um lugar reservado.',
            'Dê o primeiro passo agora acessando a agenda no link da bio.',
          ],
          ctaText: 'layspsi.com.br',
        },
      ],
    },
    post3: {
      id: 'post3',
      category: 'Educação & Abordagem',
      badge: 'Post Fixado 3',
      title: 'O que é a Abordagem Sistêmica?',
      description: 'Educa a audiência sobre a visão clínica da Lays, gerando forte identificação com conflitos e laços relacionais.',
      caption: `Você já sentiu que está repetindo dinâmicas que jurava que nunca faria?\n\nOu que carrega responsabilidades e dores que parecem não ser apenas suas?\n\nNa Abordagem Sistêmica, compreendemos o ser humano inserido em uma rede viva de relações. Não olhamos apenas para o "eu", mas para o "nós": como as regras invisíveis da sua família, as expectativas e as lealdades inconscientes influenciam quem você é hoje.\n\nO objetivo da psicoterapia sistêmica não é culpar os pais ou parceiros, mas ganhar clareza para:\n🌿 Diferenciar o que é seu e o que é do outro\n🌿 Romper padrões repetitivos que geram sofrimento\n🌿 Reencontrar a sua própria voz nas suas relações\n\nIdentificou-se com esse olhar? Salve esse post e agende sua primeira sessão pelo link da bio.\n\n#TerapiaSistemica #ConstelacaoFamiliar #RelacoesSaudaveis #PadroesFamiliares #LaysCoelho`,
      slides: [
        {
          slideNumber: 1,
          totalSlides: 4,
          tag: 'Abordagem Clínica',
          title: 'Você não é um<br/><em>problema isolado</em>.',
          highlightText: 'O que a Abordagem Sistêmica ensina',
          body: [
            'Nossas maiores dores e bloqueios quase nunca nascem sozinhos. Eles nascem nas nossas relações.',
          ],
        },
        {
          slideNumber: 2,
          totalSlides: 4,
          tag: 'Padrões',
          title: 'Por que repetimos<br/><em>o que nos machuca?</em>',
          body: [
            'Sem perceber, muitas vezes mantemos lealdades invisíveis à dinâmica da nossa família de origem.',
            'A terapia ilumina esses nós para que você possa escolher conscientemente.',
          ],
        },
        {
          slideNumber: 3,
          totalSlides: 4,
          tag: 'Transformação',
          title: 'Não é sobre culpa,<br/><em>é sobre liberdade</em>.',
          body: [],
          bulletPoints: [
            'Aprender a colocar limites saudáveis sem culpa',
            'Aliviar a sensação constante de sobrecarga mental',
            'Melhorar a comunicação na vida a dois e na família',
          ],
        },
        {
          slideNumber: 4,
          totalSlides: 4,
          tag: 'Acolhimento',
          title: 'Reescreva a sua<br/><em>própria história</em>.',
          body: [
            'Um espaço clínico seguro para você se expressar e se reconectar com seu propósito.',
          ],
          ctaText: 'layspsi.com.br',
        },
      ],
    },
  });

  readonly highlights = signal<HighlightCover[]>([
    {
      id: 'h1',
      title: 'Comece Aqui',
      subtitle: 'Quem Sou & CRP',
      iconSvg: `<svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    },
    {
      id: 'h2',
      title: 'Terapia Online',
      subtitle: 'Sigilo & Espaço',
      iconSvg: `<svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    },
    {
      id: 'h3',
      title: 'Como Agendar',
      subtitle: '3 Passos Simples',
      iconSvg: `<svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    },
    {
      id: 'h4',
      title: 'Dúvidas',
      subtitle: 'FAQ & Respostas',
      iconSvg: `<svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    },
  ]);

  readonly activePost = computed<FeedPost | null>(() => {
    const tab = this.currentTab();
    if (tab === 'highlights') return null;
    return this.posts()[tab];
  });

  copyCaption(caption: string) {
    navigator.clipboard.writeText(caption).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    });
  }
}
