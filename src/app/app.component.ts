import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CameraCropperComponent } from './camera/camera.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CameraCropperComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  open: boolean = false;
  title = 'cropper';
  toggleCamera(): void {
    this.open = !this.open;
    console.log('Camera cropper open:', this.open);
  }
}
