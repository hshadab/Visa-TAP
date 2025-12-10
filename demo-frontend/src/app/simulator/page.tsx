'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/ui/Header';
import { TransactionCard } from '@/components/ui/TransactionCard';
import { ProofVisualizer } from '@/components/ui/ProofVisualizer';
import { VerificationBadge, type VerificationStatus } from '@/components/ui/VerificationBadge';
import {
  generateTransactionContext,
  generateAgentDecision,
  generateMockProof,
  getRandomAgent,
  type TransactionContext,
  type AgentDecision,
  type MockProof,
} from '@/lib/mock';
import { sleep, formatCurrency } from '@/lib/utils';
import {
  Bot,
  Store,
  Zap,
  RefreshCw,
  CheckCircle,
  XCircle,
  ArrowRight,
  Wifi,
} from 'lucide-react';

type SimulatorState = 'idle' | 'generating' | 'transmitting' | 'verifying' | 'complete';

export default function SimulatorPage() {
  const [state, setState] = useState<SimulatorState>('idle');
  const [transaction, setTransaction] = useState<TransactionContext | null>(null);
  const [decision, setDecision] = useState<AgentDecision | null>(null);
  const [proof, setProof] = useState<MockProof | null>(null);
  const [proofTime, setProofTime] = useState<number | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('pending');
  const [agent] = useState(getRandomAgent);

  const isHighValue = transaction ? transaction.amount >= 100000 : false;

  const runSimulation = useCallback(async () => {
    // Reset state
    setState('idle');
    setProof(null);
    setProofTime(null);
    setVerificationStatus('pending');

    // Generate new transaction
    const newTransaction = generateTransactionContext();
    setTransaction(newTransaction);
    setDecision(null);

    await sleep(500);

    // Generate agent decision
    const newDecision = generateAgentDecision();
    setDecision(newDecision);

    // Check if proof is required (>$1000)
    if (newTransaction.amount >= 100000) {
      await sleep(300);

      // Generate proof
      setState('generating');
      const startTime = performance.now();

      // Simulate proof generation (700ms target)
      await sleep(700 + Math.random() * 200);

      const newProof = generateMockProof();
      const endTime = performance.now();

      setProof(newProof);
      setProofTime((endTime - startTime) / 1000);

      // Transmit to merchant
      setState('transmitting');
      await sleep(500);

      // Verify proof
      setState('verifying');
      await sleep(300);

      // Set final status
      setVerificationStatus('verified');
      setState('complete');
    } else {
      setVerificationStatus('not-required');
      setState('complete');
    }
  }, []);

  return (
    <div className="min-h-screen bg-surface-secondary">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-visa-blue mb-2">
            Transaction Simulator
          </h1>
          <p className="text-gray-600">
            Watch real-time zkML proof generation and verification between AI agents and merchants
          </p>
        </div>

        {/* Controls */}
        <div className="flex justify-center mb-8">
          <button
            onClick={runSimulation}
            disabled={state !== 'idle' && state !== 'complete'}
            className="btn-gold text-lg px-8 py-3"
          >
            {state === 'idle' ? (
              <>
                <Zap className="w-5 h-5 mr-2" />
                Start Transaction
              </>
            ) : state === 'complete' ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2" />
                New Transaction
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            )}
          </button>
        </div>

        {/* Split Screen */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Agent Side */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-visa-blue flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-visa-blue">AI Agent</h2>
                <p className="text-sm text-gray-500">{agent.name}</p>
              </div>
              <div className="ml-auto">
                {state !== 'idle' && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-2 h-2 bg-verified rounded-full animate-pulse" />
                    Active
                  </div>
                )}
              </div>
            </div>

            {/* Transaction Input */}
            <div className="card p-4">
              <h3 className="font-medium text-sm text-gray-600 mb-3">Transaction Request</h3>
              {transaction ? (
                <TransactionCard
                  transaction={transaction}
                  decision={decision || undefined}
                  showDetails={true}
                />
              ) : (
                <div className="py-12 text-center text-gray-400">
                  <Store className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Click "Start Transaction" to begin</p>
                </div>
              )}
            </div>

            {/* Proof Generation */}
            <ProofVisualizer
              proof={proof}
              isGenerating={state === 'generating'}
              generationTime={proofTime || undefined}
            />
          </div>

          {/* Center Connection Indicator */}
          <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 flex-col items-center gap-2">
            <AnimatePresence>
              {state === 'transmitting' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-2 px-4 py-2 bg-visa-blue text-white rounded-full text-sm shadow-lg"
                >
                  <Wifi className="w-4 h-4 animate-pulse" />
                  TAP Message
                  <ArrowRight className="w-4 h-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Merchant Side */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-verified flex items-center justify-center">
                <Store className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-visa-blue">Merchant</h2>
                <p className="text-sm text-gray-500">
                  {transaction?.merchantName || 'Awaiting transaction...'}
                </p>
              </div>
            </div>

            {/* Verification Status Card */}
            <div className="card p-6">
              <h3 className="font-medium text-sm text-gray-600 mb-4">Verification Status</h3>

              {state === 'idle' ? (
                <div className="py-12 text-center text-gray-400">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Waiting for incoming transaction...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Threshold Check */}
                  <div className="data-row">
                    <span className="text-sm text-gray-600">Transaction Amount</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {transaction && formatCurrency(transaction.amount)}
                      </span>
                      {isHighValue ? (
                        <span className="status-badge bg-visa-gold/20 text-visa-gold">
                          Above $1,000
                        </span>
                      ) : (
                        <span className="status-badge bg-gray-100 text-gray-500">
                          Below threshold
                        </span>
                      )}
                    </div>
                  </div>

                  {/* zkML Required */}
                  <div className="data-row">
                    <span className="text-sm text-gray-600">zkML Proof Required</span>
                    {isHighValue ? (
                      <span className="text-verified font-medium flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Yes
                      </span>
                    ) : (
                      <span className="text-gray-500 flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> No
                      </span>
                    )}
                  </div>

                  {/* Proof Received */}
                  {isHighValue && (
                    <div className="data-row">
                      <span className="text-sm text-gray-600">Proof Received</span>
                      {proof ? (
                        <span className="text-verified font-medium flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" /> Yes
                        </span>
                      ) : state === 'transmitting' ? (
                        <span className="text-pending flex items-center gap-1">
                          <RefreshCw className="w-4 h-4 animate-spin" /> Receiving...
                        </span>
                      ) : (
                        <span className="text-gray-400">Waiting...</span>
                      )}
                    </div>
                  )}

                  {/* Model Registered */}
                  {isHighValue && proof && (
                    <div className="data-row">
                      <span className="text-sm text-gray-600">Model Registered</span>
                      <span className="text-verified font-medium flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Verified with Visa
                      </span>
                    </div>
                  )}

                  {/* Verification Result */}
                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Final Status</span>
                      <VerificationBadge
                        status={
                          state === 'complete'
                            ? verificationStatus
                            : state === 'verifying'
                            ? 'pending'
                            : 'pending'
                        }
                        animate={true}
                      />
                    </div>
                  </div>

                  {/* Action Button */}
                  {state === 'complete' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="pt-4"
                    >
                      <button
                        className={`w-full py-3 rounded-lg font-medium transition-colors ${
                          verificationStatus === 'verified' || verificationStatus === 'not-required'
                            ? 'bg-verified text-white'
                            : 'bg-failed text-white'
                        }`}
                      >
                        {verificationStatus === 'verified' || verificationStatus === 'not-required'
                          ? 'Accept Payment'
                          : 'Reject Payment'}
                      </button>
                    </motion.div>
                  )}
                </div>
              )}
            </div>

            {/* TAP Headers Preview */}
            {proof && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card overflow-hidden"
              >
                <div className="px-4 py-3 bg-visa-blue-dark text-white text-sm font-medium">
                  TAP Message Headers
                </div>
                <pre className="code-block text-[10px] leading-relaxed max-h-48 overflow-auto">
{`X-ZKML-PROOF: ${proof.executionProof.slice(0, 40)}...
X-ZKML-MODEL-COMMITMENT: ${proof.modelCommitment.slice(0, 16)}...
X-ZKML-INPUT-COMMITMENT: ${proof.inputCommitment.slice(0, 16)}...
X-ZKML-OUTPUT-COMMITMENT: ${proof.outputCommitment.slice(0, 16)}...
X-ZKML-TIMESTAMP: ${proof.timestamp}
X-ZKML-THRESHOLD: 100000`}
                </pre>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
