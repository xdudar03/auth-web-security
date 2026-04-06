import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { UseFormReturn } from 'react-hook-form';
import type { FormValues } from '@/types/authentication';

export default function UsernameField({
  form,
}: {
  form: UseFormReturn<FormValues>;
}) {
  return (
    <FormField
      control={form.control}
      name="username"
      render={({ field }) => (
        <FormItem className="form-field">
          <FormLabel>Username *</FormLabel>
          <FormControl>
            <Input
              type="text"
              placeholder="Enter your username"
              autoComplete="username"
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
