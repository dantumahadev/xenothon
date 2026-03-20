import { useState } from 'react';
import { Github, TrendingUp, Search, Info, Shield, Linkedin, Sparkles, ArrowRight, Activity, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

const Dashboard = ({ address, onGenerate, isGenerating }) => {
  const [username, setUsername] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) onGenerate(username.trim(), { linkedin_url: linkedinUrl.trim() });
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-16">

      {/* Hero */}
      <motion.div variants={fadeUp} className="text-center relative pt-8">
        {/* Floating orbs */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-sky-200/40 rounded-full blur-3xl animate-float" />
          <div className="absolute top-10 right-1/4 w-48 h-48 bg-cyan-200/30 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
          <div className="absolute top-5 left-1/2 w-32 h-32 bg-teal-200/25 rounded-full blur-2xl animate-float" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-sky-50 border border-sky-200 text-sky-600 text-xs font-semibold px-4 py-2 rounded-full mb-6">
            <Sparkles className="w-3 h-3" />
            AI-Powered Credit Protocol
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 mb-5 leading-[1.1] tracking-tight">
            Your GitHub is your<br />
            <span className="gradient-text">Credit Score</span>
          </h1>
          <p className="text-lg text-slate-500 max-w-lg mx-auto leading-relaxed">
            AstraRisk transforms your developer activity into a verifiable trust score — unlocking under-collateralized DeFi loans.
          </p>
        </div>
      </motion.div>

      {/* Search card */}
      <motion.div variants={fadeUp} className="max-w-xl mx-auto">
        <div className="card-elevated p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                <Github className="w-3.5 h-3.5" /> GitHub Username
              </label>
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 focus-within:border-sky-400 focus-within:bg-sky-50/50 focus-within:ring-2 focus-within:ring-sky-100 transition-all duration-200">
                <Search className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. torvalds"
                  className="flex-1 text-sm text-slate-800"
                />
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <Linkedin className="w-3.5 h-3.5 text-sky-500" /> LinkedIn Profile
                <span className="text-slate-400 font-normal normal-case tracking-normal">(optional)</span>
              </label>
              <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-sky-400 transition-all">
                <span className="text-xs text-slate-400 mr-2 shrink-0">linkedin.com/in/</span>
                <input
                  type="text"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="your-profile"
                  className="flex-1 text-sm text-slate-800"
                />
              </div>
              <p className="text-xs text-slate-400">Auto-scraped to boost your trust score.</p>
            </div>

            <button
              type="submit"
              disabled={isGenerating || !address}
              className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
                isGenerating
                  ? 'bg-sky-100 text-sky-400 cursor-not-allowed'
                  : address
                  ? 'btn-primary'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              }`}
            >
              {isGenerating ? (
                <><span className="w-4 h-4 border-2 border-sky-300 border-t-sky-500 rounded-full animate-spin" /> Analyzing…</>
              ) : address ? (
                <><TrendingUp className="w-4 h-4" /> Generate Trust Score <ArrowRight className="w-4 h-4" /></>
              ) : (
                <><Lock className="w-4 h-4" /> Connect Wallet to Start</>
              )}
            </button>

            {!address && (
              <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
                <Info className="w-3 h-3" /> Connect your MetaMask wallet first.
              </p>
            )}
          </form>
        </div>
      </motion.div>

      {/* Feature cards */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
        {[
          {
            icon: <Github className="w-5 h-5 text-sky-500" />,
            bg: 'bg-sky-50', border: 'border-sky-100',
            title: 'GitHub Analysis',
            desc: 'Commit history, repo quality, language diversity, and fraud detection via graph analysis.',
          },
          {
            icon: <Activity className="w-5 h-5 text-emerald-500" />,
            bg: 'bg-emerald-50', border: 'border-emerald-100',
            title: 'AI Trust Score',
            desc: 'Random Forest model scores your developer reputation 0–100 with explainable signals.',
          },
          {
            icon: <Shield className="w-5 h-5 text-cyan-500" />,
            bg: 'bg-cyan-50', border: 'border-cyan-100',
            title: 'On-chain SBT',
            desc: 'Non-transferable Soulbound Token anchors your identity on-chain as a credit passport.',
          },
        ].map((f) => (
          <div key={f.title}
            className={`card p-5 ${f.bg} border ${f.border} group hover:-translate-y-1 transition-transform duration-200`}>
            <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              {f.icon}
            </div>
            <h3 className="font-semibold text-slate-800 text-sm mb-1.5">{f.title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
};

export default Dashboard;
