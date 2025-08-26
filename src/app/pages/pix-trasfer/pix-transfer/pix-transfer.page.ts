// pix-transfer.page.ts
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import {
  AlertController,
  IonicModule,
  NavController,
  LoadingController,
  ModalController
} from '@ionic/angular'; import { CommonModule } from '@angular/common';
import { PixService } from 'src/app/services/pix/pix-service';
import { UserService } from 'src/app/services/user/user';
import { ComprovantePage } from '../../comprovante/comprovante.page';

@Component({
  selector: 'app-pix-transfer',
  templateUrl: './pix-transfer.page.html',
  styleUrls: ['./pix-transfer.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule
  ],
})
export class PixTransferPage implements OnInit {
  private fb = inject(FormBuilder);
  private pixService = inject(PixService);
  private alertController = inject(AlertController);
  private navCtrl = inject(NavController);
  private loadingController = inject(LoadingController);
  private userService = inject(UserService);
  private modalCtrl = inject(ModalController);


  contatos: any[] = [];
  carregandoContatos = false;
  transferForm: FormGroup;
  isLoading = false;
  userBalance: number = 0;

  constructor() {
    this.transferForm = this.createForm();
  }

  ngOnInit() {
    this.loadUserBalance();
    this.loadContatos();
  }

  private async loadContatos() {
    this.carregandoContatos = true;
    try {
      const allPixKeys = await this.pixService.getAllPixKeys();

      // pega usuário logado
      const currentUser = await this.userService.fetchCurrentUserFromFirebase();
      const currentUserId = currentUser?.id;

      const nomesUnicos = new Set<string>();

      this.contatos = allPixKeys
        // 🔥 exclui chaves do próprio usuário
        .filter(key => key.userId !== currentUserId)
        // 🔥 remove duplicados por nome
        .filter(key => {
          const nome = key.userName || 'Sem Nome';
          if (nomesUnicos.has(nome)) {
            return false;
          }
          nomesUnicos.add(nome);
          return true;
        })
        .map((key, index) => ({
          nome: key.userName || 'Sem Nome',
          chave: key.key,
          tipo: key.type,
          cor: this.getRandomColor(index)
        }));

    } catch (error) {
      console.error("Erro ao carregar contatos:", error);
    } finally {
      this.carregandoContatos = false;
    }
  }



  selecionarContato(contato: any) {
    this.transferForm.get('pixKey')?.setValue(contato.chave);
  }

  private getRandomColor(index: number): string {
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#E91E63'];
    return colors[index % colors.length];
  }

  private createForm(): FormGroup {
    return this.fb.group({
      pixKey: ['', [Validators.required, Validators.minLength(3)]],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      description: ['']
    });
  }

  private async loadUserBalance() {
    try {
      const freshUser = await this.userService.fetchCurrentUserFromFirebase();
      if (freshUser) {
        this.userBalance = freshUser.balance || 0;
      } else {
        const userData = localStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          this.userBalance = user.balance || 0;
        }
      }
    } catch (error) {
      console.error('Erro ao carregar saldo:', error);
    }
  }

  async onSubmit() {
    if (this.transferForm.valid) {
      const loading = await this.loadingController.create({
        message: 'Processando transferência...'
      });
      await loading.present();

      try {
        const formData = this.transferForm.value;
        const result = await this.pixService.transferPix({
          toPixKey: formData.pixKey,
          amount: parseFloat(formData.amount),
          description: formData.description
        });

        if (result.success) {
          console.log('✅ Transferência bem-sucedida:', result);

          const modal = await this.modalCtrl.create({
            component: ComprovantePage,
            componentProps: {
              pixKey: formData.pixKey,
              amount: formData.amount,
              description: formData.description,
              date: new Date().toLocaleString(),
              transactionId: result.transactionId
            }
          });

          await modal.present();

          this.transferForm.reset();
          await this.loadUserBalance();
        } else {
          await this.presentAlert('Erro', result.message);
        }
      } catch (error) {
        console.error('💥 Erro na transferência:', error);
        await this.presentAlert('Erro', 'Ocorreu um erro inesperado');
      } finally {
        await loading.dismiss();
      }
    } else {
      this.markFormGroupTouched();
      await this.presentAlert('Atenção', 'Preencha todos os campos obrigatórios');
    }
  }

  private markFormGroupTouched() {
    Object.keys(this.transferForm.controls).forEach(key => {
      this.transferForm.get(key)?.markAsTouched();
    });
  }

  async presentAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });

    await alert.present();
  }

  goBack() {
    this.navCtrl.back();
  }

  setAmount(amount: number) {
    this.transferForm.get('amount')?.setValue(amount);
  }
}