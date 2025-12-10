/**
 * Mock data generators for demo
 */

import { generateMockCommitment } from './utils';

export type DecisionType = 'APPROVE' | 'DENY' | 'ESCALATE' | 'DEFER';

export interface MockProof {
  modelCommitment: string;
  inputCommitment: string;
  outputCommitment: string;
  executionProof: string;
  timestamp: number;
  version: number;
}

export interface TransactionContext {
  transactionId: string;
  amount: number; // in cents
  merchantId: string;
  merchantName: string;
  category: string;
  cardLast4: string;
  timestamp: number;
}

export interface AgentDecision {
  decisionType: DecisionType;
  confidence: number;
  reasonCode?: string;
  processingTime: number;
}

export interface TAPMessage {
  type: 'AUTHORIZATION_REQUEST' | 'AUTHORIZATION_RESPONSE';
  agentId: string;
  timestamp: number;
  signature: string;
  zkmlHeaders: {
    'X-ZKML-PROOF': string;
    'X-ZKML-MODEL-COMMITMENT': string;
    'X-ZKML-INPUT-COMMITMENT': string;
    'X-ZKML-OUTPUT-COMMITMENT': string;
    'X-ZKML-TIMESTAMP': string;
    'X-ZKML-THRESHOLD': string;
  };
}

const MERCHANTS = [
  { id: 'MRC001', name: 'TechMart Electronics', category: 'Electronics' },
  { id: 'MRC002', name: 'Global Airlines', category: 'Travel' },
  { id: 'MRC003', name: 'Luxury Brands Inc', category: 'Retail' },
  { id: 'MRC004', name: 'Cloud Services Pro', category: 'Software' },
  { id: 'MRC005', name: 'Premium Auto Parts', category: 'Automotive' },
];

const AGENTS = [
  { id: 'AGT-FRAUD-001', name: 'FraudGuard AI v3.2', model: 'fraud-detection-v3' },
  { id: 'AGT-SPEND-002', name: 'SpendSmart Advisor', model: 'spending-advisor-v2' },
  { id: 'AGT-RISK-003', name: 'RiskAssess Pro', model: 'risk-assessment-v4' },
];

export function generateTransactionContext(): TransactionContext {
  const merchant = MERCHANTS[Math.floor(Math.random() * MERCHANTS.length)];
  // Generate amounts between $50 and $5000
  const amount = Math.floor(Math.random() * 495000) + 5000;

  return {
    transactionId: `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    amount,
    merchantId: merchant.id,
    merchantName: merchant.name,
    category: merchant.category,
    cardLast4: Math.floor(Math.random() * 10000).toString().padStart(4, '0'),
    timestamp: Date.now(),
  };
}

export function generateAgentDecision(): AgentDecision {
  const decisions: DecisionType[] = ['APPROVE', 'APPROVE', 'APPROVE', 'DENY', 'ESCALATE'];
  const decisionType = decisions[Math.floor(Math.random() * decisions.length)];

  return {
    decisionType,
    confidence: 0.7 + Math.random() * 0.29, // 70-99%
    reasonCode: decisionType === 'DENY' ? 'HIGH_RISK_PATTERN' : undefined,
    processingTime: 50 + Math.floor(Math.random() * 100), // 50-150ms
  };
}

export function generateMockProof(): MockProof {
  return {
    modelCommitment: generateMockCommitment(),
    inputCommitment: generateMockCommitment(),
    outputCommitment: generateMockCommitment(),
    executionProof: btoa(JSON.stringify({
      header: 'JOLT-ATLAS-ZK-V1',
      data: generateMockCommitment() + generateMockCommitment(),
    })),
    timestamp: Math.floor(Date.now() / 1000),
    version: 1,
  };
}

export function generateTAPMessage(
  proof: MockProof,
  threshold: number = 100000
): TAPMessage {
  const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)];

  return {
    type: 'AUTHORIZATION_REQUEST',
    agentId: agent.id,
    timestamp: Date.now(),
    signature: generateMockCommitment().slice(0, 40),
    zkmlHeaders: {
      'X-ZKML-PROOF': proof.executionProof,
      'X-ZKML-MODEL-COMMITMENT': proof.modelCommitment,
      'X-ZKML-INPUT-COMMITMENT': proof.inputCommitment,
      'X-ZKML-OUTPUT-COMMITMENT': proof.outputCommitment,
      'X-ZKML-TIMESTAMP': proof.timestamp.toString(),
      'X-ZKML-THRESHOLD': threshold.toString(),
    },
  };
}

export function getRandomAgent() {
  return AGENTS[Math.floor(Math.random() * AGENTS.length)];
}
