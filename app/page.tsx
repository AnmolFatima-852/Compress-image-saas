import { HeroSection } from '@/components/hero-section';
import { ThemeToggle } from '@/components/theme-toggle';

export default function HomePage() {
  return (
    <div>
      <div className="flex justify-end px-4 pt-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 p-2 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
          <ThemeToggle />
        </div>
      </div>
      <HeroSection />
    </div>
  );
}
