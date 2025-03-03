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
  selector: 'app-cropper',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Home / Start Screen -->
    <div *ngIf="currentPage === 'home'" class="page">
      <h1>Welcome to Cropper</h1>
      <button class="action-btn" (click)="goToCamera()">Start Camera</button>
      <button class="action-btn" (click)="chooseFromGallery()">
        Select from Gallery
      </button>
    </div>

    <!-- Camera / Cropping Screen -->
    <div *ngIf="currentPage === 'camera'" class="page">
      <!-- If no image is captured, show the live preview with capture button -->
      <ng-container *ngIf="!capturedImage; else cropScreen">
        <div
          *ngIf="sourceMode === 'camera'"
          class="container"
          id="cameraPreview"
        ></div>
        <div class="overlay">
          <button class="capture-btn" (click)="captureAndCrop()">
            Capture
          </button>
        </div>
      </ng-container>

      <!-- Once a picture is taken or uploaded, display it with cropping UI -->
      <ng-template #cropScreen>
        <img
          #galleryImg
          [src]="'data:image/png;base64,' + capturedImage"
          class="gallery-preview"
          alt="Captured Image"
          (load)="onGalleryImageLoad()"
        />
        <div class="overlay">
          <div
            #draggableSquare
            class="draggable-square"
            (mousedown)="startDrag($event)"
            (touchstart)="startDrag($event)"
            [ngStyle]="{
              'left.px': squarePos.left,
              'top.px': squarePos.top,
              'width.px': boxWidth,
              'height.px': boxHeight
            }"
          >
            <div
              class="resize-handle"
              (mousedown)="startResize($event)"
              (touchstart)="startResize($event)"
            ></div>
          </div>
          <button class="capture-btn" (click)="captureAndCrop()">Crop</button>
        </div>
      </ng-template>
    </div>

    <!-- Cropped Image Result Screen -->
    <div *ngIf="currentPage === 'result'" class="page">
      <div class="cropped-image">
        <h3>Cropped Image:</h3>
        <img [src]="'data:image/png;base64,' + image" alt="Cropped Image" />
      </div>
      <button class="action-btn" (click)="restartCamera()">Restart</button>
      <button class="action-btn" (click)="currentPage = 'home'">Home</button>
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
      /* Container for camera preview */
      .container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        z-index: 1;
      }
      /* Display captured/gallery image */
      .gallery-preview {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      /* Overlay container for capture button or crop UI */
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
export class Cropper implements OnInit, AfterViewInit {
  @ViewChild('draggableSquare', { static: false })
  draggableSquare!: ElementRef<HTMLDivElement>;

  @ViewChild('galleryImg', { static: false })
  galleryImgRef!: ElementRef<HTMLImageElement>;

  // Screen states: 'home', 'camera', 'result'
  currentPage: 'home' | 'camera' | 'result' = 'home';

  // Cropped image (base64 without data URL prefix)
  image: string = '';

  // Source mode: 'camera' or 'gallery'
  sourceMode: 'camera' | 'gallery' = 'camera';

  // Holds the captured or gallery-selected image (base64 string)
  capturedImage: string = '';

  // Crop box settings
  boxWidth = 200;
  boxHeight = 200;
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
  initialBoxWidth = 200;
  initialBoxHeight = 200;
  resizeCenterX: number = 0;
  resizeCenterY: number = 0;

  constructor(private ngZone: NgZone) {}

  ngOnInit(): void {
    // For camera mode, center the crop box using window dimensions.
    if (typeof window !== 'undefined') {
      this.squarePos = {
        left: window.innerWidth / 2 - this.boxWidth / 2,
        top: window.innerHeight / 2 - this.boxHeight / 2,
      };
    } else {
      this.squarePos = { left: 100, top: 100 };
    }
  }

  ngAfterViewInit(): void {}

  // --- HOME SCREEN METHODS ---

  goToCamera(): void {
    this.sourceMode = 'camera';
    this.currentPage = 'camera';
    this.capturedImage = '';
    if (typeof window !== 'undefined') {
      CameraPreview.start(cameraPreviewOptions)
        .then(() => console.log('Camera preview started'))
        .catch((error) => console.error('Camera error:', error));
    }
  }

  async chooseFromGallery(): Promise<void> {
    try {
      const photo = await Camera.getPhoto({
        quality: 85,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
      });
      // Set the captured image so that the cropping UI is shown.
      this.capturedImage = photo.base64String || '';
      this.sourceMode = 'gallery';
      this.currentPage = 'camera';
      console.log('Gallery image selected');
    } catch (error) {
      console.error('Gallery selection error:', error);
    }
  }

  // --- GALLERY IMAGE LOAD HANDLER ---
  onGalleryImageLoad(): void {
    // Get the displayed dimensions of the gallery image
    const galleryRect =
      this.galleryImgRef.nativeElement.getBoundingClientRect();
    // Reset crop box size to 50% of the gallery image width/height and center it.
    this.boxWidth = galleryRect.width * 0.5;
    this.boxHeight = galleryRect.height * 0.5;
    this.squarePos = {
      left: (galleryRect.width - this.boxWidth) / 2,
      top: (galleryRect.height - this.boxHeight) / 2,
    };
  }

  // --- DRAGGING METHODS ---

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

  // --- RESIZING METHODS ---

  startResize(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isResizing = true;
    const evt = event instanceof TouchEvent ? event.touches[0] : event;
    this.initialResizeX = evt.clientX;
    this.initialResizeY = evt.clientY;
    this.initialBoxWidth = this.boxWidth;
    this.initialBoxHeight = this.boxHeight;
    // Store the current center of the box.
    this.resizeCenterX = this.squarePos.left + this.boxWidth / 2;
    this.resizeCenterY = this.squarePos.top + this.boxHeight / 2;

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
    const newWidth = Math.max(50, this.initialBoxWidth + deltaX);
    const newHeight = Math.max(50, this.initialBoxHeight + deltaY);
    this.ngZone.run(() => {
      this.boxWidth = newWidth;
      this.boxHeight = newHeight;
      // Adjust the box to keep its center fixed.
      this.squarePos = {
        left: this.resizeCenterX - newWidth / 2,
        top: this.resizeCenterY - newHeight / 2,
      };
    });
  };

  stopResize = (): void => {
    this.isResizing = false;
    document.removeEventListener('mousemove', this.onResize);
    document.removeEventListener('touchmove', this.onResize);
    document.removeEventListener('mouseup', this.stopResize);
    document.removeEventListener('touchend', this.stopResize);
  };

  // --- CAPTURE & CROP METHODS ---

  /**
   * When no image is captured, this method captures a photo from the live camera preview.
   * When an image already exists (from camera capture or gallery), it crops the image
   * using the draggable crop box.
   */
  captureAndCrop(): void {
    if (!this.capturedImage && this.sourceMode === 'camera') {
      // Capture photo from camera preview.
      CameraPreview.capture({ quality: 85 })
        .then((result: any) => {
          const base64 = result.value;
          if (!base64 || base64.length === 0) {
            console.error('Empty image data received:', base64);
            return;
          }
          this.capturedImage = base64;
          // Stop the camera preview now that a photo is taken.
          CameraPreview.stop()
            .then(() => console.log('Camera preview stopped'))
            .catch((error: any) =>
              console.error('Error stopping camera:', error)
            );
        })
        .catch((error: any) => {
          console.error('Capture error:', error);
        });
    } else if (this.capturedImage) {
      // Crop the captured (or gallery-selected) image using the drag box settings.
      this.processImage(this.capturedImage);
    }
  }

  /**
   * Loads the image from a base64 string, then crops it using the coordinates
   * of the draggable crop box. When in gallery mode, the displayed image dimensions
   * are used to calculate the scale factors.
   */
  private processImage(base64: string): void {
    const img = new Image();
    img.onload = () => {
      // Use different preview dimensions based on source mode.
      let previewWidth = window.innerWidth;
      let previewHeight = window.innerHeight;
      if (this.sourceMode === 'gallery' && this.galleryImgRef) {
        const galleryRect =
          this.galleryImgRef.nativeElement.getBoundingClientRect();
        previewWidth = galleryRect.width;
        previewHeight = galleryRect.height;
      }
      const scaleX = img.width / previewWidth;
      const scaleY = img.height / previewHeight;
      const rect = this.draggableSquare.nativeElement.getBoundingClientRect();
      const cropX = rect.left * scaleX;
      const cropY = rect.top * scaleY;
      const cropWidth = rect.width * scaleX;
      const cropHeight = rect.height * scaleY;
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
        this.ngZone.run(() => {
          this.image = croppedDataUrl.split(',')[1]; // Remove data URL prefix.
          this.currentPage = 'result';
        });
      } else {
        console.error('Canvas context not available');
      }
    };
    img.src = 'data:image/png;base64,' + base64;
  }

  /**
   * Resets the state and, if in camera mode, restarts the camera preview.
   */
  restartCamera(): void {
    this.image = '';
    this.capturedImage = '';
    this.currentPage = 'camera';
    if (typeof window !== 'undefined' && this.sourceMode === 'camera') {
      CameraPreview.start(cameraPreviewOptions)
        .then(() => console.log('Camera preview restarted'))
        .catch((error) => console.error('Camera error:', error));
    }
  }
}
