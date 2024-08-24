import { Component, OnInit } from '@angular/core';
import * as L from 'leaflet';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit {
  private map!: L.Map;
  // @ts-ignore
  private userMarker!: L.Marker | null = null;

  ngOnInit(): void {
    this.initializeMap();
    this.getUserLocation();
  }

  private initializeMap(): void {
    this.map = L.map('map').setView([51.505, -0.09], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    // Forzar la actualización del mapa
    setTimeout(() => {
      this.map.invalidateSize();
    }, 0);

    // Agregar un listener para el clic en el mapa
    this.map.on('click', (event: L.LeafletMouseEvent) => {
      const lat = event.latlng.lat;
      const lng = event.latlng.lng;

      // Mueve el mapa a la ubicación clickeada
      this.map.setView([lat, lng], 13);

      // Actualiza el marcador del usuario o crea uno nuevo
      if (this.userMarker) {
        this.userMarker.setLatLng([lat, lng]);
        this.userMarker.bindPopup('Ubicación actualizada').openPopup();
      } else {
        this.userMarker = L.marker([lat, lng]).addTo(this.map)
          .bindPopup('Ubicación actualizada')
          .openPopup();
      }
    });
  }

  private getUserLocation(): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          // Mueve el mapa a la ubicación del usuario
          this.map.setView([lat, lng], 13);

          // Añade un marcador en la ubicación del usuario si aún no existe
          if (!this.userMarker) {
            this.userMarker = L.marker([lat, lng]).addTo(this.map)
              .bindPopup('Estás aquí')
              .openPopup();
          } else {
            this.userMarker.setLatLng([lat, lng]);
            this.userMarker.bindPopup('Estás aquí').openPopup();
          }
        },
        (error) => {
          console.error("Error al obtener la ubicación: ", error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        });
    } else {
      console.error("Geolocalización no soportada por el navegador.");
    }
  }
}
