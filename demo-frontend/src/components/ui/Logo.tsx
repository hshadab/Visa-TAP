'use client';

import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className, size = 'md' }: LogoProps) {
  const sizes = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-12',
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* JOLT-Atlas Icon */}
      <div className={cn(
        'relative flex items-center justify-center rounded-lg bg-visa-blue',
        size === 'sm' && 'w-6 h-6',
        size === 'md' && 'w-8 h-8',
        size === 'lg' && 'w-12 h-12',
      )}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={cn(
            'text-visa-gold',
            size === 'sm' && 'w-4 h-4',
            size === 'md' && 'w-5 h-5',
            size === 'lg' && 'w-7 h-7',
          )}
        >
          {/* Lightning bolt for JOLT */}
          <path
            d="M13 2L4 14h7l-2 8 9-12h-7l2-8z"
            fill="currentColor"
          />
        </svg>
        {/* Shield overlay for security */}
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-verified rounded-full border-2 border-white" />
      </div>

      {/* Text */}
      <div className="flex flex-col">
        <span className={cn(
          'font-bold text-visa-blue leading-none',
          size === 'sm' && 'text-sm',
          size === 'md' && 'text-base',
          size === 'lg' && 'text-xl',
        )}>
          JOLT-Atlas
        </span>
        <span className={cn(
          'text-gray-500 leading-none',
          size === 'sm' && 'text-[10px]',
          size === 'md' && 'text-xs',
          size === 'lg' && 'text-sm',
        )}>
          zkML for Visa TAP
        </span>
      </div>
    </div>
  );
}
