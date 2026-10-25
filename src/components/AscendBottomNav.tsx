import { CalendarDays, Home, MessageCircle, MoreHorizontal } from 'lucide-react';
import type { Tab } from '../types';

const items = [
  { id: 'home' as Tab, label: '홈', icon: Home },
  { id: 'records' as Tab, label: '내 기록', icon: CalendarDays },
  { id: 'community' as Tab, label: '커뮤니티', icon: MessageCircle },
  { id: 'more' as Tab, label: '더보기', icon: MoreHorizontal },
];

export default function AscendBottomNav({
  active,
  onNavigate,
}: {
  active: Tab;
  onNavigate?: (tab: Tab) => void;
}) {
  return (
    <div className="ascend-bottom-nav" aria-hidden={!onNavigate}>
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          className={active === item.id ? 'active' : ''}
          aria-current={active === item.id ? 'page' : undefined}
          onClick={() => onNavigate?.(item.id)}
        >
          <item.icon />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
