import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  TemplateRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideArrowRight,
  lucideCalendar,
  lucideCheck,
  lucideClock,
  lucideMail,
  lucideMenu,
  lucideShieldCheck,
  lucideVideo,
} from '@ng-icons/lucide';
import { Subscription } from 'rxjs';

import { ZardAccordionImports } from '@/shared/components/accordion';
import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardAvatarComponent } from '@/shared/components/avatar';
import { ZardBadgeComponent } from '@/shared/components/badge';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardCalendarComponent, type CalendarValue } from '@/shared/components/calendar';
import { ZardCardImports } from '@/shared/components/card';
import { ZardEmptyComponent } from '@/shared/components/empty';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardProgressComponent } from '@/shared/components/progress';
import { ZardSeparatorComponent } from '@/shared/components/separator';
import { ZardSheetRef, ZardSheetService } from '@/shared/components/sheet';
import { ZardSkeletonComponent } from '@/shared/components/skeleton';
import { ZardTextareaComponent } from '@/shared/components/textarea';
import { BookingService, TimeSlot } from '@/shared/core/services/booking.service';
import { SafeHtmlPipe } from '@/shared/pipes/safe-html.pipe';

interface ScrollCraftApi {
  layout: () => void;
  read: () => void;
  destroy: () => void;
}

declare global {
  interface Window {
    ScrollCraft?: {
      mount: (root?: Element | string | null, opts?: Record<string, unknown>) => ScrollCraftApi;
      reduce: boolean;
      instances: ScrollCraftApi[];
    };
  }
}

interface ChapterFolio {
  id: string;
  roman: string;
  label: string;
  dark?: boolean;
}

interface ApproachPillar {
  svgIcon: string;
  title: string;
  description: string;
}

interface ServiceItem {
  svgIcon: string;
  title: string;
  description: string;
  settleAt: number;
}

interface ServiceOption {
  value: string;
  label: string;
  desc: string;
  svgIcon: string;
}

interface TherapyStage {
  number: string;
  nodeLabel: string;
  title: string;
  description: string;
  systemicNote: string;
}

interface Testimonial {
  text: string;
  author: string;
  context: string;
}

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const ICON_PERSON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const ICON_FAMILY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
const ICON_HEART = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const ICON_MONITOR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
const ICON_LEAF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`;
const ICON_COMPASS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`;
const ICON_BRAIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-4.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2zM14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-4.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2z"/></svg>`;

