import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AlertController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { User } from 'src/app/interfaces/pix.interface';
import { AdminService } from 'src/app/services/admin/admin-service';
import { AuthService } from 'src/app/services/authService/auth-service';


@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule
  ],
})
export class AdminPage implements OnInit {
  private fb = inject(FormBuilder);
  private adminService = inject(AdminService);
  private alertController = inject(AlertController);
  selectedTab: string = 'usuarios'; 

  usuarios: User[] = [];
  usuarioSelecionado: User | null = null;
  isLoading = false;
  transferenciaForm: FormGroup;
  saldoAdmin = 0;

  novaContaForm: FormGroup;
  taxaForm: FormGroup;
  saldoForm: FormGroup;

  constructor(private authService: AuthService,) {
    this.novaContaForm = this.fb.group({
      nome: ['', [Validators.required]],
      conta: ['', [Validators.required, Validators.minLength(4)]],
      senha: ['', [Validators.required, Validators.minLength(4)]],
      balance: [0, [Validators.min(0)]],
      tipo: ['cliente']
    });

    this.taxaForm = this.fb.group({
      tipo: ['taxa', [Validators.required]],
      descricao: ['', [Validators.required]],
      valor: [0, [Validators.required, Validators.min(0.01)]],
      dataVencimento: ['']
    });

    this.saldoForm = this.fb.group({
      novoSaldo: [0, [Validators.required, Validators.min(0)]]
    });

    this.transferenciaForm = this.fb.group({
      valor: [0, [Validators.required, Validators.min(0.01)]],
      descricao: ['']
    });
  }

  async ngOnInit() {
    await this.carregarUsuarios();
    this.carregarSaldoAdmin();
  }

  private carregarSaldoAdmin() {
    const admin = this.authService.getCurrentUser();
    this.saldoAdmin = admin?.balance || 0;
  }

  selecionarAba(event: any) {
    this.selectedTab = event.detail.value;
  }

  async carregarUsuarios() {
    this.isLoading = true;
    this.usuarios = await this.adminService.listarUsuarios();
    this.isLoading = false;
  }

  async criarNovaConta() {
    if (this.novaContaForm.valid) {
      this.isLoading = true;
      const result = await this.adminService.criarNovaConta(this.novaContaForm.value);
      this.isLoading = false;

      if (result.success) {
        await this.presentAlert('Sucesso!', result.message);
        this.novaContaForm.reset();
        await this.carregarUsuarios();
      } else {
        await this.presentAlert('Erro', result.message);
      }
    }
  }

  async aplicarTaxa() {
    if (this.taxaForm.valid && this.usuarioSelecionado) {
      this.isLoading = true;
      const result = await this.adminService.aplicarTaxa(
        this.usuarioSelecionado.firestoreId!,
        this.taxaForm.value
      );
      this.isLoading = false;

      if (result.success) {
        await this.presentAlert('Sucesso!', result.message);
        this.taxaForm.reset();
        this.saldoAdmin = this.authService.getCurrentUser()?.balance || 0;
        await this.carregarUsuarios();
        this.carregarSaldoAdmin();
      } else {
        await this.presentAlert('Erro', result.message);
      }
    }
  }

  async ajustarSaldo() {
    if (this.saldoForm.valid && this.usuarioSelecionado) {
      this.isLoading = true;
      const result = await this.adminService.ajustarSaldo(
        this.usuarioSelecionado.id,
        this.saldoForm.value.novoSaldo
      );
      this.isLoading = false;

      if (result.success) {
        await this.presentAlert('Sucesso!', result.message);
        await this.carregarUsuarios();
      } else {
        await this.presentAlert('Erro', result.message);
      }
    }
  }

  async bloquearUsuario() {
    if (this.usuarioSelecionado) {
      this.isLoading = true;
      const result = await this.adminService.bloquearUsuario(this.usuarioSelecionado.id);
      this.isLoading = false;

      if (result.success) {
        await this.presentAlert('Sucesso!', result.message);
        await this.carregarUsuarios();
      } else {
        await this.presentAlert('Erro', result.message);
      }
    }
  }

  async ativarUsuario() {
    if (this.usuarioSelecionado) {
      this.isLoading = true;
      const result = await this.adminService.ativarUsuario(this.usuarioSelecionado.id);
      this.isLoading = false;

      if (result.success) {
        await this.presentAlert('Sucesso!', result.message);
        await this.carregarUsuarios();
      } else {
        await this.presentAlert('Erro', result.message);
      }
    }
  }

  async presentAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });

    await alert.present();
  }

  getStatusBadgeColor(status: string): string {
    switch (status) {
      case 'ativo': return 'success';
      case 'bloqueado': return 'danger';
      case 'suspenso': return 'warning';
      default: return 'medium';
    }
  }

  getTipoBadgeColor(tipo: string): string {
    return tipo === 'admin' ? 'primary' : 'secondary';
  }

  selecionarUsuario(usuario: User) {
    this.usuarioSelecionado = usuario;
    this.transferenciaForm.patchValue({
      valor: 0,
      descricao: `Transferência para ${usuario.nome}`
    });
  }

  async realizarTransferencia() {
    if (this.transferenciaForm.valid && this.usuarioSelecionado) {
      this.isLoading = true;
      const { valor, descricao } = this.transferenciaForm.value;

      const result = await this.adminService.transferirSaldo(
        this.usuarioSelecionado.firestoreId!, // ✅ ID correto do Firestore
        valor,
        descricao
      );

      this.isLoading = false;

      if (result.success) {
        await this.presentAlert('Sucesso!', result.message);
        this.transferenciaForm.reset();
        await this.carregarUsuarios();
        this.carregarSaldoAdmin();
      } else {
        await this.presentAlert('Erro na Transferência', result.message);
      }
    }
  }

  getMaxTransferencia(): number {
    return this.saldoAdmin;
  }

  setValorRapido(valor: number) {
    const maxValor = this.getMaxTransferencia();
    const valorSeguro = Math.min(valor, maxValor);
    this.transferenciaForm.patchValue({ valor: valorSeguro });
  }
}