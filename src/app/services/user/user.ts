import { Injectable } from '@angular/core';
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { FirebaseService } from '../firebase/firebase';
import { BehaviorSubject } from 'rxjs';
import { User } from 'src/app/interfaces/pix.interface';
import { AuthService } from '../authService/auth-service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private firebase: FirebaseService,
    private authService: AuthService
  ) {
    // Initialize with stored user data from AuthService
    const storedUser = this.authService.getCurrentUser();
    if (storedUser) {
      this.currentUserSubject.next(storedUser);
    }
  }

  // Get user from AuthService (which uses localStorage)
  getCurrentUser(): User | null {
    return this.authService.getCurrentUser();
  }

  // Get current user UID
  private getCurrentUserId(): string | null {
    const user = this.getCurrentUser();
    return user?.id || null;
  }

  // Fetch fresh user data from Firestore
  async fetchCurrentUserFromFirebase(): Promise<User | null> {
    try {
      const userId = this.getCurrentUserId();
      
      if (!userId) {
        console.warn('No user ID available for fetching');
        return null;
      }

      const userDocRef = doc(this.firebase.getFirestore(), 'usuarios', userId);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        const updatedUser: User = {
          ...userData,
          id: userDoc.id,
          conta: userData['conta'],
          senha: userData['senha'],
          pixKeys: userData['pixKeys'] || [],
          tipo: userData['tipo'] || 'cliente',
          status: userData['status'] || 'ativo',
          balance: userData['balance'] || 0,
          nome: userData['nome'] || 'Usuário'
        };

        // Update localStorage via AuthService (or directly)
        localStorage.setItem('user', JSON.stringify(updatedUser));
        this.currentUserSubject.next(updatedUser);
        
        return updatedUser;
      } else {
        console.error('User document not found in Firestore for ID:', userId);
        return null;
      }
    } catch (error) {
      console.error('Error fetching user from Firebase:', error);
      return null;
    }
  }

  // Real-time listener for user data changes
  setupUserListener(): () => void {
    const userId = this.getCurrentUserId();
    
    if (!userId) {
      console.warn('Cannot setup listener: no user ID available');
      return () => {};
    }

    const userDocRef = doc(this.firebase.getFirestore(), 'usuarios', userId);
    
    const unsubscribe = onSnapshot(userDocRef, 
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data();
          
          const updatedUser: User = {
            ...userData,
            id: docSnapshot.id,
            conta: userData['conta'],
            senha: userData['senha'],
            pixKeys: userData['pixKeys'] || [],
            tipo: userData['tipo'] || 'cliente',
            status: userData['status'] || 'ativo',
            balance: userData['balance'] || 0,
            nome: userData['nome'] || 'Usuário'
          };

          localStorage.setItem('user', JSON.stringify(updatedUser));
          this.currentUserSubject.next(updatedUser);
        }
      },
      (error) => {
        console.error('Error in user listener:', error);
      }
    );

    return unsubscribe;
  }

  // Clear user data (for logout)
  clearUserData(): void {
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
  }

  // Update user balance locally (for immediate UI updates)
  updateLocalBalance(newBalance: number): void {
    const currentUser = this.getCurrentUser();
    if (currentUser) {
      const updatedUser: User = {
        ...currentUser,
        balance: newBalance
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      this.currentUserSubject.next(updatedUser);
    }
  }
}