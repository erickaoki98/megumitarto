import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, User, Clock, FileText, Sparkles, Volume2, 
  Loader2, Upload, Calendar, Users, Lock, Trash2, 
  Camera, Download, Edit3, Wand2, CreditCard,
  ChevronDown, Check, Plus, X, Save, Phone, Copy, Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { formatDate } from '@/lib/dateUtils';
import CameraCapture from '@/components/CameraCapture';
import MultiFileUpload from '@/components/MultiFileUpload';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { generateReadingText, generateAudioFromText, optimizeQuestion, summarizeContext } from '@/lib/aiUtils';
import { useLeadSources } from '@/hooks/useLeadSources';

const statusConfig = {
  'draft': { label: 'Rascunho', color: 'bg-gray-200 text-gray-700 border border-gray-300' },
  'pending_reading': { label: 'Aguardando Leitura', color: 'bg-yellow-100 text-yellow-700' },
  'reading_completed': { label: 'Leitura Concluída', color: 'bg-indigo-100 text-indigo-700' },
  'pending_sending': { label: 'Aguardando Envio', color: 'bg-blue-100 text-blue-700' },
  'completed': { label: 'Concluído', color: 'bg-green-100 text-green-700' },
};

const paymentMethodConfig = {
    'pix': 'Pix',
    'credit_card': 'Cartão de Crédito',
    'transfer_euro': 'Transferência (Euro)'
};

const SaleDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { fetchActiveLeadSources } = useLeadSources();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sellers, setSellers] = useState([]);
  
  // Options
  const [leadSourceOptions, setLeadSourceOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Workflow State
  const [questionsData, setQuestionsData] = useState([]);
  const [analyzingIndex, setAnalyzingIndex] = useState(null);
  const [generatingTextIndex, setGeneratingTextIndex] = useState(null);
  const [generatingAudioIndex, setGeneratingAudioIndex] = useState(null);
  const [optimizingQuestionIndex, setOptimizingQuestionIndex] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingTextIndex, setEditingTextIndex] = useState(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(null);
  const [editingQuestionValue, setEditingQuestionValue] = useState('');
  const [editingWhatsapp, setEditingWhatsapp] = useState(false);
  const [whatsappValue, setWhatsappValue] = useState('');
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [cameraOpenForIndex, setCameraOpenForIndex] = useState(null);

  // Sale Editing State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    customer_name: '', customer_birth_date: '', whatsapp: '', controle_de_leads: '', price: '', payment_method: '',
    internal_notes: '', summary: '', additional_people: [], seller_id: '', files_urls: []
  });
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    loadSale();
    fetchSellers();
    loadOptions();
  }, [id]);

  const loadOptions = async () => {
    setLoadingOptions(true);
    const { success, data } = await fetchActiveLeadSources();
    if (success) setLeadSourceOptions(data);
    setLoadingOptions(false);
  };

  useEffect(() => {
    if (sale) {
      let initialFiles = [];
      if (sale.files_urls && Array.isArray(sale.files_urls) && sale.files_urls.length > 0) {
        initialFiles = sale.files_urls;
      } else if (sale.payment_proof_url) {
        initialFiles = [sale.payment_proof_url];
      }

      setEditFormData({
        customer_name: sale.customer_name || '',
        customer_birth_date: sale.customer_birth_date || '',
        whatsapp: sale.whatsapp || '',
        controle_de_leads: sale.controle_de_leads || 'Não Especificado',
        price: sale.price || '',
        payment_method: sale.payment_method || 'pix',
        internal_notes: sale.internal_notes || '',
        summary: sale.summary || '',
        additional_people: sale.additional_people ? [...sale.additional_people] : [],
        seller_id: sale.seller_id || '',
        files_urls: initialFiles
      });
      setWhatsappValue(sale.whatsapp || '');
    }
  }, [sale]);

  const fetchSellers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('name');
    if (data) setSellers(data);
  };

  const loadSale = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('sales').select('*, profiles(name)').eq('id', id).single();
      if (error) throw error;
      setSale(data);
      
      let initQuestions = [];
      if (data.questions_data && data.questions_data.length > 0) {
        initQuestions = data.questions_data;
      } else {
        if (data.questions_json && Array.isArray(data.questions_json)) {
          initQuestions = data.questions_json.map(q => ({ question: q, imageUrl: null, cardName: null, interpretation: null, audioUrl: null }));
        } else if (data.questions) {
            initQuestions = data.questions.split('\n').filter(Boolean).map(q => ({ question: q, imageUrl: null, cardName: null, interpretation: null, audioUrl: null }));
        } else {
          initQuestions = [{ question: "Leitura Geral", imageUrl: null, cardName: null, interpretation: null, audioUrl: null }];
        }
      }
      setQuestionsData(initQuestions);
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao carregar venda.", variant: "destructive" });
      navigate('/sales');
    } finally {
      setLoading(false);
    }
  };

  const updateSaleQuestions = async (newQuestions) => {
    try {
        const { error } = await supabase.from('sales').update({ questions_data: newQuestions }).eq('id', sale.id);
        if (error) throw error;
        setQuestionsData(newQuestions);
        setSale(prev => ({ ...prev, questions_data: newQuestions }));
    } catch (error) {
        toast({ title: "Erro de salvamento", description: "Não foi possível salvar os dados.", variant: "destructive" });
    }
  };

  const updateSaleStatus = async (newStatus) => {
    try {
      const { error } = await supabase.from('sales').update({ status: newStatus }).eq('id', sale.id);
      if (error) throw error;
      setSale(prev => ({ ...prev, status: newStatus }));
      toast({ title: "Status atualizado", description: `Status alterado para ${statusConfig[newStatus]?.label}` });
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao atualizar status.", variant: "destructive" });
    }
  };

  const handleCopyWhatsapp = async () => {
    if (!sale.whatsapp) return;
    try {
      await navigator.clipboard.writeText(sale.whatsapp);
      toast({ title: "Copiado!", description: "Número do WhatsApp copiado." });
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível copiar.", variant: "destructive" });
    }
  };

  const validatePhoneNumber = (phone) => {
    if (!phone || phone.trim() === '') return false;
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  };

  const handleSaveWhatsapp = async () => {
    const valueToSave = whatsappValue.trim();
    if (valueToSave !== '' && !validatePhoneNumber(valueToSave)) {
      return toast({ title: "WhatsApp inválido", description: "Mínimo 10 dígitos.", variant: "destructive" });
    }
    setSavingWhatsapp(true);
    try {
      const { error } = await supabase.from('sales').update({ whatsapp: valueToSave || null }).eq('id', sale.id);
      if (error) throw error;
      setSale(prev => ({ ...prev, whatsapp: valueToSave }));
      setEditingWhatsapp(false);
      toast({ title: "Atualizado", description: "WhatsApp salvo com sucesso." });
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao atualizar.", variant: "destructive" });
    } finally {
      setSavingWhatsapp(false);
    }
  };

  const handleSummarize = async () => {
    if (!editFormData.summary || editFormData.summary.length < 10) return toast({ title: "Texto muito curto", description: "Escreva mais detalhes.", variant: "destructive" });
    setSummarizing(true);
    try {
        const summarizedText = await summarizeContext({
            customer_name: editFormData.customer_name,
            customer_birth_date: editFormData.customer_birth_date,
            additional_people: editFormData.additional_people,
            summary: editFormData.summary
        });
        setEditFormData(prev => ({ ...prev, summary: summarizedText }));
        toast({ title: "Resumo Gerado", description: "Otimizado pela IA." });
    } catch (error) {
        toast({ title: "Erro", description: "Falha ao resumir.", variant: "destructive" });
    } finally {
        setSummarizing(false);
    }
  };

  const handleSaveSaleDetails = async () => {
    if (editFormData.whatsapp && editFormData.whatsapp.trim() !== '' && !validatePhoneNumber(editFormData.whatsapp)) {
      return toast({ title: "WhatsApp inválido", description: "Mínimo 10 dígitos.", variant: "destructive" });
    }
    try {
      const { error } = await supabase.from('sales').update({
          customer_name: editFormData.customer_name,
          customer_birth_date: editFormData.customer_birth_date || null,
          whatsapp: editFormData.whatsapp ? editFormData.whatsapp.trim() : null,
          controle_de_leads: editFormData.controle_de_leads || 'Não Especificado',
          price: editFormData.price ? parseFloat(editFormData.price) : null,
          payment_method: editFormData.payment_method,
          internal_notes: editFormData.internal_notes,
          summary: editFormData.summary,
          additional_people: editFormData.additional_people,
          seller_id: editFormData.seller_id,
          files_urls: editFormData.files_urls,
          payment_proof_url: editFormData.files_urls.length > 0 ? editFormData.files_urls[0] : null
        }).eq('id', sale.id);
      if (error) throw error;
      const updatedSeller = sellers.find(s => s.id === editFormData.seller_id);
      setSale(prev => ({ ...prev, ...editFormData, payment_proof_url: editFormData.files_urls.length > 0 ? editFormData.files_urls[0] : null, profiles: updatedSeller ? { name: updatedSeller.name } : prev.profiles }));
      setWhatsappValue(editFormData.whatsapp ? editFormData.whatsapp.trim() : '');
      setIsEditModalOpen(false);
      toast({ title: "Sucesso", description: "Dados atualizados." });
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao salvar.", variant: "destructive" });
    }
  };

  const handleAddPerson = () => setEditFormData(prev => ({ ...prev, additional_people: [...prev.additional_people, { name: '', relationship: '', birthDate: '' }] }));
  const handleRemovePerson = (index) => setEditFormData(prev => ({ ...prev, additional_people: prev.additional_people.filter((_, i) => i !== index) }));
  const handlePersonChange = (index, field, value) => {
    const updatedPeople = [...editFormData.additional_people];
    updatedPeople[index] = { ...updatedPeople[index], [field]: value };
    setEditFormData(prev => ({ ...prev, additional_people: updatedPeople }));
  };

  const handleImageUpload = async (index, file) => {
    if (!file) return;
    try {
      setAnalyzingIndex(index);
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `q${index}_${sale.id}_${Date.now()}.${fileExt}`;
      const filePath = `readings/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('sales-assets').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('sales-assets').getPublicUrl(filePath);

      let identifiedCards = "Carta Detectada";
      try {
         const { data, error } = await supabase.functions.invoke('analyze-tarot-card', { body: { imageUrl: publicUrl } });
         if (!error && data?.cardNames) identifiedCards = data.cardNames;
         else identifiedCards = "Carta não identificada automaticamente";
      } catch (err) {}

      const updatedQuestions = [...questionsData];
      updatedQuestions[index] = { ...updatedQuestions[index], imageUrl: publicUrl, cardName: identifiedCards };
      await updateSaleQuestions(updatedQuestions);
      toast({ title: "Imagem salva!", description: `Cartas: ${identifiedCards}` });
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao processar.", variant: "destructive" });
    } finally {
      setAnalyzingIndex(null);
    }
  };

  const handleOptimizeQuestion = async (index) => {
    setOptimizingQuestionIndex(index);
    try {
        const questionItem = questionsData[index];
        const optimizedText = await optimizeQuestion(sale.customer_name, sale.additional_people, questionItem.question);
        if (optimizedText) {
            const updatedQuestions = [...questionsData];
            updatedQuestions[index] = { ...updatedQuestions[index], question: optimizedText };
            await updateSaleQuestions(updatedQuestions);
            toast({ title: "Otimizada!", description: "Nomes inseridos." });
        }
    } catch (error) {
        toast({ title: "Erro", description: "Falha ao otimizar.", variant: "destructive" });
    } finally {
        setOptimizingQuestionIndex(null);
    }
  };

  const handleGenerateTextForQuestion = async (index) => {
    setGeneratingTextIndex(index);
    try {
        const questionItem = questionsData[index];
        const text = await generateReadingText(sale, index, questionItem.question, questionItem.cardName);
        const updatedQuestions = [...questionsData];
        updatedQuestions[index] = { ...updatedQuestions[index], interpretation: text };
        await updateSaleQuestions(updatedQuestions);
        toast({ title: "Texto gerado!", description: "Interpretação criada." });
    } catch (error) {
        toast({ title: "Erro", description: "Falha ao gerar texto.", variant: "destructive" });
    } finally {
        setGeneratingTextIndex(null);
    }
  };

  const handleGenerateAudioForQuestion = async (index) => {
    const questionItem = questionsData[index];
    if (!questionItem.interpretation) return;
    setGeneratingAudioIndex(index);
    toast({ title: "Gerando áudio...", description: "Criando via IA..." });
    try {
        const { audioBase64, format, mimeType } = await generateAudioFromText(questionItem.interpretation);
        const binaryString = window.atob(audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        const audioBlob = new Blob([bytes], { type: mimeType });
        const fileName = `reading_audio_q${index}_${sale.id}_${Date.now()}.${format}`;
        const { error: uploadError } = await supabase.storage.from('sales-assets').upload(`audio/${fileName}`, audioBlob, { contentType: mimeType, upsert: true });
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('sales-assets').getPublicUrl(`audio/${fileName}`);
        
        const updatedQuestions = [...questionsData];
        updatedQuestions[index] = { ...updatedQuestions[index], audioUrl: publicUrlData.publicUrl };
        await updateSaleQuestions(updatedQuestions);
        if (sale.status !== 'completed' && sale.status !== 'pending_sending') await updateSaleStatus('pending_sending');
        toast({ title: "Áudio pronto!", description: "Salvo com sucesso." });
    } catch (error) {
        toast({ title: "Erro", description: "Falha na geração.", variant: "destructive" });
    } finally {
        setGeneratingAudioIndex(null);
    }
  };

  const startEditingText = (index) => { setEditingTextIndex(index); setEditingTextValue(questionsData[index].interpretation || ''); };
  const saveTextEdit = async (index) => {
      const updatedQuestions = [...questionsData];
      updatedQuestions[index] = { ...updatedQuestions[index], interpretation: editingTextValue };
      await updateSaleQuestions(updatedQuestions);
      setEditingTextIndex(null);
  };

  const startEditingQuestion = (index) => { setEditingQuestionIndex(index); setEditingQuestionValue(questionsData[index].question || ''); };
  const saveQuestionEdit = async (index) => {
    if (!editingQuestionValue.trim()) return;
    const updatedQuestions = [...questionsData];
    updatedQuestions[index] = { ...updatedQuestions[index], question: editingQuestionValue };
    await updateSaleQuestions(updatedQuestions);
    setEditingQuestionIndex(null);
    toast({ title: "Atualizada", description: "Pergunta salva." });
  };

  const handleAddQuestion = async () => {
    const newQuestion = { question: "Nova Pergunta", imageUrl: null, cardName: null, interpretation: null, audioUrl: null };
    const updatedQuestions = [...questionsData, newQuestion];
    setQuestionsData(updatedQuestions);
    setEditingQuestionIndex(updatedQuestions.length - 1);
    setEditingQuestionValue(newQuestion.question);
    try {
        const { error } = await supabase.from('sales').update({ questions_data: updatedQuestions }).eq('id', sale.id);
        if (error) throw error;
        setSale(prev => ({ ...prev, questions_data: updatedQuestions }));
    } catch (error) {
        toast({ title: "Erro", description: "Falha ao adicionar.", variant: "destructive" });
        loadSale();
    }
  };

  const handleDeleteQuestion = async (indexToDelete) => {
      try {
          const updatedQuestions = questionsData.filter((_, i) => i !== indexToDelete);
          const { error } = await supabase.from('sales').update({ questions_data: updatedQuestions }).eq('id', sale.id);
          if (error) throw error;
          setQuestionsData(updatedQuestions);
          setSale(prev => ({ ...prev, questions_data: updatedQuestions }));
          toast({ title: "Removida", description: "Pergunta excluída." });
      } catch (error) {
          toast({ title: "Erro", description: "Falha ao remover.", variant: "destructive" });
      }
  };

  const handleDeleteSale = async () => {
      setIsDeleting(true);
      try {
          const { error } = await supabase.from('sales').delete().eq('id', sale.id);
          if (error) throw error;
          navigate('/sales');
          toast({ title: "Excluída" });
      } catch (error) {
          toast({ title: "Erro", description: "Falha ao excluir.", variant: "destructive" });
          setIsDeleting(false);
      }
  };
  
  const handleForceDownload = async (url, filename) => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = blobUrl; link.download = filename;
        document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(blobUrl);
      } catch (error) {
        window.open(url, '_blank');
      }
  };

  const toggleSentStatus = async (checked) => await updateSaleStatus(checked ? 'completed' : 'pending_sending');
  const isPdf = (url) => url?.toLowerCase().includes('.pdf');

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>;
  if (!sale) return null;

  const displayId = sale.friendly_id ? `#${sale.friendly_id}` : `#${sale.id.slice(0, 8)}`;
  const displayFiles = (sale.files_urls && Array.isArray(sale.files_urls) && sale.files_urls.length > 0) ? sale.files_urls : (sale.payment_proof_url ? [sale.payment_proof_url] : []);

  return (
    <>
      <Helmet><title>Venda {displayId} - Painel de Vendas</title></Helmet>
      <CameraCapture isOpen={cameraOpenForIndex !== null} onClose={() => setCameraOpenForIndex(null)} onCapture={(file) => handleImageUpload(cameraOpenForIndex, file)} />

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>Editar Venda</DialogTitle>
            <DialogDescription>Atualize informações do pedido.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Cliente</Label><Input value={editFormData.customer_name} onChange={(e) => setEditFormData({...editFormData, customer_name: e.target.value})} /></div>
                <div className="space-y-2"><Label>Nascimento</Label><Input type="date" value={editFormData.customer_birth_date} onChange={(e) => setEditFormData({...editFormData, customer_birth_date: e.target.value})} /></div>
             </div>

             <div className="space-y-2">
                <Label>WhatsApp</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input className="pl-10" value={editFormData.whatsapp} onChange={(e) => setEditFormData({...editFormData, whatsapp: e.target.value})} placeholder="+55 11 98765-4321" />
                </div>
             </div>

             <div className="space-y-2">
                <Label className="flex justify-between items-center">
                  <span>Controle de Leads (Origem)</span>
                  {loadingOptions && <Loader2 className="w-3 h-3 animate-spin text-purple-600" />}
                </Label>
                <div className="relative">
                    <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                        value={editFormData.controle_de_leads} onChange={(e) => setEditFormData({...editFormData, controle_de_leads: e.target.value})} disabled={loadingOptions}
                        className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm disabled:bg-gray-50"
                    >
                        <option value="">Selecione a origem...</option>
                        {leadSourceOptions.map((option) => (
                            <option key={option.id} value={option.name}>{option.name}</option>
                        ))}
                    </select>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Preço</Label><Input type="number" step="0.01" value={editFormData.price} onChange={(e) => setEditFormData({...editFormData, price: e.target.value})} /></div>
                <div className="space-y-2">
                   <Label>Pagamento</Label>
                   <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editFormData.payment_method} onChange={(e) => setEditFormData({...editFormData, payment_method: e.target.value})}>
                       <option value="pix">Pix</option><option value="credit_card">Cartão</option><option value="transfer_euro">Euro</option>
                   </select>
                </div>
             </div>

             <div className="space-y-2">
                 <Label>Vendedor</Label>
                 <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editFormData.seller_id} onChange={(e) => setEditFormData({...editFormData, seller_id: e.target.value})}>
                    <option value="" disabled>Selecione</option>
                    {sellers.map((s) => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}
                 </select>
             </div>

             <div className="space-y-2">
                 <Label>Comprovante(s)</Label>
                 <MultiFileUpload value={editFormData.files_urls} onChange={(newFiles) => setEditFormData({...editFormData, files_urls: newFiles})} folder="proofs" />
             </div>
             
             <div className="space-y-3">
                <div className="flex items-center justify-between"><Label>Pessoas Adicionais</Label><Button type="button" variant="outline" size="sm" onClick={handleAddPerson}><Plus className="w-3 h-3 mr-1" /> Add</Button></div>
                {editFormData.additional_people.map((person, index) => (
                    <div key={index} className="flex flex-col md:flex-row gap-2 items-start bg-gray-50 p-2 rounded-md border border-gray-100">
                        <Input placeholder="Nome" className="flex-1" value={person.name} onChange={(e) => handlePersonChange(index, 'name', e.target.value)} />
                        <Input placeholder="Relação" className="w-full md:w-32" value={person.relationship} onChange={(e) => handlePersonChange(index, 'relationship', e.target.value)} />
                        <Input type="date" className="w-full md:w-40" value={person.birthDate || ''} onChange={(e) => handlePersonChange(index, 'birthDate', e.target.value)} />
                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemovePerson(index)}><X className="w-4 h-4 text-red-500" /></Button>
                    </div>
                ))}
             </div>

             <div className="space-y-2">
                <div className="flex justify-between items-center"><Label>Contexto</Label><Button type="button" variant="ghost" size="sm" onClick={handleSummarize} disabled={summarizing} className="text-purple-600 hover:bg-purple-50 h-6 text-xs">{summarizing ? <Loader2 className="w-3 h-3 animate-spin mr-1"/> : <Sparkles className="w-3 h-3 mr-1" />} Otimizar</Button></div>
                <Textarea className="min-h-[100px]" value={editFormData.summary} onChange={(e) => setEditFormData({...editFormData, summary: e.target.value})} />
             </div>

             <div className="space-y-2">
                <Label>Notas Internas</Label>
                <Textarea className="bg-yellow-50" value={editFormData.internal_notes} onChange={(e) => setEditFormData({...editFormData, internal_notes: e.target.value})} />
             </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button><Button onClick={handleSaveSaleDetails}><Save className="w-4 h-4 mr-2" /> Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-6xl mx-auto pb-24">
        <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" onClick={() => navigate('/sales')} className="gap-2"><ArrowLeft className="w-4 h-4" /> Voltar</Button>
            <Dialog>
                <DialogTrigger asChild><Button variant="destructive" size="sm" className="gap-2"><Trash2 className="w-4 h-4" /> Excluir</Button></DialogTrigger>
                <DialogContent className="bg-white">
                    <DialogHeader><DialogTitle>Confirmar Exclusão</DialogTitle><DialogDescription>Ação irreversível.</DialogDescription></DialogHeader>
                    <DialogFooter><Button variant="outline" onClick={() => {}}>Cancelar</Button><Button variant="destructive" onClick={handleDeleteSale} disabled={isDeleting}>{isDeleting ? 'Excluindo...' : 'Sim, Excluir'}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between md:justify-start md:gap-4">
                    <h2 className="text-2xl font-bold text-gray-900">{displayId}</h2>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="p-0 h-auto hover:bg-transparent focus-visible:ring-0 group">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-opacity group-hover:opacity-80 ${statusConfig[sale.status]?.color}`}>
                                  {statusConfig[sale.status]?.label}<ChevronDown className="w-3 h-3 opacity-50" />
                              </span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56 bg-white z-50 border shadow-lg">
                            <DropdownMenuLabel>Alterar Status</DropdownMenuLabel><DropdownMenuSeparator />
                            {Object.entries(statusConfig).map(([key, config]) => (
                              <DropdownMenuItem key={key} onClick={() => updateSaleStatus(key)} className="cursor-pointer justify-between hover:bg-gray-100">
                                <span>{config.label}</span>{sale.status === key && <Check className="w-4 h-4 text-purple-600" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="outline" size="sm" className="h-7 text-xs px-2 ml-2" onClick={() => setIsEditModalOpen(true)}><Edit3 className="w-3 h-3 mr-1" /> Editar</Button>
                    </div>
                    {(sale.status === 'pending_sending' || sale.status === 'completed') && (
                        <div className="hidden md:flex items-center space-x-2 ml-4 border-l pl-4 border-gray-200">
                            <Checkbox id="sent-status" checked={sale.status === 'completed'} onCheckedChange={toggleSentStatus} />
                            <Label htmlFor="sent-status" className="text-sm font-medium cursor-pointer">Enviado ao Cliente</Label>
                        </div>
                    )}
                </div>
                
                <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-3 text-sm flex-wrap">
                        <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-purple-600" /> <span className="font-semibold text-gray-900 text-base">{sale.customer_name}</span>
                            {sale.customer_birth_date && <span className="text-gray-500">({new Date(sale.customer_birth_date).toLocaleDateString('pt-BR')})</span>}
                        </div>
                        {sale.additional_people && sale.additional_people.length > 0 && (
                             <div className="flex flex-wrap gap-2 md:ml-2">
                                {sale.additional_people.map((p, i) => (
                                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-50 text-xs font-medium text-purple-700 border border-purple-100">
                                        <Users className="w-3 h-3 mr-1" />{p.name} {p.relationship ? `• ${p.relationship}` : ''}
                                    </span>
                                ))}
                             </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-green-600" />
                        {editingWhatsapp ? (
                            <div className="flex items-center gap-2 flex-1">
                                <Input value={whatsappValue} onChange={(e) => setWhatsappValue(e.target.value)} className="h-8 text-sm max-w-xs" />
                                <Button size="sm" onClick={handleSaveWhatsapp} disabled={savingWhatsapp} className="h-8 px-3">{savingWhatsapp ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}</Button>
                                <Button size="sm" variant="ghost" onClick={() => { setEditingWhatsapp(false); setWhatsappValue(sale.whatsapp); }} className="h-8 px-3"><X className="w-3 h-3" /></Button>
                            </div>
                        ) : (
                            <>
                                <span className="font-medium text-gray-900">{sale.whatsapp || 'Não informado'}</span>
                                {sale.whatsapp && (<><Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyWhatsapp}><Copy className="w-3 h-3 text-gray-500" /></Button><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingWhatsapp(true)}><Edit3 className="w-3 h-3 text-gray-500" /></Button></>)}
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500"><Clock className="w-4 h-4" /> {formatDate(sale.created_at)}</div>
                    <div className="flex items-center gap-2 text-sm text-gray-500"><span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs border border-gray-200">Vendedor: {sale.profiles?.name || 'Sistema'}</span></div>
                </div>
              </div>
              
              <div className="text-right border-t pt-4 md:border-t-0 md:pt-0">
                 <p className="text-xs text-gray-500">Total</p><p className="text-xl font-bold text-green-700">R$ {sale.price ? parseFloat(sale.price).toFixed(2) : '0.00'}</p>
                 {sale.controle_de_leads && <p className="mt-2 text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full inline-block border border-purple-100"><Target className="w-3 h-3 inline mr-1" />{sale.controle_de_leads}</p>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-purple-600" /> Contexto</h3>
                    <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">{sale.summary || <span className="italic text-gray-400">Sem resumo</span>}</div>
                </div>

                <div className="space-y-6">
                   {questionsData.map((item, index) => (
                       <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                           <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                <div className="flex items-center gap-3 w-full">
                                    <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded-md shrink-0">P{index + 1}</span>
                                    {editingQuestionIndex === index ? (
                                        <div className="flex-1 flex items-center gap-2">
                                            <Input value={editingQuestionValue} onChange={(e) => setEditingQuestionValue(e.target.value)} className="bg-white" autoFocus />
                                            <Button size="icon" variant="ghost" onClick={() => saveQuestionEdit(index)}><Check className="w-4 h-4 text-green-600" /></Button>
                                            <Button size="icon" variant="ghost" onClick={() => setEditingQuestionIndex(null)}><X className="w-4 h-4 text-red-500" /></Button>
                                        </div>
                                    ) : (
                                        <>
                                            <h3 className="font-semibold text-gray-900 flex-1 cursor-pointer" onClick={() => startEditingQuestion(index)}>{item.question}</h3>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => startEditingQuestion(index)}><Edit3 className="w-3.5 h-3.5" /></Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleOptimizeQuestion(index)} disabled={optimizingQuestionIndex === index} className="h-8 text-xs text-purple-600">{optimizingQuestionIndex === index ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3 mr-1" />} Otimizar</Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger>
                                                    <AlertDialogContent className="bg-white"><AlertDialogHeader><AlertDialogTitle>Excluir?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteQuestion(index)} className="bg-red-600 hover:bg-red-700">Sim</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </>
                                    )}
                                </div>
                           </div>

                           <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                               <div className="space-y-3">
                                   <label className="text-xs font-bold text-gray-400 uppercase">Cartas</label>
                                   {item.imageUrl ? (
                                        <div className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-[3/4] w-full max-w-[200px]">
                                            <img src={item.imageUrl} alt="Cards" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 p-2 transition-opacity">
                                                <Button variant="secondary" size="sm" onClick={() => handleForceDownload(item.imageUrl, `p${index+1}.jpg`)} className="bg-white/20 hover:bg-white/40 text-white w-full h-8"><Download className="w-3 h-3 mr-2" /> Baixar</Button>
                                                <div className="flex gap-2 w-full">
                                                    <label className="flex-1 cursor-pointer"><div className="bg-white/20 hover:bg-white/40 text-white rounded-md h-8 flex items-center justify-center text-xs"><Upload className="w-3 h-3 mr-1" /> Galeria</div><input type="file" className="hidden" accept="image/*" onChange={(e) => { handleImageUpload(index, e.target.files[0]); e.target.value = null; }} /></label>
                                                    <Button variant="secondary" size="sm" className="flex-1 bg-white/20 hover:bg-white/40 text-white h-8" onClick={() => setCameraOpenForIndex(index)}><Camera className="w-3 h-3 mr-1" /> Câmera</Button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2 max-w-[200px]">
                                            <label className={`flex flex-col items-center justify-center h-48 rounded-lg border-2 border-dashed cursor-pointer ${analyzingIndex === index ? 'border-purple-300 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => { handleImageUpload(index, e.target.files[0]); e.target.value = null; }} disabled={analyzingIndex === index} />
                                                {analyzingIndex === index ? <Loader2 className="w-6 h-6 text-purple-600 animate-spin" /> : <><Upload className="w-5 h-5 text-gray-400" /><span className="text-[10px] text-gray-500 uppercase mt-1">Carregar Foto</span></>}
                                            </label>
                                            <Button variant="outline" className="w-full h-10 border-dashed" onClick={() => setCameraOpenForIndex(index)}><Camera className="w-4 h-4 mr-2" /> Câmera</Button>
                                        </div>
                                    )}
                                    {item.cardName && <div className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded border inline-block"><Sparkles className="w-3 h-3 inline mr-1" />{item.cardName}</div>}
                               </div>

                               <div className="space-y-3">
                                   <div className="flex justify-between items-center"><label className="text-xs font-bold text-gray-400 uppercase">Interpretação & Áudio</label>{item.interpretation && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEditingText(index)}><Edit3 className="w-3 h-3 text-gray-500" /></Button>}</div>
                                   {editingTextIndex === index ? (
                                       <div className="space-y-2"><Textarea value={editingTextValue} onChange={(e) => setEditingTextValue(e.target.value)} className="min-h-[200px] text-sm" /><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setEditingTextIndex(null)}>Cancelar</Button><Button size="sm" onClick={() => saveTextEdit(index)}>Salvar</Button></div></div>
                                   ) : (
                                       <>
                                           {item.interpretation ? <div className="prose prose-sm bg-gray-50 p-3 rounded-lg border min-h-[100px] text-sm">{item.interpretation}</div> : <div className="flex flex-col items-center justify-center h-[200px] bg-gray-50 rounded-lg border border-dashed text-gray-400 gap-2"><FileText className="w-8 h-8 opacity-20" /><p className="text-xs">Aguardando geração</p></div>}
                                           <div className="flex gap-2 pt-2">
                                               <Button variant={item.interpretation ? "outline" : "default"} size="sm" className="flex-1" disabled={!item.imageUrl || generatingTextIndex === index} onClick={() => handleGenerateTextForQuestion(index)}>{generatingTextIndex === index ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />} {item.interpretation ? "Regerar" : "Gerar"}</Button>
                                               <Button size="sm" className="flex-1 bg-purple-600 hover:bg-purple-700" disabled={!item.interpretation || generatingAudioIndex === index} onClick={() => handleGenerateAudioForQuestion(index)}>{generatingAudioIndex === index ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4 mr-2" />} {item.audioUrl ? "Regerar Áudio" : "Gerar Áudio"}</Button>
                                           </div>
                                       </>
                                   )}
                                   {item.audioUrl && (
                                       <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200 flex items-center justify-between">
                                            <div className="flex items-center gap-3 w-full"><div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 shrink-0"><Volume2 className="w-4 h-4" /></div><audio controls src={item.audioUrl} className="w-full h-8 accent-green-600" /></div>
                                            <Button variant="ghost" size="icon" className="ml-2 text-green-700 hover:bg-green-100 rounded-full" onClick={() => handleForceDownload(item.audioUrl, `audio_p${index+1}.mp3`)}><Download className="w-4 h-4" /></Button>
                                       </div>
                                   )}
                               </div>
                           </div>
                       </div>
                   ))}
                   <Button variant="ghost" className="w-full border-2 border-dashed py-8 flex-col gap-2 h-auto text-gray-400 hover:text-purple-600" onClick={handleAddQuestion}><Plus className="w-8 h-8 opacity-50" /><span className="font-semibold">Nova Pergunta</span></Button>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                     <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4" /> Pagamento</h3>
                     <div className="p-3 bg-gray-50 rounded-lg border text-sm"><span className="text-gray-500 block text-xs uppercase font-bold mb-1">Método</span><span className="text-gray-900 font-medium">{sale.payment_method ? paymentMethodConfig[sale.payment_method] || sale.payment_method : 'Não informado'}</span></div>
                </div>
                {sale.internal_notes && <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-5"><h3 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2 text-sm uppercase"><Lock className="w-3 h-3" /> Notas Internas</h3><p className="text-sm text-yellow-900 italic">{sale.internal_notes}</p></div>}
                {displayFiles.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                         <h3 className="font-semibold text-gray-900 mb-4">Comprovantes ({displayFiles.length})</h3>
                         <div className="space-y-3">
                            {displayFiles.map((url, i) => (
                                <div key={i}>
                                    {isPdf(url) ? <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border hover:bg-gray-100"><FileText className="w-8 h-8 text-red-500 shrink-0" /><div className="overflow-hidden"><p className="text-sm font-medium text-gray-900 truncate">PDF {i + 1}</p><p className="text-xs text-gray-500">Abrir</p></div></a> : <a href={url} target="_blank" rel="noreferrer" className="block"><img src={url} alt={`Proof ${i + 1}`} className="w-full rounded-lg border hover:opacity-90" /></a>}
                                </div>
                            ))}
                         </div>
                    </div>
                )}
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default SaleDetailPage;