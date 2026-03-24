'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/hooks/TrpcContext';
import { useUser } from '@/hooks/useUserContext';
import type { PrivacySettings } from '@/hooks/useUserContext';
import {
  loadDecryptedUser,
  type DecryptedPrivateProfile,
} from '@/lib/encryption/loadDecrypted';

type Visibility = 'hidden' | 'anonymized' | 'visible';

export type VisibilityStats = {
  total: number;
  visibleCount: number;
  anonymizedCount: number;
  hiddenCount: number;
  discountRate: number;
  tier: string;
};

export type DashboardPrivacyInsights = {
  privacyPreset: string | null;
  sortedSettings: PrivacySettings[];
  visibilityStats: VisibilityStats;
  topShopName: string | null;
};

export function normalizeFieldName(field: string): string {
  const spaced = field.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function normalizeVisibility(value: string): Visibility {
  if (value === 'visible' || value === 'anonymized' || value === 'hidden') {
    return value;
  }
  return 'hidden';
}

function getDiscountTier(discountRate: number): string {
  if (discountRate >= 25) return 'Elite';
  if (discountRate >= 18) return 'Gold';
  if (discountRate >= 10) return 'Silver';
  if (discountRate > 0) return 'Bronze';
  return 'Private';
}

function getTopShopName(shoppingHistory: unknown): string | null {
  if (!shoppingHistory) return null;

  let parsedHistory = shoppingHistory;
  if (typeof shoppingHistory === 'string') {
    try {
      parsedHistory = JSON.parse(shoppingHistory);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(parsedHistory)) return null;

  const scores = new Map<string, number>();
  parsedHistory.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const record = entry as Record<string, unknown>;

    const shopNameCandidate =
      record.shopName ?? record.shop ?? record.name ?? record.store;
    if (
      typeof shopNameCandidate !== 'string' ||
      shopNameCandidate.trim() === ''
    ) {
      return;
    }

    const scoreCandidate = [
      record.visits,
      record.count,
      record.total,
      record.amount,
    ]
      .map((value) => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
      })
      .find((value) => value !== null);
    const score = scoreCandidate ?? 1;
    scores.set(shopNameCandidate, (scores.get(shopNameCandidate) ?? 0) + score);
  });

  let bestShopName: string | null = null;
  let bestScore = -1;
  scores.forEach((score, shopName) => {
    if (score > bestScore) {
      bestScore = score;
      bestShopName = shopName;
    }
  });

  return bestShopName;
}

export function useDashboardPrivacyInsights(): DashboardPrivacyInsights {
  const trpc = useTRPC();
  const { user, privateData, privacy, shops } = useUser();
  const [decryptedData, setDecryptedData] =
    useState<DecryptedPrivateProfile | null>(null);

  const getUserPrivacyPresetQuery = useQuery({
    ...trpc.privacy.getUserPrivacyPreset.queryOptions(),
    enabled: Boolean(user),
  });
  const privacyPreset = getUserPrivacyPresetQuery.data ?? null;

  const getPresetFieldsQuery = useQuery({
    ...trpc.privacy.getPrivacyPreset.queryOptions({
      preset: privacyPreset ?? 'pl4',
    }),
    enabled: Boolean(privacyPreset),
  });

  useEffect(() => {
    const loadDecryptedData = async () => {
      if (!user || !privateData) {
        setDecryptedData(null);
        return;
      }

      const result = await loadDecryptedUser(user, privateData);
      setDecryptedData(result);
    };

    void loadDecryptedData();
  }, [privateData, user]);

  const effectivePrivacySettings = useMemo<PrivacySettings[]>(() => {
    if (privacy && privacy.length > 0) return privacy;
    const presetFields = getPresetFieldsQuery.data;
    if (!presetFields) return [];

    return Object.entries(presetFields).map(([field, visibility]) => ({
      field,
      visibility: normalizeVisibility(visibility),
    }));
  }, [getPresetFieldsQuery.data, privacy]);

  const visibilityStats = useMemo<VisibilityStats>(() => {
    const total = effectivePrivacySettings.length;
    const visibleCount = effectivePrivacySettings.filter(
      (setting) => setting.visibility === 'visible'
    ).length;
    const anonymizedCount = effectivePrivacySettings.filter(
      (setting) => setting.visibility === 'anonymized'
    ).length;
    const hiddenCount = effectivePrivacySettings.filter(
      (setting) => setting.visibility === 'hidden'
    ).length;

    if (total === 0) {
      return {
        total,
        visibleCount,
        anonymizedCount,
        hiddenCount,
        discountRate: 0,
        tier: 'Private',
      };
    }

    const weightedVisibility = visibleCount + anonymizedCount * 0.5;
    const discountRate = Math.round((weightedVisibility / total) * 30);

    return {
      total,
      visibleCount,
      anonymizedCount,
      hiddenCount,
      discountRate,
      tier: getDiscountTier(discountRate),
    };
  }, [effectivePrivacySettings]);

  const topShopName = useMemo(() => {
    const fromHistory = getTopShopName(decryptedData?.shoppingHistory);
    if (fromHistory) return fromHistory;
    return shops?.[0]?.shopName ?? null;
  }, [decryptedData?.shoppingHistory, shops]);

  const sortedSettings = useMemo(
    () =>
      [...effectivePrivacySettings].sort((a, b) =>
        a.field.localeCompare(b.field, 'en', { sensitivity: 'base' })
      ),
    [effectivePrivacySettings]
  );

  return {
    privacyPreset,
    sortedSettings,
    visibilityStats,
    topShopName,
  };
}
