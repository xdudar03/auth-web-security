'use client';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center justify-center border p-6 bg-surface rounded shadow-md border-border gap-6">
        <h3 className="text-2xl font-bold">Authentication Page</h3>
        <div className="flex flex-col gap-6 w-full">
          <Link
            href="/login"
            className="bg-primary text-primary-foreground p-2 rounded hover:bg-primary/90 text-center"
          >
            Login
          </Link>
          <Link
            href="/registration"
            className="bg-primary text-primary-foreground p-2 rounded hover:bg-primary/90 text-center"
          >
            Registration
          </Link>
        </div>
      </div>
    </div>
  );
}
