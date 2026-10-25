import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Exercise, Frame, Landmark, Side } from '../types';

export type PoseAvatarView = 'front' | 'side' | 'back' | 'angle';
type Rig = {
  bone: THREE.Bone;
  rest: THREE.Quaternion;
  direction: THREE.Vector3;
  secondary: THREE.Vector3;
};
type PosePoint = { position: THREE.Vector3; confidence: number };
type HandOrientation = {
  forward: THREE.Vector3;
  thumb: THREE.Vector3;
  normal: THREE.Vector3;
  confidence: number;
};
type HandState = HandOrientation & {
  basis: THREE.Quaternion;
  lastSeen: number;
};
type DirectionState = {
  direction: THREE.Vector3;
  raw: THREE.Vector3;
  lastSeen: number;
  pending?: THREE.Vector3;
  pendingCount: number;
};
type FootSupport = 'left' | 'right' | 'both';
type LegMotionState = {
  trackingAngle: boolean;
  missingEvidence: number;
  lastAngle: number;
};

// Rollback switch: false disables the support-foot pivot without changing retargeting.
const USE_SUPPORT_FOOT_PIVOT = true;

// Verified from HUMAN.fbx bind-pose vertices in each hand bone's local space.
// The mesh has sculpted fingers but no individual finger/thumb bones.
export const HUMAN_HAND_THUMB_AXIS = {
  left: [1, 0, 0],
  right: [-1, 0, 0],
} as const;
export const HUMAN_HAND_PALM_NORMAL_AXIS = {
  left: [0, 0, -1],
  right: [0, 0, 1],
} as const;

export function modelSideForDisplay(side: 'left' | 'right', mirrored: boolean) {
  if (!mirrored) return side;
  return side === 'left' ? 'right' : 'left';
}

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
  trustDetected = false,
): PosePoint | null {
  const landmark = landmarks[index];
  const visibility = landmark?.visibility ?? (trustDetected ? 1 : 0);
  const confidence = Math.min(
    visibility > 0 || !trustDetected ? visibility : 1,
    landmark?.presence ?? 1,
  );
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

function averagePoint(points: (PosePoint | null)[]) {
  const detected = points.filter((item): item is PosePoint => !!item);
  if (!detected.length) return null;
  return {
    position: detected
      .reduce((sum, item) => sum.add(item.position), new THREE.Vector3())
      .multiplyScalar(1 / detected.length),
    confidence: Math.min(...detected.map((item) => item.confidence)),
  } satisfies PosePoint;
}

function palmPlaneNormal(wrist: PosePoint, fingers: PosePoint[]) {
  const rays = fingers.map((finger) => finger.position.clone().sub(wrist.position));
  const pairs: [number, number][] = [
    [0, 3],
    [0, 2],
    [1, 3],
  ];
  const normals = pairs.flatMap(([a, b]) => {
    const normal = new THREE.Vector3().crossVectors(rays[a], rays[b]);
    return normal.lengthSq() > 1e-9 ? [normal.normalize()] : [];
  });
  if (!normals.length) return null;
  const reference = normals[0];
  const normal = normals.reduce((sum, candidate) => {
    if (reference.dot(candidate) < 0) candidate.negate();
    return sum.add(candidate);
  }, new THREE.Vector3());
  return normal.lengthSq() > 1e-7 ? normal.normalize() : null;
}

function handBasisQuaternion(forward: THREE.Vector3, thumb: THREE.Vector3) {
  const yAxis = forward.clone().normalize();
  const xAxis = thumb.clone().addScaledVector(yAxis, -thumb.dot(yAxis)).normalize();
  const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis),
  );
}

type ResolvedHandLandmarks = {
  image: (Landmark | null)[];
  world: (Landmark | null)[];
  declaredSide: 'left' | 'right';
};

