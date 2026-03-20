import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...p }) => <div {...p}>{children}</div>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

vi.mock('lucide-react', () => ({
  Shield: () => null, ChevronRight: () => null, Share: () => null,
  CheckCircle: () => null, AlertTriangle: () => null, ArrowLeft: () => null,
  GitCommit: () => null, Search: () => null, Activity: () => null,
}));

import ScoreDisplay from '../components/ScoreDisplay';

const mockData = {
  trust_score: 86,
  risk_level: 'LOW',
  github: 'testuser',
  breakdown: {
    github_commit_score: 70,
    github_repo_quality: 60,
    wallet_consistency: 80,
    fraud_risk: 0.1,
  },
  loan_eligibility: {
    max_loan: 860,
    collateral: '50%',
    interest_rate: '8%',
  },
};

describe('ScoreDisplay', () => {
  it('renders the trust score value', () => {
    render(<ScoreDisplay data={mockData} onBorrow={() => {}} onBack={() => {}} />);
    expect(screen.getByText('86')).toBeInTheDocument();
  });

  it('renders the risk level badge', () => {
    render(<ScoreDisplay data={mockData} onBorrow={() => {}} onBack={() => {}} />);
    expect(screen.getByText(/LOW/)).toBeInTheDocument();
  });

  it('renders loan eligibility with correct values', () => {
    render(<ScoreDisplay data={mockData} onBorrow={() => {}} onBack={() => {}} />);
    expect(screen.getByText('$860')).toBeInTheDocument();
    expect(screen.getByText(/8%.*APR|APR.*8%|8%/)).toBeInTheDocument();
  });
});
