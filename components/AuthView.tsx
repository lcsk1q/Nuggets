import React, { useState } from 'react';
import { api, tokenStorage } from '../services/api';
import { User } from '../types';
import { Lock, Mail, User as UserIcon, AtSign, ArrowRight, AlertCircle, Info, CheckCircle2 } from 'lucide-react';

interface AuthViewProps {
  onLoginSuccess: (user: User) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [googleNotice, setGoogleNotice] = useState<string | null>(null);
  const [forgotNotice, setForgotNotice] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setGoogleNotice(null);

    if (!loginEmail.trim() || !loginPassword) {
      setErrorMessage('Informe seu e-mail (ou usuário) e senha.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.auth.login(loginEmail.trim(), loginPassword);
      tokenStorage.set(res.token);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Credenciais inválidas. Verifique os dados informados.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setGoogleNotice(null);

    if (!regUsername.trim() || !regDisplayName.trim() || !regEmail.trim() || !regPassword) {
      setErrorMessage('Preencha todos os campos obrigatórios.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('As senhas digitadas não coincidem.');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMessage('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.auth.register({
        username: regUsername.trim(),
        displayName: regDisplayName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        confirmPassword: regConfirmPassword
      });
      tokenStorage.set(res.token);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao registrar usuário.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    try {
      const res = await api.auth.getGoogleUrl();
      if (res.configured && res.url) {
        window.location.href = res.url;
      } else {
        setGoogleNotice(
          res.message ||
          'Para ativar o login com Google, configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no ambiente (.env).'
        );
      }
    } catch (err) {
      setGoogleNotice(
        'Para ativar o login com Google, configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no ambiente (.env).'
      );
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#1e1f22] flex items-center justify-center p-4 select-none relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#5865F2]/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-md bg-[#313338] border border-[#232428] rounded-2xl shadow-2xl p-8 relative z-10">
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg mb-3">
            <span className="text-2xl font-black tracking-wider">🍗</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {mode === 'login' ? 'Boas-vindas de volta!' : 'Criar uma conta'}
          </h1>
          <p className="text-sm text-[#949ba4] mt-1">
            {mode === 'login'
              ? 'Estamos muito felizes em te ver por aqui novamente!'
              : 'Junte-se à plataforma de chat real para conversar com seus amigos.'}
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-5 p-3 rounded-lg bg-[#f23f43]/15 border border-[#f23f43]/30 flex items-start gap-2.5 text-xs text-[#f67175]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Google Notice Alert */}
        {googleNotice && (
          <div className="mb-5 p-3 rounded-lg bg-[#5865F2]/15 border border-[#5865F2]/30 flex items-start gap-2.5 text-xs text-[#c9cdfb]">
            <Info size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block mb-0.5">Configuração do Google OAuth</span>
              <span>{googleNotice}</span>
            </div>
          </div>
        )}

        {/* Forgot Password Dialog */}
        {forgotNotice && (
          <div className="mb-5 p-3 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
            <Info size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block mb-0.5">Redefinição de Senha</span>
              <span>Para redefinir sua senha, entre em contato com o suporte ou crie uma nova conta com seu e-mail.</span>
            </div>
            <button
              onClick={() => setForgotNotice(false)}
              className="text-amber-200 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {mode === 'login' ? (
          /* LOGIN FORM */
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider mb-1.5">
                E-mail ou Nome de Usuário <span className="text-[#f23f43]">*</span>
              </label>
              <div className="relative">
                <input
                  id="login-email"
                  type="text"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="seu_email@exemplo.com ou @usuario"
                  className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-md px-3 py-2.5 text-sm text-[#dbdee1] placeholder-[#5c5f66] focus:outline-none focus:border-[#5865F2] transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider">
                  Senha <span className="text-[#f23f43]">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setForgotNotice(true)}
                  className="text-xs text-[#00a8fc] hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>
              <input
                id="login-password"
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-md px-3 py-2.5 text-sm text-[#dbdee1] placeholder-[#5c5f66] focus:outline-none focus:border-[#5865F2] transition-colors"
              />
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-[#5865F2] hover:bg-[#4752c4] active:bg-[#3c45a5] text-white font-medium text-sm rounded-md transition-colors flex items-center justify-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Entrar</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Divider */}
            <div className="relative my-4 flex items-center justify-center">
              <div className="w-full border-t border-[#35373c]" />
              <span className="bg-[#313338] px-3 text-[11px] font-bold text-[#80848e] uppercase tracking-wider absolute">
                ou
              </span>
            </div>

            {/* Google OAuth Button */}
            <button
              id="btn-google-login"
              type="button"
              onClick={handleGoogleLogin}
              className="w-full h-10 bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] hover:text-white text-xs font-semibold rounded-md border border-[#3f4147] transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Continuar com Google</span>
            </button>

            {/* Switch to Register */}
            <p className="text-xs text-[#949ba4] text-center pt-2">
              Ainda não possui uma conta?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMessage(null);
                  setGoogleNotice(null);
                }}
                className="text-[#00a8fc] hover:underline font-semibold"
              >
                Criar conta
              </button>
            </p>
          </form>
        ) : (
          /* REGISTER FORM */
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider mb-1">
                Nome de Usuário (único) <span className="text-[#f23f43]">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-[#80848e] text-sm">@</span>
                <input
                  id="reg-username"
                  type="text"
                  required
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  placeholder="lucas123"
                  className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-md pl-8 pr-3 py-2 text-sm text-[#dbdee1] placeholder-[#5c5f66] focus:outline-none focus:border-[#5865F2] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider mb-1">
                Nome de Exibição <span className="text-[#f23f43]">*</span>
              </label>
              <input
                id="reg-displayname"
                type="text"
                required
                value={regDisplayName}
                onChange={(e) => setRegDisplayName(e.target.value)}
                placeholder="Lucas"
                className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-md px-3 py-2 text-sm text-[#dbdee1] placeholder-[#5c5f66] focus:outline-none focus:border-[#5865F2] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider mb-1">
                E-mail <span className="text-[#f23f43]">*</span>
              </label>
              <input
                id="reg-email"
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="lucas@email.com"
                className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-md px-3 py-2 text-sm text-[#dbdee1] placeholder-[#5c5f66] focus:outline-none focus:border-[#5865F2] transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider mb-1">
                  Senha <span className="text-[#f23f43]">*</span>
                </label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Min. 6 caracteres"
                  className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-md px-3 py-2 text-sm text-[#dbdee1] placeholder-[#5c5f66] focus:outline-none focus:border-[#5865F2] transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider mb-1">
                  Confirmar <span className="text-[#f23f43]">*</span>
                </label>
                <input
                  id="reg-confirmpassword"
                  type="password"
                  required
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-md px-3 py-2 text-sm text-[#dbdee1] placeholder-[#5c5f66] focus:outline-none focus:border-[#5865F2] transition-colors"
                />
              </div>
            </div>

            <button
              id="btn-register-submit"
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-[#5865F2] hover:bg-[#4752c4] active:bg-[#3c45a5] text-white font-medium text-sm rounded-md transition-colors flex items-center justify-center gap-2 shadow-md disabled:opacity-50 cursor-pointer mt-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Criar conta</span>
                  <CheckCircle2 size={16} />
                </>
              )}
            </button>

            {/* Switch to Login */}
            <p className="text-xs text-[#949ba4] text-center pt-2">
              Já tem uma conta?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                  setGoogleNotice(null);
                }}
                className="text-[#00a8fc] hover:underline font-semibold"
              >
                Entrar
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};
