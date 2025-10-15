import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/card';

export default function AccountStatsCard() {
  return (
    <div className="col-span-1 h-full overflow-hidden">
      <Card className="h-full">
        <CardHeader>
          <div className="icon-btn bg-transparent rounded-full w-full h-full flex items-center justify-center">
            <BarChart3 className="w-1/2 h-1/2 text-muted" />
          </div>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
