import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookingService } from './shared/core/services/booking.service';

interface Butterfly {
  id: number;
  left: string;
  top: string;
  size: number;
  color: string;
  delay: string;
  duration: string;
}

interface Stat {
  value: string;
  label: string;
}

interface Service {
  icon: string;
  title: string;
  description: string;
  bg: string;
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

  readonly availableTimeSlots = signal<string[]>([]);

  // Generate calendar days for the current month
  readonly calendarDays = computed(() => {
    const date = this.currentMonth();
    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: (Date | null)[] = [];

    // Padding for empty days at the start of month grid
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }

    // Days of the month
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
    const prev = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    this.currentMonth.set(prev);
  }

  nextMonth() {
    const current = this.currentMonth();
    const next = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    this.currentMonth.set(next);
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
    this.selectedTimeSlot.set(null); // Reset time when date changes

    // Format date as YYYY-MM-DD for backend API
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
        this.slotsError.set('Falha ao conectar com o servidor da agenda.');
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
      alert('Por favor, preencha seu nome e telefone.');
      return;
    }

    const date = this.selectedDate();
    if (!date) return;

    // Format date as YYYY-MM-DD for backend API
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
        // Save to local storage for patient persistence
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

        // Redirect step to success (Step 4)
        this.bookingLoading.set(false);
        this.bookingStep.set(4);

        // Format WhatsApp message
        const formattedPhone = '553194720801'; // Lays' consultation WhatsApp phone
        const textMsg = `Olá Lays! Acabei de solicitar um agendamento pelo seu site:\n\n` +
          `*Serviço:* ${serviceStr}\n` +
          `*Data:* ${dateStr}\n` +
          `*Horário:* ${timeStr}\n` +
          `*Nome:* ${nameStr}\n` +
          `*WhatsApp:* ${this.patientPhone()}\n` +
          `*Mensagem:* ${this.patientMessage() || 'Sem observações'}\n\n` +
          `Gostaria de confirmar a disponibilidade da sessão!`;

        const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(textMsg)}`;

        // Smooth delay before redirecting to WhatsApp
        setTimeout(() => {
          window.open(url, '_blank');
        }, 1500);
      },
      error: (err) => {
        console.error('Error creating booking event:', err);
        alert('Erro ao agendar consulta no Google Agenda. Por favor, tente novamente.');
        this.bookingLoading.set(false);
      }
    });
  }

  readonly butterflies = signal<Butterfly[]>([
    { id: 1, left: '8%', top: '15%', size: 24, color: '#9DC5C8', delay: '0s', duration: '7s' },
    { id: 2, left: '15%', top: '70%', size: 18, color: '#F2C9A0', delay: '1.2s', duration: '9s' },
    { id: 3, left: '72%', top: '10%', size: 20, color: '#F4B8C4', delay: '0.5s', duration: '8s' },
    { id: 4, left: '85%', top: '55%', size: 16, color: '#9DC5C8', delay: '2s', duration: '6s' },
    { id: 5, left: '60%', top: '80%', size: 22, color: '#A8C5A0', delay: '0.8s', duration: '10s' },
    { id: 6, left: '45%', top: '5%', size: 14, color: '#F2C9A0', delay: '1.5s', duration: '7.5s' },
    { id: 7, left: '92%', top: '30%', size: 18, color: '#F4B8C4', delay: '3s', duration: '8.5s' },
    { id: 8, left: '3%', top: '45%', size: 20, color: '#A8C5A0', delay: '2.5s', duration: '9.5s' },
    { id: 9, left: '52%', top: '60%', size: 12, color: '#9DC5C8', delay: '0.3s', duration: '6.5s' },
    { id: 10, left: '30%', top: '88%', size: 16, color: '#F2C9A0', delay: '1.8s', duration: '8s' },
  ]);

  readonly stats = signal<Stat[]>([
    { value: '5+', label: 'Anos de experiência' },
    { value: '200+', label: 'Pacientes atendidos' },
    { value: '100%', label: 'Sigilo garantido' },
    { value: '★ 5', label: 'Avaliação média' },
  ]);

  readonly services = signal<Service[]>([
    {
      icon: '🧩',
      title: 'Terapia Individual',
      description: 'Um espaço seguro para explorar suas emoções, padrões e recursos internos, com foco no seu bem-estar integral.',
      bg: '#D4EAE8',
    },
    {
      icon: '👨‍👩‍👧',
      title: 'Terapia Familiar',
      description: 'Trabalhamos os vínculos e dinâmicas familiares para fortalecer a comunicação e a saúde emocional do sistema.',
      bg: '#FAE8DC',
    },
    {
      icon: '💑',
      title: 'Terapia de Casal',
      description: 'Apoio para casais que desejam aprofundar a conexão, resolver conflitos e construir uma parceria mais saudável.',
      bg: '#F9E0E5',
    },
    {
      icon: '💻',
      title: 'Atendimento Online',
      description: 'Sessões por videochamada com a mesma qualidade e presença do atendimento presencial, de onde você estiver.',
      bg: '#E8EDD4',
    },
    {
      icon: '🌱',
      title: 'Ansiedade & Estresse',
      description: 'Técnicas e escuta especializada para lidar com ansiedade, esgotamento e os desafios do dia a dia moderno.',
      bg: '#D4EAE8',
    },
    {
      icon: '🔄',
      title: 'Transições de Vida',
      description: 'Suporte em momentos de mudança — luto, separação, novos começos — com cuidado e perspectiva sistêmica.',
      bg: '#FAE8DC',
    },
  ]);

  readonly steps = signal<Step[]>([
    {
      number: '01',
      title: 'Primeiro Contato',
      description: 'Entre em contato pelo WhatsApp ou e-mail. Responderei em até 24h.',
    },
    {
      number: '02',
      title: 'Sessão Inicial',
      description: 'Conversamos sobre suas necessidades e definimos juntas o melhor caminho.',
    },
    {
      number: '03',
      title: 'Processo Terapêutico',
      description: 'Sessões semanais ou quinzenais, presenciais ou online, no seu ritmo.',
    },
    {
      number: '04',
      title: 'Transformação',
      description: 'Com o tempo, recursos internos emergem e mudanças reais acontecem.',
    },
  ]);

  readonly testimonials = signal<Testimonial[]>([
    {
      text: 'A Lays tem uma escuta incrível. Me sinto completamente acolhida em cada sessão. Nunca imaginei que a terapia pudesse ser tão transformadora.',
      author: 'Ana P.',
      color: '#9DC5C8',
    },
    {
      text: 'A abordagem sistêmica mudou minha forma de ver minha família e a mim mesmo. É uma terapia que vai além do óbvio.',
      author: 'Carlos M.',
      color: '#C8A882',
    },
    {
      text: 'Comecei o atendimento online sem muita expectativa, mas fui surpreendida. A Lays cria um espaço seguro mesmo à distância.',
      author: 'Fernanda L.',
      color: '#A8C5A0',
    },
  ]);
}