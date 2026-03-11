'use client';
import { Shop } from '@/hooks/useUserContext';
import { Check, Pencil, User } from 'lucide-react';
import { Button } from '../ui/button';

interface AccountHeaderProps {
  username?: string;
  shops: Shop[] | null;
  isEditMode: boolean;
  title: string;
  onModeToggle: () => void;
}

export const AccountHeader = ({
  username,
  shops,
  isEditMode,
  title,
  onModeToggle,
}: AccountHeaderProps) => {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{title}</h1>
      <div className="flex items-center justify-start flex-row gap-2 w-full">
        <User className="avatar-lg" />
        <div className="flex items-start justify-start flex-col gap-2">
          <p className="text-sm text-foreground font-bold">
            Username: {username}
          </p>
          <p className="text-sm text-foreground font-bold">
            Shops: {shops?.map((shop: Shop) => shop.shopName).join(', ')}
          </p>
        </div>
        <Button
          variant="ghost"
          className="ml-auto"
          form="account-info-form"
          type="submit"
        >
          {isEditMode ? <Check /> : <Pencil />}
        </Button>
      </div>
    </div>
  );
};
