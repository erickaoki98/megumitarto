import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { DollarSign, ShoppingCart, Users, Loader2, Calendar, Target, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';
import { Button } from '@/components/ui/button';
import { getSaoPauloDate, formatDate } from '@/lib/dateUtils';

// Helper to format Date object to YYYY-MM-DD using local time components.
// This is used with "shifted" date objects where the local time matches the target timezone.
// Using .toISOString() is unsafe for shifted dates as it converts to UTC, potentially changing the day.
const formatToYMD = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const ReportsPage = () => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  
  // Filter States - Initially empty to enforce selection or set defaults
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  useEffect(() => {
    if (startDate && endDate) {
        fetchReports();
    } else {
        setReportData(null);
    }
  }, [startDate, endDate]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      
      // Construct ISO strings for the exact start and end of the day in São Paulo (-03:00)
      // This ensures the DB query respects the timezone regardless of user's local browser time.
      const queryStart = new Date(`${startDate}T00:00:00-03:00`).toISOString();
      const queryEnd = new Date(`${endDate}T23:59:59.999-03:00`).toISOString();
      
      const { data: sales, error } = await supabase
        .from('sales')
        .select('*, profiles(name)')
        .gte('created_at', queryStart)
        .lte('created_at', queryEnd)
        .neq('status', 'draft')
        .order('created_at', { ascending: true });
      
      if (error) throw error;

      // 1. Stats calculation
      const totalSalesCount = sales.length;
      const totalRevenue = sales.reduce((sum, sale) => sum + parseFloat(sale.price || 0), 0);

      // 2. Sales by Seller
      const sellerMap = {};
      sales.forEach(sale => {
        const sellerName = sale.profiles?.name || 'Desconhecido';
        if (!sellerMap[sellerName]) {
          sellerMap[sellerName] = {
            name: sellerName,
            count: 0,
            revenue: 0
          };
        }
        sellerMap[sellerName].count++;
        sellerMap[sellerName].revenue += parseFloat(sale.price || 0);
      });
      const salesBySeller = Object.values(sellerMap).sort((a,b) => b.revenue - a.revenue);

      // 3. Lead Control Analysis (Controle de Leads)
      const leadsMap = {};
      sales.forEach(sale => {
          const source = sale.controle_de_leads || 'Não Especificado';
          if (!leadsMap[source]) {
              leadsMap[source] = { name: source, count: 0, revenue: 0 };
          }
          leadsMap[source].count++;
          leadsMap[source].revenue += parseFloat(sale.price || 0);
      });

      // Calculate percentages and sort by count
      const leadsAnalysis = Object.values(leadsMap)
        .map(lead => ({
            ...lead,
            percentage: totalSalesCount > 0 ? (lead.count / totalSalesCount) * 100 : 0,
            avgTicket: lead.count > 0 ? lead.revenue / lead.count : 0
        }))
        .sort((a, b) => b.count - a.count);

      // 4. Chart Data
      const chartMap = {};
      
      // Create iteration bounds using the "shifted" date approach to safely iterate days in SP context
      const sDate = new Date(`${startDate}T12:00:00`); // Use noon to avoid DST/timezone edge cases during iteration
      const eDate = new Date(`${endDate}T12:00:00`);

      for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
           const day = String(d.getDate()).padStart(2, '0');
           const month = String(d.getMonth() + 1).padStart(2, '0');
           const dateKey = `${day}/${month}`;
           chartMap[dateKey] = 0;
      }

      sales.forEach(sale => {
          // Convert UTC timestamp to SP formatted date for grouping
          const saleDate = new Date(sale.created_at);
          const dateKey = new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit'
          }).format(saleDate);

          if (chartMap[dateKey] !== undefined) {
             chartMap[dateKey] += parseFloat(sale.price || 0);
          }
      });

      const chartData = Object.entries(chartMap).map(([date, revenue]) => ({
          date,
          revenue
      }));

      setReportData({
        totalSalesCount,
        totalRevenue,
        salesBySeller,
        leadsAnalysis,
        chartData
      });

    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFilter = (type) => {
      // Use helper to get the current time in SP "shifted" to a local Date object
      // This means getHours(), getDate() etc will return values corresponding to SP time.
      const now = getSaoPauloDate(); 
      let start = new Date(now);
      let end = new Date(now);

      if (type === 'today') {
        // Start and End are same day
      } else if (type === 'yesterday') {
        start.setDate(now.getDate() - 1);
        end.setDate(now.getDate() - 1);
      } else if (type === 'currentMonth') {
        start.setDate(1); // Set to 1st day of current month
        // end remains 'now' (today)
      } else if (type === 'last7') {
        start.setDate(now.getDate() - 7);
      } else if (type === 'last30') {
        start.setDate(now.getDate() - 30);
      }
      
      // Use helper to format YYYY-MM-DD from the local components of the shifted date.
      // Do NOT use toISOString() here as it would convert to UTC, causing day shifts 
      // if the browser timezone is west of UTC (like Americas).
      setStartDate(formatToYMD(start));
      setEndDate(formatToYMD(end));
  };

  // Helper for colors in charts/UI
  const COLORS = ['#9333ea', '#db2777', '#2563eb', '#16a34a', '#d97706', '#dc2626'];

  return (
    <>
      <Helmet>
        <title>Relatórios - Painel de Vendas Megumi Tarot</title>
      </Helmet>

      <div className="space-y-6">
        {/* Filters Panel */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 <div>
                     <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-purple-600" />
                        Relatório Geral de Vendas
                     </h2>
                     <p className="text-sm text-gray-500">
                         Selecione as datas para visualizar o histórico. 
                         <span className="text-xs ml-1 text-purple-600">(Fuso: Brasília)</span>
                     </p>
                 </div>
                 
                 <div className="flex flex-wrap gap-2">
                     <Button variant="outline" size="sm" onClick={() => handleQuickFilter('today')}>Hoje</Button>
                     <Button variant="outline" size="sm" onClick={() => handleQuickFilter('yesterday')}>Ontem</Button>
                     <Button variant="secondary" size="sm" onClick={() => handleQuickFilter('currentMonth')} className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-transparent">Mês Atual</Button>
                     <Button variant="outline" size="sm" onClick={() => handleQuickFilter('last7')}>Últimos 7 dias</Button>
                     <Button variant="outline" size="sm" onClick={() => handleQuickFilter('last30')}>Últimos 30 dias</Button>
                 </div>
             </div>

             <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
                 <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Data Início</label>
                    <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Data Fim</label>
                    <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                 </div>
             </div>
        </div>

        {/* Content Area */}
        {loading ? (
             <div className="flex justify-center py-12">
                 <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
             </div>
        ) : !reportData ? (
             <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                 <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                     <Calendar className="w-8 h-8 text-purple-500" />
                 </div>
                 <h3 className="text-lg font-medium text-gray-900">Nenhum período selecionado</h3>
                 <p className="text-gray-500 text-sm mt-1 max-w-sm text-center">
                     Por favor, selecione uma data de início e fim acima para gerar o relatório de vendas e métricas.
                 </p>
             </div>
        ) : (
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
            >
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <ShoppingCart className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total de Vendas Confirmadas</p>
                        <p className="text-2xl font-bold text-gray-900">{reportData.totalSalesCount}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Receita Total</p>
                        <p className="text-2xl font-bold text-gray-900">R$ {reportData.totalRevenue.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                        <Users className="w-6 h-6 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Vendedores Ativos</p>
                        <p className="text-2xl font-bold text-gray-900">{reportData.salesBySeller.length}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Revenue Chart */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">
                        Evolução da Receita 
                        <span className="text-sm font-normal text-gray-500 ml-2">
                             ({new Date(`${startDate}T12:00:00`).toLocaleDateString('pt-BR')} - {new Date(`${endDate}T12:00:00`).toLocaleDateString('pt-BR')})
                        </span>
                    </h3>

                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={reportData.chartData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#9333ea" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis 
                                    dataKey="date" 
                                    tick={{fontSize: 12, fill: '#6b7280'}} 
                                    axisLine={false}
                                    tickLine={false}
                                    minTickGap={30}
                                />
                                <YAxis 
                                    tick={{fontSize: 12, fill: '#6b7280'}} 
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(value) => `R$${value}`}
                                />
                                <Tooltip 
                                    formatter={(value) => [`R$ ${value.toFixed(2)}`, 'Receita']}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="revenue" 
                                    stroke="#9333ea" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorRevenue)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Lead Performance Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Target className="w-5 h-5 text-purple-600" />
                            Performance por Canal (Leads)
                        </h2>
                    </div>
                    
                    {reportData.leadsAnalysis.length === 0 ? (
                        <p className="text-gray-500 text-sm">Nenhum dado de origem de lead disponível para este período.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {reportData.leadsAnalysis.map((lead, idx) => (
                                <div key={idx} className="flex flex-col p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-purple-200 transition-colors">
                                    <div className="flex justify-between items-start mb-3">
                                        <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                                            idx === 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-200 text-gray-700'
                                        }`}>
                                            #{idx + 1}
                                        </span>
                                        <span className="text-xs font-medium text-gray-500">{lead.percentage.toFixed(1)}% do total</span>
                                    </div>
                                    
                                    <h3 className="font-bold text-gray-900 text-lg mb-1 truncate" title={lead.name}>
                                        {lead.name}
                                    </h3>
                                    
                                    <div className="mt-auto pt-3 flex items-end justify-between border-t border-gray-200">
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-semibold">Volume</p>
                                            <p className="text-sm font-medium text-gray-900">{lead.count} vendas</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500 uppercase font-semibold">Receita</p>
                                            <p className="text-sm font-bold text-purple-700">R$ {lead.revenue.toFixed(2)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Sales by Seller List */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Ranking de Vendedores</h2>
                  
                  {reportData.salesBySeller.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Nenhuma venda encontrada neste período.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reportData.salesBySeller.map((seller, index) => (
                        <div
                          key={seller.name}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-sm font-bold text-purple-700">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{seller.name}</p>
                              <p className="text-sm text-gray-500">{seller.count} vendas</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-900">R$ {seller.revenue.toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
            </motion.div>
        )}
      </div>
    </>
  );
};

export default ReportsPage;