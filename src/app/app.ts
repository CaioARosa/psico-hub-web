import {
  Component,
  computed,
  signal,
  inject,
  AfterViewInit,
  OnDestroy,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { BookingService, TimeSlot } from './shared/core/services/booking.service';

interface Stat          { value: string; label: string; }
interface ServiceItem   { svgIcon: string; title: string; description: string; }
interface ServiceOption { value: string; label: string; desc: string; svgIcon: string; }
interface Step          { number: string; title: string; description: string; }
interface Testimonial   { text: string; author: string; color: string; }

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

// SVG icons inline (vetoriais, sem emojis)
const ICON_PERSON   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const ICON_FAMILY   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
const ICON_HEART    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const ICON_MONITOR  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
const ICON_LEAF     = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`;
const ICON_COMPASS  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`;

/** Gera a lista de borboletas com posições e tempos pseudo-aleatórios */
function createButterflies(): Butterfly[] {
  const palette = [
    '#7AADA5', // verde sálvia médio
    '#4D6D66', // verde sálvia escuro
    '#A8C5BE', // verde acinzentado
    '#C8B89A', // bege quente
    '#9BBFB9', // aqua suave
    '#B8D4CE', // verde pálido
  ];

  const positions = [
    { left:  '8%', top: '18%' },
    { left: '18%', top: '62%' },
    { left: '28%', top: '32%' },
    { left: '48%', top: '78%' },
    { left: '62%', top: '22%' },
    { left: '72%', top: '55%' },
    { left: '82%', top: '38%' },
    { left: '88%', top: '70%' },
    { left: '55%', top: '12%' },
    { left: '35%', top: '88%' },
    { left: '92%', top: '20%' },
    { left: '15%', top: '45%' },
  ];

  const durations    = ['7.5s','9s','10.5s','8.2s','11s','7s','12s','8.8s','9.7s','10.2s','8s','11.5s'];
  const delays       = ['0s','1.2s','0.5s','2.3s','0.8s','1.8s','0.3s','2.8s','1.5s','0.7s','2s','3s'];
  const flapSpeeds   = ['1.1s','1.4s','0.9s','1.6s','1.2s','1.0s','1.5s','0.85s','1.3s','1.7s','0.95s','1.25s'];
  const sizes        = [32, 24, 40, 28, 36, 22, 44, 30, 26, 38, 34, 20];

  return positions.map((pos, i) => ({
    id:        i,
    left:      pos.left,
    top:       pos.top,
    size:      sizes[i],
    color:     palette[i % palette.length],
    duration:  durations[i],
    delay:     delays[i],
    flapSpeed: flapSpeeds[i],
  }));
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent implements AfterViewInit, OnDestroy {

  private bookingService = inject(BookingService);
  private platformId     = inject(PLATFORM_ID);

  private observer!: IntersectionObserver;
  private scrollHandler!: () => void;

  readonly currentYear = computed(() => new Date().getFullYear());

  // Borboletas — posições e animações variadas
  readonly butterflies = signal<Butterfly[]>(createButterflies());

  // Booking Signals
  readonly bookingStep      = signal<number>(1);
  readonly selectedService  = signal<string>('Terapia Individual');
  readonly selectedDate     = signal<Date | null>(null);
  readonly selectedTimeSlot = signal<string | null>(null);
  readonly patientName      = signal<string>('');
  readonly patientEmail     = signal<string>('');
  readonly patientPhone     = signal<string>('');
  readonly patientMessage   = signal<string>('');
  readonly slotsLoading     = signal<boolean>(false);
  readonly slotsError       = signal<string | null>(null);
  readonly bookingLoading   = signal<boolean>(false);
  readonly currentMonth     = signal<Date>(new Date());
  readonly weekDays         = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  readonly availableTimeSlots = signal<TimeSlot[]>([]);

  // Calendário — dias do mês atual
  readonly calendarDays = computed(() => {
    const date = this.currentMonth();
    const year  = date.getFullYear();
    const month = date.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays     = new Date(year, month + 1, 0).getDate();

    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++)    days.push(new Date(year, month, i));
    return days;
  });

  readonly monthLabel = computed(() => {
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const d = this.currentMonth();
    return `${months[d.getMonth()]} de ${d.getFullYear()}`;
  });

  // --------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------
  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    // Intersection Observer — scroll-reveal
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
            // Conectores de passo
            const connectors = entry.target.querySelectorAll('.step-connector');
            connectors.forEach((c, i) => {
              setTimeout(() => c.classList.add('reveal-visible'), i * 200 + 400);
            });
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    );

    // Observar todos os elementos com classes de reveal
    const targets = document.querySelectorAll(
      '.reveal, .reveal-left, .reveal-right, .reveal-stagger'
    );
    targets.forEach(el => this.observer.observe(el));

    // Parallax no hero via CSS custom property
    this.scrollHandler = () => {
      const y = window.scrollY;
      document.documentElement.style.setProperty('--scroll-y', `${y}px`);
    };
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
  }

  ngOnDestroy() {
    if (this.observer)      this.observer.disconnect();
    if (this.scrollHandler) window.removeEventListener('scroll', this.scrollHandler);
  }

  // --------------------------------------------------------
  // Calendário helpers
  // --------------------------------------------------------
  prevMonth() {
    const c = this.currentMonth();
    this.currentMonth.set(new Date(c.getFullYear(), c.getMonth() - 1, 1));
  }

  nextMonth() {
    const c = this.currentMonth();
    this.currentMonth.set(new Date(c.getFullYear(), c.getMonth() + 1, 1));
  }

  isPastDate(date: Date | null): boolean {
    if (!date) return true;
    const today = new Date(); today.setHours(0,0,0,0);
    return date < today;
  }

  isSunday(date: Date | null): boolean {
    return !!date && date.getDay() === 0;
  }

  isToday(date: Date | null): boolean {
    if (!date) return false;
    const t = new Date();
    return date.getDate()     === t.getDate()  &&
           date.getMonth()    === t.getMonth() &&
           date.getFullYear() === t.getFullYear();
  }

  isSelected(date: Date | null): boolean {
    const s = this.selectedDate();
    if (!date || !s) return false;
    return date.getDate()     === s.getDate()  &&
           date.getMonth()    === s.getMonth() &&
           date.getFullYear() === s.getFullYear();
  }

  selectDate(date: Date | null) {
    if (!date || this.isPastDate(date) || this.isSunday(date)) return;
    this.selectedDate.set(date);
    this.selectedTimeSlot.set(null);

    const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    this.slotsLoading.set(true);
    this.slotsError.set(null);
    this.availableTimeSlots.set([]);

    this.bookingService.getAvailability(dateStr).subscribe({
      next:  (res) => { this.availableTimeSlots.set(res.slots); this.slotsLoading.set(false); },
      error: (err) => {
        console.error('Availability error:', err);
        this.slotsError.set('Não conseguimos conectar com o servidor de agenda. Verifique sua conexão e tente novamente.');
        this.slotsLoading.set(false);
      }
    });
  }

  selectTimeSlot(slot: string) { this.selectedTimeSlot.set(slot); }
  setStep(step: number)        { this.bookingStep.set(step); }

  confirmBooking() {
    if (!this.patientName() || !this.patientPhone()) return;
    const date = this.selectedDate();
    if (!date) return;

    const dateStrApi = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const dateStr    = date.toLocaleDateString('pt-BR');

    this.bookingLoading.set(true);

    this.bookingService.bookAppointment({
      service: this.selectedService(),
      date:    dateStrApi,
      time:    this.selectedTimeSlot()!,
      name:    this.patientName(),
      email:   this.patientEmail() || undefined,
      phone:   this.patientPhone(),
      message: this.patientMessage() || undefined,
    }).subscribe({
      next: (res) => {
        const booking = {
          service:   this.selectedService(),
          date:      dateStr,
          time:      this.selectedTimeSlot(),
          name:      this.patientName(),
          email:     this.patientEmail(),
          phone:     this.patientPhone(),
          message:   this.patientMessage(),
          timestamp: new Date().toISOString(),
          mode:      res.mode,
          eventId:   res.eventId,
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
      error: (err) => {
        console.error('Booking error:', err);
        this.slotsError.set('Falha ao registrar o agendamento. Por favor, tente novamente ou entre em contato pelo WhatsApp.');
        this.bookingLoading.set(false);
      }
    });
  }

  // --------------------------------------------------------
  // Dados da página
  // --------------------------------------------------------

  readonly stats = signal<Stat[]>([
    { value: '5+',   label: 'Anos de experiência clínica' },
    { value: '200+', label: 'Acolhimentos realizados' },
    { value: 'CRP',  label: 'Registro profissional ativo' },
    { value: '100%', label: 'Sigilo e confidencialidade' },
  ]);

  readonly serviceOptions = signal<ServiceOption[]>([
    { value:'Terapia Individual', label:'Individual', desc:'Para se entender melhor e lidar com o que pesa no seu cotidiano.', svgIcon:ICON_PERSON },
    { value:'Terapia Familiar',   label:'Familiar',   desc:'Para restaurar e harmonizar os vínculos familiares.', svgIcon:ICON_FAMILY },
    { value:'Terapia de Casal',   label:'De Casal',   desc:'Para melhorar a comunicação e conexão a dois.', svgIcon:ICON_HEART  },
  ]);

  readonly services = signal<ServiceItem[]>([
    { svgIcon:ICON_PERSON,  title:'Autoconhecimento', description:'Compreender suas emoções, padrões repetitivos e resgatar seus recursos internos para o desenvolvimento pessoal.' },
    { svgIcon:ICON_LEAF,    title:'Ansiedade e Depressão', description:'Apoio clínico e científico para tratar a sobrecarga mental, o esgotamento (burnout) e sintomas depressivos.' },
    { svgIcon:ICON_FAMILY,  title:'Terapia Familiar',   description:'Olhar sistêmico sobre as relações, trabalhando os nós e dinâmicas que moldam as interações familiares.' },
    { svgIcon:ICON_COMPASS, title:'Luto e Transições', description:'Acolhimento humanizado em momentos de perdas, lutos, divórcios e grandes mudanças no ciclo da vida.' },
    { svgIcon:ICON_HEART,   title:'Terapia de Casal',   description:'Espaço seguro para casais resolverem conflitos, aprofundarem a conexão e reconstruírem a parceria.' },
    { svgIcon:ICON_MONITOR, title:'Consulta 100% Online', description:'Sessões terapêuticas seguras e sigilosas por videochamada, oferecendo acolhimento no conforto da sua casa.' },
  ]);

  readonly steps = signal<Step[]>([
    { number:'01', title:'Primeiro contato',        description:'Entre em contato por WhatsApp ou agende pelo site. Você não precisa saber o que dizer para começar.' },
    { number:'02', title:'Sessão inicial',           description:'Alinhamos as suas principais queixas e definimos os objetivos do processo terapêutico online.' },
    { number:'03', title:'Processo terapêutico',     description:'Sessões semanais ou quinzenais 100% online via chamada de vídeo segura, adaptadas ao seu tempo.' },
    { number:'04', title:'Transformação',             description:'Com o tempo, novos caminhos se desenham, trazendo autonomia e alívio emocional.' },
  ]);

  readonly testimonials = signal<Testimonial[]>([
    { text:'Cheguei sem saber bem o que estava sentindo. A Lays me ajudou a nomear e entender coisas que eu carregava há anos. Não imaginava que a terapia pudesse ser assim.', author:'Ana P.', color:'#4D6D66' },
    { text:'A abordagem sistêmica muda o olhar. Comecei a ver minha história de um jeito diferente — e isso fez toda a diferença.',                                               author:'Carlos M.', color:'#4D6D66' },
    { text:'Fui com receio de sessões online, mas a Lays cria um ambiente de escuta genuína mesmo à distância.',                                                                   author:'Fernanda L.', color:'#4D6D66' },
  ]);
}