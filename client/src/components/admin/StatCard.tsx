export default function StatCard({ title, value, icon }: StatCardProps) {
  return (
    <div className="col-span-1 h-full overflow-hidden">
      <div className="flex flex-col h-full min-h-0 box-border rounded-lg bg-surface shadow-sm">
        <div className="flex items-center justify-center gap-2 p-2 w-full mx-auto muted-panel h-40 md:h-2/3">
          <div className="icon-btn bg-transparent rounded-full w-full h-full flex items-center justify-center">
            {icon}
          </div>
        </div>
        <div className="flex flex-col gap-2 flex-1 min-h-0 box-border p-2 ">
          <h3 className="text-lg font-semibold text-center">{title}</h3>
          <p className="text-2xl font-semibold text-center">{value}</p>
        </div>
      </div>
    </div>
  );
}

type StatCardProps = {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
};
