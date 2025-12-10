'use client';

import { motion } from 'framer-motion';
import { CreditCard, Store, Calendar, DollarSign } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import type { TransactionContext, AgentDecision } from '@/lib/mock';
import { VerificationBadge, type VerificationStatus } from './VerificationBadge';

interface TransactionCardProps {
  transaction: TransactionContext;
  decision?: AgentDecision;
  verificationStatus?: VerificationStatus;
  className?: string;
  showDetails?: boolean;
}

const decisionColors = {
  APPROVE: 'text-verified',
  DENY: 'text-failed',
  ESCALATE: 'text-pending',
  DEFER: 'text-gray-500',
};

export function TransactionCard({
  transaction,
  decision,
  verificationStatus,
  className,
  showDetails = true,
}: TransactionCardProps) {
  const isHighValue = transaction.amount >= 100000; // $1000

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'card p-4',
        isHighValue && 'ring-2 ring-visa-gold/30',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Store className="w-4 h-4 text-gray-400" />
            <span className="font-medium">{transaction.merchantName}</span>
          </div>
          <span className="text-xs text-gray-500">{transaction.category}</span>
        </div>
        <div className="text-right">
          <p className={cn(
            'text-xl font-bold',
            isHighValue ? 'text-visa-gold' : 'text-visa-blue'
          )}>
            {formatCurrency(transaction.amount)}
          </p>
          {isHighValue && (
            <span className="text-xs text-visa-gold">zkML Required</span>
          )}
        </div>
      </div>

      {showDetails && (
        <>
          {/* Details */}
          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <CreditCard className="w-4 h-4" />
              <span>•••• {transaction.cardLast4}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>{new Date(transaction.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Decision */}
          {decision && (
            <div className="pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-gray-600">AI Decision: </span>
                  <span className={cn('font-semibold', decisionColors[decision.decisionType])}>
                    {decision.decisionType}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500">
                    {(decision.confidence * 100).toFixed(1)}% confidence
                  </span>
                </div>
              </div>
              {decision.reasonCode && (
                <p className="text-xs text-gray-500 mt-1">
                  Reason: {decision.reasonCode}
                </p>
              )}
            </div>
          )}

          {/* Verification Status */}
          {verificationStatus && (
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-sm text-gray-600">zkML Verification</span>
              <VerificationBadge status={verificationStatus} />
            </div>
          )}
        </>
      )}

      {/* Transaction ID */}
      <div className="mt-3 pt-3 border-t border-border">
        <code className="text-[10px] text-gray-400 font-mono">
          {transaction.transactionId}
        </code>
      </div>
    </motion.div>
  );
}
