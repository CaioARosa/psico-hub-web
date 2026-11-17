import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
  inject,
  AfterViewInit,
  OnDestroy,
  PLATFORM_ID,
  TemplateRef,
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

interface Stat {
  value: string;
  label: string;
}
interface ServiceItem {
  svgIcon: string;
  title: string;
  description: string;
}
interface ServiceOption {
  value: string;
  label: string;
  desc: string;
  svgIcon: string;
}
interface Step {
  number: string;
  title: string;
  description: string;
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

interface Butterfly {
  id: number;
  left: string;
  top: string;
  size: number;
  color: string;
  duration: string;
  delay: string;
  flapSpeed: string;
}

const ICON_PERSON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const ICON_FAMILY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
const ICON_HEART = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const ICON_MONITOR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
const ICON_LEAF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`;
const ICON_COMPASS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`;
const ICON_BRAIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-4.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2zM14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-4.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2z"/></svg>`;

function createButterflies(): Butterfly[] {
  const list: Butterfly[] = [];
  const colors = ['#4D6D66', '#8B7355', '#6E8B75', '#A3B899'];
  for (let i = 1; i <= 5; i++) {
    list.push({
      id: i,
      left: `${10 + i * 14}%`,
      top: `${14 + (i % 3) * 18}%`,
      size: 16 + ((i * 3) % 8),
      color: colors[i % colors.length],
      duration: `${14 + i * 2}s`,
      delay: `${i * -1.5}s`,
      flapSpeed: `${0.9 + i * 0.18}s`,
    });
  }
  return list;
}

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

  readonly mobileNavTemplate = viewChild.required<TemplateRef<void>>('mobileNavTemplate');

  private observer!: IntersectionObserver;
  private scrollHandler!: () => void;

  readonly iconBrain = ICON_BRAIN;
  readonly iconLeaf = ICON_LEAF;
  readonly iconHeart = ICON_HEART;
  readonly iconPerson = ICON_PERSON;

  readonly currentYear = computed(() => new Date().getFullYear());
  readonly isScrolled = signal(false);

