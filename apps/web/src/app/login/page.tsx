"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Lock, 
  User, 
  Layers, 
  ChevronLeft 
} from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulating login and setting session cookie
    setTimeout(() => {
      setLoading(false);
      // Creamos la cookie de sesión (en una app real esto lo haría el backend)
      document.cookie = "axos_session=true; path=/; max-age=3600";
      router.push("/dashboard");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex items-center justify-center p-4 md:p-0">
      <Link 
        href="/" 
        className="fixed top-8 left-8 flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black dark:hover:text-white transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to home
      </Link>

      <div className="w-full max-w-5xl flex flex-col md:flex-row bg-white dark:bg-[#111] rounded-[2.5rem] overflow-hidden shadow-2xl shadow-black/10 dark:shadow-white/5 border border-gray-100 dark:border-white/5 min-h-[600px]">
        
        {/* Left: Brand Panel */}
        <div className="w-full md:w-1/2 bg-black dark:bg-white p-12 flex flex-col justify-between text-white dark:text-black relative overflow-hidden">
          {/* Animated Background Elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gradient-to-br from-white/20 to-transparent rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gradient-to-tl from-white/20 to-transparent rounded-full blur-3xl" />
          </div>

          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="z-10"
          >
            <div className="flex items-center gap-2 mb-12">
              <div className="w-10 h-10 bg-white dark:bg-black rounded-xl flex items-center justify-center shadow-lg">
                <Layers className="w-6 h-6 text-black dark:text-white" />
              </div>
              <span className="text-2xl font-bold tracking-tight">AXOS <span className="font-light opacity-60">OS</span></span>
            </div>
            
            <h1 className="text-5xl font-bold tracking-tighter leading-tight mb-6">
              Empowering <br /> 
              Industrial <br /> 
              Intelligence.
            </h1>
            <p className="text-lg opacity-60 font-light max-w-xs mb-8">
              The mission-critical operating system for the next generation of manufacturing.
            </p>

            <div className="flex flex-wrap gap-3">
              {["Multi-tenant", "Real-time", "Traceability"].map((tag) => (
                <span key={tag} className="px-3 py-1 bg-white/10 dark:bg-black/5 rounded-full text-xs font-medium border border-white/10 dark:border-black/10">
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>

          <div className="z-10 text-xs opacity-40 font-light">
            © 2026 AXOS OS. Engineering Excellence.
          </div>
        </div>

        {/* Right: Form Panel */}
        <div className="w-full md:w-1/2 p-12 md:p-20 flex flex-col justify-center">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="mb-10">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-2 block">Secure Access</span>
              <h2 className="text-3xl font-bold tracking-tight mb-2">Welcome Back</h2>
              <p className="text-gray-500 dark:text-gray-400 font-light text-sm">
                Enter your credentials to access the AXOS console.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1">User or Email</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors">
                    <User className="w-4 h-4" />
                  </div>
                  <input 
                    type="text" 
                    required
                    placeholder="3312793"
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl py-4 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 focus:border-black dark:focus:border-white transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Password</label>
                  <a href="#" className="text-[10px] uppercase tracking-wider font-bold text-gray-400 hover:text-black dark:hover:text-white transition-colors">Forgot?</a>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    placeholder="••••••••"
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl py-4 pl-11 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 focus:border-black dark:focus:border-white transition-all outline-none"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 mt-8"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    Sign In to AXOS
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-10 text-center">
              <p className="text-xs text-gray-400 font-light">
                Need help? <a href="#" className="font-bold text-gray-500 dark:text-gray-300 hover:underline">Contact Administrator</a>
              </p>
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
}
