import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

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

  readonly currentYear = computed(() => new Date().getFullYear());

  readonly butterflies = signal<Butterfly[]>([
    { id: 1,  left: '8%',  top: '15%', size: 24, color: '#9DC5C8', delay: '0s',    duration: '7s'  },
    { id: 2,  left: '15%', top: '70%', size: 18, color: '#F2C9A0', delay: '1.2s',  duration: '9s'  },
    { id: 3,  left: '72%', top: '10%', size: 20, color: '#F4B8C4', delay: '0.5s',  duration: '8s'  },
    { id: 4,  left: '85%', top: '55%', size: 16, color: '#9DC5C8', delay: '2s',    duration: '6s'  },
    { id: 5,  left: '60%', top: '80%', size: 22, color: '#A8C5A0', delay: '0.8s',  duration: '10s' },
    { id: 6,  left: '45%', top: '5%',  size: 14, color: '#F2C9A0', delay: '1.5s',  duration: '7.5s'},
    { id: 7,  left: '92%', top: '30%', size: 18, color: '#F4B8C4', delay: '3s',    duration: '8.5s'},
    { id: 8,  left: '3%',  top: '45%', size: 20, color: '#A8C5A0', delay: '2.5s',  duration: '9.5s'},
    { id: 9,  left: '52%', top: '60%', size: 12, color: '#9DC5C8', delay: '0.3s',  duration: '6.5s'},
    { id: 10, left: '30%', top: '88%', size: 16, color: '#F2C9A0', delay: '1.8s',  duration: '8s'  },
  ]);

  readonly stats = signal<Stat[]>([
    { value: '5+',   label: 'Anos de experiência' },
    { value: '200+', label: 'Pacientes atendidos' },
    { value: '100%', label: 'Sigilo garantido' },
    { value: '★ 5',  label: 'Avaliação média' },
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