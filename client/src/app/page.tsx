'use client';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function Home() {
  return (
    <div className="center-screen">
      <div className="card">
        <h3 className="text-2xl font-bold">Authentication Page</h3>
        <div className="flex flex-col gap-6 w-full">
          <Link href="/login" className={cn(buttonVariants(), 'text-center')}>
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
  );
}
