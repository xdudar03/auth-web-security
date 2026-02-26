import { Input } from '@/components/ui/input';
import {
  FormControl,
  FormField,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { MultiSelect } from '@/components/ui/multi-select';
import type { UseFormReturn } from 'react-hook-form';
import type { FormValues } from './types';
import type { Shop } from '@/hooks/useUserContext';
import { useMemo } from 'react';

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
  const shopOptions = useMemo(
    () =>
      allShops.map((shop: Shop) => ({
        label: shop.shopName,
        value: shop.shopId.toString(),
      })),
    [allShops]
  );

  const selectedShopIds = useMemo(() => {
    const ids = form.watch('shopIds');
    return ids ? ids.map((id: number) => id.toString()) : [];
  }, [form]);

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
              <MultiSelect
                options={shopOptions}
                defaultValue={selectedShopIds}
                onValueChange={(selectedValues) => {
                  const shopIds = selectedValues.map((id: string) =>
                    parseInt(id, 10)
                  );
                  form.setValue('shopIds', shopIds);
                }}
                placeholder="Search and select shops..."
                searchable
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="recoveryPassphrase"
        render={({ field }) => (
          <FormItem className="form-field">
            <FormLabel>Recovery Passphrase *</FormLabel>
            <FormControl>
              <Input
                type="password"
                placeholder="Enter your recovery passphrase"
                autoComplete="new-recovery-phrase"
                {...field}
              />
            </FormControl>
            <FormDescription>
              This passphrase will be used to recover your account if you forget
              your password or lose your device.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
