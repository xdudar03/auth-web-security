import { useEffect, useRef, useState } from 'react';
import { User, useUser } from '@/hooks/useUserContext';
import cropImage, {
  grayscaleImage,
  imageToMatrix,
} from '@/lib/anonymization/anonimizationImage';
import {
  dpSvdEmbeddingFromFlattened,
  dpSvdReconstructFromFlattened,
  type DpSvdOptions,
} from '@/lib/anonymization/dpSvd';
import { useTRPC } from '@/hooks/TrpcContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import useJwt from '@/hooks/useJwt';
import { ensureEncryptedDataAccessForLogin } from '@/hooks/useAuth';
import type { FeedbackMessage } from '../components/authentication/biometric/BiometricAlerts';
import { getUserHpkeBundle } from '@/lib/encryption/encryption';
import { Matrix } from 'ml-matrix';
import {
  getProjectionMatrix,
  l2NormalizeVector,
} from '@/lib/encryption/randomProjection';

type CapturedFrame = {
  data: Uint8ClampedArray;
  imageUrl: string;
};

type UseBiometricCaptureParams = {
  action: string;
  username: string;
  recoveryPassphrase?: string;
  // isModelTraining: boolean;
  // isModelStatusLoading: boolean;
  // isModelStatusError: boolean;
  anonymizeImage: boolean;
};

type VerificationPhase =
  | 'idle'
  | 'capturing'
  | 'processing'
  | 'verifying'
  | 'unlocking';

const TARGET_SIZE = 100;
const LOGIN_STREAM_FRAME_COUNT = 3;
const ENROLL_STREAM_FRAME_COUNT = 11;
const STREAM_INTERVAL_MS = 50;
const DP_SVD_OPTIONS: DpSvdOptions = {
  epsilon: 0.4,
  nSingularValues: 15,
  imageSize: [TARGET_SIZE, TARGET_SIZE],
  blockSize: 25,
};
const RP_TARGET_DIMENSION = 1024;
const RP_VERSION = 'rp-v1';
const BIOMETRIC_TIMING_LOGS_ENABLED =
  process.env.NEXT_PUBLIC_BIOMETRIC_TIMING_LOGS !== 'false';

const COMPARISON_ENABLED = true;

const timingMs = (startedAt: number) =>
  Math.round((performance.now() - startedAt) * 100) / 100;

const logTiming = (event: string, metrics: Record<string, unknown>) => {
  if (!BIOMETRIC_TIMING_LOGS_ENABLED) return;
  const payload = Object.entries(metrics)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
  console.info(`[timing][${event}] ${payload}`.trim());
};

