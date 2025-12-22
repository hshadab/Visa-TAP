import { useState, useCallback } from 'react'
import './App.css'

// Types
interface Transaction {
  id: string
  amount: number
  merchant: string
  timestamp: number
  status: 'pending' | 'processing' | 'approved' | 'denied'
}

interface ProofState {
  stage: 'idle' | 'loading_model' | 'generating_commitment' | 'running_inference' | 'generating_proof' | 'complete'
  progress: number
  commitment?: string
  inputHash?: string
  outputHash?: string
  decision?: 'Approve' | 'Deny' | 'Escalate'
  confidence?: number
  proofSize?: number
  generationTime?: number
}

interface VerificationState {
  stage: 'idle' | 'receiving' | 'checking_registry' | 'verifying_proof' | 'complete'
  status?: 'valid' | 'invalid'
  modelRegistered?: boolean
  proofFresh?: boolean
  cryptoValid?: boolean
}

// Demo model info
const MODEL_INFO = {
  name: 'VisaAgent-TransactionDecision-v2.1',
  commitment: 'a7f3c2e8d1b4f5a6c9e2d3b4a5f6c7e8d9b1a2c3e4f5a6b7c8d9e0f1a2b3c4d5',
  weightsHash: 'e8d1b4f5a6c9e2d3b4a5f6c7e8d9b1a2c3e4f5a6b7c8d9e0f1a2b3c4d5a7f3c2',
  archHash: 'b4a5f6c7e8d9b1a2c3e4f5a6b7c8d9e0f1a2b3c4d5a7f3c2e8d1b4f5a6c9e2d3',
  registeredAt: '2024-12-15T10:30:00Z',
  agentId: 'agent_visa_shopping_assistant_001',
}

