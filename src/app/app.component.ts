import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Cropper } from './cropper/cropper.component';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {}
