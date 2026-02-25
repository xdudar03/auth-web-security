'use client';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function Home() {
  return (
    <div className="center-screen">
      <div className="card max-w-sm text-center">
        <h3 className="text-2xl font-bold">
          Privacy-preserving Biometric Authentication Demo
        </h3>
        <div className="flex flex-col gap-6 w-full">
          <Link
            href="/loyality-platform"
            className={cn(buttonVariants(), 'text-center')}
          >
            Loyality Platform
          </Link>
          <Link
            href="/shop-simulation"
            className={cn(buttonVariants(), 'text-center')}
          >
            Shop Simulation
          </Link>
        </div>
      </div>
    </div>
  );
}
