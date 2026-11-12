import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, isDevMode } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from './auth.service';
import { syncErrorMessage } from './calendar-sync-errors';

export interface SyncResult {
  created: number;
  updated: number;
  unidentified: number;
  missing: number;
}

@Injectable({ providedIn: 'root' })
export class CalendarSyncService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly apiUrl = isDevMode() ? 'http://localhost:3000' : '/api';

  async sync(month: string): Promise<SyncResult> {
    let token: string;
    try {
      token = await this.auth.getIdToken();
    } catch {
      throw new Error(syncErrorMessage(401));
    }

    try {
      const result = await firstValueFrom(
        this.http.post<Partial<SyncResult>>(
          `${this.apiUrl}/admin/sync-calendar`,
          { month },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
      return {
        created: result.created ?? 0,
        updated: result.updated ?? 0,
        unidentified: result.unidentified ?? 0,
        missing: result.missing ?? 0,
      };
    } catch (err) {
      throw new Error(syncErrorMessage(err instanceof HttpErrorResponse ? err.status : 0));
    }
  }
}
