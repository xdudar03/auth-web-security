import { useRef, useState } from 'react';
import Image from 'next/image';
import { User, useUser } from '@/hooks/useUserContext';
import { handleRegister } from '@/lib/authentication/registration';
import { handleAuthenticate } from '@/lib/authentication/authentication';
import { handleBiometricChange } from '@/lib/settings/biometricChange';
import { Button } from '@/components/ui/button';

export default function BiometricAuth({
  title,
  action,
}: {
  title: string;
  action: string;
}) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const { user, setUser } = useUser();

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

  const handleClick = () => {
    if (isCameraActive) {
      captureFrame();
      stopCamera();
    } else {
      startCamera();
    }
    setIsCameraActive(!isCameraActive);
  };

  const captureFrame = async () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/png');
        setCapturedImage(imageData);
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
      }
    }
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
          <video
            id="biometric-video"
            ref={videoRef}
            autoPlay
            className="w-64 h-48 bg-transparent border-2 border-dashed border-primary rounded"
          />
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
