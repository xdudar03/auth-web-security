import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/hooks/useUserContext';
import { Badge } from '../ui/badge';
import { Building2, MapPin, Settings2, Store } from 'lucide-react';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';

interface ShopInfoProps {
  isViewMode?: boolean;
}

interface ShopDraft {
  location: string;
  description: string;
  discountEnabled: boolean;
  discountRate: string;
}

export default function ShopInfo({ isViewMode = true }: ShopInfoProps) {
  const { shops } = useUser();
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [shopDrafts, setShopDrafts] = useState<Record<number, ShopDraft>>({});

  const selectedShop = useMemo(() => {
    if (!shops?.length) return null;
    if (selectedShopId === null) return shops[0];
    return shops.find((shop) => shop.shopId === selectedShopId) ?? shops[0];
  }, [selectedShopId, shops]);

  useEffect(() => {
    if (!shops?.length) {
      setShopDrafts({});
      return;
    }

    setShopDrafts((previousDrafts) => {
      const nextDrafts: Record<number, ShopDraft> = {};

      shops.forEach((shop) => {
        nextDrafts[shop.shopId] = previousDrafts[shop.shopId] ?? {
          location: shop.shopAddress,
          description: shop.shopDescription,
          discountEnabled: false,
          discountRate: '10',
        };
      });

      return nextDrafts;
    });
  }, [shops]);

  const selectedDraft = selectedShop ? shopDrafts[selectedShop.shopId] : null;

  const updateSelectedDraft = <K extends keyof ShopDraft>(
    key: K,
    value: ShopDraft[K]
  ) => {
    if (!selectedShop) return;

    setShopDrafts((previousDrafts) => ({
      ...previousDrafts,
      [selectedShop.shopId]: {
        ...previousDrafts[selectedShop.shopId],
        [key]: value,
      },
    }));
  };

  return (
    <div className="grid-section-2 w-full">
      <div className="flex flex-row gap-2 items-center justify-between col-span-2">
        <h1 className="text-lg font-bold">Shop Information & Configuration</h1>
      </div>

      {!shops?.length && (
        <div className="col-span-2 rounded-lg border border-border/50 bg-muted/20 p-4">
          <p className="text-sm text-muted-foreground">
            No shop is linked to this account yet.
          </p>
        </div>
      )}

      {shops?.length ? (
        <>
          <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/20 p-4">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Shop Details
              </h2>
            </div>

            <div className="space-y-3">
              {shops.map((shop) => {
                const isSelected = selectedShop?.shopId === shop.shopId;
                return (
                  <button
                    type="button"
                    key={shop.shopId}
                    onClick={() => setSelectedShopId(shop.shopId)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      isSelected
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-border/50 bg-surface hover:bg-muted/30'
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {shop.shopName}
                      </p>
                      <Badge variant={isSelected ? 'success' : 'outline'}>
                        {isSelected ? 'Active' : 'Available'}
                      </Badge>
                    </div>
                    <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {shop.shopAddress}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {shop.shopDescription}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/20 p-4">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Configuration
              </h2>
            </div>

            <div className="rounded-lg border border-border/50 bg-surface p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Selected Shop
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {selectedShop?.shopName ?? '-'}
              </p>
            </div>

            <div className="rounded-lg border border-border/50 bg-surface p-3">
              <label
                htmlFor="shop-location"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Location
              </label>
              <Input
                id="shop-location"
                value={selectedDraft?.location ?? ''}
                onChange={(event) =>
                  updateSelectedDraft('location', event.target.value)
                }
                disabled={isViewMode}
                placeholder="Shop address"
                className="mt-2"
              />
            </div>

            <div className="rounded-lg border border-border/50 bg-surface p-3">
              <label
                htmlFor="shop-description"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Description
              </label>
              <textarea
                id="shop-description"
                value={selectedDraft?.description ?? ''}
                onChange={(event) =>
                  updateSelectedDraft('description', event.target.value)
                }
                disabled={isViewMode}
                rows={3}
                placeholder="Describe your shop..."
                className="mt-2 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="rounded-lg border border-border/50 bg-surface p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Discount Settings
              </p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <label
                  htmlFor="discount-toggle"
                  className="text-sm text-foreground font-medium"
                >
                  Enable discounts for this shop
                </label>
                <Checkbox
                  id="discount-toggle"
                  checked={selectedDraft?.discountEnabled ?? false}
                  disabled={isViewMode}
                  onCheckedChange={(checked) =>
                    updateSelectedDraft('discountEnabled', checked === true)
                  }
                />
              </div>
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={selectedDraft?.discountRate ?? ''}
                onChange={(event) =>
                  updateSelectedDraft('discountRate', event.target.value)
                }
                disabled={isViewMode || !selectedDraft?.discountEnabled}
                placeholder="Discount %"
                className="mt-3"
              />
            </div>

            <div className="rounded-lg border border-border/50 bg-surface p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Profile Status
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="default">
                  <Building2 className="mr-1 h-3.5 w-3.5" />
                  Provider Connected
                </Badge>
                <Badge variant="outline">{shops.length} shop(s)</Badge>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
