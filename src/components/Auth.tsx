import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { Box, Mail, Lock, LogIn, UserPlus, Sparkles, AlertCircle, Github, Chrome } from 'lucide-react';

interface AuthProps {
  theme: 'light' | 'dark';
}

export const Auth: React.FC<AuthProps> = ({ theme }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-500 ${theme === 'dark' ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`}>
      {/* Background Atmosphere */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/30 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/30 blur-[120px]" />
      </div>

      <div className={`w-full max-w-md relative z-10 transition-all duration-500 transform ${loading ? 'scale-[0.98] opacity-80' : 'scale-100 opacity-100'}`}>
        {/* Logo Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 shadow-2xl mb-6 transform rotate-3 hover:rotate-0 transition-transform duration-500">
            <Box size={32} className="text-white" />
          </div>
          <h1 className={`text-4xl font-black tracking-tighter mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            ARCHIVIEW <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">AI</span>
          </h1>
          <p className={`text-sm font-medium uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
            Architectural Perspective Engine
          </p>
        </div>

        {/* Auth Card */}
        <div className={`rounded-3xl border p-8 shadow-2xl backdrop-blur-xl transition-colors duration-500 ${theme === 'dark' ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="flex gap-4 mb-8 p-1 rounded-xl bg-gray-500/10">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${isLogin ? (theme === 'dark' ? 'bg-gray-800 text-white shadow-lg' : 'bg-white text-gray-900 shadow-md') : 'text-gray-500 hover:text-gray-400'}`}
            >
              Login
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${!isLogin ? (theme === 'dark' ? 'bg-gray-800 text-white shadow-lg' : 'bg-white text-gray-900 shadow-md') : 'text-gray-500 hover:text-gray-400'}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            <div className="space-y-1.5">
              <label className={`text-[10px] font-bold uppercase tracking-widest ml-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Email Address</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-500 transition-colors">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className={`w-full pl-12 pr-4 py-3.5 rounded-xl border outline-none transition-all text-sm font-medium ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700 text-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10'}`}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <label className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Password</label>
                {isLogin && (
                  <button 
                    type="button"
                    onClick={handleResetPassword}
                    className="text-[9px] font-bold uppercase tracking-widest text-purple-500 hover:text-purple-400 transition-colors"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-500 transition-colors">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full pl-12 pr-4 py-3.5 rounded-xl border outline-none transition-all text-sm font-medium ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700 text-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10'}`}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 animate-in fade-in slide-in-from-top-2">
                <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-[11px] font-medium text-red-400 leading-relaxed">{error}</p>
              </div>
            )}

            {resetSent && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 animate-in fade-in slide-in-from-top-2">
                <Sparkles size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-[11px] font-medium text-emerald-400 leading-relaxed">Password reset link sent to your email.</p>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className={`w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-xs uppercase tracking-[0.2em] shadow-xl hover:shadow-purple-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? <LogIn size={16} /> : <UserPlus size={16} />}
                  {isLogin ? 'Enter Workspace' : 'Create Account'}
                </>
              )}
            </button>
          </form>

          <div className="relative my-8">
            <div className={`absolute inset-0 flex items-center ${theme === 'dark' ? 'opacity-10' : 'opacity-5'}`}>
              <div className="w-full border-t border-gray-500"></div>
            </div>
            <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
              <span className={`px-4 ${theme === 'dark' ? 'bg-[#151619] text-gray-500' : 'bg-white text-gray-400'}`}>Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <button 
              onClick={handleGoogleSignIn}
              disabled={loading}
              className={`flex items-center justify-center gap-3 py-3.5 rounded-xl border font-bold text-[11px] uppercase tracking-widest transition-all ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700 text-white hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50 shadow-sm'}`}
            >
              <Chrome size={18} className="text-blue-500" />
              Google Account
            </button>
          </div>
        </div>

        {/* Footer Info */}
        <p className={`text-center mt-8 text-[10px] font-medium uppercase tracking-widest ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>
          Secure access to ArchiView Cloud
        </p>
      </div>
    </div>
  );
};
