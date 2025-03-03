import { Routes } from '@angular/router';
import { CameraCropperComponent } from './camera/camera.component';
import { Cropper } from './cropper/cropper.component';
import { HomeComponent } from './home/home.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    component: HomeComponent,
  },
  {
    path: 'camera',
    component: CameraCropperComponent,
  },
  {
    path: 'cropper',
    component: Cropper,
  },
];
