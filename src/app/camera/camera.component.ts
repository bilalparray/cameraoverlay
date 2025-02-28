import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  AfterViewInit,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';

// Assumes the CameraPreview plugin is installed and available globally.
declare var CameraPreview: any;

@Component({
  selector: 'app-camera-cropper',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Home / Start Screen -->
    <div *ngIf="currentPage === 'home'" class="page home-page">
      <h1>Welcome to Camera Cropper</h1>
      <button class="action-btn" (click)="goToCamera()">Start Camera</button>
    </div>

    <!-- Camera Preview Screen -->
    <div *ngIf="currentPage === 'camera'" class="page camera-page">
      <div class="container">
        <!-- Overlay box for cropping -->
        <div #draggableSquare class="draggable-square"></div>
        <button class="capture-btn" (click)="captureAndCrop()">Capture</button>
      </div>
    </div>

    <!-- Cropped Image Result Screen -->
    <div *ngIf="currentPage === 'result'" class="page result-page">
      <div class="cropped-image">
        <h3>Cropped Image:</h3>
        <img [src]="'data:image/png;base64,' + image" alt="Cropped Image" />
      </div>
      <button class="action-btn" (click)="restartCamera()">
        Restart Camera
      </button>
    </div>
  `,
  styles: [
    `
      /* Remove background color from pages */
      .page {
        position: relative;
        width: 100%;
        height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: transparent;
        color: #000;
      }
      h1 {
        text-align: center;
      }
      .action-btn {
        padding: 10px 20px;
        font-size: 18px;
        color: #fff;
        background: #0066cc;
        border: none;
        border-radius: 5px;
        cursor: pointer;
      }

      /* Full viewport container for camera preview */
      .container {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: transparent;
      }

      /* Overlay square defining the crop area */
      .draggable-square {
        position: absolute;
        border: 2px dashed red;
        width: 200px;
        height: 200px;
        top: calc(50% - 100px);
        left: calc(50% - 100px);
      }

      /* Capture button styling */
      .capture-btn {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 10px 20px;
        font-size: 18px;
        color: #fff;
        background: red;
        border: none;
        border-radius: 5px;
        cursor: pointer;
      }

      /* Cropped image display styling */
      .cropped-image {
        background: transparent;
        padding: 10px;
        border-radius: 10px;
        margin-bottom: 20px;
      }
      .cropped-image img {
        max-width: 100%;
        height: auto;
        border: 2px solid #000;
      }
    `,
  ],
})
export class CameraCropperComponent implements OnInit, AfterViewInit {
  @ViewChild('draggableSquare', { static: false })
  draggableSquare!: ElementRef<HTMLDivElement>;

  // Possible states: 'home', 'camera', 'result'
  currentPage: 'home' | 'camera' | 'result' = 'home';

  // Holds the cropped image (base64 string without the data URI prefix)
  image: string = '';

  constructor(private ngZone: NgZone) {}

  ngOnInit(): void {
    // Additional initialization if needed.
  }

  ngAfterViewInit(): void {
    // The camera preview starts only when "Start Camera" is clicked.
  }

  /**
   * Switch to the camera view and start the camera preview.
   */
  goToCamera(): void {
    this.currentPage = 'camera';
    CameraPreview.startCamera(
      {
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        camera: 'rear',
        toBack: true, // Renders the preview behind the webview.
      },
      () => console.log('Camera preview started'),
      (error: any) => console.error('Camera error:', error)
    );
  }

  /**
   * Captures an image, crops it based on the overlay square's position,
   * and shows the cropped result.
   */
  captureAndCrop(): void {
    console.log('captureAndCrop called');
    CameraPreview.takePicture(
      { width: window.innerWidth, height: window.innerHeight, quality: 85 },
      (base64: any) => {
        console.log('Picture taken');
        // Handle array response if necessary.
        if (Array.isArray(base64)) {
          console.log('Received base64 as an array; using first element.');
          base64 = base64[0];
        }
        if (!base64 || base64.length === 0) {
          console.error('Empty image data received:', base64);
          return;
        }
        console.log('Base64 length:', base64.length);

        // Create an image element to load the captured picture.
        const img = new Image();
        img.onload = () => {
          console.log('Image loaded for cropping');
          // Get the overlay square's position and dimensions.
          const squareRect =
            this.draggableSquare.nativeElement.getBoundingClientRect();
          console.log('Square rect:', squareRect);

          // Define crop parameters assuming captured image matches window dimensions.
          const cropX = squareRect.left;
          const cropY = squareRect.top;
          const cropWidth = squareRect.width;
          const cropHeight = squareRect.height;
          console.log('Crop parameters:', {
            cropX,
            cropY,
            cropWidth,
            cropHeight,
          });

          // Create an offscreen canvas to crop the image.
          const canvas = document.createElement('canvas');
          canvas.width = cropWidth;
          canvas.height = cropHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(
              img,
              cropX,
              cropY,
              cropWidth,
              cropHeight,
              0,
              0,
              cropWidth,
              cropHeight
            );
            const croppedDataUrl = canvas.toDataURL('image/png');

            // Use NgZone to ensure Angular detects the change.
            this.ngZone.run(() => {
              this.image = croppedDataUrl.split(',')[1];
              this.currentPage = 'result';
            });
            console.log('Cropped image generated');
            CameraPreview.stopCamera();
          } else {
            console.error('Canvas context not available');
          }
        };
        img.src = 'data:image/png;base64,' + base64;
        console.log('Image src set for cropping');
      }
    );
  }

  /**
   * Restarts the camera preview so the user can take another picture.
   */
  restartCamera(): void {
    this.image = '';
    this.currentPage = 'camera';
    CameraPreview.startCamera(
      {
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        camera: 'rear',
        toBack: true,
      },
      () => console.log('Camera preview restarted'),
      (error: any) => console.error('Camera error:', error)
    );
  }
}
