import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  CropResponse,
  UnifiedCropperComponent,
} from './unified-cropper/unified-cropper.component';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterModule, UnifiedCropperComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  @ViewChild('cropper') unified!: UnifiedCropperComponent;

  ngOnInit(): void {
    setTimeout(() => this.startCropper(), 1000);
  }
  startCropper(): void {
    this.unified.start({ mode: 'preCaptureCrop', aspectRatio: '1:1' });

    this.unified.cropCompleted.subscribe((response: CropResponse) => {
      console.log('Crop response received:', response);
    });
  }
}
