import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ElevationService {

  private apiUrl = 'https://api.open-elevation.com/api/v1/lookup';

  constructor(private http: HttpClient) { }

  // Método para obtener la altitud
  getElevation(lat: number, lng: number): Observable<number> {
    const url = `${this.apiUrl}?locations=${lat},${lng}`;
    return this.http.get<any>(url).pipe(
      map(response => response.results[0]?.elevation)
    );
  }
}