function collectSundays(start: Date, end: Date): Date[] {
  const sundays: Date[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const offset = (7 - cursor.getDay()) % 7;
  cursor.setDate(cursor.getDate() + offset);
  while (cursor <= end) {
    sundays.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return sundays;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    SafeHtmlPipe,
    NgIcon,
    ZardButtonComponent,
    ZardBadgeComponent,
    ZardAlertComponent,
    ZardCalendarComponent,
    ZardInputComponent,
    ZardTextareaComponent,
    ZardProgressComponent,
    ZardSkeletonComponent,
    ZardSeparatorComponent,
    ZardAvatarComponent,
    ZardEmptyComponent,
    ...ZardCardImports,
    ...ZardAccordionImports,
  ],
  viewProviders: [
    provideIcons({
      lucideArrowLeft,
      lucideArrowRight,
      lucideCalendar,
      lucideCheck,
      lucideClock,
      lucideMail,
      lucideMenu,
      lucideShieldCheck,
      lucideVideo,
    }),
  ],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  private bookingService = inject(BookingService);
  private platformId = inject(PLATFORM_ID);
  private route = inject(ActivatedRoute);
  private sheetService = inject(ZardSheetService);

  private fragmentSub?: Subscription;
  private mobileSheetRef?: ZardSheetRef<void>;
  private scApi?: ScrollCraftApi;
  private scrollHandler?: () => void;
  private rafId = 0;

  readonly homeRoot = viewChild.required<ElementRef<HTMLElement>>('homeRoot');
  readonly peakActEl = viewChild<ElementRef<HTMLElement>>('peakAct');
  readonly mobileNavTemplate = viewChild.required<TemplateRef<void>>('mobileNavTemplate');

  readonly currentYear = computed(() => new Date().getFullYear());
  readonly isScrolled = signal(false);
  readonly pageProgress = signal(0);
  readonly activeChapter = signal(0);
  readonly peakStageIndex = signal(0);
  readonly pinnedStageOverride = signal<number | null>(null);

  readonly displayedStageIndex = computed(() => {
    const manual = this.pinnedStageOverride();
    return manual !== null ? manual : this.peakStageIndex();
  });

  readonly isFooterInCenter = signal(false);

  readonly isDarkChapterActive = computed(() => {
    if (this.isFooterInCenter()) return true;
    const ch = this.chapters()[this.activeChapter()];
    return !!ch?.dark;
  });

  readonly chapters = signal<ChapterFolio[]>([
    { id: 'inicio', roman: 'I', label: 'Início' },
    { id: 'sobre', roman: 'II', label: 'Sobre' },
    { id: 'servicos', roman: 'III', label: 'Cuidado' },
    { id: 'processo', roman: 'IV', label: 'Processo', dark: true },
    { id: 'duvidas', roman: 'V', label: 'Dúvidas' },
    { id: 'agenda', roman: 'VI', label: 'Agenda' },
  ]);

  readonly approachPillars = signal<ApproachPillar[]>([
    {
      svgIcon: ICON_BRAIN,
      title: 'Terapia Sistêmica',
      description:
        'Espaço dinâmico, provocações saudáveis, análise de padrões e apontamentos práticos para gerar movimento real.',
    },
    {
      svgIcon: ICON_LEAF,
      title: 'Visão ampliada',
      description:
        'Leitura das suas interações familiares, amorosas e profissionais dentro do contexto vivo em que você existe.',
    },
    {
      svgIcon: ICON_HEART,
      title: 'Ressignificação de padrões',
      description:
        'Identificação de repetições invisíveis e expectativas herdadas, abrindo espaço para escolhas conscientes hoje.',
    },
  ]);

  // Booking Signals
  readonly minBookingDate = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  })();
  readonly maxBookingDate = new Date(
    this.minBookingDate.getFullYear() + 1,
    this.minBookingDate.getMonth(),
    this.minBookingDate.getDate(),
  );
  readonly disabledSundays = signal<Date[]>(collectSundays(this.minBookingDate, this.maxBookingDate));

  readonly bookingStep = signal<number>(1);
  readonly bookingProgress = computed(() => Math.round((this.bookingStep() / 4) * 100));
  readonly selectedService = signal<string>('Terapia Individual');
  readonly selectedDate = signal<Date | null>(null);
  readonly selectedTimeSlot = signal<string | null>(null);
  readonly patientName = signal<string>('');
  readonly patientEmail = signal<string>('');
  readonly patientPhone = signal<string>('');
  readonly patientMessage = signal<string>('');
  readonly slotsLoading = signal<boolean>(false);
  readonly slotsError = signal<string | null>(null);
  readonly bookingLoading = signal<boolean>(false);
  readonly availableTimeSlots = signal<TimeSlot[]>([]);

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const rootEl = this.homeRoot().nativeElement;
    if (window.ScrollCraft) {
      this.scApi = window.ScrollCraft.mount(rootEl);
    }

    const updateScrollState = () => {
      this.rafId = 0;
      const y = window.scrollY;
      this.isScrolled.set(y > 32);

      const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      this.pageProgress.set(Math.min(Math.max(y / maxScroll, 0), 1));

      // Active chapter detection for the live Margin Folio
      const chapterList = this.chapters();
      const probeY = window.innerHeight * 0.42;
      let currentIdx = 0;
      for (let i = 0; i < chapterList.length; i++) {
        const el = document.getElementById(chapterList[i].id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= probeY) {
          currentIdx = i;
        }
      }
      this.activeChapter.set(currentIdx);

      const footerEl = document.getElementById('contato');
      if (footerEl) {
        const fRect = footerEl.getBoundingClientRect();
        this.isFooterInCenter.set(fRect.top <= window.innerHeight * 0.58);
      }

      // Sync Chapter 4 (Fio Sistêmico Peak) active therapy stage from --sc-p
      const peakEl = this.peakActEl()?.nativeElement;
      if (peakEl) {
        const rawP = parseFloat(peakEl.style.getPropertyValue('--sc-p') || '0');
        const clamped = Math.min(Math.max(isNaN(rawP) ? 0 : rawP, 0), 1);
        const stageIdx = Math.min(3, Math.floor(clamped * 3.99));
        if (stageIdx !== this.peakStageIndex()) {
          this.peakStageIndex.set(stageIdx);
          this.pinnedStageOverride.set(null);
        }
      }
    };

    this.scrollHandler = () => {
      if (!this.rafId) {
        this.rafId = requestAnimationFrame(updateScrollState);
      }
    };

    updateScrollState();
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    window.addEventListener('resize', this.scrollHandler, { passive: true });

    this.fragmentSub = this.route.fragment.subscribe(fragment => {
      if (!fragment) return;
      setTimeout(() => {
        document.getElementById(fragment)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    });
  }

  ngOnDestroy(): void {
    this.scApi?.destroy();
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      window.removeEventListener('resize', this.scrollHandler);
    }
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.fragmentSub?.unsubscribe();
    this.mobileSheetRef?.close();
  }

  selectStageNode(index: number): void {
    this.pinnedStageOverride.set(index);
  }

  openMobileMenu(): void {
    this.mobileSheetRef = this.sheetService.create({
      zTitle: 'Navegação',
      zDescription: 'Lays Coelho · Psicoterapia Sistêmica',
      zContent: this.mobileNavTemplate(),
      zSide: 'right',
      zHideFooter: true,
      zWidth: '280px',
    });
  }

  navigateToSection(id: string): void {
    this.mobileSheetRef?.close();
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }

  isPastDate(date: Date | null): boolean {
    if (!date) return true;
    return date < this.minBookingDate;
  }

  isSunday(date: Date | null): boolean {
    return !!date && date.getDay() === 0;
  }

  onCalendarDateChange(value: CalendarValue): void {
    const date = Array.isArray(value) ? (value[0] ?? null) : value instanceof Date ? value : null;
    if (!date) return;
    this.selectDate(date);
  }

  selectDate(date: Date | null): void {
    if (!date || this.isPastDate(date) || this.isSunday(date)) return;
    this.selectedDate.set(date);
    this.selectedTimeSlot.set(null);

    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    this.slotsLoading.set(true);
    this.slotsError.set(null);
    this.availableTimeSlots.set([]);

    this.bookingService.getAvailability(dateStr).subscribe({
      next: res => {
        this.availableTimeSlots.set(res.slots);
        this.slotsLoading.set(false);
      },
      error: err => {
        console.error('Availability error:', err);
        this.slotsError.set(
          'Não conseguimos conectar com o servidor de agenda. Verifique sua conexão e tente novamente.',
        );
        this.slotsLoading.set(false);
      },
    });
  }

  selectTimeSlot(slot: string): void {
    this.selectedTimeSlot.set(slot);
  }

  setStep(step: number): void {
    this.bookingStep.set(step);
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.scApi?.layout(), 60);
    }
  }

  confirmBooking(): void {
    if (!this.patientName() || !this.patientPhone()) return;
    const date = this.selectedDate();
    if (!date) return;

    const dateStrApi = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const dateStr = date.toLocaleDateString('pt-BR');

    this.bookingLoading.set(true);
    this.slotsError.set(null);

    this.bookingService
      .bookAppointment({
        service: this.selectedService(),
        date: dateStrApi,
        time: this.selectedTimeSlot()!,
        name: this.patientName(),
        email: this.patientEmail() || undefined,
        phone: this.patientPhone(),
        message: this.patientMessage() || undefined,
      })
      .subscribe({
        next: res => {
          const booking = {
            service: this.selectedService(),
            date: dateStr,
            time: this.selectedTimeSlot(),
            name: this.patientName(),
            email: this.patientEmail(),
            phone: this.patientPhone(),
            message: this.patientMessage(),
            timestamp: new Date().toISOString(),
            mode: res.mode,
            eventId: res.eventId,
          };
          const existing = JSON.parse(localStorage.getItem('lays_bookings') || '[]');
          existing.push(booking);
          localStorage.setItem('lays_bookings', JSON.stringify(existing));
          this.bookingLoading.set(false);
          this.bookingStep.set(4);

          const msg =
            `Olá, Lays! Acabei de solicitar um agendamento pelo site:\n\n` +
            `*Tipo de sessão:* ${this.selectedService()}\n` +
            `*Data:* ${dateStr}\n` +
            `*Horário:* ${this.selectedTimeSlot()}\n` +
            `*Nome:* ${this.patientName()}\n` +
            `*WhatsApp:* ${this.patientPhone()}\n` +
            (this.patientMessage() ? `*Observação:* ${this.patientMessage()}\n` : '') +
            `\nGostaria de confirmar a disponibilidade do horário.`;

          setTimeout(() => {
            window.open(`https://wa.me/553194720801?text=${encodeURIComponent(msg)}`, '_blank');
          }, 1500);
        },
        error: err => {
          console.error('Booking error:', err);
          this.slotsError.set(
            'Falha ao registrar o agendamento. Por favor, tente novamente ou entre em contato pelo WhatsApp.',
          );
          this.bookingLoading.set(false);
        },
      });
  }

  readonly serviceOptions = signal<ServiceOption[]>([
    {
      value: 'Terapia Individual',
      label: 'Individual',
      desc: 'Para se entender melhor e lidar com o que pesa no seu cotidiano.',
      svgIcon: ICON_PERSON,
    },
    {
      value: 'Terapia Familiar',
      label: 'Familiar',
      desc: 'Para restaurar e harmonizar os vínculos familiares.',
      svgIcon: ICON_FAMILY,
    },
    {
      value: 'Terapia de Casal',
      label: 'De Casal',
      desc: 'Para melhorar a comunicação e a conexão a dois.',
      svgIcon: ICON_HEART,
    },
  ]);

  readonly services = signal<ServiceItem[]>([
    {
      svgIcon: ICON_PERSON,
      title: 'Autoconhecimento',
      description:
        'Compreender emoções, padrões repetitivos e resgatar recursos internos para o desenvolvimento pessoal.',
      settleAt: 0.0,
    },
    {
      svgIcon: ICON_LEAF,
      title: 'Ansiedade e Depressão',
      description:
        'Apoio clínico e científico para tratar sobrecarga mental, esgotamento (burnout) e sintomas depressivos.',
      settleAt: 0.12,
    },
    {
      svgIcon: ICON_FAMILY,
      title: 'Terapia Familiar',
      description:
        'Olhar sistêmico sobre as relações, trabalhando os nós e dinâmicas que moldam a convivência familiar.',
      settleAt: 0.24,
    },
    {
      svgIcon: ICON_COMPASS,
      title: 'Luto e Transições',
      description:
        'Acolhimento humanizado em momentos de perdas, lutos, divórcios e grandes viradas no ciclo da vida.',
      settleAt: 0.36,
    },
    {
      svgIcon: ICON_HEART,
      title: 'Terapia de Casal',
      description:
        'Espaço seguro para casais elaborarem conflitos, aprofundarem a escuta e reconstruírem a parceria.',
      settleAt: 0.48,
    },
    {
      svgIcon: ICON_MONITOR,
      title: 'Consulta Online',
      description:
        'Sessões seguras e sigilosas por videochamada, com a mesma profundidade clínica no conforto da sua casa.',
      settleAt: 0.6,
    },
  ]);

  readonly therapyStages = signal<TherapyStage[]>([
    {
      number: '01',
      nodeLabel: 'História',
      title: 'Primeiro contato',
      description:
        'Você escolhe um horário pela agenda ou chama no WhatsApp. Não é preciso chegar com tudo organizado para começar.',
      systemicNote: 'Toda mudança começa quando o incômodo ganha voz em um espaço seguro.',
    },
    {
      number: '02',
      nodeLabel: 'Vínculos',
      title: 'Sessão inicial',
      description:
        'Mapeamos suas principais queixas, o contexto das suas relações e alinhamos os objetivos do processo online.',
      systemicNote: 'Olhamos para quem você é junto aos sistemas que atravessam a sua rotina.',
    },
    {
      number: '03',
      nodeLabel: 'Padrões',
      title: 'Processo terapêutico',
      description:
        'Encontros semanais ou quinzenais de 50 minutos, com escuta ativa, questionamentos precisos e direções práticas.',
      systemicNote: 'Quando uma repetição invisível fica clara, ela deixa de conduzir no piloto automático.',
    },
    {
      number: '04',
      nodeLabel: 'Escolhas',
      title: 'Transformação',
      description:
        'Com o tempo, novos posicionamentos se desenham, trazendo autonomia emocional e vínculos mais leves.',
      systemicNote: 'Consciência se converte em ação coerente com o que faz sentido para você hoje.',
    },
  ]);

  readonly testimonials = signal<Testimonial[]>([
    {
      text: 'Cheguei sem saber bem o que estava sentindo. A Lays me ajudou a nomear e entender coisas que eu carregava há anos. Não imaginava que a terapia pudesse ser assim.',
      author: 'Ana P.',
      context: 'Terapia Individual',
    },
    {
      text: 'A abordagem sistêmica muda o olhar. Comecei a ver minha história de um jeito diferente, e isso fez toda a diferença.',
      author: 'Carlos M.',
      context: 'Terapia Individual',
    },
    {
      text: 'Fui com receio de sessões online, mas a Lays cria um ambiente de escuta genuína mesmo à distância.',
      author: 'Fernanda L.',
      context: 'Atendimento Online',
    },
  ]);

  readonly faqs = signal<FaqItem[]>([
    {
      id: 'faq-online',
      question: 'Como funcionam as sessões 100% online?',
      answer:
        'Os encontros acontecem por videochamada em plataforma segura, com duração de 50 minutos. Você só precisa de um lugar privativo, fones de ouvido e uma conexão estável, de qualquer lugar do Brasil ou do exterior.',
    },
    {
      id: 'faq-primeira',
      question: 'Preciso saber o que dizer na primeira sessão?',
      answer:
        'Não. O primeiro encontro serve justamente para nos conhecermos e organizarmos juntos o que está pesando neste momento. Conduzo a conversa com perguntas cuidadosas para que você se sinta à vontade.',
    },
    {
      id: 'faq-frequencia',
      question: 'Qual é a frequência recomendada das sessões?',
      answer:
        'Na maioria dos casos começamos com encontros semanais, o que cria ritmo e continuidade no processo. Conforme os objetivos avançam, avaliamos juntos o espaçamento quinzenal.',
    },
    {
      id: 'faq-sigilo',
      question: 'O atendimento segue sigilo profissional?',
      answer:
        'Sim. Todo atendimento psicológico é regido pelo Código de Ética Profissional do Psicólogo (CRP 04/67406). O que é compartilhado em sessão permanece estritamente confidencial.',
    },
  ]);
}
