import { Activity } from 'lucide-react';
export default function EmptyChart({
  text = '첫 기록이 나의 변화의 시작이에요',
  action,
}: {
  text?: string;
  action?: () => void;
}) {
  return (
    <div className="empty-chart">
      <div className="empty-chart-grid" />
      <span className="empty-icon">
        <Activity size={23} />
      </span>
      <strong>{text}</strong>
      <p>실제 운동을 기록하면 여기에 변화가 쌓여요.</p>
      {action && (
        <button className="text-button" onClick={action}>
          첫 운동 기록하기 →
        </button>
      )}
    </div>
  );
}
