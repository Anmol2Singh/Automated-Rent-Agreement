import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Automated Rent Agreement Registration — Pune Agency',
  description: 'Fast, secure leave and license agreement client intake, AI document extraction, token tracking, and e-registration exporter for Pune, Maharashtra.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen selection:bg-emerald-500 selection:text-white font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
