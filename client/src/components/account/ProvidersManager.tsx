import { MultiSelect } from '@/components/ui/multi-select';
import { useMemo, useState } from 'react';
import { Shop, useUser } from '@/hooks/useUserContext';
import { Button } from '../ui/button';

export default function AccountProvidersManager() {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const { shops } = useUser();
  const providerOptions = useMemo(
    () =>
      shops?.map((shop: Shop) => ({
        value: shop.shopId.toString(),
        label: shop.shopName,
      })) ?? [],
    [shops]
  );
  const handleSelectedOptionsChange = (options: string[]) => {
    setSelectedOptions(options);
  };

  return (
    <div className="grid-section-2 w-full">
      <h1 className="text-lg font-bold col-span-2">Providers Manager</h1>
      <div className="flex flex-col gap-2">
        <div className="flex flex-row justify-between">
          <p>Share your PL with every provider?</p>
          <Button variant="outline">Yes</Button>
          <MultiSelect
            options={providerOptions}
            onValueChange={handleSelectedOptionsChange}
            value={selectedOptions}
            placeholder="Customize"
            searchable={true}
            autoSize={true}
            singleLine={true}
            modalPopover={true}
            responsive={true}
          />
        </div>
      </div>
    </div>
  );
}
