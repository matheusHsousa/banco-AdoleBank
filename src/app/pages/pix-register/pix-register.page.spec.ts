import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PixRegisterPage } from './pix-register.page';

describe('PixRegisterPage', () => {
  let component: PixRegisterPage;
  let fixture: ComponentFixture<PixRegisterPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PixRegisterPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
