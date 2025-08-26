import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AlertController, IonicModule, NavController } from '@ionic/angular';

import { CommonModule } from '@angular/common';
import { PixService } from 'src/app/services/pix/pix-service';

@Component({
  selector: 'app-pix-register',
  templateUrl: './pix-register.page.html',
  styleUrls: ['./pix-register.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    ReactiveFormsModule
  ],
})
export class PixRegisterPage implements OnInit {
  private fb = inject(FormBuilder);
  private pixService = inject(PixService);
  private alertController = inject(AlertController);
  private navCtrl = inject(NavController);

  pixForm: FormGroup;
  selectedType: string = 'phone';
  isEditing = false;
  editingKeyId: string | null = null;
  userPixKeys: any[] = [];

  pixTypes: any[] = [
    {
      value: 'email',
      label: 'E-mail',
      placeholder: 'seu@email.com',
      validationPattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    {
      value: 'phone',
      label: 'Telefone',
      placeholder: '(00) 00000-0000',
      validationPattern: /^\(\d{2}\) \d{4,5}-\d{4}$/
    },
    {
      value: 'random',
      label: 'Chave Aleatória',
      placeholder: 'Sua chave aleatória',
      validationPattern: /^[a-zA-Z0-9]{8,}$/
    }
  ];

  constructor() {
    this.pixForm = this.createForm();
  }

  async ngOnInit() {
    this.onTypeChange();
    await this.loadUserPixKeys();

    if (this.selectedType === 'phone') {
      this.applyPhoneMask(this.pixForm.get('key')?.value);
    }
  }

  formatPhoneNumber(event: any) {
    if (this.selectedType !== 'phone') return;

    const input = event.target;
    let value = input.value.replace(/\D/g, '');

    if (value.length > 11) {
      value = value.substring(0, 11);
    }

    const formattedValue = this.formatPhoneValue(value);

    input.value = formattedValue;
    this.pixForm.get('key')?.setValue(formattedValue, { emitEvent: false });
  }

  private formatPhoneValue(value: string): string {
    if (value.length > 6) {
      return value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (value.length > 2) {
      return value.replace(/(\d{2})(\d{0,5})/, '($1) $2');
    } else if (value.length > 0) {
      return value.replace(/(\d{0,2})/, '($1');
    }
    return value;
  }

  private applyPhoneMask(value: string) {
    if (!value) return;

    const numbers = value.replace(/\D/g, '');
    const formattedValue = this.formatPhoneValue(numbers);
    this.pixForm.get('key')?.setValue(formattedValue, { emitEvent: false });
  }

  private async loadUserPixKeys() {
    this.userPixKeys = await this.pixService.getPixKeys();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      type: ['phone', [Validators.required]],
      key: ['', [Validators.required, Validators.minLength(11)]],
      isActive: [true]
    });
  }

  onTypeChange() {
    this.pixForm.get('type')?.valueChanges.subscribe(type => {
      this.selectedType = type;
      this.updateKeyValidators();

      if (type === 'phone' && this.pixForm.get('key')?.value) {
        this.applyPhoneMask(this.pixForm.get('key')?.value);
      }

      if (type === 'random') {
        const randomKey = this.generateRandomKey();
        this.pixForm.get('key')?.setValue(randomKey, { emitEvent: false });
        this.pixForm.get('key')?.disable({ emitEvent: false });
      } else {
        this.pixForm.get('key')?.enable({ emitEvent: false });
      }
    });
  }

  private generateRandomKey(): string {
    return crypto.randomUUID();
  }

  private updateKeyValidators() {
    const keyControl = this.pixForm.get('key');
    const selectedType = this.pixTypes.find(t => t.value === this.selectedType);

    if (selectedType?.validationPattern) {
      keyControl?.setValidators([
        Validators.required,
        Validators.pattern(selectedType.validationPattern)
      ]);
    } else {
      keyControl?.setValidators([Validators.required]);
    }

    keyControl?.updateValueAndValidity();
  }

  getCurrentTypeConfig(): any | undefined {
    return this.pixTypes.find(t => t.value === this.selectedType);
  }

  async onSubmit() {
    if (this.pixForm.valid) {
      const formData = this.pixForm.getRawValue();

      if (this.selectedType === 'phone') {
        formData.key = formData.key.replace(/\D/g, '');
      }

      const keyExists = await this.pixService.checkKeyExists(formData.key);
      if (keyExists) {
        this.presentAlert('Atenção', 'Esta chave PIX já está cadastrada.');
        return;
      }

      try {
        let result;

        if (this.isEditing && this.editingKeyId) {
          result = await this.pixService.updatePixKey(this.editingKeyId, formData);
        } else {
          result = await this.pixService.addPixKey(formData);
        }

        if (result.success) {
          this.presentAlert('Sucesso!', result.message);
          this.pixForm.reset({ type: 'phone', isActive: true });
          this.isEditing = false;
          this.editingKeyId = null;
          await this.loadUserPixKeys();
        } else {
          this.presentAlert('Erro', result.message);
        }

      } catch (error) {
        this.presentAlert('Erro', 'Ocorreu um erro ao salvar a chave PIX.');
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched() {
    Object.keys(this.pixForm.controls).forEach(key => {
      this.pixForm.get(key)?.markAsTouched();
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

  async editPixKey(pixKey: any) {
    this.isEditing = true;
    this.editingKeyId = pixKey.id;

    let keyValue = pixKey.key;
    if (pixKey.type === 'phone') {
      const numbers = keyValue.replace(/\D/g, '');
      keyValue = this.formatPhoneValue(numbers);
    }

    this.pixForm.patchValue({
      type: pixKey.type,
      key: keyValue,
      isActive: pixKey.isActive
    });

    this.selectedType = pixKey.type;
  }

  async deletePixKey(keyId: string) {
    const alert = await this.alertController.create({
      header: 'Confirmar Exclusão',
      message: 'Tem certeza que deseja excluir esta chave PIX?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Excluir',
          handler: async () => {
            const result = await this.pixService.deletePixKey(keyId);
            if (result.success) {
              this.presentAlert('Sucesso!', result.message);
              await this.loadUserPixKeys();
            } else {
              this.presentAlert('Erro', result.message);
            }
          }
        }
      ]
    });

    await alert.present();
  }

  getTypeLabel(type: string): string {
    const foundType = this.pixTypes.find(t => t.value === type);
    return foundType ? foundType.label : type;
  }

  cancelEdit() {
    this.isEditing = false;
    this.editingKeyId = null;
    this.pixForm.reset({ type: 'phone', isActive: true });
    this.selectedType = 'phone';
  }

}