import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';

// This component requires the CameraPreview plugin to be installed and configured.
// It is assumed that CameraPreview is available globally.
declare var CameraPreview: any;

@Component({
  selector: 'app-camera-cropper',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container">
      <!-- Draggable/Resizable Crop Area Overlay -->
      <div
        #draggableSquare
        class="draggable-square"
        (mousedown)="startDrag($event)"
        (touchstart)="startDrag($event)"
        (mousemove)="onDrag($event)"
        (touchmove)="onDrag($event)"
        (mouseup)="endDrag()"
        (touchend)="endDrag()"
      >
        <div
          class="resize-handle"
          (mousedown)="startResize($event)"
          (touchstart)="startResize($event)"
        ></div>
      </div>

      <!-- Capture Button -->
      <button class="capture-btn" (click)="captureAndCrop()">Capture</button>

      <!-- Display Cropped Image -->
      <div *ngIf="image" class="cropped-image">
        <h3>Cropped Image:</h3>
        <img [src]="'data:image/png;base64,' + image" alt="Cropped Image" />
      </div>
    </div>
  `,
  styles: [
    `
      /* Container fills the viewport; adjust as needed */
      .container {
        position: relative;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        background: none; /* Default background for preview */
      }

      /* The crop area overlay – draggable and resizable */
      .draggable-square {
        position: absolute;
        width: 150px;
        height: 150px;
        border: 2px solid red;
        background: transparent;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        cursor: grab;
      }

      .draggable-square:active {
        cursor: grabbing;
      }

      /* Resize handle in the bottom-right corner */
      .resize-handle {
        position: absolute;
        width: 20px;
        height: 20px;
        background: red;
        bottom: 0;
        right: 0;
        cursor: nwse-resize;
      }

      /* Capture button styling */
      .capture-btn {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 10px 20px;
        font-size: 18px;
        color: white;
        background: red;
        border: none;
        border-radius: 5px;
        cursor: pointer;
      }

      /* Display the cropped image */
      .cropped-image {
        position: absolute;
        top: 10px;
        right: 10px;
        background: #fff;
        padding: 10px;
        border-radius: 10px;
      }

      .cropped-image img {
        width: 100px;
        height: auto;
        border: 2px solid #000;
      }
    `,
  ],
})
export class CameraCropperComponent implements OnInit, AfterViewInit {
  @ViewChild('draggableSquare', { static: false })
  draggableSquare!: ElementRef<HTMLDivElement>;

  // Holds the final cropped image (base64 string without the data URI prefix)
  image: string = '';

  // --- Dragging State ---
  private isDragging = false;
  private offsetX = 0;
  private offsetY = 0;

  // Start dragging the crop area
  startDrag(event: MouseEvent | TouchEvent): void {
    this.isDragging = true;
    const clientX =
      'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY =
      'touches' in event ? event.touches[0].clientY : event.clientY;
    const rect = this.draggableSquare.nativeElement.getBoundingClientRect();
    this.offsetX = clientX - rect.left;
    this.offsetY = clientY - rect.top;
    console.log('startDrag:', {
      clientX,
      clientY,
      rect,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
    });
  }

  // Update the crop area position while dragging
  onDrag(event: MouseEvent | TouchEvent): void {
    if (!this.isDragging) return;
    event.preventDefault();
    const clientX =
      'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY =
      'touches' in event ? event.touches[0].clientY : event.clientY;
    const newLeft = clientX - this.offsetX;
    const newTop = clientY - this.offsetY;
    this.draggableSquare.nativeElement.style.left = `${newLeft}px`;
    this.draggableSquare.nativeElement.style.top = `${newTop}px`;
    console.log('onDrag:', { clientX, clientY, newLeft, newTop });
  }

  // End dragging
  endDrag(): void {
    this.isDragging = false;
    console.log('endDrag');
  }

  // --- Resizing State ---
  private isResizing = false;
  private initialWidth = 0;
  private initialHeight = 0;
  private initialResizeX = 0;
  private initialResizeY = 0;

  // Start resizing the crop area
  startResize(event: MouseEvent | TouchEvent): void {
    event.stopPropagation(); // Prevent starting drag simultaneously.
    this.isResizing = true;
    const clientX =
      'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY =
      'touches' in event ? event.touches[0].clientY : event.clientY;
    const square = this.draggableSquare.nativeElement;
    this.initialWidth = square.offsetWidth;
    this.initialHeight = square.offsetHeight;
    this.initialResizeX = clientX;
    this.initialResizeY = clientY;
    console.log('startResize:', {
      clientX,
      clientY,
      initialWidth: this.initialWidth,
      initialHeight: this.initialHeight,
    });
    window.addEventListener('mousemove', this.onResize);
    window.addEventListener('touchmove', this.onResize);
    window.addEventListener('mouseup', this.endResize);
    window.addEventListener('touchend', this.endResize);
  }

  // Handle resizing events
  onResize = (event: MouseEvent | TouchEvent): void => {
    if (!this.isResizing) return;
    event.preventDefault();
    const clientX =
      'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY =
      'touches' in event ? event.touches[0].clientY : event.clientY;
    const deltaX = clientX - this.initialResizeX;
    const deltaY = clientY - this.initialResizeY;
    const newWidth = this.initialWidth + deltaX;
    const newHeight = this.initialHeight + deltaY;
    const minSize = 50; // Prevent crop area from becoming too small.
    console.log('onResize:', {
      clientX,
      clientY,
      deltaX,
      deltaY,
      newWidth,
      newHeight,
    });
    if (newWidth >= minSize && newHeight >= minSize) {
      this.draggableSquare.nativeElement.style.width = `${newWidth}px`;
      this.draggableSquare.nativeElement.style.height = `${newHeight}px`;
    }
  };

  // End resizing
  endResize = (): void => {
    this.isResizing = false;
    window.removeEventListener('mousemove', this.onResize);
    window.removeEventListener('touchmove', this.onResize);
    window.removeEventListener('mouseup', this.endResize);
    window.removeEventListener('touchend', this.endResize);
    console.log('endResize');
  };

  // --- Camera and Cropping ---
  ngOnInit(): void {
    // Additional initialization if required.
  }

  ngAfterViewInit(): void {
    // Start the camera preview.
    // This will work on a real device/emulator with proper camera permissions.
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

  /**
   * Captures an image using the CameraPreview plugin,
   * then crops the image using the overlay square's position and dimensions.
   */
  captureAndCrop(): void {
    console.log('captureAndCrop called');
    CameraPreview.takePicture(
      { width: window.innerWidth, height: window.innerHeight, quality: 85 },
      (base64: any) => {
        console.log('Picture taken');
        // If the result is an array, use the first element.
        if (Array.isArray(base64)) {
          console.log('Received base64 as an array; using first element.');
          base64 = base64[0];
        }
        if (!base64 || base64.length === 0) {
          console.error('Empty image data received:', base64);
          return;
        }
        console.log('Base64 length:', base64.length);

        // Create an image element to load the captured image.
        const img = new Image();
        img.onload = () => {
          console.log('Image loaded for cropping');
          // Get the crop overlay's bounding rectangle (relative to the viewport)
          const squareRect =
            this.draggableSquare.nativeElement.getBoundingClientRect();
          console.log('Square rect:', squareRect);

          // Here we assume the captured image dimensions equal window.innerWidth x window.innerHeight.
          const cropX = squareRect.left;
          const cropY = squareRect.top;
          const cropWidth = squareRect.width;
          const cropHeight = squareRect.height;
          console.log('Crop parameters:', {
            cropX,
            cropY,
            cropWidth,
            cropHeight,
          });

          // Create an offscreen canvas to draw the cropped portion.
          const canvas = document.createElement('canvas');
          canvas.width = cropWidth;
          canvas.height = cropHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Draw the cropped region from the captured image onto the canvas.
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
            // Convert the canvas content to a PNG data URL.
            const croppedDataUrl = canvas.toDataURL('image/png');
            // Remove the "data:image/png;base64," prefix.
            this.image = croppedDataUrl.split(',')[1];
            console.log('Cropped image generated');
          } else {
            console.error('Canvas context not available');
          }
        };
        img.src = 'data:image/png;base64,' + base64;
        console.log('Image src set for cropping');
      }
    );
  }
}
