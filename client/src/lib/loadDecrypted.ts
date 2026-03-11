import { User } from '@/hooks/useUserContext';
import { getActiveHpkePrivateKeyJwkB64 } from './encryption';
import { getUserHpkeBundleByPublicKey } from './encryption';
import { setActiveHpkePrivateKey } from './encryption';
import { setActiveHpkePublicKey } from './encryption';
import { importHpkePrivateKeyJwkB64 } from './encryption';
import { decryptWithHpkePrivateKey } from './encryption';
import { UserPrivateData } from '../../../server/src/types/user';

export type DecryptedPrivateProfile = {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
};

export async function loadDecryptedUser(
  user: User,
  privateData: UserPrivateData
): Promise<DecryptedPrivateProfile | null> {
  if (!privateData || !user?.hpkePublicKeyB64) {
    return null;
  }

  if (
    !privateData.original_cipher ||
    !privateData.original_iv ||
    !privateData.original_encap_pubkey
  ) {
    return null;
  }

  try {
    let privateKeyJwkB64 = await getActiveHpkePrivateKeyJwkB64();
    if (!privateKeyJwkB64) {
      const matchedBundle = await getUserHpkeBundleByPublicKey(
        user.hpkePublicKeyB64
      );
      if (matchedBundle) {
        await setActiveHpkePrivateKey(matchedBundle.privateKeyJwkB64);
        await setActiveHpkePublicKey(matchedBundle.publicKeyB64);
        privateKeyJwkB64 = matchedBundle.privateKeyJwkB64;
      }
    }

    if (!privateKeyJwkB64) {
      return null;
    }
    const privateKey = await importHpkePrivateKeyJwkB64(privateKeyJwkB64);
    const decrypted = await decryptWithHpkePrivateKey(
      privateKey,
      privateData.original_cipher,
      privateData.original_iv,
      privateData.original_encap_pubkey
    );

    try {
      const parsed = JSON.parse(decrypted) as DecryptedPrivateProfile;
      return parsed;
    } catch {
      return { username: '', email: decrypted };
    }
  } catch (error) {
    console.error('Failed to decrypt account data', error);
    return null;
  }
}
