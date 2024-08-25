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
  private currentAlpha: number | null = 0; // Para almacenar la dirección actual de la brújula
  private videoStream: MediaStream | null = null;
  private currentCameraId: string | null = null; // ID de la cámara actual

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
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoElement = document.getElementById('camera') as HTMLVideoElement;
      if (videoElement) {
        this.videoStream = stream;
        videoElement.srcObject = stream;
        // Obtiene las cámaras disponibles y selecciona la cámara trasera por defecto
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');
        if (cameras.length > 0) {
          this.currentCameraId = cameras[0].deviceId; // Selecciona la primera cámara por defecto
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

  initializeCompass() {
    window.addEventListener('deviceorientation', (event) => {
      const alpha = event.alpha; // Dirección en grados

      if (alpha !== undefined) {
        this.currentAlpha = alpha;
        // @ts-ignore
        this.rotateMap(alpha);
      }
    });
  }

  private rotateMap(alpha: number) {
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      // Aplica la rotación CSS
      mapContainer.style.width = '100%';
      mapContainer.style.height = '100vh';
      mapContainer.style.transform = `rotate(${-alpha}deg)`;
      mapContainer.style.transformOrigin = 'center center';
      mapContainer.style.willChange = 'transform';

      // Forzar redibujado del mapa
      this.map.invalidateSize();
    }
  }


  captureOrientation() {
    if (this.currentAlpha !== null) {
      this.rotateMap(this.currentAlpha);
    } else {
      console.warn('No se ha detectado una orientación válida.');
    }
  }


  private setTargetLocationBasedOnCompass() {
    if (this.userLocation && this.targetLocation) {
      // Calcula la dirección desde la ubicación del usuario hacia el objetivo
      const targetAlpha = this.calculateBearing(this.userLocation, this.targetLocation);

      // Rota el mapa para que el objetivo quede en la parte superior
      this.rotateMap(targetAlpha);
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

    this.setTargetLocationBasedOnCompass();
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