const createImageUrlFromPixels = (
  pixels: number[],
  size: number
): string | undefined => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return undefined;
  }

  const minVal = Math.min(...pixels);
  const maxVal = Math.max(...pixels);
  const range = maxVal - minVal;
  const imageData = ctx.createImageData(size, size);

  for (let i = 0; i < pixels.length; i++) {
    const normalized = range > 0 ? ((pixels[i] - minVal) / range) * 255 : 0;
    const value = Math.round(normalized);
    const index = i * 4;
    imageData.data[index] = value;
    imageData.data[index + 1] = value;
    imageData.data[index + 2] = value;
    imageData.data[index + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const selectComparisonFrames = (
  projectedProjections: number[][],
  maxFrames = 3
) => {
  if (projectedProjections.length <= maxFrames) {
    return projectedProjections;
  }
  const picked: number[][] = [];
  const lastIndex = projectedProjections.length - 1;
  for (let i = 0; i < maxFrames; i += 1) {
    const idx = Math.round((i * lastIndex) / (maxFrames - 1));
    picked.push(projectedProjections[idx]);
  }
  return picked;
};

export default function useBiometricCapture({
  action,
  username,
  recoveryPassphrase,
  // isModelTraining,
  // isModelStatusLoading,
  // isModelStatusError,
  anonymizeImage,
}: UseBiometricCaptureParams) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCapturingStream, setIsCapturingStream] = useState(false);
  const [isOvalVisible, setIsOvalVisible] = useState(false);
  const [capturedImage, setCapturedImage] = useState<Uint8ClampedArray | null>(
    null
  );
  const [capturedImageUrl, setCapturedImageUrl] = useState<string>();
  const [reconstructedImageUrl, setReconstructedImageUrl] = useState<string>();
  const [feedbackMessage, setFeedbackMessage] =
    useState<FeedbackMessage | null>(null);
  const [verificationPhase, setVerificationPhase] =
    useState<VerificationPhase>('idle');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ovalRef = useRef<SVGEllipseElement | null>(null);
  const { user } = useUser();
  const { setJwt } = useJwt();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const register = useMutation(
    trpc.user.register.mutationOptions({
      onError: (error) => {
        console.error('error', error);
      },
    })
  );
  const authenticate = useMutation(trpc.user.authenticate.mutationOptions());
  const verify = useMutation(
    trpc.model.verify.mutationOptions({
      onError: (error) => {
        console.error('error', error);
      },
    })
  );
  const changeEmbedding = useMutation(
    trpc.biometric.changeEmbedding.mutationOptions({
      onError: (error) => {
        console.error('error', error);
      },
    })
  );
  const predictCompare = useMutation(
    trpc.model.predictCompare.mutationOptions({
      onError: (error) => {
        console.error('error', error);
      },
    })
  );
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => stopCamera, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  }

  const runBiometricAction = async (payload: User & { embedding: string }) => {
    if (action === 'login') {
      const actionStartedAt = performance.now();
      // if (isModelTraining) {
      //   throw new Error(
      //     'Biometric model training is in progress. Please try again shortly.'
      //   );
      // }
      if (!username) {
        throw new Error('Username is required');
      }
      const parsed = JSON.parse(payload.embedding);
      const embeddingBatch = Array.isArray(parsed[0]) ? parsed : [parsed];
      const hpkeBundleStartedAt = performance.now();
      const hpkeBundle = await getUserHpkeBundle(username);
      const hpkeBundleMs = timingMs(hpkeBundleStartedAt);

      setVerificationPhase('verifying');
      const verifyStartedAt = performance.now();
      const response = await verify.mutateAsync({
        embedding: JSON.stringify(embeddingBatch),
        username,
        hpkePublicKeyB64: hpkeBundle?.publicKeyB64,
      });
      const verifyMs = timingMs(verifyStartedAt);
      if (!response.verified || !response.jwt) {
        throw new Error('Biometric verification failed');
      }

      setVerificationPhase('unlocking');
      const unlockStartedAt = performance.now();
      const encryptedAccess = await ensureEncryptedDataAccessForLogin({
        username,
        recoveryPassphrase,
        hpkePublicKeyB64: response.hpkePublicKeyB64 ?? null,
        recoverySaltB64: response.recoverySaltB64 ?? null,
        encryptedPrivateKey: response.encryptedPrivateKey ?? null,
        encryptedPrivateKeyIv: response.encryptedPrivateKeyIv ?? null,
      });
      const unlockMs = timingMs(unlockStartedAt);

      if (!encryptedAccess.hasAccess) {
        throw new Error(
          encryptedAccess.message ??
            'Encrypted profile data is locked on this device. Enter your recovery passphrase once and retry biometric login.'
        );
      }

      queryClient.clear();
      setJwt(response.jwt);
      logTiming('biometric_login_action', {
        frames: embeddingBatch.length,
        hpke_bundle_ms: hpkeBundleMs,
        verify_api_ms: verifyMs,
        unlock_ms: unlockMs,
        total_ms: timingMs(actionStartedAt),
      });
    } else if (action === 'change') {
      await changeEmbedding.mutateAsync({
        embedding: payload.embedding ?? '',
      });
      setFeedbackMessage({
        type: 'success',
        text: 'Biometric registered. Model training has started; biometric login will be available once training finishes.',
      });
    }
  };

  const captureFrame = async (): Promise<CapturedFrame | null> => {
    if (!videoRef.current || !ovalRef.current) {
      return null;
    }

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const videoRect = video.getBoundingClientRect();
    if (videoRect.width === 0 || videoRect.height === 0) {
      return null;
    }

    grayscaleImage(ctx, canvas);
    const cropResult = cropImage(
      canvas,
      videoRect,
      ovalRef.current.getBoundingClientRect(),
      TARGET_SIZE
    );
    if (!cropResult) {
      return null;
    }

    return {
      data: cropResult.imageData.data,
      imageUrl: cropResult.imageUrl,
    };
  };

  const captureStream = async (
    frameCount: number,
    interval: number
  ): Promise<CapturedFrame[]> => {
    const frames: CapturedFrame[] = [];
    for (let i = 0; i < frameCount; i += 1) {
      const frame = await captureFrame();
      if (frame) {
        frames.push(frame);
      }
      if (i < frameCount - 1) {
        await sleep(interval);
      }
    }
    return frames;
  };

  const anonymizeFrames = (flattenedFrames: number[][]) => {
    const projections = flattenedFrames
      .map((flattened, index) => {
        try {
          return dpSvdEmbeddingFromFlattened(flattened, DP_SVD_OPTIONS);
        } catch (error) {
          console.error(`DP-SVD embedding failed for frame ${index}`, error);
          return null;
        }
      })
      .filter((projection): projection is number[] => projection !== null);
    return projections;
  };

  const handleCaptureClick = async () => {
    if (isCameraActive) {
      const captureFlowStartedAt = performance.now();
      setVerificationPhase('capturing');
      setIsCapturingStream(true);
      const frameCount =
        action === 'login'
          ? LOGIN_STREAM_FRAME_COUNT
          : ENROLL_STREAM_FRAME_COUNT;
      const streamStartedAt = performance.now();
      const frames = await captureStream(frameCount, STREAM_INTERVAL_MS);
      const streamMs = timingMs(streamStartedAt);
      setIsCapturingStream(false);
      stopCamera();
      setIsCameraActive(false);
      setIsOvalVisible(false);

      if (!frames.length) {
        setVerificationPhase('idle');
        return;
      }

      setVerificationPhase('processing');
      const latestFrame = frames[frames.length - 1];
      setCapturedImage(latestFrame.data);
      setCapturedImageUrl(latestFrame.imageUrl);

      const flattenStartedAt = performance.now();
      const flattenedFrames = frames.map((frame) => {
        const matrix = imageToMatrix(frame.data, TARGET_SIZE);
        return matrix.flat();
      });
      const flattenMs = timingMs(flattenStartedAt);

      const anonymizeStartedAt = performance.now();
      const projections = anonymizeImage
        ? anonymizeFrames(flattenedFrames)
        : flattenedFrames;
      const anonymizeMs = timingMs(anonymizeStartedAt);

      if (!projections.length) {
        console.error('No valid DP-SVD embeddings generated.');
        setVerificationPhase('idle');
        return;
      }

      const sourceDimension = projections[0].length;
      const hasInconsistentDimensions = projections.some(
        (projection) => projection.length !== sourceDimension
      );
      if (hasInconsistentDimensions) {
        console.error(
          'Inconsistent projection dimensions across captured frames.'
        );
        setVerificationPhase('idle');
        return;
      }

      const projectionMatrix = getProjectionMatrix(
        sourceDimension,
        RP_TARGET_DIMENSION,
        RP_VERSION
      );
      const projectStartedAt = performance.now();
      const projectedProjections = projections.map((projection) => {
        const normalizedInput = l2NormalizeVector(projection);
        const projected = projectionMatrix
          .mmul(new Matrix(normalizedInput.map((value: number) => [value])))
          .to1DArray();
        return l2NormalizeVector(projected);
      });
      const projectMs = timingMs(projectStartedAt);
      // Skip reconstruction in login flow to avoid extra client-side latency.
      if (action !== 'login') {
        try {
          const reconstructed = anonymizeImage
            ? dpSvdReconstructFromFlattened(
                flattenedFrames[flattenedFrames.length - 1],
                DP_SVD_OPTIONS
              )
            : flattenedFrames[flattenedFrames.length - 1];
          const reconstructedUrl = createImageUrlFromPixels(
            reconstructed.flat(),
            TARGET_SIZE
          );
          setReconstructedImageUrl(reconstructedUrl);
        } catch (error) {
          console.error('DP-SVD embedding failed', error);
          setReconstructedImageUrl(undefined);
        }
      } else {
        setReconstructedImageUrl(undefined);
      }

      const userWithEmbedding = {
        ...user,
        embedding: JSON.stringify(projectedProjections),
        userId: user?.userId ?? '',
      } as User & { embedding: string };

      try {
        const actionStartedAt = performance.now();
        await runBiometricAction(userWithEmbedding);
        const actionMs = timingMs(actionStartedAt);
        if (COMPARISON_ENABLED && action === 'change' && user?.isBiometric) {
          const comparisonEmbedding = selectComparisonFrames(projectedProjections);
          void predictCompare
            .mutateAsync({
              embedding: JSON.stringify(comparisonEmbedding),
              userId: user?.userId,
            })
            .catch((error) => {
              console.warn('Comparison request failed', error);
            });
        }
        setVerificationPhase('idle');
        if (action === 'login') {
          setFeedbackMessage(null);
        }
        logTiming('biometric_capture_flow', {
          action,
          requested_frames: frameCount,
          captured_frames: frames.length,
          stream_ms: streamMs,
          flatten_ms: flattenMs,
          anonymize_ms: anonymizeMs,
          project_ms: projectMs,
          action_ms: actionMs,
          total_ms: timingMs(captureFlowStartedAt),
        });
      } catch (error) {
        console.error('Biometric action failed', error);
        setVerificationPhase('idle');
        setFeedbackMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Biometric authentication failed',
        });
      }
      return;
    }

    await startCamera();
    setIsCameraActive(true);
    setIsOvalVisible(true);
    setCapturedImage(null);
    setCapturedImageUrl(undefined);
    setIsCapturingStream(false);
    setReconstructedImageUrl(undefined);
    setFeedbackMessage(null);
    setVerificationPhase('idle');
  };

  const buttonLabel =
    verificationPhase === 'capturing'
      ? 'Capturing...'
      : verificationPhase === 'processing'
        ? 'Processing...'
        : verificationPhase === 'verifying'
          ? 'Verifying...'
          : verificationPhase === 'unlocking'
            ? 'Unlocking profile...'
            : isCameraActive
              ? 'Capture Stream'
              : 'Start Camera';
  // : isModelStatusLoading
  //   ? 'Checking model...'
  //   : isModelTraining
  //     ? 'Model Training...'
  //     : isModelStatusError
  //       ? 'Model Unavailable'
  //       : 'Start Camera';
  const isButtonDisabled =
    register.isPending ||
    authenticate.isPending ||
    changeEmbedding.isPending ||
    isCapturingStream ||
    verificationPhase !== 'idle';
  // isModelTraining ||
  // isModelStatusLoading ||
  // isModelStatusError;

  return {
    videoRef,
    ovalRef,
    isOvalVisible,
    hasCapturedImage: Boolean(capturedImage),
    capturedImageUrl,
    reconstructedImageUrl,
    feedbackMessage,
    buttonLabel,
    isButtonDisabled,
    handleCaptureClick,
    verificationInProgressMessage:
      verificationPhase === 'capturing'
        ? 'Verification in progress: capturing biometric frames...'
        : verificationPhase === 'processing'
          ? 'Verification in progress: processing biometric data...'
          : verificationPhase === 'verifying'
            ? 'Verification in progress: matching biometric signature...'
            : verificationPhase === 'unlocking'
              ? 'Verification in progress: unlocking encrypted profile data...'
              : null,
  };
}
