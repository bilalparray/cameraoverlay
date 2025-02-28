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

interface Position {
  left: number;
  top: number;
}

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
        <!-- Draggable overlay box for cropping -->
        <div
          #draggableSquare
          class="draggable-square"
          (mousedown)="startDrag($event)"
          (touchstart)="startDrag($event)"
          [ngStyle]="{
            'left.px': squarePos.left,
            'top.px': squarePos.top,
            'width.px': boxSize,
            'height.px': boxSize
          }"
        ></div>
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
      .draggable-square {
        position: absolute;
        border: 2px dashed red;
        touch-action: none;
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

  // Box settings
  boxSize = 200; // 200x200 pixels
  squarePos: Position = { left: 0, top: 0 };

  // Dragging state
  dragging = false;
  dragStartX = 0;
  dragStartY = 0;
  initialSquareLeft = 0;
  initialSquareTop = 0;

  constructor(private ngZone: NgZone) {}

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      // Set the initial position of the draggable square to the center of the viewport.
      this.squarePos = {
        left: window.innerWidth / 2 - this.boxSize / 2,
        top: window.innerHeight / 2 - this.boxSize / 2,
      };
    } else {
      // Provide default values for non-browser contexts.
      this.squarePos = { left: 100, top: 100 };
    }
  }

  ngAfterViewInit(): void {
    // No window reference here, so safe.
  }

  goToCamera(): void {
    this.currentPage = 'camera';
    if (typeof window !== 'undefined') {
      CameraPreview.startCamera(
        {
          x: 0,
          y: 0,
          width: window.innerWidth,
          height: window.innerHeight,
          camera: 'rear',
          toBack: true,
        },
        () => console.log('Camera preview started'),
        (error: any) => console.error('Camera error:', error)
      );
    }
  }

  startDrag(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    this.dragging = true;
    const evt = event instanceof TouchEvent ? event.touches[0] : event;
    this.dragStartX = evt.pageX;
    this.dragStartY = evt.pageY;
    this.initialSquareLeft = this.squarePos.left;
    this.initialSquareTop = this.squarePos.top;

    document.addEventListener('mousemove', this.onDrag);
    document.addEventListener('touchmove', this.onDrag, { passive: false });
    document.addEventListener('mouseup', this.stopDrag);
    document.addEventListener('touchend', this.stopDrag);
  }

  onDrag = (event: MouseEvent | TouchEvent): void => {
    if (!this.dragging) return;
    event.preventDefault();
    const evt = event instanceof TouchEvent ? event.touches[0] : event;
    const deltaX = evt.pageX - this.dragStartX;
    const deltaY = evt.pageY - this.dragStartY;
    this.squarePos = {
      left: this.initialSquareLeft + deltaX,
      top: this.initialSquareTop + deltaY,
    };
  };

  stopDrag = (): void => {
    this.dragging = false;
    document.removeEventListener('mousemove', this.onDrag);
    document.removeEventListener('touchmove', this.onDrag);
    document.removeEventListener('mouseup', this.stopDrag);
    document.removeEventListener('touchend', this.stopDrag);
  };

  captureAndCrop(): void {
    if (typeof window === 'undefined') return;
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
        const img = new Image();
        img.onload = () => {
          console.log('Captured image dimensions:', img.width, img.height);
          const previewWidth = window.innerWidth;
          const previewHeight = window.innerHeight;
          console.log('Preview dimensions:', previewWidth, previewHeight);
          const scaleX = img.width / previewWidth;
          const scaleY = img.height / previewHeight;
          console.log('Scale factors:', scaleX, scaleY);

          const squareRect =
            this.draggableSquare.nativeElement.getBoundingClientRect();
          console.log('Overlay square rect:', squareRect);
          const cropX = squareRect.left * scaleX;
          const cropY = squareRect.top * scaleY;
          const cropWidth = squareRect.width * scaleX;
          const cropHeight = squareRect.height * scaleY;
          console.log('Crop parameters:', {
            cropX,
            cropY,
            cropWidth,
            cropHeight,
          });

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
            console.log('Cropped Data URL:', croppedDataUrl);
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

  restartCamera(): void {
    this.image = '';
    this.currentPage = 'camera';
    if (typeof window !== 'undefined') {
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
}
