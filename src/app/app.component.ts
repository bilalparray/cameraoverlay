import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UnifiedCropperComponent } from './unified-cropper/unified-cropper.component';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterModule, UnifiedCropperComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {}
