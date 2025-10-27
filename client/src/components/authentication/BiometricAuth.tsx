import { useId, useRef, useState } from 'react';
import Image from 'next/image';
import { User, useUser } from '@/hooks/useUserContext';
import { Button } from '@/components/ui/button';
import cropImage, { grayscaleImage, imageToMatrix } from '@/lib/anonimization';
import OvalOverlay from './OvalOverlay';
import { PCAEigenfaces } from '@/lib/pcaEigenface';
import { useTRPC } from '@/hooks/TrpcContext';
import { useMutation } from '@tanstack/react-query';

type CapturedFrame = {
  data: Uint8ClampedArray;
  imageUrl: string;
};

export default function BiometricAuth({
  title,
  action,
}: {
  title: string;
  action: string;
}) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCapturingStream, setIsCapturingStream] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ovalRef = useRef<SVGEllipseElement | null>(null);
  const [isOvalVisible, setIsOvalVisible] = useState(false);
  const [capturedImage, setCapturedImage] = useState<Uint8ClampedArray | null>(
    null
  );
  const [capturedImageUrl, setCapturedImageUrl] = useState<string>();
  const [reconstructedImageUrl, setReconstructedImageUrl] = useState<string>();
  const [capturedFrames, setCapturedFrames] = useState<CapturedFrame[]>([]);
  const { user } = useUser();
  const trpc = useTRPC();
  const register = useMutation(
    trpc.biometric.register.mutationOptions({
      onError: (error) => {
        console.error('error', error);
      },
    })
  );
  const authenticate = useMutation(
    trpc.biometric.authenticate.mutationOptions()
  );
  const changeEmbedding = useMutation(
    trpc.biometric.changeEmbedding.mutationOptions({
      onError: (error) => {
        console.error('error', error);
      },
    })
  );
  const maskId = useId();
  const overlayMaskId = `biometric-mask-${maskId.replace(/:/g, '')}`;
  const TARGET_SIZE = 100;
  const MAX_COMPONENTS = 5;
  const STREAM_FRAME_COUNT = 20;
  const STREAM_INTERVAL_MS = 250;

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
    });

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

    // Find min/max for proper normalization
    const minVal = Math.min(...pixels);
    const maxVal = Math.max(...pixels);
    const range = maxVal - minVal;

    const imageData = ctx.createImageData(size, size);

    for (let i = 0; i < pixels.length; i++) {
      // Normalize to [0, 255] range
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

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const runBiometricAction = async (payload: User) => {
    if (action === 'registration') {
      // const result = await register.mutateAsync({
      //   username: payload.username,
      //   email: payload.email,
      //   password: payload.password,
      //   userId: payload.userId,
      //   roleId: payload.roleId ?? 2,
      //   shopIds: payload.shopIds ?? [],
      // });
      // setUser(result.user as User);
    } else if (action === 'login') {
      await authenticate.mutateAsync({
        username: payload.username,
        password: payload.password,
      });
    } else if (action === 'change') {
      await changeEmbedding.mutateAsync({
        embedding: JSON.stringify(payload.embedding) ?? '',
      });
    }
  };

  const handleClick = async () => {
    if (isCameraActive) {
      setIsCapturingStream(true);
      const frames = await captureStream(
        STREAM_FRAME_COUNT,
        STREAM_INTERVAL_MS
      );
      console.log('stream:', frames);
      setIsCapturingStream(false);
      stopCamera();
      setIsCameraActive(false);
      setIsOvalVisible(false);

      if (!frames.length) {
        return;
      }

      setCapturedFrames(frames);
      const latestFrame = frames[frames.length - 1];
      setCapturedImage(latestFrame.data);
      setCapturedImageUrl(latestFrame.imageUrl);

      const pcaGen = new PCAEigenfaces(
        [TARGET_SIZE, TARGET_SIZE],
        MAX_COMPONENTS
      );
      const flattenedFrames = frames.map((frame) => {
        const matrix = imageToMatrix(frame.data, TARGET_SIZE);
        return matrix.flat();
      });

      flattenedFrames.forEach((flattened) => pcaGen.addImage(flattened));
      let projection: number[] = [];

      const { eigenfaces, meanFace, components } = pcaGen.generate();

      try {
        // eigenvector projection
        projection = pcaGen.project(
          flattenedFrames[flattenedFrames.length - 1]
        );
        console.log('projection:', projection);
        const reconstructed = pcaGen.reconstruct(projection);
        const reconstructedUrl = createImageUrlFromPixels(
          reconstructed,
          TARGET_SIZE
        );
        setReconstructedImageUrl(reconstructedUrl);
      } catch (error) {
        console.error('Eigenface reconstruction failed', error);
        setReconstructedImageUrl(undefined);
      }

      const userWithEmbedding = {
        ...user,
        embedding: projection,
        userId: user?.userId ?? '',
      } as User;

      try {
        await runBiometricAction(userWithEmbedding);
      } catch (error) {
        console.error('Biometric action failed', error);
      }
    } else {
      await startCamera();
      setIsCameraActive(true);
      setIsOvalVisible(true);
      setCapturedImage(null);
      setCapturedImageUrl(undefined);
      setCapturedFrames([]);
      setReconstructedImageUrl(undefined);
      setIsCapturingStream(false);
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

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-surface rounded gap-6">
      {title !== '' && (
        <h2 className="text-xl font-semibold">
          Biometric {title.toLowerCase()}
        </h2>
      )}
      <div className="form w-full items-center">
        <div className="form-field items-center">
          <label className="form-label" htmlFor="biometric-video">
            Camera feed
          </label>
          <div className="relative">
            <video
              id="biometric-video"
              ref={videoRef}
              autoPlay
              className="w-64 h-48 bg-transparent border-2 border-dashed border-primary rounded"
            ></video>
            {isOvalVisible && (
              <OvalOverlay
                overlayMaskId={overlayMaskId}
                ovalRef={ovalRef as React.RefObject<SVGEllipseElement>}
              />
            )}
          </div>
          <span className="helper-text">
            Position your face within the frame.
          </span>
        </div>
        <div className="flex items-center gap-2 self-center">
          <Button
            onClick={handleClick}
            disabled={
              register.isPending ||
              authenticate.isPending ||
              changeEmbedding.isPending ||
              isCapturingStream
            }
          >
            {isCameraActive
              ? isCapturingStream
                ? 'Capturing...'
                : 'Capture Stream'
              : 'Start Camera'}
          </Button>
        </div>
        {capturedImage && (
          <div className="flex flex-col items-center gap-2">
            <h3 className="text-md font-semibold">Captured image</h3>
            <Image
              src={capturedImageUrl ?? ''}
              alt="Captured"
              width={TARGET_SIZE}
              height={TARGET_SIZE}
            />
          </div>
        )}
        {reconstructedImageUrl && (
          <div className="flex flex-col items-center gap-2 text-center">
            <h3 className="text-md font-semibold">Reconstructed eigenface</h3>
            <Image
              src={reconstructedImageUrl}
              alt="Reconstructed eigenface"
              width={TARGET_SIZE}
              height={TARGET_SIZE}
            />
            <span className="helper-text">
              Approximation of your capture using the current eigenface basis.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
