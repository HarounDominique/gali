import 'zone.js';
import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
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
  isCameraViewEnabled = false;
  @ViewChild('videoElement') videoElement!: ElementRef;

  private userPopup!: L.Popup;
  private targetPopup!: L.Popup;
  private distancePopup!: L.Popup;

  isMobile = false;

  private userIcon = L.icon({
    iconUrl: 'assets/icons/user.png',
    iconSize: [50, 50],
    iconAnchor: [25, 48],
    popupAnchor: [0, -32]
  });

  private targetIcon = L.icon({
    iconUrl: 'assets/icons/target.png',
    iconSize: [40, 40],
    iconAnchor: [20, 36],
    popupAnchor: [0, -32]
  });


  currentIcon = this.targetIcon;
  private userAltitude: number | null = null;
  private targetAltitude: number | null = null;
  private distanceToTarget: number | null = null;

  constructor(private elevationService: ElevationService) {}

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

      //this.getUserLocation();

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
      this.elevationService.getElevation(lat, lng).subscribe(
        elevation => {
          this.userAltitude = elevation; // Asignar la altitud del usuario
          console.log(`Altitud del usuario establecida: ${this.userAltitude} metros`);
          this.updateDistance(); // Asegurar que la distancia se actualiza después de obtener la altitud
        },
        error => {
          console.error('Error al obtener la altitud: ', error);
          console.log('No se pudo obtener la altitud del usuario debido a un problema de red. Por favor, inténtalo de nuevo más tarde.');
          this.userAltitude = null!;
        }
      );
    }

    this.map.setView([lat, lng], 13);
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
        this.targetAltitude = elevation; // Asignar la altitud del target
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
        delay: 800,
        dashArray: [10, 20],
        weight: 5,
        color: '#0022ff',
        pulseColor: '#FFFFFF'
      };

      this.distanceLine = antPath(latlngs, options).addTo(this.map);

      const distance = this.userLocation.distanceTo(this.targetLocation);
      this.distanceToTarget = Math.round(distance);
    }
  }

  // Función para habilitar/deshabilitar la cámara
  toggleCameraView(): void {
    this.isCameraViewEnabled = !this.isCameraViewEnabled;

    if (this.isCameraViewEnabled) {
      this.startCamera();
    } else {
      this.stopCamera();
    }
  }

  // Función para acceder a la cámara trasera
  startCamera(): void {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: "environment" } }
      })
        .then((stream) => {
          const video = this.videoElement.nativeElement;
          video.srcObject = stream;
          video.play();
        })
        .catch((error) => {
          console.error("Error al acceder a la cámara: ", error);
          alert('No se pudo acceder a la cámara.');
        });
    }
  }

  // Función para detener el stream de la cámara
  stopCamera(): void {
    const video = this.videoElement.nativeElement;
    const stream = video.srcObject as MediaStream;
    if (stream) {
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());  // Detener todas las pistas (cámara)
    }
    video.srcObject = null;
  }

}
