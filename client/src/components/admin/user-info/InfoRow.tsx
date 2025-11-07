import PrivacyBadge from './PrivacyBadge';
import CopyButton from './CopyButton';

type Visibility = 'hidden' | 'anonymized' | 'visible';

export default function InfoRow({
  label,
  display,
  visibility,
  icon,
  canCopy = false,
  copyText,
}: {
  label: string;
  display: string;
  visibility: Visibility;
  icon?: React.ReactNode;
  canCopy?: boolean;
  copyText?: string;
}) {
  const isCopyEnabled = Boolean(
    canCopy && visibility === 'visible' && copyText
  );
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm">{display}</span>
        {isCopyEnabled ? <CopyButton text={copyText as string} /> : null}
        <PrivacyBadge visibility={visibility} />
      </div>
    </div>
  );
}
