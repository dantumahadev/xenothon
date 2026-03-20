import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

// Mock heavy deps
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...p }) => <div {...p}>{children}</div>,
    form: ({ children, ...p }) => <form {...p}>{children}</form>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

vi.mock('lucide-react', () => ({
  Github: () => null, Wallet: () => null, TrendingUp: () => null,
  Shield: () => null, Layers: () => null, RefreshCw: () => null,
  ChevronRight: () => null, Activity: () => null, Search: () => null,
  Info: () => null,
}));

vi.mock('axios', () => ({ default: { post: vi.fn() } }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('ethers', () => ({
  ethers: { BrowserProvider: vi.fn() },
}));

import App from '../App';

describe('App', () => {
  it('renders Connect Wallet button when no wallet connected', () => {
    render(<App />);
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('submit button is disabled when wallet is not connected', () => {
    render(<App />);
    // Dashboard renders "Connect Wallet to Start" as the disabled submit button
    const btn = screen.getByText('Connect Wallet to Start');
    expect(btn).toBeDisabled();
  });
});
