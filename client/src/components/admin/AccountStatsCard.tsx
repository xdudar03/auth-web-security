import { BarChart3 } from 'lucide-react';

export default function AccountStatsCard() {
  return (
    <div className="col-span-1 bg-surface rounded-lg h-full overflow-hidden">
      <div className="flex flex-col h-full min-h-0 box-border">
        <div className="flex items-center justify-center gap-2 p-2 w-full mx-auto muted-panel h-40 md:h-2/3">
          <div className="icon-btn bg-transparent rounded-full w-full h-full flex items-center justify-center">
            <BarChart3 className="w-1/2 h-1/2 text-muted" />
          </div>
        </div>
        <div className="p-2 flex-1 min-h-0 box-border">
          <h3 className="text-lg font-semibold text-center">Account Stats</h3>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div>
              <p className="text-xs text-muted-foreground">Admins</p>
              <p className="text-xl font-semibold">—</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Members</p>
              <p className="text-xl font-semibold">—</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-xl font-semibold">—</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
