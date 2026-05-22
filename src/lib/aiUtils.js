import { supabase } from '@/lib/customSupabaseClient';

/**
 * AI Utilities
 * 
 * NOTE on Audio Conversion:
 * Previously, this module attempted to convert MP3 to AAC using FFmpeg.wasm.
 * However, due to browser security restrictions (SharedArrayBuffer) and CDN issues,
 * client-side conversion is unstable.
 * 
 * We now use the MP3 format directly. MP3 is universally supported across 
 * all modern browsers, iOS, and Android devices, offering the most stable 
 * and reliable playback experience without heavy WASM dependencies.
 */

export const analyzeCardImage = async (imageUrl) => {
  try {
    const { data, error } = await supabase.functions.invoke('analyze-tarot-card', {
      body: { imageUrl }
    });
    
    if (error) throw error;
    return data.cardNames || "Cartas não identificadas";
  } catch (error) {
    console.error("Error analyzing card:", error);
    return "Erro ao identificar cartas";
  }
};

export const generateReadingText = async (saleData, index, questionText, cardNames) => {
  try {
    // Megumi Identity & System Instructions
    const megumiSystemInstructions = `
    \n\n---
    [DIRETRIZES DE SISTEMA OBRIGATÓRIAS - PERSONA "MEGUMI"]

    1. IDENTIDADE E TOM:
       - Persona: Amiga íntima, madura, prática e "pé no chão".
       - Tom de Voz: Conversacional, espontâneo, fluido e direto.
       - Objetivo: Trazer clareza absoluta através de detalhes, não de conforto emocional.

    2. DIRETRIZ CRÍTICA - SUBSTITUIÇÃO DE EMPATIA POR DETALHES (ZERO VALIDAÇÃO):
       - O QUE REMOVER: Identifique e REMOVA qualquer instrução ou tendência de iniciar a resposta mostrando empatia, pena ou validação (ex: "Sinto muito que esteja passando por isso", "Entendo como é difícil", "Imagino sua dor").
       - O QUE FAZER: Substitua a empatia por ANÁLISE DESCRITIVA. Ao invés de dizer que entende a dor, descreva a situação com riqueza de detalhes que mostrem que você enxerga a realidade do sujeito.
       - AÇÃO: Seja direta. Vá direto ao ponto sobre o que as cartas mostram sobre a situação e as pessoas envolvidas. Dê detalhes sobre o comportamento, os motivos e o cenário, sem perder tempo "acolhendo" o cliente. O acolhimento virá da clareza da resposta, não de palavras doces.

    3. OTIMIZAÇÃO PARA ÁUDIO (ORALIDADE EXTREMA):
       - O texto será convertido em áudio. Escreva EXATAMENTE como se fala.
       - Use marcas de oralidade para soar natural: ", né", ", tá?", ", sabe?", "olha...", "então...".
       - Evite frases longas e literárias. Use o ritmo da fala cotidiana.
       - Nomes: Se houver nomes difíceis, use pronomes (ele/ela) para fluir melhor.

    4. ESTRUTURA E CONTEÚDO (MÍNIMO 350 PALAVRAS):
       - Início: Comece JÁ NO ASSUNTO. Sem saudações ("Olá", "Tudo bem"). Entre direto na análise da energia ou da atitude da pessoa em questão.
       - Corpo (Profundidade): O texto deve ser LONGO (MÍNIMO 350 PALAVRAS). Explore as nuances, as intenções ocultas e os desdobramentos.
       - Cartas: Use as cartas (${cardNames}) como base invisível. Não cite os nomes das cartas ("A Torre", "3 de Copas"), interprete o significado delas na história.
       - Perguntas: Insira perguntas reflexivas no meio da fala para engajar o ouvinte.
       - Fechamento: Termine o raciocínio de forma natural, deixando a reflexão no ar. Sem despedidas formais ("Um abraço", "Fique bem").

    5. FORMATAÇÃO:
       - Use parágrafos com quebra de linha dupla (\\n\\n) para pausas no áudio.
       - ESTRITAMENTE SEM EMOJIS.

    [CONTEXTO DO CLIENTE]
    - Nome: ${saleData.customer_name}
    - Outros envolvidos: ${saleData.additional_people ? JSON.stringify(saleData.additional_people) : 'Ninguém citado'}
    - Resumo da História: ${saleData.summary || "Sem contexto prévio"}

    [AÇÃO]
    Responda à pergunta seguindo rigorosamente estas diretrizes: oralidade natural, muitos detalhes, zero validação emocional padrão.
    ---
    `;
    
    const { data, error } = await supabase.functions.invoke('generate-tarot-reading-text', {
      body: { 
        customerName: saleData.customer_name,
        additionalPeople: saleData.additional_people,
        summary: saleData.summary,
        question: questionText + megumiSystemInstructions, // Appending instructions to ensure adherence
        cardNames: cardNames,
        mode: 'single_question'
      }
    });

    if (error) throw error;
    return data.interpretation; 
  } catch (error) {
    console.error("Error generating text:", error);
    throw error;
  }
};

