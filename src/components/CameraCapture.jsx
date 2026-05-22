import React, { useRef, useState, useCallback, useEffect } from 'react';
import { X, RefreshCcw, Check, Camera, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const CameraCapture = ({ onCapture, isOpen, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null); // Use Ref to track stream across renders properly
  
  const [capturedImage, setCapturedImage] = useState(null);
  const [error, setError] = useState(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    // Ensure any existing stream is stopped before starting a new one
    stopCamera();
    
    try {
      setError(null);
      
      // Try environment camera first (rear camera on mobile)
      const constraints = {
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Required for iOS to play video
        await videoRef.current.play().catch(e => console.log("Video play error:", e));
      }
    } catch (err) {
      console.error("Camera access error:", err);
      // Fallback: try any video camera if specific constraints failed
      try {
         const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
         streamRef.current = fallbackStream;
         if (videoRef.current) {
             videoRef.current.srcObject = fallbackStream;
             await videoRef.current.play().catch(e => console.log("Fallback play error:", e));
         }
      } catch (fallbackErr) {
        console.error("Fallback camera error:", fallbackErr);
        setError("Não foi possível acessar a câmera. Verifique se você deu permissão ao navegador.");
      }
    }
  }, [stopCamera]);

  useEffect(() => {
    if (isOpen) {
      // Small timeout to ensure video element is mounted in DOM by Dialog
      const timer = setTimeout(() => {
          startCamera();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      stopCamera();
      setCapturedImage(null);
      setError(null);
    }
    
    return () => {
        stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (video.readyState !== 4 && video.readyState !== 3) return; // Ensure video is ready

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      
      // Mirror image if using front camera (optional, but typical) - logic omitted for simplicity unless requested
      // Just draw image
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
          setCapturedImage({ url: URL.createObjectURL(blob), file });
        }
      }, 'image/jpeg', 0.90);
    }
  };

  const retake = () => {
    setCapturedImage(null);
  };

  const confirm = () => {
    if (capturedImage) {
      onCapture(capturedImage.file);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-black border-gray-800 text-white p-0 gap-0 overflow-hidden outline-none">
        <DialogHeader className="p-4 absolute top-0 left-0 w-full z-20 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex justify-between items-center w-full">
            <DialogTitle className="text-white font-medium flex items-center gap-2">
              <Camera className="w-4 h-4" /> Capturar Foto
            </DialogTitle>
            <DialogDescription className="sr-only">
              Interface de captura de foto para leitura de tarot
            </DialogDescription>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20 h-8 w-8 rounded-full">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="relative aspect-[3/4] w-full bg-gray-900 flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="text-center p-6 max-w-xs mx-auto z-10">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
              <p className="text-red-400 mb-4 text-sm">{error}</p>
              <Button onClick={startCamera} variant="outline" size="sm" className="border-red-400 text-red-400 hover:bg-red-400/10 hover:text-red-300">
                Tentar Novamente
              </Button>
            </div>
          ) : !capturedImage ? (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover"
            />
          ) : (
            <img 
              src={capturedImage.url} 
              alt="Captured" 
              className="w-full h-full object-cover" 
            />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="p-6 bg-black flex justify-center items-center gap-4 z-20">
          {!capturedImage ? (
            <button 
              onClick={takePhoto}
              disabled={!!error}
              className="h-16 w-16 rounded-full border-4 border-white flex items-center justify-center p-1 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-black transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-full h-full rounded-full bg-white"></div>
            </button>
          ) : (
            <div className="flex w-full gap-3">
              <Button onClick={retake} variant="secondary" className="flex-1 bg-gray-800 text-white hover:bg-gray-700 border-0 h-12">
                <RefreshCcw className="w-4 h-4 mr-2" /> Refazer
              </Button>
              <Button onClick={confirm} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white border-0 h-12">
                <Check className="w-4 h-4 mr-2" /> Confirmar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CameraCapture;