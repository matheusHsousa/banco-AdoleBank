import { Component, OnInit } from '@angular/core';
import { IonicModule, ToastController } from '@ionic/angular';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from 'src/app/services/authService/auth-service';
import { Router } from '@angular/router'; // 👈 importa o Router

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonicModule, ReactiveFormsModule],
})
export class LoginPage implements OnInit {
  loginForm!: FormGroup;
  title = 'Vamos começar!';
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private toastCtrl: ToastController,
    private router: Router // 👈 injeta o Router
  ) {}

  ngOnInit() {
    this.loginForm = this.fb.group({
      conta: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9]+$/)]],
      password: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
    });

    const savedConta = localStorage.getItem('conta');
    if (savedConta) {
      this.loginForm.patchValue({ conta: savedConta });
      this.showPassword = true;
      this.title = 'Estamos quase lá!';
    }
  }

  nextStep() {
    const conta = this.loginForm.get('conta')?.value?.trim();
    if (conta) {
      localStorage.setItem('conta', conta);
      this.showPassword = true;
      this.title = 'Estamos quase lá!';
      this.loginForm.get('password')?.reset();
    } else {
      this.showToast('Por favor, insira sua conta.', 'danger');
    }
  }

  editConta() {
    this.showPassword = false;
    this.loginForm.patchValue({ password: '' });
    this.title = 'Vamos começar!';
  }

  async login() {
    const conta = String(this.loginForm.get('conta')?.value || '').trim();
    const senha = String(this.loginForm.get('password')?.value || '').trim();

    if (!conta || !senha) {
      await this.showToast('Preencha todos os campos!', 'danger');
      return;
    }

    try {
      const result = await this.auth.login(conta, senha);

      if (result.success) {
        await this.showToast('Login realizado com sucesso!', 'success');
        this.router.navigateByUrl('/home'); // 👈 redireciona para Home
      } else {
        await this.showToast(result.message, 'danger');
      }
    } catch (error) {
      console.error('Erro no login:', error);
      await this.showToast('Erro ao conectar com o servidor', 'danger');
    }
  }

  private async showToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}
