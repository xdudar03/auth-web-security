import dynamic from 'next/dynamic';
import type { MultiValue } from 'react-select';
import { Input } from '@/components/ui/input';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { UseFormReturn } from 'react-hook-form';
import type { FormValues } from './types';
import type { Shop } from '@/hooks/useUserContext';

const AsyncSelect = dynamic(() => import('react-select/async'), {
  ssr: false,
});

export default function RegistrationFields({
  form,
  allShops,
  loadShops,
  isLoadingShops,
}: {
  form: UseFormReturn<FormValues>;
  allShops: Shop[];
  loadShops: (
    inputValue: string
  ) => Promise<{ label: string; value: number }[]>;
  isLoadingShops: boolean;
}) {
  return (
    <>
      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem className="form-field">
            <FormLabel>Email *</FormLabel>
            <FormControl>
              <Input type="email" placeholder="Enter your email" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="shopIds"
        render={() => (
          <FormItem className="form-field">
            <FormLabel>Shops * </FormLabel>
            <FormControl>
              <AsyncSelect
                instanceId="shop-select"
                loadOptions={loadShops}
                defaultOptions={allShops.map((shop: Shop) => ({
                  label: shop.shopName,
                  value: shop.shopId,
                }))}
                isMulti
                isLoading={isLoadingShops}
                placeholder="Search and select shops..."
                loadingMessage={() => 'Loading shops...'}
                noOptionsMessage={({ inputValue }: { inputValue: string }) =>
                  inputValue
                    ? `No shops found for "${inputValue}"`
                    : 'No shops available'
                }
                value={form
                  .watch('shopIds')
                  ?.map((id: number) => {
                    const shop = allShops.find((s: Shop) => s.shopId === id);
                    return shop
                      ? { label: shop.shopName, value: shop.shopId }
                      : null;
                  })
                  .filter(Boolean)}
                onChange={(newValue) => {
                  const selectedOptions = newValue as MultiValue<{
                    label: string;
                    value: number;
                  }>;
                  const shopIds = selectedOptions.map((option) => option.value);
                  form.setValue('shopIds', shopIds);
                }}
              />
            </FormControl>
          </FormItem>
        )}
      />
    </>
  );
}
