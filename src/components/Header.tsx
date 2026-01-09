import { getGreeting } from '@/lib/utils';
import { Leaf } from 'lucide-react';

interface HeaderProps {
  userName?: string;
}

export function Header({ userName = 'Друг' }: HeaderProps) {
  const greeting = getGreeting();
  const today = new Date();
  const formattedDate = today.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <header className="mb-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 zen-gradient rounded-xl zen-shadow-soft">
          <Leaf className="w-6 h-6 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold zen-text-gradient">ZenFlow</span>
      </div>
      
      <div className="mt-6">
        <h1 className="text-3xl font-bold text-foreground">
          {greeting}, {userName}! 👋
        </h1>
        <p className="text-muted-foreground mt-1 capitalize">{formattedDate}</p>
      </div>
    </header>
  );
}
