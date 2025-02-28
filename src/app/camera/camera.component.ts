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
    <div *ngIf="currentPage === 'home'" class="page">
      <h1>Welcome to Camera Cropper</h1>
      <button class="action-btn" (click)="goToCamera()">Start Camera</button>
    </div>

    <!-- Camera Preview Screen -->
    <div *ngIf="currentPage === 'camera'" class="page">
      <div class="container">
        <!-- Overlay box for cropping -->
        <div #draggableSquare class="draggable-square"></div>
        <button class="capture-btn" (click)="captureAndCrop()">Capture</button>
      </div>
    </div>

    <!-- Cropped Image Result Screen -->
    <div *ngIf="currentPage === 'result'" class="page">
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
      .action-btn,
      .capture-btn {
        padding: 10px 20px;
        font-size: 18px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
      }
      .action-btn {
        color: #fff;
        background: #0066cc;
      }
      .capture-btn {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        color: #fff;
        background: red;
      }
      .container {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: transparent;
      }
      /* The draggable square overlay for cropping */
      .draggable-square {
        position: absolute;
        border: 2px dashed #fff;
        width: 200px;
        height: 200px;
        top: calc(50% - 100px);
        left: calc(50% - 100px);
      }
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

  // Manage the current view: 'home', 'camera', or 'result'
  currentPage: 'home' | 'camera' | 'result' = 'home';

  // Holds the cropped image (base64 string without the data URI prefix)
  image: string = '';

  constructor(private ngZone: NgZone) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    // The camera preview is started only when the user clicks "Start Camera".
  }

  /**
   * Switch to the camera view and start the preview.
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
        toBack: true, // Render preview behind the webview.
      },
      () => console.log('Camera preview started'),
      (error: any) => console.error('Camera error:', error)
    );
  }

  /**
   * Captures an image and then crops it based on the overlay box's dimensions.
   */
  captureAndCrop(): void {
    CameraPreview.takePicture(
      { width: window.innerWidth, height: window.innerHeight, quality: 85 },
      (base64: any) => {
        if (Array.isArray(base64)) {
          base64 = base64[0];
        }
        if (!base64 || base64.length === 0) {
          console.error('Empty image data received:', base64);
          return;
        }

        // Create an image element to load the captured picture.
        const img = new Image();
        img.onload = () => {
          // Get the overlay square's bounding rectangle (coordinates relative to the viewport).
          const squareRect =
            this.draggableSquare.nativeElement.getBoundingClientRect();

          // These coordinates are used directly if the captured image matches the window dimensions.
          const cropX = squareRect.left;
          const cropY = squareRect.top;
          const cropWidth = squareRect.width;
          const cropHeight = squareRect.height;

          // Create an offscreen canvas to draw the cropped portion.
          const canvas = document.createElement('canvas');
          canvas.width = cropWidth;
          canvas.height = cropHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Crop the image using the overlay box coordinates.
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

            // Ensure Angular updates the view.
            this.ngZone.run(() => {
              this.image = croppedDataUrl.split(',')[1];
              this.currentPage = 'result';
            });
            CameraPreview.stopCamera();
          } else {
            console.error('Canvas context not available');
          }
        };
        img.src = 'data:image/png;base64,' + base64;
      }
    );
  }

  /**
   * Restarts the camera preview so the user can capture another image.
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
