import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileAudio, 
  Loader2, 
  CheckCircle2, 
  Copy, 
  AlertCircle,
  RefreshCw,
  Sparkles,
  HelpCircle,
  FileText,
  Files,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { uploadAudio, startTranscription, checkTranscriptionStatus } from '@/lib/assemblyAi';
import { analyzeTranscript } from '@/lib/aiUtils';

const TranscribeAudioPage = () => {
  const [status, setStatus] = useState('idle'); // idle, processing, completed, error
  const [transcript, setTranscript] = useState('');
  const [progressMessage, setProgressMessage] = useState('');
  const [fileName, setFileName] = useState('');
  
  // AI Features State
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [questions, setQuestions] = useState(null);
  const [selectedQuestions, setSelectedQuestions] = useState({});
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [reading, setReading] = useState('');
  const [isGeneratingReading, setIsGeneratingReading] = useState(false);

  const fileInputRef = useRef(null);
  const { toast } = useToast();

  const waitForTranscription = async (id) => {
    return new Promise((resolve, reject) => {
      const intervalId = setInterval(async () => {
        try {
          const data = await checkTranscriptionStatus(id);
          if (data.status === 'completed') {
            clearInterval(intervalId);
            resolve(data.text);
          } else if (data.status === 'error') {
            clearInterval(intervalId);
            reject(data.error);
          }
        } catch (err) {
          clearInterval(intervalId);
          reject(err);
        }
      }, 2000);
    });
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate types - Check specifically for .oga extension or correct mime types
    const isValidFile = (file) => {
      const fileName = file.name.toLowerCase();
      const fileType = file.type;
      
      // Explicitly allow .oga files regardless of mime type reported by browser
      // and standard audio/video mime types
      return fileName.endsWith('.oga') || 
             fileType.startsWith('audio/') || 
             fileType.startsWith('video/');
    };

    const invalidFile = files.find(f => !isValidFile(f));

    if (invalidFile) {
      toast({
        variant: "destructive",
        title: "Arquivo inválido",
        description: `O arquivo ${invalidFile.name} não é um áudio ou vídeo válido.`,
      });
      return;
    }

    setStatus('processing');
    setTranscript('');
    setSummary('');
    setQuestions(null);
    setReading('');
    setSelectedQuestions({});
    let accumulatedTranscript = '';

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setFileName(`Processando arquivo ${i + 1} de ${files.length}: ${file.name}`);
        
        // 1. Upload
        setProgressMessage('Enviando arquivo para o servidor...');
        const uploadUrl = await uploadAudio(file);
        
        // 2. Start Transcription
        setProgressMessage('Transcrevendo áudio...');
        const transcriptId = await startTranscription(uploadUrl);

        // 3. Wait for result
        setProgressMessage('Aguardando finalização da IA...');
        const text = await waitForTranscription(transcriptId);

        // Append result
        const header = files.length > 1 ? `\n\n--- Início do arquivo: ${file.name} ---\n` : '';
        accumulatedTranscript += header + text;
        setTranscript(accumulatedTranscript);
      }

      setStatus('completed');
      toast({
        title: "Transcrição concluída!",
        description: "Todos os arquivos foram processados com sucesso.",
        className: "bg-green-50 border-green-200 text-green-900",
      });

    } catch (error) {
      console.error(error);
      setStatus('error');
      toast({
        variant: "destructive",
        title: "Erro no processo",
        description: "Falha ao processar os arquivos. Tente novamente.",
      });
    }
  };

  const handleSummarize = async () => {
    if (!transcript) return;
    setIsSummarizing(true);
    try {
      const result = await analyzeTranscript(transcript, 'summarize');
      setSummary(result);
      toast({ title: "Resumo gerado com sucesso!" });
    } catch (error) {
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
    if (!transcript) return;
    setIsGeneratingQuestions(true);
    setQuestions(null);
    setSelectedQuestions({});

    try {
      const resultString = await analyzeTranscript(transcript, 'generate-questions');
      const resultJson = JSON.parse(resultString);
      if (resultJson && resultJson.questions) {
        setQuestions(resultJson.questions);
        // Select all by default
        const initialSelection = {};
        resultJson.questions.forEach((_, idx) => {
            initialSelection[idx] = true;
        });
        setSelectedQuestions(initialSelection);
        toast({ title: "Perguntas geradas com sucesso!" });
      } else {
        throw new Error("Formato inválido de resposta.");
      }
    } catch (error) {
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
      if (!transcript) return;
      setIsGeneratingReading(true);
      try {
        const result = await analyzeTranscript(transcript, 'generate-reading');
        setReading(result);
        toast({ title: "Leitura gerada com sucesso!" });
      } catch (error) {
        toast({ 
          variant: "destructive", 
          title: "Erro ao gerar leitura", 
          description: error.message 
        });
      } finally {
        setIsGeneratingReading(false);
      }
  };

  const toggleQuestion = (idx) => {
    setSelectedQuestions(prev => ({
        ...prev,
        [idx]: !prev[idx]
    }));
  };

  const handleCopy = (text, message = "Texto copiado!") => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado",
      description: message,
    });
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

  const resetProcess = () => {
    setStatus('idle');
    setTranscript('');
    setFileName('');
    setSummary('');
    setQuestions(null);
    setReading('');
    setSelectedQuestions({});
    setProgressMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Transcrever Áudio</h1>
        {status !== 'idle' && (
          <Button variant="outline" size="sm" onClick={resetProcess} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Nova Transcrição
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-12 text-center"
            >
              <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Files className="w-10 h-10 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Faça upload dos seus arquivos
              </h3>
              <p className="text-gray-500 max-w-sm mx-auto mb-8">
                Suporta MP3, WAV, M4A, OGA, MP4 e outros formatos de áudio/vídeo.
                Selecione múltiplos arquivos para combinar em uma única transcrição.
              </p>
              
              <div className="relative inline-block">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="audio/*,video/*,.oga,.ogg"
                  multiple
                  className="hidden"
                  id="file-upload"
                />
                <Button 
                  size="lg" 
                  className="bg-purple-600 hover:bg-purple-700 gap-2 px-8"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-5 h-5" />
                  Selecionar Arquivos
                </Button>
              </div>
            </motion.div>
          )}

          {status === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-12 text-center"
            >
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <FileAudio className="w-8 h-8 text-purple-600" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Processando arquivos...
              </h3>
              <p className="text-gray-500 mb-2 font-medium">{fileName}</p>
              <p className="text-sm text-purple-600 animate-pulse">
                {progressMessage}
              </p>
            </motion.div>
          )}

          {status === 'completed' && (
            <motion.div
              key="completed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col h-full"
            >
              <div className="p-4 bg-green-50 border-b border-green-100 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-green-800 font-medium">Transcrição finalizada com sucesso</span>
              </div>
              
              <div className="p-6 space-y-8">
                {/* Transcript Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Transcrição Completa
                    </h3>
                  </div>
                  <div className="relative group">
                    <textarea 
                      value={transcript} 
                      readOnly
                      className="w-full h-80 p-4 bg-gray-50 rounded-lg border border-gray-200 resize-none focus:ring-0 text-gray-700 leading-relaxed"
                    />
                    <div className="absolute top-4 right-4">
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="bg-white shadow-sm hover:bg-gray-100 gap-2"
                        onClick={() => handleCopy(transcript)}
                      >
                        <Copy className="w-4 h-4" />
                        Copiar
                      </Button>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3 mt-4">
                    <Button 
                      variant="secondary"
                      className="gap-2 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-100"
                      onClick={handleSummarize}
                      disabled={isSummarizing || isGeneratingQuestions || isGeneratingReading || !!summary}
                    >
                      {isSummarizing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      Gerar Resumo
                    </Button>

                    <Button 
                      variant="secondary"
                      className="gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100"
                      onClick={handleGenerateQuestions}
                      disabled={isGeneratingQuestions || isSummarizing || isGeneratingReading || !!questions}
                    >
                      {isGeneratingQuestions ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <HelpCircle className="w-4 h-4" />
                      )}
                      Sugerir 10 Perguntas (Tarot)
                    </Button>

                    <Button 
                      variant="secondary"
                      className="gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100"
                      onClick={handleGenerateReading}
                      disabled={isGeneratingQuestions || isSummarizing || isGeneratingReading || !!reading}
                    >
                      {isGeneratingReading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <MessageSquare className="w-4 h-4" />
                      )}
                      Gerar Leitura Narrativa
                    </Button>
                  </div>
                </div>

                {/* Summary Section */}
                {summary && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-purple-50 border border-purple-100 rounded-lg p-6 relative group"
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
                    <h3 className="font-semibold text-purple-900 flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-purple-600" /> Resumo do Conteúdo
                    </h3>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{summary}</p>
                  </motion.div>
                )}

                {/* Questions Section */}
                {questions && questions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-blue-50 border border-blue-100 rounded-lg p-6 relative group"
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
                    <h3 className="font-semibold text-blue-900 flex items-center gap-2 mb-4">
                      <HelpCircle className="w-4 h-4 text-blue-600" /> Perguntas para o Tarot
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

                {/* Reading Section */}
                {reading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-emerald-50 border border-emerald-100 rounded-lg p-6 relative group"
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
                    <h3 className="font-semibold text-emerald-900 flex items-center gap-2 mb-3">
                      <MessageSquare className="w-4 h-4 text-emerald-600" /> Leitura Narrativa
                    </h3>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{reading}</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-12 text-center"
            >
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Algo deu errado
              </h3>
              <p className="text-gray-500 max-w-sm mx-auto mb-8">
                Não foi possível completar o processamento dos arquivos.
              </p>
              <Button onClick={resetProcess} variant="outline">
                Tentar Novamente
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TranscribeAudioPage;