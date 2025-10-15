import { Card, CardContent, CardHeader } from '../ui/card';

export default function StatCard({ title, value, icon }: StatCardProps) {
  return (
    <div className="col-span-1 h-full overflow-hidden">
      <Card className="h-full">
        <CardHeader className="card-header">
          <div className="icon-btn bg-transparent rounded-full w-full h-full flex items-center justify-center">
            {icon}
          </div>
        </CardHeader>
        <CardContent>
          <h3 className="text-lg font-semibold text-center">{title}</h3>
          <p className="text-2xl font-semibold text-center">{value}</p>
        </CardContent>
      </Card>
    </div>
  );
}

type StatCardProps = {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
};
