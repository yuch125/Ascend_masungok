import { ClipboardCheck } from 'lucide-react';
export default function ReviewStatus() {
  return (
    <div className="clinical-review-status">
      <span>
        <ClipboardCheck size={19} />
      </span>
      <div>
        <strong>의료진 검토 전</strong>
        <p>
          현재는 영상에서 측정한 기록이에요.
          <br />
          의료기관 연동·검토 기능은 준비 중입니다.
        </p>
      </div>
      <i>미검토</i>
    </div>
  );
}
