import { useState } from 'react';
import { ethers } from 'ethers';
import { ShieldCheck, Info, Banknote, CheckCircle, RefreshCw, Layers, ArrowLeft, AlertCircle, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { CONTRACT_ADDRESSES, SBT_ABI, LENDING_ABI } from '../contracts';

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const fadeUp  = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16,1,0.3,1] } } };

const Lending = ({ data, address, onBack }) => {
  const [amount, setAmount] = useState(data.loan_eligibility.max_loan);
  const [isMinting, setIsMinting] = useState(false);
  const [isBorrowing, setIsBorrowing] = useState(false);
  const [isMinted, setIsMinted] = useState(false);
  const [hasBorrowed, setHasBorrowed] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);

  const getSigner = async () => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    return provider.getSigner();
  };

  const handleMint = async () => {
    setError(null);
    if (!CONTRACT_ADDRESSES.SBT) {
      setIsMinting(true);
      setTimeout(() => { setIsMinting(false); setIsMinted(true); }, 2000);
      return;
    }
    setIsMinting(true);
    try {
      const signer = await getSigner();
      const sbt = new ethers.Contract(CONTRACT_ADDRESSES.SBT, SBT_ABI, signer);
      const tx = await sbt.mint(address, data.trust_score);
      await tx.wait();
      setIsMinted(true);
    } catch (err) {
      setError(err.reason || err.message || 'Mint failed');
    } finally {
      setIsMinting(false);
    }
  };

  const handleBorrow = async () => {
    setError(null);
    if (!CONTRACT_ADDRESSES.LENDING) {
      setIsBorrowing(true);
      setTimeout(() => { setIsBorrowing(false); setHasBorrowed(true); }, 2000);
      return;
    }
    setIsBorrowing(true);
    try {
      const signer = await getSigner();
      const lending = new ethers.Contract(CONTRACT_ADDRESSES.LENDING, LENDING_ABI, signer);
      const collateralPct = parseInt(data.loan_eligibility.collateral);
      const loanWei = ethers.parseEther(String(amount));
      const collateralWei = (loanWei * BigInt(collateralPct)) / 100n;
      const tx = await lending.requestLoan(loanWei, { value: collateralWei });
      const receipt = await tx.wait();
      setTxHash(receipt.hash);
      setHasBorrowed(true);
    } catch (err) {
      setError(err.reason || err.message || 'Borrow failed');
    } finally {
      setIsBorrowing(false);
    }
  };

  const collateralPct = parseInt(data.loan_eligibility.collateral);
  const collateralAmount = ((amount * collateralPct) / 100).toFixed(4);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-sky-500 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Score Report
        </button>
      </motion.div>

      <motion.div variants={fadeUp} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Finalize Credit Identity</h1>
          <p className="text-sm text-slate-500 mt-1">Mint your Soulbound Token to unlock on-chain credit.</p>
        </div>
        {!isMinted ? (
          <button onClick={handleMint} disabled={isMinting} className="btn-primary flex items-center gap-2 shrink-0">
            {isMinting ? <RefreshCw className="animate-spin w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            {isMinting ? 'Minting…' : 'Mint Soulbound ID'}
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl text-sm font-medium">
            <CheckCircle className="w-4 h-4" /> Identity Minted
          </div>
        )}
      </motion.div>

      {error && (
        <motion.div variants={fadeUp} className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Loan config */}
        <motion.div variants={fadeUp} className="card p-6 space-y-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />
          <h2 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
            <Banknote className="w-4 h-4 text-sky-500" /> Loan Configuration
          </h2>

          <div>
            <label className="text-xs text-slate-500 mb-2 block uppercase tracking-wider font-medium">Loan Amount (ETH)</label>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 focus-within:border-sky-400 focus-within:bg-sky-50/50 focus-within:ring-2 focus-within:ring-sky-100 transition-all">
              <span className="text-slate-500 mr-2 font-semibold">Ξ</span>
              <input
                type="number" step="0.01" min="0" max={data.loan_eligibility.max_loan}
                value={amount}
                onChange={(e) => setAmount(Math.min(Number(e.target.value), data.loan_eligibility.max_loan))}
                className="flex-1 text-slate-900 font-semibold text-lg bg-transparent"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">Max: Ξ{data.loan_eligibility.max_loan}</p>
          </div>

          <div className="space-y-1 pt-2 border-t border-slate-100">
            <div className="flex justify-between items-center py-2.5">
              <span className="text-sm text-slate-500">Required Collateral</span>
              <span className="font-semibold text-slate-800 text-sm">Ξ{collateralAmount} ({data.loan_eligibility.collateral})</span>
            </div>
            <div className="flex justify-between items-center py-2.5">
              <span className="text-sm text-slate-500">Fixed APR</span>
              <span className="font-semibold text-emerald-600 text-sm">{data.loan_eligibility.interest_rate}</span>
            </div>
          </div>

          <button onClick={handleBorrow} disabled={isBorrowing || hasBorrowed || !isMinted}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
              hasBorrowed
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                : isMinted ? 'btn-primary'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}>
            {isBorrowing ? <><RefreshCw className="animate-spin w-4 h-4" /> Processing…</>
              : hasBorrowed ? <><CheckCircle className="w-4 h-4" /> Funds Transferred</>
              : <><Banknote className="w-4 h-4" /> Borrow Now</>}
          </button>

          {txHash && (
            <p className="text-xs text-slate-500 text-center break-all">
              Tx: <span className="font-mono text-sky-600">{txHash}</span>
            </p>
          )}
          {!isMinted && (
            <p className="text-xs text-slate-400 flex items-center gap-1 justify-center">
              <Info className="w-3 h-3" /> Mint your identity above to enable borrowing.
            </p>
          )}
        </motion.div>

        {/* Identity card */}
        <motion.div variants={fadeUp} className="space-y-4">
          <div className="card p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />
            <h2 className="font-semibold text-slate-800 text-sm mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-500" /> Identity Preview
            </h2>
            {/* Credit card */}
            <div className="rounded-2xl p-5 text-white space-y-4 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7, #0369a1)' }}>
              <div className="absolute inset-0 opacity-20"
                style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.4) 0%, transparent 50%)' }} />
              <div className="flex justify-between items-start relative">
                <div>
                  <p className="text-xs opacity-60 uppercase tracking-widest mb-1">AstraRisk Credit ID</p>
                  <p className="font-bold text-lg uppercase tracking-wide">{data.github}</p>
                </div>
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Zap className="w-5 h-5" />
                </div>
              </div>
              <div className="flex justify-between items-end pt-3 border-t border-white/20 relative">
                <div>
                  <p className="text-xs opacity-60 uppercase tracking-widest mb-1">Status</p>
                  <p className={`text-sm font-bold ${isMinted ? 'text-emerald-200' : 'text-amber-200'}`}>
                    {isMinted ? '✓ IDENTITY MINTED' : '⏳ PENDING MINT'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-60 uppercase tracking-widest mb-1">Trust Score</p>
                  <p className="text-4xl font-extrabold">{data.trust_score}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-5 bg-sky-50 border-sky-100">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-sky-700 mb-2">
              <ShieldCheck className="w-4 h-4" /> Why a Soulbound Token?
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              AstraRisk SBTs are non-transferable NFTs that permanently anchor your GitHub reputation to your wallet — creating a tamper-proof credit identity usable across the DeFi ecosystem.
            </p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Lending;
