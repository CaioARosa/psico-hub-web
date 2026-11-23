import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, isDevMode } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from './auth.service';
import { rescheduleErrorMessage } from './reschedule-errors';

export interface RescheduleConflict {
  title: string;
  startsAt: Date;
  endsAt: Date;
}

export type RescheduleResult =
  | { kind: 'ok'; newSessionId: string; startsAt: Date }
  | { kind: 'conflict'; conflicts: RescheduleConflict[] };

interface RescheduleResponse {
  newSessionId: string;
  startsAt: string;
}

interface ConflictBody {
  title?: string;
  startsAt: string;
  endsAt: string;
}

@Injectable({ providedIn: 'root' })
export class RescheduleService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly apiUrl = isDevMode() ? 'http://localhost:3000' : '/api';

  async reschedule(sessionId: string, startsAt: Date, force = false): Promise<RescheduleResult> {
    let token: string;
    try {
      token = await this.auth.getIdToken();
    } catch {
      throw new Error(rescheduleErrorMessage(401));
    }

    try {
      const result = await firstValueFrom(
        this.http.post<RescheduleResponse>(
          `${this.apiUrl}/admin/sessions/${encodeURIComponent(sessionId)}/reschedule`,
          { startsAt: startsAt.toISOString(), force },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
      return { kind: 'ok', newSessionId: result.newSessionId, startsAt: new Date(result.startsAt) };
    } catch (err) {
      if (!(err instanceof HttpErrorResponse)) throw new Error(rescheduleErrorMessage(0));
      const conflicts: unknown = err.error?.conflicts;
      if (err.status === 409 && Array.isArray(conflicts)) {
        return {
          kind: 'conflict',
          conflicts: (conflicts as ConflictBody[]).map((c) => ({
            title: c.title ?? '',
            startsAt: new Date(c.startsAt),
            endsAt: new Date(c.endsAt),
          })),
        };
      }
      throw new Error(rescheduleErrorMessage(err.status, err.error));
    }
  }
}
