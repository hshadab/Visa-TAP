'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';
import { cn } from '@/lib/utils';
import { Zap, GitBranch, BookOpen } from 'lucide-react';

const navItems = [
  { href: '/simulator', label: 'Transaction Simulator', icon: Zap },
  { href: '/tap-flow', label: 'TAP Integration', icon: GitBranch },
  { href: '/docs', label: 'API Docs', icon: BookOpen },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="bg-surface border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Logo size="md" />
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-visa-blue text-white'
                      : 'text-gray-600 hover:bg-surface-tertiary hover:text-visa-blue'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Visa TAP Badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-surface-tertiary rounded-full">
            <div className="w-2 h-2 bg-verified rounded-full animate-pulse" />
            <span className="text-xs font-medium text-gray-600">Visa TAP Ready</span>
          </div>
        </div>
      </div>
    </header>
  );
}
