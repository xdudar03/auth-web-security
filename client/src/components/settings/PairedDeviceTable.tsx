import { Laptop, Plus, Smartphone, Tablet, Trash } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table as UITable,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { useDeviceDetails } from '@/hooks/useDeviceDetails';

const fakePairedDevices = [
  { id: 1, name: 'Device 1', status: 'Connected', type: 'Smartphone' },
  { id: 2, name: 'Device 2', status: 'Disconnected', type: 'Laptop' },
  { id: 3, name: 'Device 3', status: 'Connected', type: 'Tablet' },
];

export default function PairedDeviceTable() {
  const [pairedDevicesTable, setPairedDevicesTable] = useState([
    ...fakePairedDevices,
  ]);
  const { isMobile, isAndroid, isIOS, isIpad, isTablet, isDesktop } =
    useDeviceDetails();

  const deviceIcons = {
    Smartphone: <Smartphone className="w-4 h-4" />,
    Laptop: <Laptop className="w-4 h-4" />,
    Tablet: <Tablet className="w-4 h-4" />,
  };
  const handleAddDevice = () => {
    setPairedDevicesTable([
      ...pairedDevicesTable,
      {
        id: pairedDevicesTable.length + 1,
        name: 'Device ' + (pairedDevicesTable.length + 1),
        status: 'Disconnected',
        type: 'Smartphone',
      },
    ]);
  };
  const handleRemoveDevice = (id: number) => {
    setPairedDevicesTable(
      pairedDevicesTable.filter((device) => device.id !== id)
    );
  };
  return (
    <div className="w-full mx-auto space-y-6 border-t border-border pt-4 ">
      <h1 className="text-lg font-bold col-span-2">Paired Devices</h1>
      <div className="table-card">
        <UITable>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleAddDevice}
                  aria-label="Add device"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pairedDevicesTable.map((device) => (
              <TableRow key={device.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {deviceIcons[device.type as keyof typeof deviceIcons]}
                    {device.name}
                  </div>
                </TableCell>
                <TableCell>
                  {device.status === 'Connected' ? (
                    <Badge variant="success">Connected</Badge>
                  ) : (
                    <Badge variant="destructive">Disconnected</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveDevice(device.id)}
                    aria-label={`Remove ${device.name}`}
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </UITable>
      </div>
    </div>
  );
}
