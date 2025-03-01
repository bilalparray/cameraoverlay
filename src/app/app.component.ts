import { Component } from '@angular/core';
import { CameraCropperComponent } from './camera/camera.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [CameraCropperComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {}
