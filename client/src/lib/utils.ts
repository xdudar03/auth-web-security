import { type ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { AppRouter } from '../../../server/src/app';
import { createTRPCContext } from '@trpc/tanstack-react-query';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();
