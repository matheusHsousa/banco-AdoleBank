import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';

@Component({
  selector: 'app-comprovante',
  templateUrl: './comprovante.page.html',
  styleUrls: ['./comprovante.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class ComprovantePage {
  @Input() pixKey!: string;
  @Input() amount!: number;
  @Input() description!: string;
  @Input() date!: string;
  @Input() transactionId!: string;

  constructor(private modalCtrl: ModalController) {}

  fechar() {
    this.modalCtrl.dismiss();
  }
}
