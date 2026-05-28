import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface BookingResponse {
  success: boolean;
  eventId?: string;
  booking?: any;
  mode: string;
}

export interface AvailabilityResponse {
  slots: string[];
  mode: string;
}

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api';

  getAvailability(date: string): Observable<AvailabilityResponse> {
    return this.http.get<AvailabilityResponse>(`${this.apiUrl}/availability?date=${date}`);
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
    return this.http.post<BookingResponse>(`${this.apiUrl}/book`, bookingData);
  }
}
