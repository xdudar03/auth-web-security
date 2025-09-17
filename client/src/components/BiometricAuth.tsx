import { useRef, useState } from 'react';
import Image from 'next/image';

export default function BiometricAuth() {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

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
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded  gap-6">
      <h2 className="text-lg font-semibold">Biometric Authentication</h2>
      <p>Please position your face within the frame.</p>
      <video
        ref={videoRef}
        autoPlay
        className="w-64 h-48 bg-transparent border-2 border-dashed border-blue-800 rounded"
      />
      <button
        onClick={handleClick}
        className="bg-blue-900 text-white p-2 rounded"
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
