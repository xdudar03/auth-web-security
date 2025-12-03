import { MultiSelect } from '@/components/ui/multi-select';
import { useState } from 'react';

const options = [
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue.js' },
  { value: 'angular', label: 'Angular' },
];

export default function AccountProvidersManager() {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  const handleSelectedOptionsChange = (options: string[]) => {
    setSelectedOptions(options);
  };

  return (
    <div className="grid-section-2 w-full">
      <h1 className="text-lg font-bold col-span-2">Providers Manager</h1>
      <MultiSelect
        options={options}
        onValueChange={handleSelectedOptionsChange}
        value={selectedOptions}
        placeholder="Select providers"
        className="w-full"
        searchable={true}
        autoSize={true}
        singleLine={true}
        modalPopover={true}
        responsive={true}
      />
    </div>
  );
}
