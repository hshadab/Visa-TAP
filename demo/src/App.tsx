import { useState, useCallback, useEffect, useRef } from 'react'
import './App.css'

// Real spending model and prover
import {
  runSpendingModel,
  createVisaTapDemoInput,
  spendingInputToNumeric,
  B2B_SPENDING_POLICY,
  type SpendingModelInput,
  type SpendingModelOutput
} from './lib/spendingModel'
import {
  generateProof,
  checkProverHealth,
  verifyProof,
  formatProofSize,
  formatGenerationTime
} from './lib/prover'
import type { ProveResponse } from './lib/types'
import { PROVER_CONFIG } from './lib/config'
import {
  transferUsdc,
  attestProof,
  getBalance,
  getExplorerUrl,
  demoAccount,
  CONTRACTS,
  TAP_AGENT_ID,
} from './lib/wallet'

// Types
interface Transaction {
  id: string
  amount: number
  merchant: string
  currency: 'USDC'
  settlementType: 'B2B'
  timestamp: number
  status: 'pending' | 'processing' | 'approved' | 'denied' | 'settled'
}

interface ProofState {
  stage: 'idle' | 'loading_model' | 'generating_commitment' | 'running_inference' | 'generating_proof' | 'anchoring_arc' | 'complete'
  progress: number
  commitment?: string
  inputHash?: string
  outputHash?: string
  decision?: 'Approve' | 'Deny' | 'Escalate'
  confidence?: number
  proofSize?: number
  generationTime?: number
  arcTxHash?: string
  // Real proof data from JOLT-Atlas
  realProof?: ProveResponse
  // Real spending model evaluation
  modelOutput?: SpendingModelOutput
  modelInput?: SpendingModelInput
  // Whether we used real prover or simulation
  isRealProof?: boolean
  // Real on-chain transaction data
  attestationTxHash?: string
  transferTxHash?: string
  isRealTransaction?: boolean
}

interface VerificationState {
  stage: 'idle' | 'receiving' | 'checking_registry' | 'verifying_proof' | 'checking_arc' | 'complete'
  status?: 'valid' | 'invalid'
  modelRegistered?: boolean
  proofFresh?: boolean
  cryptoValid?: boolean
  arcAnchored?: boolean
}

interface AttackState {
  stage: 'idle' | 'compromised' | 'model_swapped' | 'tap_check' | 'zkml_check' | 'complete'
  tapResult?: 'pass' | 'fail'
  zkmlResult?: 'pass' | 'fail'
}

interface ActivityLogEntry {
  id: string
  timestamp: Date
  type: 'agent' | 'proof' | 'verify' | 'arc' | 'success' | 'warning'
  message: string
  details?: string
}

interface Annotation {
  id: string
  target: string // CSS selector or element ID
  title: string
  text: string
  color: 'visa' | 'zkml' | 'combined' // blue, purple, green
  position: 'top' | 'bottom' | 'left' | 'right'
}

// Post-demo annotations - telling the "Policy Enforcement" story
const ANNOTATIONS: Annotation[] = [
  {
    id: 'tap-connection',
    target: '.tap-connection',
    title: 'Point-in-Time Trust',
    text: 'TAP verifies WHO the agent is via RFC 9421 signatures. But this is point-in-time certification — Visa vetted this agent once.',
    color: 'visa',
    position: 'right',
  },
  {
    id: 'policy-model',
    target: '.policy-model-info',
    title: 'The Policy Guard',
    text: 'A separate ONNX model checks spending rules. This deterministic model CAN be proven — unlike the LLM that decides what to buy.',
    color: 'zkml',
    position: 'right',
  },
  {
    id: 'proof-result',
    target: '.proof-result',
    title: 'Proof of Policy Compliance',
    text: 'Every transaction proves the policy model ran correctly. Not proving the LLM was "smart" — proving the spending rules were followed.',
    color: 'zkml',
    position: 'right',
  },
  {
    id: 'verification-complete',
    target: '.verification-result.valid',
    title: 'Complete Trust Stack',
    text: 'TAP proves WHO. zkML proves the policy model approved this spend. The LLM decides WHAT to buy, the policy model ensures it\'s ALLOWED.',
    color: 'combined',
    position: 'left',
  },
]

// Agent Intelligence (LLM - not provable)
const AGENT_INFO = {
  name: 'Claude/GPT-4 Agent',
  role: 'Decides WHAT to purchase',
  type: 'LLM (Non-deterministic)',
  provable: false,
}

// Policy Model (ONNX - provable with zkML)
const POLICY_MODEL = {
  name: 'spending-policy-b2b.onnx',
  commitment: 'a7f3c2e8d1b4f5a6c9e2d3b4a5f6c7e8d9b1a2c3e4f5a6b7c8d9e0f1a2b3c4d5',
  role: 'Checks IF purchase is allowed',
  type: 'ONNX (Deterministic)',
  provable: true,
  inputShape: '[1, 8]',
  registeredAt: '2025-12-15T10:30:00Z',
}

// B2B Spending Policy Rules
const SPENDING_POLICY = {
  maxSinglePurchaseUsdc: 100_000,
  dailyLimitUsdc: 500_000,
  maxVendorRiskScore: 0.70,
  minVendorHistoryScore: 0.80,
  requireCompliance: true,
  minBudgetBuffer: 5_000,
}

// Demo model info (legacy, keeping for compatibility)
const MODEL_INFO = {
  name: 'spending-policy-b2b.onnx',
  commitment: 'a7f3c2e8d1b4f5a6c9e2d3b4a5f6c7e8d9b1a2c3e4f5a6b7c8d9e0f1a2b3c4d5',
  weightsHash: 'e8d1b4f5a6c9e2d3b4a5f6c7e8d9b1a2c3e4f5a6b7c8d9e0f1a2b3c4d5a7f3c2',
  archHash: 'b4a5f6c7e8d9b1a2c3e4f5a6b7c8d9e0f1a2b3c4d5a7f3c2e8d1b4f5a6c9e2d3',
  registeredAt: '2025-12-15T10:30:00Z',
  agentId: 'agent_visa_b2b_settlement_001',
}

// Visa Intelligent Commerce + USDC Settlement stats
const VISA_STATS = {
  credentials: '4.8B+',
  merchants: '150M+',
  usdcVolume: '$3.5B+',
  arcPartner: 'Circle Arc',
}

