import { MultiSelect } from '@/components/ui/multi-select';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/button';

type ProviderOption = {
  providerId: string;
  name: string;
  sharingAllowed: boolean;
};

type AccountProvidersManagerProps = {
  providers: ProviderOption[];
  onUpdateProviderSharing: (blockedProviderIds: string[]) => Promise<void>;
  isUpdating: boolean;
};

export default function AccountProvidersManager({
  providers,
  onUpdateProviderSharing,
  isUpdating,
}: AccountProvidersManagerProps) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [sharePL, setSharePL] = useState<'yes' | 'custom'>('yes');
  const [shareDataExternal, setShareDataExternal] = useState<
    'yes' | 'no' | 'custom'
  >('no');
  const [customExternalProviders, setCustomExternalProviders] = useState<
    string[]
  >([]);

  useEffect(() => {
    const blockedProviderIds = providers
      .filter((provider) => !provider.sharingAllowed)
      .map((provider) => provider.providerId);

    setSelectedOptions(blockedProviderIds);
    setSharePL(blockedProviderIds.length > 0 ? 'custom' : 'yes');
  }, [providers]);

  const providerOptions = useMemo(
    () =>
      providers.map((provider) => ({
        value: provider.providerId,
        label: provider.name,
      })),
    [providers]
  );

  const handleSelectedOptionsChange = async (options: string[]) => {
    setSelectedOptions(options);
    await onUpdateProviderSharing(options);
  };

  return (
    <div className="w-full gap-4 border-t border-border pt-4 mt-4">
      <div className="space-y-4">
        <h1 className="text-lg font-bold">Providers Manager</h1>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Column 1: Share PL with Providers */}
          <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-medium text-foreground mb-3">
                  Share your PL with every provider?
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={sharePL === 'yes' ? 'default' : 'outline'}
                    size="sm"
                    disabled={isUpdating}
                    onClick={() => {
                      setSharePL('yes');
                      setSelectedOptions([]);
                      void onUpdateProviderSharing([]);
                    }}
                  >
                    Yes
                  </Button>
                  <Button
                    variant={sharePL === 'custom' ? 'default' : 'outline'}
                    size="sm"
                    disabled={isUpdating}
                    onClick={() => setSharePL('custom')}
                  >
                    Customize...
                  </Button>
                </div>
              </div>

              {/* Custom Configuration */}
              {sharePL === 'custom' && (
                <div className="border-t border-border/50 pt-4">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                    Do Not Share With These Providers
                  </label>
                  <MultiSelect
                    options={providerOptions}
                    onValueChange={(options) => {
                      void handleSelectedOptionsChange(options);
                    }}
                    value={selectedOptions}
                    placeholder="Choose providers to block..."
                    searchable={true}
                    autoSize={true}
                    singleLine={true}
                    modalPopover={true}
                    responsive={true}
                  />
                </div>
              )}

              {/* Default Option Info */}
              <div className="border-t border-border/50 pt-4">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold">Default:</span> Yes
                </p>
                {sharePL === 'yes' && (
                  <p className="text-xs text-muted-foreground mt-2">
                    ✓ Selected
                  </p>
                )}
                {sharePL === 'custom' && selectedOptions.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Blocking {selectedOptions.length} provider
                    {selectedOptions.length === 1 ? '' : 's'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Data Sharing with Externals */}
          <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-medium text-foreground mb-3">
                  Can providers share your data with externals?
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={
                      shareDataExternal === 'yes' ? 'default' : 'outline'
                    }
                    size="sm"
                    onClick={() => setShareDataExternal('yes')}
                  >
                    Yes
                  </Button>
                  <Button
                    variant={shareDataExternal === 'no' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShareDataExternal('no')}
                  >
                    No
                  </Button>
                  <Button
                    variant={
                      shareDataExternal === 'custom' ? 'default' : 'outline'
                    }
                    size="sm"
                    onClick={() => setShareDataExternal('custom')}
                  >
                    Customize...
                  </Button>
                </div>
              </div>

              {/* Custom Configuration */}
              {shareDataExternal === 'custom' && (
                <div className="border-t border-border/50 pt-4">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                    Select Providers That Can Share Data
                  </label>
                  <MultiSelect
                    options={providerOptions}
                    onValueChange={setCustomExternalProviders}
                    value={customExternalProviders}
                    placeholder="Choose providers..."
                    searchable={true}
                    autoSize={true}
                    singleLine={true}
                    modalPopover={true}
                    responsive={true}
                  />
                </div>
              )}

              {/* Default Option Info */}
              <div className="border-t border-border/50 pt-4">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold">Default:</span> No
                </p>
                {shareDataExternal === 'no' && (
                  <p className="text-xs text-muted-foreground mt-2">
                    ✓ Selected
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
