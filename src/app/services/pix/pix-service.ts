import { Injectable } from '@angular/core';
import {
  doc,
  updateDoc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  arrayUnion,
  arrayRemove,
  Timestamp
} from "firebase/firestore";
import { FirebaseService } from '../firebase/firebase';
import { PixKey, PixTransfer, TransferResponse } from 'src/app/interfaces/pix.interface';

@Injectable({
  providedIn: 'root'
})
export class PixService {
  constructor(private firebase: FirebaseService) { }

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

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  async getPixKeys(): Promise<PixKey[]> {
    const user = this.getCurrentUser();
    if (!user || !user.id) return [];

    try {
      const db = this.firebase.getFirestore();
      const userDoc = doc(db, "usuarios", user.id);
      const userSnapshot = await getDoc(userDoc);

      if (userSnapshot.exists()) {
        const userData = userSnapshot.data();
        return userData?.['pixKeys'] || [];
      }
      return [];
    } catch (error) {
      console.error('Erro ao buscar chaves PIX:', error);
      return [];
    }
  }

  async checkKeyExists(key: string): Promise<boolean> {
    try {
      const db = this.firebase.getFirestore();
      if (!db || !key) return false;

      const keyDoc = doc(db, "pixKeys", key);
      const keySnapshot = await getDoc(keyDoc);
      if (keySnapshot.exists()) return true;

      const userPixKeys = await this.getPixKeys();
      if (userPixKeys?.some(pixKey => pixKey.key === key)) {
        return true;
      }

      const usersQuery = query(
        collection(db, "usuarios"),
        where("pixKeysArray", "array-contains", key)
      );

      const querySnapshot = await getDocs(usersQuery);
      return !querySnapshot.empty;

    } catch (error) {
      console.error('Erro ao verificar chave única:', error);
      return false;
    }
  }

  async addPixKey(pixKey: Omit<PixKey, 'id' | 'createdAt'>): Promise<{ success: boolean; message: string }> {
    const user = this.getCurrentUser();
    if (!user || !user.id) {
      return { success: false, message: 'Usuário não autenticado' };
    }

    if (!this.validatePixKey(pixKey.key, pixKey.type)) {
      return { success: false, message: 'Chave PIX inválida para o tipo selecionado' };
    }

    const keyExists = await this.checkKeyExists(pixKey.key);
    if (keyExists) {
      return { success: false, message: 'Esta chave PIX já está cadastrada no sistema' };
    }

    try {
      const db = this.firebase.getFirestore();
      const userDoc = doc(db, "usuarios", user.id);
      const currentKeys = await this.getPixKeys();

      const newPixKey: PixKey = {
        ...pixKey,
        id: this.generateId(),
        createdAt: new Date(),
        status: 'active'
      };

      const updatedKeys = [...currentKeys, newPixKey];

      await Promise.all([
        updateDoc(userDoc, {
          ['pixKeys']: updatedKeys,
          ['pixKeysArray']: arrayUnion(pixKey.key)
        }),
        setDoc(doc(db, "pixKeys", pixKey.key), {
          userId: user.id,
          userName: user.nome,
          userAccount: user.conta,
          type: pixKey.type,
          createdAt: Timestamp.now(),
          status: 'active'
        })
      ]);

      this.updateLocalStoragePixKeys(newPixKey, 'add');
      return { success: true, message: 'Chave PIX adicionada com sucesso!' };
    } catch (error) {
      console.error('Erro ao adicionar chave PIX:', error);
      return { success: false, message: 'Erro ao adicionar chave PIX' };
    }
  }

