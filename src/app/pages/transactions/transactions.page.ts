import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { Transacao, User } from 'src/app/interfaces/pix.interface';
import { TransactionService } from 'src/app/services/transactions/transactions';
import { UserService } from 'src/app/services/user/user';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-transactions',
  templateUrl: './transactions.page.html',
  styleUrls: ['./transactions.page.scss'],
  imports: [IonicModule, CommonModule],
  standalone: true
})
export class TransactionsPage implements OnInit, OnDestroy {

  transacoes: Transacao[] = [];
  transacoesFiltradas: Transacao[] = [];
  isLoading = true;
  filtro = 'todos';
  limite = 20;
  currentUser: User | null = null;

  private userSubscription: Subscription | null = null;

  constructor(
    private modalCtrl: ModalController,
    public transactionService: TransactionService,
    private userService: UserService
  ) { }

  async ngOnInit() {
    await this.initializeUserData();
    await this.carregarExtrato();
    this.setupUserListener();
  }

  ngOnDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  private async initializeUserData() {
    // Primeiro tenta pegar do localStorage
    this.currentUser = this.userService.getCurrentUser();
    
    // Se não tiver usuário, tenta buscar do Firebase
    if (!this.currentUser) {
      this.currentUser = await this.userService.fetchCurrentUserFromFirebase();
    }

    if (!this.currentUser) {
      console.error('Usuário não autenticado');
      this.fechar();
      return;
    }
  }

  private setupUserListener() {
    this.userSubscription = this.userService.currentUser$.subscribe({
      next: (user) => {
        if (user) {
          this.currentUser = user;
          // Quando o usuário é atualizado, reaplica os filtros
          this.aplicarFiltro();
        }
      },
      error: (error) => {
        console.error('Error in user subscription:', error);
      }
    });
  }

  async carregarExtrato(event?: any) {
    this.isLoading = true;
    
    try {
      // Primeiro atualiza os dados do usuário
      await this.userService.fetchCurrentUserFromFirebase();
      
      // Depois carrega o extrato
      this.transacoes = await this.transactionService.getExtrato(this.limite);
      this.aplicarFiltro();
      
    } catch (error) {
      console.error('Erro ao carregar extrato:', error);
    } finally {
      this.isLoading = false;

      if (event) {
        event.target.complete();
      }
    }
  }

  async carregarMais(event: any) {
    this.limite += 10;
    await this.carregarExtrato(event);
  }

  alterarFiltro(event: any) {
    this.filtro = event.detail.value;
    this.aplicarFiltro();
  }

  aplicarFiltro() {
    if (!this.currentUser) return;

    switch (this.filtro) {
      case 'entrada':
        this.transacoesFiltradas = this.transacoes.filter(t =>
          t.toUserId === this.currentUser!.id && t.amount > 0
        );
        break;
      case 'saida':
        this.transacoesFiltradas = this.transacoes.filter(t =>
          t.fromUserId === this.currentUser!.id || t.amount < 0
        );
        break;
      case 'taxa':
        this.transacoesFiltradas = this.transacoes.filter(t =>
          t.type === 'taxa'
        );
        break;
      default:
        this.transacoesFiltradas = this.transacoes;
    }
  }

  formatarValor(transacao: Transacao): { valor: string, cor: string } {
    if (!this.currentUser) {
      return { valor: 'R$ 0,00', cor: 'medium' };
    }

    const isEntrada = transacao.toUserId === this.currentUser.id;
    const valor = Math.abs(transacao.amount);
    const sinal = isEntrada ? '+' : '-';
    
    return {
      valor: `${sinal} R$ ${valor.toFixed(2)}`,
      cor: isEntrada ? 'success' : 'danger'
    };
  }

  getCorStatus(status: string): string {
    const cores: { [key: string]: string } = {
      'completed': 'success',
      'pending': 'warning',
      'failed': 'danger',
      'refunded': 'medium',
      'processed': 'success',
      'processing': 'warning'
    };
    return cores[status.toLowerCase()] || 'medium';
  }

  getIconeTipo(tipo: string): string {
    const icones: { [key: string]: string } = {
      'pix': 'cash-outline',
      'transfer': 'swap-horizontal-outline',
      'taxa': 'alert-circle-outline',
      'payment': 'card-outline',
      'deposit': 'add-circle-outline',
      'withdraw': 'remove-circle-outline'
    };
    return icones[tipo.toLowerCase()] || 'help-circle-outline';
  }

  formatarData(data: any): string {
    if (data?.toDate) {
      return data.toDate().toLocaleDateString('pt-BR');
    }
    
    if (data instanceof Date) {
      return data.toLocaleDateString('pt-BR');
    }
    
    if (typeof data === 'string') {
      return new Date(data).toLocaleDateString('pt-BR');
    }
    
    return 'Data inválida';
  }

  fechar() {
    this.modalCtrl.dismiss();
  }

  async atualizarDados() {
    await this.userService.fetchCurrentUserFromFirebase();
    await this.carregarExtrato();
  }
}