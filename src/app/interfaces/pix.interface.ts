export interface User {
  firestoreId?: string; 
  id: string;
  nome: string;
  conta: string;
  senha: string;
  balance: number;
  tipo: 'cliente' | 'admin';
  status: 'ativo' | 'bloqueado' | 'suspenso';
  pixKeys?: PixKey[];
  transactions?: Transacao[];
  createdAt?: Date;
  updatedAt?: Date;
  taxas?: Taxa[];
  limite?: number;

}

export interface Taxa {
  id: string;
  tipo: 'multa' | 'taxa' | 'anuidade';
  descricao: string;
  valor: number;
  dataAplicacao: Date;
  dataVencimento?: Date;
  status: 'pendente' | 'paga' | 'vencida';
  userId: string;
}

export interface PixKey {
  id?: string;
  type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  key: string;
  isActive: boolean;
  createdAt?: Date;
  status?: string;
  userName?: string;
  userId?: string;
}

export interface FirestoreUser {
  id?: string;
  conta: string;
  senha: string;
  nome: string;
  pixKeys?: PixKey[];
  [key: string]: any; 
}

export interface PixTransfer {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId?: string;
  toUserAccount: string;
  fromUserAccount: string;
  type: 'pix' | 'ted' | 'doc';
  toUserName?: string;
  toPixKey: string;
  toPixKeyType: string;
  amount: number;
  description?: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: any;
  updatedAt: any;
}

export interface TransferResponse {
  success: boolean;
  message: string;
  newBalance?: number;
  transactionId?: string;
}

export interface Transaction {
  id: string;
  type: 'transfer' | 'pix' | 'admin_transfer' | 'tax';
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  description?: string;
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  createdAt: Date;
  updatedAt: Date;
}

export interface Transacao {
  id: string;
  type: 'transfer' | 'admin_transfer' | 'taxa' | 'received' | 'payment';
  fromUserId?: string;
  fromUserName?: string;
  toUserId?: string;
  toUserName?: string;
  amount: number;
  description: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  createdAt: Date | any;
  updatedAt: Date | any;
  taxaType?: 'multa' | 'taxa' | 'anuidade' | undefined;
  paymentMethod?: 'pix' | 'ted' | 'doc';
}