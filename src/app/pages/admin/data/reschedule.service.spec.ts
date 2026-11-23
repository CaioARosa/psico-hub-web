import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { syncErrorMessage } from './calendar-sync-errors';
import { RescheduleService } from './reschedule.service';

const URL = 'http://localhost:3000/admin/sessions/a%2Fb%20c/reschedule';
const GENERIC = 'Falha ao reagendar. Tente novamente.';
const startsAt = new Date('2026-11-26T23:00:00.000Z');

describe('RescheduleService', () => {
  let service: RescheduleService;
  let http: HttpTestingController;
  let getIdToken: () => Promise<string>;

  beforeEach(() => {
    getIdToken = async () => 'token-123';
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { getIdToken: () => getIdToken() } },
      ],
    });
    service = TestBed.inject(RescheduleService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function expectPost() {
    return vi.waitFor(() => http.expectOne(URL));
  }

  it('envia POST com id codificado, corpo e Bearer token', async () => {
    const promise = service.reschedule('a/b c', startsAt, true);
    const req = await expectPost();
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ startsAt: '2026-11-26T23:00:00.000Z', force: true });
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-123');
    req.flush({ newSessionId: 'new-1', startsAt: '2026-11-26T23:00:00.000Z' });
    await promise;
  });

  it('force é false por padrão', async () => {
    const promise = service.reschedule('a/b c', startsAt);
    const req = await expectPost();
    expect(req.request.body.force).toBe(false);
    req.flush({ newSessionId: 'new-1', startsAt: '2026-11-26T23:00:00.000Z' });
    await promise;
  });

  it('200 -> ok com Date', async () => {
    const promise = service.reschedule('a/b c', startsAt);
    (await expectPost()).flush({ newSessionId: 'new-1', startsAt: '2026-11-26T23:00:00.000Z' });
    const result = await promise;
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.newSessionId).toBe('new-1');
    expect(result.startsAt).toBeInstanceOf(Date);
    expect(result.startsAt.toISOString()).toBe('2026-11-26T23:00:00.000Z');
  });

  it('200 com startsAt inválido ou ausente -> falha genérica', async () => {
    for (const body of [
      { newSessionId: 'new-1', startsAt: 'xyz' },
      { newSessionId: 'new-1' },
      null,
    ]) {
      const promise = service.reschedule('a/b c', startsAt);
      (await expectPost()).flush(body);
      await expect(promise).rejects.toThrow(GENERIC);
    }
  });

  it('409 com conflitos -> conflict com Dates, título padrão e itens inválidos descartados', async () => {
    const promise = service.reschedule('a/b c', startsAt);
    (await expectPost()).flush(
      {
        error: 'Já existe compromisso nesse horário.',
        conflicts: [
          {
            title: 'Consulta',
            startsAt: '2026-11-26T23:00:00.000Z',
            endsAt: '2026-11-27T00:00:00.000Z',
          },
          { startsAt: '2026-11-27T00:00:00.000Z', endsAt: '2026-11-27T01:00:00.000Z' },
          { title: 'Quebrado', startsAt: 'nope', endsAt: '2026-11-27T01:00:00.000Z' },
        ],
      },
      { status: 409, statusText: 'Conflict' },
    );
    const result = await promise;
    expect(result.kind).toBe('conflict');
    if (result.kind !== 'conflict') return;
    expect(result.conflicts).toHaveLength(2);
    expect(result.conflicts[0].title).toBe('Consulta');
    expect(result.conflicts[0].startsAt).toBeInstanceOf(Date);
    expect(result.conflicts[0].endsAt.toISOString()).toBe('2026-11-27T00:00:00.000Z');
    expect(result.conflicts[1].title).toBe('');
  });

  it('409 só com error -> rejeita com o texto do servidor', async () => {
    const promise = service.reschedule('a/b c', startsAt);
    (await expectPost()).flush(
      { error: 'A sessão já foi reagendada.' },
      { status: 409, statusText: 'Conflict' },
    );
    await expect(promise).rejects.toThrow('A sessão já foi reagendada.');
  });

  it('409 com conflitos todos inválidos -> caminho de erro', async () => {
    const promise = service.reschedule('a/b c', startsAt);
    (await expectPost()).flush(
      {
        error: 'Já existe compromisso nesse horário.',
        conflicts: [{ title: 'x', startsAt: 'nope' }],
      },
      { status: 409, statusText: 'Conflict' },
    );
    await expect(promise).rejects.toThrow('Já existe compromisso nesse horário.');
  });

  it('falha ao obter token -> sessão expirada, sem requisição', async () => {
    getIdToken = () => Promise.reject(new Error('sem usuário'));
    await expect(service.reschedule('a/b c', startsAt)).rejects.toThrow(syncErrorMessage(401));
    http.expectNone(URL);
  });

  it('erro de rede (status 0) -> falha genérica', async () => {
    const promise = service.reschedule('a/b c', startsAt);
    (await expectPost()).error(new ProgressEvent('error'), {
      status: 0,
      statusText: 'Unknown Error',
    });
    await expect(promise).rejects.toThrow(GENERIC);
  });
});
