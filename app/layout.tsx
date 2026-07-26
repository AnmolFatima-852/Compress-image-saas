import type { Metadata } from 'next';
import './globals.css';
import { ThemeToggle } from '@/components/theme-toggle';

export const metadata: Metadata = {
  title: 'Compress Image',
  description: 'Compress images to exact KB/MB with maximum quality.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
