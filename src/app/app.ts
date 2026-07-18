import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookingService, TimeSlot } from './shared/core/services/booking.service';

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
  color: string;
}

// SVG icons inline (vetoriais, sem emojis)
const ICON_PERSON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const ICON_FAMILY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
const ICON_HEART = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const ICON_MONITOR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
const ICON_LEAF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`;
const ICON_COMPASS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent {

  private bookingService = inject(BookingService);

  readonly currentYear = computed(() => new Date().getFullYear());

  // Scheduler / Booking Signals
  readonly bookingStep = signal<number>(1);
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

  readonly currentMonth = signal<Date>(new Date());
  readonly weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  readonly availableTimeSlots = signal<TimeSlot[]>([]);

  // Generate calendar days for the current month
  readonly calendarDays = computed(() => {
    const date = this.currentMonth();
    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: (Date | null)[] = [];

    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }

    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  });

  readonly monthLabel = computed(() => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const date = this.currentMonth();
    return `${months[date.getMonth()]} de ${date.getFullYear()}`;
  });

  prevMonth() {
    const current = this.currentMonth();
    this.currentMonth.set(new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  nextMonth() {
    const current = this.currentMonth();
    this.currentMonth.set(new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  isPastDate(date: Date | null): boolean {
    if (!date) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  isSunday(date: Date | null): boolean {
    if (!date) return false;
    return date.getDay() === 0;
  }

  isToday(date: Date | null): boolean {
    if (!date) return false;
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  }

  isSelected(date: Date | null): boolean {
    const selected = this.selectedDate();
    if (!date || !selected) return false;
    return date.getDate() === selected.getDate() &&
      date.getMonth() === selected.getMonth() &&
      date.getFullYear() === selected.getFullYear();
  }

  selectDate(date: Date | null) {
    if (!date || this.isPastDate(date) || this.isSunday(date)) return;
    this.selectedDate.set(date);
    this.selectedTimeSlot.set(null);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    this.slotsLoading.set(true);
    this.slotsError.set(null);
    this.availableTimeSlots.set([]);

    this.bookingService.getAvailability(dateStr).subscribe({
      next: (res) => {
        this.availableTimeSlots.set(res.slots);
        this.slotsLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching availability:', err);
        this.slotsError.set('Não conseguimos conectar com o servidor de agenda. Verifique sua conexão e tente novamente.');
        this.slotsLoading.set(false);
      }
    });
  }

  selectTimeSlot(slot: string) {
    this.selectedTimeSlot.set(slot);
  }

  setStep(step: number) {
    this.bookingStep.set(step);
  }

  confirmBooking() {
    if (!this.patientName() || !this.patientPhone()) {
      return;
    }

    const date = this.selectedDate();
    if (!date) return;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStrForApi = `${year}-${month}-${day}`;

    const dateStr = date.toLocaleDateString('pt-BR');
    const timeStr = this.selectedTimeSlot();
    const serviceStr = this.selectedService();
    const nameStr = this.patientName();

    this.bookingLoading.set(true);

    const bookingData = {
      service: serviceStr,
      date: dateStrForApi,
      time: timeStr!,
      name: nameStr,
      email: this.patientEmail() || undefined,
      phone: this.patientPhone(),
      message: this.patientMessage() || undefined
    };

    this.bookingService.bookAppointment(bookingData).subscribe({
      next: (res) => {
        const booking = {
          service: serviceStr,
          date: dateStr,
          time: timeStr,
          name: nameStr,
          email: this.patientEmail(),
          phone: this.patientPhone(),
          message: this.patientMessage(),
          timestamp: new Date().toISOString(),
          mode: res.mode,
          eventId: res.eventId
        };

        const existing = JSON.parse(localStorage.getItem('lays_bookings') || '[]');
        existing.push(booking);
        localStorage.setItem('lays_bookings', JSON.stringify(existing));

        this.bookingLoading.set(false);
        this.bookingStep.set(4);

        // WhatsApp redirect com mensagem pré-formatada
        const formattedPhone = '553194720801';
        const textMsg =
          `Olá, Lays! Acabei de solicitar um agendamento pelo site:\n\n` +
          `*Tipo de sessão:* ${serviceStr}\n` +
          `*Data:* ${dateStr}\n` +
          `*Horário:* ${timeStr}\n` +
          `*Nome:* ${nameStr}\n` +
          `*WhatsApp:* ${this.patientPhone()}\n` +
          (this.patientMessage() ? `*Observação:* ${this.patientMessage()}\n` : '') +
          `\nGostaria de confirmar a disponibilidade do horário.`;

        const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(textMsg)}`;

        setTimeout(() => {
          window.open(url, '_blank');
        }, 1500);
      },
      error: (err) => {
        console.error('Error creating booking:', err);
        this.slotsError.set('Falha ao registrar o agendamento. Por favor, tente novamente ou entre em contato pelo WhatsApp.');
        this.bookingLoading.set(false);
      }
    });
  }

  // --------------------------------------------------------
  // Dados da página — atualizados com novos textos
  // --------------------------------------------------------

  readonly stats = signal<Stat[]>([
    { value: '5+', label: 'Anos de experiência clínica' },
    { value: '200+', label: 'Pacientes acompanhados' },
    { value: 'CRP', label: 'Registro ativo e verificado' },
    { value: '100%', label: 'Sigilo profissional' },
  ]);

  // Opções do step 1 do booking (com ícones SVG)
  readonly serviceOptions = signal<ServiceOption[]>([
    {
      value: 'Terapia Individual',
      label: 'Individual',
      desc: 'Para se entender melhor e lidar com o que pesa.',
      svgIcon: ICON_PERSON,
    },
    {
      value: 'Terapia de Casal',
      label: 'De Casal',
      desc: 'Para dois que querem se encontrar de novo.',
      svgIcon: ICON_HEART,
    },
    {
      value: 'Terapia Familiar',
      label: 'Familiar',
      desc: 'Para trabalhar os vínculos que moldam a todos.',
      svgIcon: ICON_FAMILY,
    },
  ]);

  // Cards de serviços na seção "Para quem é"
  readonly services = signal<ServiceItem[]>([
    {
      svgIcon: ICON_PERSON,
      title: 'Terapia Individual',
      description: 'Um espaço para explorar suas emoções, padrões e recursos internos — sem julgamentos, no seu ritmo.',
    },
    {
      svgIcon: ICON_FAMILY,
      title: 'Terapia Familiar',
      description: 'Trabalhar os vínculos e dinâmicas que perpassam gerações, para que as relações se tornem mais saudáveis.',
    },
    {
      svgIcon: ICON_HEART,
      title: 'Terapia de Casal',
      description: 'Para casais que querem aprofundar a conexão, melhorar a comunicação ou atravessar momentos difíceis juntos.',
    },
    {
      svgIcon: ICON_MONITOR,
      title: 'Atendimento Online',
      description: 'A mesma qualidade de presença e escuta do atendimento presencial, de onde você estiver.',
    },
    {
      svgIcon: ICON_LEAF,
      title: 'Ansiedade e Esgotamento',
      description: 'Escuta especializada para quem sente que o dia a dia pesou demais, sem conseguir nomear exatamente por quê.',
    },
    {
      svgIcon: ICON_COMPASS,
      title: 'Transições de Vida',
      description: 'Suporte em momentos de mudança — separações, lutos, novos começos — com cuidado e perspectiva sistêmica.',
    },
  ]);

  readonly steps = signal<Step[]>([
    {
      number: '01',
      title: 'Primeiro contato',
      description: 'Entre em contato pelo WhatsApp ou agende pelo site. Não precisa saber o que dizer — pode começar com o que está sentindo.',
    },
    {
      number: '02',
      title: 'Sessão inicial',
      description: 'Conversamos sobre o que te trouxe e entendemos juntos o que faz sentido explorar.',
    },
    {
      number: '03',
      title: 'Processo terapêutico',
      description: 'Sessões regulares, presenciais ou online, no ritmo que funciona para você.',
    },
    {
      number: '04',
      title: 'Transformação',
      description: 'Com o tempo, recursos internos emergem e mudanças reais, concretas, acontecem.',
    },
  ]);

  readonly testimonials = signal<Testimonial[]>([
    {
      text: 'Cheguei sem saber bem o que estava sentindo. A Lays me ajudou a nomear e entender coisas que eu carregava há anos. Não imaginava que a terapia pudesse ser assim.',
      author: 'Ana P.',
      color: '#4D6D66',
    },
    {
      text: 'A abordagem sistêmica muda o olhar. Comecei a ver minha história de um jeito diferente — e isso fez toda a diferença.',
      author: 'Carlos M.',
      color: '#4D6D66',
    },
    {
      text: 'Fui com receio de sessões online, mas a Lays cria um ambiente de escuta genuína mesmo à distância.',
      author: 'Fernanda L.',
      color: '#4D6D66',
    },
  ]);
}