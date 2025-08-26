// services/auth.service.ts
import { Injectable } from '@angular/core';
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { FirebaseService } from '../firebase/firebase';
import { FirestoreUser, User } from 'src/app/interfaces/pix.interface';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(
    private firebase: FirebaseService,
    private router: Router
  ) { }

  private isFirestoreUser(data: any): data is FirestoreUser {
    return data && typeof data.conta === 'string' && typeof data.senha === 'string';
  }

  async login(conta: string, senha: string): Promise<any> {
    try {
      const db = this.firebase.getFirestore();

      const q = query(
        collection(db, "usuarios"),
        where("conta", "==", conta),
        where("senha", "==", senha)
      );

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        if (!this.isFirestoreUser(userData)) {
          return { success: false, message: 'Dados do usuário inválidos' };
        }

        const userDocRef = doc(db, "usuarios", userDoc.id);
        const userSnapshot = await getDoc(userDocRef);
        const completeUserData = userSnapshot.data();

        const userWithPix: User = {
          ...userData,
          id: userDoc.id,
          pixKeys: completeUserData?.['pixKeys'] || [],
          tipo: userData['tipo'] || 'cliente',
          status: userData['status'] || 'ativo'
          ,
          balance: userData['balance'] || 0
        };

        localStorage.setItem('user', JSON.stringify(userWithPix));
        this.router.navigate(['/home']);

        return { success: true, user: userWithPix };
      } else {
        return { success: false, message: 'Usuário ou senha inválidos' };
      }
    } catch (error) {
      console.error('Erro ao acessar Firestore', error);
      return { success: false, message: 'Erro no servidor' };
    }
  }

  logout(): void {
    localStorage.removeItem('user');
    this.router.navigate(['/login']);
  }

  getCurrentUser(): User | null {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        return JSON.parse(userData);
      } catch (error) {
        console.error('Erro ao parsear user data:', error);
        return null;
      }
    }
    return null;
  }

  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  }

  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.tipo === 'admin';
  }

  hasPermission(requiredType: 'admin' | 'cliente'): boolean {
    const user = this.getCurrentUser();
    return user?.tipo === requiredType;
  }

  getUserStatus(): string {
    const user = this.getCurrentUser();
    return user?.status || 'inativo';
  }

  // Verifica se o usuário está ativo e autenticado
  canActivate(): boolean {
    const user = this.getCurrentUser();
    return !!user && user.status === 'ativo';
  }
}