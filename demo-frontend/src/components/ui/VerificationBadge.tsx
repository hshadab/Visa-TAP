'use client';

import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type VerificationStatus = 'verified' | 'pending' | 'failed' | 'not-required';

interface VerificationBadgeProps {
  status: VerificationStatus;
  label?: string;
  className?: string;
  showIcon?: boolean;
  animate?: boolean;
}

const statusConfig = {
  verified: {
    icon: CheckCircle,
    label: 'Verified',
    className: 'status-verified',
  },
  pending: {
    icon: Clock,
    label: 'Pending',
    className: 'status-pending',
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    className: 'status-failed',
  },
  'not-required': {
    icon: AlertTriangle,
    label: 'Not Required',
    className: 'status-badge bg-gray-100 text-gray-600',
  },
};

export function VerificationBadge({
  status,
  label,
  className,
  showIcon = true,
  animate = true,
}: VerificationBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const content = (
    <span className={cn(config.className, className)}>
      {showIcon && (
        <Icon className={cn(
          'w-3.5 h-3.5',
          status === 'pending' && animate && 'animate-spin'
        )} />
      )}
      {label || config.label}
    </span>
  );

  if (animate && status === 'verified') {
    return (
      <motion.span
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(config.className, className)}
      >
        {showIcon && <Icon className="w-3.5 h-3.5" />}
        {label || config.label}
      </motion.span>
    );
  }

  return content;
}
