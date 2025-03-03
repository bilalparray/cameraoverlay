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

// Define the options for the camera preview. Note that the preview attaches to the container element.
const cameraPreviewOptions: CameraPreviewOptions =
  typeof window !== 'undefined'
    ? {
        position: 'rear',
        width: window.innerWidth,
        height: window.innerHeight,
        parent: 'cameraPreviewContainer',
        className: 'cameraPreview',
        toBack: true,
      }
    : {};

@Component({
  selector: 'app-cropper',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Home Screen -->
    <div *ngIf="currentPage === 'home'" class="page">
      <h1>Welcome to Cropper</h1>
      <button class="action-btn" (click)="startCameraPreview()">
        Start Camera
      </button>
      <button class="action-btn" (click)="chooseFromGallery()">
        Select from Gallery
      </button>
    </div>

    <!-- Camera Preview & Cropping Screen -->
    <div *ngIf="currentPage === 'camera'" class="page">
      <!-- The camera preview container is visible only while livePreviewActive is true -->
      <div
        *ngIf="livePreviewActive"
        id="cameraPreviewContainer"
        class="container"
      ></div>

      <!-- If an image is captured (or selected) the cropping UI is shown -->
      <ng-container *ngIf="capturedImage; else captureButton">
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
          <button class="capture-btn" (click)="cropImage()">Crop</button>
        </div>
      </ng-container>

      <!-- While live preview is active and no image captured, show a Capture button -->
      <ng-template #captureButton>
        <div class="overlay">
          <button class="capture-btn" (click)="captureImage()">Capture</button>
        </div>
      </ng-template>
    </div>

    <!-- Cropped Image Result Screen -->
    <div *ngIf="currentPage === 'result'" class="page">
      <!-- <div class="cropped-image">
        <h3>Cropped Image:</h3>
        <img [src]="'data:image/png;base64,' + image" alt="Cropped Image" />
      </div> -->
      <h3>Cropped Image:</h3>
      <div class="image-preview-container">
        <img [src]="'data:image/png;base64,' + image" alt="Cropped Image" />
      </div>

      <button class="action-btn" (click)="restart()">Restart</button>
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
      .container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }
      .image-preview-container {
        width: 100%;
        max-width: 300px; // Adjust this to your preferred size
        height: auto;
        overflow: hidden;
        display: flex;
        justify-content: center;
        align-items: center;

        img {
          max-width: 100%;
          max-height: 200px; // Adjust height if needed
          object-fit: contain; // Ensures the image fits properly
        }
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

  // The component manages three screens: home, camera (for preview & crop), and result.
  currentPage: 'home' | 'camera' | 'result' = 'home';

  // The captured image (base64 string) and the final cropped image.
  capturedImage: string = '';
  image: string = '';

  // Use "camera" or "gallery" mode
  sourceMode: 'camera' | 'gallery' = 'camera';

  // Flag to indicate if the live camera preview is active.
  livePreviewActive = false;

  // Crop box settings – initial defaults.
  boxWidth = 200;
  boxHeight = 200;
  squarePos: Position = { left: 0, top: 0 };

  // Variables for dragging.
  dragging = false;
  dragStartX = 0;
  dragStartY = 0;
  initialSquareLeft = 0;
  initialSquareTop = 0;

  // Variables for resizing.
  isResizing = false;
  initialResizeX = 0;
  initialResizeY = 0;
  initialBoxWidth = 200;
  initialBoxHeight = 200;
  resizeCenterX: number = 0;
  resizeCenterY: number = 0;

  constructor(private ngZone: NgZone) {}

  ngOnInit(): void {
    // Set the default crop box position for a 200x200 box centered on the screen.
    this.resetCropBox();
  }

  ngAfterViewInit(): void {}

  // ===============================
  // CAMERA & GALLERY FLOW
  // ===============================

  // Start the live camera preview using the Capacitor Camera Preview plugin.
  startCameraPreview(): void {
    this.sourceMode = 'camera';
    this.currentPage = 'camera';
    this.capturedImage = '';
    this.livePreviewActive = true;
    CameraPreview.start(cameraPreviewOptions)
      .then(() => console.log('Camera preview started'))
      .catch((error) => console.error('Error starting camera preview:', error));
  }

  // Capture an image from the live preview.
  captureImage(): void {
    if (!this.livePreviewActive) return;
    CameraPreview.capture({ quality: 85 })
      .then((result: any) => {
        const base64 = result.value;
        if (!base64) {
          console.error('No image data captured');
          return;
        }
        this.capturedImage = base64;
        // Stop the preview once the image is captured.
        CameraPreview.stop()
          .then(() => {
            console.log('Camera preview stopped');
            this.livePreviewActive = false;
            // Reset crop box (useful for subsequent cropping).
            this.resetCropBox();
          })
          .catch((error) =>
            console.error('Error stopping camera preview:', error)
          );
      })
      .catch((error) => console.error('Capture error:', error));
  }

  // Allow the user to select an image from the gallery.
  async chooseFromGallery(): Promise<void> {
    try {
      const photo = await Camera.getPhoto({
        quality: 85,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
      });
      this.capturedImage = photo.base64String || '';
      this.sourceMode = 'gallery';
      this.currentPage = 'camera';
      // Reset crop box based on the displayed image.
      this.resetCropBox();
      console.log('Gallery image selected');
    } catch (error) {
      console.error('Gallery selection error:', error);
    }
  }

  // ===============================
  // CROPPING & DRAG/RESIZE LOGIC
  // ===============================

  // When the gallery image loads, adjust the crop box to be 50% of the image dimensions and centered.
  onGalleryImageLoad(): void {
    if (this.sourceMode !== 'gallery' && !this.capturedImage) return;
    const containerRect =
      this.galleryImgRef.nativeElement.getBoundingClientRect();
    this.boxWidth = containerRect.width * 0.5;
    this.boxHeight = containerRect.height * 0.5;
    this.squarePos = {
      left: (containerRect.width - this.boxWidth) / 2,
      top: (containerRect.height - this.boxHeight) / 2,
    };
  }

  // --- Dragging the crop box ---
  startDrag(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    if ((event.target as HTMLElement).classList.contains('resize-handle'))
      return;
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

  // --- Resizing the crop box ---
  startResize(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isResizing = true;
    const evt = event instanceof TouchEvent ? event.touches[0] : event;
    this.initialResizeX = evt.clientX;
    this.initialResizeY = evt.clientY;
    this.initialBoxWidth = this.boxWidth;
    this.initialBoxHeight = this.boxHeight;
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

  // ===============================
  // IMAGE PROCESSING & RESET
  // ===============================

  // Called when the user clicks "Crop" – processes the captured image using the crop box.
  cropImage(): void {
    this.processImage(this.capturedImage);
  }

  private processImage(base64: string): void {
    const img = new Image();
    img.onload = () => {
      let cropX: number, cropY: number, cropWidth: number, cropHeight: number;
      if (this.sourceMode === 'gallery' && this.galleryImgRef) {
        // Calculate based on the displayed image dimensions (with letterboxing)
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
        // Reset the crop box for next time.
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

  // Reset the crop box to its default position and size.
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
      // For camera mode, use a fixed 200x200 box centered on the window.
      this.boxWidth = 200;
      this.boxHeight = 200;
      this.squarePos = {
        left: window.innerWidth / 2 - 100,
        top: window.innerHeight / 2 - 100,
      };
    }
  }

  // ===============================
  // RESTART / RESET FLOW
  // ===============================

  // Restart the process – clears the images and (if in camera mode) restarts the preview.
  restart(): void {
    this.image = '';
    this.capturedImage = '';
    this.currentPage = 'camera';
    if (this.sourceMode === 'camera') {
      this.livePreviewActive = true;
      CameraPreview.start(cameraPreviewOptions)
        .then(() => console.log('Camera preview restarted'))
        .catch((error) =>
          console.error('Error restarting camera preview:', error)
        );
    }
  }
}
