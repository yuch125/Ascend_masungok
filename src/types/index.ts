export type Tab = 'home' | 'records' | 'community' | 'more';
export type BodyArea = 'knee' | 'shoulder' | 'elbow' | 'other';
export type SymptomProfile = {
  description: string;
  areas: BodyArea[];
  side: 'left' | 'right' | 'both' | 'unsure';
  professionalGuidance: boolean;
  updatedAt: string;
};
export type Preferences = { saveOriginal: boolean };
export type Side = 'left' | 'right';
export type Goal = {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'achieved';
  primary: boolean;
  createdAt: string;
};
export type Exercise = {
  id: string;
  name: string;
  subtitle: string;
  bodyPart: string;
  duration: string;
  instructions: string[];
  cameraDirection: string;
  precautions: string;
  referenceUrl: string;
  joints: Record<Side, [number, number, number]>;
  jointName: string;
  repThresholds?: [number, number];
  color: string;
};
export type Plan = {
  id: string;
  exerciseId: string;
  sets: number;
  repetitions: number;
  frequency: string;
  notes: string;
  source: 'reference' | 'personal';
  confirmed: boolean;
  days?: number[];
  targetAngle?: number;
  diagnosisName?: string;
};
export type Landmark = { x: number; y: number; z: number; visibility: number; presence?: number };
/** MediaPipe indices are preserved; excluded face slots 0–10 contain null. */
export type PoseLandmarks = (Landmark | null)[];
export type Frame = {
  time: number;
  angle: number | null;
  /** Image-normalized landmarks used for the video overlay and 2D angle measurement. */
  landmarks: PoseLandmarks;
  /** MediaPipe metric 3D coordinates used for avatar retargeting when available. */
  worldLandmarks?: PoseLandmarks;
};
export type Analysis = {
  min: number;
  max: number;
  range: number;
  validRatio: number;
  validFrames: number;
  totalFrames: number;
  repetitions: number | null;
  frames: Frame[];
};
export type Session = {
  id: string;
  exerciseId: string;
  recordedAt: string;
  duration: number;
  side: Side;
  cameraDirection: string;
  /** True when the capture preview used a front-facing mirrored camera. */
  mirrored?: boolean;
  version: string;
  analysis: Analysis;
  mediaId?: string;
};
export type CaptureRecord = {
  id: string;
  exerciseId: string;
  recordedAt: string;
  duration: number;
  side: Side;
  cameraDirection: string;
  /** Keeps live and recorded 3D playback on the same visual left/right convention. */
  mirrored?: boolean;
  mediaId?: string;
  status: 'pending' | 'ready' | 'failed';
  error?: string;
  frames?: Frame[];
};
export type SharedRecord = {
  exerciseName?: string;
  date?: string;
  range?: number;
  difference?: number;
};
export type Comment = {
  id: string;
  userId: string;
  nickname: string;
  content: string;
  createdAt: string;
};
export type Post = {
  id: string;
  userId: string;
  nickname: string;
  content: string;
  createdAt: string;
  shared: SharedRecord;
  mediaId?: string;
  mediaType?: string;
  likes: string[];
  comments: Comment[];
};
export type AppData = {
  captures: CaptureRecord[];
  symptoms: SymptomProfile | null;
  preferences: Preferences;
  goals: Goal[];
  plans: Plan[];
  sessions: Session[];
  posts: Post[];
  nickname: string;
};
