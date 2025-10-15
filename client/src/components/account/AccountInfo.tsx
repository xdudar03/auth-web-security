'use client';
import { useUser } from '@/hooks/useUserContext';
import { User } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function AccountInfo() {
  const { user } = useUser();
  return (
    <div className="flex flex-col gap-4 w-full bg-surface rounded-lg p-4">
      <h1 className="text-2xl font-bold">Account Information</h1>
      <div className="flex items-center justify-start felx-row gap-2">
        <User className="avatar-lg" />
        <p className="text-sm text-foreground font-bold">
          Username {user?.username}
        </p>
      </div>
      <div className="grid-section-2 w-full">
        <h1 className="text-lg font-bold col-span-2">Personal Details</h1>
        <Input type="text" placeholder="First Name" />
        <Input type="text" placeholder="Last Name" />

        <Input type="email" placeholder="Email" />
        <Input type="tel" placeholder="Phone" />

        <Input type="date" placeholder="Date of Birth" />
        <Input type="text" placeholder="Gender" />
      </div>
      <div className="grid-section-2 w-full">
        <h1 className="text-lg font-bold col-span-2">Address</h1>
        <Input type="text" placeholder="Country" />
        <Input type="text" placeholder="City" />
        <Input type="text" placeholder="Address" />
        <Input type="text" placeholder="Zip Code" />
      </div>
    </div>
  );
}
