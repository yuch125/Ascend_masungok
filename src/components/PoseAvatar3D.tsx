import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { Exercise, Frame, Landmark, Side } from '../types';

export type PoseAvatarView = 'front' | 'side' | 'back' | 'angle';
type Rig = { bone: THREE.Bone; rest: THREE.Quaternion; direction: THREE.Vector3 };
type PosePoint = { position: THREE.Vector3; confidence: number };
type DirectionState = {
  direction: THREE.Vector3;
  raw: THREE.Vector3;
  lastSeen: number;
  pending?: THREE.Vector3;
  pendingCount: number;
};
type FootSupport = 'left' | 'right' | 'both';

// Rollback switch: false disables the support-foot pivot without changing retargeting.
const USE_SUPPORT_FOOT_PIVOT = true;

const CAMERA_POSITIONS: Record<PoseAvatarView, [number, number, number]> = {
  front: [0, 1.35, 4.1],
  side: [4.1, 1.35, 0],
  back: [0, 1.35, -4.1],
  angle: [3.2, 2.15, 3.2],
};

function targetRange(exercise: Exercise): [number, number] | undefined {
  if (exercise.id === 'knee') return [110, 155];
  if (exercise.id === 'elbow') return [65, 145];
  if (exercise.id === 'shoulder') return [45, 135];
  return exercise.repThresholds;
}

function feedback(frame: Frame | undefined, exercise: Exercise) {
  const range = targetRange(exercise);
  if (!frame?.landmarks.length)
    return { tone: 'quiet', text: '랜드마크를 인식하면 아바타가 움직입니다.' };
  if (frame.angle === null || !range)
    return { tone: 'quiet', text: '측면 또는 전신이 보이도록 카메라 위치를 조정해 주세요.' };
  if (frame.angle < range[0])
    return {
      tone: 'warn',
      text: `현재 각도가 참고 범위(${range[0]}–${range[1]}°)보다 작습니다. 무리하지 마세요.`,
    };
  if (frame.angle > range[1])
    return {
      tone: 'warn',
      text: `현재 각도가 참고 범위(${range[0]}–${range[1]}°)보다 큽니다. 편안한 범위로 돌아오세요.`,
    };
  return { tone: 'good', text: '설정한 참고 움직임 범위 안에 있습니다.' };
}

function point(
  landmarks: (Landmark | null)[],
  index: number,
  mirrored: boolean,
  worldSpace: boolean,
): PosePoint | null {
  const landmark = landmarks[index];
  const confidence = Math.min(landmark?.visibility ?? 0, landmark?.presence ?? 1);
  if (
    !landmark ||
    confidence < 0.65 ||
    !Number.isFinite(landmark.x) ||
    !Number.isFinite(landmark.y) ||
    !Number.isFinite(landmark.z)
  )
    return null;
  if (!worldSpace && (landmark.x < 0 || landmark.x > 1 || landmark.y < 0 || landmark.y > 1))
    return null;
  const x = worldSpace ? landmark.x : landmark.x - 0.5;
  return {
    position: new THREE.Vector3(
      mirrored ? -x : x,
      worldSpace ? -landmark.y : 1 - landmark.y,
      -landmark.z,
    ),
    confidence,
  };
}

function midpoint(a: PosePoint | null, b: PosePoint | null): PosePoint | null {
  return a && b
    ? {
        position: a.position.clone().add(b.position).multiplyScalar(0.5),
        confidence: Math.min(a.confidence, b.confidence),
      }
    : null;
}

function getPose(frame: Frame | undefined, mirrored: boolean) {
  const useWorld = !!frame?.worldLandmarks?.length;
  const landmarks = useWorld ? (frame?.worldLandmarks ?? []) : (frame?.landmarks ?? []);
  const p = (index: number) => point(landmarks, index, mirrored, useWorld);
  const leftHip = p(23),
    rightHip = p(24),
    leftShoulder = p(11),
    rightShoulder = p(12);
  return {
    hips: midpoint(leftHip, rightHip),
    chest: midpoint(leftShoulder, rightShoulder),
    neck: midpoint(leftShoulder, rightShoulder),
    head: p(0),
    leftArm: [leftShoulder, p(13), p(15), p(19)],
    rightArm: [rightShoulder, p(14), p(16), p(20)],
    leftLeg: [leftHip, p(25), p(27), p(31)],
    rightLeg: [rightHip, p(26), p(28), p(32)],
  };
}

