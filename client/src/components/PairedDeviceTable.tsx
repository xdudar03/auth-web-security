import { Laptop, Plus, Smartphone, Tablet, Trash } from 'lucide-react';
import { useState } from 'react';

const fakePairedDevices = [
  { id: 1, name: 'Device 1', status: 'Connected', type: 'Smartphone' },
  { id: 2, name: 'Device 2', status: 'Disconnected', type: 'Laptop' },
  { id: 3, name: 'Device 3', status: 'Connected', type: 'Tablet' },
];

export default function PairedDeviceTable() {
  const [pairedDevicesTable, setPairedDevicesTable] = useState([
    ...fakePairedDevices,
  ]);
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
        <table className="table">
          <thead>
            <tr>
              <th className="th">Device</th>
              <th className="th">Status</th>
              <th className="th">
                <button className="icon-btn" onClick={handleAddDevice}>
                  <Plus className="w-4 h-4" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {pairedDevicesTable.map((device) => (
              <tr key={device.id}>
                <td className="td">
                  <div className="flex items-center gap-2">
                    {deviceIcons[device.type as keyof typeof deviceIcons]}
                    {device.name}
                  </div>
                </td>
                <td className="td">
                  {device.status === 'Connected' ? (
                    <span className="badge badge-success">Connected</span>
                  ) : (
                    <span className="badge badge-error">Disconnected</span>
                  )}
                </td>
                <td className="td">
                  <button
                    className="icon-btn"
                    onClick={() => handleRemoveDevice(device.id)}
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