function wristDistance(hand: (Landmark | null)[], poseWrist: Landmark | null | undefined) {
  const wrist = hand[0];
  if (!wrist || !poseWrist) return Number.POSITIVE_INFINITY;
  return Math.hypot(wrist.x - poseWrist.x, wrist.y - poseWrist.y);
}

/** Validate Holistic's declared hand sides against pose wrists 15/16. */
export function resolveHandLandmarks(
  frame: Frame | undefined,
  side: 'left' | 'right',
): ResolvedHandLandmarks | null {
  if (!frame) return null;
  const candidates: ResolvedHandLandmarks[] = [
    {
      image: frame.leftHandLandmarks ?? [],
      world: frame.leftHandWorldLandmarks ?? [],
      declaredSide: 'left' as const,
    },
    {
      image: frame.rightHandLandmarks ?? [],
      world: frame.rightHandWorldLandmarks ?? [],
      declaredSide: 'right' as const,
    },
  ].filter((candidate) => candidate.image.length > 0 || candidate.world.length > 0);
  if (!candidates.length) return null;

  const poseWrist = frame.landmarks[side === 'left' ? 15 : 16];
  const otherWrist = frame.landmarks[side === 'left' ? 16 : 15];
  const measured = candidates.filter((candidate) => candidate.image[0] && poseWrist);
  if (measured.length) {
    const closest = measured.reduce((best, candidate) =>
      wristDistance(candidate.image, poseWrist) < wristDistance(best.image, poseWrist)
        ? candidate
        : best,
    );
    const ownDistance = wristDistance(closest.image, poseWrist);
    const otherDistance = wristDistance(closest.image, otherWrist);
    // Require a small margin so detection noise cannot alternate left/right every frame.
    if (ownDistance + 0.025 < otherDistance) return closest;
    if (measured.length === 1 && otherDistance + 0.025 < ownDistance) return null;
  }
  return candidates.find((candidate) => candidate.declaredSide === side) ?? null;
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

/** Match the palm axis and anatomical thumb side to the model's fixed hand mesh. */
export function getHandOrientation(
  frame: Frame | undefined,
  side: 'left' | 'right',
  mirrored: boolean,
): HandOrientation | null {
  const resolved = resolveHandLandmarks(frame, side);
  if (!resolved) return null;
  const useWorld = !!resolved.world.length;
  const landmarks = useWorld ? resolved.world : resolved.image;
  const p = (index: number) => point(landmarks, index, mirrored, useWorld, true);
  const wrist = p(0);
  const indexMcp = p(5);
  const middleMcp = p(9);
  const ringMcp = p(13);
  const pinkyMcp = p(17);
  const thumbCmc = p(1);
  const thumbMcp = p(2);
  const thumbIp = p(3);
  const thumbTip = p(4);
  if (
    !wrist ||
    !indexMcp ||
    !middleMcp ||
    !ringMcp ||
    !pinkyMcp ||
    !thumbCmc ||
    !thumbMcp ||
    !thumbIp ||
    !thumbTip
  )
    return null;

  // Averaging all four knuckles makes the hand axis much less sensitive to one
  // occluded finger. PIP joints widen the side axis without following curled tips.
  const palmCenter = averagePoint([indexMcp, middleMcp, ringMcp, pinkyMcp]);
  const indexEdge = averagePoint([indexMcp, p(6)]);
  const pinkyEdge = averagePoint([pinkyMcp, p(18)]);
  const thumbCenter = averagePoint([thumbCmc, thumbMcp, thumbIp, thumbTip]);
  if (!palmCenter || !indexEdge || !pinkyEdge || !thumbCenter) return null;
  const forward = palmCenter.position.clone().sub(wrist.position);
  const planeNormal = palmPlaneNormal(wrist, [indexMcp, middleMcp, ringMcp, pinkyMcp]);
  // The index-to-pinky span and landmarks 1–4 identify the anatomical thumb side.
  // Their relative position resolves which side of the detected palm plane is front.
  const indexSide = indexEdge.position.clone().sub(pinkyEdge.position);
  const detectedThumb = thumbCenter.position.clone().sub(palmCenter.position);
  if (
    forward.lengthSq() < 1e-7 ||
    !planeNormal ||
    indexSide.lengthSq() < 1e-7 ||
    detectedThumb.lengthSq() < 1e-7
  )
    return null;
  forward.normalize();
  planeNormal.addScaledVector(forward, -planeNormal.dot(forward));
  indexSide.addScaledVector(forward, -indexSide.dot(forward));
  detectedThumb.addScaledVector(forward, -detectedThumb.dot(forward));
  if (
    planeNormal.lengthSq() < 1e-7 ||
    indexSide.lengthSq() < 1e-7 ||
    detectedThumb.lengthSq() < 1e-7
  )
    return null;
  planeNormal.normalize();
  indexSide.normalize();
  detectedThumb.normalize();
  if (indexSide.dot(detectedThumb) < 0) detectedThumb.negate();
  const observedThumbSide = indexSide.lerp(detectedThumb, 0.38).normalize();
  let thumb = planeNormal.clone().cross(forward).normalize();
  if (thumb.dot(observedThumbSide) < 0) {
    planeNormal.negate();
    thumb.negate();
  }
  // Keep the palm plane dominant while still following a clearly spread thumb.
  thumb.lerp(observedThumbSide, 0.18);
  thumb.addScaledVector(forward, -thumb.dot(forward)).normalize();
  const normal = new THREE.Vector3().crossVectors(forward, thumb).normalize();
  return {
    forward,
    thumb,
    normal,
    confidence: Math.min(
      wrist.confidence,
      thumbCmc.confidence,
      thumbMcp.confidence,
      thumbIp.confidence,
      thumbTip.confidence,
      indexMcp.confidence,
      middleMcp.confidence,
      ringMcp.confidence,
      pinkyMcp.confidence,
      indexEdge.confidence,
      pinkyEdge.confidence,
    ),
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

export function landmarkAngle(
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

/** Make the 3D knee agree with image-space; only missing evidence falls back to standing. */
export function stabilizeLegFromImage(
  leg: (PosePoint | null)[],
  imageAngle: number | null,
): (PosePoint | null)[] {
  const [hip, knee, ankle, toe] = leg;
  if (!hip || !knee || !ankle) return leg;
  // Depth noise commonly makes a straight leg look bent in world landmarks. Only
  // image-space evidence may introduce knee flexion; otherwise assume extension.
  const angle = imageAngle ?? 180;
  if (!Number.isFinite(angle)) return leg;

  const upperLength = hip.position.distanceTo(knee.position);
  const lowerLength = knee.position.distanceTo(ankle.position);
  const confidence = Math.min(hip.confidence, knee.confidence, ankle.confidence);
  if (upperLength < 1e-5 || lowerLength < 1e-5) return leg;

  // Do not erase the shallow flexion at the beginning/end of a squat. The previous
  // 154-degree cutoff turned a visibly flexed knee into a fully rigid leg.
  if (angle >= 174) {
    const total = upperLength + lowerLength;
    const alignedKnee = hip.position.clone().lerp(ankle.position, upperLength / total);
    const extension =
      imageAngle === null
        ? 1
        : THREE.MathUtils.smoothstep(angle, 174, 179) * (0.78 + confidence * 0.22);
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

export function isBilateralSquatBend(left: number | null, right: number | null) {
  if (left === null || right === null || !Number.isFinite(left) || !Number.isFinite(right))
    return false;
  return Math.max(left, right) < 174;
}

function resolvedLegAngle(state: LegMotionState, measured: number | null, isNewFrame: boolean) {
  if (!isNewFrame) return state.trackingAngle ? state.lastAngle : null;

  if (measured === null || !Number.isFinite(measured)) {
    state.missingEvidence += 1;
    // Hold the most recent bend briefly through an occluded knee instead of snapping
    // the whole leg straight in a single frame. Sustained loss still returns to stance.
    if (state.missingEvidence >= 6) state.trackingAngle = false;
  } else {
    const next = THREE.MathUtils.clamp(measured, 35, 180);
    state.lastAngle = state.trackingAngle
      ? THREE.MathUtils.lerp(state.lastAngle, next, 0.58)
      : next;
    state.trackingAngle = true;
    state.missingEvidence = 0;
  }

  return state.trackingAngle ? state.lastAngle : null;
}

/** A client-only FBX avatar driven from MediaPipe's 33 pose landmarks. */
export function PoseAvatar3D({
  frame,
  exercise,
  side,
  mirrored = false,
  compact = false,
  view: controlledView,
  viewResetKey = 0,
  onViewChange,
  hideChrome = false,
}: {
  frame?: Frame;
  exercise: Exercise;
  side: Side;
  mirrored?: boolean;
  compact?: boolean;
  view?: PoseAvatarView;
  viewResetKey?: number;
  onViewChange?: (view: PoseAvatarView) => void;
  hideChrome?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(frame);
  const viewRef = useRef<PoseAvatarView>('angle');
  const presetRequestRef = useRef(0);
  const [internalView, setInternalView] = useState<PoseAvatarView>('angle');
  const view = controlledView ?? internalView;
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const result = feedback(frame, exercise);
  frameRef.current = frame;
  viewRef.current = view;
  useEffect(() => {
    presetRequestRef.current += 1;
  }, [viewResetKey]);

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
    renderer.domElement.setAttribute(
      'aria-label',
      '3D 모델. 드래그하여 회전하고 휠 또는 두 손가락으로 확대하거나 축소할 수 있습니다.',
    );
    host.appendChild(renderer.domElement);

    const orbitTarget = new THREE.Vector3(0, 0.05, 0);
    const initialCameraPosition = CAMERA_POSITIONS[viewRef.current];
    camera.position.set(...initialCameraPosition);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(orbitTarget);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.rotateSpeed = 0.72;
    controls.zoomSpeed = 0.9;
    controls.minDistance = 1.55;
    controls.maxDistance = 8.5;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = Math.PI - 0.12;
    controls.update();
    let appliedView = viewRef.current;
    let appliedPresetRequest = presetRequestRef.current;
    let presetActive = false;
    const presetPosition = new THREE.Vector3(...initialCameraPosition);
    const stopPreset = () => {
      presetActive = false;
    };
    controls.addEventListener('start', stopPreset);

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
    const trackedHands = new Map<string, HandState>();
    const legMotion: Record<'left' | 'right', LegMotionState> = {
      left: {
        trackingAngle: false,
        missingEvidence: 0,
        lastAngle: 180,
      },
      right: {
        trackingAngle: false,
        missingEvidence: 0,
        lastAngle: 180,
      },
    };
    let observedFrameTime = Number.NaN;
    let avatarRoot: THREE.Group | undefined;
    const avatarBasePosition = new THREE.Vector3();
    const groundMarkers = new Map<'left' | 'right', THREE.Object3D>();
    const markerRestPosition = new Map<'left' | 'right', THREE.Vector3>();
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
        avatarBasePosition.copy(avatar.position);
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
        const bind = (key: string, names: string[], secondaryAxis = new THREE.Vector3(0, 0, 1)) => {
          const bone = findBone(bones, ...names);
          const child = bone?.children.find(
            (item): item is THREE.Bone => item instanceof THREE.Bone,
          );
          if (!bone || !child) return;
          const rest = bone.quaternion.clone();
          const direction = child.position.clone().normalize().applyQuaternion(rest);
          let secondary = secondaryAxis.clone().normalize().applyQuaternion(rest);
          secondary.addScaledVector(direction, -secondary.dot(direction));
          if (secondary.lengthSq() < 1e-6) {
            secondary = new THREE.Vector3(1, 0, 0).applyQuaternion(rest);
            secondary.addScaledVector(direction, -secondary.dot(direction));
          }
          rig.set(key, { bone, rest, direction, secondary: secondary.normalize() });
        };
        bind('spine', ['spine']);
        bind('neck', ['neck']);
        bind('head', ['head']);
        // Includes Mixamo-style names and the short `upperarml` / `upperlegl`
        // convention used by HUMAN.fbx.
        bind('leftShoulder', ['shoulderl', 'leftshoulder']);
        bind('leftArm', ['upperarml', 'leftupperarm', 'leftarm']);
        bind('leftForeArm', ['leftforearm', 'leftlowerarm', 'lowerarml']);
        // HUMAN.fbx has no finger bones. Its sculpted left thumb extends toward
        // hand-local +X and its right thumb toward -X, so those become the roll axes.
        bind('leftHand', ['lefthand', 'handl'], new THREE.Vector3(...HUMAN_HAND_THUMB_AXIS.left));
        bind('rightShoulder', ['shoulderr', 'rightshoulder']);
        bind('rightArm', ['upperarmr', 'rightupperarm', 'rightarm']);
        bind('rightForeArm', ['rightforearm', 'rightlowerarm', 'lowerarmr']);
        bind(
          'rightHand',
          ['righthand', 'handr'],
          new THREE.Vector3(...HUMAN_HAND_THUMB_AXIS.right),
        );
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
          markerRestPosition.set(side, marker.getWorldPosition(new THREE.Vector3()));
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
    const applyHand = (
      key: string,
      orientation: HandOrientation | null,
      fallbackStart: PosePoint | null,
      fallbackEnd: PosePoint | null,
      isNewLandmarkFrame: boolean,
      sampleTime: number,
    ) => {
      const item = rig.get(key);
      if (!item) return;
      const previous = trackedHands.get(key);
      if (!orientation) {
        // A very short hand dropout should not snap the wrist back to the sparse
        // pose landmark. After the grace period, fall back to wrist→index direction.
        if (previous && sampleTime - previous.lastSeen < 0.28) return;
        apply(key, fallbackStart, fallbackEnd, isNewLandmarkFrame, sampleTime);
        return;
      }
      let stable = previous;
      if (!stable) {
        const basis = handBasisQuaternion(orientation.forward, orientation.thumb);
        stable = {
          forward: orientation.forward.clone(),
          thumb: orientation.thumb.clone(),
          normal: orientation.normal.clone(),
          basis,
          confidence: orientation.confidence,
          lastSeen: sampleTime,
        };
        trackedHands.set(key, stable);
      } else if (isNewLandmarkFrame) {
        const elapsed = THREE.MathUtils.clamp(sampleTime - stable.lastSeen, 0.04, 0.25);
        const targetBasis = handBasisQuaternion(orientation.forward, orientation.thumb);
        const angularDistance = stable.basis.angleTo(targetBasis);
        const response = THREE.MathUtils.clamp(
          (1 - Math.exp(-elapsed / 0.055)) *
            (0.64 + orientation.confidence * 0.2) *
            (angularDistance > THREE.MathUtils.degToRad(55) ? 1.12 : 0.78),
          0.42,
          0.86,
        );
        // Filter the complete hand frame, not its axes independently. This preserves
        // the 180° palm/back roll around the hand's forward axis without axis flips.
        stable.basis.slerp(targetBasis, response);
        stable.thumb.set(1, 0, 0).applyQuaternion(stable.basis).normalize();
        stable.forward.set(0, 1, 0).applyQuaternion(stable.basis).normalize();
        stable.normal.crossVectors(stable.forward, stable.thumb).normalize();
        stable.confidence = orientation.confidence;
        stable.lastSeen = sampleTime;
      }

      // Keep the filtered palm basis in world space. Recomputing its local form on
      // every render frame removes the lag previously introduced by the moving forearm.
      const parentQuaternion = new THREE.Quaternion();
      item.bone.parent?.getWorldQuaternion(parentQuaternion);
      const inverseParent = parentQuaternion.invert();
      const targetForward = stable.forward.clone().applyQuaternion(inverseParent).normalize();
      const targetThumb = stable.thumb.clone().applyQuaternion(inverseParent);
      targetThumb.addScaledVector(targetForward, -targetThumb.dot(targetForward)).normalize();
      const sourceBasis = handBasisQuaternion(item.direction, item.secondary);
      const targetBasis = handBasisQuaternion(targetForward, targetThumb);
      const correction = targetBasis.multiply(sourceBasis.invert());
      const wanted = correction.multiply(item.rest);
      item.bone.quaternion.slerp(wanted, isNewLandmarkFrame ? 0.48 : 0.3);
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
        if (Math.abs(difference) < 0.08) {
          // Ground contact is independent from knee flexion. If both ankles remain at
          // nearly the same height, keep both feet planted even while both knees bend.
          footSupport = 'both';
          return;
        }
        // Only a clear height gap changes support to one foot. The dead band prevents
        // landmark noise from alternating the root pivot during a squat.
        if (Math.abs(difference) > 0.14) footSupport = difference > 0 ? 'left' : 'right';
      } else if (leftY !== undefined) footSupport = 'left';
      else if (rightY !== undefined) footSupport = 'right';
    };
    const anchorBodyToSupportFoot = (
      modelLeft: 'left' | 'right',
      modelRight: 'left' | 'right',
      bilateralBend: boolean,
    ) => {
      if (!USE_SUPPORT_FOOT_PIVOT || !avatarRoot) return;
      avatarRoot.updateMatrixWorld(true);
      const active =
        footSupport === 'both'
          ? [modelLeft, modelRight]
          : [footSupport === 'left' ? modelLeft : modelRight];
      const corrections = active.flatMap((modelSide) => {
        const marker = groundMarkers.get(modelSide);
        const rest = markerRestPosition.get(modelSide);
        if (!marker || !rest) return [];
        const current = marker.getWorldPosition(new THREE.Vector3());
        return current.toArray().every(Number.isFinite) ? [rest.clone().sub(current)] : [];
      });
      if (!corrections.length) return;
      const correction = corrections
        .reduce((sum, value) => sum.add(value), new THREE.Vector3())
        .multiplyScalar(1 / corrections.length);
      if (correction.lengthSq() < 0.00000625) return;
      const target = avatarRoot.position.clone().add(correction);
      target.x = THREE.MathUtils.clamp(
        target.x,
        avatarBasePosition.x - 0.48,
        avatarBasePosition.x + 0.48,
      );
      target.y = THREE.MathUtils.clamp(
        target.y,
        avatarBasePosition.y - 0.85,
        avatarBasePosition.y + 0.12,
      );
      target.z = THREE.MathUtils.clamp(
        target.z,
        avatarBasePosition.z - 0.48,
        avatarBasePosition.z + 0.48,
      );
      // The floor root is fixed. Pinning the support marker in all three axes makes
      // the planted leg the pivot, and translates the pelvis/torso around that leg.
      avatarRoot.position.lerp(target, footSupport === 'both' ? (bilateralBend ? 0.34 : 0.2) : 0.3);
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
      const left = modelSideForDisplay('left', mirrored);
      const right = modelSideForDisplay('right', mirrored);
      // Legs follow the requested MediaPipe chains directly:
      // 23 -> 25 -> 27 (left) and 24 -> 26 -> 28 (right).
      // Knee flexion and floor support are intentionally independent: image-space
      // angles drive the bones while planted feet determine the avatar root.
      const imageLandmarks = frameRef.current?.landmarks ?? [];
      const measuredLeftAngle = landmarkAngle(imageLandmarks, [23, 25, 27]);
      const measuredRightAngle = landmarkAngle(imageLandmarks, [24, 26, 28]);
      const leftAngle = resolvedLegAngle(legMotion.left, measuredLeftAngle, isNewLandmarkFrame);
      const rightAngle = resolvedLegAngle(legMotion.right, measuredRightAngle, isNewLandmarkFrame);
      const bilateralBend = isBilateralSquatBend(leftAngle, rightAngle);
      const leftLeg = stabilizeLegFromImage(pose.leftLeg, leftAngle);
      const rightLeg = stabilizeLegFromImage(pose.rightLeg, rightAngle);
      const leftToe = reliableFootTarget(leftLeg[1], leftLeg[2], leftLeg[3]);
      const rightToe = reliableFootTarget(rightLeg[1], rightLeg[2], rightLeg[3]);
      updateFootSupport(pose, isNewLandmarkFrame);
      apply(`${left}Shoulder`, pose.chest, pose.leftArm[0], isNewLandmarkFrame, sampleTime);
      apply(`${left}Arm`, pose.leftArm[0], pose.leftArm[1], isNewLandmarkFrame, sampleTime);
      apply(`${left}ForeArm`, pose.leftArm[1], pose.leftArm[2], isNewLandmarkFrame, sampleTime);
      applyHand(
        `${left}Hand`,
        getHandOrientation(frameRef.current, 'left', mirrored),
        pose.leftArm[2],
        pose.leftArm[3],
        isNewLandmarkFrame,
        sampleTime,
      );
      apply(`${right}Shoulder`, pose.chest, pose.rightArm[0], isNewLandmarkFrame, sampleTime);
      apply(`${right}Arm`, pose.rightArm[0], pose.rightArm[1], isNewLandmarkFrame, sampleTime);
      apply(`${right}ForeArm`, pose.rightArm[1], pose.rightArm[2], isNewLandmarkFrame, sampleTime);
      applyHand(
        `${right}Hand`,
        getHandOrientation(frameRef.current, 'right', mirrored),
        pose.rightArm[2],
        pose.rightArm[3],
        isNewLandmarkFrame,
        sampleTime,
      );
      apply(`${left}UpLeg`, leftLeg[0], leftLeg[1], isNewLandmarkFrame, sampleTime);
      apply(`${left}Leg`, leftLeg[1], leftLeg[2], isNewLandmarkFrame, sampleTime);
      apply(`${left}Foot`, leftLeg[2], leftToe, isNewLandmarkFrame, sampleTime, true);
      apply(`${right}UpLeg`, rightLeg[0], rightLeg[1], isNewLandmarkFrame, sampleTime);
      apply(`${right}Leg`, rightLeg[1], rightLeg[2], isNewLandmarkFrame, sampleTime);
      apply(`${right}Foot`, rightLeg[2], rightToe, isNewLandmarkFrame, sampleTime, true);
      anchorBodyToSupportFoot(left, right, bilateralBend);
      if (appliedView !== viewRef.current || appliedPresetRequest !== presetRequestRef.current) {
        appliedView = viewRef.current;
        appliedPresetRequest = presetRequestRef.current;
        presetPosition.set(...CAMERA_POSITIONS[appliedView]);
        presetActive = true;
      }
      if (presetActive) {
        camera.position.lerp(presetPosition, 0.16);
        controls.target.lerp(orbitTarget, 0.18);
        if (camera.position.distanceToSquared(presetPosition) < 0.0001) {
          camera.position.copy(presetPosition);
          controls.target.copy(orbitTarget);
          presetActive = false;
        }
      }
      controls.update();
      renderer.render(scene, camera);
      animation = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      disposed = true;
      cancelAnimationFrame(animation);
      observer.disconnect();
      controls.removeEventListener('start', stopPreset);
      controls.dispose();
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
                  presetRequestRef.current += 1;
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
