'use client';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-200">
      <div className="flex flex-col items-center justify-center border p-6 bg-white rounded shadow-md border-blue-950 gap-6">
        <h3 className="text-2xl font-bold">Authentication Page</h3>
        <div className="flex flex-col gap-6 w-full">
          <Link
            href="/login"
            className="bg-blue-900 text-white p-2 rounded hover:bg-blue-800 text-center"
          >
            Login
          </Link>
          <Link
            href="/registration"
            className="bg-blue-900 text-white p-2 rounded hover:bg-blue-800 text-center"
          >
            Registration
          </Link>
        </div>
      </div>
    </div>
  );
}