function reliableFootTarget(
  knee: PosePoint | null,
  ankle: PosePoint | null,
  toe: PosePoint | null,
) {
  if (!knee || !ankle || !toe || Math.min(ankle.confidence, toe.confidence) < 0.72) return null;
  const shinLength = knee.position.distanceTo(ankle.position);
  const footLength = ankle.position.distanceTo(toe.position);
  const ratio = footLength / Math.max(shinLength, 1e-4);
  return ratio >= 0.12 && ratio <= 0.85 ? toe : null;
}

function landmarkAngle(
  landmarks: (Landmark | null)[],
  [aIndex, bIndex, cIndex]: [number, number, number],
) {
  const a = landmarks[aIndex];
  const b = landmarks[bIndex];
  const c = landmarks[cIndex];
  if (!a || !b || !c || Math.min(a.visibility, b.visibility, c.visibility) < 0.55) return null;
  const ab = new THREE.Vector2(a.x - b.x, a.y - b.y);
  const cb = new THREE.Vector2(c.x - b.x, c.y - b.y);
  if (ab.lengthSq() < 1e-7 || cb.lengthSq() < 1e-7) return null;
  return THREE.MathUtils.radToDeg(ab.angleTo(cb));
}

/** Make the 3D knee agree with the more reliable image-space knee angle. */
function stabilizeLegFromImage(
  leg: (PosePoint | null)[],
  imageAngle: number | null,
): (PosePoint | null)[] {
  const [hip, knee, ankle, toe] = leg;
  if (!hip || !knee || !ankle) return leg;
  const worldAngle = THREE.MathUtils.radToDeg(
    hip.position.clone().sub(knee.position).angleTo(ankle.position.clone().sub(knee.position)),
  );
  const angle = imageAngle ?? worldAngle;
  if (!Number.isFinite(angle)) return leg;

  const upperLength = hip.position.distanceTo(knee.position);
  const lowerLength = knee.position.distanceTo(ankle.position);
  const confidence = Math.min(hip.confidence, knee.confidence, ankle.confidence);
  if (upperLength < 1e-5 || lowerLength < 1e-5) return leg;

  if (angle >= 158) {
    const total = upperLength + lowerLength;
    const alignedKnee = hip.position.clone().lerp(ankle.position, upperLength / total);
    const extension = THREE.MathUtils.smoothstep(angle, 158, 172) * confidence;
    const stableKnee: PosePoint = {
      position: knee.position.clone().lerp(alignedKnee, extension),
      confidence,
    };
    return [hip, stableKnee, ankle, toe];
  }

  const upper = hip.position.clone().sub(knee.position).normalize();
  const measuredLower = ankle.position.clone().sub(knee.position);
  const projection = upper.clone().multiplyScalar(measuredLower.dot(upper));
  let bend = measuredLower.clone().sub(projection);
  if (bend.lengthSq() < 1e-6) bend = new THREE.Vector3(-upper.y, upper.x, 0);
  if (bend.lengthSq() < 1e-6) bend = new THREE.Vector3(0, -upper.z, upper.y);
  bend.normalize();
  const radians = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(angle, 35, 178));
  const correctedPosition = knee.position
    .clone()
    .add(upper.multiplyScalar(Math.cos(radians) * lowerLength))
    .add(bend.multiplyScalar(Math.sin(radians) * lowerLength));
  const blend = 0.55 + confidence * 0.35;
  const stablePosition = ankle.position.clone().lerp(correctedPosition, blend);
  const stableAnkle: PosePoint = { position: stablePosition, confidence };
  const stableToe = toe
    ? {
        position: toe.position.clone().add(stablePosition.clone().sub(ankle.position)),
        confidence: Math.min(toe.confidence, confidence),
      }
    : null;
  return [hip, knee, stableAnkle, stableToe];
}

