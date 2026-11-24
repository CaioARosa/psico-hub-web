import { chargeMessage, whatsappChargeUrl, whatsappLink, whatsappNumber } from './charge-message';
import { formatCents } from './money';

describe('whatsappNumber', () => {
  it('adiciona 55 em celular brasileiro de 11 dígitos com máscara', () => {
    expect(whatsappNumber('(11) 98888-7777')).toBe('5511988887777');
  });

  it('adiciona 55 em telefone fixo brasileiro de 10 dígitos', () => {
    expect(whatsappNumber('11 3333-4444')).toBe('551133334444');
  });

  it('mantém celular de 13 dígitos que já começa com 55', () => {
    expect(whatsappNumber('+55 (11) 98888-7777')).toBe('5511988887777');
  });

  it('mantém fixo de 12 dígitos que já começa com 55', () => {
    expect(whatsappNumber('55 11 3333-4444')).toBe('551133334444');
  });

  it.each([
    ['vazio', ''],
    ['só espaços', '   '],
    ['curto (< 10 dígitos)', '1234-567'],
    ['longo (> 13 dígitos)', '12345678901234'],
    ['12 dígitos sem prefixo 55', '123456789012'],
    ['13 dígitos sem prefixo 55', '1234567890123'],
  ])('devolve null para número %s', (_label, phone) => {
    expect(whatsappNumber(phone)).toBeNull();
  });
});

describe('chargeMessage', () => {
  it('usa apenas o primeiro nome e formata o valor via formatCents', () => {
    expect(chargeMessage('  Ana Paula  ', 30000)).toBe(
      `Olá, Ana! Tudo bem? Passando para lembrar do valor em aberto das sessões: ${formatCents(30000)}. Quando fizer o Pix, pode me mandar o comprovante? Obrigada!`,
    );
  });
});

describe('whatsappChargeUrl', () => {
  it('monta URL wa.me com número normalizado e mensagem codificada', () => {
    const expectedText = encodeURIComponent(chargeMessage('Ana Paula', 30000));
    expect(whatsappChargeUrl('(11) 98888-7777', 'Ana Paula', 30000)).toBe(
      `https://wa.me/5511988887777?text=${expectedText}`,
    );
  });

  it('devolve null se o telefone for inválido', () => {
    expect(whatsappChargeUrl('1234-567', 'Ana Paula', 30000)).toBeNull();
  });

  it('devolve null se o nome estiver vazio', () => {
    expect(whatsappChargeUrl('(11) 98888-7777', '   ', 30000)).toBeNull();
  });

  it.each([0, -100, Number.NaN, Number.POSITIVE_INFINITY, 150.5])(
    'devolve null para valor inválido (%s)',
    totalCents => {
      expect(whatsappChargeUrl('(11) 98888-7777', 'Ana Paula', totalCents)).toBeNull();
    },
  );
});

describe('whatsappLink', () => {
  it('monta URL wa.me com número normalizado e o texto livre codificado', () => {
    expect(whatsappLink('(11) 98888-7777', 'Oi, Ana! Tudo bem?')).toBe(
      `https://wa.me/5511988887777?text=${encodeURIComponent('Oi, Ana! Tudo bem?')}`,
    );
  });

  it('devolve null para telefone inválido', () => {
    expect(whatsappLink('1234-567', 'Oi')).toBeNull();
  });

  it.each(['', '   '])('devolve null para texto vazio (%j)', text => {
    expect(whatsappLink('(11) 98888-7777', text)).toBeNull();
  });
});
