import type { Exercise, Plan } from '../../types';
export const exercises: Exercise[] = [
  {
    id: 'knee',
    name: '무릎 굽혔다 펴기',
    subtitle: '작은 움직임부터, 천천히',
    bodyPart: '무릎',
    duration: '약 3분',
    instructions: [
      '안정적인 지지대를 잡고 편안히 서세요.',
      '의료진이 안내한 범위 안에서 무릎을 천천히 굽혔다 펴세요.',
      '측정할 쪽의 엉덩이·무릎·발목이 모두 보이게 촬영하세요.',
    ],
    cameraDirection: '측면',
    precautions:
      '균형을 잡을 수 있는 지지대를 사용하세요. 통증이 생기면 중단하고 의료진과 상담하세요.',
    referenceUrl: 'https://www.orthoinfo.org/recovery/knee-conditioning-program/',
    joints: { left: [23, 25, 27], right: [24, 26, 28] },
    jointName: '무릎',
    repThresholds: [110, 155],
    color: 'mint',
  },
  {
    id: 'shoulder',
    name: '팔 들어 올리기',
    subtitle: '오늘의 움직임을 가볍게',
    bodyPart: '어깨',
    duration: '약 3분',
    instructions: [
      '의료진이 안내한 자세로 편안히 서세요.',
      '지정받은 방향과 범위 안에서 팔을 천천히 올렸다 내리세요.',
      '정면에서 엉덩이·어깨·팔꿈치가 가리지 않게 촬영하세요.',
    ],
    cameraDirection: '정면',
    precautions:
      '개인에게 맞는 방향과 범위를 전문가에게 확인하세요. 어깨에 통증이 생기면 중단하세요.',
    referenceUrl:
      'https://www.orthoinfo.org/recovery/rotator-cuff-and-shoulder-conditioning-program/',
    joints: { left: [23, 11, 13], right: [24, 12, 14] },
    jointName: '어깨',
    color: 'peach',
  },
  {
    id: 'elbow',
    name: '팔꿈치 굽혔다 펴기',
    subtitle: '편안한 범위에서 한 번 더',
    bodyPart: '팔꿈치',
    duration: '약 2분',
    instructions: [
      '상체를 편안히 유지하고 측정할 팔을 옆에 두세요.',
      '의료진이 안내한 범위 안에서 팔꿈치를 굽혔다 펴세요.',
      '측면에서 어깨·팔꿈치·손목이 모두 보이게 촬영하세요.',
    ],
    cameraDirection: '측면',
    precautions: '무게와 저항은 임의로 추가하지 마세요. 통증이나 불편함이 생기면 중단하세요.',
    referenceUrl:
      'https://www.orthoinfo.org/recovery/rotator-cuff-and-shoulder-conditioning-program/',
    joints: { left: [11, 13, 15], right: [12, 14, 16] },
    jointName: '팔꿈치',
    repThresholds: [65, 145],
    color: 'lavender',
  },
];
export const defaultPlans: Plan[] = exercises.map((e) => ({
  id: e.id,
  exerciseId: e.id,
  sets: 2,
  repetitions: 10,
  frequency: '개인 계획 확인 필요',
  notes:
    '공개 자료를 바탕으로 구성한 측정 참고 예시입니다. 횟수·세트는 처방이 아니며, 운동 전 의료진에게 적합성을 확인하세요.',
  source: 'reference',
  confirmed: false,
}));
export const getExercise = (id: string) => exercises.find((e) => e.id === id)!;
export function getPlan(exerciseId: string, plans: Plan[]): Plan {
  return (
    plans.find((plan) => plan.exerciseId === exerciseId) ??
    defaultPlans.find((plan) => plan.exerciseId === exerciseId)!
  );
}
