// services/transactions/transactions.service.ts
import { Injectable } from '@angular/core';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getFirestore
} from 'firebase/firestore';
import { Transacao } from '../../interfaces/pix.interface';
import { AuthService } from '../authService/auth-service';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {

  constructor(private authService: AuthService) { }

  // services/transactions/transactions.service.ts - Método getExtrato modificado
  async getExtrato(limite: number = 20): Promise<Transacao[]> {
    const currentUser = this.authService.getCurrentUser();

    if (!currentUser || !currentUser.id) {
      console.error('Usuário não autenticado');
      return [];
    }

    const userId = currentUser.id;

    try {
      const db = getFirestore();

      // Busca TODAS as transações e filtra localmente (menos eficiente, mas funciona sem índice)
      const transactionsQuery = query(
        collection(db, 'transactions'),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(transactionsQuery);

      const transacoes: Transacao[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        const transacao = {
          id: doc.id,
          ...data,
          createdAt: data['createdAt']?.toDate?.(),
          updatedAt: data['updatedAt']?.toDate?.()
        } as Transacao;

        // Filtra localmente as transações do usuário
        if (transacao.fromUserId === userId || transacao.toUserId === userId) {
          transacoes.push(transacao);
        }
      });

      // Ordena por data (mais recente primeiro) e aplica limite
      return transacoes
        .sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt : a.createdAt?.toDate?.();
          const dateB = b.createdAt instanceof Date ? b.createdAt : b.createdAt?.toDate?.();
          return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
        })
        .slice(0, limite);

    } catch (error) {
      console.error('Erro ao buscar extrato:', error);

      // Fallback: busca sem ordenação para evitar erro de índice
      try {
        return await this.getExtratoFallback(userId, limite);
      } catch (fallbackError) {
        console.error('Erro no fallback:', fallbackError);
        return [];
      }
    }
  }

  // Método fallback sem ordenação
  private async getExtratoFallback(userId: string, limite: number): Promise<Transacao[]> {
    const db = getFirestore();

    const transactionsQuery = query(
      collection(db, 'transactions'),
      where('toUserId', '==', userId)
    );

    const sentQuery = query(
      collection(db, 'transactions'),
      where('fromUserId', '==', userId)
    );

    const [receivedSnapshot, sentSnapshot] = await Promise.all([
      getDocs(transactionsQuery),
      getDocs(sentQuery)
    ]);

    const transacoes: Transacao[] = [];

    // Processa transações recebidas
    receivedSnapshot.forEach(doc => {
      const data = doc.data();
      transacoes.push({
        id: doc.id,
        ...data,
        createdAt: data['createdAt']?.toDate?.(),
        updatedAt: data['updatedAt']?.toDate?.()
      } as Transacao);
    });

    // Processa transações enviadas
    sentSnapshot.forEach(doc => {
      const data = doc.data();
      transacoes.push({
        id: doc.id,
        ...data,
        createdAt: data['createdAt']?.toDate?.(),
        updatedAt: data['updatedAt']?.toDate?.()
      } as Transacao);
    });

    // Ordena localmente por data
    return transacoes
      .sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : a.createdAt?.toDate?.();
        const dateB = b.createdAt instanceof Date ? b.createdAt : b.createdAt?.toDate?.();
        return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
      })
      .slice(0, limite);
  }

  filtrarPorTipo(transacoes: Transacao[], tipo: string): Transacao[] {
    if (!tipo || tipo === 'todos') return transacoes;
    return transacoes.filter(t => t.type === tipo);
  }

  formatarValor(transacao: Transacao, userId: string): { valor: string, cor: string } {
    const isEntrada = transacao.toUserId === userId;
    const valor = Math.abs(transacao.amount);
    const sinal = isEntrada ? '+' : '-';

    return {
      valor: `${sinal} R$ ${valor.toFixed(2)}`,
      cor: isEntrada ? 'success' : 'danger'
    };
  }

  getIconePorTipo(tipo: string): string {
    const icones: { [key: string]: string } = {
      'transfer': 'swap-horizontal',
      'admin_transfer': 'business',
      'taxa': 'cash',
      'received': 'download',
      'payment': 'card',
      'pix': 'flash',
      'ted': 'business',
      'doc': 'document'
    };
    return icones[tipo] || 'receipt';
  }

  getCorStatus(status: string): string {
    const cores: { [key: string]: string } = {
      'completed': 'success',
      'pending': 'warning',
      'failed': 'danger',
      'refunded': 'medium',
      'approved': 'success',
      'rejected': 'danger'
    };
    return cores[status] || 'medium';
  }
}