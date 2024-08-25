import 'zone.js';
import { Component, OnInit } from '@angular/core';
import * as L from 'leaflet';
import { ElevationService } from '../service/elevation-service/elevation.service';
// @ts-ignore
import { AntPath, antPath } from 'leaflet-ant-path';

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
  private distanceLine: L.Polyline | null = null;
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

  constructor(private elevationService: ElevationService) {}

  ngOnInit(): void {
    this.initializeMap();
    this.isMobile = this.detectMobile();
    this.requestCameraPermission();
    this.initializeCompass();
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
      this.userMarker = L.marker([lat, lng], { icon: this.userIcon }).addTo(this.map);
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
      this.targetMarker = L.marker([lat, lng], { icon: this.targetIcon }).addTo(this.map);
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
      navigator.geolocation.getCurrentPosition(
        position => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          this.setUserLocation(lat, lng);
        },
        error => {
          console.error('Error al obtener la ubicación: ', error);
          alert('No se pudo obtener tu ubicación. Por favor, habilita los permisos de ubicación en tu navegador.');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      console.error('Geolocalización no soportada por el navegador.');
      alert('Tu navegador no soporta la geolocalización.');
    }
  }

  private updateDistance(): void {
    if (this.userLocation && this.targetLocation) {
      if (this.distanceLine) {
        this.map.removeLayer(this.distanceLine);
      }

      const latlngs = [this.userLocation, this.targetLocation];
      const options = {
        use: L.polyline,
        delay: 400,
        dashArray: [10, 20],
        weight: 5,
        color: '#0000FF',
        pulseColor: '#FFFFFF'
      };

      this.distanceLine = antPath(latlngs, options).addTo(this.map);

      const distance = this.userLocation.distanceTo(this.targetLocation);
      const distanceText =
        distance > 1000 ? `${(distance / 1000).toFixed(2)} km` : `${distance.toFixed(2)} m`;

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

      // Refrescar el popup que muestra la altitud del usuario
      this.elevationService.getElevation(this.userLocation.lat, this.userLocation.lng).subscribe(elevation => {
        if (this.userPopup) {
          this.userPopup.remove();
        }

        this.userPopup = L.popup()
          .setLatLng(this.userLocation!)
          .setContent(`Altitud del usuario: ${elevation} metros`)
          .addTo(this.map);
      });

      // Refrescar el popup que muestra la altitud del destino
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

  async requestCameraPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Puedes usar el stream para mostrar la cámara en un elemento <video>
      const videoElement = document.querySelector('video');
      if (videoElement) {
        videoElement.srcObject = stream;
      }
    } catch (err) {
      console.error('Error al acceder a la cámara: ', err);
      alert('No se pudo acceder a la cámara. Por favor, habilita los permisos.');
    }
  }

  initializeCompass() {
    window.addEventListener('deviceorientation', (event) => {
      const alpha = event.alpha; // Grados de rotación alrededor del eje Z
      const beta = event.beta;   // Grados de inclinación hacia adelante/atrás
      const gamma = event.gamma; // Grados de inclinación hacia izquierda/derecha

      // Usa alpha para determinar la dirección en la que está apuntando el dispositivo
      console.log('Rotación Z (dirección): ', alpha);
      console.log('Inclinación adelante/atrás: ', beta);
      console.log('Inclinación izquierda/derecha: ', gamma);

      // Ajusta el target en función de la dirección en la que apunta el dispositivo
      if (alpha !== undefined && this.userLocation) {
        this.setTargetLocationBasedOnCompass(alpha);
        // @ts-ignore
        this.rotateMap(alpha);
      }
    });
  }

  rotateMap(alpha: number) {
    // Ajusta la transformación CSS del contenedor del mapa
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      mapContainer.style.transform = `rotate(${-alpha}deg)`;
      mapContainer.style.transformOrigin = 'center center'; // Mantener el centro del mapa como punto de rotación
    }
  }

  setTargetLocationBasedOnCompass(alpha: number | null) {
    if (this.userLocation) {
      const distance = 1000; // Distancia fija (por ejemplo, 1 km)
      // @ts-ignore
      const alphaRadians = alpha * Math.PI / 180; // Convertir alpha a radianes

      // Aproximaciones para cálculos de latitud y longitud
      const metersPerDegreeLatitude = 111320; // Aproximadamente el número de metros por grado de latitud
      const earthCircumference = 40075000; // Circunferencia de la Tierra en metros

      // Calcular la latitud y longitud del destino
      const targetLat = this.userLocation.lat + (distance * Math.cos(alphaRadians)) / metersPerDegreeLatitude;
      const targetLng = this.userLocation.lng + (distance * Math.sin(alphaRadians)) / (earthCircumference * Math.cos(this.userLocation.lat * Math.PI / 180) / 360);

      // Llama a la función para establecer la ubicación del objetivo
      this.setTargetLocation(targetLat, targetLng);
    }
  }


}
