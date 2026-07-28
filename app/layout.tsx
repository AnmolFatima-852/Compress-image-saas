import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/providers/theme-provider';

export const metadata: Metadata = {
  title: 'Compress Image',
  description: 'Compress images to exact KB/MB with maximum quality.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
