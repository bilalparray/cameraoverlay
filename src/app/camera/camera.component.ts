import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  AfterViewInit,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CameraPreview,
  CameraPreviewOptions,
} from '@capacitor-community/camera-preview';

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
      <!-- Native preview container (attached by the plugin) -->
      <div class="preview-container" id="cameraPreview"></div>
      <!-- Overlay container placed above the preview -->
      <div class="overlay">
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
        >
          <div
            class="resize-handle"
            (mousedown)="startResize($event)"
            (touchstart)="startResize($event)"
          ></div>
        </div>
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
      /* Make sure overall backgrounds are transparent */
      :host,
      html,
      body {
        background: transparent !important;
      }
      .page {
        position: relative;
        height: 100vh;
        width: 100%;
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
        border: none;
        border-radius: 5px;
        cursor: pointer;
        z-index: 1100;
        color: #fff;
        background: #0066cc;
      }
      /* The native preview container – empty div where the preview is attached */
      .preview-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        z-index: 1;
      }
      /* Overlay container on top of the preview */
      .overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1000;
        pointer-events: auto;
      }
      .capture-btn {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 10px 20px;
        font-size: 18px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        color: #fff;
        background: red;
        z-index: 1100;
      }
      .draggable-square {
        position: absolute;
        border: 2px dashed #fff;
        touch-action: none;
        z-index: 1100;
      }
      .resize-handle {
        position: absolute;
        width: 20px;
        height: 20px;
        background: rgba(255, 255, 255, 0.7);
        border: 2px solid #000;
        bottom: 0;
        right: 0;
        cursor: se-resize;
        touch-action: none;
      }
      .cropped-image {
        background: transparent;
        padding: 10px;
        border-radius: 10px;
        margin-bottom: 20px;
        z-index: 1100;
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

  // Views: 'home', 'camera', 'result'
  currentPage: 'home' | 'camera' | 'result' = 'home';

  // Cropped image data (base64 without prefix)
  image: string = '';

  // Overlay box settings
  boxSize = 200; // initial 200x200 pixels
  squarePos: Position = { left: 0, top: 0 };

  // Drag state
  dragging = false;
  dragStartX = 0;
  dragStartY = 0;
  initialSquareLeft = 0;
  initialSquareTop = 0;

  // Resize state
  isResizing = false;
  initialResizeX = 0;
  initialResizeY = 0;
  initialBoxSize = 200;

  constructor(private ngZone: NgZone) {}

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.squarePos = {
        left: window.innerWidth / 2 - this.boxSize / 2,
        top: window.innerHeight / 2 - this.boxSize / 2,
      };
    } else {
      this.squarePos = { left: 100, top: 100 };
    }
  }

  ngAfterViewInit(): void {}

  goToCamera(): void {
    this.currentPage = 'camera';
    if (typeof window !== 'undefined') {
      // Use window-safe options
      const cameraPreviewOptions: CameraPreviewOptions = {
        position: 'rear',
        width: window.innerWidth,
        height: window.innerHeight,
        parent: 'cameraPreview',
        className: 'cameraPreview',
        toBack: true,
      };
      CameraPreview.start(cameraPreviewOptions)
        .then(() => console.log('Camera preview started'))
        .catch((error) => console.error('Camera error:', error));
    }
  }

  // DRAGGING METHODS
  startDrag(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    if ((event.target as HTMLElement).classList.contains('resize-handle')) {
      return;
    }
    this.dragging = true;
    const evt = event instanceof TouchEvent ? event.touches[0] : event;
    this.dragStartX = evt.clientX;
    this.dragStartY = evt.clientY;
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
    const deltaX = evt.clientX - this.dragStartX;
    const deltaY = evt.clientY - this.dragStartY;
    this.ngZone.run(() => {
      this.squarePos = {
        left: this.initialSquareLeft + deltaX,
        top: this.initialSquareTop + deltaY,
      };
    });
  };

  stopDrag = (): void => {
    this.dragging = false;
    document.removeEventListener('mousemove', this.onDrag);
    document.removeEventListener('touchmove', this.onDrag);
    document.removeEventListener('mouseup', this.stopDrag);
    document.removeEventListener('touchend', this.stopDrag);
  };

  // RESIZING METHODS
  startResize(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isResizing = true;
    const evt = event instanceof TouchEvent ? event.touches[0] : event;
    this.initialResizeX = evt.clientX;
    this.initialResizeY = evt.clientY;
    this.initialBoxSize = this.boxSize;

    document.addEventListener('mousemove', this.onResize);
    document.addEventListener('touchmove', this.onResize, { passive: false });
    document.addEventListener('mouseup', this.stopResize);
    document.addEventListener('touchend', this.stopResize);
  }

  onResize = (event: MouseEvent | TouchEvent): void => {
    if (!this.isResizing) return;
    event.preventDefault();
    const evt = event instanceof TouchEvent ? event.touches[0] : event;
    const deltaX = evt.clientX - this.initialResizeX;
    const deltaY = evt.clientY - this.initialResizeY;
    const delta = (deltaX + deltaY) / 2;
    const newSize = Math.max(50, this.initialBoxSize + delta);
    this.ngZone.run(() => {
      this.boxSize = newSize;
    });
  };

  stopResize = (): void => {
    this.isResizing = false;
    document.removeEventListener('mousemove', this.onResize);
    document.removeEventListener('touchmove', this.onResize);
    document.removeEventListener('mouseup', this.stopResize);
    document.removeEventListener('touchend', this.stopResize);
  };

  // CAPTURE & CROP
  captureAndCrop(): void {
    if (typeof window === 'undefined') return;
    CameraPreview.capture({ quality: 85 })
      .then((result: any) => {
        const base64 = result.value; // For this plugin, the base64 is in result.value
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
              this.image = croppedDataUrl.split(',')[1]; // Remove data URI prefix
              this.currentPage = 'result';
            });
            CameraPreview.stop()
              .then(() => console.log('Camera preview stopped'))
              .catch((error: any) =>
                console.error('Error stopping camera:', error)
              );
          } else {
            console.error('Canvas context not available');
          }
        };
        img.src = 'data:image/png;base64,' + base64;
      })
      .catch((error: any) => {
        console.error('Capture error:', error);
      });
  }

  restartCamera(): void {
    this.image = '';
    this.currentPage = 'camera';
    if (typeof window !== 'undefined') {
      const cameraPreviewOptions: CameraPreviewOptions = {
        position: 'rear',
        width: window.innerWidth,
        height: window.innerHeight,
        parent: 'cameraPreview',
        className: 'cameraPreview',
        toBack: true,
      };
      CameraPreview.start(cameraPreviewOptions)
        .then(() => console.log('Camera preview restarted'))
        .catch((error) => console.error('Camera error:', error));
    }
  }
}
