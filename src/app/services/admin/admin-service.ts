// services/admin.service.ts
import { Injectable } from '@angular/core';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  writeBatch,
  arrayUnion,
  getFirestore
} from "firebase/firestore";
import { FirebaseService } from '../firebase/firebase';
import { User, Taxa } from 'src/app/interfaces/pix.interface';
import { AuthService } from '../authService/auth-service';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  constructor(private firebase: FirebaseService, private authService: AuthService) { }

  private getCurrentUser(): any {
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

  private isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.tipo === 'admin';
  }

  async criarNovaConta(userData: {
    nome: string;
    conta: string;
    senha: string;
    balance?: number;
    tipo?: 'cliente' | 'admin';
  }): Promise<{ success: boolean; message: string; userId?: string }> {

    if (!this.isAdmin()) {
      return { success: false, message: 'Acesso não autorizado' };
    }

    try {
      const db = this.firebase.getFirestore();

      const usersQuery = query(
        collection(db, "usuarios"),
        where("conta", "==", userData.conta)
      );

      const querySnapshot = await getDocs(usersQuery);
      if (!querySnapshot.empty) {
        return { success: false, message: 'Número de conta já existe' };
      }

      const novoUsuario: User = {
        ...userData,
        id: this.generateId(),
        balance: userData.balance || 0,
        tipo: userData.tipo || 'cliente',
        status: 'ativo',
        pixKeys: [],
        transactions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        taxas: []
      };

      const docRef = await addDoc(collection(db, "usuarios"), novoUsuario);

      return {
        success: true,
        message: 'Conta criada com sucesso!',
        userId: docRef.id
      };

    } catch (error) {
      console.error('Erro ao criar conta:', error);
      return { success: false, message: 'Erro ao criar conta' };
    }
  }

  async listarUsuarios(): Promise<User[]> {
    try {
      const db = getFirestore();
      const usersCollection = collection(db, 'usuarios');
      const snapshot = await getDocs(usersCollection);

      const usuarios: User[] = [];
      snapshot.forEach((doc) => {
        usuarios.push({
          ...doc.data() as User,
          firestoreId: doc.id
        });
      });

      return usuarios;
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      throw error;
    }
  }

  async aplicarTaxa(userId: string, taxaData: {
    tipo: 'multa' | 'taxa' | 'anuidade';
    descricao: string;
    valor: number;
    dataVencimento?: Date;
  }): Promise<{ success: boolean; message: string }> {

    if (!this.isAdmin()) {
      return { success: false, message: 'Acesso não autorizado' };
    }

    const admin = this.authService.getCurrentUser();
    if (!admin || !admin.id) {
      return { success: false, message: 'Admin não autenticado' };
    }

    // Impede aplicar taxa em si mesmo
    if (admin.id === userId) {
      return { success: false, message: 'Não é possível aplicar taxa em si mesmo' };
    }

    try {
      const db = this.firebase.getFirestore();
      const batch = writeBatch(db);

      // 1. Buscar dados do usuário
      const userDoc = doc(db, "usuarios", userId);
      const userSnapshot = await getDoc(userDoc);

      if (!userSnapshot.exists()) {
        return { success: false, message: 'Usuário não encontrado' };
      }

      const userData = userSnapshot.data() as User;

      // 2. Verificar se usuário tem saldo suficiente
      if (userData.balance < taxaData.valor) {
        return { success: false, message: 'Saldo insuficiente do usuário para pagar a taxa' };
      }

      // 3. Debitar do usuário
      const novoSaldoUsuario = userData.balance - taxaData.valor;
      batch.update(userDoc, {
        balance: novoSaldoUsuario,
        updatedAt: new Date()
      });

      // 4. Creditar no admin
      const adminDoc = doc(db, "usuarios", admin.id);
      const novoSaldoAdmin = (admin.balance || 0) + taxaData.valor;
      batch.update(adminDoc, {
        balance: novoSaldoAdmin,
        updatedAt: new Date()
      });

      const novaTaxa: Taxa = {
        id: this.generateId(),
        ...taxaData,
        dataAplicacao: new Date(),
        status: 'paga', 
        userId
      };

      const taxas = userData.taxas || [];
      batch.update(userDoc, {
        taxas: [...taxas, novaTaxa]
      });

      // 6. Registrar transação para histórico
      const transactionId = this.generateId();
      const transaction = {
        id: transactionId,
        type: 'taxa',
        fromUserId: userId,
        fromUserName: userData.nome,
        toUserId: admin.id,
        toUserName: admin.nome,
        amount: taxaData.valor,
        description: `Taxa: ${taxaData.descricao}`,
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const transactionDoc = doc(db, "transactions", transactionId);
      batch.set(transactionDoc, transaction);

      // 7. Adicionar às transações dos usuários
      const userTransactionRef = {
        id: transactionId,
        type: 'taxa_out',
        fromUserId: userId,
        fromUserName: userData.nome,
        toUserId: admin.id,
        toUserName: admin.nome,
        amount: -taxaData.valor,
        description: `Taxa: ${taxaData.descricao}`,
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const adminTransactionRef = {
        id: transactionId,
        type: 'taxa_in',
        fromUserId: userId,
        fromUserName: userData.nome,
        toUserId: admin.id,
        toUserName: admin.nome,
        amount: taxaData.valor,
        description: `Taxa recebida de ${userData.nome}: ${taxaData.descricao}`,
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      batch.update(userDoc, {
        transactions: arrayUnion(userTransactionRef)
      });

      batch.update(adminDoc, {
        transactions: arrayUnion(adminTransactionRef)
      });

      await batch.commit();

      this.updateLocalBalance(admin.id, taxaData.valor);

      return {
        success: true,
        message: `Taxa de R$ ${taxaData.valor.toFixed(2)} aplicada e debitada com sucesso!`
      };

    } catch (error) {
      console.error('Erro ao aplicar taxa:', error);
      return { success: false, message: 'Erro ao aplicar taxa' };
    }
  }

  async transferirSaldo(userId: string, valor: number, descricao?: string): Promise<{ success: boolean; message: string }> {
    const admin = this.authService.getCurrentUser();
    if (!admin || !admin.id) {
      return { success: false, message: 'Admin não autenticado' };
    }

    try {
      const db = this.firebase.getFirestore();
      const usersSnapshot = await getDocs(collection(db, "usuarios"));

    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    }

    if (admin.id === userId) {
      return { success: false, message: 'Não é possível transferir para sua própria conta' };
    }

    if (valor <= 0) {
      return { success: false, message: 'Valor deve ser maior que zero' };
    }

    if (admin.balance < valor) {
      return { success: false, message: 'Saldo insuficiente do administrador' };
    }

    try {
      const db = this.firebase.getFirestore();
      const batch = writeBatch(db);

      const adminDoc = doc(db, "usuarios", admin.id);
      batch.update(adminDoc, {
        balance: admin.balance - valor,
        updatedAt: new Date()
      });

      const userDoc = doc(db, "usuarios", userId);
      const userSnapshot = await getDoc(userDoc);

      if (!userSnapshot.exists()) {
        return { success: false, message: 'Usuário não encontrado' };
      }

      const userData = userSnapshot.data() as User;
      const novoSaldoUsuario = (userData.balance || 0) + valor;

      batch.update(userDoc, {
        balance: novoSaldoUsuario,
        updatedAt: new Date()
      });

      // 3. Registra a transação
      const transactionId = this.generateId();
      const transaction = {
        id: transactionId,
        type: 'admin_transfer',
        fromUserId: admin.id,
        fromUserName: admin.nome,
        toUserId: userId,
        toUserName: userData.nome,
        amount: valor,
        description: descricao || 'Transferência administrativa',
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const transactionDoc = doc(db, "transactions", transactionId);
      batch.set(transactionDoc, transaction);

      const adminTransactionRef = {
        id: transactionId,
        type: 'admin_transfer_out',
        fromUserId: admin.id,
        fromUserName: admin.nome,
        toUserId: userId,
        toUserName: userData.nome,
        amount: -valor,
        description: `Transferência para ${userData.nome}`,
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const userTransactionRef = {
        id: transactionId,
        type: 'admin_transfer_in',
        fromUserId: admin.id,
        fromUserName: admin.nome,
        toUserId: userId,
        toUserName: userData.nome,
        amount: valor,
        description: descricao || 'Transferência recebida',
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      batch.update(adminDoc, {
        transactions: arrayUnion(adminTransactionRef)
      });

      batch.update(userDoc, {
        transactions: arrayUnion(userTransactionRef)
      });

      await batch.commit();

      this.updateLocalBalance(admin.id, -valor);

      return {
        success: true,
        message: `Transferência de R$ ${valor.toFixed(2)} realizada com sucesso!`
      };

    } catch (error) {
      console.error('Erro na transferência administrativa:', error);
      return { success: false, message: 'Erro ao realizar transferência' };
    }
  }

  async bloquearUsuario(userId: string): Promise<{ success: boolean; message: string }> {
    return this.alterarStatusUsuario(userId, 'bloqueado');
  }

  async ativarUsuario(userId: string): Promise<{ success: boolean; message: string }> {
    return this.alterarStatusUsuario(userId, 'ativo');
  }

  private async alterarStatusUsuario(userId: string, status: 'ativo' | 'bloqueado' | 'suspenso'): Promise<{ success: boolean; message: string }> {

    if (!this.isAdmin()) {
      return { success: false, message: 'Acesso não autorizado' };
    }

    try {
      const db = this.firebase.getFirestore();
      const userDoc = doc(db, "usuarios", userId);

      await updateDoc(userDoc, {
        status,
        updatedAt: new Date()
      });

      return { success: true, message: `Usuário ${status} com sucesso!` };

    } catch (error) {
      console.error('Erro ao alterar status:', error);
      return { success: false, message: 'Erro ao alterar status' };
    }
  }

  async ajustarSaldo(userId: string, novoSaldo: number): Promise<{ success: boolean; message: string }> {

    if (!this.isAdmin()) {
      return { success: false, message: 'Acesso não autorizado' };
    }

    try {
      const db = this.firebase.getFirestore();
      const userDoc = doc(db, "usuarios", userId);

      await updateDoc(userDoc, {
        balance: novoSaldo,
        updatedAt: new Date()
      });

      return { success: true, message: 'Saldo ajustado com sucesso!' };

    } catch (error) {
      console.error('Erro ao ajustar saldo:', error);
      return { success: false, message: 'Erro ao ajustar saldo' };
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }


  private updateLocalBalance(userId: string, amount: number): void {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.id === userId) {
          user.balance = (user.balance || 0) + amount;
          localStorage.setItem('user', JSON.stringify(user));
        }
      } catch (error) {
        console.error('Erro ao atualizar saldo local:', error);
      }
    }
  }
}