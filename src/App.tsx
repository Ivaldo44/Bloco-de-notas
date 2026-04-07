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
  Database,
  LogOut,
  UserCircle,
  Settings,
  Shield
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
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<{ username: string } | null>(null);

  // Check if Supabase is configured and handle Auth state
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    setIsSupabaseConfigured(!!(url && key));

    if (supabase) {
      // Get initial session
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) fetchProfile(session.user.id);
      });

      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setUserProfile(null);
        }
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  const fetchProfile = async (userId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();
    
    if (data) {
      setUserProfile(data);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user || !username.trim()) return;

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, username: username.trim() });
    
    if (error) {
      alert('Erro ao salvar nome de usuário: ' + error.message);
    } else {
      setUserProfile({ username: username.trim() });
    }
  };

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      if (isSupabaseConfigured && supabase && user) {
        try {
          const { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq('user_id', user.id) // FILTRO POR USUÁRIO
            .order('name');
          
          if (error) throw error;
          if (data) {
            setEmployees(data as Employee[]);
          }
        } catch (e) {
          console.error('Supabase fetch error, falling back to localStorage:', e);
          loadFromLocalStorage();
        }
      } else if (!user) {
        setEmployees([]); // Clear if not logged in
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
      
      if (isSupabaseConfigured && supabase && user) {
        const { error } = await supabase
          .from('employees')
          .update(updatedEmployee)
          .eq('id', editingEmployee.id)
          .eq('user_id', user.id); // Segurança extra
        
        if (error) {
          console.error('Supabase update error:', error);
          alert('Erro ao atualizar no Supabase.');
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

      if (isSupabaseConfigured && supabase && user) {
        const { error } = await supabase
          .from('employees')
          .insert([{ ...newEmployee, user_id: user.id }]); // VINCULA AO USUÁRIO
        
        if (error) {
          console.error('Supabase insert error:', error);
          alert('Erro ao inserir no Supabase.');
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !email.trim()) return;
    
    setIsLoginLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.href
      }
    });
    
    setIsLoginLoading(false);
    if (error) {
      alert('Erro ao enviar e-mail: ' + error.message);
    } else {
      alert('Link de acesso enviado para o seu e-mail! Verifique sua caixa de entrada.');
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setEmployees([]);
    setViewingEmployee(null);
  };

  if (!user && isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Bem-vindo</h2>
          <p className="text-slate-500 mb-8">Digite seu e-mail para receber um link de acesso privado.</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="text-left space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Seu E-mail</label>
              <input 
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@email.com"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <button 
              type="submit"
              disabled={isLoginLoading}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-100 disabled:opacity-50"
            >
              {isLoginLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Mail className="w-5 h-5" />
                  Receber Link de Acesso
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!user && isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-10 text-center">
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-indigo-500/20">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Acesso Restrito</h2>
          <p className="text-slate-400 mb-10 text-sm leading-relaxed">
            Sistema de Gestão Corporativa. <br />
            Identifique-se para acessar o painel de controle.
          </p>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="text-left space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">E-mail Corporativo</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@empresa.com"
                  className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm"
                />
              </div>
            </div>
            <button 
              type="submit"
              disabled={isLoginLoading}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-500 transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-900/20 disabled:opacity-50 active:scale-[0.98]"
            >
              {isLoginLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogOut className="w-5 h-5 rotate-180" />
                  Solicitar Acesso
                </>
              )}
            </button>
          </form>
          <p className="mt-8 text-[10px] text-slate-600 uppercase tracking-widest">
            Protocolo de Segurança Ativado
          </p>
        </div>
      </div>
    );
  }

  if (user && !userProfile && isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-10 text-center">
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-indigo-500/20">
            <UserCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Configurar Perfil</h2>
          <p className="text-slate-400 mb-10 text-sm leading-relaxed">
            Como você gostaria de ser identificado no sistema?
          </p>
          
          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="text-left space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Nome de Usuário</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ex: Admin_Silva"
                  className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm"
                />
              </div>
            </div>
            <button 
              type="submit"
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-500 transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-900/20 active:scale-[0.98]"
            >
              <Save className="w-5 h-5" />
              Finalizar Cadastro
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row font-sans">
      {/* Sidebar / List */}
      <div className="w-full md:w-96 bg-white border-r border-slate-200 flex flex-col h-screen overflow-hidden shadow-sm z-10">
        <div className="p-8 border-b border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg shadow-slate-200">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">
                  Nexus CRM
                </h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Enterprise</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-2 h-2 rounded-full",
                isSupabaseConfigured ? "bg-emerald-500" : "bg-amber-500"
              )} title={isSupabaseConfigured ? "Servidor Online" : "Modo Offline"} />
              <button 
                onClick={() => {
                  setEditingEmployee(null);
                  setIsModalOpen(true);
                }}
                className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-md active:scale-95"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* User Profile Info */}
          {userProfile && (
            <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Usuário Logado</p>
                  <p className="text-sm font-bold text-slate-700 truncate">{userProfile.username}</p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                title="Sair do Sistema"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="space-y-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Pesquisar na base de dados..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
              />
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button 
                onClick={() => setSelectedDept('All')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                  selectedDept === 'All' 
                    ? "bg-slate-900 text-white shadow-md" 
                    : "bg-white text-slate-500 border border-slate-100 hover:bg-slate-50"
                )}
              >
                Todos
              </button>
              {DEPARTMENTS.map(dept => (
                <button 
                  key={dept}
                  onClick={() => setSelectedDept(dept)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                    selectedDept === dept 
                      ? "bg-slate-900 text-white shadow-md" 
                      : "bg-white text-slate-500 border border-slate-100 hover:bg-slate-50"
                  )}
                >
                  {dept}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sincronizando...</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-20 px-6">
              <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Search className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Nenhum registro</h3>
              <p className="text-xs text-slate-500">Não encontramos funcionários para esta busca.</p>
            </div>
          ) : (
            filteredEmployees.map(emp => (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                key={emp.id}
                onClick={() => setViewingEmployee(emp)}
                className={cn(
                  "p-4 rounded-2xl cursor-pointer transition-all group flex items-center gap-4 border",
                  viewingEmployee?.id === emp.id 
                    ? "bg-white border-indigo-200 shadow-lg shadow-indigo-500/5" 
                    : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-md"
                )}
              >
                <div className="relative">
                  <img 
                    src={emp.avatar} 
                    alt={emp.name} 
                    className="w-12 h-12 rounded-xl object-cover border border-slate-100"
                    referrerPolicy="no-referrer"
                  />
                  {viewingEmployee?.id === emp.id && (
                    <div className="absolute -right-1 -bottom-1 w-4 h-4 bg-indigo-600 rounded-full border-2 border-white flex items-center justify-center">
                      <div className="w-1 h-1 bg-white rounded-full animate-pulse" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">{emp.name}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{emp.role}</p>
                </div>
                <ChevronRight className={cn(
                  "w-4 h-4 transition-all",
                  viewingEmployee?.id === emp.id ? "text-indigo-600 translate-x-1" : "text-slate-300 group-hover:text-slate-400"
                )} />
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Main Content / Details */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#f8fafc]">
        <AnimatePresence mode="wait">
          {viewingEmployee ? (
            <motion.div 
              key={viewingEmployee.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="bg-white p-10 border-b border-slate-200 shadow-sm">
                <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-10 items-start lg:items-center">
                  <div className="relative">
                    <img 
                      src={viewingEmployee.avatar} 
                      alt={viewingEmployee.name} 
                      className="w-32 h-32 rounded-[2.5rem] object-cover shadow-2xl border-4 border-white"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute -right-2 -bottom-2 w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg border-4 border-white">
                      <Shield className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-4 mb-4">
                      <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">{viewingEmployee.name}</h2>
                      <span className="px-4 py-1.5 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
                        {viewingEmployee.department}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="flex items-center gap-3 text-slate-600">
                        <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                          <Briefcase className="w-4 h-4 text-slate-400" />
                        </div>
                        <span className="text-sm font-medium">{viewingEmployee.role}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-600">
                        <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                          <Mail className="w-4 h-4 text-slate-400" />
                        </div>
                        <span className="text-sm font-medium">{viewingEmployee.email}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        setEditingEmployee(viewingEmployee);
                        setIsModalOpen(true);
                      }}
                      className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold text-sm hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95"
                    >
                      <Edit2 className="w-4 h-4" />
                      Editar
                    </button>
                    <button 
                      onClick={() => handleDeleteEmployee(viewingEmployee.id)}
                      className="flex items-center gap-2 px-5 py-3 bg-red-50 text-red-600 border border-red-100 rounded-2xl font-bold text-sm hover:bg-red-100 transition-all active:scale-95"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </button>
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div className="flex-1 overflow-y-auto p-10">
                <div className="max-w-5xl mx-auto">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                        <StickyNote className="w-6 h-6 text-indigo-600" />
                        Relatórios e Notas
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">Histórico de observações e registros corporativos.</p>
                    </div>
                    <div className="px-4 py-2 bg-white border border-slate-100 rounded-xl shadow-sm">
                      <span className="text-xs font-bold text-slate-700">
                        {viewingEmployee.notes.length} <span className="text-slate-400 font-medium">Registros</span>
                      </span>
                    </div>
                  </div>

                  {/* Add Note */}
                  <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 mb-10 focus-within:ring-4 focus-within:ring-indigo-500/5 transition-all">
                    <textarea 
                      placeholder="Descreva aqui o novo registro ou observação técnica..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="w-full bg-transparent border-none resize-none text-sm outline-none min-h-[120px] text-slate-700 leading-relaxed placeholder:text-slate-300"
                    />
                    <div className="flex justify-between items-center mt-6 pt-6 border-t border-slate-50">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                        <Shield className="w-3 h-3" />
                        Registro Criptografado
                      </div>
                      <button 
                        onClick={handleAddNote}
                        disabled={!newNote.trim()}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 active:scale-95"
                      >
                        <Save className="w-4 h-4" />
                        Arquivar Nota
                      </button>
                    </div>
                  </div>

                  {/* Notes List */}
                  <div className="space-y-6">
                    {viewingEmployee.notes.length === 0 ? (
                      <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                          <StickyNote className="w-8 h-8 text-slate-200" />
                        </div>
                        <p className="text-slate-400 text-sm font-medium">Nenhum registro histórico encontrado.</p>
                      </div>
                    ) : (
                      viewingEmployee.notes.map(note => (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          key={note.id}
                          className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 group hover:shadow-md transition-all"
                        >
                          <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                                <Clock className="w-5 h-5 text-slate-400" />
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Data do Registro</p>
                                <p className="text-xs font-bold text-slate-700">
                                  {format(note.createdAt, "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleDeleteNote(viewingEmployee.id, note.id)}
                              className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                          <div className="pl-13">
                            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                              {note.content}
                            </p>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
              <div className="w-32 h-32 bg-white rounded-[3rem] shadow-2xl shadow-slate-200 flex items-center justify-center mb-10 border border-slate-50">
                <Building2 className="w-12 h-12 text-indigo-600" />
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 mb-4 tracking-tight">Nexus CRM Enterprise</h2>
              <p className="text-slate-500 max-w-md text-sm leading-relaxed font-medium">
                Selecione um registro na base de dados para visualizar o dossiê completo e gerenciar o histórico de observações.
              </p>
              <div className="mt-12 flex items-center gap-6">
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-black text-slate-900">{employees.length}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Colaboradores</span>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-black text-slate-900">
                    {employees.reduce((acc, curr) => acc + curr.notes.length, 0)}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registros</span>
                </div>
              </div>
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
