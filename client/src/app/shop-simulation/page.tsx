'use client';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ShopSimulation() {
  const router = useRouter();

  const handleBack = () => {
    router.push('/');
  };
  return (
    <div className="center-screen">
      <Button
        onClick={handleBack}
        variant="ghost"
        size="icon"
        className="icon-btn-zoom "
      >
        <ArrowLeft />
      </Button>
      <div className="flex flex-col items-center justify-center bg-surface rounded gap-6">
        <h3 className="text-2xl font-bold">Shop Simulation</h3>
      </div>
    </div>
  );
}
