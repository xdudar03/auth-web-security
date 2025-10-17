import { useId, useRef, useState } from 'react';
import Image from 'next/image';
import { User, useUser } from '@/hooks/useUserContext';
import { handleRegister } from '@/lib/authentication/registration';
import { handleAuthenticate } from '@/lib/authentication/authentication';
import { handleBiometricChange } from '@/lib/settings/biometricChange';
import { Button } from '@/components/ui/button';
import cropImage, { grayscaleImage } from '@/lib/anonimization';
import OvalOverlay from './OvalOverlay';

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
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const { user, setUser } = useUser();
  const maskId = useId();
  const overlayMaskId = `biometric-mask-${maskId.replace(/:/g, '')}`;
  const TARGET_SIZE = 100;

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

  const handleClick = async () => {
    if (isCameraActive) {
      const imageData = await captureFrame();
      stopCamera();
      setIsCameraActive(false);
      setIsOvalVisible(false);

      if (!imageData) {
        return;
      }

      const userWithEmbedding = {
        ...user,
        embedding: imageData,
        id: user?.id ?? '',
      } as User;

      if (action === 'registration') {
        const resultUser = await handleRegister(userWithEmbedding);
        if (resultUser) {
          setUser(resultUser);
        }
      } else if (action === 'login') {
        const resultUser = await handleAuthenticate(userWithEmbedding);
        if (resultUser) {
          setUser(resultUser);
        }
      } else if (action === 'change') {
        const resultUser = await handleBiometricChange(userWithEmbedding);
        if (resultUser) {
          setUser(resultUser);
        }
      }
    } else {
      await startCamera();
      setIsCameraActive(true);
      setIsOvalVisible(true);
      setCapturedImage(null);
    }
  };

  const captureFrame = async (): Promise<string | null> => {
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

    const imageData = cropImage(
      canvas,
      videoRect,
      ovalRef.current.getBoundingClientRect(),
      TARGET_SIZE
    );

    if (imageData) {
      setCapturedImage(imageData);
      return imageData;
    }

    return null;
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
          <Button onClick={handleClick}>
            {isCameraActive ? 'Take Photo' : 'Start Camera'}
          </Button>
        </div>
        {capturedImage && (
          <div className="flex flex-col items-center gap-2">
            <h3 className="text-md font-semibold">Captured image</h3>
            <Image
              src={capturedImage}
              alt="Captured"
              width={256}
              height={192}
            />
          </div>
        )}
      </div>
    </div>
  );
}
