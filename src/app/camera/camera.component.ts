import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  AfterViewInit,
} from '@angular/core';

// Declare the global plugin variable
declare var CameraPreview: any;

@Component({
  selector: 'app-camera',
  templateUrl: './camera.component.html',
  styleUrls: ['./camera.component.scss'],
  imports: [CommonModule],
})
export class CameraComponent implements OnInit, AfterViewInit {
  @ViewChild('draggableSquare', { static: false })
  draggableSquare!: ElementRef<HTMLDivElement>;

  private isDragging = false;
  private offsetX = 0;
  private offsetY = 0;

  ngOnInit() {
    // Any initialization logic can go here.
  }

  ngAfterViewInit() {
    // Start camera preview after view initializes
    this.startCameraPreview();
  }

  startCameraPreview() {
    // Starting the preview with "toBack: true" lets HTML be overlaid
    CameraPreview.startCamera(
      {
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        camera: 'rear',
        tapPhoto: false,
        previewDrag: false,
        toBack: true,
      },
      () => {
        console.log('Camera preview started');
      },
      (error: any) => {
        console.error('Camera preview error:', error);
      }
    );
  }

  // ----- Drag Handlers -----

  startDrag(event: MouseEvent | TouchEvent) {
    this.isDragging = true;
    const clientX =
      'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY =
      'touches' in event ? event.touches[0].clientY : event.clientY;
    const rect = this.draggableSquare.nativeElement.getBoundingClientRect();
    this.offsetX = clientX - rect.left;
    this.offsetY = clientY - rect.top;
  }

  onDrag(event: MouseEvent | TouchEvent) {
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
  }

  endDrag() {
    this.isDragging = false;
  }

  // ----- Capture & Crop -----
  image: string = '';
  captureAndCrop() {
    CameraPreview.takePicture(
      {
        width: window.innerWidth,
        height: window.innerHeight,
        quality: 85,
      },
      (base64Picture: string) => {
        if (!base64Picture) {
          console.error(
            'No image data returned from CameraPreview.takePicture'
          );
          return;
        }
        // Log the raw data to verify capture
        this.image = base64Picture;
        console.log(this.image);
      }
    );
  }
}