  private validatePixKey(key: string, type: string): boolean {
    switch (type) {
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key);
      case 'phone':
        return /^(\+55)?(\d{2})?9?\d{8}$/.test(key.replace(/\D/g, ''));
      case 'random':
        return key.length >= 10 && key.length <= 36;
      default:
        return false;
    }
  }

  async updatePixKey(keyId: string, updates: Partial<PixKey>): Promise<{ success: boolean; message: string }> {
    const user = this.getCurrentUser();
    if (!user || !user.id) {
      return { success: false, message: 'Usuário não autenticado' };
    }

    try {
      const db = this.firebase.getFirestore();
      const userDoc = doc(db, "usuarios", user.id);

      const currentKeys = await this.getPixKeys();
      const updatedKeys = currentKeys.map(key =>
        key.id === keyId ? { ...key, ...updates } : key
      );

      await updateDoc(userDoc, {
        ['pixKeys']: updatedKeys
      });

      this.updateLocalStoragePixKeys({ id: keyId, ...updates } as PixKey, 'update');

      return { success: true, message: 'Chave PIX atualizada com sucesso!' };
    } catch (error) {
      console.error('Erro ao atualizar chave PIX:', error);
      return { success: false, message: 'Erro ao atualizar chave PIX' };
    }
  }

  async deletePixKey(keyId: string): Promise<{ success: boolean; message: string }> {
    const user = this.getCurrentUser();
    if (!user || !user.id) {
      return { success: false, message: 'Usuário não autenticado' };
    }

    try {
      const db = this.firebase.getFirestore();
      const userDoc = doc(db, "usuarios", user.id);

      const currentKeys = await this.getPixKeys();
      const keyToDelete = currentKeys.find(key => key.id === keyId);
      if (!keyToDelete) {
        return { success: false, message: 'Chave PIX não encontrada' };
      }

      const filteredKeys = currentKeys.filter(key => key.id !== keyId);

      await Promise.all([
        updateDoc(userDoc, {
          ['pixKeys']: filteredKeys,
          ['pixKeysArray']: arrayRemove(keyToDelete.key)
        })
      ]);

      this.updateLocalStoragePixKeys({ id: keyId } as PixKey, 'delete');

      return { success: true, message: 'Chave PIX removida com sucesso!' };
    } catch (error) {
      console.error('Erro ao remover chave PIX:', error);
      return { success: false, message: 'Erro ao remover chave PIX' };
    }
  }

  private updateLocalStoragePixKeys(pixKey: PixKey, action: 'add' | 'update' | 'delete'): void {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (!user['pixKeys']) user['pixKeys'] = [];

        switch (action) {
          case 'add':
            user['pixKeys'].push(pixKey);
            break;
          case 'update':
            user['pixKeys'] = user['pixKeys'].map((key: PixKey) =>
              key.id === pixKey.id ? { ...key, ...pixKey } : key
            );
            break;
          case 'delete':
            user['pixKeys'] = user['pixKeys'].filter((key: PixKey) => key.id !== pixKey.id);
            break;
        }

        localStorage.setItem('user', JSON.stringify(user));
      } catch (error) {
        console.error('Erro ao atualizar localStorage:', error);
      }
    }
  }

  private async findUserByPixKey(pixKey: string): Promise<any> {
    try {
      const db = this.firebase.getFirestore();

      const pixKeyDoc = doc(db, "pixKeys", pixKey);
      const pixKeySnapshot = await getDoc(pixKeyDoc);

      if (pixKeySnapshot.exists()) {
        const pixKeyData = pixKeySnapshot.data();
        if (pixKeyData['status'] === 'inactive') return null;

        const userId = pixKeyData['userId'];
        const userDoc = doc(db, "usuarios", userId);
        const userSnapshot = await getDoc(userDoc);

        if (userSnapshot.exists()) {
          const userData = userSnapshot.data();
          // 🔥 NÃO deixar sobrescrever o id pelo campo interno
          const { id, ...rest } = userData as any;
          return {
            id: userSnapshot.id,
            ...rest,
            pixKeyType: pixKeyData['type']
          };
        }
      }

      const usersQuery = query(
        collection(db, "usuarios"),
        where("pixKeysArray", "array-contains", pixKey)
      );

      const querySnapshot = await getDocs(usersQuery);
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        const { id, ...rest } = userData as any;
        const userPixKeys = userData['pixKeys'] || [];
        const pixKeyInfo = userPixKeys.find((key: any) => key.key === pixKey);

        return {
          id: userDoc.id,
          ...rest,
          pixKeyType: pixKeyInfo?.type || 'unknown'
        };
      }

      return null;

    } catch (error) {
      console.error('Erro ao buscar usuário por chave PIX:', error);
      return null;
    }
  }

  async transferPix(transferData: {
    toPixKey: string;
    amount: number;
    description?: string;
  }): Promise<TransferResponse> {
    const user = this.getCurrentUser();
    if (!user || !user.id) {
      return { success: false, message: 'Usuário não autenticado' };
    }

    if (transferData.amount <= 0) {
      return { success: false, message: 'Valor deve ser maior que zero' };
    }

    if (user.balance < transferData.amount) {
      return { success: false, message: 'Saldo insuficiente' };
    }

    const keyExists = await this.checkKeyExists(transferData.toPixKey);
    if (!keyExists) {
      return { success: false, message: 'Chave PIX não encontrada' };
    }

    try {
      const db = this.firebase.getFirestore();
      const recipient = await this.findUserByPixKey(transferData.toPixKey);

      if (!recipient) {
        return { success: false, message: 'Destinatário não encontrado' };
      }
      if (recipient.id === user.id) {
        return { success: false, message: 'Não é possível transferir para si mesmo' };
      }
      if (recipient.status === 'inativo') {
        return { success: false, message: 'Conta destinatária inativa' };
      }

      const currentUserDoc = await getDoc(doc(db, "usuarios", user.id));
      const currentUserData = currentUserDoc.data();
      if (!currentUserData || currentUserData['balance'] < transferData.amount) {
        return { success: false, message: 'Saldo insuficiente' };
      }

      const transactionId = this.generateId();
      const now = Timestamp.now();

      const transaction: PixTransfer = {
        id: transactionId,
        fromUserId: user.id,
        fromUserName: user.nome,
        fromUserAccount: user.conta,
        toUserId: recipient.id,
        toUserName: recipient.nome,
        toUserAccount: recipient.conta,
        toPixKey: transferData.toPixKey,
        toPixKeyType: recipient.pixKeyType || 'unknown',
        amount: transferData.amount,
        description: transferData.description || `Transferência PIX para ${recipient.nome}`,
        status: 'completed',
        type: 'pix',
        createdAt: now,
        updatedAt: now
      };

      const batch = writeBatch(db);

      const senderDoc = doc(db, "usuarios", user.id);
      batch.update(senderDoc, {
        balance: currentUserData['balance'] - transferData.amount,
        updatedAt: now
      });

      const recipientDoc = doc(db, "usuarios", recipient.id);
      const recipientBalance = recipient.balance || 0;
      batch.update(recipientDoc, {
        balance: recipientBalance + transferData.amount,
        updatedAt: now
      });

      const transactionDoc = doc(db, "transactions", transactionId);
      batch.set(transactionDoc, transaction);

      batch.update(senderDoc, {
        transactions: arrayUnion({
          ...transaction,
          description: `Transferência para ${recipient.nome}`
        })
      });

      batch.update(recipientDoc, {
        transactions: arrayUnion({
          ...transaction,
          fromUserId: recipient.id,
          toUserId: user.id,
          amount: -transferData.amount,
          description: `Transferência de ${user.nome}`
        })
      });

      await batch.commit();
      this.updateLocalBalance(user.id, -transferData.amount);

      return {
        success: true,
        message: 'Transferência realizada com sucesso!',
        transactionId,
        newBalance: currentUserData['balance'] - transferData.amount
      };

    } catch (error) {
      console.error('Erro na transferência PIX:', error);
      return { success: false, message: 'Erro ao realizar transferência' };
    }
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

  async getTransactions(limit: number = 50): Promise<PixTransfer[]> {
    const user = this.getCurrentUser();
    if (!user || !user.id) return [];

    try {
      const db = this.firebase.getFirestore();
      const transactionsQuery = query(
        collection(db, "transactions"),
        where("fromUserId", "==", user.id)
      );

      const querySnapshot = await getDocs(transactionsQuery);
      const transactions: PixTransfer[] = [];
      querySnapshot.forEach(doc => {
        const data = doc.data();
        transactions.push({
          id: doc.id,
          fromUserId: data['fromUserId'],
          fromUserName: data['fromUserName'],
          fromUserAccount: data['fromUserAccount'],
          toUserId: data['toUserId'],
          toUserName: data['toUserName'],
          toUserAccount: data['toUserAccount'],
          toPixKey: data['toPixKey'],
          toPixKeyType: data['toPixKeyType'],
          amount: data['amount'],
          description: data['description'],
          status: data['status'],
          type: data['type'],
          createdAt: data['createdAt']?.toDate(),
          updatedAt: data['updatedAt']?.toDate()
        });
      });

      return transactions.sort((a, b) =>
        (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
      ).slice(0, limit);

    } catch (error) {
      console.error('Erro ao buscar transações:', error);
      return [];
    }
  }

  async validatePixTransfer(amount: number, pixKey: string): Promise<{
    isValid: boolean;
    message: string;
    recipient?: any;
  }> {
    const user = this.getCurrentUser();
    if (!user) {
      return { isValid: false, message: 'Usuário não autenticado' };
    }

    if (amount <= 0) {
      return { isValid: false, message: 'Valor deve ser maior que zero' };
    }

    if (user.balance < amount) {
      return { isValid: false, message: 'Saldo insuficiente' };
    }

    const recipient = await this.findUserByPixKey(pixKey);
    if (!recipient) {
      return { isValid: false, message: 'Chave PIX não encontrada' };
    }

    if (recipient.id === user.id) {
      return { isValid: false, message: 'Não é possível transferir para si mesmo' };
    }

    return {
      isValid: true,
      message: 'Transferência válida',
      recipient: {
        name: recipient.nome,
        type: recipient.pixKeyType
      }
    };
  }

  async getAllPixKeys(): Promise<PixKey[]> {
    try {
      const db = this.firebase.getFirestore();
      const pixKeysCollection = collection(db, "pixKeys");
      const querySnapshot = await getDocs(pixKeysCollection);

      const keys: PixKey[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();

        let createdAt: Date | undefined;
        if (data['createdAt']) {
          if (typeof data['createdAt'].toDate === 'function') {
            createdAt = data['createdAt'].toDate();
          } else {
            createdAt = new Date(data['createdAt']);
          }
        }

        keys.push({
          id: docSnap.id,
          key: docSnap.id, 
          type: data['type'],
          status: data['status'],
          createdAt,
          userId: data['userId'],
          userName: data['userName'],
          userAccount: data['userAccount'],
          isActive: data['status'] === 'active'
        } as PixKey);

      });

      return keys;
    } catch (error) {
      console.error("Erro ao listar todas as chaves PIX:", error);
      return [];
    }
  }


}
