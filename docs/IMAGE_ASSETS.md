# 운동 예시 이미지 생성 기록

- 방식: 내장 `image_gen.imagegen` 도구. CLI/API 키 방식은 사용하지 않았습니다.
- 최종 파일: [`public/images/rehab-exercises.png`](../public/images/rehab-exercises.png)
- 크기: 2172 × 724px, PNG, 1,881,372바이트.
- 구성: 무릎·어깨·팔꿈치 운동 장면을 담은 3분할 이미지. CSS에서 운동별 장면을 표시합니다.
- 용도: 운동 목록·촬영 준비·운동 계획의 **AI 생성 예시 사진**. 실제 환자·의료진·사용자 영상·측정 결과가 아닙니다.
- 실제 기록과의 구분: 홈의 최신 영상과 내 기록 썸네일은 저장한 사용자 영상만 사용합니다. 원본이 없으면 이 예시 사진으로 대체하지 않습니다.

## 최종 생성 프롬프트

```text
Use case: photorealistic-natural. Asset type: a single landscape photographic triptych banner for a Korean rehabilitation exercise app, to be used as illustrative exercise thumbnails. Create three equal square panels in one seamless 3:1 wide image, clearly composed as three separate photographs with zero gutters, no borders, no text, no typography, no logos, no UI, no video controls, no drawn joint markers. The same fictional adult East Asian woman around 35 wears a simple teal athletic T-shirt, charcoal leggings and white trainers in all three panels in a bright calm modern physiotherapy studio with cream walls, light wood floor, softly lit window and one plant. LEFT PANEL: full body side view of her standing beside a stable exercise support rail, gently bending one knee backward while holding the rail, balanced neutral torso, all feet and head visible. CENTER PANEL: full body front view of her standing comfortably and lifting both arms gently to shoulder height, natural realistic hands, elbows and shoulder anatomy. RIGHT PANEL: full body three-quarter side view of her standing and gently flexing one elbow upward without any weight or equipment, neutral posture. Each person centered within her own square panel with enough margins above the head and below the feet to allow safe square crops. Editorial wellness photography, welcoming and trustworthy, soft daylight, restrained mint/teal and beige palette, realistic skin and anatomy. These are illustration photos, not clinical proof or real patient data.
```
