import { ThemeToggle } from '@/components/theme-toggle';

export default function AuthPagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div className="absolute right-4 top-4 z-10 sm:right-6">
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
