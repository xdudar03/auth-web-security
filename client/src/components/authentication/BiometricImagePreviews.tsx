import Image from 'next/image';

type BiometricImagePreviewsProps = {
  hasCapturedImage: boolean;
  capturedImageUrl?: string;
  reconstructedImageUrl?: string;
  targetSize: number;
};

export default function BiometricImagePreviews({
  hasCapturedImage,
  capturedImageUrl,
  reconstructedImageUrl,
  targetSize,
}: BiometricImagePreviewsProps) {
  return (
    <>
      {hasCapturedImage && (
        <div className="flex flex-col items-center gap-2">
          <h3 className="text-md font-semibold">Captured image</h3>
          <Image
            src={capturedImageUrl ?? ''}
            alt="Captured"
            width={targetSize}
            height={targetSize}
          />
        </div>
      )}
      {reconstructedImageUrl && (
        <div className="flex flex-col items-center gap-2 text-center">
          <h3 className="text-md font-semibold">DP-SVD reconstruction</h3>
          <Image
            src={reconstructedImageUrl}
            alt="DP-SVD reconstruction"
            width={targetSize}
            height={targetSize}
          />
          <span className="helper-text">
            Approximation of your capture after DP-SVD.
          </span>
        </div>
      )}
    </>
  );
}
