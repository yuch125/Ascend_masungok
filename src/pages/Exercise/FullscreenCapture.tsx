import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ChevronDown,
  Download,
  ImagePlus,
  LoaderCircle,
  Play,
  RotateCcw,
  Share2,
  SwitchCamera,
  Trash2,
  Box,
  X,
} from 'lucide-react';
import type { CaptureRecord, Exercise, Frame, Session, Side } from '../../types';
import { createId } from '../../utils/id';
import { useCamera } from '../../features/camera/useCamera';
import { useLivePose } from '../../features/camera/useLivePose';
import {
  recordingMime,
  createVideoRecorder,
  resampleCaptureFrames,
  sessionFromCapture,
  videoFile,
} from '../../features/camera/recording';
import type { CaptureShare } from '../../features/camera/recording';
import { analyzeBlob } from '../../features/pose-analysis/analyze';
import { ANALYSIS_VERSION } from '../../features/pose-analysis/math';
import { readMedia } from '../../services/local';
import { VideoOverlay } from '../../components/VideoOverlay';
const PoseAvatar3D = lazy(() =>
  import('../../components/PoseAvatar3D').then(({ PoseAvatar3D: Avatar }) => ({ default: Avatar })),
);

export default function FullscreenCapture({
  exercise,
  onBack,
  onSave,
  onShare,
  onCaptureSaved,
  onAnalysisComplete,
  onChooseExercise,
  onDelete,
  autoConnect = false,
  consentGranted = false,
  initialSide = 'left',
  keepVideoDefault = true,
  initialCapture,
  userId = 'local-demo',
}: {
  exercise: Exercise;
  sessions?: Session[];
  onBack: () => void;
  onSave: (session: Session, blob?: Blob) => Promise<void>;
  onShare: (draft: CaptureShare) => void;
  onCaptureSaved?: (capture: CaptureRecord, blob?: Blob) => Promise<void>;
  onAnalysisComplete?: (session: Session) => void;
  onChooseExercise?: () => void;
  onDelete?: (capture: CaptureRecord) => void;
  autoConnect?: boolean;
  consentGranted?: boolean;
  initialSide?: Side;
  keepVideoDefault?: boolean;
  initialCapture?: CaptureRecord;
  userId?: string;
}) {
  const camera = useCamera(),
    [side, setSide] = useState<Side>(initialCapture?.side ?? initialSide),
    [mode, setMode] = useState<'camera' | 'review'>(initialCapture ? 'review' : 'camera'),
    [recording, setRecording] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [needsPlay, setNeedsPlay] = useState(false);
  const [capture, setCapture] = useState<CaptureRecord | undefined>(initialCapture),
    [blob, setBlob] = useState<Blob>(),
    [url, setUrl] = useState(''),
    [session, setSession] = useState<Session>(),
    [error, setError] = useState(''),
    [progress, setProgress] = useState<number | null>(null),
    [saved, setSaved] = useState(false),
    [showAvatar, setShowAvatar] = useState(() => !navigator.userAgent.includes('jsdom')),
    [liveFrame, setLiveFrame] = useState<Frame>(),
    [reviewFrame, setReviewFrame] = useState<Frame>();
  const videoRef = useRef<HTMLVideoElement>(null),
    canvasRef = useRef<HTMLCanvasElement>(null),
    fileRef = useRef<HTMLInputElement>(null),
    recorderRef = useRef<MediaRecorder | null>(null),
    started = useRef<number | null>(null),
    ended = useRef<number | null>(null),
    samples = useRef<Frame[]>([]),
    recordDate = useRef(''),
    recordTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    controller = useRef<AbortController | null>(null),
    mounted = useRef(true),
    analysisRun = useRef(0);
  const live = useLivePose(
    videoRef,
    canvasRef,
    mode === 'camera' ? camera.stream : undefined,
    exercise,
    side,
    camera.facing === 'user',
    (frame, clock) => {
      if (
        started.current !== null &&
        clock >= started.current &&
        (ended.current === null || clock <= ended.current)
      )
        samples.current.push({ ...frame, time: (clock - started.current) / 1000 });
      setLiveFrame(frame);
    },
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
      clearTimeout(recordTimer.current);
      if (recorderRef.current?.state === 'recording') {
        ended.current = performance.now();
        recorderRef.current.stop();
      }
    };
  }, []);
  useEffect(() => {
    if (!autoConnect || !consentGranted || initialCapture) return;
    const timer = setTimeout(() => void camera.connect(), 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !camera.stream || mode !== 'camera') return;
    let active = true;
    video.srcObject = camera.stream;
    video.muted = true;
    video
      .play()
      .then(() => {
        if (active) setNeedsPlay(false);
      })
      .catch(() => {
        if (active) setNeedsPlay(true);
      });
    return () => {
      active = false;
      video.pause();
      video.srcObject = null;
    };
  }, [camera.stream, mode]);
  useEffect(() => {
    if (!blob) {
      setUrl('');
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  useEffect(() => {
    if (!recording) return;
    const backgrounded = () => {
      if (document.visibilityState === 'hidden') stopRecording();
    };
    document.addEventListener('visibilitychange', backgrounded);
    const tick = setInterval(() => {
      if (started.current !== null) setElapsed((performance.now() - started.current) / 1000);
    }, 200);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', backgrounded);
    };
  }, [recording]);
  useEffect(() => {
    if (!initialCapture?.mediaId) return;
    let active = true;
    readMedia(userId, initialCapture.mediaId)
      .then((media) => {
        if (!active) return;
        if (!media) {
          setError('이 기기에 원본 영상이 없어요.');
          return;
        }
        setBlob(media);
        setSaved(true);
        void analyze(media, initialCapture, initialCapture.frames ?? []);
      })
      .catch(() => {
        if (active) setError('영상을 불러오지 못했어요.');
      });
    return () => {
      active = false;
    };
  }, []);

  async function analyze(media: Blob, record: CaptureRecord, liveFrames: Frame[] = []) {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const run = ++analysisRun.current;
    setProgress(0);
    setError('');
    setSession(undefined);
    try {
      let next: Session;
      try {
        if (record.duration < 0.5) throw new Error('영상이 너무 짧아요.');
        next = sessionFromCapture(
          record,
          exercise,
          resampleCaptureFrames(liveFrames, record.duration),
        );
      } catch {
        const result = await analyzeBlob(
          media,
          exercise,
          record.side,
          (value) => {
            if (mounted.current && run === analysisRun.current) setProgress(value);
          },
          abort.signal,
          record.duration > 0 ? record.duration : undefined,
        );
        next = {
          id: record.id,
          exerciseId: exercise.id,
          recordedAt: record.recordedAt,
          duration: result.duration,
          side: record.side,
          cameraDirection: record.cameraDirection,
          mirrored: record.mirrored,
          version: ANALYSIS_VERSION,
          analysis: result.analysis,
          mediaId: record.mediaId,
        };
      }
      if (abort.signal.aborted || !mounted.current || run !== analysisRun.current) return;
      setSession(next);
      setProgress(null);
      await onSave(next);
      if (abort.signal.aborted || run !== analysisRun.current) return;
      const ready = {
        ...record,
        duration: next.duration,
        status: 'ready' as const,
        frames: next.analysis.frames,
        error: undefined,
      };
      if (record.mediaId) await onCaptureSaved?.(ready);
      if (mounted.current && run === analysisRun.current) {
        setCapture(ready);
        setSaved(true);
        onAnalysisComplete?.(next);
      }
    } catch (cause) {
      if (abort.signal.aborted || run !== analysisRun.current) return;
      const message = cause instanceof Error ? cause.message : '분석을 완료하지 못했어요.';
      const failed = { ...record, status: 'failed' as const, error: message, frames: liveFrames };
      if (record.mediaId) await onCaptureSaved?.(failed).catch(() => {});
      if (mounted.current) {
        setError(message);
        setCapture(failed);
        setProgress(null);
      }
    }
  }
  async function finish(media: Blob, seconds: number, frames: Frame[], recordedAt: string) {
    const record: CaptureRecord = {
      id: createId(),
      exerciseId: exercise.id,
      recordedAt,
      duration: Math.max(0.01, seconds),
      side,
      cameraDirection: exercise.cameraDirection,
      mirrored: camera.facing === 'user',
      status: 'pending',
      frames: resampleCaptureFrames(frames, seconds),
    };
    record.mediaId = keepVideoDefault ? record.id : undefined;
    if (mounted.current) {
      setMode('review');
      setRecording(false);
      setBlob(media);
      setCapture(record);
      setSession(undefined);
      setError('');
      setProgress(0);
    }
    if (mounted.current) camera.stop();
    try {
      if (keepVideoDefault) await onCaptureSaved?.(record, media);
      if (mounted.current) setSaved(keepVideoDefault);
    } catch {
      if (mounted.current)
        setError('기기 저장에 실패했어요. 영상은 공유하거나 내려받을 수 있어요.');
    }
    if (mounted.current) void analyze(media, record, record.frames);
  }
  function startRecording() {
    setError('');
    if (!camera.stream) {
      void camera.connect();
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      setError('이 브라우저에서는 영상 불러오기를 이용해 주세요.');
      return;
    }
    try {
      const mimeType = recordingMime(),
        rec = createVideoRecorder(camera.stream),
        chunks: BlobPart[] = [];
      let bytes = 0;
      samples.current = [];
      started.current = performance.now();
      ended.current = null;
      recordDate.current = new Date().toISOString();
      recorderRef.current = rec;
      setElapsed(0);
      rec.ondataavailable = (event) => {
        if (event.data.size) {
          chunks.push(event.data);
          bytes += event.data.size;
        }
        if (bytes >= 18 * 1024 * 1024 && rec.state === 'recording') {
          ended.current = performance.now();
          rec.stop();
        }
      };
      rec.onerror = () => {
        if (mounted.current) setError('촬영이 중단됐어요.');
      };
      rec.onstop = () => {
        clearTimeout(recordTimer.current);
        const stop = ended.current ?? performance.now(),
          seconds = (stop - (started.current ?? stop)) / 1000;
        const frames = samples.current.filter((frame) => frame.time <= seconds + 0.05);
        started.current = null;
        ended.current = null;
        const media = new Blob(chunks, { type: rec.mimeType || mimeType || 'video/webm' });
        if (!media.size) {
          camera.stop();
          if (mounted.current) {
            setRecording(false);
            setError('촬영된 영상이 없어요. 다시 촬영해 주세요.');
          }
          return;
        }
        void finish(media, seconds, frames, recordDate.current);
      };
      rec.start(250);
      setRecording(true);
      recordTimer.current = setTimeout(stopRecording, 180000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '촬영을 시작하지 못했어요.');
    }
  }
  function stopRecording() {
    const rec = recorderRef.current;
    if (rec?.state === 'recording') {
      ended.current = performance.now();
      rec.stop();
      setRecording(false);
    }
  }
  async function selectFile(file?: File) {
    if (!file) return;
    if (file.size > 250 * 1024 * 1024) {
      setError('250MB 이하 영상을 선택해 주세요.');
      return;
    }
    if (!file.type.startsWith('video/') && !/\.(mp4|webm|mov|m4v)$/i.test(file.name)) {
      setError('동영상 파일을 선택해 주세요.');
      return;
    }
    camera.stop();
    const record: CaptureRecord = {
      id: createId(),
      exerciseId: exercise.id,
      recordedAt: new Date().toISOString(),
      duration: 0,
      side,
      cameraDirection: exercise.cameraDirection,
      mirrored: false,
      status: 'pending',
    };
    record.mediaId = keepVideoDefault ? record.id : undefined;
    setBlob(file);
    setCapture(record);
    setMode('review');
    setError('');
    if (keepVideoDefault)
      try {
        await onCaptureSaved?.(record, file);
        setSaved(true);
      } catch {
        setError('기기에 영상을 저장하지 못했어요.');
      }
    void analyze(file, record);
  }
  function retake() {
    controller.current?.abort();
    analysisRun.current++;
    setProgress(null);
    setError('');
    setSession(undefined);
    setCapture(undefined);
    setBlob(undefined);
    setSaved(false);
    setMode('camera');
    void camera.connect();
  }
  function download() {
    if (!blob) return;
    const file = videoFile(blob),
      link = document.createElement('a'),
      objectUrl = URL.createObjectURL(file);
    link.href = objectUrl;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
  async function externalShare() {
    if (!blob) return;
    const file = videoFile(blob);
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({ files: [file], title: exercise.name });
      } catch (cause) {
        if ((cause as { name?: string }).name !== 'AbortError') download();
      }
    } else download();
  }
  const displayedError =
      error ||
      (mode === 'camera' ? camera.error || (live.state === 'error' ? live.error : '') : ''),
    clock = `${Math.floor(elapsed / 60)
      .toString()
      .padStart(2, '0')}:${Math.floor(elapsed % 60)
      .toString()
      .padStart(2, '0')}`;
  return (
    <section className="capture-app" aria-label="전체 화면 운동 카메라">
      {mode === 'camera' ? (
        <div className="capture-viewport">
          <video
            ref={videoRef}
            className={camera.facing === 'user' ? 'selfie-video' : ''}
            autoPlay
            muted
            playsInline
            aria-label="실시간 카메라 미리보기"
          />
          <canvas ref={canvasRef} className="live-pose-canvas" aria-label="실시간 관절 오버레이" />
          {showAvatar && (
            <Suspense fallback={<div className="pose-avatar-loading">3D 모델 준비 중…</div>}>
              <PoseAvatar3D
                frame={liveFrame}
                exercise={exercise}
                side={side}
                mirrored={camera.facing === 'user'}
                compact
              />
            </Suspense>
          )}
          {!camera.stream && (
            <div className="camera-connect-center">
              {camera.connecting ? (
                <>
                  <LoaderCircle className="spin" size={32} />
                  <span>카메라 연결 중</span>
                  <button onClick={camera.stop}>취소</button>
                </>
              ) : (
                <>
                  <Camera size={40} />
                  <button
                    onClick={() => {
                      setError('');
                      void camera.connect();
                    }}
                  >
                    카메라 연결
                  </button>
                </>
              )}
            </div>
          )}
          {needsPlay && camera.stream && (
            <button
              className="camera-tap-play"
              onClick={() =>
                void videoRef.current
                  ?.play()
                  .then(() => setNeedsPlay(false))
                  .catch(() => setNeedsPlay(true))
              }
            >
              <Play size={24} /> 화면 시작
            </button>
          )}
        </div>
      ) : (
        <div className="capture-review-player">
          {url && (
            <VideoOverlay
              url={url}
              exercise={exercise}
              side={capture?.side ?? side}
              mirrored={capture?.mirrored ?? false}
              frames={session?.analysis.frames ?? capture?.frames ?? []}
              onPoseFrame={setReviewFrame}
            />
          )}
          {showAvatar && (
            <Suspense fallback={<div className="pose-avatar-loading">3D 모델 준비 중…</div>}>
              <PoseAvatar3D
                frame={reviewFrame}
                exercise={exercise}
                side={capture?.side ?? side}
                mirrored={capture?.mirrored ?? false}
                compact
              />
            </Suspense>
          )}
        </div>
      )}
      <header className="camera-app-header">
        <button
          aria-label="촬영 화면 닫기"
          onClick={() => (recording ? stopRecording() : onBack())}
        >
          <X size={25} />
        </button>
        <button
          className="camera-exercise-title"
          disabled={recording}
          onClick={() => {
            if (!recording) onChooseExercise?.();
          }}
        >
          <strong>{exercise.name}</strong>
          <span>
            {exercise.cameraDirection} 촬영 {mode === 'camera' && <ChevronDown size={12} />}
          </span>
        </button>
        <span className="camera-header-spacer" />
        <button
          className="camera-avatar-toggle"
          aria-label="3D 자세 보기 전환"
          aria-pressed={showAvatar}
          onClick={() => setShowAvatar((value) => !value)}
        >
          <Box size={20} />
        </button>
      </header>
      {mode === 'camera' && camera.stream && (
        <div className="camera-live-badges">
          <span className={recording ? 'recording-clock' : ''}>
            {recording ? (
              <>
                <i />
                {clock}
              </>
            ) : live.state === 'loading' ? (
              <>
                <LoaderCircle size={13} className="spin" /> 관절 추적 준비
              </>
            ) : live.state === 'searching' ? (
              '사람을 찾는 중'
            ) : live.state === 'error' ? (
              '관절 추적 꺼짐'
            ) : (
              '실시간 관절 추적'
            )}
          </span>
          {live.angle !== null && (
            <strong>
              {exercise.jointName} {live.angle.toFixed(0)}°
            </strong>
          )}
        </div>
      )}
      {displayedError && (
        <div className="camera-error" role="alert">
          <p>{displayedError}</p>
          <button
            onClick={() => {
              setError('');
              if (mode === 'review' && blob && capture) void analyze(blob, capture);
              else if (live.state === 'error' && camera.stream) live.retry();
              else if (mode === 'camera') void camera.connect();
            }}
          >
            다시 시도
          </button>
        </div>
      )}
      <input
        type="file"
        hidden
        ref={fileRef}
        accept="video/*"
        aria-label="운동 영상 선택"
        onChange={(event) => {
          void selectFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {mode === 'camera' ? (
        <footer className="camera-app-controls">
          {live.state === 'error' && camera.stream && (
            <button className="live-analysis-retry" onClick={live.retry}>
              관절 추적 다시 연결
            </button>
          )}
          <div className="camera-guidance">
            <span>{exercise.cameraDirection}</span>
            <button
              disabled={recording}
              onClick={() => {
                if (!recording) setSide(side === 'left' ? 'right' : 'left');
              }}
            >
              {side === 'left' ? '왼쪽' : '오른쪽'} {exercise.jointName}
            </button>
          </div>
          <div className="camera-shutter-row">
            <button
              className="camera-gallery"
              disabled={recording}
              aria-label="영상 불러오기"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus size={25} />
            </button>
            <button
              className={`camera-shutter ${recording ? 'is-recording' : ''}`}
              aria-label={recording ? '촬영 종료' : '촬영 시작'}
              onClick={() => (recording ? stopRecording() : startRecording())}
            >
              <span />
            </button>
            <button
              className="camera-flip"
              disabled={recording}
              aria-label="전면 후면 전환"
              onClick={() => {
                if (!recording)
                  void camera.connect(camera.facing === 'user' ? 'environment' : 'user');
              }}
            >
              <SwitchCamera size={26} />
            </button>
          </div>
          <span className="camera-mode-label">동영상</span>
        </footer>
      ) : (
        <footer className="capture-review-controls">
          <div className="capture-result-line">
            {progress !== null ? (
              <span>
                <LoaderCircle className="spin" size={15} /> 분석 중 {progress ? `${progress}%` : ''}
              </span>
            ) : session ? (
              <>
                <strong>
                  {exercise.jointName} 범위 {session.analysis.range.toFixed(1)}°
                </strong>
                <span>
                  {session.analysis.min.toFixed(1)}°–{session.analysis.max.toFixed(1)}°
                </span>
              </>
            ) : (
              <span>영상 준비 완료</span>
            )}
            {saved && (
              <small>
                <Check size={12} /> 기기 저장
              </small>
            )}
          </div>
          <div className="capture-share-actions">
            <button className="capture-retake" onClick={retake}>
              <RotateCcw size={18} /> 다시 촬영
            </button>
            <button
              className="capture-post"
              disabled={!blob || !capture}
              onClick={() => {
                if (blob && capture) onShare({ blob, capture, session });
              }}
            >
              <Share2 size={18} /> 게시물 만들기
            </button>
            <button
              className="capture-external"
              disabled={!blob}
              aria-label="영상 외부 공유 또는 다운로드"
              onClick={() => void externalShare()}
            >
              <Download size={21} />
            </button>
          </div>
          <button className="capture-back-home" onClick={onBack}>
            홈으로
          </button>
          {capture && onDelete && (
            <button
              className="capture-delete"
              onClick={() => {
                controller.current?.abort();
                analysisRun.current++;
                onDelete(capture);
              }}
            >
              <Trash2 size={14} /> 이 기록 삭제
            </button>
          )}
        </footer>
      )}
    </section>
  );
}
