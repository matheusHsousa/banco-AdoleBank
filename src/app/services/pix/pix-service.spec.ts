import { TestBed } from '@angular/core/testing';

import { Pix } from './pix-service';

describe('Pix', () => {
  let service: Pix;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Pix);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
