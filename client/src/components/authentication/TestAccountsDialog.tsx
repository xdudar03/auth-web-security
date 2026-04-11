import { Button } from '@/components/ui/button';
import type { ButtonProps } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';

export default function TestAccountsDialog({
  disabled,
  onSelect,
  triggerClassName,
  triggerVariant = 'link',
  triggerLabel = 'Use test account',
}: {
  disabled: boolean;
  onSelect: (username: string, password: string) => void;
  triggerClassName?: string;
  triggerVariant?: ButtonProps['variant'];
  triggerLabel?: string;
}) {
  const testAccounts = [
    { label: 'Admin', username: 'admin', password: 'admin' },
    { label: 'User', username: 'user', password: 'user' },
    { label: 'Provider 1', username: 'shop owner 1', password: 'shop owner 1' },
    { label: 'Provider 2', username: 'shop owner 2', password: 'shop owner 2' },
    { label: 'Provider 3', username: 'shop owner 3', password: 'shop owner 3' },
    { label: 'Hidden All', username: 'hidden_all', password: 'password1' },
    { label: 'Anonymized All', username: 'anon_all', password: 'password2' },
    { label: 'Visible All', username: 'visible_all', password: 'password3' },
    { label: 'Mixed A', username: 'mixed_a', password: 'password4' },
  ] as const;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={triggerVariant}
          className={triggerClassName}
          disabled={disabled}
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select a test account</DialogTitle>
          <DialogDescription>
            Use a seeded account to jump into a specific role or privacy setup.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {testAccounts.map((acc) => (
            <DialogClose asChild key={acc.username}>
              <Button
                type="button"
                variant="outline"
                onClick={() => onSelect(acc.username, acc.password)}
                className="w-full"
                disabled={disabled}
              >
                {acc.label}
              </Button>
            </DialogClose>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
