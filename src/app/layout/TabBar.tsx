import { BookOpen, Calendar, ShoppingCart, Activity, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useTranslation } from 'react-i18next';
import type { Tab } from '@/shared/domain/types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type NavItemProps = {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
};

function NavItem({ active, onClick, icon, label }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all duration-200 min-w-[64px]',
        active ? 'text-emerald-600' : 'text-zinc-400 hover:text-zinc-600'
      )}
    >
      <div className={cn('p-1 rounded-lg transition-colors', active ? 'bg-emerald-50' : 'bg-transparent')}>
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

type TabBarProps = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
};

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const { t } = useTranslation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-zinc-200 px-4 py-3 z-50">
      <div className="max-w-lg mx-auto flex justify-between items-center">
        <NavItem active={activeTab === 'recipes'} onClick={() => onTabChange('recipes')} icon={<BookOpen className="w-6 h-6" />} label={t('tabs.recipes')} />
        <NavItem active={activeTab === 'planner'} onClick={() => onTabChange('planner')} icon={<Calendar className="w-6 h-6" />} label={t('tabs.planner')} />
        <NavItem active={activeTab === 'cart'} onClick={() => onTabChange('cart')} icon={<ShoppingCart className="w-6 h-6" />} label={t('tabs.cart')} />
        <NavItem active={activeTab === 'tracker'} onClick={() => onTabChange('tracker')} icon={<Activity className="w-6 h-6" />} label={t('tabs.tracker')} />
        <NavItem active={activeTab === 'programs'} onClick={() => onTabChange('programs')} icon={<Users className="w-6 h-6" />} label={t('tabs.programs')} />
      </div>
    </nav>
  );
}
