export type CameraFacing = 'user' | 'environment';

function cameraError(name: string) {
  const error = new Error(name);
  error.name = name;
  return error;
}

export async function requestCamera(facing: CameraFacing): Promise<MediaStream> {
  if (window.isSecureContext === false) throw cameraError('InsecureContextError');
  if (!navigator.mediaDevices?.getUserMedia) throw cameraError('UnsupportedCameraError');
  const doc = document as Document & {
    permissionsPolicy?: { allowsFeature: (name: string) => boolean };
    featurePolicy?: { allowsFeature: (name: string) => boolean };
  };
  const policy = doc.permissionsPolicy ?? doc.featurePolicy;
  if (policy && !policy.allowsFeature('camera')) throw cameraError('CameraPolicyError');
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
  } catch (error) {
    // Some webcams reject optional resolution/facing constraints. Keep permission
    // denials intact; only retry constraints that the camera cannot satisfy.
    if ((error as { name?: string })?.name === 'OverconstrainedError') {
      return navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    }
    throw error;
  }
}

export function cameraErrorMessage(error: unknown): string {
  switch ((error as { name?: string })?.name) {
    case 'InsecureContextError':
      return '이 주소는 HTTP라 실시간 카메라를 사용할 수 없어요. 아이패드·휴대폰에서는 HTTPS 주소로 접속하세요. PC에서는 http://localhost:5173을 사용할 수 있어요. 영상 불러오기는 이용할 수 있어요.';
    case 'CameraPolicyError':
      return '현재 앱 안의 미리보기에서 카메라가 차단되어 있어요. 이 페이지를 Chrome 또는 Safari의 새 탭에서 직접 열어 주세요.';
    case 'UnsupportedCameraError':
      return '현재 브라우저가 실시간 카메라를 지원하지 않아요. Safari 또는 Chrome에서 직접 열거나 영상 불러오기를 이용해 주세요.';
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return '카메라 권한이 차단되어 있어요. 주소창의 사이트 설정에서 카메라를 허용하고, 휴대폰·PC 설정에서도 이 브라우저의 카메라 접근을 허용한 뒤 다시 연결해 주세요.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return '사용할 카메라를 찾지 못했어요. 카메라 연결을 확인하거나 영상 불러오기를 이용해 주세요.';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return '다른 앱이 카메라를 사용 중이거나 기기에서 접근을 막고 있어요. 화상회의·카메라 앱을 종료하고 기기의 카메라 설정을 확인한 뒤 다시 연결해 주세요.';
    case 'SecurityError':
      return '이 브라우저 또는 기기 설정에서 카메라 사용이 제한되어 있어요. 카메라 접근 설정을 확인하거나 다른 브라우저에서 열어 주세요.';
    case 'OverconstrainedError':
      return '이 카메라에서 촬영을 시작하지 못했어요. 다른 카메라를 선택하거나 휴대폰 카메라 촬영을 이용해 주세요.';
    default:
      return '카메라를 연결하지 못했어요. 다시 연결하거나 휴대폰 카메라 촬영·영상 불러오기를 이용해 주세요.';
  }
}

export function releaseCamera(stream?: MediaStream) {
  stream?.getTracks().forEach((track) => track.stop());
}
