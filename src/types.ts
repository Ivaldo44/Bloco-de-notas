export interface Note {
  id: string;
  content: string;
  createdAt: number;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  notes: Note[];
  avatar?: string;
}

export type Department = 'RH' | 'TI' | 'Vendas' | 'Marketing' | 'Financeiro' | 'Operações';
