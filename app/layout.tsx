import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Compress Image',
  description: 'Compress images to exact KB/MB with maximum quality.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
