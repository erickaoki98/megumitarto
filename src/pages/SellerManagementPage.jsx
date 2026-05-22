import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Plus, Mail, Shield, UserCircle, Trash2, Loader2, PenSquare, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const SellerManagementPage = () => {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Create Dialog State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', email: '', password: '', role: 'seller' });
  const [isCreating, setIsCreating] = useState(false);

  // Edit Dialog State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Password Dialog State
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordMember, setPasswordMember] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    loadSellers();
  }, []);

  const loadSellers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setSellers(data);
    } catch (error) {
      console.error('Error loading sellers:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar lista de membros.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMember = async (e) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-user-management', {
        body: {
          action: 'create',
          userData: {
            email: newMember.email,
            password: newMember.password,
            name: newMember.name,
            role: newMember.role
          }
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Sucesso",
        description: "Novo membro criado com sucesso!",
      });

      setIsCreateDialogOpen(false);
      setNewMember({ name: '', email: '', password: '', role: 'seller' });
      loadSellers();

    } catch (error) {
      console.error('Error creating member:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao criar membro.",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateMember = async (e) => {
    e.preventDefault();
    if (!editingMember) return;
    setIsUpdating(true);

    try {
      // 1. Call edge function to handle Auth roles if needed
      const { data, error } = await supabase.functions.invoke('admin-user-management', {
        body: {
          action: 'update_role', 
          userId: editingMember.id,
          userData: { 
            role: editingMember.role,
            name: editingMember.name 
          }
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // 2. Update Profile Table Directly
      const { error: profileError } = await supabase.from('profiles').update({ 
        name: editingMember.name,
        role: editingMember.role 
      }).eq('id', editingMember.id);

      if (profileError) throw profileError;

      toast({ title: "Sucesso", description: "Dados atualizados." });
      setIsEditDialogOpen(false);
      setEditingMember(null);
      loadSellers();

    } catch (error) {
      console.error('Error updating:', error);
      toast({ title: "Erro", description: error.message || "Falha ao atualizar.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordMember || !newPassword) return;
    
    setIsChangingPassword(true);
    try {
        const { data, error } = await supabase.functions.invoke('admin-change-password', {
            body: {
                userId: passwordMember.id,
                newPassword: newPassword
            }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast({ title: "Sucesso", description: "Senha alterada com sucesso!" });
        setIsPasswordDialogOpen(false);
        setPasswordMember(null);
        setNewPassword('');

    } catch (error) {
        console.error('Error changing password:', error);
        toast({ 
            title: "Erro", 
            description: error.message || "Falha ao alterar senha.", 
            variant: "destructive" 
        });
    } finally {
        setIsChangingPassword(false);
    }
  };

  const openEditDialog = (seller) => {
    setEditingMember({ ...seller });
    setIsEditDialogOpen(true);
  };
  
  const openPasswordDialog = (seller) => {
    setPasswordMember(seller);
    setNewPassword('');
    setIsPasswordDialogOpen(true);
  };

  const handleDeleteMember = async (userId) => {
    if (!window.confirm("Tem certeza que deseja excluir este membro?")) return;

    try {
      const { data, error } = await supabase.functions.invoke('admin-user-management', {
        body: { action: 'delete', userId: userId }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Sucesso", description: "Membro excluído." });
      setSellers(prev => prev.filter(s => s.id !== userId));

    } catch (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  return (
    <>
      <Helmet>
        <title>Membros - Gestão de Tarot</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Gestão de Membros</h2>
            <p className="text-gray-500 mt-1">Gerencie contas de usuários e permissões</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-700 gap-2">
                <Plus className="w-4 h-4" />
                Adicionar Membro
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Adicionar Novo Membro</DialogTitle>
                <DialogDescription>Crie uma nova conta de acesso.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateMember} className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Nome</label>
                  <input type="text" required className="w-full mt-1 px-3 py-2 border rounded-md"
                    value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">E-mail</label>
                  <input type="email" required className="w-full mt-1 px-3 py-2 border rounded-md"
                    value={newMember.email} onChange={e => setNewMember({...newMember, email: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Senha</label>
                  <input type="password" required className="w-full mt-1 px-3 py-2 border rounded-md"
                    value={newMember.password} onChange={e => setNewMember({...newMember, password: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Função</label>
                  <select className="w-full mt-1 px-3 py-2 border rounded-md"
                    value={newMember.role} onChange={e => setNewMember({...newMember, role: e.target.value})}>
                    <option value="seller">Vendedor</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="flex-1">Cancelar</Button>
                  <Button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700" disabled={isCreating}>
                    {isCreating ? 'Criando...' : 'Criar Conta'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Editar Membro</DialogTitle>
              </DialogHeader>
              {editingMember && (
                <form onSubmit={handleUpdateMember} className="space-y-4 mt-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Nome</label>
                    <input type="text" required className="w-full mt-1 px-3 py-2 border rounded-md"
                      value={editingMember.name} onChange={e => setEditingMember({...editingMember, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">E-mail (Apenas visualização)</label>
                    <input type="email" disabled className="w-full mt-1 px-3 py-2 border rounded-md bg-gray-100 text-gray-500"
                      value={editingMember.email} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Função</label>
                    <select className="w-full mt-1 px-3 py-2 border rounded-md"
                      value={editingMember.role} onChange={e => setEditingMember({...editingMember, role: e.target.value})}>
                      <option value="seller">Vendedor</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="flex-1">Cancelar</Button>
                    <Button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700" disabled={isUpdating}>
                      {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                  </div>
                </form>
              )}
            </DialogContent>
          </Dialog>

          {/* Password Dialog */}
          <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Alterar Senha</DialogTitle>
                <DialogDescription>
                    Defina uma nova senha para {passwordMember?.name}.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleChangePassword} className="space-y-4 mt-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Nova Senha</label>
                    <input 
                        type="password" 
                        required 
                        minLength={6}
                        className="w-full mt-1 px-3 py-2 border rounded-md"
                        value={newPassword} 
                        onChange={e => setNewPassword(e.target.value)} 
                        placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsPasswordDialogOpen(false)} className="flex-1">Cancelar</Button>
                    <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white" disabled={isChangingPassword}>
                      {isChangingPassword ? 'Alterando...' : 'Confirmar Alteração'}
                    </Button>
                  </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
           <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sellers.map((seller, index) => (
            <motion.div
              key={seller.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow relative group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <UserCircle className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openPasswordDialog(seller)} className="p-2 text-gray-400 hover:text-amber-600 transition-colors" title="Alterar Senha">
                    <Lock className="w-4 h-4" />
                  </button>
                  <button onClick={() => openEditDialog(seller)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors" title="Editar">
                    <PenSquare className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteMember(seller.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors" title="Excluir">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{seller.name}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                <Mail className="w-4 h-4" /> {seller.email}
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-600" />
                <span className={`text-xs font-medium px-2 py-1 rounded ${seller.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {seller.role === 'admin' ? 'Administrador' : 'Vendedor'}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
        )}
      </div>
    </>
  );
};

export default SellerManagementPage;