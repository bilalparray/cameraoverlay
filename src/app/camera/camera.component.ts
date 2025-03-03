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
  imports: [CommonModule, RouterModule],
  template: `
    <!-- Home / Start Screen -->
    <div *ngIf="currentPage === 'home'" class="page">
      <h1>Welcome to Camera Cropper Test Case 1</h1>
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

  // Overlay rectangle settings
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

  // For keeping the center fixed during resize
  resizeCenterX: number = 0;
  resizeCenterY: number = 0;

  constructor(private ngZone: NgZone) {}

  /**
   * Lifecycle hook: initializes the component.
   *
   * Centers the rectangle on the screen in the browser, or assigns a default
   * position if running in a server environment.
   */
  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      // Center the rectangle on the screen.
      this.squarePos = {
        left: window.innerWidth / 2 - this.boxWidth / 2,
        top: window.innerHeight / 2 - this.boxHeight / 2,
      };
    } else {
      this.squarePos = { left: 100, top: 100 };
    }
  }

  ngAfterViewInit(): void {}

  // HOME SCREEN METHODS

  /**
   * Navigate to the camera screen and start the camera preview.
   */
  goToCamera(): void {
    this.sourceMode = 'camera';
    this.currentPage = 'camera';
    if (typeof window !== 'undefined') {
      CameraPreview.start(cameraPreviewOptions)
        .then(() => console.log('Camera preview started'))
        .catch((error) => console.error('Camera error:', error));
    }
  }

  /**
   * Navigate to the camera screen and select an image from the gallery.
   *
   * Calls the `Camera.getPhoto` method to select an image from the gallery.
   * On success, sets the `galleryImage` property to the selected image's base64
   * string and navigates to the camera screen. In case of an error, logs an error
   * to the console.
   */
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

  /**
   * Start the drag event on the square.
   *
   * Sets `dragging` to true and records the initial mouse position and the
   * initial left and top positions of the square. Then adds event listeners for
   * mousemove and touchmove to track the drag, and for mouseup and touchend to
   * stop the drag.
   * @param event The event that triggered the drag (MouseEvent or TouchEvent)
   */
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

  /**
   * Starts the resizing process.
   * @param event mouse or touch event that triggered the resizing.
   */
  startResize(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isResizing = true;
    const evt = event instanceof TouchEvent ? event.touches[0] : event;
    this.initialResizeX = evt.clientX;
    this.initialResizeY = evt.clientY;
    this.initialBoxWidth = this.boxWidth;
    this.initialBoxHeight = this.boxHeight;
    // Calculate and store the current center of the rectangle.
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
      // Adjust position so the center remains fixed.
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

  // CAPTURE & CROP

  /**
   * Captures an image from the current source (either the gallery image or the
   * native camera preview) and crops it to the currently selected box
   * dimensions. If the source is the gallery, the image is processed immediately.
   * If the source is the camera, the method waits for the capture to complete and
   * then processes the result. If the capture fails, an error is logged to the
   * console.
   */
  captureAndCrop(): void {
    if (typeof window === 'undefined') return;
    if (this.sourceMode === 'gallery') {
      // Process the already-selected gallery image.
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

  /**
   * Processes a base64 image string by loading it into an HTML Image object and
   * cropping it to the dimensions of the currently selected box. The image is
   * scaled to match the preview dimensions, and the box coordinates are adjusted
   * accordingly. The resulting cropped image is then converted to a Data URL
   * and stored in the component state. If the source mode is 'camera', the
   * camera preview is stopped after processing the image.
   * @param base64 the base64 image string to process
   */
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

      const rect = this.draggableSquare.nativeElement.getBoundingClientRect();
      console.log('Overlay rectangle rect:', rect);
      const cropX = rect.left * scaleX;
      const cropY = rect.top * scaleY;
      const cropWidth = rect.width * scaleX;
      const cropHeight = rect.height * scaleY;
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
          this.image = croppedDataUrl.split(',')[1]; // Remove data URI prefix.
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

  /**
   * Restart the camera preview.
   *
   * Reset the component state to its initial values, and restart the camera
   * preview if the source mode is 'camera'. In gallery mode, the component will
   * stay in the same view. If the camera preview is restarted, the camera
   * preview will be started again with the same options as when the component
   * was initialized.
   */
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
