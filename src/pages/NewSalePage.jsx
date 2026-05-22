import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, User, HelpCircle, Sparkles, Loader2, Wand2, CreditCard, Save, Calendar, Phone, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { summarizeContext, optimizeQuestion } from '@/lib/aiUtils';
import MultiFileUpload from '@/components/MultiFileUpload';
import { useLeadSources } from '@/hooks/useLeadSources';

const NewSalePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { fetchActiveLeadSources } = useLeadSources();
  const [loading, setLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  
  // Form States
  const [customerName, setCustomerName] = useState('');
  const [customerBirthDate, setCustomerBirthDate] = useState(''); 
  const [whatsapp, setWhatsapp] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [summary, setSummary] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [price, setPrice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [observations, setObservations] = useState('');
  
  // Custom Date (Sale Date)
  const [createdAt, setCreatedAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  
  // Dynamic Fields
  const [additionalPeople, setAdditionalPeople] = useState([]);
  const [questions, setQuestions] = useState(['']);
  const [optimizingIndex, setOptimizingIndex] = useState(null);
  
  // File Upload
  const [uploadedFiles, setUploadedFiles] = useState([]);

  // Suggestions
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  const [leadSourceOptions, setLeadSourceOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true);
      const { success, data } = await fetchActiveLeadSources();
      if (success) {
        setLeadSourceOptions(data);
      }
      setLoadingOptions(false);
    };
    loadOptions();
  }, []);

  // Date Mask Function
  const handleDateChange = (e) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    if (value.length > 8) value = value.slice(0, 8); // Limit to 8 digits

    if (value.length >= 5) {
      value = `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`;
    } else if (value.length >= 3) {
      value = `${value.slice(0, 2)}/${value.slice(2)}`;
    }
    setCustomerBirthDate(value);
  };

  // Phone Number Validation
  const validatePhoneNumber = (phone) => {
    if (!phone || phone.trim() === '') return false;
    // Allow numbers, +, -, spaces, parentheses
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  };

  const handleWhatsappChange = (e) => {
    const value = e.target.value;
    setWhatsapp(value);
  };

  // Search for previous customers
  useEffect(() => {
    const searchCustomers = async () => {
      if (customerName.length < 3) {
        setSuggestions([]);
        return;
      }

      const { data, error } = await supabase
        .from('sales')
        .select('customer_name, customer_birth_date, summary, additional_people, whatsapp, controle_de_leads')
        .ilike('customer_name', `%${customerName}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        const uniqueCustomers = [];
        const seenNames = new Set();

        for (const item of data) {
            const normalizedName = item.customer_name.trim().toLowerCase();
            if (!seenNames.has(normalizedName)) {
                seenNames.add(normalizedName);
                uniqueCustomers.push(item);
            }
            if (uniqueCustomers.length >= 5) break; 
        }
        setSuggestions(uniqueCustomers);
        setShowSuggestions(true);
      }
    };

    const timeoutId = setTimeout(searchCustomers, 300);
    return () => clearTimeout(timeoutId);
  }, [customerName]);

  const selectCustomer = (customer) => {
    setCustomerName(customer.customer_name);
    
    if (customer.customer_birth_date) {
        const [year, month, day] = customer.customer_birth_date.split('-');
        setCustomerBirthDate(`${day}/${month}/${year}`);
    } else {
        setCustomerBirthDate('');
    }

    if (customer.whatsapp) setWhatsapp(customer.whatsapp);
    if (customer.controle_de_leads) setLeadSource(customer.controle_de_leads);
    if (customer.summary) setSummary(customer.summary);
    
    if (customer.additional_people && Array.isArray(customer.additional_people) && customer.additional_people.length > 0) {
        setAdditionalPeople(customer.additional_people);
        toast({ title: "Dados recuperados", description: "Informações do cliente copiadas do histórico." });
    } else {
        toast({ title: "Dados recuperados", description: "Informações básicas copiadas da venda anterior." });
    }
    setShowSuggestions(false);
  };

  const addPerson = () => setAdditionalPeople([...additionalPeople, { name: '', birthDate: '', relationship: '' }]);
  const removePerson = (index) => setAdditionalPeople(additionalPeople.filter((_, i) => i !== index));
  const updatePerson = (index, field, value) => {
    const newPeople = [...additionalPeople];
    newPeople[index][field] = value;
    setAdditionalPeople(newPeople);
  };

  const addQuestion = () => setQuestions([...questions, '']);
  const removeQuestion = (index) => questions.length > 1 && setQuestions(questions.filter((_, i) => i !== index));
  const updateQuestion = (index, value) => {
    const newQuestions = [...questions];
    newQuestions[index] = value;
    setQuestions(newQuestions);
  };

  const handleOptimizeQuestion = async (index) => {
    const questionText = questions[index];
    if (!questionText || questionText.length < 5) return;

    const hasAdditionalPeople = additionalPeople.length > 0;
    const hasEmptyNames = additionalPeople.some(p => !p.name || p.name.trim() === '');

    if (!hasAdditionalPeople || hasEmptyNames) {
        toast({ title: "Atenção", description: "Adicione as pessoas envolvidas primeiro.", variant: "destructive" });
        return; 
    }

    setOptimizingIndex(index);
    try {
        const optimized = await optimizeQuestion(customerName, additionalPeople, questionText);
        updateQuestion(index, optimized);
        toast({ title: "Otimizada", description: "Nomes inseridos." });
    } catch (error) {
        toast({ title: "Erro", description: "Falha ao otimizar.", variant: "destructive" });
    } finally {
        setOptimizingIndex(null);
    }
  };

  const handleSummarize = async () => {
    if (!summary || summary.length < 10) {
        toast({ title: "Muito curto", description: "Escreva mais detalhes.", variant: "destructive" });
        return;
    }
    setSummarizing(true);
    try {
        const summarizedText = await summarizeContext({
            customer_name: customerName,
            customer_birth_date: customerBirthDate, 
            additional_people: additionalPeople,
            summary: summary
        });
        setSummary(summarizedText);
        toast({ title: "Resumo Gerado", description: "Otimizado com IA." });
    } catch (error) {
        toast({ title: "Erro", description: "Falha ao resumir.", variant: "destructive" });
    } finally {
        setSummarizing(false);
    }
  };

  const handleSubmit = async (e, isDraft = false) => {
    e.preventDefault();
    if (loading) return;

    if (!customerName) {
         toast({ title: "Nome obrigatório", description: "Insira o nome.", variant: "destructive" });
         return;
    }
    if (!whatsapp || whatsapp.trim() === '') {
        toast({ title: "WhatsApp obrigatório", description: "WhatsApp é obrigatório.", variant: "destructive" });
        return;
    }
    if (!validatePhoneNumber(whatsapp)) {
        toast({ title: "WhatsApp inválido", description: "Mínimo 10 dígitos.", variant: "destructive" });
        return;
    }
    if (!leadSource && !isDraft) {
        toast({ title: "Origem obrigatória", description: "Selecione Controle de Leads.", variant: "destructive" });
        return;
    }

    let formattedBirthDate = null;
    if (customerBirthDate) {
        const datePattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
        const match = customerBirthDate.match(datePattern);
        
        if (match) {
            const day = parseInt(match[1], 10), month = parseInt(match[2], 10), year = parseInt(match[3], 10);
            const currentYear = new Date().getFullYear();
            const dateObj = new Date(year, month - 1, day);
            const isRealDate = dateObj.getFullYear() === year && dateObj.getMonth() === month - 1 && dateObj.getDate() === day;

            if (year >= 1900 && year <= currentYear + 1 && month >= 1 && month <= 12 && day >= 1 && day <= 31 && isRealDate) {
                 formattedBirthDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            } else {
                 if (!isDraft) return toast({ title: "Data Inválida", description: "Data inexistente.", variant: "destructive" });
                 formattedBirthDate = null;
            }
        } else {
             if (!isDraft) return toast({ title: "Formato Inválido", description: "Use DD/MM/AAAA", variant: "destructive" });
             formattedBirthDate = null;
        }
    } else if (!isDraft) {
        return toast({ title: "Data obrigatória", description: "Obrigatória para finalizar.", variant: "destructive" });
    }

    const saleDateObj = new Date(createdAt);
    if (isNaN(saleDateObj.getTime()) || saleDateObj.getFullYear() < 2000 || saleDateObj.getFullYear() > 2100) {
        return toast({ title: "Data Venda Inválida", description: "Verifique o ano.", variant: "destructive" });
    }

    if (!isDraft && (!summary || !price || !paymentMethod)) {
        return toast({ title: "Campos obrigatórios", description: "Resumo, Preço e Pagamento são obrigatórios.", variant: "destructive" });
    }

    setLoading(true);

    try {
      const filteredQuestions = questions.filter(q => q.trim() !== '');
      const initialQuestionsData = filteredQuestions.map(q => ({ question: q, imageUrl: null, cardName: null, interpretation: null, audioUrl: null }));

      const saleData = {
        customer_name: customerName,
        customer_birth_date: formattedBirthDate,
        whatsapp: whatsapp.trim(),
        controle_de_leads: leadSource || 'Não Especificado',
        summary: summary || (isDraft ? 'Rascunho' : ''), 
        internal_notes: internalNotes,
        price: price ? parseFloat(price) : null,
        payment_method: paymentMethod || null,
        observations,
        additional_people: additionalPeople,
        questions_json: filteredQuestions,
        questions: filteredQuestions.join('\n'), 
        payment_proof_url: uploadedFiles.length > 0 ? uploadedFiles[0] : null,
        files_urls: uploadedFiles,
        seller_id: user.id,
        status: isDraft ? 'draft' : 'pending_reading',
        questions_data: initialQuestionsData,
        created_at: saleDateObj.toISOString()
      };

      const { error } = await supabase.from('sales').insert(saleData);
      if (error) throw error;

      toast({ title: isDraft ? "Rascunho salvo!" : "Venda criada!", description: "Sucesso." });
      navigate('/sales');
    } catch (error) {
      toast({ title: "Erro", description: error.message || "Erro desconhecido", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet><title>Nova Venda - Painel de Vendas Megumi Tarot</title></Helmet>
      <div className="max-w-4xl mx-auto pb-12">
        <Button variant="ghost" onClick={() => navigate('/sales')} className="mb-6 gap-2 hover:bg-white/50">
          <ArrowLeft className="w-4 h-4" /> Voltar para Vendas
        </Button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
            <div>
                <h2 className="text-xl font-bold text-gray-900">Nova Venda</h2>
                <p className="text-sm text-gray-500 mt-1">Preencha os dados do cliente e do pedido</p>
            </div>
             <div className="flex flex-col items-end gap-1">
                <label className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                   <Calendar className="w-3 h-3" /> Data da Venda
                </label>
                <input 
                    type="datetime-local" value={createdAt} onChange={(e) => setCreatedAt(e.target.value)}
                    className="text-sm border border-gray-200 rounded px-2 py-1 bg-white focus:border-purple-500 outline-none"
                />
             </div>
          </div>

          <form onSubmit={(e) => handleSubmit(e, false)} className="p-6 space-y-8">
            {/* Section 1 */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4 text-purple-600" /> Dados do Cliente
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                    onFocus={() => customerName.length >= 3 && setShowSuggestions(true)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
                    placeholder="Ex: Maria Silva" required
                  />
                  
                  <AnimatePresence>
                    {showSuggestions && suggestions.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto"
                      >
                         {suggestions.map((s, i) => (
                           <button key={i} type="button" onClick={() => selectCustomer(s)} className="w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors border-b border-gray-50 last:border-0">
                             <p className="font-medium text-gray-900 text-sm">{s.customer_name}</p>
                             {s.customer_birth_date && <p className="text-xs text-gray-500">Nasc: {new Date(s.customer_birth_date).toLocaleDateString('pt-BR')}</p>}
                             {s.whatsapp && <p className="text-xs text-green-600 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {s.whatsapp}</p>}
                           </button>
                         ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data de Nascimento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text" value={customerBirthDate} onChange={handleDateChange}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
                    placeholder="DD/MM/AAAA" maxLength={10}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      WhatsApp <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text" value={whatsapp} onChange={handleWhatsappChange}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
                        placeholder="Ex: +55 11 98765-4321" required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
                      <span>Controle de Leads <span className="text-red-500">*</span></span>
                      {loadingOptions && <Loader2 className="w-3 h-3 animate-spin text-purple-600" />}
                    </label>
                    <div className="relative">
                        <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select
                            value={leadSource} onChange={(e) => setLeadSource(e.target.value)} disabled={loadingOptions}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all bg-white disabled:bg-gray-50"
                        >
                            <option value="">Selecione a origem...</option>
                            {leadSourceOptions.map((option) => (
                                <option key={option.id} value={option.name}>{option.name}</option>
                            ))}
                        </select>
                    </div>
                  </div>
              </div>

              {/* Additional People */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Pessoas Adicionais (Opcional)</label>
                  <Button type="button" variant="outline" size="sm" onClick={addPerson} className="h-8 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Adicionar Pessoa
                  </Button>
                </div>
                {additionalPeople.map((person, index) => (
                  <div key={index} className="flex flex-col md:flex-row gap-3 items-start p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                      <input type="text" placeholder="Nome" value={person.name} onChange={(e) => updatePerson(index, 'name', e.target.value)} className="w-full px-3 py-1.5 rounded-md border border-gray-200 text-sm" />
                      <input type="text" placeholder="DD/MM/AAAA" value={person.birthDate} onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, '').slice(0, 8);
                            if (val.length >= 5) val = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4)}`;
                            else if (val.length >= 3) val = `${val.slice(0, 2)}/${val.slice(2)}`;
                            updatePerson(index, 'birthDate', val)
                        }} className="w-full px-3 py-1.5 rounded-md border border-gray-200 text-sm" />
                      <input type="text" placeholder="Relacionamento" value={person.relationship || ''} onChange={(e) => updatePerson(index, 'relationship', e.target.value)} className="w-full px-3 py-1.5 rounded-md border border-gray-200 text-sm" />
                    </div>
                    <button type="button" onClick={() => removePerson(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors self-end md:self-auto"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </section>

            <hr className="border-gray-100" />

            {/* Section 2 */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-purple-600" /> Detalhes da Leitura
              </h3>
              <div>
                <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700">Resumo / Contexto <span className="text-red-500">*</span></label>
                    <Button type="button" variant="ghost" size="sm" onClick={handleSummarize} disabled={summarizing} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 h-6 text-xs">
                        {summarizing ? <Loader2 className="w-3 h-3 animate-spin mr-1"/> : <Sparkles className="w-3 h-3 mr-1" />} Otimizar com IA
                    </Button>
                </div>
                <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all resize-none" placeholder="Descreva o contexto geral..." />
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Perguntas</label>
                {questions.map((question, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="flex-1 relative">
                       <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400">#{index + 1}</span>
                       <input type="text" value={question} onChange={(e) => updateQuestion(index, e.target.value)} className="w-full pl-8 pr-24 py-2 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all" placeholder={`Digite a pergunta ${index + 1}`} />
                      <button type="button" onClick={() => handleOptimizeQuestion(index)} disabled={optimizingIndex === index} className="absolute right-2 top-1.5 text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded hover:bg-purple-100 flex items-center gap-1">
                         {optimizingIndex === index ? <Loader2 className="w-3 h-3 animate-spin"/> : <Wand2 className="w-3 h-3"/>} Otimizar
                      </button>
                    </div>
                    {questions.length > 1 && <button type="button" onClick={() => removeQuestion(index)} className="p-2 text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                ))}
                <Button type="button" variant="ghost" onClick={addQuestion} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 gap-2 w-full border border-dashed border-purple-200"><Plus className="w-4 h-4" /> Adicionar outra pergunta</Button>
              </div>
            </section>

            <hr className="border-gray-100" />

             {/* Section 3 */}
             <section className="space-y-4">
               <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-purple-600" /> Pagamento e Notas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$) <span className="text-red-500">*</span></label>
                    <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all" placeholder="0.00" step="0.01" min="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pagamento <span className="text-red-500">*</span></label>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all bg-white">
                      <option value="">Selecione...</option>
                      <option value="pix">Pix</option>
                      <option value="credit_card">Cartão de Crédito</option>
                      <option value="transfer_euro">Transferência (Euro)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notas Internas (Opcional)</label>
                    <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={3} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all resize-none text-sm" placeholder="Anotações visíveis apenas para vendedores..." />
                  </div>
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Comprovante(s) de Pagamento</label>
                  <MultiFileUpload value={uploadedFiles} onChange={setUploadedFiles} folder="payments" />
                  <p className="text-xs text-gray-500 mt-2">Aceita imagens e PDFs. Envie múltiplos arquivos.</p>
                </div>
              </div>
             </section>

             <div className="pt-6 flex gap-4">
                <Button type="button" variant="secondary" onClick={(e) => handleSubmit(e, true)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800" disabled={loading}>
                   <Save className="w-4 h-4 mr-2" /> Salvar Rascunho
                </Button>
                <Button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700" disabled={loading}>
                    {loading ? 'Processando...' : 'Criar Venda'}
                </Button>
             </div>
          </form>
        </motion.div>
      </div>
    </>
  );
};

export default NewSalePage;