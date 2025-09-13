import { useRef, useState } from 'react';

export default function MultiFactorAuth() {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
      stopCamera();
    } else {
      startCamera();
    }
    setIsCameraActive(!isCameraActive);
  };

  return (
    <div className="flex flex-col items-center justify-center border p-6 bg-white rounded shadow-md border-blue-950 gap-6">
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
        {isCameraActive ? 'Verify' : 'Start Camera'}
      </button>
    </div>
  );
}
