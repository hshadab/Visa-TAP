'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/ui/Header';
import { cn, truncateHash } from '@/lib/utils';
import {
  generateMockProof,
  generateTransactionContext,
  generateAgentDecision,
  getRandomAgent,
  type MockProof,
  type TransactionContext,
  type AgentDecision,
} from '@/lib/mock';
import {
  Shield,
  FileCheck,
  Bot,
  Store,
  Building2,
  CheckCircle,
  ArrowRight,
  ArrowDown,
  Play,
  RotateCcw,
  Code,
  Hash,
  Clock,
  Lock,
  Unlock,
  Server,
  Eye,
  ChevronRight,
} from 'lucide-react';

type FlowStep =
  | 'idle'
  | 'certification'
  | 'model-registered'
  | 'transaction-initiated'
  | 'agent-decision'
  | 'proof-generation'
  | 'tap-message'
  | 'merchant-receives'
  | 'verification-choice'
  | 'facilitator-verify'
  | 'local-verify'
  | 'verified'
  | 'complete';

interface StepInfo {
  id: FlowStep;
  title: string;
  description: string;
  actor: 'agent' | 'visa' | 'merchant' | 'facilitator';
  detail?: React.ReactNode;
}

export default function TapFlowPage() {
  const [currentStep, setCurrentStep] = useState<FlowStep>('idle');
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [verificationPath, setVerificationPath] = useState<'facilitator' | 'local' | null>(null);
  const [proof, setProof] = useState<MockProof | null>(null);
  const [transaction, setTransaction] = useState<TransactionContext | null>(null);
  const [decision, setDecision] = useState<AgentDecision | null>(null);
  const [agent] = useState(getRandomAgent);

  const stepOrder: FlowStep[] = [
    'idle',
    'certification',
    'model-registered',
    'transaction-initiated',
    'agent-decision',
    'proof-generation',
    'tap-message',
    'merchant-receives',
    'verification-choice',
    verificationPath === 'local' ? 'local-verify' : 'facilitator-verify',
    'verified',
    'complete',
  ];

  const currentStepIndex = stepOrder.indexOf(currentStep);

  const steps: StepInfo[] = [
    {
      id: 'certification',
      title: 'Model Certification',
      description: 'Agent generates cryptographic commitment from ML model weights and architecture',
      actor: 'agent',
    },
    {
      id: 'model-registered',
      title: 'Visa Registration',
      description: 'Model commitment registered with Visa for approved agent operations',
      actor: 'visa',
    },
    {
      id: 'transaction-initiated',
      title: 'Transaction Initiated',
      description: 'High-value payment request triggers AI agent for fraud assessment',
      actor: 'merchant',
    },
    {
      id: 'agent-decision',
      title: 'AI Decision',
      description: 'Agent analyzes transaction context and produces approval decision',
      actor: 'agent',
    },
    {
      id: 'proof-generation',
      title: 'zkML Proof Generation',
      description: 'JOLT-Atlas generates zero-knowledge proof of model execution (~0.7s)',
      actor: 'agent',
    },
    {
      id: 'tap-message',
      title: 'TAP Message Construction',
      description: 'Proof embedded in TAP authorization message via X-ZKML-* headers',
      actor: 'agent',
    },
    {
      id: 'merchant-receives',
      title: 'Merchant Receives',
      description: 'Payment gateway extracts zkML headers from TAP message',
      actor: 'merchant',
    },
    {
      id: 'verification-choice',
      title: 'Verification Path',
      description: 'Merchant chooses facilitator or local verification',
      actor: 'merchant',
    },
    {
      id: 'facilitator-verify',
      title: 'Facilitator Verification',
      description: 'NovaNet verification service validates proof cryptographically',
      actor: 'facilitator',
    },
    {
      id: 'local-verify',
      title: 'Local Verification',
      description: 'Merchant CDN validates proof using @icme/zkml-verifier SDK',
      actor: 'merchant',
    },
    {
      id: 'verified',
      title: 'Proof Verified',
      description: 'Model commitment matches registry, execution verified',
      actor: 'merchant',
    },
    {
      id: 'complete',
      title: 'Transaction Complete',
      description: 'Payment approved with cryptographic guarantee of AI decision integrity',
      actor: 'merchant',
    },
  ];

  const advanceStep = () => {
    if (currentStep === 'idle') {
      setTransaction(generateTransactionContext());
      setCurrentStep('certification');
    } else if (currentStep === 'agent-decision') {
      setDecision(generateAgentDecision());
      setCurrentStep('proof-generation');
    } else if (currentStep === 'proof-generation') {
      setProof(generateMockProof());
      setCurrentStep('tap-message');
    } else if (currentStep === 'verification-choice') {
      // Don't advance, wait for user choice
      return;
    } else {
      const nextIndex = currentStepIndex + 1;
      if (nextIndex < stepOrder.length) {
        setCurrentStep(stepOrder[nextIndex]);
      }
    }
  };

  const selectVerificationPath = (path: 'facilitator' | 'local') => {
    setVerificationPath(path);
    setCurrentStep(path === 'facilitator' ? 'facilitator-verify' : 'local-verify');
  };

  const reset = () => {
    setCurrentStep('idle');
    setIsAutoPlaying(false);
    setVerificationPath(null);
    setProof(null);
    setTransaction(null);
    setDecision(null);
  };

  // Auto-play logic
  useEffect(() => {
    if (!isAutoPlaying) return;
    if (currentStep === 'complete' || currentStep === 'verification-choice') {
      setIsAutoPlaying(false);
      return;
    }

    const timer = setTimeout(() => {
      advanceStep();
    }, 2000);

    return () => clearTimeout(timer);
  }, [isAutoPlaying, currentStep]);

  const getActorColor = (actor: string) => {
    switch (actor) {
      case 'agent':
        return 'bg-visa-blue';
      case 'visa':
        return 'bg-visa-gold';
      case 'merchant':
        return 'bg-verified';
      case 'facilitator':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getActorIcon = (actor: string) => {
    switch (actor) {
      case 'agent':
        return Bot;
      case 'visa':
        return Building2;
      case 'merchant':
        return Store;
      case 'facilitator':
        return Server;
      default:
        return Shield;
    }
  };

  return (
    <div className="min-h-screen bg-surface-secondary">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-visa-blue mb-2">
            TAP Integration Flow
          </h1>
          <p className="text-gray-600">
            Step through the complete Visa TAP message flow with zkML proof verification
          </p>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4 mb-8">
          {currentStep === 'idle' ? (
            <>
              <button onClick={advanceStep} className="btn-gold">
                <Play className="w-4 h-4 mr-2" />
                Start Flow
              </button>
              <button
                onClick={() => {
                  advanceStep();
                  setIsAutoPlaying(true);
                }}
                className="btn-secondary"
              >
                <Play className="w-4 h-4 mr-2" />
                Auto Play
              </button>
            </>
          ) : currentStep === 'complete' ? (
            <button onClick={reset} className="btn-primary">
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Demo
            </button>
          ) : currentStep === 'verification-choice' ? (
            <div className="flex gap-4">
              <button
                onClick={() => selectVerificationPath('facilitator')}
                className="btn-primary"
              >
                <Server className="w-4 h-4 mr-2" />
                Use Facilitator
              </button>
              <button
                onClick={() => selectVerificationPath('local')}
                className="btn-secondary"
              >
                <Code className="w-4 h-4 mr-2" />
                Verify Locally
              </button>
            </div>
          ) : (
            <button
              onClick={advanceStep}
              disabled={isAutoPlaying}
              className="btn-primary"
            >
              Next Step
              <ChevronRight className="w-4 h-4 ml-2" />
            </button>
          )}
        </div>

        {/* Flow Diagram */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left: Visual Flow */}
          <div className="lg:col-span-2">
            <div className="card p-6">
              <h2 className="font-semibold text-visa-blue mb-6">Message Flow</h2>

              {/* Actors Row */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                {[
                  { id: 'agent', name: 'AI Agent', icon: Bot },
                  { id: 'visa', name: 'Visa Registry', icon: Building2 },
                  { id: 'merchant', name: 'Merchant', icon: Store },
                  { id: 'facilitator', name: 'Facilitator', icon: Server },
                ].map((actor) => (
                  <div key={actor.id} className="text-center">
                    <div
                      className={cn(
                        'w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center transition-all',
                        getActorColor(actor.id),
                        steps.find((s) => s.id === currentStep)?.actor === actor.id
                          ? 'ring-4 ring-visa-gold scale-110'
                          : 'opacity-50'
                      )}
                    >
                      <actor.icon className="w-8 h-8 text-white" />
                    </div>
                    <span className="text-sm font-medium">{actor.name}</span>
                  </div>
                ))}
              </div>

              {/* Flow Steps */}
              <div className="space-y-4">
                {steps.map((step, index) => {
                  const stepIndex = stepOrder.indexOf(step.id);
                  const isActive = currentStep === step.id;
                  const isComplete = stepIndex < currentStepIndex;
                  const isFuture = stepIndex > currentStepIndex;

                  // Skip verification path not taken
                  if (
                    (step.id === 'facilitator-verify' && verificationPath === 'local') ||
                    (step.id === 'local-verify' && verificationPath === 'facilitator')
                  ) {
                    return null;
                  }

                  const ActorIcon = getActorIcon(step.actor);

                  return (
                    <motion.div
                      key={step.id}
                      initial={false}
                      animate={{
                        opacity: isFuture ? 0.3 : 1,
                        scale: isActive ? 1.02 : 1,
                      }}
                      className={cn(
                        'flex items-start gap-4 p-4 rounded-lg border-2 transition-all',
                        isActive && 'border-visa-gold bg-visa-gold/5 shadow-glow-gold',
                        isComplete && 'border-verified bg-verified-light',
                        isFuture && 'border-border bg-surface'
                      )}
                    >
                      {/* Step Number */}
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
                          isActive && 'bg-visa-gold text-visa-blue-dark',
                          isComplete && 'bg-verified text-white',
                          isFuture && 'bg-gray-200 text-gray-500'
                        )}
                      >
                        {isComplete ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          index + 1
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className={cn(
                              'w-6 h-6 rounded-full flex items-center justify-center',
                              getActorColor(step.actor)
                            )}
                          >
                            <ActorIcon className="w-3 h-3 text-white" />
                          </div>
                          <h3 className="font-semibold">{step.title}</h3>
                        </div>
                        <p className="text-sm text-gray-600">{step.description}</p>

                        {/* Active Step Detail */}
                        <AnimatePresence>
                          {isActive && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="mt-3 pt-3 border-t border-border"
                            >
                              {step.id === 'proof-generation' && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Lock className="w-4 h-4 text-visa-blue animate-pulse" />
                                  <span>Generating JOLT-Atlas proof...</span>
                                  <span className="text-visa-gold font-mono">~0.7s</span>
                                </div>
                              )}
                              {step.id === 'tap-message' && proof && (
                                <pre className="code-block text-[10px] mt-2">
{`POST /v1/authorize HTTP/1.1
Host: merchant-gateway.com
X-TAP-Agent-ID: ${agent.id}
X-TAP-Signature: ${truncateHash(proof.modelCommitment)}
X-ZKML-PROOF: ${truncateHash(proof.executionProof, 20)}
X-ZKML-MODEL-COMMITMENT: ${truncateHash(proof.modelCommitment)}
X-ZKML-TIMESTAMP: ${proof.timestamp}`}
                                </pre>
                              )}
                              {step.id === 'verified' && (
                                <div className="flex items-center gap-2 text-verified">
                                  <Unlock className="w-4 h-4" />
                                  <span className="font-medium">Proof cryptographically verified</span>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Arrow */}
                      {index < steps.length - 1 && !isFuture && (
                        <ArrowDown className="w-4 h-4 text-gray-300 flex-shrink-0 mt-2" />
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Detail Panel */}
          <div className="space-y-6">
            {/* Current Step Detail */}
            <div className="card p-6">
              <h2 className="font-semibold text-visa-blue mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Current State
              </h2>

              {currentStep === 'idle' ? (
                <p className="text-gray-500 text-sm">
                  Start the flow to see step-by-step TAP integration details
                </p>
              ) : (
                <div className="space-y-4">
                  {transaction && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-600 mb-2">Transaction</h4>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Amount:</span>
                          <span className="font-mono">${(transaction.amount / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Merchant:</span>
                          <span>{transaction.merchantName}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {decision && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-600 mb-2">AI Decision</h4>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Decision:</span>
                          <span className={cn(
                            'font-medium',
                            decision.decisionType === 'APPROVE' ? 'text-verified' : 'text-failed'
                          )}>
                            {decision.decisionType}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Confidence:</span>
                          <span>{(decision.confidence * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {proof && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-600 mb-2">zkML Proof</h4>
                      <div className="text-xs space-y-2">
                        <div className="flex items-center gap-2">
                          <Hash className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-500">Model:</span>
                          <code className="bg-surface-tertiary px-1 rounded">
                            {truncateHash(proof.modelCommitment, 6)}
                          </code>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-500">Generated:</span>
                          <span>{new Date(proof.timestamp * 1000).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="card p-6">
              <h2 className="font-semibold text-visa-blue mb-4">Participants</h2>
              <div className="space-y-3">
                {[
                  { color: 'bg-visa-blue', label: 'AI Agent', desc: 'Certified ML model' },
                  { color: 'bg-visa-gold', label: 'Visa Registry', desc: 'Model registration' },
                  { color: 'bg-verified', label: 'Merchant', desc: 'Payment processor' },
                  { color: 'bg-purple-500', label: 'Facilitator', desc: 'NovaNet verifier' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className={cn('w-4 h-4 rounded-full', item.color)} />
                    <div>
                      <span className="font-medium text-sm">{item.label}</span>
                      <span className="text-xs text-gray-500 ml-2">{item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Code Example */}
            {currentStep !== 'idle' && (
              <div className="card overflow-hidden">
                <div className="px-4 py-2 bg-visa-blue-dark text-white text-sm font-medium flex items-center gap-2">
                  <Code className="w-4 h-4" />
                  Integration Code
                </div>
                <pre className="code-block text-[10px] leading-relaxed">
                  {currentStep === 'certification' || currentStep === 'model-registered'
                    ? `// Generate model commitment
const commitment = CommitmentGenerator
  .fromOnnx('model.onnx');

// Register with Visa
await visa.registerModel({
  commitment: commitment.hex(),
  agentId: '${agent.id}',
  version: '1.0.0'
});`
                    : currentStep === 'proof-generation' || currentStep === 'tap-message'
                    ? `// Generate zkML proof
const prover = new JoltAtlas(modelBytes);
const proof = await prover.prove(
  transactionContext,
  { zeroKnowledge: true }
);

// Add to TAP headers
headers.set('X-ZKML-PROOF',
  proof.toBase64());
headers.set('X-ZKML-MODEL-COMMITMENT',
  proof.modelCommitment);`
                    : verificationPath === 'facilitator'
                    ? `// Verify via facilitator
const result = await fetch(
  'https://verify.novanet.xyz/v1/zkml/verify',
  {
    method: 'POST',
    body: JSON.stringify({
      proof: headers.get('X-ZKML-PROOF'),
      model_commitment: headers
        .get('X-ZKML-MODEL-COMMITMENT')
    })
  }
);

if (result.valid) {
  await processPayment();
}`
                    : `// Local verification
import { JoltAtlasVerifier } from
  '@icme/jolt-atlas';

const verifier = new JoltAtlasVerifier();
await verifier.loadRegistry(VISA_URL);

const result = verifier.verify(proof);
if (result.valid) {
  await processPayment();
}`}
                </pre>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
