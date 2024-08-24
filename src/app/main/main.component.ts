import 'zone.js';
import {Component, OnInit} from '@angular/core';
import * as L from 'leaflet';
import {ElevationService} from '../service/elevation-service/elevation.service';

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
  protected selectingUserPosition = false;

  private userPopup!: L.Popup;
  private targetPopup!: L.Popup;
  private distancePopup!: L.Popup;

  isMobile = false;

  private userIcon = L.icon({
    iconUrl: 'assets/icons/user.png',
    iconSize: [50, 50],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });

  private targetIcon = L.icon({
    iconUrl: 'assets/icons/target.png',
    iconSize: [40, 40],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });

  currentIcon = this.targetIcon;

  constructor(private elevationService: ElevationService) {
  }

  ngOnInit(): void {
    this.initializeMap();
    this.isMobile = this.detectMobile();
  }

  detectMobile(): boolean {
    const userAgent = navigator.userAgent || navigator.vendor;
    const isOpera = typeof window !== 'undefined' && 'opera' in window;

    return /android|iPad|iPhone|iPod|windows phone|blackberry|BB10|PlayBook/i.test(userAgent) || isOpera;
  }

  toggleSelection(): void {
    this.selectingUserPosition = !this.selectingUserPosition;
    this.currentIcon = this.selectingUserPosition ? this.userIcon : this.targetIcon;
  }

  private initializeMap(): void {
    this.map = L.map('map').setView([51.505, -0.09], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    this.map.on('click', (event: L.LeafletMouseEvent) => {
      const lat = event.latlng.lat;
      const lng = event.latlng.lng;

      if (this.selectingUserPosition) {
        this.setUserLocation(lat, lng);
      } else {
        this.setTargetLocation(lat, lng);
      }
    });

    this.getUserLocation();
  }

  private setUserLocation(lat: number, lng: number): void {
    this.userLocation = L.latLng(lat, lng);

    if (this.userMarker) {
      this.userMarker.setLatLng([lat, lng]);
    } else {
      this.userMarker = L.marker([lat, lng], {icon: this.userIcon}).addTo(this.map);
    }

    if (this.userLocation) {
      this.elevationService.getElevation(lat, lng).subscribe(elevation => {
        if (this.userPopup) {
          this.userPopup.remove();
        }

        this.userPopup = L.popup()
          .setLatLng(this.userLocation!)
          .setContent(`Altitud del usuario: ${elevation} metros`)
          .addTo(this.map);
      });
    }

    this.map.setView([lat, lng], 13);
    this.updateDistance();
  }

  private setTargetLocation(lat: number, lng: number): void {
    this.targetLocation = L.latLng(lat, lng);

    if (this.targetMarker) {
      this.targetMarker.setLatLng([lat, lng]);
    } else {
      this.targetMarker = L.marker([lat, lng], {icon: this.targetIcon}).addTo(this.map);
    }

    if (this.targetLocation) {
      this.elevationService.getElevation(lat, lng).subscribe(elevation => {
        if (this.targetPopup) {
          this.targetPopup.remove();
        }

        this.targetPopup = L.popup()
          .setLatLng(this.targetLocation!)
          .setContent(`Altitud del destino: ${elevation} metros`)
          .addTo(this.map);
      });
    }

    this.updateDistance();
  }

  private getUserLocation(): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(position => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        this.setUserLocation(lat, lng);
      }, error => {
        console.error("Error al obtener la ubicación: ", error);
        // Muestra un mensaje al usuario si hay un error al obtener la ubicación
        alert("No se pudo obtener tu ubicación. Por favor, habilita los permisos de ubicación en tu navegador.");
      }, {
        enableHighAccuracy: true, // Activa la mayor precisión posible
        timeout: 10000, // Tiempo máximo para obtener la ubicación
        maximumAge: 0 // No usar caché
      });
    } else {
      console.error("Geolocalización no soportada por el navegador.");
      alert("Tu navegador no soporta la geolocalización.");
    }
  }

  private updateDistance(): void {
    if (this.userLocation && this.targetLocation) {
      if (this.distanceLine) {
        this.map.removeLayer(this.distanceLine);
      }

      const latlngs = [this.userLocation, this.targetLocation];
      this.distanceLine = L.polyline(latlngs, {color: 'blue'}).addTo(this.map);

      const distance = this.userLocation.distanceTo(this.targetLocation);
      const distanceText = distance > 1000
        ? `${(distance / 1000).toFixed(2)} km`
        : `${distance.toFixed(2)} m`;

      const midPoint = L.latLng(
        (this.userLocation.lat + this.targetLocation.lat) / 2,
        (this.userLocation.lng + this.targetLocation.lng) / 2
      );

      if (this.distancePopup) {
        this.distancePopup.remove();
      }

      this.distancePopup = L.popup()
        .setLatLng(midPoint)
        .setContent(`Distancia: ${distanceText}`)
        .addTo(this.map);

      //Se refresca el popup que muestra la altitud del user:
      this.elevationService.getElevation(this.userLocation.lat, this.userLocation.lng).subscribe(elevation => {
        if (this.userPopup) {
          this.userPopup.remove();
        }

        this.userPopup = L.popup()
          .setLatLng(this.userLocation!)
          .setContent(`Altitud del usuario: ${elevation} metros`)
          .addTo(this.map);
      });

      //Se refresca el popup que muestra la altitud del destino:
      this.elevationService.getElevation(this.targetLocation.lat, this.targetLocation.lng).subscribe(elevation => {
        if (this.targetPopup) {
          this.targetPopup.remove();
        }

        this.targetPopup = L.popup()
          .setLatLng(this.targetLocation!)
          .setContent(`Altitud del destino: ${elevation} metros`)
          .addTo(this.map);
      });


    }
  }
}
