import React, { useState } from 'react';
import { Wallet, Layers, RefreshCw, Zap } from 'lucide-react';
import axios from 'axios';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

import Dashboard from './components/Dashboard';
import ScoreDisplay from './components/ScoreDisplay';
import Lending from './components/Lending';

const pageVariants = {
  initial: { opacity: 0, y: 20, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, y: -20, filter: 'blur(4px)', transition: { duration: 0.25 } },
};

function App() {
  const [address, setAddress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isGenerating, setIsGenerating] = useState(false);
  const [scoreData, setScoreData] = useState(null);
  const [noWalletError, setNoWalletError] = useState(false);

  React.useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts) => setAddress(accounts[0] || null);
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.request({ method: 'eth_accounts' })
      .then(accounts => { if (accounts[0]) setAddress(accounts[0]); });
    return () => window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) { setNoWalletError(true); return; }
    setNoWalletError(false);
    setIsConnecting(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setAddress(accounts[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleGenerateScore = async (username, linkedinData = {}) => {
    if (!address) return;
    setIsGenerating(true);
    try {
      const res = await axios.post('/api/generate-score', {
        github_username: username,
        wallet_address: address,
        ...linkedinData,
      });
      setScoreData(res.data);
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#0ea5e9', '#38bdf8', '#10b981'] });
      setCurrentPage('results');
    } catch (err) {
      console.error(err);
      alert("Error generating score. Make sure the GitHub user exists and the backend is running.");
    } finally {
      setIsGenerating(false);
    }
  };

  const navLinks = [
    { id: 'dashboard', label: 'Dashboard' },
    ...(scoreData ? [{ id: 'results', label: 'Score Report' }] : []),
    ...(scoreData ? [{ id: 'lending', label: 'Lending' }] : []),
  ];

  return (
    <div className="min-h-screen relative">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-sky-100"
        style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <button onClick={() => setCurrentPage('dashboard')} className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center shadow-md shadow-sky-200 group-hover:shadow-sky-300 transition-shadow">
              <Zap className="text-white w-4 h-4" />
            </div>
            <span className="text-lg font-bold text-slate-800 tracking-tight">
              Astra<span className="text-sky-500">Risk</span>
            </span>
          </button>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <button key={link.id} onClick={() => setCurrentPage(link.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  currentPage === link.id
                    ? 'bg-sky-50 text-sky-600 shadow-inner'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}>
                {link.label}
              </button>
            ))}
          </div>

          {/* Wallet */}
          <div className="flex flex-col items-end gap-1">
            {address ? (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-sm">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="font-mono text-slate-600 text-xs">
                  {address.substring(0, 6)}…{address.substring(38)}
                </span>
              </div>
            ) : (
              <>
                <button onClick={connectWallet} disabled={isConnecting} className="btn-primary flex items-center gap-2">
                  {isConnecting ? <RefreshCw className="animate-spin w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                  {isConnecting ? 'Connecting…' : 'Connect Wallet'}
                </button>
                {noWalletError && (
                  <p className="text-xs text-red-500">
                    MetaMask not found.{' '}
                    <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" className="underline">Install it</a>
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {currentPage === 'dashboard' && (
            <motion.div key="dashboard" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <Dashboard address={address} onGenerate={handleGenerateScore} isGenerating={isGenerating} />
            </motion.div>
          )}
          {currentPage === 'results' && scoreData && (
            <motion.div key="results" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <ScoreDisplay data={scoreData} onBorrow={() => setCurrentPage('lending')} onBack={() => setCurrentPage('dashboard')} />
            </motion.div>
          )}
          {currentPage === 'lending' && scoreData && (
            <motion.div key="lending" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <Lending data={scoreData} address={address} onBack={() => setCurrentPage('results')} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="relative z-10 text-center py-8 text-xs text-slate-400 border-t border-slate-100 mt-10">
        AstraRisk · AI-Powered Proof-of-Hustle Credit Protocol
      </footer>
    </div>
  );
}

export default App;
