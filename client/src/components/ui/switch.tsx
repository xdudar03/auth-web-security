'use client';

import * as React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

function Switch({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: 'sm' | 'default';
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        'peer relative inline-flex shrink-0 items-center rounded-full border border-border outline-none transition-colors',
        'data-[size=default]:h-5 data-[size=default]:w-9 data-[size=sm]:h-4 data-[size=sm]:w-7',
        'data-[state=checked]:bg-primary  dark:data-[state=unchecked]:bg-muted/70',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block rounded-full bg-foreground/80 dark:bg-background shadow-sm transition-transform',
          'data-[state=unchecked]:translate-x-0.5',
          'data-[state=checked]:bg-primary-foreground dark:data-[state=unchecked]:bg-foreground',
          size === 'default' ? 'size-4 data-[state=checked]:translate-x-4' : '',
          size === 'sm' ? 'size-3 data-[state=checked]:translate-x-3' : ''
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