  readonly butterflies = signal<Butterfly[]>(createButterflies());

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

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
            const connectors = entry.target.querySelectorAll('.step-connector');
            connectors.forEach((c, i) => {
              setTimeout(() => c.classList.add('reveal-visible'), i * 180 + 350);
            });
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -48px 0px' },
    );

    const targets = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-stagger');
    targets.forEach(el => this.observer.observe(el));

    this.scrollHandler = () => {
      const y = window.scrollY;
      this.isScrolled.set(y > 24);
      document.documentElement.style.setProperty('--scroll-y', `${y}px`);
    };
    this.scrollHandler();
    window.addEventListener('scroll', this.scrollHandler, { passive: true });

    this.fragmentSub = this.route.fragment.subscribe(fragment => {
      if (!fragment) return;
      setTimeout(() => {
        document.getElementById(fragment)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    });
  }

  ngOnDestroy() {
    if (this.observer) this.observer.disconnect();
    if (this.scrollHandler) window.removeEventListener('scroll', this.scrollHandler);
    this.fragmentSub?.unsubscribe();
    this.mobileSheetRef?.close();
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

  selectDate(date: Date | null) {
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

  selectTimeSlot(slot: string) {
    this.selectedTimeSlot.set(slot);
  }

  setStep(step: number) {
    this.bookingStep.set(step);
  }

  confirmBooking() {
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

  readonly stats = signal<Stat[]>([
    { value: '5+', label: 'Anos de experiência clínica' },
    { value: '200+', label: 'Acolhimentos realizados' },
    { value: 'CRP', label: 'Registro ativo: Nº 04/67406' },
    { value: '100%', label: 'Sigilo e confidencialidade' },
  ]);

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
      desc: 'Para melhorar a comunicação e conexão a dois.',
      svgIcon: ICON_HEART,
    },
  ]);

  readonly services = signal<ServiceItem[]>([
    {
      svgIcon: ICON_PERSON,
      title: 'Autoconhecimento',
      description:
        'Compreender suas emoções, padrões repetitivos e resgatar seus recursos internos para o desenvolvimento pessoal.',
    },
    {
      svgIcon: ICON_LEAF,
      title: 'Ansiedade e Depressão',
      description:
        'Apoio clínico e científico para tratar a sobrecarga mental, o esgotamento (burnout) e sintomas depressivos.',
    },
    {
      svgIcon: ICON_FAMILY,
      title: 'Terapia Familiar',
      description:
        'Olhar sistêmico sobre as relações, trabalhando os nós e dinâmicas que moldam as interações familiares.',
    },
    {
      svgIcon: ICON_COMPASS,
      title: 'Luto e Transições',
      description:
        'Acolhimento humanizado em momentos de perdas, lutos, divórcios e grandes mudanças no ciclo da vida.',
    },
    {
      svgIcon: ICON_HEART,
      title: 'Terapia de Casal',
      description:
        'Espaço seguro para casais resolverem conflitos, aprofundarem a conexão e reconstruírem a parceria.',
    },
    {
      svgIcon: ICON_MONITOR,
      title: 'Consulta 100% Online',
      description:
        'Sessões terapêuticas seguras e sigilosas por videochamada, oferecendo acolhimento no conforto da sua casa.',
    },
  ]);

  readonly steps = signal<Step[]>([
    {
      number: '01',
      title: 'Primeiro contato',
      description:
        'Entre em contato por WhatsApp ou agende pelo site. Você não precisa saber o que dizer para começar.',
    },
    {
      number: '02',
      title: 'Sessão inicial',
      description: 'Alinhamos as suas principais queixas e definimos os objetivos do processo terapêutico online.',
    },
    {
      number: '03',
      title: 'Processo terapêutico',
      description: 'Sessões semanais ou quinzenais 100% online via chamada de vídeo segura.',
    },
    {
      number: '04',
      title: 'Transformação',
      description: 'Com o tempo, novos caminhos se desenham, trazendo autonomia e alívio emocional.',
    },
  ]);

  readonly testimonials = signal<Testimonial[]>([
    {
      text: 'Cheguei sem saber bem o que estava sentindo. A Lays me ajudou a nomear e entender coisas que eu carregava há anos. Não imaginava que a terapia pudesse ser assim.',
      author: 'Ana P.',
      context: 'Terapia Individual',
    },
    {
      text: 'A abordagem sistêmica muda o olhar. Comecei a ver minha história de um jeito diferente — e isso fez toda a diferença.',
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
        'Os encontros acontecem por videochamada em plataforma segura, com duração de 50 minutos. Você só precisa de um lugar privativo, fones de ouvido e uma conexão estável — de qualquer lugar do Brasil ou do exterior.',
    },
    {
      id: 'faq-primeira',
      question: 'Preciso saber o que dizer na primeira sessão?',
      answer:
        'Não. O primeiro encontro serve justamente para nos conhecermos e organizarmos juntos o que está pesando neste momento. Eu conduzo a conversa com perguntas cuidadosas para que você se sinta à vontade.',
    },
    {
      id: 'faq-frequencia',
      question: 'Qual é a frequência recomendada das sessões?',
      answer:
        'Na maioria dos casos começamos com encontros semanais, o que ajuda a criar ritmo e continuidade no processo. Conforme os objetivos avançam, avaliamos em conjunto a possibilidade de espaçamento quinzenal.',
    },
    {
      id: 'faq-sigilo',
      question: 'O atendimento segue sigilo profissional?',
      answer:
        'Sim. Todo atendimento psicológico é regido pelo Código de Ética Profissional do Psicólogo (CRP 04/67406). O que é compartilhado em sessão permanece estritamente confidencial.',
    },
  ]);
}
