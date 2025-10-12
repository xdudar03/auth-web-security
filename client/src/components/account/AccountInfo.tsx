'use client';
import { useUser } from '@/hooks/useUserContext';
import { User } from 'lucide-react';

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
        <input type="text" className="input" placeholder="First Name" />
        <input type="text" className="input" placeholder="Last Name" />

        <input type="email" className="input" placeholder="Email" />
        <input type="tel" className="input" placeholder="Phone" />

        <input type="date" className="input" placeholder="Date of Birth" />
        <input type="text" className="input" placeholder="Gender" />
      </div>
      <div className="grid-section-2 w-full">
        <h1 className="text-lg font-bold col-span-2">Address</h1>
        <input type="text" className="input" placeholder="Country" />
        <input type="text" className="input" placeholder="City" />
        <input type="text" className="input" placeholder="Address" />
        <input type="text" className="input" placeholder="Zip Code" />
      </div>
    </div>
  );
}
