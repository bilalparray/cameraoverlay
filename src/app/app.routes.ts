import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { AboutComponent } from './about/about.component';
import { PostComponent } from './posts/posts.component';
import { CameraComponent } from './camera/camera.component';

export const routes: Routes = [
  {
    path: 'home',
    component: HomeComponent,
  },
  {
    path: 'about',
    component: AboutComponent,
  },
  {
    path: 'camera',
    component: CameraComponent,
  },
  {
    path: 'posts/:id',
    component: PostComponent,
  },
];
