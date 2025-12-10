'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Logo } from '@/components/ui/Logo';
import { Zap, GitBranch, Shield, Clock, CheckCircle, ArrowRight } from 'lucide-react';

const features = [
  {
    icon: Clock,
    title: '0.7s Proof Generation',
    description: 'Real-time verification within payment latency requirements',
  },
  {
    icon: Shield,
    title: 'Zero-Knowledge Privacy',
    description: 'Verify model execution without revealing model internals',
  },
  {
    icon: CheckCircle,
    title: 'Visa TAP Compatible',
    description: 'Seamless integration with Trusted Agent Protocol',
  },
];

const demos = [
  {
    href: '/simulator',
    icon: Zap,
    title: 'Transaction Simulator',
    description: 'Interactive split-screen demo showing real-time zkML proof generation and verification between AI agents and merchants.',
    color: 'bg-visa-gold',
  },
  {
    href: '/tap-flow',
    icon: GitBranch,
    title: 'TAP Integration Flow',
    description: 'Step-through visualization of the complete Visa TAP message flow with zkML proof headers and verification.',
    color: 'bg-verified',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="gradient-bg text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                <Logo size="lg" className="[&>div:first-child]:bg-white [&_span:first-child]:text-white [&_span:last-child]:text-white/70" />
              </div>
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Zero-Knowledge ML for
              <span className="text-visa-gold"> Visa TAP</span>
            </h1>
            <p className="text-xl text-white/80 max-w-2xl mx-auto mb-8">
              Cryptographically verify AI agent decisions in real-time.
              Enable trusted autonomous payments with JOLT-Atlas zkML proofs.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/simulator" className="btn-gold text-lg px-8 py-3">
                <Zap className="w-5 h-5 mr-2" />
                Try Demo
              </Link>
              <Link
                href="/tap-flow"
                className="inline-flex items-center px-8 py-3 text-white border border-white/30 rounded-lg hover:bg-white/10 transition-colors"
              >
                View TAP Integration
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Wave Divider */}
        <div className="h-16 bg-surface-secondary" style={{
          clipPath: 'ellipse(70% 100% at 50% 100%)',
          marginTop: '-4rem',
        }} />
      </div>

      {/* Features Section */}
      <div className="bg-surface-secondary py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="card p-6 card-hover"
              >
                <div className="w-12 h-12 rounded-xl bg-visa-blue/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-visa-blue" />
                </div>
                <h3 className="text-lg font-semibold text-visa-blue mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Demo Cards Section */}
      <div className="bg-surface py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center text-visa-blue mb-12">
            Interactive Demonstrations
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            {demos.map((demo, index) => (
              <motion.div
                key={demo.href}
                initial={{ opacity: 0, x: index === 0 ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Link href={demo.href} className="block group">
                  <div className="card p-6 card-hover h-full">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl ${demo.color} flex items-center justify-center flex-shrink-0`}>
                        <demo.icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-visa-blue mb-2 group-hover:text-visa-blue-light transition-colors">
                          {demo.title}
                        </h3>
                        <p className="text-gray-600">
                          {demo.description}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center text-visa-blue font-medium">
                      Launch Demo
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Benchmark Section */}
      <div className="bg-visa-blue-dark text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-8">
            Performance Benchmark
          </h2>

          <div className="space-y-4">
            {[
              { name: 'JOLT-Atlas', time: 0.7, highlight: true },
              { name: 'Competitor A', time: 2.1, highlight: false },
              { name: 'Competitor B', time: 5.0, highlight: false },
            ].map((item) => (
              <div key={item.name} className="flex items-center gap-4">
                <span className="w-32 text-sm">{item.name}</span>
                <div className="flex-1 h-8 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.time / 5) * 100}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className={`h-full rounded-full ${
                      item.highlight ? 'bg-visa-gold' : 'bg-white/30'
                    }`}
                  />
                </div>
                <span className={`w-16 text-right font-mono ${item.highlight ? 'text-visa-gold' : ''}`}>
                  {item.time}s
                </span>
              </div>
            ))}
          </div>

          <p className="text-center mt-6 text-white/70 text-sm">
            Within Visa's 2-second latency requirement for payment processing
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-surface border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Logo size="sm" />
            <p className="text-sm text-gray-500">
              ICME Labs / NovaNet | December 2025 | Demo v0.1.0
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
