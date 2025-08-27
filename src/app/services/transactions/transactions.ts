// services/transactions/transactions.service.ts
import { Injectable } from '@angular/core';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getFirestore,
  doc,
  getDoc
} from 'firebase/firestore';
import { Transacao } from '../../interfaces/pix.interface';
import { AuthService } from '../authService/auth-service';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {

  constructor(private authService: AuthService) { }

  async getExtrato(limite: number = 20): Promise<Transacao[]> {
    const currentUser = this.authService.getCurrentUser();

    if (!currentUser || !currentUser.id) {
      console.error('Usuário não autenticado');
      return [];
    }

    const userId = currentUser.id;

    try {
      // Buscar transações da coleção transactions
      const transacoesTransactions = await this.getTransactionsFromCollection(userId);
      
      // Buscar taxas do array taxas do usuário
      const taxasDoUsuario = await this.getTaxasFromUser(userId);
      
      // Combinar e ordenar todos os registros
      const todasTransacoes = [...transacoesTransactions, ...taxasDoUsuario];
      
      return todasTransacoes
        .sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt : a.createdAt?.toDate?.();
          const dateB = b.createdAt instanceof Date ? b.createdAt : b.createdAt?.toDate?.();
          return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
        })
        .slice(0, limite);

    } catch (error) {
      console.error('Erro ao buscar extrato:', error);
      return [];
    }
  }

  private async getTransactionsFromCollection(userId: string): Promise<Transacao[]> {
    const db = getFirestore();

    const transactionsQuery = query(
      collection(db, 'transactions'),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(transactionsQuery);

    const transacoes: Transacao[] = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      
      // Converter para o formato Transacao
      const transacao: Transacao = {
        id: doc.id,
        type: this.mapTransactionType(data['type']),
        fromUserId: data['fromUserId'],
        fromUserName: data['fromUserName'],
        toUserId: data['toUserId'],
        toUserName: data['toUserName'],
        amount: data['amount'],
        description: data['description'],
        status: data['status'],
        createdAt: data['createdAt']?.toDate?.(),
        updatedAt: data['updatedAt']?.toDate?.()
      };

      if (transacao.fromUserId === userId || transacao.toUserId === userId) {
        transacoes.push(transacao);
      }
    });

    return transacoes;
  }

  private async getTaxasFromUser(userId: string): Promise<Transacao[]> {
    const db = getFirestore();
    
    try {
      // Buscar o documento do usuário
      const userDocRef = doc(db, 'usuarios', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        return [];
      }
      
      const userData = userDoc.data();
      const taxas = userData['taxas'] || [];
      
      // Converter taxas para o formato Transacao
      return taxas.map((taxa: any) => ({
        id: taxa.id,
        type: 'taxa' as const,
        fromUserId: userId,
        fromUserName: userData['nome'] || 'Usuário',
        toUserId: 'sistema',
        toUserName: 'Sistema',
        amount: -taxa.valor, // Valor negativo para taxas
        description: `Taxa: ${taxa.descricao}`,
        status: taxa.status === 'paga' ? 'completed' : 'pending',
        createdAt: taxa.dataAplicacao?.toDate?.(),
        updatedAt: taxa.dataAplicacao?.toDate?.(),
        taxaType: this.mapTaxaType(taxa.tipo)
      } as Transacao));
      
    } catch (error) {
      console.error('Erro ao buscar taxas do usuário:', error);
      return [];
    }
  }

  private mapTransactionType(type: string): Transacao['type'] {
    const typeMap: { [key: string]: Transacao['type'] } = {
      'transfer': 'transfer',
      'admin_transfer': 'admin_transfer',
      'admin_transfer_in': 'admin_transfer',
      'admin_transfer_out': 'admin_transfer',
      'taxa_out': 'taxa',
      'received': 'received',
      'payment': 'payment',
      'pix': 'transfer',
      'ted': 'transfer',
      'doc': 'transfer'
    };
    
    return typeMap[type] || 'transfer';
  }

  private mapTaxaType(tipo: string): 'multa' | 'taxa' | 'anuidade' {
    const tipoMap: { [key: string]: 'multa' | 'taxa' | 'anuidade' } = {
      'multa': 'multa',
      'taxa': 'taxa',
      'anuidade': 'anuidade',
      'fee': 'taxa',
      'fine': 'multa',
      'membership': 'anuidade'
    };
    
    return tipoMap[tipo] || 'taxa';
  }

  // Métodos auxiliares
  filtrarPorTipo(transacoes: Transacao[], tipo: string): Transacao[] {
    if (!tipo || tipo === 'todos') return transacoes;
    
    if (tipo === 'taxa') {
      return transacoes.filter(t => t.type === 'taxa');
    }
    
    return transacoes.filter(t => t.type === tipo);
  }

  formatarValor(transacao: Transacao, userId: string): { valor: string, cor: string } {
    const isEntrada = transacao.toUserId === userId;
    const isTaxa = transacao.type === 'taxa';
    const valor = Math.abs(transacao.amount);
    
    let sinal = '+';
    let cor = 'success';
    
    if (isTaxa || (!isEntrada && transacao.fromUserId === userId)) {
      sinal = '-';
      cor = 'danger';
    }

    return {
      valor: `${sinal} R$ ${valor.toFixed(2)}`,
      cor: cor
    };
  }

  getIconePorTipo(tipo: string): string {
    const icones: { [key: string]: string } = {
      'transfer': 'swap-horizontal',
      'admin_transfer': 'business',
      'taxa': 'cash',
      'received': 'download',
      'payment': 'card'
    };
    return icones[tipo] || 'receipt';
  }

  getCorStatus(status: string): string {
    const cores: { [key: string]: string } = {
      'completed': 'success',
      'pending': 'warning',
      'failed': 'danger',
      'refunded': 'medium',
      'paga': 'success',
      'pendente': 'warning'
    };
    return cores[status] || 'medium';
  }

  getDescricaoTaxa(taxaType?: 'multa' | 'taxa' | 'anuidade' | undefined): string {
    const descricoes: { [key: string]: string } = {
      'multa': 'Multa',
      'taxa': 'Taxa',
      'anuidade': 'Anuidade'
    };
    return taxaType ? descricoes[taxaType] : 'Taxa';
  }
}