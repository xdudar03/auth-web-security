import type React from 'react';
import { Button } from '@/components/ui/button';
import OvalOverlay from './OvalOverlay';

type BiometricCameraSectionProps = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  ovalRef: React.RefObject<SVGEllipseElement | null>;
  isOvalVisible: boolean;
  overlayMaskId: string;
  onButtonClick: () => void | Promise<void>;
  isButtonDisabled: boolean;
  buttonLabel: string;
};

export default function BiometricCameraSection({
  videoRef,
  ovalRef,
  isOvalVisible,
  overlayMaskId,
  onButtonClick,
  isButtonDisabled,
  buttonLabel,
}: BiometricCameraSectionProps) {
  return (
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
        <span className="helper-text">Position your face within the frame.</span>
      </div>
      <div className="flex items-center gap-2 self-center">
        <Button onClick={onButtonClick} disabled={isButtonDisabled}>
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}
