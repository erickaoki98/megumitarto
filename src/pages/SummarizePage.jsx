import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Sparkles, 
  HelpCircle, 
  Loader2, 
  Copy, 
  Eraser,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { analyzeTranscript } from '@/lib/aiUtils';

const SummarizePage = () => {
  const [inputText, setInputText] = useState('');
  
  // AI Results
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  
  const [questions, setQuestions] = useState(null); // Array of strings
  const [selectedQuestions, setSelectedQuestions] = useState({}); // { index: boolean }
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);

  const [reading, setReading] = useState('');
  const [isGeneratingReading, setIsGeneratingReading] = useState(false);

  const { toast } = useToast();

  const handleSummarize = async () => {
    if (!inputText.trim()) {
        toast({ title: "Digite algum texto primeiro", variant: "destructive" });
        return;
    }
    
    setIsSummarizing(true);
    setSummary(''); 
    setQuestions(null);
    setReading('');
    try {
      const result = await analyzeTranscript(inputText, 'summarize');
      setSummary(result);
      toast({ title: "Resumo gerado com sucesso!" });
    } catch (error) {
      console.error(error);
      toast({ 
        variant: "destructive", 
        title: "Erro ao resumir", 
        description: error.message 
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleGenerateQuestions = async () => {
    if (!inputText.trim()) {
        toast({ title: "Digite algum texto primeiro", variant: "destructive" });
        return;
    }

    setIsGeneratingQuestions(true);
    setQuestions(null); 
    setSummary('');
    setReading('');
    setSelectedQuestions({});
    try {
      const resultString = await analyzeTranscript(inputText, 'generate-questions');
      const resultJson = JSON.parse(resultString);
      if (resultJson && resultJson.questions) {
        setQuestions(resultJson.questions);
        const initialSelection = {};
        resultJson.questions.forEach((_, idx) => {
            initialSelection[idx] = true;
        });
        setSelectedQuestions(initialSelection);
        toast({ title: "Perguntas geradas com sucesso!" });
      } else {
        throw new Error("Resposta inválida da IA.");
      }
    } catch (error) {
      console.error(error);
      toast({ 
        variant: "destructive", 
        title: "Erro ao gerar perguntas", 
        description: error.message 
      });
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const handleGenerateReading = async () => {
      if (!inputText.trim()) {
          toast({ title: "Digite algum texto primeiro", variant: "destructive" });
          return;
      }
  
      setIsGeneratingReading(true);
      setReading('');
      setSummary('');
      setQuestions(null);
      try {
        const result = await analyzeTranscript(inputText, 'generate-reading');
        setReading(result);
        toast({ title: "Leitura gerada com sucesso!" });
      } catch (error) {
        console.error(error);
        toast({ 
          variant: "destructive", 
          title: "Erro ao gerar leitura", 
          description: error.message 
        });
      } finally {
        setIsGeneratingReading(false);
      }
  };

  const handleCopy = (text, message = "Copiado para área de transferência!") => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado", description: message });
  };

  const handleCopyQuestions = () => {
    if (!questions) return;
    
    const selectedText = questions
        .filter((_, idx) => selectedQuestions[idx])
        .join('\n');

    if (!selectedText) {
        toast({ title: "Nenhuma pergunta selecionada", variant: "destructive" });
        return;
    }

    handleCopy(selectedText, "Perguntas selecionadas copiadas!");
  }

  const toggleQuestion = (idx) => {
    setSelectedQuestions(prev => ({
        ...prev,
        [idx]: !prev[idx]
    }));
  };

  const handleClear = () => {
    setInputText('');
    setSummary('');
    setQuestions(null);
    setReading('');
    setSelectedQuestions({});
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Resumir & Analisar Texto</h1>
        <Button variant="ghost" size="sm" onClick={handleClear} className="text-gray-500 hover:text-red-600 gap-2">
            <Eraser className="w-4 h-4" />
            Limpar Tudo
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Input Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                Cole seu texto aqui
            </label>
            <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Cole o texto que deseja resumir, analisar ou gerar leitura..."
                className="min-h-[200px] text-base leading-relaxed p-4 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
            />
            
            <div className="flex flex-wrap gap-3 mt-4">
                <Button 
                    className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={handleSummarize}
                    disabled={isSummarizing || isGeneratingQuestions || isGeneratingReading || !inputText}
                >
                    {isSummarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Gerar Resumo
                </Button>

                <Button 
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleGenerateQuestions}
                    disabled={isGeneratingQuestions || isSummarizing || isGeneratingReading || !inputText}
                >
                    {isGeneratingQuestions ? <Loader2 className="w-4 h-4 animate-spin" /> : <HelpCircle className="w-4 h-4" />}
                    Sugerir Perguntas (Tarot)
                </Button>

                <Button 
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleGenerateReading}
                    disabled={isGeneratingQuestions || isSummarizing || isGeneratingReading || !inputText}
                >
                    {isGeneratingReading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                    Gerar Leitura Narrativa
                </Button>
            </div>
        </div>

        {/* Results Section */}
        <motion.div layout className="space-y-6">
            {/* Summary Result */}
            {summary && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-purple-50 border border-purple-100 rounded-xl p-6 relative group shadow-sm"
                >
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 bg-white/50 hover:bg-white"
                            onClick={() => handleCopy(summary)}
                        >
                            <Copy className="w-4 h-4 text-purple-700" />
                        </Button>
                    </div>
                    <h3 className="font-semibold text-purple-900 flex items-center gap-2 mb-3 text-lg">
                        <Sparkles className="w-5 h-5 text-purple-600" /> Resumo do Conteúdo
                    </h3>
                    <div className="prose prose-purple max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {summary}
                    </div>
                </motion.div>
            )}

            {/* Questions Result */}
            {questions && questions.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-blue-50 border border-blue-100 rounded-xl p-6 relative group shadow-sm"
                >
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                            size="sm" 
                            variant="secondary" 
                            className="bg-white/80 hover:bg-white shadow-sm gap-2"
                            onClick={handleCopyQuestions}
                        >
                            <Copy className="w-4 h-4 text-blue-700" />
                            Copiar Selecionadas
                        </Button>
                    </div>
                    <h3 className="font-semibold text-blue-900 flex items-center gap-2 mb-4 text-lg">
                        <HelpCircle className="w-5 h-5 text-blue-600" /> Perguntas para o Tarot
                    </h3>
                    <div className="space-y-2">
                        {questions.map((q, idx) => (
                            <div 
                                key={idx} 
                                className="flex items-start gap-3 p-3 rounded-lg hover:bg-blue-100/50 transition-colors border border-transparent hover:border-blue-100"
                            >
                                <Checkbox 
                                    id={`question-${idx}`}
                                    checked={selectedQuestions[idx] || false}
                                    onCheckedChange={() => toggleQuestion(idx)}
                                    className="mt-1"
                                />
                                <Label 
                                    htmlFor={`question-${idx}`}
                                    className="text-base font-normal text-gray-700 cursor-pointer leading-relaxed flex-1 select-none"
                                >
                                    {q}
                                </Label>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Reading Result */}
            {reading && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-emerald-50 border border-emerald-100 rounded-xl p-6 relative group shadow-sm"
                >
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 bg-white/50 hover:bg-white"
                            onClick={() => handleCopy(reading)}
                        >
                            <Copy className="w-4 h-4 text-emerald-700" />
                        </Button>
                    </div>
                    <h3 className="font-semibold text-emerald-900 flex items-center gap-2 mb-3 text-lg">
                        <MessageSquare className="w-5 h-5 text-emerald-600" /> Leitura Narrativa
                    </h3>
                    <div className="prose prose-emerald max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {reading}
                    </div>
                </motion.div>
            )}
        </motion.div>
      </div>
    </div>
  );
};

export default SummarizePage;