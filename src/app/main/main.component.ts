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
  isMapVisible = false;
  private currentAlpha: number | null = 0;
  private videoStream: MediaStream | null = null;
  private currentCameraId: string | null = null;

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

  async requestCameraPermission() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      const rearCamera = cameras.find(camera => camera.label.toLowerCase().includes('back')) || cameras[0];

      if (rearCamera) {
        this.currentCameraId = rearCamera.deviceId;
        const constraints = {
          video: { deviceId: { exact: this.currentCameraId } }
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const videoElement = document.getElementById('camera') as HTMLVideoElement;
        if (videoElement) {
          this.videoStream = stream;
          videoElement.srcObject = stream;
          videoElement.style.display = 'block'; // Mostrar la cámara
        }
      }
    } catch (err) {
      console.error('Error al acceder a la cámara: ', err);
      alert('No se pudo acceder a la cámara. Por favor, habilita los permisos.');
    }
  }

  switchCamera() {
    if (this.videoStream) {
      const videoElement = document.getElementById('camera') as HTMLVideoElement;
      if (videoElement && this.currentCameraId) {
        navigator.mediaDevices.enumerateDevices().then(devices => {
          const cameras = devices.filter(device => device.kind === 'videoinput');
          const nextCamera = cameras.find(camera => camera.deviceId !== this.currentCameraId);
          if (nextCamera) {
            this.currentCameraId = nextCamera.deviceId;
            const constraints = {
              video: { deviceId: { exact: this.currentCameraId } }
            };
            // @ts-ignore
            this.videoStream.getTracks().forEach(track => track.stop()); // Detiene el stream actual
            navigator.mediaDevices.getUserMedia(constraints).then(stream => {
              this.videoStream = stream;
              videoElement.srcObject = stream;
            }).catch(err => {
              console.error('Error al cambiar la cámara: ', err);
              alert('No se pudo cambiar la cámara. Por favor, inténtalo de nuevo.');
            });
          }
        });
      }
    }
  }

  toggleCameraMapView(): void {
    this.isMapVisible = !this.isMapVisible;

    const mapContainer = document.getElementById('map');
    const videoElement = document.getElementById('camera') as HTMLVideoElement;

    if (this.isMapVisible) {
      if (mapContainer) mapContainer.style.display = 'block';  // Mostrar el mapa
      if (videoElement) videoElement.style.display = 'none';    // Ocultar la cámara
    } else {
      if (mapContainer) mapContainer.style.display = 'none';    // Ocultar el mapa
      if (videoElement) videoElement.style.display = 'block';   // Mostrar la cámara
    }
  }

  initializeCompass() {
    window.addEventListener('deviceorientation', (event) => {
      const alpha = event.alpha; // Dirección en grados

      if (alpha !== undefined) {
        this.currentAlpha = alpha;
      }
    });
  }

  captureOrientation() {
    if (this.currentAlpha !== null) {
      const videoElement = document.getElementById('camera') as HTMLVideoElement;
      if (videoElement) {
        videoElement.style.display = 'none'; // Ocultar la cámara
      }

      const mapContainer = document.getElementById('map');
      if (mapContainer) {
        mapContainer.style.display = 'block'; // Mostrar el mapa

        // Configura la ubicación del target basado en la altitud
        if (this.userLocation) {
          this.setTargetBasedOnElevation(this.currentAlpha);
        }
      }
    } else {
      console.warn('No se ha detectado una orientación válida.');
    }
  }

  private setTargetBasedOnElevation(bearingDegrees: number): void {
    if (!this.userLocation) return;

    const earthRadius = 6371000; // Radio de la Tierra en metros
    const bearingRadians = bearingDegrees * Math.PI / 180;

    const lat1 = this.userLocation.lat * Math.PI / 180;
    const lng1 = this.userLocation.lng * Math.PI / 180;

    const maxDistance = 10000; // Distancia máxima de búsqueda en metros (por ejemplo, 10 km)
    const stepDistance = 50; // Distancia en metros entre cada paso de verificación

    let found = false;
    let targetLat = lat1;
    let targetLng = lng1;

    for (let d = stepDistance; d <= maxDistance; d += stepDistance) {
      const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d / earthRadius) +
        Math.cos(lat1) * Math.sin(d / earthRadius) * Math.cos(bearingRadians));
      const lng2 = lng1 + Math.atan2(Math.sin(bearingRadians) * Math.sin(d / earthRadius) * Math.cos(lat1),
        Math.cos(d / earthRadius) - Math.sin(lat1) * Math.sin(lat2));

      targetLat = lat2 * 180 / Math.PI;
      targetLng = lng2 * 180 / Math.PI;

      this.elevationService.getElevation(targetLat, targetLng).subscribe(elevation => {
        const userElevation = this.userLocation?.alt || 0;
        const elevationDifference = Math.abs(elevation - userElevation);

        if (elevationDifference > 50) { // Si la diferencia de altitud es significativa (p. ej., 50 metros)
          this.setTargetLocation(targetLat, targetLng);
          found = true;
        }
      });

      if (found) break;
    }

    if (!found) {
      // Si no se encontró una diferencia de altitud significativa, establecer el objetivo a la distancia máxima
      this.setTargetLocation(targetLat, targetLng);
    }
  }

  private setTargetLocationBasedOnCompass() {
    if (this.userLocation && this.targetLocation) {
      // Calcula la dirección desde la ubicación del usuario hacia el objetivo
      const targetAlpha = this.calculateBearing(this.userLocation, this.targetLocation);
    }
  }

  private calculateBearing(start: L.LatLng, end: L.LatLng): number {
    const startLat = start.lat * Math.PI / 180;
    const startLng = start.lng * Math.PI / 180;
    const endLat = end.lat * Math.PI / 180;
    const endLng = end.lng * Math.PI / 180;

    const dLng = endLng - startLng;
    const y = Math.sin(dLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360; // Ajusta el ángulo para estar en el rango [0, 360)
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
    this.setTargetLocationBasedOnCompass();
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
          .setContent(`Altitud del objetivo: ${elevation} metros`)
          .addTo(this.map);
      });
    }

    this.drawAntPath();

    const distance = this.userLocation?.distanceTo(this.targetLocation);
    if (distance) {
      this.distancePopup = L.popup()
        .setLatLng(this.targetLocation!)
        .setContent(`Distancia al objetivo: ${distance.toFixed(2)} metros`)
        .addTo(this.map);
    }

    this.setTargetLocationBasedOnCompass();
  }

  private drawAntPath(): void {
    if (this.userLocation && this.targetLocation) {
      if (this.distanceLine) {
        this.map.removeLayer(this.distanceLine);
      }

      this.distanceLine = antPath([[this.userLocation.lat, this.userLocation.lng], [this.targetLocation.lat, this.targetLocation.lng]], {
        color: '#FF0000',
        weight: 5,
        opacity: 0.6,
        dashArray: [10, 20],
        pulseColor: '#FFFFFF'
      }).addTo(this.map);
    }
  }

  private getUserLocation(): void {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        this.setUserLocation(lat, lng);
      },
      (error) => {
        console.error('Error al obtener la ubicación del usuario: ', error);
      }
    );
  }
}
