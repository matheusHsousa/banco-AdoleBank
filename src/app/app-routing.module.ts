import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginPage } from './pages/login/login.page';
import { HomePage } from './pages/home/home/home.page';
import { AuthGuard } from './guardian/auth-guard';
import { PixRegisterPage } from './pages/pix-register/pix-register.page';
import { PixTransferPage } from './pages/pix-trasfer/pix-transfer/pix-transfer.page';
import { AdminGuard } from './guardian/admin/admin-guard';
import { AdminPage } from './pages/admin/admin.page';
import { TransactionsPage } from './pages/transactions/transactions.page';

const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginPage },

  {
    path: 'home',
    component: HomePage,
    canActivate: [AuthGuard]
  },
  {
    path: 'pix-register',
    component: PixRegisterPage,
    canActivate: [AuthGuard]
  },
  {
    path: 'pix-transfer',
    component: PixTransferPage,
    canActivate: [AuthGuard]
  },
  {
    path: 'admin',
    component: AdminPage,
    canActivate: [AuthGuard, AdminGuard]
  },
  {
    path: 'statements',
    component: TransactionsPage,
    canActivate: [AuthGuard]
  },
  {
    path: 'comprovante',
    component: TransactionsPage,
    canActivate: [AuthGuard],
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
