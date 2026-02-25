'use client';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function LoyalityPlatform() {
  const router = useRouter();

  const handleBack = () => {
    router.push('/');
  };
  return (
    <div className="center-screen">
      <div className="card max-w-sm text-center">
        <div className="flex flex-row items-center justify-center gap-6">
          <Button
            onClick={handleBack}
            variant="ghost"
            size="icon"
            className="icon-btn-zoom "
          >
            <ArrowLeft />
          </Button>
          <div className="flex flex-col items-center justify-center bg-surface rounded gap-6">
            <h3 className="text-2xl font-bold">
              Loyality Platform Authentication
            </h3>
            <div className="flex flex-col gap-6 w-full">
              <Link
                href="/login"
                className={cn(buttonVariants(), 'text-center')}
              >
                Login
              </Link>
              <Link
                href="/registration"
                className={cn(buttonVariants(), 'text-center')}
              >
                Registration
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
