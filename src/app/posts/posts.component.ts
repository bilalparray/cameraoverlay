import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

interface Post {
  id: number;
  title: string;
  content: string;
}

@Component({
  selector: 'app-post',
  templateUrl: './posts.component.html',
  styleUrls: ['./posts.component.scss'],
  imports: [CommonModule],
})
export class PostComponent implements OnInit {
  postId!: number;
  post: Post | undefined;

  // Example data
  posts: Post[] = [
    { id: 1, title: 'Angular Basics', content: 'Learn the basics of Angular.' },
    {
      id: 2,
      title: 'Routing in Angular',
      content: 'How to navigate between pages.',
    },
    {
      id: 3,
      title: 'Angular Services',
      content: 'Sharing data using services.',
    },
  ];

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Subscribe to route parameters to get the id
    this.route.paramMap.subscribe((params) => {
      const idParam = params.get('id');
      if (idParam) {
        this.postId = +idParam; // Convert string to number
        this.loadPost();
      }
    });
  }

  loadPost(): void {
    // Find the post that matches the id from the route
    this.post = this.posts.find((p) => p.id === this.postId);
  }
}
