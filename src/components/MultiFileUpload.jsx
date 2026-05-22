import React, { useState } from 'react';
import { Upload, X, FileText, Loader2, Trash2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const MultiFileUpload = ({ 
  value = [], 
  onChange, 
  folder = 'proofs', 
  maxSizeMB = 5,
  acceptedTypes = "image/*,application/pdf"
}) => {
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    const newUrls = [];

    try {
      for (const file of files) {
        // Validate size
        if (file.size > maxSizeMB * 1024 * 1024) {
          toast({
            title: "Arquivo muito grande",
            description: `O arquivo ${file.name} excede o limite de ${maxSizeMB}MB.`,
            variant: "destructive"
          });
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `${folder}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('sales-assets')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('sales-assets')
          .getPublicUrl(filePath);

        newUrls.push(data.publicUrl);
      }

      if (newUrls.length > 0) {
        onChange([...value, ...newUrls]);
        toast({
          title: "Upload concluído",
          description: `${newUrls.length} arquivo(s) adicionado(s).`
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Erro no upload",
        description: "Falha ao enviar alguns arquivos.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = null;
    }
  };

  const handleRemove = (urlToRemove) => {
    const newValue = value.filter(url => url !== urlToRemove);
    onChange(newValue);
  };

  const isImage = (url) => {
    const ext = url.split('.').pop().split('?')[0].toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
  };

  const getFileName = (url) => {
    return url.split('/').pop().split('?')[0];
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {value.map((url, index) => (
          <div key={index} className="relative group aspect-square bg-gray-50 border rounded-lg overflow-hidden flex items-center justify-center">
            {isImage(url) ? (
              <img 
                src={url} 
                alt="Uploaded file" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center p-2 text-center">
                <FileText className="w-8 h-8 text-gray-400 mb-1" />
                <span className="text-[10px] text-gray-500 break-all line-clamp-2">
                  {getFileName(url)}
                </span>
              </div>
            )}
            
            <button
              type="button"
              onClick={() => handleRemove(url)}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              title="Remover arquivo"
            >
              <X className="w-3 h-3" />
            </button>
            
            {/* Overlay for non-images to make them clickable/viewable could go here, 
                but for this component we focus on management */}
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="absolute inset-0 z-0" 
              title="Ver arquivo"
            />
            {/* Re-add button on top of link */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleRemove(url);
              }}
              className="absolute top-1 right-1 z-10 bg-white/80 text-red-500 rounded-full p-1 opacity-100 hover:bg-white shadow-sm border border-gray-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        <label className={`
          flex flex-col items-center justify-center aspect-square border-2 border-dashed border-gray-200 rounded-lg 
          cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}>
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-2">
            {uploading ? (
              <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
            ) : (
              <>
                <Upload className="w-6 h-6 text-gray-400 mb-2" />
                <p className="text-xs text-gray-500 font-semibold">Adicionar</p>
              </>
            )}
          </div>
          <input 
            type="file" 
            className="hidden" 
            multiple
            accept={acceptedTypes}
            onChange={handleFileSelect}
            disabled={uploading}
          />
        </label>
      </div>
      
      {value.length === 0 && (
        <p className="text-xs text-center text-gray-400 italic">
          Nenhum arquivo anexado.
        </p>
      )}
    </div>
  );
};

export default MultiFileUpload;