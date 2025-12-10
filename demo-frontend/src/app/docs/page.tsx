'use client';

import { Header } from '@/components/ui/Header';
import { Code, ExternalLink, Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';

const endpoints = [
  {
    method: 'POST',
    path: '/v1/zkml/verify',
    description: 'Verify a zkML proof',
    request: `{
  "proof": "<base64_encoded_proof>",
  "model_commitment": "<hex_commitment>",
  "tap_signature": "<optional_tap_sig>",
  "transaction_amount": 150000
}`,
    response: `{
  "valid": true,
  "model_commitment": "a1b2c3...",
  "verified_at": 1733600000,
  "model_info": {
    "agentId": "AGT-FRAUD-001",
    "version": "3.2.0",
    "name": "FraudGuard AI"
  }
}`,
  },
  {
    method: 'GET',
    path: '/v1/zkml/models/:commitment',
    description: 'Get information about a registered model',
    request: null,
    response: `{
  "agentId": "AGT-FRAUD-001",
  "registeredAt": 1733500000,
  "version": "3.2.0",
  "name": "FraudGuard AI"
}`,
  },
  {
    method: 'POST',
    path: '/v1/zkml/models',
    description: 'Register a new model (requires API key)',
    request: `{
  "commitment": "<hex_commitment>",
  "agent_id": "AGT-FRAUD-001",
  "version": "3.2.0",
  "name": "FraudGuard AI"
}`,
    response: `{
  "commitment": "a1b2c3...",
  "agentId": "AGT-FRAUD-001",
  "registeredAt": 1733600000,
  "version": "3.2.0",
  "active": true
}`,
  },
];

const headers = [
  {
    name: 'X-ZKML-PROOF',
    description: 'Base64-encoded zkML proof',
    required: true,
  },
  {
    name: 'X-ZKML-MODEL-COMMITMENT',
    description: 'Hex-encoded model commitment (64 chars)',
    required: true,
  },
  {
    name: 'X-ZKML-INPUT-COMMITMENT',
    description: 'Hex-encoded input commitment',
    required: false,
  },
  {
    name: 'X-ZKML-OUTPUT-COMMITMENT',
    description: 'Hex-encoded output commitment',
    required: false,
  },
  {
    name: 'X-ZKML-TIMESTAMP',
    description: 'Unix timestamp of proof generation',
    required: true,
  },
  {
    name: 'X-ZKML-THRESHOLD',
    description: 'USD threshold in cents (default: 100000)',
    required: false,
  },
];

function CodeBlock({ code, language = 'json' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="code-block text-xs">
        <code>{code}</code>
      </pre>
      <button
        onClick={copyToClipboard}
        className="absolute top-2 right-2 p-1.5 rounded bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? (
          <CheckCircle className="w-4 h-4 text-verified" />
        ) : (
          <Copy className="w-4 h-4 text-white/70" />
        )}
      </button>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-surface-secondary">
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-visa-blue mb-2">API Reference</h1>
          <p className="text-gray-600">
            Complete documentation for the JOLT-Atlas zkML verification API
          </p>
        </div>

        {/* Quick Start */}
        <section className="card p-6 mb-8">
          <h2 className="text-xl font-semibold text-visa-blue mb-4">Quick Start</h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Agent Integration (Rust)</h3>
              <CodeBlock
                language="rust"
                code={`use zkml_jolt::{JoltAtlas, ProofConfig};

// Load model and generate commitment
let prover = JoltAtlas::new("model.onnx")?;

// Generate proof for transaction
let proof = prover.prove(
    transaction_context,
    &ProofConfig::default()
)?;

// Add to TAP message headers
request.headers_mut()
    .set_zkml_proof(&proof)?;`}
              />
            </div>

            <div>
              <h3 className="font-medium mb-2">Merchant Verification (TypeScript)</h3>
              <CodeBlock
                language="typescript"
                code={`import { quickVerify } from '@icme/zkml-verifier';

// Verify proof from TAP headers
const result = await quickVerify({
  proof: headers.get('X-ZKML-PROOF'),
  modelCommitment: headers.get('X-ZKML-MODEL-COMMITMENT'),
});

if (result.valid) {
  await processPayment(transaction);
}`}
              />
            </div>
          </div>
        </section>

        {/* HTTP Headers */}
        <section className="card p-6 mb-8">
          <h2 className="text-xl font-semibold text-visa-blue mb-4">TAP Message Headers</h2>
          <p className="text-gray-600 mb-4">
            zkML proofs are transmitted via HTTP headers in TAP authorization messages.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 font-medium">Header</th>
                  <th className="text-left py-2 font-medium">Description</th>
                  <th className="text-left py-2 font-medium">Required</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((header) => (
                  <tr key={header.name} className="border-b border-border">
                    <td className="py-3">
                      <code className="text-xs bg-surface-tertiary px-2 py-1 rounded font-mono">
                        {header.name}
                      </code>
                    </td>
                    <td className="py-3 text-gray-600">{header.description}</td>
                    <td className="py-3">
                      {header.required ? (
                        <span className="status-verified">Required</span>
                      ) : (
                        <span className="status-badge bg-gray-100 text-gray-500">Optional</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Endpoints */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold text-visa-blue">Endpoints</h2>

          {endpoints.map((endpoint) => (
            <div key={endpoint.path} className="card overflow-hidden">
              <div className="px-6 py-4 bg-surface-tertiary border-b border-border flex items-center gap-4">
                <span
                  className={`px-2 py-1 rounded text-xs font-bold ${
                    endpoint.method === 'GET'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  {endpoint.method}
                </span>
                <code className="font-mono text-sm">{endpoint.path}</code>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-gray-600">{endpoint.description}</p>

                {endpoint.request && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Request Body</h4>
                    <CodeBlock code={endpoint.request} />
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium mb-2">Response</h4>
                  <CodeBlock code={endpoint.response} />
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Links */}
        <section className="card p-6 mt-8">
          <h2 className="text-xl font-semibold text-visa-blue mb-4">Resources</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { label: 'GitHub Repository', href: 'https://github.com/ICME-Lab/visa-tap-zkml' },
              { label: 'Visa TAP Documentation', href: 'https://developer.visa.com/tap' },
              { label: 'JOLT Paper', href: 'https://eprint.iacr.org/jolt' },
              { label: 'NovaNet Facilitator', href: 'https://verify.novanet.xyz' },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-visa-blue hover:bg-surface-tertiary transition-colors"
              >
                <span className="font-medium text-visa-blue">{link.label}</span>
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
