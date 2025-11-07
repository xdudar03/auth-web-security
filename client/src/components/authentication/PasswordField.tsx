import { Input } from '@/components/ui/input';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { UseFormReturn } from 'react-hook-form';
import type { FormValues } from './types';

export default function PasswordField({
  form,
  title,
}: {
  form: UseFormReturn<FormValues>;
  title: string;
}) {
  return (
    <FormField
      control={form.control}
      name="password"
      rules={{ required: 'Password is required' }}
      render={({ field }) => (
        <FormItem className="form-field">
          <FormLabel>Password</FormLabel>
          <FormControl>
            <Input
              type="password"
              placeholder="Enter your password"
              autoComplete={
                title === 'Registration' ? 'new-password' : 'current-password'
              }
              {...field}
            />
          </FormControl>
          <FormDescription>
            Use at least 8 characters, including a number and a symbol.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
