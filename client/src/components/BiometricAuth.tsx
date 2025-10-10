import { useRef, useState } from 'react';
import Image from 'next/image';
import { User, useUser } from '@/hooks/useUserContext';
import { handleRegister } from '@/lib/registration';
import { handleAuthenticate } from '@/lib/authentication';

export default function BiometricAuth({ title }: { title: string }) {
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

  const captureFrame = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/png');
        setCapturedImage(imageData);
        setUser({
          ...user,
          embedding: imageData,
          id: user?.id ?? '',
        } as User);
        if (user && title === 'Registration') {
          handleRegister(user);
        } else if (user && title === 'Login') {
          handleAuthenticate(user);
        }
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-surface rounded  gap-6">
      <h2 className="text-lg font-semibold">Biometric {title.toLowerCase()}</h2>
      <p>Please position your face within the frame.</p>
      <video
        ref={videoRef}
        autoPlay
        className="w-64 h-48 bg-transparent border-2 border-dashed border-primary rounded"
      />
      <button
        onClick={handleClick}
        className="bg-primary text-primary-foreground p-2 rounded hover:bg-primary/90"
      >
        {isCameraActive ? 'Take Photo' : 'Start Camera'}
      </button>
      {capturedImage && (
        <div className="mt-4">
          <h3 className="text-md font-semibold">Captured Image:</h3>
          <Image src={capturedImage} alt="Captured" width={256} height={192} />
        </div>
      )}
    </div>
  );
}
