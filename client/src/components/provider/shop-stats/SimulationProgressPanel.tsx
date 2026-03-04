import { ProgressState } from '@/types/statistics';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock3 } from 'lucide-react';
import { PANEL_CLASS } from '@/lib/shopStats';

export type SimulationProgressPanelProps = {
  progress: ProgressState;
  progressPercent: number;
  isRunning: boolean;
  onSimulate: () => void | Promise<void>;
  disableSimulate: boolean;
};

export function SimulationProgressPanel({
  progress,
  progressPercent,
  isRunning,
  onSimulate,
  disableSimulate,
}: SimulationProgressPanelProps) {
  return (
    <div className={`${PANEL_CLASS} flex flex-col gap-3`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Simulation Progress</p>
        <p className="text-xs text-muted">
          {progress.processed}/{progress.total} processed
        </p>
      </div>

      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="text-xs text-muted flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          success: {progress.successful}
        </span>
        <span className="flex items-center gap-1">
          <Clock3 className="h-3.5 w-3.5 text-amber-500" />
          failed: {progress.failed}
        </span>
      </div>

      <Button className="w-fit" onClick={onSimulate} disabled={disableSimulate}>
        {isRunning ? 'Simulation Running...' : 'Simulate Shop Activity'}
      </Button>
    </div>
  );
}
