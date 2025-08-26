import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AuthService } from 'src/app/services/authService/auth-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from 'src/app/services/user/user';
import { Subscription } from 'rxjs';
import { User } from 'src/app/interfaces/pix.interface';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class HomePage implements OnInit, OnDestroy {
  userName = 'Usuário';
  accountNumber = '00012345-6';
  balance = 0.00;
  creditLimit = 0;
  savings = 0;
  investments = 0;
  showBalance = true;
  accountType = '';
  isLoading = true;
  
  private userSubscription: Subscription | null = null;
  private unsubscribeListener: () => void = () => {};

  constructor(
    private auth: AuthService, 
    private router: Router, 
    private userService: UserService
  ) { }

  async ngOnInit() {
    await this.initializeUserData();
  }

  ngOnDestroy() {
    this.cleanupSubscriptions();
  }

  private async initializeUserData() {
    this.isLoading = true;
    
    try {
      // First load from localStorage via UserService
      this.loadUserDataFromStorage();
      
      // Then try to fetch fresh data from Firebase
      await this.refreshUserData();
      
      // Setup real-time listener
      this.setupUserListener();
      
    } catch (error) {
      console.error('Error initializing user data:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private loadUserDataFromStorage() {
    const user = this.userService.getCurrentUser();
    if (user) {
      this.updateUserData(user);
    } else {
      console.warn('No user data found in storage');
      this.redirectToLoginIfNoUser();
    }
  }

  private async refreshUserData() {
    try {
      const freshUser = await this.userService.fetchCurrentUserFromFirebase();
      if (freshUser) {
        this.updateUserData(freshUser);
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  }

  private setupUserListener() {
    this.unsubscribeListener = this.userService.setupUserListener();
    
    this.userSubscription = this.userService.currentUser$.subscribe({
      next: (user) => {
        if (user) {
          this.updateUserData(user);
        }
      },
      error: (error) => {
        console.error('Error in user subscription:', error);
      }
    });
  }

  private updateUserData(user: User) {
    this.balance = user.balance || 0;
    this.accountType = user.tipo || '';
    this.userName = user.nome || 'Usuário';
    this.accountNumber = user.conta || '00012345-6';
    // Add other properties as needed from your User interface
  }

  private redirectToLoginIfNoUser() {
    const user = this.userService.getCurrentUser();
    if (!user) {
      this.router.navigateByUrl('/login');
    }
  }

  private cleanupSubscriptions() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    this.unsubscribeListener();
  }

  async logout() {
    this.cleanupSubscriptions();
    this.userService.clearUserData();
    await this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  async refreshData(event?: any) {
    await this.refreshUserData();
    if (event) {
      event.target.complete();
    }
  }

  toggleBalance() {
    this.showBalance = !this.showBalance;
  }

  openPixTransfer() {
    this.router.navigateByUrl('/pix-transfer');
  }

  openAdmin() {
    this.router.navigateByUrl('/admin');
  }

  cadastrarChave() {
    this.router.navigateByUrl('/pix-register');
  }

  openStatement() {
    this.router.navigateByUrl('/statements');
  }

  changeBank(event: any) {
  }
}