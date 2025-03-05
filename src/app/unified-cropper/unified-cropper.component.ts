import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
  NgZone,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { CameraPreview } from '@capacitor-community/camera-preview';

interface Position {
  left: number;
  top: number;
}

@Component({
  selector: 'app-unified-cropper',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Home Screen: User selects the cropping mode -->
    <div *ngIf="currentPage === 'home'" class="page">
      <h1>Welcome to Unified Cropper</h1>
      <button (click)="setCropMode('preCapture')">Pre-Capture Crop</button>
      <button (click)="setCropMode('postCapture')">Post-Capture Crop</button>
    </div>

    <!-- Camera / Cropping Screen -->
    <div *ngIf="currentPage === 'camera'" class="page">
      <!-- Always show the camera preview container if livePreviewActive is true -->
      <div
        *ngIf="livePreviewActive"
        id="cameraPreviewContainer"
        class="container"
      ></div>

      <!-- Show captured image (for post-capture) or overlay cropping (for pre-capture) -->
      <ng-container
        *ngIf="capturedImage || cropMode === 'preCapture'; else captureButton"
      >
        <!-- Display the captured image in post-capture mode -->
        <img
          *ngIf="capturedImage && cropMode === 'postCapture'"
          [src]="'data:image/png;base64,' + capturedImage"
          class="gallery-preview"
          alt="Captured Image"
          (load)="onImageLoad()"
        />
        <!-- Cropping overlay (shared between modes) -->
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
          <button class="capture-btn" (click)="cropOrCapture()">
            {{ cropMode === 'preCapture' ? 'Capture & Crop' : 'Crop' }}
          </button>
        </div>
      </ng-container>

      <!-- Template for post-capture mode: show capture button if no image yet -->
      <ng-template #captureButton>
        <div class="overlay">
          <button class="capture-btn" (click)="captureImage()">Capture</button>
        </div>
      </ng-template>
    </div>

    <!-- Result Screen -->
    <div *ngIf="currentPage === 'result'" class="page">
      <h3>Cropped Image:</h3>
      <div class="image-preview-container">
        <img [src]="'data:image/png;base64,' + image" alt="Cropped Image" />
      </div>
      <button (click)="restart()">Restart</button>
      <button (click)="goHome()">Home</button>
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
      }
      h1 {
        text-align: center;
        margin-bottom: 20px;
      }
      button {
        padding: 10px 20px;
        margin: 5px;
        font-size: 18px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
      }
      .container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }
      .image-preview-container {
        width: 100%;
        max-width: 300px;
        height: auto;
        overflow: hidden;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .gallery-preview {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
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
      }
      .draggable-square {
        position: absolute;
        border: 2px dashed #fff;
        touch-action: none;
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
    `,
  ],
})
export class UnifiedCropperComponent implements OnInit, AfterViewInit {
  @ViewChild('draggableSquare', { static: false })
  draggableSquare!: ElementRef<HTMLDivElement>;
  @ViewChild('galleryImg', { static: false })
  galleryImgRef!: ElementRef<HTMLImageElement>;

  // Flag to indicate browser (avoids SSR issues)
  isBrowser: boolean = false;

  // Pages: 'home', 'camera', 'result'
  currentPage: 'home' | 'camera' | 'result' = 'home';

  // Cropping mode: 'preCapture' or 'postCapture'
  cropMode: 'preCapture' | 'postCapture' = 'postCapture';

  // Source mode: 'camera' or 'gallery'
  sourceMode: 'camera' | 'gallery' = 'camera';

  // Base64 image strings (captured and cropped)
  capturedImage: string = '';
  image: string = '';

  // Camera preview active flag
  livePreviewActive: boolean = false;

  // Crop box dimensions and position
  boxWidth: number = 200;
  boxHeight: number = 200;
  squarePos: Position = { left: 0, top: 0 };

  // Drag/resize state variables (implement as needed)
  dragging: boolean = false;
  isResizing: boolean = false;
  // ... additional variables for drag/resize tracking

  constructor(
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.squarePos = {
        left: window.innerWidth / 2 - 100,
        top: window.innerHeight / 2 - 100,
      };
    } else {
      this.squarePos = { left: 0, top: 0 };
    }
  }

  ngAfterViewInit(): void {}

  // --- Mode selection ---
  setCropMode(mode: 'preCapture' | 'postCapture'): void {
    this.cropMode = mode;
    this.currentPage = 'camera';
    if (this.isBrowser) {
      // Start the camera preview regardless of mode
      this.startCameraPreview();
    }
  }

  // --- Camera Preview & Capture ---
  startCameraPreview(): void {
    if (!this.isBrowser) return;
    this.sourceMode = 'camera';
    this.capturedImage = '';
    this.livePreviewActive = true;
    CameraPreview.start({
      position: 'rear',
      width: window.innerWidth,
      height: window.innerHeight,
      parent: 'cameraPreviewContainer',
      className: 'cameraPreview',
      toBack: true,
    })
      .then(() => console.log('Camera preview started'))
      .catch((error) => console.error('Error starting camera preview:', error));
  }

  // For post-capture mode, capture the full image first.
  captureImage(): void {
    if (!this.isBrowser) return;
    if (!this.livePreviewActive && this.cropMode === 'postCapture') return;
    CameraPreview.capture({ quality: 85 })
      .then((result: any) => {
        const base64 = result.value;
        if (!base64) {
          console.error('No image data captured');
          return;
        }
        this.capturedImage = base64;
        if (this.cropMode === 'postCapture') {
          // Stop the preview once the image is captured
          CameraPreview.stop().then(() => {
            this.livePreviewActive = false;
          });
        }
      })
      .catch((error) => console.error('Capture error:', error));
  }

  // When user clicks the overlay button.
  cropOrCapture(): void {
    if (this.cropMode === 'preCapture') {
      // Capture and crop immediately from live preview
      this.captureImage();
      setTimeout(() => this.processImage(this.capturedImage), 100);
    } else {
      // For post-capture, process the already-captured image.
      this.processImage(this.capturedImage);
    }
  }

  // --- Cropping Logic ---
  private processImage(base64: string): void {
    const img = new Image();
    img.onload = () => {
      let cropX: number, cropY: number, cropWidth: number, cropHeight: number;
      if (this.sourceMode === 'gallery' && this.galleryImgRef) {
        const containerRect =
          this.galleryImgRef.nativeElement.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        const scale = Math.min(
          containerWidth / naturalWidth,
          containerHeight / naturalHeight
        );
        const displayedWidth = naturalWidth * scale;
        const displayedHeight = naturalHeight * scale;
        const offsetX = (containerWidth - displayedWidth) / 2;
        const offsetY = (containerHeight - displayedHeight) / 2;
        const cropRect =
          this.draggableSquare.nativeElement.getBoundingClientRect();
        const containerLeft = containerRect.left;
        const containerTop = containerRect.top;
        cropX =
          (cropRect.left - containerLeft - offsetX) *
          (naturalWidth / displayedWidth);
        cropY =
          (cropRect.top - containerTop - offsetY) *
          (naturalHeight / displayedHeight);
        cropWidth = cropRect.width * (naturalWidth / displayedWidth);
        cropHeight = cropRect.height * (naturalHeight / displayedHeight);
      } else {
        // For camera mode, assume the image fills the window.
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
        // Reset crop box for next use.
        this.resetCropBox();
        this.ngZone.run(() => {
          this.image = croppedDataUrl.split(',')[1]; // remove the data URL prefix
          this.currentPage = 'result';
        });
      } else {
        console.error('Canvas context not available');
      }
    };
    img.src = 'data:image/png;base64,' + base64;
  }

  // --- Drag & Resize Methods ---
  startDrag(event: MouseEvent | TouchEvent): void {
    // Implement your dragging logic here.
  }
  startResize(event: MouseEvent | TouchEvent): void {
    // Implement your resizing logic here.
  }

  // --- Resetting ---
  resetCropBox(): void {
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
    } else if (this.isBrowser) {
      this.boxWidth = 200;
      this.boxHeight = 200;
      this.squarePos = {
        left: window.innerWidth / 2 - 100,
        top: window.innerHeight / 2 - 100,
      };
    }
  }

  // --- Navigation Helpers ---
  restart(): void {
    this.image = '';
    this.capturedImage = '';
    this.currentPage = 'camera';
    if (this.sourceMode === 'camera' && this.isBrowser) {
      this.livePreviewActive = true;
      CameraPreview.start({
        position: 'rear',
        width: window.innerWidth,
        height: window.innerHeight,
        parent:
          this.cropMode === 'preCapture'
            ? 'cameraPreviewContainer'
            : 'cameraPreview',
        className: 'cameraPreview',
        toBack: true,
      })
        .then(() => console.log('Camera preview restarted'))
        .catch((error) =>
          console.error('Error restarting camera preview:', error)
        );
    }
  }

  goHome(): void {
    this.currentPage = 'home';
    // Optionally stop the camera preview if needed.
  }

  onImageLoad(): void {
    // Adjust crop box based on the loaded image dimensions if necessary.
  }
}
