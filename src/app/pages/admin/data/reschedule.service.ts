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

function toDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseConflicts(body: unknown): RescheduleConflict[] {
  const raw =
    typeof body === 'object' && body !== null
      ? (body as { conflicts?: unknown }).conflicts
      : undefined;
  if (!Array.isArray(raw)) return [];
  const conflicts: RescheduleConflict[] = [];
  for (const item of raw as { title?: unknown; startsAt?: unknown; endsAt?: unknown }[]) {
    const startsAt = toDate(item?.startsAt);
    const endsAt = toDate(item?.endsAt);
    if (!startsAt || !endsAt) continue;
    conflicts.push({ title: typeof item.title === 'string' ? item.title : '', startsAt, endsAt });
  }
  return conflicts;
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

    let result: { newSessionId?: unknown; startsAt?: unknown } | null;
    try {
      result = await firstValueFrom(
        this.http.post<{ newSessionId?: unknown; startsAt?: unknown } | null>(
          `${this.apiUrl}/admin/sessions/${encodeURIComponent(sessionId)}/reschedule`,
          { startsAt: startsAt.toISOString(), force },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
    } catch (err) {
      if (!(err instanceof HttpErrorResponse)) throw new Error(rescheduleErrorMessage(0));
      if (err.status === 409) {
        const conflicts = parseConflicts(err.error);
        if (conflicts.length > 0) return { kind: 'conflict', conflicts };
      }
      throw new Error(rescheduleErrorMessage(err.status, err.error));
    }

    const newStartsAt = toDate(result?.startsAt);
    const newSessionId = result?.newSessionId;
    if (!newStartsAt || typeof newSessionId !== 'string' || !newSessionId) {
      throw new Error(rescheduleErrorMessage(0));
    }
    return { kind: 'ok', newSessionId, startsAt: newStartsAt };
  }
}
