import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Sparkles, AlertCircle, Loader2, ArrowLeft, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const LoginPage = () => {
  const [view, setView] = useState('login'); // 'login' or 'forgot_password'
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Reset Password State
  const [resetEmail, setResetEmail] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || !password) {
        toast({
            title: "Campos obrigatórios",
            description: "Por favor, preencha e-mail e senha.",
            variant: "destructive",
        });
        return;
    }

    setIsLoading(true);

    try {
      const result = await login(email, password);
      
      if (result.success) {
        toast({
          title: "Sucesso!",
          description: "Login realizado. Redirecionando...",
          variant: "default", 
        });
        navigate('/sales');
      } else {
        let friendlyError = "Não foi possível realizar o login.";
        
        if (result.error.includes("Invalid login credentials")) {
            friendlyError = "E-mail ou senha incorretos.";
        } else if (result.error.includes("Email not confirmed")) {
            friendlyError = "Seu e-mail ainda não foi confirmado.";
        } else if (result.error.includes("Failed to fetch")) {
            friendlyError = "Erro de conexão. Verifique sua internet.";
        } else {
            friendlyError = result.error;
        }
        
        setErrorMsg(friendlyError);
        toast({
          title: "Falha no login",
          description: friendlyError,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Login Page Unexpected Error:", error);
      setErrorMsg("Ocorreu um erro inesperado.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!resetEmail) {
      toast({ title: "Campo obrigatório", description: "Digite seu e-mail.", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) {
        // Rate limit or other error
        if (error.message.includes("Rate limit")) {
           throw new Error("Muitas tentativas. Aguarde um pouco e tente novamente.");
        }
        throw error;
      }

      setSuccessMsg("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
      toast({
        title: "E-mail enviado",
        description: "Verifique sua caixa de entrada para redefinir a senha.",
      });
      
    } catch (error) {
      console.error("Reset Password Error:", error);
      setErrorMsg(error.message || "Falha ao enviar e-mail de recuperação.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{view === 'login' ? 'Login' : 'Recuperar Senha'} - Painel de Vendas Megumi Tarot</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-50 p-4">
        <motion.div
          key={view}
          initial={{ opacity: 0, x: view === 'login' ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-purple-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Megumi Tarot</h1>
              <p className="text-gray-500 text-sm mt-2">
                {view === 'login' ? 'Painel de Vendas' : 'Recuperação de Senha'}
              </p>
            </div>

            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-700"
              >
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{errorMsg}</p>
              </motion.div>
            )}

            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3 text-green-700"
              >
                <Sparkles className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{successMsg}</p>
              </motion.div>
            )}

            {view === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
                    placeholder="exemplo@email.com"
                    required
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Senha
                    </label>
                    <button 
                        type="button" 
                        onClick={() => {
                            setView('forgot_password');
                            setErrorMsg(null);
                            setSuccessMsg(null);
                        }}
                        className="text-xs font-medium text-purple-600 hover:text-purple-700 hover:underline"
                    >
                        Esqueceu a senha?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all pr-12"
                      placeholder="Sua senha"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-medium transition-all"
                >
                  {isLoading ? (
                      <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Entrando...
                      </span>
                  ) : 'Entrar'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleResetSubmit} className="space-y-5">
                <div className="text-center text-sm text-gray-600 mb-4">
                    Digite seu e-mail abaixo e enviaremos um link para você redefinir sua senha.
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    E-mail cadastrado
                  </label>
                  <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
                        placeholder="exemplo@email.com"
                        required
                      />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-medium transition-all"
                >
                  {isLoading ? (
                      <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Enviando...
                      </span>
                  ) : 'Enviar Link de Recuperação'}
                </Button>

                <div className="pt-2 text-center">
                    <button 
                        type="button"
                        onClick={() => {
                            setView('login');
                            setErrorMsg(null);
                            setSuccessMsg(null);
                        }}
                        className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Voltar para o Login
                    </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default LoginPage;