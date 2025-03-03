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
import { RouterModule } from '@angular/router';

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
  imports: [CommonModule, RouterModule],
  template: `
    <!-- Home / Start Screen -->
    <div *ngIf="currentPage === 'home'" class="page">
      <h1>Welcome to Cropper</h1>
      <button class="action-btn" (click)="goToCamera()">Start Camera</button>
      <button class="action-btn" (click)="chooseFromGallery()">
        Select from Gallery
      </button>
      <button
        class="action-btn"
        [routerLink]="['/home']"
        routerLinkActive="router-link-active"
      >
        Go Home
      </button>
    </div>

    <!-- Camera / Cropping Screen -->
    <div *ngIf="currentPage === 'camera'" class="page">
      <!-- When no image is captured, show the live preview with capture button -->
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
        object-fit: contain;
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

  // Cropped image (base64 string without the data URL prefix)
  image: string = '';

  // Source mode: 'camera' or 'gallery'
  sourceMode: 'camera' | 'gallery' = 'camera';

  // Holds the captured or gallery-selected image (base64)
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
    if (this.sourceMode !== 'gallery') {
      return;
    }
    // Get the container (gallery image) dimensions.
    const containerRect =
      this.galleryImgRef.nativeElement.getBoundingClientRect();
    // Reset crop box to 50% of the displayed image size and center it.
    this.boxWidth = containerRect.width * 0.5;
    this.boxHeight = containerRect.height * 0.5;
    this.squarePos = {
      left: (containerRect.width - this.boxWidth) / 2,
      top: (containerRect.height - this.boxHeight) / 2,
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
   * If no image is captured (and source is camera), capture a photo.
   * Otherwise, process the captured (or gallery-selected) image by cropping it.
   */
  captureAndCrop(): void {
    if (!this.capturedImage && this.sourceMode === 'camera') {
      CameraPreview.capture({ quality: 85 })
        .then((result: any) => {
          const base64 = result.value;
          if (!base64 || base64.length === 0) {
            console.error('Empty image data received:', base64);
            return;
          }
          this.capturedImage = base64;
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
      this.processImage(this.capturedImage);
    }
  }

  /**
   * Loads the image from a base64 string, then crops it using the draggable crop box.
   * For gallery uploads, we calculate the actual displayed image size (with letterboxing)
   * based on the container and the image's natural dimensions.
   */
  private processImage(base64: string): void {
    const img = new Image();
    img.onload = () => {
      let cropX: number, cropY: number, cropWidth: number, cropHeight: number;
      if (this.sourceMode === 'gallery' && this.galleryImgRef) {
        // Get the container dimensions.
        const containerRect =
          this.galleryImgRef.nativeElement.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        // Get the natural dimensions of the image.
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        // For object-fit: contain, the image is scaled uniformly.
        const scale = Math.min(
          containerWidth / naturalWidth,
          containerHeight / naturalHeight
        );
        const displayedWidth = naturalWidth * scale;
        const displayedHeight = naturalHeight * scale;
        // Calculate offsets (letterboxing) if any.
        const offsetX = (containerWidth - displayedWidth) / 2;
        const offsetY = (containerHeight - displayedHeight) / 2;
        // Get crop box rect relative to the viewport.
        const cropRect =
          this.draggableSquare.nativeElement.getBoundingClientRect();
        // Also get the container's position.
        const containerLeft = containerRect.left;
        const containerTop = containerRect.top;
        // Map crop box coordinates to the image's coordinate system.
        cropX =
          (cropRect.left - containerLeft - offsetX) *
          (naturalWidth / displayedWidth);
        cropY =
          (cropRect.top - containerTop - offsetY) *
          (naturalHeight / displayedHeight);
        cropWidth = cropRect.width * (naturalWidth / displayedWidth);
        cropHeight = cropRect.height * (naturalHeight / displayedHeight);
      } else {
        // For camera mode, assume the image fills the screen.
        const previewWidth = window.innerWidth;
        const previewHeight = window.innerHeight;
        const scaleX = img.width / previewWidth;
        const scaleY = img.height / previewHeight;
        const rect = this.draggableSquare.nativeElement.getBoundingClientRect();
        cropX = rect.left * scaleX;
        cropY = rect.top * scaleY;
        cropWidth = rect.width * scaleX;
        cropHeight = rect.height * scaleY;
      }

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
        // Reset the crop box to its initial position and size.
        this.resetCropBox();
        this.ngZone.run(() => {
          this.image = croppedDataUrl.split(',')[1]; // remove data URL prefix
          this.currentPage = 'result';
        });
      } else {
        console.error('Canvas context not available');
      }
    };
    img.src = 'data:image/png;base64,' + base64;
  }

  /**
   * Resets the crop box (drag box) to its default position and size.
   * For gallery mode, the crop box is centered and set to 50% of the container.
   * For camera mode, it resets to a fixed 200x200 box centered in the window.
   */
  private resetCropBox(): void {
    if (this.sourceMode === 'gallery' && this.galleryImgRef) {
      const containerRect =
        this.galleryImgRef.nativeElement.getBoundingClientRect();
      const defaultWidth = containerRect.width * 0.5;
      const defaultHeight = containerRect.height * 0.5;
      this.boxWidth = defaultWidth;
      this.boxHeight = defaultHeight;
      this.squarePos = {
        left: (containerRect.width - defaultWidth) / 2,
        top: (containerRect.height - defaultHeight) / 2,
      };
    } else {
      this.boxWidth = 200;
      this.boxHeight = 200;
      this.squarePos = {
        left: window.innerWidth / 2 - 200 / 2,
        top: window.innerHeight / 2 - 200 / 2,
      };
    }
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