export const generateAudioFromText = async (text) => {
  if (!text) throw new Error("Texto vazio para geração de áudio.");
  
  try {
    // --- Generate MP3 via ElevenLabs (Edge Function) ---
    console.log("Generating Audio (MP3)...");
    
    const { data, error } = await supabase.functions.invoke('generate-audio-from-text', {
      body: { text }
    });

    if (error) {
        let errorMsg = error.message;
        try {
            const body = JSON.parse(error.message);
            if (body.error) errorMsg = body.error;
            if (body.details) errorMsg += ` (${body.details})`;
        } catch(e) { /* ignore */ }
        throw new Error(errorMsg || "Falha na comunicação com o servidor de áudio.");
    }

    if (!data || !data.audioBase64) {
        if (data && data.error) throw new Error(data.error);
        throw new Error("O serviço não retornou dados de áudio válidos.");
    }

    const mp3Base64 = data.audioBase64;
    console.log("Audio received successfully. Size:", Math.round(mp3Base64.length * 0.75 / 1024), "KB");

    // Return the MP3 base64 directly without conversion
    return {
      audioBase64: mp3Base64,
      format: 'mp3',
      mimeType: 'audio/mpeg'
    };

  } catch (error) {
    console.error("Error in generateAudioFromText:", error);
    throw error;
  }
};

export const summarizeContext = async (dataPayload) => {
    try {
        const { data, error } = await supabase.functions.invoke('summarize-sale-context', {
            body: { 
                customerName: dataPayload.customer_name,
                birthDate: dataPayload.customer_birth_date,
                additionalPeople: dataPayload.additional_people,
                rawSummary: dataPayload.summary
            }
        });
        if (error) throw error;
        return data.summary;
    } catch (error) {
        console.error("Error summarizing context:", error);
        throw error;
    }
}

export const optimizeQuestion = async (customerName, additionalPeople, question) => {
    try {
        let contextNote = `[Context: Customer is ${customerName}.`;
        if (additionalPeople && additionalPeople.length > 0) {
            const names = additionalPeople.map(p => p.name).join(", ");
            contextNote += ` Other people involved: ${names}.`;
        }
        contextNote += ` Ensure the optimized question clearly references these people by name if relevant.]`;

        const { data, error } = await supabase.functions.invoke('optimize-question', {
            body: { 
                customerName,
                additionalPeople,
                question: `${question} ${contextNote}`
            }
        });
        if (error) throw error;
        return data.optimizedQuestion;
    } catch (error) {
        console.error("Error optimizing question:", error);
        throw error;
    }
}

export const analyzeTranscript = async (text, action) => {
  try {
    const { data, error } = await supabase.functions.invoke('analyze-transcript', {
      body: { text, action }
    });

    if (error) throw error;
    return data.result;
  } catch (error) {
    console.error(`Error in analyzeTranscript (${action}):`, error);
    throw error;
  }
};