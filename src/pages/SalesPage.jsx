import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, User, Eye, Loader2, Calendar, Search, Filter, Gift, HelpCircle, FileEdit, Phone, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { formatDate } from '@/lib/dateUtils';

const statusConfig = {
  'draft': { label: 'Rascunho', color: 'bg-gray-200 text-gray-700 border border-gray-300' },
  'pending_reading': { label: 'Aguardando Leitura', color: 'bg-yellow-100 text-yellow-700' },
  'reading_completed': { label: 'Leitura Concluída', color: 'bg-indigo-100 text-indigo-700' }, 
  'pending_sending': { label: 'Aguardando Envio', color: 'bg-blue-100 text-blue-700' },
  'completed': { label: 'Concluído', color: 'bg-green-100 text-green-700' },
};

const SalesPage = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { user } = useAuth();
  const navigate = useNavigate();

  const [bonusData, setBonusData] = useState([]);
  const [loadingBonus, setLoadingBonus] = useState(false);

  // Stats Counters
  const [totalCount, setTotalCount] = useState(0);
  const [pendingReadingCount, setPendingReadingCount] = useState(0);
  const [pendingSendingCount, setPendingSendingCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    if (user) {
      loadCounts();
      loadSales();
      fetchCurrentMonthBonus();
    }
  }, [user]);

  const loadCounts = async () => {
    try {
      let baseQuery = supabase.from('sales').select('*', { count: 'exact', head: true });
      let pendingReadingQuery = supabase.from('sales').select('*', { count: 'exact', head: true }).eq('status', 'pending_reading');
      let pendingSendingQuery = supabase.from('sales').select('*', { count: 'exact', head: true }).eq('status', 'pending_sending');
      let draftQuery = supabase.from('sales').select('*', { count: 'exact', head: true }).eq('status', 'draft');

      // Canonical Rule: Ensure counters only reflect the sales the current user is authorized to see
      if (user.role !== 'admin') {
        baseQuery = baseQuery.eq('seller_id', user.id);
        pendingReadingQuery = pendingReadingQuery.eq('seller_id', user.id);
        pendingSendingQuery = pendingSendingQuery.eq('seller_id', user.id);
        draftQuery = draftQuery.eq('seller_id', user.id);
      }

      const [
        { count: total },
        { count: pendingReading },
        { count: pendingSending },
        { count: draft }
      ] = await Promise.all([
        baseQuery,
        pendingReadingQuery,
        pendingSendingQuery,
        draftQuery
      ]);

      setTotalCount(total || 0);
      setPendingReadingCount(pendingReading || 0);
      setPendingSendingCount(pendingSending || 0);
      setDraftCount(draft || 0);
    } catch (error) {
      console.error('Error loading counts:', error);
    }
  };

  const fetchCurrentMonthBonus = async () => {
    try {
      setLoadingBonus(true);
      const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      let query = supabase
        .from('sales')
        .select('price, created_at, profiles(name), seller_id')
        .gte('created_at', firstDay.toISOString())
        .lte('created_at', lastDay.toISOString())
        .neq('status', 'draft');

      if (user.role !== 'admin') {
        query = query.eq('seller_id', user.id);
      }
      
      const { data: sales, error } = await query;

      if (error) throw error;

      const sellerMap = {};
      
      sales.forEach(sale => {
        const sellerName = sale.profiles?.name || 'Desconhecido';
        const sellerId = sale.seller_id;
        const salePrice = parseFloat(sale.price || 0);
        
        if (!sellerMap[sellerId]) {
          sellerMap[sellerId] = { 
            name: sellerName, 
            totalSales: 0, 
            bonus: 0, 
            todaySales: 0, 
            id: sellerId 
          };
        }
        
        sellerMap[sellerId].totalSales += salePrice;

        const saleDate = new Date(new Date(sale.created_at).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        
        if (
            saleDate.getDate() === now.getDate() && 
            saleDate.getMonth() === now.getMonth() && 
            saleDate.getFullYear() === now.getFullYear()
        ) {
            sellerMap[sellerId].todaySales += salePrice;
        }
      });

      let bonuses = Object.values(sellerMap).map(seller => ({
        id: seller.id,
        name: seller.name,
        totalSales: seller.totalSales,
        todaySales: seller.todaySales,
        bonus: seller.totalSales * 0.05
      })).sort((a,b) => b.bonus - a.bonus);

      if (user.role !== 'admin') {
        bonuses = bonuses.filter(b => b.id === user.id);
      }

      setBonusData(bonuses);

    } catch (error) {
      console.error('Error fetching bonuses:', error);
    } finally {
      setLoadingBonus(false);
    }
  };

  const loadSales = async () => {
    try {
      setLoading(true);
      let query = supabase.from('sales').select('*, profiles(name)').order('created_at', { ascending: false }).limit(100000);

      // Canonical Rule: Ensure the list matches the role-based filtering logic used in the counter
      if (user.role !== 'admin') {
        query = query.eq('seller_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const sortedData = (data || []).sort((a, b) => {
          const isDraftA = a.status === 'draft';
          const isDraftB = b.status === 'draft';

          if (isDraftA && !isDraftB) return -1;
          if (!isDraftA && isDraftB) return 1;

          return new Date(b.created_at) - new Date(a.created_at);
      });

      setSales(sortedData);
    } catch (error) {
      console.error('Error loading sales:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados de vendas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getQuestionCount = (sale) => {
    if (sale.questions_data && Array.isArray(sale.questions_data)) {
        return sale.questions_data.length;
    }
    if (sale.questions_json && Array.isArray(sale.questions_json)) {
        return sale.questions_json.length;
    }
    if (sale.questions) {
        return sale.questions.split('\n').filter(q => q.trim().length > 0).length;
    }
    return 0;
  };

  const filteredSales = sales.filter(sale => {
    const matchesSearch = 
      sale.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.friendly_id?.toString().includes(searchTerm) ||
      sale.whatsapp?.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || sale.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <Helmet>
        <title>Vendas - Gestão de Tarot</title>
      </Helmet>

      <div className="space-y-6">
        {/* Bonus Section */}
        <div className="bg-purple-900 rounded-xl p-6 text-white shadow-lg overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Gift className="w-48 h-48" />
            </div>
            <div className="relative z-10">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
                    <Gift className="w-6 h-6 text-yellow-400" />
                    Desempenho (Mês Atual)
                </h2>
                <p className="text-purple-200 text-sm mb-6 max-w-2xl">
                    {user.role === 'admin' 
                      ? "Visualização administrativa de vendas e bônus de todos os vendedores."
                      : "Seu volume de vendas e bônus de 5% acumulado no mês atual."
                    }
                    <span className="opacity-70 ml-2 text-xs border border-purple-400 rounded px-1">Exceto Rascunhos</span>
                </p>

                {loadingBonus ? (
                    <div className="flex items-center gap-2 text-purple-200">
                        <Loader2 className="w-4 h-4 animate-spin" /> Calculando...
                    </div>
                ) : bonusData.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {bonusData.map((data, idx) => (
                            <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10 hover:bg-white/20 transition-colors flex flex-col gap-2">
                                <div className="flex justify-between items-start">
                                    <p className="font-medium text-purple-100">{data.name}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-1">
                                    <div>
                                        <p className="text-xs text-purple-300 uppercase mb-0.5">Vendas (Mês)</p>
                                        <p className="text-lg font-bold text-white">R$ {data.totalSales.toFixed(2)}</p>
                                        
                                        {/* Today's Sales Integration */}
                                        <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-white/10">
                                            <span className="text-[10px] text-purple-200 uppercase tracking-wide">Hoje:</span>
                                            <span className="text-sm font-semibold text-green-300">R$ {data.todaySales.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-purple-300 uppercase mb-0.5">Bônus (5%)</p>
                                        <p className="text-lg font-bold text-yellow-400">R$ {data.bonus.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-purple-300 italic">Nenhuma venda registrada neste mês ainda.</p>
                )}
            </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Total de Vendas</p>
            <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Aguardando Leitura</p>
            <p className="text-2xl font-bold text-yellow-600">{pendingReadingCount}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Aguardando Envio</p>
            <p className="text-2xl font-bold text-blue-600">{pendingSendingCount}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Rascunhos</p>
            <p className="text-2xl font-bold text-gray-600">{draftCount}</p>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
             <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Buscar por nome, ID ou WhatsApp..." 
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-500 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
             
             <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                 <Filter className="w-4 h-4 text-gray-400 hidden md:block" />
                 <span className="text-sm text-gray-500 hidden md:block mr-2">Status:</span>
                 
                 <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        statusFilter === 'all' 
                        ? 'bg-gray-800 text-white' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                 >
                    Todos
                 </button>
                 <button
                    onClick={() => setStatusFilter('draft')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        statusFilter === 'draft' 
                        ? 'bg-gray-600 text-white' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                 >
                    Rascunhos
                 </button>
                 <button
                    onClick={() => setStatusFilter('pending_reading')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        statusFilter === 'pending_reading' 
                        ? 'bg-yellow-500 text-white' 
                        : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                    }`}
                 >
                    Aguardando Leitura
                 </button>
                 <button
                    onClick={() => setStatusFilter('pending_sending')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        statusFilter === 'pending_sending' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                 >
                    Aguardando Envio
                 </button>
             </div>
        </div>

        {/* Sales List */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {loading ? (
             <div className="flex justify-center items-center py-20">
               <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
             </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Origem</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider" title="Quantidade de Perguntas">Qtd.</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Valor</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Vendedor</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                          <Search className="w-8 h-8 text-gray-300" />
                          <p>Nenhuma venda encontrada para o filtro selecionado.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale, index) => (
                    <motion.tr
                      key={sale.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="hover:bg-gray-50/80 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-900">
                             {sale.friendly_id ? `#${sale.friendly_id}` : '...'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-purple-600">
                                {sale.customer_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                              <p className="text-sm font-medium text-gray-900">{sale.customer_name}</p>
                              {sale.customer_birth_date && (
                                  <p className="text-xs text-gray-400">{new Date(sale.customer_birth_date).toLocaleDateString('pt-BR')}</p>
                              )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {sale.controle_de_leads ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100 truncate max-w-[120px]" title={sale.controle_de_leads}>
                                <Target className="w-3 h-3 mr-1" />
                                {sale.controle_de_leads}
                            </span>
                        ) : (
                            <span className="text-xs text-gray-400 italic">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[sale.status]?.color || 'bg-gray-100 text-gray-700'}`}>
                          {statusConfig[sale.status]?.label || sale.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-md text-xs font-medium text-gray-600" title={`${getQuestionCount(sale)} perguntas nesta leitura`}>
                            <HelpCircle className="w-3 h-3 text-purple-500" />
                            {getQuestionCount(sale)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-green-700">
                            R$ {sale.price ? Number(sale.price).toFixed(2) : '0.00'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-md">
                        {sale.profiles?.name || 'Sistema'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700">{formatDate(sale.created_at)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/sales/${sale.id}`)}
                          className="hover:bg-purple-50 text-purple-600 hover:text-purple-700"
                        >
                          {sale.status === 'draft' ? <FileEdit className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                          {sale.status === 'draft' ? 'Continuar' : 'Detalhes'}
                        </Button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SalesPage;