function App() {
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [proof, setProof] = useState<ProofState>({ stage: 'idle', progress: 0 })
  const [verification, setVerification] = useState<VerificationState>({ stage: 'idle' })
  const [attack, setAttack] = useState<AttackState>({ stage: 'idle' })
  const [showComparison, setShowComparison] = useState(false)
  const [showAttackDemo, setShowAttackDemo] = useState(true)
  const [demoMode, setDemoMode] = useState<'tap_plus_zkml' | 'tap_only'>('tap_plus_zkml')
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])
  const [showProofInspector, setShowProofInspector] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [showAnnotations, setShowAnnotations] = useState(false)
  const [currentAnnotation, setCurrentAnnotation] = useState(0)
  const activityLogRef = useRef<HTMLDivElement>(null)

  // Real prover state
  const [useRealProver, setUseRealProver] = useState(false)
  const [proverStatus, setProverStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [proverError, setProverError] = useState<string | null>(null)

  // Real on-chain transactions state
  const [useRealTransactions, setUseRealTransactions] = useState(false)
  const [walletBalance, setWalletBalance] = useState<string | null>(null)

  // Check prover health and wallet balance on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        setProverStatus('checking')
        await checkProverHealth()
        setProverStatus('online')
        setProverError(null)
      } catch (err) {
        setProverStatus('offline')
        setProverError(err instanceof Error ? err.message : 'Prover unavailable')
      }
    }
    const checkBalance = async () => {
      try {
        const balance = await getBalance()
        setWalletBalance(balance)
      } catch (err) {
        console.error('Failed to get wallet balance:', err)
        setWalletBalance(null)
      }
    }
    checkHealth()
    checkBalance()
  }, [])

  // Add activity log entry
  const addLogEntry = useCallback((type: ActivityLogEntry['type'], message: string, details?: string) => {
    const entry: ActivityLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type,
      message,
      details,
    }
    setActivityLog(prev => [...prev, entry])
  }, [])

  // Auto-scroll activity log
  useEffect(() => {
    if (activityLogRef.current) {
      activityLogRef.current.scrollTop = activityLogRef.current.scrollHeight
    }
  }, [activityLog])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.code === 'Space' && !isRunning) {
        e.preventDefault()
        runDemo()
      } else if (e.code === 'KeyR') {
        e.preventDefault()
        resetDemo()
      } else if (e.code === 'KeyI' && proof.stage === 'complete') {
        e.preventDefault()
        setShowProofInspector(true)
      } else if (e.code === 'Escape') {
        setShowProofInspector(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isRunning, proof.stage])

  // Reset demo
  const resetDemo = useCallback(() => {
    setTransaction(null)
    setProof({ stage: 'idle', progress: 0 })
    setVerification({ stage: 'idle' })
    setAttack({ stage: 'idle' })
    setActivityLog([])
    setIsRunning(false)
    setShowAnnotations(false)
    setCurrentAnnotation(0)
  }, [])

  // Run proof generation - uses REAL spending model, optionally REAL prover
  const simulateProofGeneration = useCallback(async () => {
    // Step 1: Load model (simulated delay for UX)
    setProof(prev => ({ ...prev, stage: 'loading_model', progress: 10 }))
    addLogEntry('proof', 'Loading spending policy model (ONNX)...', POLICY_MODEL.name)
    await new Promise(r => setTimeout(r, 200))

    // Step 2: Generate commitment
    setProof(prev => ({ ...prev, stage: 'generating_commitment', progress: 25 }))
    addLogEntry('proof', 'Verifying policy model commitment...', POLICY_MODEL.commitment.slice(0, 16) + '...')
    await new Promise(r => setTimeout(r, 150))

    // Step 3: Run REAL spending model evaluation
    setProof(prev => ({ ...prev, stage: 'running_inference', progress: 40 }))
    addLogEntry('proof', 'Evaluating spending policy constraints...', 'REAL model evaluation')

    const demoInput = createVisaTapDemoInput()
    const modelOutput = runSpendingModel(demoInput, B2B_SPENDING_POLICY)

    addLogEntry(
      modelOutput.shouldBuy ? 'success' : 'warning',
      `Policy evaluation: ${modelOutput.shouldBuy ? 'APPROVED' : 'REJECTED'}`,
      `Confidence: ${(modelOutput.confidence * 100).toFixed(1)}%, Risk: ${(modelOutput.riskScore * 100).toFixed(1)}%`
    )
    await new Promise(r => setTimeout(r, 200))

    // Step 4: Generate proof (real or simulated)
    setProof(prev => ({ ...prev, stage: 'generating_proof', progress: 60 }))

    let realProofResult: ProveResponse | undefined
    let isRealProof = false

    if (useRealProver && proverStatus === 'online') {
      addLogEntry('proof', 'Generating REAL SNARK proof...', `Calling ${PROVER_CONFIG.url}`)

      const numericInputs = spendingInputToNumeric(demoInput)
      const startTime = Date.now()
      realProofResult = await generateProof(numericInputs, 'visa-tap-demo')
      const elapsed = Date.now() - startTime

      if (realProofResult.success && realProofResult.proof) {
        isRealProof = true
        addLogEntry('success', 'REAL SNARK proof generated!', `${formatProofSize(realProofResult.proof.metadata.proofSize)} in ${formatGenerationTime(elapsed)}`)
      } else {
        addLogEntry('warning', 'Real prover failed, using simulation', realProofResult.error || 'Unknown error')
      }
    } else {
      addLogEntry('proof', 'Generating SNARK proof (simulated)...', 'Enable real prover for actual proof')
      await new Promise(r => setTimeout(r, 500))
    }

    // Step 5: Anchor on Arc (simulated)
    setProof(prev => ({ ...prev, stage: 'anchoring_arc', progress: 85 }))
    addLogEntry('proof', 'Anchoring proof on Circle Arc...', 'Creating immutable record')
    await new Promise(r => setTimeout(r, 200))

    // Complete
    const proofData = realProofResult?.proof
    setProof({
      stage: 'complete',
      progress: 100,
      commitment: proofData?.metadata.modelHash || POLICY_MODEL.commitment,
      inputHash: proofData?.metadata.inputHash || 'c3e4f5a6b7c8d9e0f1a2b3c4d5a7f3c2e8d1b4f5a6c9e2d3b4a5f6c7e8d9b1a2',
      outputHash: proofData?.metadata.outputHash || 'd5a7f3c2e8d1b4f5a6c9e2d3b4a5f6c7e8d9b1a2c3e4f5a6b7c8d9e0f1a2b3c4',
      decision: modelOutput.shouldBuy ? 'Approve' : 'Deny',
      confidence: modelOutput.confidence,
      proofSize: proofData?.metadata.proofSize || 48000,
      generationTime: proofData?.metadata.generationTime || 4.2,
      arcTxHash: '0xarc_' + (proofData?.proofHash?.slice(0, 32) || '7f3c2e8d1b4f5a6c9e2d3b4a5f6c7e8'),
      realProof: realProofResult,
      modelOutput,
      modelInput: demoInput,
      isRealProof,
    })

    addLogEntry(
      'success',
      `Policy compliance proof complete!`,
      isRealProof ? 'REAL SNARK proof from JOLT-Atlas' : 'Simulated proof (enable real prover for actual proof)'
    )
  }, [addLogEntry, useRealProver, proverStatus])

  // Verification with optional real on-chain transactions
  const simulateVerification = useCallback(async () => {
    let attestationTxHash: string | undefined
    let transferTxHash: string | undefined
    let isRealTransaction = false

    // Stage 1: Receiving
    setVerification(prev => ({ ...prev, stage: 'receiving' }))
    addLogEntry('verify', 'Receiving proof and TAP signature...', 'HTTP Message Signature verified')
    await new Promise(r => setTimeout(r, 150))

    // Stage 2: Check registry
    setVerification(prev => ({ ...prev, stage: 'checking_registry', modelRegistered: true }))
    addLogEntry('verify', 'Checking Visa Model Registry...', 'Model commitment lookup')
    await new Promise(r => setTimeout(r, 150))

    // Stage 3: Verify proof (and optionally attest on-chain)
    setVerification(prev => ({ ...prev, stage: 'verifying_proof' }))

    if (useRealTransactions && walletBalance && parseFloat(walletBalance) >= 0.02) {
      addLogEntry('verify', 'Attesting proof + agent identity on Arc...', 'WHO + WHAT + HOW anchored on-chain')
      try {
        const result = await attestProof(
          proof.inputHash || '0x0',
          proof.commitment || '0x0',
          proof.outputHash || '0x0',
          TAP_AGENT_ID  // Anchor agent identity on-chain
        )
        attestationTxHash = result.hash
        isRealTransaction = true
        addLogEntry('success', 'Agent + Proof attested on-chain!', result.explorerUrl)
      } catch (err) {
        addLogEntry('warning', 'Attestation failed, continuing with simulation', err instanceof Error ? err.message : 'Unknown error')
      }
    } else {
      addLogEntry('verify', 'Verifying cryptographic proof...', 'JOLT-Atlas verification')
      await new Promise(r => setTimeout(r, 200))
    }

    setVerification(prev => ({ ...prev, cryptoValid: true }))

    // Stage 4: Arc anchor (and optionally transfer USDC)
    setVerification(prev => ({ ...prev, stage: 'checking_arc' }))

    if (useRealTransactions && walletBalance && parseFloat(walletBalance) >= 0.01) {
      addLogEntry('arc', 'Transferring $0.01 USDC on Arc Testnet...', 'REAL settlement')
      try {
        const result = await transferUsdc(CONTRACTS.demoMerchant, 0.01)
        transferTxHash = result.hash
        isRealTransaction = true
        addLogEntry('success', 'USDC transferred on-chain!', result.explorerUrl)
        // Refresh balance
        const newBalance = await getBalance()
        setWalletBalance(newBalance)
      } catch (err) {
        addLogEntry('warning', 'Transfer failed', err instanceof Error ? err.message : 'Unknown error')
      }
    } else {
      addLogEntry('verify', 'Confirming Arc anchor...', 'Blockchain verification')
      await new Promise(r => setTimeout(r, 150))
    }

    // Stage 5: Complete
    setVerification({
      stage: 'complete',
      status: 'valid',
      modelRegistered: true,
      proofFresh: true,
      cryptoValid: true,
      arcAnchored: true,
    })

    // Update proof with transaction hashes
    if (isRealTransaction) {
      setProof(prev => ({
        ...prev,
        attestationTxHash,
        transferTxHash,
        isRealTransaction,
        arcTxHash: transferTxHash || attestationTxHash || prev.arcTxHash,
      }))
    }

    addLogEntry(
      'success',
      'Full verification complete!',
      isRealTransaction ? 'REAL on-chain transactions on Arc Testnet' : 'Identity + Execution verified'
    )
  }, [addLogEntry, useRealTransactions, walletBalance, proof.inputHash, proof.commitment, proof.outputHash])

  // Simulate model substitution attack
  const simulateAttack = useCallback(async () => {
    setAttack({ stage: 'compromised' })
    await new Promise(r => setTimeout(r, 800))

    setAttack({ stage: 'model_swapped' })
    await new Promise(r => setTimeout(r, 800))

    setAttack({ stage: 'tap_check', tapResult: 'pass' })
    await new Promise(r => setTimeout(r, 1000))

    setAttack({ stage: 'zkml_check', tapResult: 'pass', zkmlResult: 'fail' })
    await new Promise(r => setTimeout(r, 1000))

    setAttack({ stage: 'complete', tapResult: 'pass', zkmlResult: 'fail' })
  }, [])

  // Run the demo flow
  const runDemo = useCallback(async () => {
    resetDemo()
    setIsRunning(true)

    // Create B2B USDC settlement transaction
    const txn: Transaction = {
      id: `usdc_settlement_${Date.now()}`,
      amount: 75000.00,
      merchant: 'GlobalTech Suppliers Inc.',
      currency: 'USDC',
      settlementType: 'B2B',
      timestamp: Date.now(),
      status: 'pending',
    }
    setTransaction(txn)
    addLogEntry('agent', 'B2B Settlement request initiated', '$75,000 USDC to GlobalTech Suppliers Inc.')

    await new Promise(r => setTimeout(r, 500))

    setTransaction(t => t ? { ...t, status: 'processing' } : null)
    addLogEntry('agent', 'Processing transaction with certified AI agent...', MODEL_INFO.agentId)

    if (demoMode === 'tap_plus_zkml') {
      // Run proof generation
      await simulateProofGeneration()
      await new Promise(r => setTimeout(r, 300))

      // Run verification
      await simulateVerification()
      await new Promise(r => setTimeout(r, 200))

      setTransaction(t => t ? { ...t, status: 'settled' } : null)
      addLogEntry('arc', 'Settlement complete on Circle Arc!', 'Transaction finalized with cryptographic proof')

      // Show annotations after demo completes
      await new Promise(r => setTimeout(r, 1500))
      setShowAnnotations(true)
    } else {
      await new Promise(r => setTimeout(r, 500))
      setTransaction(t => t ? { ...t, status: 'approved' } : null)
      addLogEntry('warning', 'Settlement approved without execution proof', 'Identity verified only - no model integrity guarantee')
    }
    setIsRunning(false)
  }, [demoMode, resetDemo, simulateProofGeneration, simulateVerification, addLogEntry])

  return (
    <div className="app">
      {/* Demo Controls Bar - Fixed at top */}
      <div className="demo-controls-bar">
        {/* Annotation Navigation - at the start */}
        {showAnnotations && (
          <>
            <button
              className="nav-btn prev-btn"
              onClick={() => setCurrentAnnotation(i => Math.max(i - 1, 0))}
              disabled={currentAnnotation === 0}
            >
              ←
            </button>
            <span className="annotation-indicator">
              {currentAnnotation + 1}/{ANNOTATIONS.length}
            </span>
            <button
              className="nav-btn next-btn"
              onClick={() => {
                if (currentAnnotation < ANNOTATIONS.length - 1) {
                  setCurrentAnnotation(i => i + 1)
                } else {
                  setShowAnnotations(false)
                }
              }}
            >
              {currentAnnotation < ANNOTATIONS.length - 1 ? '→' : '✓'}
            </button>
            <button
              className="refresh-btn"
              onClick={() => { resetDemo(); runDemo(); }}
              title="Restart Demo"
            >
              ↻
            </button>
            <div className="control-divider"></div>
          </>
        )}

        <button className="run-demo-btn" onClick={runDemo} disabled={isRunning}>
          {isRunning ? 'Running...' : 'Run B2B USDC Settlement Demo'}
        </button>
        <button className="reset-btn" onClick={resetDemo}>
          Reset
        </button>
        <div className="control-divider"></div>
        <button
          className={`mode-btn ${demoMode === 'tap_plus_zkml' ? 'active' : ''}`}
          onClick={() => { setDemoMode('tap_plus_zkml'); resetDemo(); }}
        >
          TAP + Proof of Correct Execution
        </button>
        <button
          className={`mode-btn warning ${demoMode === 'tap_only' ? 'active' : ''}`}
          onClick={() => { setDemoMode('tap_only'); resetDemo(); }}
        >
          TAP Identity Only
        </button>
        <div className={`demo-status ${isRunning ? 'running' : verification.stage === 'complete' ? 'complete' : ''}`}>
          <span className="status-dot"></span>
          <span>{isRunning ? 'Processing' : verification.stage === 'complete' ? 'Verified' : 'Ready'}</span>
        </div>

        {/* Real Prover Toggle */}
        <div className="control-divider"></div>
        <div className="prover-toggle">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={useRealProver}
              onChange={(e) => setUseRealProver(e.target.checked)}
              disabled={proverStatus !== 'online'}
            />
            <span className="toggle-text">Real Prover</span>
          </label>
          <span className={`prover-status ${proverStatus}`}>
            {proverStatus === 'checking' ? '...' : proverStatus === 'online' ? '●' : '○'}
          </span>
        </div>

        {/* Real On-Chain Toggle */}
        <div className="prover-toggle">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={useRealTransactions}
              onChange={(e) => setUseRealTransactions(e.target.checked)}
              disabled={!walletBalance || parseFloat(walletBalance) < 0.01}
            />
            <span className="toggle-text">Real Tx</span>
          </label>
          <span className={`prover-status ${walletBalance && parseFloat(walletBalance) >= 0.01 ? 'online' : 'offline'}`}>
            {walletBalance ? `$${parseFloat(walletBalance).toFixed(2)}` : '...'}
          </span>
        </div>
      </div>

      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo-section">
            <img
              src="https://cdn.prod.website-files.com/65d52b07d5bc41614daa723f/665df12739c532f45b665fe7_logo-novanet.svg"
              alt="Novanet Logo"
              className="header-logo"
            />
            <h1 className="main-title">Per-Transaction Model Verification for Visa Trusted Agent Protocol</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main">
        {/* Flow Visualization */}
        <div className="flow-container">
          {/* Agent Panel */}
          <div className={`panel agent-panel ${transaction?.status === 'processing' ? 'active' : transaction?.status === 'settled' || transaction?.status === 'approved' ? 'complete' : ''}`}>
            <div className="panel-header">
              <div className="panel-icon agent-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                  <path d="M19 13a7 7 0 1 0-14 0v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5z"/>
                  <circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/>
                </svg>
              </div>
              <h2>B2B Settlement Agent</h2>
            </div>
            <div className="panel-content">
              <div className="tap-connection">
                <p>Registered with <strong>Visa Intelligent Commerce</strong> via TAP. Agent identity verified by RFC 9421 HTTP Message Signatures. Settlement on <strong>Circle Arc</strong> using USDC.</p>
              </div>

              {/* Agent Intelligence vs Policy Model Split */}
              <div className="agent-policy-split">
                <div className="agent-intelligence">
                  <h4>LLM Agent</h4>
                  <p className="split-role">Decides what to buy</p>
                </div>
                <div className="split-arrow">→</div>
                <div className="policy-model-info">
                  <h4>Policy Model</h4>
                  <p className="split-role">Checks if allowed</p>
                  <span className="split-model-name">{POLICY_MODEL.name}</span>
                </div>
              </div>

              {transaction && (
                <div className="transaction-card usdc">
                  <div className="transaction-badge">USDC SETTLEMENT</div>
                  <h3>B2B Payment Request</h3>
                  <div className="transaction-amount">${transaction.amount.toLocaleString()}</div>
                  <div className="transaction-currency">USDC on Circle Arc</div>
                  <div className="transaction-merchant">{transaction.merchant}</div>
                  <div className={`transaction-status status-${transaction.status}`}>
                    {transaction.status === 'settled' ? 'SETTLED ON ARC' : transaction.status.toUpperCase()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Arrow */}
          <div className="flow-arrow">
            <div className={`arrow-line ${proof.stage !== 'idle' ? 'active' : ''}`}></div>
            <div className="arrow-head"></div>
          </div>

          {/* Proof Generation Panel */}
          <div className={`panel proof-panel ${demoMode === 'tap_only' ? 'disabled' : proof.stage !== 'idle' && proof.stage !== 'complete' ? 'active' : proof.stage === 'complete' ? 'complete' : ''}`}>
            <div className="panel-header">
              <div className="panel-icon proof-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <path d="M9 12l2 2 4-4"/>
                </svg>
              </div>
              <h2>Spending Policy Verification</h2>
              {demoMode === 'tap_only' && <span className="disabled-badge">NOT AVAILABLE</span>}
            </div>
            <div className="panel-content">
              {demoMode === 'tap_plus_zkml' ? (
                <>
                  <div className="proof-stages">
                    <ProofStage
                      label="Load Policy Model (ONNX)"
                      active={proof.stage === 'loading_model'}
                      complete={['generating_commitment', 'running_inference', 'generating_proof', 'anchoring_arc', 'complete'].includes(proof.stage)}
                    />
                    <ProofStage
                      label="Verify Model Commitment"
                      active={proof.stage === 'generating_commitment'}
                      complete={['running_inference', 'generating_proof', 'anchoring_arc', 'complete'].includes(proof.stage)}
                    />
                    <ProofStage
                      label="Evaluate Policy Constraints"
                      active={proof.stage === 'running_inference'}
                      complete={['generating_proof', 'anchoring_arc', 'complete'].includes(proof.stage)}
                    />
                    <ProofStage
                      label="Prove Policy Was Followed"
                      active={proof.stage === 'generating_proof'}
                      complete={['anchoring_arc', 'complete'].includes(proof.stage)}
                    />
                    <ProofStage
                      label="Anchor on Circle Arc"
                      active={proof.stage === 'anchoring_arc'}
                      complete={proof.stage === 'complete'}
                    />
                  </div>

                  {/* Policy Constraints Visualization - shows REAL model evaluation results */}
                  {['running_inference', 'generating_proof', 'anchoring_arc', 'complete'].includes(proof.stage) && (
                    <div className="policy-constraints">
                      <h4>Policy Checks {proof.modelOutput && <span className="real-badge">REAL</span>}</h4>
                      <div className="constraint-list">
                        {proof.modelOutput ? (
                          // Show real reasons from model evaluation
                          proof.modelOutput.reasons.slice(0, 6).map((reason, i) => (
                            <div key={i} className={`constraint ${proof.modelOutput?.shouldBuy ? 'pass' : 'fail'}`}>
                              <span className="constraint-icon">{proof.modelOutput?.shouldBuy ? '✓' : '✗'}</span>
                              <span>{reason.length > 25 ? reason.slice(0, 25) + '...' : reason}</span>
                            </div>
                          ))
                        ) : (
                          // Fallback to hardcoded (before model runs)
                          <>
                            <div className="constraint pass">
                              <span className="constraint-icon">✓</span>
                              <span>$75K ≤ $100K max</span>
                            </div>
                            <div className="constraint pass">
                              <span className="constraint-icon">✓</span>
                              <span>daily $125K ≤ $500K</span>
                            </div>
                            <div className="constraint pass">
                              <span className="constraint-icon">✓</span>
                              <span>vendorRisk 0.15 ≤ 0.70</span>
                            </div>
                            <div className="constraint pass">
                              <span className="constraint-icon">✓</span>
                              <span>compliance = true</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {proof.stage !== 'idle' && (
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${proof.progress}%` }}></div>
                    </div>
                  )}

                  {proof.stage === 'complete' && (
                    <div className="proof-result">
                      <div className="result-header">
                        <span className="check-icon">✓</span>
                        Proof Generated in <strong>{typeof proof.generationTime === 'number' ? proof.generationTime.toFixed(1) : proof.generationTime}s</strong>
                        {proof.isRealProof && <span className="real-proof-badge">REAL SNARK</span>}
                        {proof.isRealTransaction && <span className="real-proof-badge">REAL TX</span>}
                      </div>
                      <div className="proof-details">
                        <div className="detail-row">
                          <span>Decision:</span>
                          <span className={proof.decision === 'Approve' ? 'decision-approve' : 'decision-deny'}>{proof.decision}</span>
                        </div>
                        <div className="detail-row">
                          <span>Confidence:</span>
                          <span>{((proof.confidence || 0) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="detail-row">
                          <span>Proof Size:</span>
                          <span>~{Math.round((proof.proofSize || 0) / 1000)}KB SNARK</span>
                        </div>
                        {proof.isRealTransaction && (
                          <div className="detail-row agent-row">
                            <span>Agent ID:</span>
                            <span className="agent-id-value">{TAP_AGENT_ID.slice(0, 20)}...</span>
                          </div>
                        )}
                        {proof.isRealTransaction && proof.attestationTxHash && (
                          <div className="detail-row arc-row">
                            <span>Attestation:</span>
                            <a
                              href={`https://testnet.arcscan.app/tx/${proof.attestationTxHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="tx-link"
                            >
                              {proof.attestationTxHash.slice(0, 14)}... ↗
                            </a>
                          </div>
                        )}
                        <div className="detail-row arc-row">
                          <span>{proof.isRealTransaction ? 'Transfer:' : 'Arc Tx:'}</span>
                          {proof.isRealTransaction && proof.transferTxHash ? (
                            <a
                              href={`https://testnet.arcscan.app/tx/${proof.transferTxHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="tx-link"
                            >
                              {proof.transferTxHash.slice(0, 14)}... ↗
                            </a>
                          ) : (
                            <span className="mono">{proof.arcTxHash?.slice(0, 20)}...</span>
                          )}
                        </div>
                      </div>
                      <button className="inspect-proof-btn" onClick={() => setShowProofInspector(true)}>
                        {proof.isRealProof ? 'Inspect Real Proof' : 'Inspect Proof Details'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="no-zkml-warning">
                  <div className="warning-icon">!</div>
                  <p><strong>Critical Gap in TAP Identity-Only Mode:</strong></p>
                  <ul>
                    <li>No proof of correct model execution</li>
                    <li>Cannot verify inference was computed correctly</li>
                    <li>Model substitution attacks undetectable</li>
                    <li>No verifiable audit trail for $75K settlement</li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Arrow */}
          <div className="flow-arrow">
            <div className={`arrow-line ${verification.stage !== 'idle' || (demoMode === 'tap_only' && transaction?.status === 'approved') ? 'active' : ''}`}></div>
            <div className="arrow-head"></div>
          </div>

          {/* Verification Panel */}
          <div className={`panel verification-panel ${verification.stage !== 'idle' && verification.stage !== 'complete' ? 'active' : verification.stage === 'complete' ? 'complete' : ''}`}>
            <div className="panel-header">
              <div className="panel-icon verification-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <h2>Visa / Merchant Verification</h2>
            </div>
            <div className="panel-content">
              {demoMode === 'tap_plus_zkml' ? (
                <>
                  <div className="verification-stages">
                    <VerificationStage
                      label="Receive Proof + TAP Signature"
                      active={verification.stage === 'receiving'}
                      complete={['checking_registry', 'verifying_proof', 'checking_arc', 'complete'].includes(verification.stage)}
                    />
                    <VerificationStage
                      label="Check Visa Model Registry"
                      active={verification.stage === 'checking_registry'}
                      complete={['verifying_proof', 'checking_arc', 'complete'].includes(verification.stage)}
                      result={verification.modelRegistered}
                    />
                    <VerificationStage
                      label="Verify Cryptographic Proof"
                      active={verification.stage === 'verifying_proof'}
                      complete={['checking_arc', 'complete'].includes(verification.stage)}
                      result={verification.cryptoValid}
                    />
                    <VerificationStage
                      label="Confirm Arc Anchor"
                      active={verification.stage === 'checking_arc'}
                      complete={verification.stage === 'complete'}
                      result={verification.arcAnchored}
                    />
                  </div>

                  {verification.stage === 'complete' && (
                    <div className="verification-result valid">
                      <div className="result-icon">✓</div>
                      <div className="result-text">
                        <strong>Full Verification Complete</strong>
                        {proof.isRealTransaction ? (
                          <>
                            <p className="anchored-item"><span className="anchor-check">✓</span> WHO: Agent identity anchored</p>
                            <p className="anchored-item"><span className="anchor-check">✓</span> WHAT: Transaction inputs anchored</p>
                            <p className="anchored-item"><span className="anchor-check">✓</span> HOW: Policy proof anchored</p>
                            <p className="arc-confirmed">All on Circle Arc Testnet</p>
                          </>
                        ) : (
                          <>
                            <p>Identity + Correct inference verified</p>
                            <p className="arc-confirmed">Anchored on Circle Arc</p>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="no-verification">
                  {transaction?.status === 'approved' ? (
                    <div className="verification-result warning">
                      <div className="result-icon">!</div>
                      <div className="result-text">
                        <strong>Partial Verification Only</strong>
                        <p>TAP verified agent identity ✓</p>
                        <p className="risk">Model execution: UNKNOWN</p>
                        <p className="risk">Decision logic: UNVERIFIED</p>
                        <p className="risk">$75,000 at risk</p>
                      </div>
                    </div>
                  ) : (
                    <p className="waiting">Waiting for settlement request...</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <div className="activity-log-container">
          <div className="activity-log">
            <div className="activity-log-header">
              <h3>
                {activityLog.length > 0 && <span className="live-indicator"></span>}
                Real-time Activity Log
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{activityLog.length} events</span>
            </div>
            <div className="activity-log-body" ref={activityLogRef}>
              {activityLog.length === 0 ? (
                <div className="activity-log-empty">
                  Press <kbd>Space</kbd> or click "Run Demo" to start
                </div>
              ) : (
                activityLog.map(entry => (
                  <div key={entry.id} className="activity-item">
                    <span className="timestamp">
                      {entry.timestamp.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className={`icon ${entry.type}`}>
                      {entry.type === 'agent' && '◉'}
                      {entry.type === 'proof' && '◈'}
                      {entry.type === 'verify' && '✓'}
                      {entry.type === 'arc' && '⬡'}
                      {entry.type === 'success' && '★'}
                      {entry.type === 'warning' && '!'}
                    </span>
                    <span className="message">
                      {entry.message}
                      {entry.details && <span className="hash"> — {entry.details}</span>}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Three-Layer Trust Stack */}
        <div className="trust-stack-section">
          <h2>The Three-Layer Trust Stack</h2>
          <p className="trust-stack-subtitle">TAP handles identity. zkML proves spending policy compliance on every transaction.</p>
          <div className="trust-stack">
            <div className="trust-layer layer-3">
              <div className="layer-number">3</div>
              <div className="layer-content">
                <div className="layer-header">
                  <span className="layer-badge zkml">zkML</span>
                  <h3>Policy Verification</h3>
                </div>
                <p>"The ONNX policy model approved this spend with these inputs"</p>
                <div className="layer-features">
                  <span>SNARK proof of policy compliance</span>
                  <span>Deterministic model execution</span>
                  <span>Cryptographic input/output binding</span>
                </div>
              </div>
              <div className="layer-status must-have">MUST HAVE for autonomous agents</div>
            </div>
            <div className="trust-layer layer-2">
              <div className="layer-number">2</div>
              <div className="layer-content">
                <div className="layer-header">
                  <span className="layer-badge tap">AP2/UCP</span>
                  <h3>Intent Verification</h3>
                </div>
                <p>"User approved this specific transaction"</p>
                <div className="layer-features">
                  <span>Cart approval</span>
                  <span>User confirmation</span>
                  <span>Payment authorization</span>
                </div>
              </div>
              <div className="layer-status existing">Existing TAP Flow</div>
            </div>
            <div className="trust-layer layer-1">
              <div className="layer-number">1</div>
              <div className="layer-content">
                <div className="layer-header">
                  <span className="layer-badge tap">TAP</span>
                  <h3>Identity Verification</h3>
                </div>
                <p>"This is a certified Visa agent"</p>
                <div className="layer-features">
                  <span>RFC 9421 signatures</span>
                  <span>Agent registration</span>
                  <span>Point-in-time certification</span>
                </div>
              </div>
              <div className="layer-status existing">Existing TAP Flow</div>
            </div>
          </div>
          <div className="trust-stack-gap">
            <div className="gap-indicator">
              <div className="gap-line"></div>
              <span className="gap-label">The Key Insight</span>
              <div className="gap-line"></div>
            </div>
            <p className="gap-text">
              <strong>LLMs cannot be proven</strong> — they're non-deterministic. But a <strong>separate ONNX policy model</strong> that checks spending rules IS deterministic and CAN be proven with zkML.
            </p>
          </div>
        </div>

        {/* Model Substitution Attack Demo */}
        {showAttackDemo && (
          <div className="attack-section">
            <h2>Model Substitution Attack Visualization</h2>
            <p className="attack-description">
              A certified agent is compromised and its approved model is swapped for a malicious one.
              TAP signature remains valid (same agent identity), but zkML proof fails.
            </p>
            <button className="run-attack-btn" onClick={simulateAttack}>
              Simulate Attack
            </button>

            <div className="attack-flow">
              <div className={`attack-stage ${attack.stage !== 'idle' ? 'active' : ''}`}>
                <div className="attack-icon">1</div>
                <div className="attack-label">Agent Compromised</div>
                <div className={`attack-status ${attack.stage === 'compromised' ? 'in-progress' : ['model_swapped', 'tap_check', 'zkml_check', 'complete'].includes(attack.stage) ? 'done' : ''}`}>
                  {attack.stage === 'compromised' ? 'Attacker gains access...' : ['model_swapped', 'tap_check', 'zkml_check', 'complete'].includes(attack.stage) ? 'Access gained' : ''}
                </div>
              </div>

              <div className="attack-arrow">→</div>

              <div className={`attack-stage ${['model_swapped', 'tap_check', 'zkml_check', 'complete'].includes(attack.stage) ? 'active' : ''}`}>
                <div className="attack-icon danger">2</div>
                <div className="attack-label">Model Swapped</div>
                <div className={`attack-status ${attack.stage === 'model_swapped' ? 'in-progress' : ['tap_check', 'zkml_check', 'complete'].includes(attack.stage) ? 'done danger' : ''}`}>
                  {attack.stage === 'model_swapped' ? 'Replacing model...' : ['tap_check', 'zkml_check', 'complete'].includes(attack.stage) ? 'Malicious model loaded' : ''}
                </div>
              </div>

              <div className="attack-arrow">→</div>

              <div className={`attack-stage ${['tap_check', 'zkml_check', 'complete'].includes(attack.stage) ? 'active' : ''}`}>
                <div className={`attack-icon ${attack.tapResult === 'pass' ? 'warning' : ''}`}>3</div>
                <div className="attack-label">TAP Identity Check</div>
                <div className={`attack-status ${attack.stage === 'tap_check' ? 'in-progress' : attack.tapResult ? (attack.tapResult === 'pass' ? 'done warning' : 'done success') : ''}`}>
                  {attack.stage === 'tap_check' ? 'Verifying signature...' : attack.tapResult === 'pass' ? 'PASSED (identity unchanged)' : ''}
                </div>
              </div>

              <div className="attack-arrow">→</div>

              <div className={`attack-stage ${['zkml_check', 'complete'].includes(attack.stage) ? 'active' : ''}`}>
                <div className={`attack-icon ${attack.zkmlResult === 'fail' ? 'success' : ''}`}>4</div>
                <div className="attack-label">zkML Model Check</div>
                <div className={`attack-status ${attack.stage === 'zkml_check' ? 'in-progress' : attack.zkmlResult ? (attack.zkmlResult === 'fail' ? 'done success' : 'done danger') : ''}`}>
                  {attack.stage === 'zkml_check' ? 'Verifying model commitment...' : attack.zkmlResult === 'fail' ? 'FAILED - Attack blocked!' : ''}
                </div>
              </div>
            </div>

            {attack.stage === 'complete' && (
              <div className="attack-result">
                <div className="attack-result-card danger">
                  <h4>Without zkML (TAP Only)</h4>
                  <p>Attack succeeds. Malicious model processes $75K settlement undetected.</p>
                </div>
                <div className="attack-result-card success">
                  <h4>With zkML Inference Proof</h4>
                  <p>Attack blocked. Model commitment mismatch detected. Settlement rejected.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* How It Works Section */}
        <div className="how-it-works-section">
          <h2>How zkML + Spending Policies Work</h2>
          <p className="how-subtitle">The LLM decides what to buy. The policy model ensures it's allowed. zkML proves the policy was followed.</p>
          <div className="how-steps">
            <div className="how-step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h4>LLM Agent Decides</h4>
                <p className="step-quote">"I want to pay GlobalTech $75,000 for servers"</p>
                <p className="step-note">This decision is <strong>NOT proven</strong> — LLMs are non-deterministic</p>
              </div>
            </div>
            <div className="how-arrow">→</div>
            <div className="how-step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h4>Policy Model Checks</h4>
                <p className="step-quote">"Is this allowed under spending rules?"</p>
                <p className="step-note">ONNX model evaluates: price, daily limit, vendor risk, compliance</p>
              </div>
            </div>
            <div className="how-arrow">→</div>
            <div className="how-step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h4>SNARK Proof Generated</h4>
                <p className="step-quote">"Policy model approved with these exact inputs/outputs"</p>
                <p className="step-note">~48KB proof, 4-12s generation, HyperKZG over BN254</p>
              </div>
            </div>
            <div className="how-arrow">→</div>
            <div className="how-step">
              <div className="step-number">4</div>
              <div className="step-content">
                <h4>Wallet Enforces</h4>
                <p className="step-quote">"No valid proof = No payment"</p>
                <p className="step-note">On-chain verification required before USDC transfer</p>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <div className="tech-section">
          <h2>Technical Implementation</h2>
          <div className="tech-grid">
            <div className="tech-card">
              <h3>B2B Spending Policy</h3>
              <pre className="code-block policy-code">
{`SPENDING_POLICY = {
  maxSinglePurchase: $100,000
  dailyLimit: $500,000
  maxVendorRisk: 0.70
  minVendorHistory: 0.80
  requireCompliance: true
  minBudgetBuffer: $5,000
}`}
              </pre>
            </div>
            <div className="tech-card">
              <h3>JOLT-Atlas Performance</h3>
              <div className="stat">
                <span className="stat-value">4-12s</span>
                <span className="stat-label">Proof Generation</span>
              </div>
              <div className="stat">
                <span className="stat-value">~48KB</span>
                <span className="stat-label">SNARK Proof Size</span>
              </div>
              <div className="stat">
                <span className="stat-value">&lt;150ms</span>
                <span className="stat-label">Verification Time</span>
              </div>
            </div>
            <div className="tech-card">
              <h3>Policy Model Input</h3>
              <pre className="code-block">
{`{
  price: 75000,
  budget: 500000,
  dailySpent: 50000,
  vendorRisk: 0.15,
  vendorHistory: 0.92,
  compliance: true
}`}
              </pre>
            </div>
            <div className="tech-card">
              <h3>Proof Architecture</h3>
              <p>HyperKZG polynomial commitments over BN254 curve. ONNX model with [1,8] input shape.</p>
              <div className="compatibility-list">
                <span className="compat-item">ONNX Runtime</span>
                <span className="compat-item">HyperKZG</span>
                <span className="compat-item">BN254</span>
              </div>
            </div>
          </div>
        </div>

        {/* Visa Intelligent Commerce + USDC Settlement Banner */}
        <div className="visa-context-banner">
          <div className="visa-stat">
            <span className="stat-value">{VISA_STATS.credentials}</span>
            <span className="stat-label">Payment Credentials</span>
          </div>
          <div className="visa-stat">
            <span className="stat-value">{VISA_STATS.merchants}</span>
            <span className="stat-label">Merchant Locations</span>
          </div>
          <div className="visa-stat">
            <span className="stat-value">{VISA_STATS.usdcVolume}</span>
            <span className="stat-label">USDC Settlement Volume</span>
          </div>
          <div className="visa-stat">
            <span className="stat-value">{VISA_STATS.arcPartner}</span>
            <span className="stat-label">Blockchain Partner</span>
          </div>
        </div>

        {/* Business Outcomes Section */}
        <div className="outcomes-section">
          <h2>Business Outcomes</h2>
          <div className="outcomes-grid">
            <div className="outcome-card">
              <div className="outcome-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
              <h3>Chargeback Protection</h3>
              <p>Cryptographic proof that the certified model approved the settlement. Irrefutable evidence in disputes.</p>
              <div className="outcome-stat">
                <span className="stat-highlight">$75K</span>
                <span>settlement protected</span>
              </div>
            </div>
            <div className="outcome-card">
              <div className="outcome-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
              <h3>Audit Compliance</h3>
              <p>Immutable decision trail anchored on Circle Arc. Every AI decision permanently recorded.</p>
              <div className="outcome-stat">
                <span className="stat-highlight">Arc</span>
                <span>blockchain anchor</span>
              </div>
            </div>
            <div className="outcome-card">
              <div className="outcome-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h3>Liability Clarity</h3>
              <p>Proof links decision to specific certified model version. Clear accountability chain.</p>
              <div className="outcome-stat">
                <span className="stat-highlight">v3.2</span>
                <span>model attribution</span>
              </div>
            </div>
          </div>
        </div>

        {/* Comparison Section */}
        <div className="comparison-section">
            <h2>TAP Identity + Inference Proof vs TAP Identity Only</h2>
            <div className="comparison-grid">
              <div className="comparison-card success">
                <h3>TAP + JOLT-Atlas zkML</h3>
                <div className="comparison-subtitle">Complete Agent Verification</div>
                <ul className="benefits">
                  <li><span className="icon">✓</span> <strong>Identity verified</strong> (TAP signature)</li>
                  <li><span className="icon">✓</span> <strong>Correct execution proven</strong> (ZK proof)</li>
                  <li><span className="icon">✓</span> <strong>Model binding verified</strong> (commitment)</li>
                  <li><span className="icon">✓</span> <strong>Audit trail</strong> (Arc anchor)</li>
                  <li><span className="icon">✓</span> Model substitution attacks blocked</li>
                  <li><span className="icon">✓</span> Real-time verification (0.7s proofs)</li>
                  <li><span className="icon">✓</span> Privacy-preserving (ZK proofs)</li>
                </ul>
              </div>
              <div className="comparison-card warning">
                <h3>TAP Identity Only</h3>
                <div className="comparison-subtitle">Partial Verification</div>
                <ul className="risks">
                  <li><span className="icon">✓</span> Identity verified (TAP signature)</li>
                  <li><span className="icon">✗</span> <strong>No proof of correct execution</strong></li>
                  <li><span className="icon">✗</span> <strong>Inference unverified</strong></li>
                  <li><span className="icon">✗</span> <strong>No verifiable audit trail</strong></li>
                  <li><span className="icon">✗</span> Vulnerable to model swapping</li>
                  <li><span className="icon">✗</span> Trust-based verification only</li>
                  <li><span className="icon">✗</span> Limited dispute evidence</li>
                </ul>
              </div>
            </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-main">
            <span className="footer-title">Per-Transaction Model Verification for Visa TAP</span>
            <span className="footer-tagline">TAP verifies WHO. zkML verifies WHAT and HOW.</span>
          </div>
          <div className="footer-links">
            <span>RFC 9421 Compatible</span>
            <span className="divider">•</span>
            <span>Circle Arc Partner</span>
            <span className="divider">•</span>
            <span>$3.5B+ USDC Volume</span>
          </div>
        </div>
      </footer>


      {/* Post-Demo Annotations */}
      {showAnnotations && (
        <AnnotationOverlay
          annotations={ANNOTATIONS}
          currentIndex={currentAnnotation}
          onNext={() => setCurrentAnnotation(i => Math.min(i + 1, ANNOTATIONS.length - 1))}
          onPrev={() => setCurrentAnnotation(i => Math.max(i - 1, 0))}
          onClose={() => setShowAnnotations(false)}
        />
      )}

      {/* Proof Inspector Modal */}
      {showProofInspector && proof.stage === 'complete' && (
        <div className="modal-overlay" onClick={() => setShowProofInspector(false)}>
          <div className="proof-inspector" onClick={e => e.stopPropagation()}>
            <div className="proof-inspector-header">
              <h2>Proof Inspector</h2>
              <button className="close-btn" onClick={() => setShowProofInspector(false)}>×</button>
            </div>
            <div className="proof-inspector-body">
              <div className="proof-section">
                <h4>Model Commitment</h4>
                <div className="proof-value">{proof.commitment}</div>
              </div>
              <div className="proof-section">
                <h4>Input Hash</h4>
                <div className="proof-value">{proof.inputHash}</div>
              </div>
              <div className="proof-section">
                <h4>Output Hash</h4>
                <div className="proof-value">{proof.outputHash}</div>
              </div>
              <div className="proof-section">
                <h4>Performance Metrics</h4>
                <div className="proof-grid">
                  <div className="proof-stat">
                    <div className="value">{proof.generationTime}s</div>
                    <div className="label">Generation Time</div>
                  </div>
                  <div className="proof-stat">
                    <div className="value">{proof.proofSize}B</div>
                    <div className="label">Proof Size</div>
                  </div>
                  <div className="proof-stat">
                    <div className="value">{((proof.confidence || 0) * 100).toFixed(0)}%</div>
                    <div className="label">Confidence</div>
                  </div>
                  <div className="proof-stat">
                    <div className="value" style={{ color: '#10b981' }}>{proof.decision}</div>
                    <div className="label">Decision</div>
                  </div>
                </div>
              </div>
              <div className="proof-section">
                <h4>Arc Blockchain Anchor</h4>
                <div className="proof-value">{proof.arcTxHash}</div>
              </div>
              <div className="proof-section">
                <h4>Verification Status</h4>
                <div className="verification-checks">
                  <div className="verification-check">
                    <span className="check-icon">✓</span>
                    <span className="check-label">Model registered in Visa Registry</span>
                  </div>
                  <div className="verification-check">
                    <span className="check-icon">✓</span>
                    <span className="check-label">Cryptographic proof valid</span>
                  </div>
                  <div className="verification-check">
                    <span className="check-icon">✓</span>
                    <span className="check-label">Anchored on Circle Arc</span>
                  </div>
                  <div className="verification-check">
                    <span className="check-icon">✓</span>
                    <span className="check-label">TAP signature verified</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper Components
function ProofStage({ label, active, complete }: { label: string; active: boolean; complete: boolean }) {
  return (
    <div className={`stage ${active ? 'active' : ''} ${complete ? 'complete' : ''}`}>
      <div className="stage-indicator">
        {complete ? '✓' : active ? '...' : '○'}
      </div>
      <span className="stage-label">{label}</span>
    </div>
  )
}

function VerificationStage({ label, active, complete, result }: { label: string; active: boolean; complete: boolean; result?: boolean }) {
  return (
    <div className={`stage ${active ? 'active' : ''} ${complete ? 'complete' : ''}`}>
      <div className="stage-indicator">
        {complete ? (result !== false ? '✓' : '✗') : active ? '...' : '○'}
      </div>
      <span className="stage-label">{label}</span>
    </div>
  )
}

// Annotation Overlay Component
function AnnotationOverlay({
  annotations,
  currentIndex,
  onNext,
  onPrev,
  onClose,
}: {
  annotations: Annotation[]
  currentIndex: number
  onNext: () => void
  onPrev: () => void
  onClose: () => void
}) {
  const [position, setPosition] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const annotation = annotations[currentIndex]

  // Auto-advance every 10 seconds (slower for readability)
  useEffect(() => {
    if (isPaused) return

    const timer = setInterval(() => {
      if (currentIndex < annotations.length - 1) {
        onNext()
      } else {
        onClose()
      }
    }, 10000)

    return () => clearInterval(timer)
  }, [currentIndex, annotations.length, onNext, onClose, isPaused])

  useEffect(() => {
    const updatePosition = () => {
      const element = document.querySelector(annotation.target)
      if (element) {
        const rect = element.getBoundingClientRect()
        setPosition({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        })
      }
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    return () => window.removeEventListener('resize', updatePosition)
  }, [annotation.target])

  const getTooltipStyle = (): React.CSSProperties => {
    if (!position) return {}

    const offset = 16
    switch (annotation.position) {
      case 'right':
        return {
          top: position.top + position.height / 2,
          left: position.left + position.width + offset,
          transform: 'translateY(-50%)',
        }
      case 'left':
        return {
          top: position.top + position.height / 2,
          right: window.innerWidth - position.left + offset,
          transform: 'translateY(-50%)',
        }
      case 'bottom':
        return {
          top: position.top + position.height + offset,
          left: position.left + position.width / 2,
          transform: 'translateX(-50%)',
        }
      case 'top':
        return {
          bottom: window.innerHeight - position.top + offset,
          left: position.left + position.width / 2,
          transform: 'translateX(-50%)',
        }
      default:
        return {}
    }
  }

  const colorLabels = {
    visa: 'Visa Technology',
    zkml: 'zkML Extension',
    combined: 'Combined Value',
  }

  return (
    <>
      <div className="annotation-overlay" onClick={onClose} />

      {position && (
        <>
          <div
            className={`annotation-highlight ${annotation.color}`}
            style={{
              top: position.top - 4,
              left: position.left - 4,
              width: position.width + 8,
              height: position.height + 8,
            }}
          />
          <div
            className={`annotation-tooltip position-${annotation.position}`}
            style={getTooltipStyle()}
          >
            <span className={`annotation-badge ${annotation.color}`}>
              {colorLabels[annotation.color]}
            </span>
            <div className="annotation-title">{annotation.title}</div>
            <div className="annotation-text">{annotation.text}</div>
          </div>
        </>
      )}

    </>
  )
}

export default App
