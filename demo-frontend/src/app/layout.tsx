import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'JOLT-Atlas zkML Demo | Visa TAP Integration',
  description: 'Interactive demonstration of zero-knowledge machine learning proofs for Visa Trusted Agent Protocol',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
