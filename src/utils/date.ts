export const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
export const duration = (seconds: number) =>
  `${Math.floor(seconds / 60)}분 ${Math.round(seconds % 60)}초`;
