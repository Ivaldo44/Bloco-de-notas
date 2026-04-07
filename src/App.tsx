/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  User, 
  Mail, 
  Briefcase, 
  Building2, 
  Trash2, 
  Edit2, 
  StickyNote, 
  ChevronRight, 
  X,
  Save,
  Clock,
  Filter,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from './lib/utils';
import { Employee, Note, Department } from './types';
import { supabase } from './lib/supabase';

const DEPARTMENTS: Department[] = ['RH', 'TI', 'Vendas', 'Marketing', 'Financeiro', 'Operações'];

export default function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<Department | 'All'>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [newNote, setNewNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(false);

  // Check if Supabase is configured
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    setIsSupabaseConfigured(!!(url && key));
  }, []);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('employees')
            .select('*')
            .order('name');
          
          if (error) throw error;
          if (data) {
            setEmployees(data as Employee[]);
          }
        } catch (e) {
          console.error('Supabase fetch error, falling back to localStorage:', e);
          loadFromLocalStorage();
        }
      } else {
        loadFromLocalStorage();
      }
      setIsLoading(false);
    };

    const loadFromLocalStorage = () => {
      const saved = localStorage.getItem('company_employees');
      if (saved) {
        try {
          setEmployees(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse employees', e);
        }
      }
    };

    loadData();
  }, [isSupabaseConfigured]);

  // Save to localStorage as backup/fallback
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('company_employees', JSON.stringify(employees));
    }
  }, [employees, isLoading]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.role.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = selectedDept === 'All' || emp.department === selectedDept;
      return matchesSearch && matchesDept;
    });
  }, [employees, searchTerm, selectedDept]);

  const handleSaveEmployee = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const employeeData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      role: formData.get('role') as string,
      department: formData.get('department') as Department,
    };

    if (editingEmployee) {
      const updatedEmployee = { ...editingEmployee, ...employeeData };
      
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('employees')
          .update(updatedEmployee)
          .eq('id', editingEmployee.id);
        
        if (error) {
          console.error('Supabase update error:', error);
          alert('Erro ao atualizar no Supabase. Salvando localmente.');
        }
      }

      setEmployees(prev => prev.map(emp => 
        emp.id === editingEmployee.id ? updatedEmployee : emp
      ));
      if (viewingEmployee?.id === editingEmployee.id) {
        setViewingEmployee(updatedEmployee);
      }
    } else {
      const newEmployee: Employee = {
        id: crypto.randomUUID(),
        ...employeeData,
        notes: [],
        avatar: `https://picsum.photos/seed/${Math.random()}/200/200`
      };

      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('employees')
          .insert([newEmployee]);
        
        if (error) {
          console.error('Supabase insert error:', error);
          alert('Erro ao inserir no Supabase. Salvando localmente.');
        }
      }

      setEmployees(prev => [...prev, newEmployee]);
    }
    setIsModalOpen(false);
    setEditingEmployee(null);
  };

  const handleDeleteEmployee = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este funcionário?')) {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('employees')
          .delete()
          .eq('id', id);
        
        if (error) {
          console.error('Supabase delete error:', error);
          alert('Erro ao excluir no Supabase. Removendo localmente.');
        }
      }

      setEmployees(prev => prev.filter(emp => emp.id !== id));
      if (viewingEmployee?.id === id) setViewingEmployee(null);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !viewingEmployee) return;

    const note: Note = {
      id: crypto.randomUUID(),
      content: newNote,
      createdAt: Date.now()
    };

    const updatedNotes = [note, ...viewingEmployee.notes];
    
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('employees')
        .update({ notes: updatedNotes })
        .eq('id', viewingEmployee.id);
      
      if (error) {
        console.error('Supabase note update error:', error);
      }
    }

    setEmployees(prev => prev.map(emp => 
      emp.id === viewingEmployee.id 
        ? { ...emp, notes: updatedNotes } 
        : emp
    ));
    
    setViewingEmployee(prev => prev ? { ...prev, notes: updatedNotes } : null);
    setNewNote('');
  };

  const handleDeleteNote = async (employeeId: string, noteId: string) => {
    if (!viewingEmployee) return;

    const updatedNotes = viewingEmployee.notes.filter(n => n.id !== noteId);

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('employees')
        .update({ notes: updatedNotes })
        .eq('id', employeeId);
      
      if (error) {
        console.error('Supabase note delete error:', error);
      }
    }

    setEmployees(prev => prev.map(emp => 
      emp.id === employeeId 
        ? { ...emp, notes: updatedNotes } 
        : emp
    ));
    setViewingEmployee(prev => prev ? { ...prev, notes: updatedNotes } : null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar / List */}
      <div className="w-full md:w-96 bg-white border-r border-slate-200 flex flex-col h-screen overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              Gestão de Equipe
            </h1>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                isSupabaseConfigured ? "bg-green-500" : "bg-amber-500"
              )} title={isSupabaseConfigured ? "Supabase Conectado" : "Usando LocalStorage"} />
              <button 
                onClick={() => {
                  setEditingEmployee(null);
                  setIsModalOpen(true);
                }}
                className="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar funcionário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
              />
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button 
                onClick={() => setSelectedDept('All')}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                  selectedDept === 'All' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                Todos
              </button>
              {DEPARTMENTS.map(dept => (
                <button 
                  key={dept}
                  onClick={() => setSelectedDept(dept)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                    selectedDept === dept ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {dept}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-400">Carregando dados...</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <User className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-500 text-sm">Nenhum funcionário encontrado</p>
            </div>
          ) : (
            filteredEmployees.map(emp => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={emp.id}
                onClick={() => setViewingEmployee(emp)}
                className={cn(
                  "p-3 rounded-xl cursor-pointer transition-all group flex items-center gap-3",
                  viewingEmployee?.id === emp.id 
                    ? "bg-indigo-50 border-indigo-100 border" 
                    : "hover:bg-slate-50 border border-transparent"
                )}
              >
                <img 
                  src={emp.avatar} 
                  alt={emp.name} 
                  className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 truncate">{emp.name}</h3>
                  <p className="text-xs text-slate-500 truncate">{emp.role}</p>
                </div>
                <ChevronRight className={cn(
                  "w-4 h-4 transition-transform",
                  viewingEmployee?.id === emp.id ? "text-indigo-600 translate-x-1" : "text-slate-300 group-hover:text-slate-400"
                )} />
              </motion.div>
            ))
          )}
        </div>
        
        {!isSupabaseConfigured && (
          <div className="p-4 bg-amber-50 border-t border-amber-100">
            <div className="flex items-center gap-2 text-amber-700 mb-1">
              <Database className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Modo Local</span>
            </div>
            <p className="text-[10px] text-amber-600 leading-tight">
              Configure as variáveis do Supabase para habilitar o salvamento em nuvem.
            </p>
          </div>
        )}
      </div>

      {/* Main Content / Details */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50">
        <AnimatePresence mode="wait">
          {viewingEmployee ? (
            <motion.div 
              key={viewingEmployee.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="bg-white p-8 border-b border-slate-200">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-8 items-start md:items-center">
                  <img 
                    src={viewingEmployee.avatar} 
                    alt={viewingEmployee.name} 
                    className="w-24 h-24 rounded-2xl object-cover shadow-lg border-4 border-white"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <h2 className="text-3xl font-bold text-slate-900">{viewingEmployee.name}</h2>
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider">
                        {viewingEmployee.department}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-600">
                      <div className="flex items-center gap-2 text-sm">
                        <Briefcase className="w-4 h-4 text-slate-400" />
                        {viewingEmployee.role}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-slate-400" />
                        {viewingEmployee.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setEditingEmployee(viewingEmployee);
                        setIsModalOpen(true);
                      }}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDeleteEmployee(viewingEmployee.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <StickyNote className="w-5 h-5 text-indigo-600" />
                      Bloco de Notas
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">
                      {viewingEmployee.notes.length} notas registradas
                    </span>
                  </div>

                  {/* Add Note */}
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-8 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                    <textarea 
                      placeholder="Adicione uma nova nota sobre este funcionário..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="w-full bg-transparent border-none resize-none text-sm outline-none min-h-[80px]"
                    />
                    <div className="flex justify-end mt-2">
                      <button 
                        onClick={handleAddNote}
                        disabled={!newNote.trim()}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        Salvar Nota
                      </button>
                    </div>
                  </div>

                  {/* Notes List */}
                  <div className="space-y-4">
                    {viewingEmployee.notes.length === 0 ? (
                      <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                        <p className="text-slate-400 text-sm">Nenhuma nota para este funcionário ainda.</p>
                      </div>
                    ) : (
                      viewingEmployee.notes.map(note => (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          key={note.id}
                          className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 group"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              <Clock className="w-3 h-3" />
                              {format(note.createdAt, "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
                            </div>
                            <button 
                              onClick={() => handleDeleteNote(viewingEmployee.id, note.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                            {note.content}
                          </p>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mb-6">
                <User className="w-10 h-10 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Bem-vindo ao Gestão de Equipe</h2>
              <p className="text-slate-500 max-w-md">
                Selecione um funcionário na lista lateral para visualizar seus detalhes e gerenciar suas notas.
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal Add/Edit */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingEmployee ? 'Editar Funcionário' : 'Novo Funcionário'}
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <form onSubmit={handleSaveEmployee} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nome Completo</label>
                  <input 
                    name="name"
                    required
                    defaultValue={editingEmployee?.name}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="Ex: João Silva"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">E-mail Corporativo</label>
                  <input 
                    name="email"
                    type="email"
                    required
                    defaultValue={editingEmployee?.email}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="joao@empresa.com"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cargo</label>
                    <input 
                      name="role"
                      required
                      defaultValue={editingEmployee?.role}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="Ex: Designer Sênior"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Departamento</label>
                    <select 
                      name="department"
                      required
                      defaultValue={editingEmployee?.department || 'TI'}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none"
                    >
                      {DEPARTMENTS.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                  >
                    {editingEmployee ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    {editingEmployee ? 'Salvar Alterações' : 'Cadastrar Funcionário'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