function normalized(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findBone(bones: THREE.Bone[], ...names: string[]) {
  const options = names.map(normalized);
  // Alias order matters: prefer the actual limb bone over a parent shoulder/connection bone.
  for (const name of options) {
    const exact = bones.find((bone) => normalized(bone.name) === name);
    if (exact) return exact;
  }
  for (const name of options) {
    const partial = bones.find((bone) => normalized(bone.name).includes(name));
    if (partial) return partial;
  }
  return undefined;
}

function limitedDirection(from: THREE.Vector3, to: THREE.Vector3, maxAngle: number) {
  const angle = from.angleTo(to);
  if (!Number.isFinite(angle) || angle <= maxAngle) return to.clone();
  const turn = new THREE.Quaternion().setFromUnitVectors(from, to);
  const step = new THREE.Quaternion().identity().slerp(turn, maxAngle / angle);
  return from.clone().applyQuaternion(step).normalize();
}

/** A client-only FBX avatar driven from MediaPipe's 33 pose landmarks. */
export function PoseAvatar3D({
  frame,
  exercise,
  side,
  mirrored = false,
  compact = false,
  view: controlledView,
  onViewChange,
  hideChrome = false,
}: {
  frame?: Frame;
  exercise: Exercise;
  side: Side;
  mirrored?: boolean;
  compact?: boolean;
  view?: PoseAvatarView;
  onViewChange?: (view: PoseAvatarView) => void;
  hideChrome?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(frame);
  const viewRef = useRef<PoseAvatarView>('angle');
  const [internalView, setInternalView] = useState<PoseAvatarView>('angle');
  const view = controlledView ?? internalView;
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const result = feedback(frame, exercise);
  frameRef.current = frame;
  viewRef.current = view;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#08110f');
    const floorRoot = new THREE.Group();
    floorRoot.name = 'FloorRoot';
    scene.add(floorRoot);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setStatus('error');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);

    const hemisphere = new THREE.HemisphereLight('#d8fff0', '#14231e', 2.2);
    const key = new THREE.DirectionalLight('#ffffff', 2.8);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    scene.add(hemisphere, key);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 48),
      new THREE.MeshStandardMaterial({ color: '#17372d', roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.2;
    floor.receiveShadow = true;
    scene.add(floor);

    const rig = new Map<string, Rig>();
    // Landmark updates arrive at about 10–12 fps and have unavoidable pixel/depth noise.
    // Smooth directions (not absolute positions) so body translations do not make the rig lag.
    const trackedDirections = new Map<string, DirectionState>();
    let observedFrameTime = Number.NaN;
    let avatarRoot: THREE.Group | undefined;
    let avatarBaseY = 0;
    const groundMarkers = new Map<'left' | 'right', THREE.Object3D>();
    const markerRestY = new Map<'left' | 'right', number>();
    let footSupport: FootSupport = 'both';
    let filteredLeftFootY: number | undefined;
    let filteredRightFootY: number | undefined;
    const loader = new FBXLoader();
    loader.load(
      '/models/HUMAN.fbx',
      (avatar) => {
        if (disposed) return;
        const box = new THREE.Box3().setFromObject(avatar);
        const height = Math.max(box.max.y - box.min.y, 0.01);
        avatar.scale.setScalar(2.35 / height);
        avatar.position.y = -1.18 - box.min.y * avatar.scale.y;
        avatarRoot = avatar;
        avatarBaseY = avatar.position.y;
        avatar.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.frustumCulled = false;
          }
        });
        floorRoot.add(avatar);
        avatar.updateMatrixWorld(true);
        const bones: THREE.Bone[] = [];
        avatar.traverse((object) => {
          if (object instanceof THREE.Bone) bones.push(object);
        });
        const bind = (key: string, names: string[]) => {
          const bone = findBone(bones, ...names);
          const child = bone?.children.find(
            (item): item is THREE.Bone => item instanceof THREE.Bone,
          );
          if (!bone || !child) return;
          rig.set(key, {
            bone,
            rest: bone.quaternion.clone(),
            direction: child.position.clone().normalize().applyQuaternion(bone.quaternion),
          });
        };
        bind('spine', ['spine']);
        bind('neck', ['neck']);
        bind('head', ['head']);
        // Includes Mixamo-style names and the short `upperarml` / `upperlegl`
        // convention used by HUMAN.fbx.
        bind('leftShoulder', ['shoulderl', 'leftshoulder']);
        bind('leftArm', ['upperarml', 'leftupperarm', 'leftarm']);
        bind('leftForeArm', ['leftforearm', 'leftlowerarm', 'lowerarml']);
        bind('leftHand', ['lefthand', 'handl']);
        bind('rightShoulder', ['shoulderr', 'rightshoulder']);
        bind('rightArm', ['upperarmr', 'rightupperarm', 'rightarm']);
        bind('rightForeArm', ['rightforearm', 'rightlowerarm', 'lowerarmr']);
        bind('rightHand', ['righthand', 'handr']);
        // `connectionl/r` are structural pelvis offsets, not anatomical joints.
        // They intentionally stay in bind pose; rotating them double-transforms the thigh.
        bind('leftUpLeg', ['leftupleg', 'leftthigh', 'upperlegl']);
        bind('leftLeg', ['leftleg', 'leftcalf', 'leftlowerleg', 'lowerlegl']);
        bind('leftFoot', ['leftfoot', 'footl']);
        bind('rightUpLeg', ['rightupleg', 'rightthigh', 'upperlegr']);
        bind('rightLeg', ['rightleg', 'rightcalf', 'rightlowerleg', 'lowerlegr']);
        bind('rightFoot', ['rightfoot', 'footr']);
        for (const side of ['left', 'right'] as const) {
          const foot = rig.get(`${side}Foot`)?.bone;
          groundMarkers.set(
            side,
            foot?.children.find((child): child is THREE.Bone => child instanceof THREE.Bone) ??
              foot ??
              avatar,
          );
        }
        avatar.updateMatrixWorld(true);
        for (const [side, marker] of groundMarkers)
          markerRestY.set(side, marker.getWorldPosition(new THREE.Vector3()).y);
        setStatus('ready');
      },
      undefined,
      () => !disposed && setStatus('error'),
    );

    const apply = (
      key: string,
      start: PosePoint | null,
      end: PosePoint | null,
      isNewLandmarkFrame: boolean,
      sampleTime: number,
      holdWhenMissing = false,
    ) => {
      const item = rig.get(key);
      if (!item) return;
      let state = trackedDirections.get(key);
      if (!start || !end || start.position.distanceToSquared(end.position) < 1e-6) {
        if (holdWhenMissing) return;
        // Brief occlusion: hold the last reliable direction. Lower-body chains settle
        // toward their stable standing pose sooner so a lost knee cannot leave a leg aloft.
        const lowerBody = /Hip|Leg|Foot/.test(key);
        if (state && sampleTime - state.lastSeen > (lowerBody ? 0.22 : 0.55))
          item.bone.quaternion.slerp(item.rest, lowerBody ? 0.045 : 0.018);
        return;
      }
      const measuredWorld = end.position.clone().sub(start.position).normalize();
      if (!state) {
        state = {
          direction: measuredWorld.clone(),
          raw: measuredWorld.clone(),
          lastSeen: sampleTime,
          pendingCount: 0,
        };
        trackedDirections.set(key, state);
      } else if (isNewLandmarkFrame) {
        const jump = state.raw.angleTo(measuredWorld);
        // A limb cannot physically flip this far in one 10 Hz sample. Require the new
        // direction twice before accepting it, which rejects one-frame inward folds.
        if (jump > THREE.MathUtils.degToRad(62)) {
          if (
            state.pending &&
            state.pending.angleTo(measuredWorld) < THREE.MathUtils.degToRad(22)
          ) {
            state.pending.lerp(measuredWorld, 0.5).normalize();
            state.pendingCount += 1;
          } else {
            state.pending = measuredWorld.clone();
            state.pendingCount = 1;
          }
          if (state.pendingCount >= 2) {
            state.raw.copy(
              limitedDirection(state.raw, state.pending, THREE.MathUtils.degToRad(24)),
            );
            state.pending = undefined;
            state.pendingCount = 0;
          }
        } else {
          const elapsed = THREE.MathUtils.clamp(sampleTime - state.lastSeen, 0.04, 0.25);
          const maxStep = THREE.MathUtils.clamp(elapsed * 4.2, 0.12, 0.48);
          state.raw.copy(limitedDirection(state.raw, measuredWorld, maxStep));
          state.pending = undefined;
          state.pendingCount = 0;
        }
        const confidence = Math.min(start.confidence, end.confidence);
        const timeConstant = /Arm|Hand/.test(key) ? 0.16 : 0.12;
        const response =
          (1 - Math.exp(-Math.max(sampleTime - state.lastSeen, 0.04) / timeConstant)) *
          (0.45 + confidence * 0.55);
        state.direction.lerp(state.raw, THREE.MathUtils.clamp(response, 0.08, 0.72)).normalize();
        state.lastSeen = sampleTime;
      }
      const parentQuaternion = new THREE.Quaternion();
      item.bone.parent?.getWorldQuaternion(parentQuaternion);
      const localTarget = state.direction.clone().applyQuaternion(parentQuaternion.invert());
      const correction = new THREE.Quaternion().setFromUnitVectors(item.direction, localTarget);
      const wanted = correction.multiply(item.rest);
      item.bone.quaternion.slerp(wanted, 0.12);
    };
    const updateFootSupport = (pose: ReturnType<typeof getPose>, isNewFrame: boolean) => {
      if (!isNewFrame) return;
      const leftY = pose.leftLeg[2]?.position.y ?? pose.leftLeg[3]?.position.y;
      const rightY = pose.rightLeg[2]?.position.y ?? pose.rightLeg[3]?.position.y;
      if (leftY !== undefined)
        filteredLeftFootY =
          filteredLeftFootY === undefined
            ? leftY
            : THREE.MathUtils.lerp(filteredLeftFootY, leftY, 0.24);
      if (rightY !== undefined)
        filteredRightFootY =
          filteredRightFootY === undefined
            ? rightY
            : THREE.MathUtils.lerp(filteredRightFootY, rightY, 0.24);
      if (filteredLeftFootY !== undefined && filteredRightFootY !== undefined) {
        const difference = filteredRightFootY - filteredLeftFootY;
        // Positive means the right foot is higher, so the left foot bears weight.
        if (Math.abs(difference) > 0.075) footSupport = difference > 0 ? 'left' : 'right';
        else if (Math.abs(difference) < 0.045) footSupport = 'both';
      } else if (leftY !== undefined) footSupport = 'left';
      else if (rightY !== undefined) footSupport = 'right';
    };
    const groundBodyToSupportFoot = (modelLeft: 'left' | 'right', modelRight: 'left' | 'right') => {
      if (!USE_SUPPORT_FOOT_PIVOT || !avatarRoot) return;
      avatarRoot.updateMatrixWorld(true);
      const active =
        footSupport === 'both'
          ? [modelLeft, modelRight]
          : [footSupport === 'left' ? modelLeft : modelRight];
      const corrections = active.flatMap((modelSide) => {
        const marker = groundMarkers.get(modelSide);
        const restY = markerRestY.get(modelSide);
        if (!marker || restY === undefined) return [];
        const currentY = marker.getWorldPosition(new THREE.Vector3()).y;
        return Number.isFinite(currentY) ? [restY - currentY] : [];
      });
      if (!corrections.length) return;
      const correction = corrections.reduce((sum, value) => sum + value, 0) / corrections.length;
      if (Math.abs(correction) < 0.0025) return;
      const targetY = THREE.MathUtils.clamp(
        avatarRoot.position.y + correction,
        avatarBaseY - 0.58,
        avatarBaseY + 0.12,
      );
      // FloorRoot never moves. Only the body under it settles vertically, so a squat
      // lowers the pelvis instead of bending a straight knee to reach the floor.
      avatarRoot.position.y = THREE.MathUtils.lerp(avatarRoot.position.y, targetY, 0.24);
    };
    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      renderer.setSize(Math.max(width, 1), Math.max(height, 1), false);
      camera.aspect = Math.max(width, 1) / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    let animation = 0;
    const draw = () => {
      const pose = getPose(frameRef.current, mirrored);
      const nextTime = frameRef.current?.time;
      const isNewLandmarkFrame = nextTime !== undefined && nextTime !== observedFrameTime;
      if (isNewLandmarkFrame) observedFrameTime = nextTime;
      const sampleTime = nextTime ?? observedFrameTime;
      apply('spine', pose.hips, pose.chest, isNewLandmarkFrame, sampleTime);
      apply('neck', pose.neck, pose.head, isNewLandmarkFrame, sampleTime);
      // The selfie preview is a mirror. Swap model sides here so raising the arm on the
      // screen-left moves the avatar's screen-left arm too, rather than its anatomical left.
      const left = mirrored ? 'right' : 'left';
      const right = mirrored ? 'left' : 'right';
      // Legs follow the requested MediaPipe chains directly:
      // 23 -> 25 -> 27 (left) and 24 -> 26 -> 28 (right).
      // Near extension, trust image x/y for the knee angle and remove noisy world-z bend.
      const imageLandmarks = frameRef.current?.landmarks ?? [];
      const leftLeg = stabilizeLegFromImage(
        pose.leftLeg,
        landmarkAngle(imageLandmarks, [23, 25, 27]),
      );
      const rightLeg = stabilizeLegFromImage(
        pose.rightLeg,
        landmarkAngle(imageLandmarks, [24, 26, 28]),
      );
      const leftToe = reliableFootTarget(leftLeg[1], leftLeg[2], leftLeg[3]);
      const rightToe = reliableFootTarget(rightLeg[1], rightLeg[2], rightLeg[3]);
      updateFootSupport(pose, isNewLandmarkFrame);
      apply(`${left}Shoulder`, pose.chest, pose.leftArm[0], isNewLandmarkFrame, sampleTime);
      apply(`${left}Arm`, pose.leftArm[0], pose.leftArm[1], isNewLandmarkFrame, sampleTime);
      apply(`${left}ForeArm`, pose.leftArm[1], pose.leftArm[2], isNewLandmarkFrame, sampleTime);
      apply(`${left}Hand`, pose.leftArm[2], pose.leftArm[3], isNewLandmarkFrame, sampleTime);
      apply(`${right}Shoulder`, pose.chest, pose.rightArm[0], isNewLandmarkFrame, sampleTime);
      apply(`${right}Arm`, pose.rightArm[0], pose.rightArm[1], isNewLandmarkFrame, sampleTime);
      apply(`${right}ForeArm`, pose.rightArm[1], pose.rightArm[2], isNewLandmarkFrame, sampleTime);
      apply(`${right}Hand`, pose.rightArm[2], pose.rightArm[3], isNewLandmarkFrame, sampleTime);
      apply(`${left}UpLeg`, leftLeg[0], leftLeg[1], isNewLandmarkFrame, sampleTime);
      apply(`${left}Leg`, leftLeg[1], leftLeg[2], isNewLandmarkFrame, sampleTime);
      apply(`${left}Foot`, leftLeg[2], leftToe, isNewLandmarkFrame, sampleTime, true);
      apply(`${right}UpLeg`, rightLeg[0], rightLeg[1], isNewLandmarkFrame, sampleTime);
      apply(`${right}Leg`, rightLeg[1], rightLeg[2], isNewLandmarkFrame, sampleTime);
      apply(`${right}Foot`, rightLeg[2], rightToe, isNewLandmarkFrame, sampleTime, true);
      groundBodyToSupportFoot(left, right);
      const [x, y, z] = CAMERA_POSITIONS[viewRef.current];
      camera.position.lerp(new THREE.Vector3(x, y, z), 0.09);
      camera.lookAt(0, 0.05, 0);
      renderer.render(scene, camera);
      animation = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      disposed = true;
      cancelAnimationFrame(animation);
      observer.disconnect();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [mirrored]);

  return (
    <section
      className={`pose-avatar ${compact ? 'pose-avatar-compact' : ''}`}
      aria-label="3D 자세 보기"
    >
      <div className="pose-avatar-canvas" ref={hostRef} />
      {!hideChrome && (
        <>
          <div className="pose-avatar-header">
            <strong>3D 자세</strong>
            <span>
              {status === 'loading'
                ? '모델 불러오는 중'
                : status === 'error'
                  ? '모델을 불러오지 못했습니다'
                  : 'MediaPipe 리깅'}
            </span>
          </div>
          <div className="pose-avatar-views" role="group" aria-label="아바타 시점">
            {(['front', 'side', 'back', 'angle'] as PoseAvatarView[]).map((name) => (
              <button
                key={name}
                className={view === name ? 'selected' : ''}
                onClick={() => {
                  setInternalView(name);
                  onViewChange?.(name);
                }}
              >
                {{ front: '정면', side: '측면', back: '후면', angle: '사선' }[name]}
              </button>
            ))}
          </div>
          <p className={`pose-avatar-feedback ${result.tone}`}>
            <b>
              {side === 'left' ? '왼쪽' : '오른쪽'} {exercise.jointName}
            </b>{' '}
            {result.text}
          </p>
          {!compact && (
            <small className="pose-avatar-note">
              참고용 시각화입니다. 통증이 있으면 중단하고 전문가와 상담하세요.
            </small>
          )}
        </>
      )}
    </section>
  );
}
