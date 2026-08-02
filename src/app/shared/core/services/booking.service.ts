import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface BookingResponse {
  success: boolean;
  eventId?: string;
  booking?: any;
  mode: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface AvailabilityResponse {
  slots: TimeSlot[];
  mode: string;
}

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api';

  getAvailability(date: string): Observable<AvailabilityResponse> {
    return this.http.get<AvailabilityResponse>(`${this.apiUrl}/availability?date=${date}`).pipe(
      catchError((err) => {
        console.warn('Backend API unavailable. Falling back to local default slots.', err);
        const dayStart = new Date(`${date}T00:00:00-03:00`);
        const dayOfWeek = dayStart.getDay();
        let slots: string[] = [];

        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          slots = ['19:00', '20:00', '21:00'];
        } else if (dayOfWeek === 6) {
          slots = ['08:00', '09:00', '10:00', '11:00'];
        }

        const localSlots: TimeSlot[] = slots.map(time => ({ time, available: true }));
        return of({ slots: localSlots, mode: 'fallback' });
      })
    );
  }

  bookAppointment(bookingData: {
    service: string;
    date: string;
    time: string;
    name: string;
    email?: string;
    phone: string;
    message?: string;
  }): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(`${this.apiUrl}/book`, bookingData).pipe(
      catchError((err) => {
        console.warn('Backend API unavailable. Proceeding with fallback local booking mode.', err);
        return of({
          success: true,
          mode: 'fallback'
        });
      })
    );
  }
}

