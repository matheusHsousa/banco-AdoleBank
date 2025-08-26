import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/authService/auth-service';
import { UserService } from '../services/user/user';

@Injectable({
  providedIn: 'root'
})

export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router, private userServie: UserService) {}

  canActivate(): boolean {
    const user = this.userServie.getCurrentUser();

    if (user) {
      return true;
    }

    this.router.navigate(['/login']);
    return false;
  }
}
