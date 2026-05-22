import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { useLeadSources } from '@/hooks/useLeadSources';

const LeadSourceManager = () => {
  const [leadSources, setLeadSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newSourceName, setNewSourceName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { fetchAllLeadSources, addLeadSource, toggleLeadSourceStatus, deleteLeadSource } = useLeadSources();

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    setLoading(true);
    const { success, data, error } = await fetchAllLeadSources();
    if (success) {
      setLeadSources(data);
    } else {
      toast({ title: "Erro", description: "Falha ao carregar opções.", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newSourceName.trim()) return;

    setIsSubmitting(true);
    const { success, data, error } = await addLeadSource(newSourceName.trim());
    
    if (success) {
      setLeadSources([data, ...leadSources]);
      setNewSourceName('');
      toast({ title: "Sucesso", description: "Origem adicionada." });
    } else {
      toast({ title: "Erro", description: error, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleToggle = async (id, currentStatus) => {
    const { success, data, error } = await toggleLeadSourceStatus(id, currentStatus);
    
    if (success) {
      setLeadSources(leadSources.map(s => s.id === id ? data : s));
      toast({ title: "Atualizado", description: `Status alterado para ${!currentStatus ? 'Ativo' : 'Inativo'}.` });
    } else {
      toast({ title: "Erro", description: error, variant: "destructive" });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Tem certeza que deseja excluir esta origem?")) return;

    const { success, error } = await deleteLeadSource(id);
    
    if (success) {
      setLeadSources(leadSources.filter(s => s.id !== id));
      toast({ title: "Excluído", description: "Origem removida com sucesso." });
    } else {
      toast({ title: "Erro", description: error, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-purple-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="flex gap-2 items-end bg-gray-50 p-4 rounded-lg border border-gray-100">
        <div className="flex-1">
          <label className="text-sm font-medium text-gray-700 block mb-1">Nova Origem de Lead</label>
          <Input
            value={newSourceName}
            onChange={(e) => setNewSourceName(e.target.value)}
            placeholder="Ex: Anúncio Facebook"
            disabled={isSubmitting}
            className="bg-white"
          />
        </div>
        <Button type="submit" disabled={isSubmitting || !newSourceName.trim()} className="bg-purple-600 hover:bg-purple-700">
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          Adicionar
        </Button>
      </form>

      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-700">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium text-center">Status</th>
              <th className="px-4 py-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leadSources.map((source) => (
              <tr key={source.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{source.name}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggle(source.id, source.is_active)}
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold transition-colors ${
                      source.is_active 
                        ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {source.is_active ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                    {source.is_active ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(source.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {leadSources.length === 0 && (
              <tr>
                <td colSpan="3" className="px-4 py-8 text-center text-gray-500 italic">
                  Nenhuma origem cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeadSourceManager;