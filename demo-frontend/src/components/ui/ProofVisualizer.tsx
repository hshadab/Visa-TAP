'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Hash, Clock, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { cn, truncateHash, formatTimestamp } from '@/lib/utils';
import type { MockProof } from '@/lib/mock';

interface ProofVisualizerProps {
  proof: MockProof | null;
  isGenerating?: boolean;
  generationTime?: number;
  className?: string;
}

export function ProofVisualizer({
  proof,
  isGenerating = false,
  generationTime,
  className,
}: ProofVisualizerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={cn('card overflow-hidden', className)}>
      {/* Header */}
      <div className="px-4 py-3 bg-surface-tertiary border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-visa-blue" />
          <span className="font-medium text-sm">zkML Proof</span>
        </div>
        {generationTime && (
          <span className="text-xs text-gray-500">
            Generated in {generationTime.toFixed(2)}s
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          {isGenerating ? (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-8 gap-4"
            >
              {/* Animated proof generation visualization */}
              <div className="relative">
                <motion.div
                  className="w-16 h-16 border-4 border-visa-blue/20 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                />
                <motion.div
                  className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-visa-gold rounded-full"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                />
                <Lock className="absolute inset-0 m-auto w-6 h-6 text-visa-blue" />
              </div>
              <div className="text-center">
                <p className="font-medium text-visa-blue">Generating Proof</p>
                <p className="text-xs text-gray-500">Running JOLT-Atlas zkML prover...</p>
              </div>
            </motion.div>
          ) : proof ? (
            <motion.div
              key="proof"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              {/* Model Commitment */}
              <div className="data-row">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Hash className="w-4 h-4" />
                  Model Commitment
                </div>
                <code className="text-xs font-mono text-visa-blue bg-surface-tertiary px-2 py-1 rounded">
                  {truncateHash(proof.modelCommitment)}
                </code>
              </div>

              {/* Input Commitment */}
              <div className="data-row">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Hash className="w-4 h-4" />
                  Input Commitment
                </div>
                <code className="text-xs font-mono text-visa-blue bg-surface-tertiary px-2 py-1 rounded">
                  {truncateHash(proof.inputCommitment)}
                </code>
              </div>

              {/* Output Commitment */}
              <div className="data-row">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Hash className="w-4 h-4" />
                  Output Commitment
                </div>
                <code className="text-xs font-mono text-visa-blue bg-surface-tertiary px-2 py-1 rounded">
                  {truncateHash(proof.outputCommitment)}
                </code>
              </div>

              {/* Timestamp */}
              <div className="data-row">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  Timestamp
                </div>
                <span className="text-xs text-gray-500">
                  {formatTimestamp(proof.timestamp)}
                </span>
              </div>

              {/* Expandable execution proof */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between py-2 text-sm text-gray-600 hover:text-visa-blue transition-colors"
              >
                <span>Execution Proof Data</span>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <pre className="code-block text-[10px] leading-relaxed break-all whitespace-pre-wrap">
                      {proof.executionProof}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-8 text-center text-gray-400"
            >
              <Shield className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No proof generated yet</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
