import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComprovantePage } from './comprovante.page';

describe('ComprovantePage', () => {
  let component: ComprovantePage;
  let fixture: ComponentFixture<ComprovantePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ComprovantePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
