'use client';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormMessage } from '../ui/form';
import { PrivacyToggleButtons } from './PrivacyToggleButtons';
import { Control, FieldValues, Path } from 'react-hook-form';
import { PrivacySettings } from '@/hooks/useUserContext';

interface FormInputFieldProps<T extends FieldValues = FieldValues> {
  control: Control<T>;
  label: string;
  name: Path<T>;
  type: string;
  disabled: boolean;
  privacy: PrivacySettings[] | null;
  message?: string;
  onToggleVisibility: (
    field: string,
    visibility: 'hidden' | 'anonymized' | 'visible'
  ) => Promise<void>;
}

export const FormInputField = <T extends FieldValues = FieldValues>({
  control,
  label,
  name,
  type,
  disabled,
  privacy,
  message,
  onToggleVisibility,
}: FormInputFieldProps<T>) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-start flex-row gap-2">
                <Input
                  {...field}
                  type={type}
                  placeholder={label}
                  value={field.value ?? ''}
                  disabled={disabled}
                />
                <PrivacyToggleButtons
                  fieldName={name as string}
                  privacy={privacy}
                  onToggle={(visibility) =>
                    onToggleVisibility(name as string, visibility)
                  }
                />
              </div>
              {message && (
                <p className="text-sm text-muted-foreground">{message}</p>
              )}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
