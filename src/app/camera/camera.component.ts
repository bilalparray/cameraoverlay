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
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

interface Position {
  left: number;
  top: number;
}

// Define camera preview options (for camera mode).
const cameraPreviewOptions: CameraPreviewOptions =
  typeof window !== 'undefined'
    ? {
        position: 'rear',
        width: window.innerWidth,
        height: window.innerHeight,
        parent: 'cameraPreview',
        className: 'cameraPreview',
        toBack: true,
      }
    : {};

@Component({
  selector: 'app-camera-cropper',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Home / Start Screen -->
    <div *ngIf="currentPage === 'home'" class="page">
      <h1>Welcome to Camera Cropper</h1>
      <button class="action-btn" (click)="goToCamera()">Start Camera</button>
      <button class="action-btn" (click)="chooseFromGallery()">
        Select from Gallery
      </button>
    </div>

    <!-- Camera/Gallery Preview Screen -->
    <div *ngIf="currentPage === 'camera'" class="page">
      <!-- Container for native preview or gallery image -->
      <div class="container" id="cameraPreview">
        <!-- When in gallery mode, show the selected image -->
        <img
          *ngIf="sourceMode === 'gallery'"
          [src]="'data:image/png;base64,' + galleryImage"
          class="gallery-preview"
          alt="Selected Image"
        />
      </div>
      <!-- Overlay UI for cropping -->
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
        <button class="capture-btn" (click)="captureAndCrop()">
          {{ sourceMode === 'gallery' ? 'Crop' : 'Capture' }}
        </button>
      </div>
    </div>

    <!-- Cropped Image Result Screen -->
    <div *ngIf="currentPage === 'result'" class="page">
      <div class="cropped-image">
        <h3>Cropped Image:</h3>
        <img [src]="'data:image/png;base64,' + image" alt="Cropped Image" />
      </div>
      <button class="action-btn" (click)="restartCamera()">Restart</button>
    </div>
  `,
  styles: [
    `
      :host,
      html,
      body {
        background: transparent;
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
        margin-bottom: 20px;
      }
      .action-btn {
        padding: 10px 20px;
        margin: 5px;
        font-size: 18px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        z-index: 1100;
        color: #fff;
        background: #0066cc;
      }
      /* Container for preview; when in camera mode, the native preview attaches here */
      .container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        z-index: 1;
      }
      /* When in gallery mode, show the selected image */
      .gallery-preview {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      /* Overlay container for draggable square and button */
      .overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1100;
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
        height: 5px;

        background: rgba(197, 35, 35, 0.7);
        border: none;
        border-radius: 10px;
        bottom: 0;
        right: 50%;
        transform: translateX(50%);
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

  // Cropped image (base64 without prefix)
  image: string = '';

  // Mode: 'camera' or 'gallery'
  sourceMode: 'camera' | 'gallery' = 'camera';

  // Gallery image base64 string (without prefix)
  galleryImage: string = '';

  // Overlay box settings
  boxSize = 200;
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

  // HOME SCREEN METHODS

  goToCamera(): void {
    this.sourceMode = 'camera';
    this.currentPage = 'camera';
    if (typeof window !== 'undefined') {
      CameraPreview.start(cameraPreviewOptions)
        .then(() => console.log('Camera preview started'))
        .catch((error) => console.error('Camera error:', error));
    }
  }

  async chooseFromGallery(): Promise<void> {
    try {
      const image = await Camera.getPhoto({
        quality: 85,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
      });
      // image.base64String contains the base64 without prefix
      this.galleryImage = image.base64String || '';
      this.sourceMode = 'gallery';
      this.currentPage = 'camera';
      console.log('Gallery image selected');
    } catch (error) {
      console.error('Gallery selection error:', error);
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
    if (this.sourceMode === 'gallery') {
      // Process the already-selected gallery image
      this.processImage(this.galleryImage);
    } else {
      // In camera mode, capture from the native preview.
      CameraPreview.capture({ quality: 85 })
        .then((result: any) => {
          const base64 = result.value; // base64 image string
          if (!base64 || base64.length === 0) {
            console.error('Empty image data received:', base64);
            return;
          }
          this.processImage(base64);
        })
        .catch((error: any) => {
          console.error('Capture error:', error);
        });
    }
  }

  private processImage(base64: string): void {
    const img = new Image();
    img.onload = () => {
      console.log('Captured image dimensions:', img.width, img.height);
      // Use window dimensions as preview dimensions.
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
      console.log('Crop parameters:', { cropX, cropY, cropWidth, cropHeight });

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
        if (this.sourceMode === 'camera') {
          CameraPreview.stop()
            .then(() => console.log('Camera preview stopped'))
            .catch((error: any) =>
              console.error('Error stopping camera:', error)
            );
        }
      } else {
        console.error('Canvas context not available');
      }
    };
    img.src = 'data:image/png;base64,' + base64;
  }

  restartCamera(): void {
    this.image = '';
    this.currentPage = 'camera';
    if (typeof window !== 'undefined') {
      if (this.sourceMode === 'gallery') {
        // In gallery mode, simply stay in the same view.
        console.log('Restarting in gallery mode');
      } else {
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
}
