import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UnifiedCropperComponent } from './unified-cropper.component';

describe('UnifiedCropperComponent', () => {
  let component: UnifiedCropperComponent;
  let fixture: ComponentFixture<UnifiedCropperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnifiedCropperComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UnifiedCropperComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