function App() {
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [proof, setProof] = useState<ProofState>({ stage: 'idle', progress: 0 })
  const [verification, setVerification] = useState<VerificationState>({ stage: 'idle' })
  const [showComparison, setShowComparison] = useState(false)
  const [demoMode, setDemoMode] = useState<'with_zkml' | 'without_zkml'>('with_zkml')

  // Reset demo
  const resetDemo = useCallback(() => {
    setTransaction(null)
    setProof({ stage: 'idle', progress: 0 })
    setVerification({ stage: 'idle' })
  }, [])

  // Simulate proof generation
  const simulateProofGeneration = useCallback(async () => {
    const stages: ProofState['stage'][] = ['loading_model', 'generating_commitment', 'running_inference', 'generating_proof', 'complete']
    const durations = [150, 100, 200, 250, 0] // Simulated timing in ms

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i]

      if (stage === 'complete') {
        setProof({
          stage: 'complete',
          progress: 100,
          commitment: MODEL_INFO.commitment,
          inputHash: 'c3e4f5a6b7c8d9e0f1a2b3c4d5a7f3c2e8d1b4f5a6c9e2d3b4a5f6c7e8d9b1a2',
          outputHash: 'd5a7f3c2e8d1b4f5a6c9e2d3b4a5f6c7e8d9b1a2c3e4f5a6b7c8d9e0f1a2b3c4',
          decision: 'Approve',
          confidence: 0.94,
          proofSize: 512,
          generationTime: 0.7,
        })
      } else {
        setProof(prev => ({
          ...prev,
          stage,
          progress: ((i + 1) / stages.length) * 100,
        }))
      }

      await new Promise(r => setTimeout(r, durations[i]))
    }
  }, [])

  // Simulate verification
  const simulateVerification = useCallback(async () => {
    const stages: VerificationState['stage'][] = ['receiving', 'checking_registry', 'verifying_proof', 'complete']
    const durations = [200, 150, 200, 0]

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i]

      if (stage === 'complete') {
        setVerification({
          stage: 'complete',
          status: 'valid',
          modelRegistered: true,
          proofFresh: true,
          cryptoValid: true,
        })
      } else {
        setVerification(prev => ({
          ...prev,
          stage,
          modelRegistered: stage === 'verifying_proof' ? true : prev.modelRegistered,
        }))
      }

      await new Promise(r => setTimeout(r, durations[i]))
    }
  }, [])

  // Run the demo flow
  const runDemo = useCallback(async () => {
    resetDemo()

    // Create transaction
    const txn: Transaction = {
      id: `txn_${Date.now()}`,
      amount: 2500.00,
      merchant: 'TechStore Electronics',
      timestamp: Date.now(),
      status: 'pending',
    }
    setTransaction(txn)

    await new Promise(r => setTimeout(r, 500))

    setTransaction(t => t ? { ...t, status: 'processing' } : null)

    if (demoMode === 'with_zkml') {
      // Run proof generation
      await simulateProofGeneration()
      await new Promise(r => setTimeout(r, 300))

      // Run verification
      await simulateVerification()
      await new Promise(r => setTimeout(r, 200))
    }

    setTransaction(t => t ? { ...t, status: 'approved' } : null)
  }, [demoMode, resetDemo, simulateProofGeneration, simulateVerification])

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo">
              <span className="logo-icon">zkML</span>
              <span className="logo-text">JOLT-Atlas</span>
            </div>
            <span className="logo-divider">|</span>
            <span className="logo-visa">Visa TAP Integration</span>
          </div>
          <div className="header-actions">
            <button
              className={`mode-btn ${demoMode === 'with_zkml' ? 'active' : ''}`}
              onClick={() => { setDemoMode('with_zkml'); resetDemo(); }}
            >
              With zkML
            </button>
            <button
              className={`mode-btn ${demoMode === 'without_zkml' ? 'active' : ''}`}
              onClick={() => { setDemoMode('without_zkml'); resetDemo(); }}
            >
              Without zkML
            </button>
            <button className="compare-btn" onClick={() => setShowComparison(!showComparison)}>
              {showComparison ? 'Hide' : 'Show'} Comparison
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main">
        {/* Demo Controls */}
        <div className="demo-controls">
          <button className="run-demo-btn" onClick={runDemo}>
            Run Transaction Demo
          </button>
          <button className="reset-btn" onClick={resetDemo}>
            Reset
          </button>
        </div>

        {/* Flow Visualization */}
        <div className="flow-container">
          {/* Agent Panel */}
          <div className="panel agent-panel">
            <div className="panel-header">
              <div className="panel-icon agent-icon">AI</div>
              <h2>AI Shopping Agent</h2>
            </div>
            <div className="panel-content">
              <div className="model-info">
                <h3>Registered Model</h3>
                <div className="info-row">
                  <span className="label">Model:</span>
                  <span className="value">{MODEL_INFO.name}</span>
                </div>
                <div className="info-row">
                  <span className="label">Agent ID:</span>
                  <span className="value mono">{MODEL_INFO.agentId.slice(0, 20)}...</span>
                </div>
                <div className="info-row">
                  <span className="label">Commitment:</span>
                  <span className="value mono">{MODEL_INFO.commitment.slice(0, 16)}...</span>
                </div>
              </div>

              {transaction && (
                <div className="transaction-card">
                  <h3>Transaction Request</h3>
                  <div className="transaction-amount">${transaction.amount.toLocaleString()}</div>
                  <div className="transaction-merchant">{transaction.merchant}</div>
                  <div className={`transaction-status status-${transaction.status}`}>
                    {transaction.status.toUpperCase()}
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
          <div className={`panel proof-panel ${demoMode === 'without_zkml' ? 'disabled' : ''}`}>
            <div className="panel-header">
              <div className="panel-icon proof-icon">ZK</div>
              <h2>zkML Proof Generation</h2>
              {demoMode === 'without_zkml' && <span className="disabled-badge">SKIPPED</span>}
            </div>
            <div className="panel-content">
              {demoMode === 'with_zkml' ? (
                <>
                  <div className="proof-stages">
                    <ProofStage
                      label="Load Model"
                      active={proof.stage === 'loading_model'}
                      complete={['generating_commitment', 'running_inference', 'generating_proof', 'complete'].includes(proof.stage)}
                    />
                    <ProofStage
                      label="Verify Commitment"
                      active={proof.stage === 'generating_commitment'}
                      complete={['running_inference', 'generating_proof', 'complete'].includes(proof.stage)}
                    />
                    <ProofStage
                      label="Run Inference"
                      active={proof.stage === 'running_inference'}
                      complete={['generating_proof', 'complete'].includes(proof.stage)}
                    />
                    <ProofStage
                      label="Generate ZK Proof"
                      active={proof.stage === 'generating_proof'}
                      complete={proof.stage === 'complete'}
                    />
                  </div>

                  {proof.stage !== 'idle' && (
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${proof.progress}%` }}></div>
                    </div>
                  )}

                  {proof.stage === 'complete' && (
                    <div className="proof-result">
                      <div className="result-header">
                        <span className="check-icon">✓</span>
                        Proof Generated in <strong>{proof.generationTime}s</strong>
                      </div>
                      <div className="proof-details">
                        <div className="detail-row">
                          <span>Decision:</span>
                          <span className="decision-approve">{proof.decision}</span>
                        </div>
                        <div className="detail-row">
                          <span>Confidence:</span>
                          <span>{((proof.confidence || 0) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="detail-row">
                          <span>Proof Size:</span>
                          <span>{proof.proofSize} bytes</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="no-zkml-warning">
                  <div className="warning-icon">⚠️</div>
                  <p>Without zkML, there's no cryptographic proof of:</p>
                  <ul>
                    <li>Which model made the decision</li>
                    <li>How the decision was computed</li>
                    <li>Model hasn't been swapped post-certification</li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Arrow */}
          <div className="flow-arrow">
            <div className={`arrow-line ${verification.stage !== 'idle' || (demoMode === 'without_zkml' && transaction?.status === 'approved') ? 'active' : ''}`}></div>
            <div className="arrow-head"></div>
          </div>

          {/* Verification Panel */}
          <div className="panel verification-panel">
            <div className="panel-header">
              <div className="panel-icon verification-icon">V</div>
              <h2>Merchant / Visa Verification</h2>
            </div>
            <div className="panel-content">
              {demoMode === 'with_zkml' ? (
                <>
                  <div className="verification-stages">
                    <VerificationStage
                      label="Receive Proof"
                      active={verification.stage === 'receiving'}
                      complete={['checking_registry', 'verifying_proof', 'complete'].includes(verification.stage)}
                    />
                    <VerificationStage
                      label="Check Model Registry"
                      active={verification.stage === 'checking_registry'}
                      complete={['verifying_proof', 'complete'].includes(verification.stage)}
                      result={verification.modelRegistered}
                    />
                    <VerificationStage
                      label="Verify Cryptographic Proof"
                      active={verification.stage === 'verifying_proof'}
                      complete={verification.stage === 'complete'}
                      result={verification.cryptoValid}
                    />
                  </div>

                  {verification.stage === 'complete' && (
                    <div className="verification-result valid">
                      <div className="result-icon">✓</div>
                      <div className="result-text">
                        <strong>Verification Complete</strong>
                        <p>Model execution cryptographically verified</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="no-verification">
                  {transaction?.status === 'approved' ? (
                    <div className="verification-result warning">
                      <div className="result-icon">⚠️</div>
                      <div className="result-text">
                        <strong>No Verification Possible</strong>
                        <p>TAP signature verified identity only</p>
                        <p className="risk">Model execution unverified</p>
                      </div>
                    </div>
                  ) : (
                    <p className="waiting">Waiting for transaction...</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Comparison Section */}
        {showComparison && (
          <div className="comparison-section">
            <h2>TAP with zkML vs TAP without zkML</h2>
            <div className="comparison-grid">
              <div className="comparison-card">
                <h3>With JOLT-Atlas zkML</h3>
                <ul className="benefits">
                  <li><span className="icon">✓</span> Cryptographic proof of model execution</li>
                  <li><span className="icon">✓</span> Verifiable model commitment binding</li>
                  <li><span className="icon">✓</span> Prevents model substitution attacks</li>
                  <li><span className="icon">✓</span> Real-time verification (0.7s proofs)</li>
                  <li><span className="icon">✓</span> Privacy-preserving (ZK proofs)</li>
                </ul>
              </div>
              <div className="comparison-card warning">
                <h3>Without zkML</h3>
                <ul className="risks">
                  <li><span className="icon">✗</span> No proof of which model ran</li>
                  <li><span className="icon">✗</span> Cannot verify decision logic</li>
                  <li><span className="icon">✗</span> Vulnerable to model swapping</li>
                  <li><span className="icon">✗</span> Trust-based only</li>
                  <li><span className="icon">✗</span> Limited auditability</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Technical Details */}
        <div className="tech-section">
          <h2>Technical Implementation</h2>
          <div className="tech-grid">
            <div className="tech-card">
              <h3>JOLT-Atlas Performance</h3>
              <div className="stat">
                <span className="stat-value">0.7s</span>
                <span className="stat-label">Proof Generation</span>
              </div>
              <div className="stat">
                <span className="stat-value">3-7x</span>
                <span className="stat-label">Faster than competitors</span>
              </div>
            </div>
            <div className="tech-card">
              <h3>TAP Headers</h3>
              <pre className="code-block">
{`X-ZKML-PROOF: base64(proof)
X-ZKML-MODEL-COMMITMENT: keccak256(...)
X-ZKML-THRESHOLD: 1000
X-ZKML-TIMESTAMP: ${Math.floor(Date.now() / 1000)}`}
              </pre>
            </div>
            <div className="tech-card">
              <h3>Verification Endpoint</h3>
              <pre className="code-block">
{`POST /v1/zkml/verify
{
  "proof": "<base64>",
  "model_commitment": "<hex>",
  "transaction_amount": 2500
}`}
              </pre>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <span>ICME Labs / NovaNet</span>
          <span className="divider">•</span>
          <span>JOLT-Atlas zkML</span>
          <span className="divider">•</span>
          <span>Visa Trusted Agent Protocol Integration</span>
        </div>
      </footer>
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

export default App
