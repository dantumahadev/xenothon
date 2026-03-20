import { motion } from 'framer-motion';
import { ChevronRight, CheckCircle, AlertTriangle, ArrowLeft, GitCommit, Activity, TrendingUp, Wallet, Linkedin } from 'lucide-react';

const riskConfig = {
  LOW:    { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  MEDIUM: { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  HIGH:   { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     dot: 'bg-red-400' },
};

const scoreColor = (s) => s >= 75 ? '#10b981' : s >= 40 ? '#f59e0b' : '#ef4444';

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const fadeUp  = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16,1,0.3,1] } } };

const ScoreDisplay = ({ data, onBorrow, onBack }) => {
  const rc = riskConfig[data.risk_level] || riskConfig.MEDIUM;
  const color = scoreColor(data.trust_score);
  const C = 2 * Math.PI * 54;
  const offset = C - (data.trust_score / 100) * C;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">

      {/* Breadcrumb */}
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-sky-500 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </button>
        <span className="text-xs flex items-center gap-1.5 text-emerald-600">
          <Activity className="w-3 h-3" /> Trust scan complete
        </span>
      </motion.div>

      {/* Hero card */}
      <motion.div variants={fadeUp} className="card-elevated p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-30"
          style={{ background: color }} />

        <div className="flex flex-col md:flex-row items-center gap-8 relative">
          {/* Score ring */}
          <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="8" />
              <motion.circle cx="60" cy="60" r="54" fill="none" stroke={color} strokeWidth="8"
                strokeLinecap="round" strokeDasharray={C}
                initial={{ strokeDashoffset: C }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1.2, ease: [0.16,1,0.3,1], delay: 0.3 }}
                style={{ filter: `drop-shadow(0 0 6px ${color}90)` }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span className="text-5xl font-extrabold text-slate-900"
                initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.8, ease: [0.16,1,0.3,1] }}>
                {data.trust_score}
              </motion.span>
              <span className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1">Trust Score</span>
            </div>
          </div>

          {/* Summary */}
          <div className="flex-1 space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{data.github}'s Credit Profile</h2>
              <p className="text-sm text-slate-500 mt-1">AI-powered analysis · GitHub + Wallet + LinkedIn</p>
            </div>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${rc.bg} ${rc.border} ${rc.text}`}>
              <span className={`w-2 h-2 rounded-full ${rc.dot} animate-pulse`} />
              Risk Level: {data.risk_level}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <InfoTile label="Max Loan" value={`Ξ${data.loan_eligibility.max_loan}`} accent />
              <InfoTile label="Collateral" value={data.loan_eligibility.collateral} />
              <InfoTile label="APR" value={data.loan_eligibility.interest_rate} />
            </div>
            <button onClick={onBorrow} className="btn-primary flex items-center gap-2">
              Access Funds <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Score breakdown */}
      <motion.div variants={fadeUp} className="card p-6 space-y-5">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
          <TrendingUp className="w-4 h-4 text-sky-500" /> Score Breakdown
        </h3>
        <MetricBar label="GitHub Commit History" tooltip="Based on public repo count and follower count"
          value={data.breakdown.github_commit_score} color="#0ea5e9" />
        <MetricBar label="Repository Quality"
          tooltip={data.github_analysis?.repo_quality_reasons?.length > 0
            ? data.github_analysis.repo_quality_reasons.join(' · ')
            : "Based on total stars and forks across all repos"}
          value={data.breakdown.github_repo_quality} color="#06b6d4" />
        <MetricBar label="Wallet Consistency" tooltip="Consistency of on-chain wallet activity and inflows"
          value={data.breakdown.wallet_consistency} color="#8b5cf6" />
        <MetricBar label="Identity Integrity" tooltip="Inverse of fraud risk — higher means lower fraud probability"
          value={Math.round((1 - data.breakdown.fraud_risk) * 100)} color="#10b981" />
        {data.breakdown.linkedin_score > 0 && (
          <MetricBar label="LinkedIn Credibility" tooltip="Based on connections, years of experience, and profile verification"
            value={data.breakdown.linkedin_score} color="#3b82f6" />
        )}
      </motion.div>

      {/* LinkedIn panel */}
      {data.linkedin_analysis && data.linkedin_analysis.score > 0 && (
        <motion.div variants={fadeUp} className="card p-6 space-y-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
            <Linkedin className="w-4 h-4 text-blue-500" /> LinkedIn Analysis
          </h3>
          {data.linkedin_analysis.scraped && data.linkedin_analysis.name && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="font-semibold text-slate-800 text-sm">{data.linkedin_analysis.name}</p>
              {data.linkedin_analysis.headline && <p className="text-xs text-slate-500 mt-0.5">{data.linkedin_analysis.headline}</p>}
            </div>
          )}
          {data.linkedin_analysis.error && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Scrape note: {data.linkedin_analysis.error}
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Connections" value={data.linkedin_analysis.connections || '—'} />
            <StatCard label="Years Exp." value={data.linkedin_analysis.years_experience || '—'} />
            <StatCard label="Verified" value={data.linkedin_analysis.verified ? 'Yes' : 'No'} />
            <StatCard label="Score" value={`${data.linkedin_analysis.score}/100`} accent />
          </div>
        </motion.div>
      )}

      {/* Wallet panel */}
      {data.wallet_analysis && (
        <motion.div variants={fadeUp} className="card p-6 space-y-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
            <Wallet className="w-4 h-4 text-violet-500" /> Wallet Analysis
            {data.wallet_analysis.source === 'etherscan'
              ? <span className="ml-auto text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Live · Etherscan</span>
              : <span className="ml-auto text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">Simulated</span>}
          </h3>
          {data.wallet_analysis.error && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{data.wallet_analysis.error}</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Tx" value={data.wallet_analysis.tx_count} />
            <StatCard label="Incoming" value={data.wallet_analysis.incoming_tx} />
            <StatCard label="Outgoing" value={data.wallet_analysis.outgoing_tx} />
            <StatCard label="Unique Senders" value={data.wallet_analysis.unique_senders} />
            <StatCard label="ETH Received" value={`Ξ${data.wallet_analysis.eth_received}`} />
            <StatCard label="Wallet Age" value={`${data.wallet_analysis.first_tx_days_ago}d`} />
            <StatCard label="DeFi Calls" value={data.wallet_analysis.defi_interactions} />
            <StatCard label="Wallet Score" value={`${data.wallet_analysis.wallet_flow_score}/100`} accent />
          </div>
        </motion.div>
      )}

      {/* GitHub deep analysis */}
      {data.github_analysis && (
        <motion.div variants={fadeUp} className="card p-6 space-y-5">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
            <GitCommit className="w-4 h-4 text-sky-500" /> GitHub Deep Analysis
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Repos" value={data.github_analysis.public_repos} />
            <StatCard label="Original" value={data.github_analysis.original_repos} />
            <StatCard label="Forked" value={data.github_analysis.forked_repos} />
            <StatCard label="Active (90d)" value={data.github_analysis.recently_active_repos} />
            <StatCard label="Stars" value={data.github_analysis.total_stars} accent />
            <StatCard label="Forks" value={data.github_analysis.total_forks} />
            <StatCard label="Followers" value={data.github_analysis.followers} />
            <StatCard label="Account Age" value={`${data.github_analysis.account_age_days}d`} />
            <StatCard label="Recent Commits" value={data.github_analysis.recent_commits_top_repo} />
            <StatCard label="Top Language" value={data.github_analysis.top_language || 'N/A'} />
            <StatCard label="Languages" value={data.github_analysis.language_diversity} />
          </div>

          <div className={`rounded-xl border p-4 flex items-start gap-3 ${
            data.github_analysis.false_commit_risk === 'HIGH'   ? 'bg-red-50 border-red-200' :
            data.github_analysis.false_commit_risk === 'MEDIUM' ? 'bg-amber-50 border-amber-200' :
                                                                   'bg-emerald-50 border-emerald-200'
          }`}>
            {data.github_analysis.false_commit_risk === 'LOW'
              ? <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              : <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />}
            <div>
              <p className={`text-sm font-semibold mb-1 ${
                data.github_analysis.false_commit_risk === 'HIGH'   ? 'text-red-700' :
                data.github_analysis.false_commit_risk === 'MEDIUM' ? 'text-amber-700' : 'text-emerald-700'
              }`}>
                False Commit Risk: {data.github_analysis.false_commit_risk}
              </p>
              {data.github_analysis.suspicious_flags?.length > 0 ? (
                <ul className="text-xs text-slate-600 space-y-1">
                  {data.github_analysis.suspicious_flags.map((f, i) => <li key={i}>· {f}</li>)}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">No suspicious patterns detected</p>
              )}
            </div>
          </div>

          {data.github_analysis.languages?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.github_analysis.languages.map(lang => (
                <span key={lang} className="chip bg-sky-50 text-sky-700 border border-sky-100 text-xs">{lang}</span>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};

const MetricBar = ({ label, tooltip, value, color }) => (
  <div>
    <div className="flex justify-between items-start mb-2">
      <div>
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {tooltip && <p className="text-xs text-slate-400 mt-0.5 max-w-xs">{tooltip}</p>}
      </div>
      <span className="text-sm font-bold ml-4 shrink-0" style={{ color }}>{Math.round(value)}/100</span>
    </div>
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }} animate={{ width: `${value}%` }}
        transition={{ duration: 1, delay: 0.2, ease: [0.16,1,0.3,1] }}
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${color}80, ${color})` }}
      />
    </div>
  </div>
);

const InfoTile = ({ label, value, accent }) => (
  <div className={`rounded-xl p-3 text-center border ${accent ? 'bg-sky-50 border-sky-200' : 'bg-slate-50 border-slate-200'}`}>
    <p className="text-xs text-slate-500 mb-1">{label}</p>
    <p className={`font-bold text-sm ${accent ? 'text-sky-600' : 'text-slate-800'}`}>{value}</p>
  </div>
);

const StatCard = ({ label, value, accent }) => (
  <div className={`rounded-xl p-3 border ${accent ? 'bg-sky-50 border-sky-200' : 'bg-slate-50 border-slate-200'}`}>
    <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
    <p className={`font-bold text-base ${accent ? 'text-sky-600' : 'text-slate-800'}`}>{value}</p>
  </div>
);

export default ScoreDisplay;
