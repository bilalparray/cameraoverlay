import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
  NgZone,
  EventEmitter,
  Output,
} from '@angular/core';
import { CameraPreview } from '@capacitor-community/camera-preview';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

interface Position {
  left: number;
  top: number;
}

export interface CropResponse {
  imageName: string;
  imagePath: string;
  imageSourceType: 'camera' | 'gallery';
  imageType: string;
  imageBase64: string;
}

export interface UnifiedCropperOptions {
  mode: 'preCaptureCrop' | 'postCaptureCrop' | 'gallery';
  aspectRatio?: string; // e.g., "1:1", "16:9"
}

@Component({
  selector: 'app-unified-cropper',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Camera / Cropping Screen -->
    <div *ngIf="currentPage === 'camera'" class="page">
      <!-- Show camera preview container if active and source is camera -->
      <div
        *ngIf="livePreviewActive && sourceMode === 'camera'"
        id="cameraPreviewContainer"
        class="container"
      ></div>

      <!-- Conditionally display cropping UI only if:
           - In preCaptureCrop mode, OR
           - In postCaptureCrop mode AND an image has been captured -->
      <ng-container
        *ngIf="
          cropMode === 'preCaptureCrop' ||
            (cropMode === 'postCaptureCrop' && capturedImage);
          else captureButton
        "
      >
        <!-- Display the captured image if available -->
        <img
          *ngIf="capturedImage"
          [src]="'data:image/png;base64,' + capturedImage"
          class="gallery-preview"
          alt="Captured Image"
          (load)="onImageLoad()"
        />
        <!-- Overlay Mask and Crop Box -->
        <div class="overlay">
          <!-- Top Mask -->
          <div
            class="mask mask-top"
            [ngStyle]="{
              'height.px': squarePos.top,
              'width.px': screenWidth,
              'top.px': 0,
              'left.px': 0
            }"
          ></div>
          <!-- Bottom Mask -->
          <div
            class="mask mask-bottom"
            [ngStyle]="{
              'height.px': screenHeight - (squarePos.top + boxHeight),
              'width.px': screenWidth,
              'top.px': squarePos.top + boxHeight,
              'left.px': 0
            }"
          ></div>
          <!-- Left Mask -->
          <div
            class="mask mask-left"
            [ngStyle]="{
              'height.px': boxHeight,
              'width.px': squarePos.left,
              'top.px': squarePos.top,
              'left.px': 0
            }"
          ></div>
          <!-- Right Mask -->
          <div
            class="mask mask-right"
            [ngStyle]="{
              'height.px': boxHeight,
              'width.px': screenWidth - (squarePos.left + boxWidth),
              'top.px': squarePos.top,
              'left.px': squarePos.left + boxWidth
            }"
          ></div>

          <!-- Draggable Crop Box -->
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
            {{ cropMode === 'preCaptureCrop' ? 'Capture & Crop' : 'Crop' }}
          </button>
        </div>
      </ng-container>

      <!-- Capture Button Template: Shown when no image is available in postCaptureCrop mode -->
      <ng-template #captureButton>
        <div class="overlay">
          <button
            class="capture-btn"
            *ngIf="sourceMode === 'gallery'; else cameraCapture"
            (click)="pickImageFromGallery()"
          >
            Select from Gallery
          </button>
          <ng-template #cameraCapture>
            <button class="capture-btn" (click)="captureImage()">
              Capture
            </button>
          </ng-template>
        </div>
      </ng-template>
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
        overflow: hidden;
      }
      .container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }
      .gallery-preview {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        z-index: 900;
      }
      .overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1000;
        pointer-events: none;
      }
      .mask {
        position: absolute;
        background: rgba(0, 0, 0, 0.5);
        pointer-events: auto;
        z-index: 950;
      }
      .draggable-square {
        position: absolute;
        border: 2px dashed #fff;
        pointer-events: auto;
        z-index: 1001;
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
        pointer-events: auto;
        z-index: 1002;
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
        z-index: 1050;
        pointer-events: auto;
      }
    `,
  ],
})
export class UnifiedCropperComponent implements OnInit, AfterViewInit {
  @ViewChild('draggableSquare', { static: false })
  draggableSquare!: ElementRef<HTMLDivElement>;
  @ViewChild('galleryImg', { static: false })
  galleryImgRef!: ElementRef<HTMLImageElement>;

  @Output() cropCompleted: EventEmitter<CropResponse> =
    new EventEmitter<CropResponse>();

  // Instead of using platform injection, check directly:
  isBrowser: boolean = typeof window !== 'undefined';

  // Use only the "camera" page.
  currentPage: 'camera' = 'camera';

  // Crop mode: 'preCaptureCrop' or 'postCaptureCrop'
  // (Gallery mode sets sourceMode to 'gallery' and works like postCaptureCrop.)
  cropMode: 'preCaptureCrop' | 'postCaptureCrop' = 'postCaptureCrop';

  // Source mode: 'camera' or 'gallery'
  sourceMode: 'camera' | 'gallery' = 'camera';

  // Captured or selected image as base64.
  capturedImage: string = '';

  // Whether the camera preview is active.
  livePreviewActive: boolean = false;

  // Crop box dimensions and position.
  boxWidth: number = 200;
  boxHeight: number = 200;
  squarePos: Position = { left: 0, top: 0 };

  // Screen dimensions.
  screenWidth: number = 0;
  screenHeight: number = 0;

  // Drag state variables.
  dragging: boolean = false;
  dragStartX: number = 0;
  dragStartY: number = 0;
  initialSquareLeft: number = 0;
  initialSquareTop: number = 0;

  // Resize state variables.
  isResizing: boolean = false;
  initialResizeX: number = 0;
  initialResizeY: number = 0;
  initialBoxWidth: number = 200;
  initialBoxHeight: number = 200;

  // Optional aspect ratio.
  aspectRatio?: string;
  aspectX?: number;
  aspectY?: number;

  constructor(private ngZone: NgZone) {}

  ngOnInit(): void {
    if (this.isBrowser) {
      this.screenWidth = window.innerWidth;
      this.screenHeight = window.innerHeight;
      this.squarePos = {
        left: this.screenWidth / 2 - 100,
        top: this.screenHeight / 2 - 100,
      };
    } else {
      this.squarePos = { left: 0, top: 0 };
    }
  }

  ngAfterViewInit(): void {}

  /**
   * Public API to start the cropper.
   * Examples:
   *   this.unified.start({ mode: 'preCaptureCrop', aspectRatio: '1:1' });
   *   this.unified.start({ mode: 'gallery', aspectRatio: '16:9' });
   */
  public start(options: UnifiedCropperOptions): void {
    if (options.aspectRatio) {
      this.aspectRatio = options.aspectRatio;
      const parts = options.aspectRatio.split(':');
      if (parts.length === 2) {
        this.aspectX = parseFloat(parts[0]);
        this.aspectY = parseFloat(parts[1]);
      }
    }
    this.setCropMode(options.mode);
  }

  // --- Mode selection ---
  setCropMode(mode: 'preCaptureCrop' | 'postCaptureCrop' | 'gallery'): void {
    if (mode === 'gallery') {
      this.cropMode = 'postCaptureCrop';
      this.sourceMode = 'gallery';
      this.currentPage = 'camera';
      // Wait for user activation for gallery picker.
    } else {
      this.cropMode = mode;
      this.sourceMode = 'camera';
      this.currentPage = 'camera';
      if (this.isBrowser) {
        this.startCameraPreview();
      }
    }
  }

  // --- Gallery selection ---
  async pickImageFromGallery(): Promise<void> {
    try {
      const photo = await Camera.getPhoto({
        quality: 85,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
      });
      this.capturedImage = photo.base64String || '';
      if (this.livePreviewActive) {
        await CameraPreview.stop();
        this.livePreviewActive = false;
      }
      console.log('Gallery image selected');
    } catch (error) {
      console.error('Gallery selection error:', error);
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
      width: this.screenWidth,
      height: this.screenHeight,
      parent: 'cameraPreviewContainer',
      className: 'cameraPreview',
      toBack: true,
    })
      .then(() => console.log('Camera preview started'))
      .catch((error) => console.error('Error starting camera preview:', error));
  }

  // For postCaptureCrop mode: capture image from the live preview.
  captureImage(): void {
    if (!this.isBrowser) return;
    if (!this.livePreviewActive && this.cropMode === 'postCaptureCrop') return;
    CameraPreview.capture({ quality: 85 })
      .then((result: any) => {
        const base64 = result.value;
        if (!base64) {
          console.error('No image data captured');
          return;
        }
        this.capturedImage = base64;
        if (this.cropMode === 'postCaptureCrop') {
          CameraPreview.stop().then(() => {
            this.livePreviewActive = false;
          });
        }
      })
      .catch((error) => console.error('Capture error:', error));
  }

  // When the overlay button is clicked.
  cropOrCapture(): void {
    if (this.cropMode === 'preCaptureCrop') {
      this.captureImage();
      setTimeout(() => this.processImage(this.capturedImage), 100);
    } else {
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
        const scaleX = img.width / this.screenWidth;
        const scaleY = img.height / this.screenHeight;
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
        this.resetCropBox();
        if (this.livePreviewActive) {
          CameraPreview.stop().then(() => {
            this.livePreviewActive = false;
          });
        }
        const base64Result = croppedDataUrl.split(',')[1];
        const responseObj: CropResponse = {
          imageName: `IMG_${new Date().getTime()}.png`,
          imagePath: '',
          imageSourceType: this.sourceMode,
          imageType: '.png',
          imageBase64: base64Result,
        };
        console.log('Crop Completed:', responseObj);
        this.cropCompleted.emit(responseObj);
      } else {
        console.error('Canvas context not available');
      }
    };
    img.src = 'data:image/png;base64,' + base64;
  }

  // --- Drag & Resize Methods ---
  startDrag(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    if ((event.target as HTMLElement).classList.contains('resize-handle')) {
      return;
    }
    this.dragging = true;
    let clientX: number, clientY: number;
    if (event instanceof TouchEvent) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    this.dragStartX = clientX;
    this.dragStartY = clientY;
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
    let clientX: number, clientY: number;
    if (event instanceof TouchEvent) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    const deltaX = clientX - this.dragStartX;
    const deltaY = clientY - this.dragStartY;
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

  startResize(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isResizing = true;
    let clientX: number, clientY: number;
    if (event instanceof TouchEvent) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    this.initialResizeX = clientX;
    this.initialResizeY = clientY;
    this.initialBoxWidth = this.boxWidth;
    this.initialBoxHeight = this.boxHeight;
    document.addEventListener('mousemove', this.onResize);
    document.addEventListener('touchmove', this.onResize, { passive: false });
    document.addEventListener('mouseup', this.stopResize);
    document.addEventListener('touchend', this.stopResize);
  }

  onResize = (event: MouseEvent | TouchEvent): void => {
    if (!this.isResizing) return;
    event.preventDefault();
    let clientX: number, clientY: number;
    if (event instanceof TouchEvent) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    const deltaX = clientX - this.initialResizeX;
    if (this.aspectRatio && this.aspectX && this.aspectY) {
      let newWidth = Math.max(50, this.initialBoxWidth + deltaX);
      let newHeight = newWidth * (this.aspectY / this.aspectX);
      if (newHeight < 50) {
        newHeight = 50;
        newWidth = newHeight * (this.aspectX / this.aspectY);
      }
      this.ngZone.run(() => {
        this.boxWidth = newWidth;
        this.boxHeight = newHeight;
      });
    } else {
      const deltaY = clientY - this.initialResizeY;
      const newWidth = Math.max(50, this.initialBoxWidth + deltaX);
      const newHeight = Math.max(50, this.initialBoxHeight + deltaY);
      this.ngZone.run(() => {
        this.boxWidth = newWidth;
        this.boxHeight = newHeight;
      });
    }
  };

  stopResize = (): void => {
    this.isResizing = false;
    document.removeEventListener('mousemove', this.onResize);
    document.removeEventListener('touchmove', this.onResize);
    document.removeEventListener('mouseup', this.stopResize);
    document.removeEventListener('touchend', this.stopResize);
  };

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
        left: this.screenWidth / 2 - 100,
        top: this.screenHeight / 2 - 100,
      };
    }
  }

  onImageLoad(): void {}
}
