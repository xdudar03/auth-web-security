export default function OvalOverlay({
  overlayMaskId,
  ovalRef,
}: {
  overlayMaskId: string;
  ovalRef: React.RefObject<SVGEllipseElement>;
}) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <mask id={overlayMaskId}>
          <rect width="100" height="100" fill="white" />
          <ellipse cx="50" cy="50" rx="28" ry="36" fill="black" />
        </mask>
      </defs>
      <rect
        width="100"
        height="100"
        fill="transparent"
        mask={`url(#${overlayMaskId})`}
      />
      <ellipse
        ref={ovalRef}
        cx="50"
        cy="50"
        rx="28"
        ry="36"
        fill="transparent"
        stroke="white"
        strokeWidth="2"
      />
    </svg>
  );
}
