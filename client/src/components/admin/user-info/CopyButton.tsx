import { Button } from '@/components/ui/button';
import { Clipboard } from 'lucide-react';

export default function CopyButton({ text }: { text: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-6 px-1"
      onClick={() => navigator.clipboard?.writeText(text)}
    >
      <Clipboard className="h-3.5 w-3.5" />
    </Button>
  );
}
