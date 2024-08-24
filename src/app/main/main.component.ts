import { Component, OnInit } from '@angular/core';
import * as L from 'leaflet';
import { ElevationService } from '../service/elevation-service/elevation.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit {
  private map!: L.Map;
  private userMarker!: L.Marker;
  private targetMarker!: L.Marker;
  private userLocation: L.LatLng | null = null;
  private targetLocation: L.LatLng | null = null;
  private distanceLine!: L.Polyline;

  private userIcon = L.icon({
    iconUrl: 'assets/icons/user.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });

  private targetIcon = L.icon({
    iconUrl: 'assets/icons/target.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });

  constructor(private elevationService: ElevationService) {}

  ngOnInit(): void {
    this.initializeMap();
  }

  private initializeMap(): void {
    this.map = L.map('map').setView([51.505, -0.09], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    this.map.on('click', (event: L.LeafletMouseEvent) => {
      const lat = event.latlng.lat;
      const lng = event.latlng.lng;

      if (this.targetMarker) {
        this.targetMarker.setLatLng([lat, lng]);
      } else {
        this.targetMarker = L.marker([lat, lng], { icon: this.targetIcon })
          .addTo(this.map);
      }
      this.targetLocation = L.latLng(lat, lng);

      // Consulta la altitud del destino
      if (this.targetLocation) {
        this.elevationService.getElevation(lat, lng).subscribe(elevation => {
          this.targetMarker
            .bindPopup(`Altitud del destino: ${elevation} metros`)
            .openPopup(); // Esto no cierra los popups abiertos, sólo abre el nuevo
        });
      }

      this.updateDistance();
    });

    this.getUserLocation();
  }

  private getUserLocation(): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(position => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        this.userLocation = L.latLng(lat, lng);

        if (this.userMarker) {
          this.userMarker.setLatLng([lat, lng]);
        } else {
          this.userMarker = L.marker([lat, lng], { icon: this.userIcon })
            .addTo(this.map)
            .bindPopup('Estás aquí')
            .openPopup(); // Esto no cierra los popups abiertos, sólo abre el nuevo
        }

        // Consulta la altitud del usuario
        if (this.userLocation) {
          this.elevationService.getElevation(lat, lng).subscribe(elevation => {
            this.userMarker
              .bindPopup(`Altitud del usuario: ${elevation} metros`)
              .openPopup(); // Esto no cierra los popups abiertos, sólo abre el nuevo
          });
        }

        this.map.setView([lat, lng], 13);

        // Actualiza la distancia al cargar la ubicación del usuario
        this.updateDistance();
      }, error => {
        console.error("Error al obtener la ubicación: ", error);
      });
    } else {
      console.error("Geolocalización no soportada por el navegador.");
    }
  }

  private updateDistance(): void {
    if (this.userLocation && this.targetLocation) {
      // Elimina la línea anterior si existe
      if (this.distanceLine) {
        this.map.removeLayer(this.distanceLine);
      }

      // Crea una línea entre los dos puntos
      const latlngs = [this.userLocation, this.targetLocation];
      this.distanceLine = L.polyline(latlngs, { color: 'blue' }).addTo(this.map);

      // Calcula la distancia en metros
      const distance = this.userLocation.distanceTo(this.targetLocation);

      // Convierte la distancia a kilómetros si es mayor de 1 km
      const distanceText = distance > 1000
        ? `${(distance / 1000).toFixed(2)} km`
        : `${distance.toFixed(2)} m`;

      // Muestra la distancia en un popup en el medio de la línea
      const midPoint = L.latLng(
        (this.userLocation.lat + this.targetLocation.lat) / 2,
        (this.userLocation.lng + this.targetLocation.lng) / 2
      );

      // Crear un nuevo popup y añadirlo al mapa en la mitad de la línea
      L.popup()
        .setLatLng(midPoint)
        .setContent(`Distancia: ${distanceText}`)
        .openOn(this.map);
    }
  }
}
