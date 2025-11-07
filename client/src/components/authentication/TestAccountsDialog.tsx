import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';

export default function TestAccountsDialog({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (username: string, password: string) => void;
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
  ] as const;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="link"
          className="shadow-none self-center w-full p-0"
        >
          Use test account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select a test account</DialogTitle>
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
