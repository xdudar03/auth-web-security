import { useId, useRef, useState } from 'react';
import Image from 'next/image';
import { Role, User, useUser } from '@/hooks/useUserContext';
import { Button } from '@/components/ui/button';
import cropImage, { grayscaleImage, imageToMatrix } from '@/lib/anonimization';
import OvalOverlay from './OvalOverlay';
import { PCAEigenfaces } from '@/lib/pcaEigenface';
import { useTRPC } from '@/hooks/TrpcContext';
import { useMutation } from '@tanstack/react-query';

type SuccessData = {
  user: User;
  role: Role;
};

export default function BiometricAuth({
  title,
  action,
}: {
  title: string;
  action: string;
}) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ovalRef = useRef<SVGEllipseElement | null>(null);
  const [isOvalVisible, setIsOvalVisible] = useState(false);
  const [capturedImage, setCapturedImage] = useState<Uint8ClampedArray | null>(
    null
  );
  const [capturedImageUrl, setCapturedImageUrl] = useState<string>();
  const { user, setUser, setRole } = useUser();
  const trpc = useTRPC();
  const register = useMutation(
    trpc.biometric.register.mutationOptions({
      onSuccess: (data: SuccessData) => {
        console.log('data', data);
        handleSuccess(data);
      },
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
      onSuccess: (data: SuccessData) => {
        console.log('data', data);
        handleSuccess(data);
      },
      onError: (error) => {
        console.error('error', error);
      },
    })
  );
  const maskId = useId();
  const overlayMaskId = `biometric-mask-${maskId.replace(/:/g, '')}`;
  const TARGET_SIZE = 100;
  const pcaGen = new PCAEigenfaces([TARGET_SIZE, TARGET_SIZE], 10);

  function handleSuccess(data: SuccessData) {
    setUser(data.user);
    setRole(data.role);
  }

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
      const result = await register.mutateAsync({
        username: payload.username,
        email: payload.email,
        password: payload.password,
        id: payload.id,
        roleId: payload.roleId ?? 2,
      });
      setUser(result.user as User);
    } else if (action === 'login') {
      const result = await authenticate.mutateAsync({
        username: payload.username,
        password: payload.password,
      });
      setUser(result.user as User);
    } else if (action === 'change') {
      const result = await changeEmbedding.mutateAsync({
        username: payload.username,
        embedding: payload.embedding ?? new Uint8ClampedArray(0),
      });
      setUser(result.user as User);
    }
  };

  const handleClick = async () => {
    if (isCameraActive) {
      const capturedImage = await captureFrame();
      stopCamera();
      setIsCameraActive(false);
      setIsOvalVisible(false);

      if (!capturedImage) {
        return;
      }

      const matrix = imageToMatrix(capturedImage, TARGET_SIZE);
      pcaGen.addImage(matrix.flat());
      pcaGen.generate();
      const userWithEmbedding = {
        ...user,
        embedding: capturedImage,
        id: user?.id ?? '',
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
    }
  };

  const captureFrame = async (): Promise<Uint8ClampedArray | null> => {
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
    if (cropResult) {
      setCapturedImage(cropResult.imageData.data);
      setCapturedImageUrl(cropResult.imageUrl);
    }
    return cropResult?.imageData.data ?? null;
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
              changeEmbedding.isPending
            }
          >
            {isCameraActive ? 'Take Photo' : 'Start Camera'}
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
      </div>
    </div>
  );
}
