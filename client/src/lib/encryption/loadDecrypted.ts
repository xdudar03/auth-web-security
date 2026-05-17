import { User } from '@/hooks/useUserContext';
import { getActiveHpkePrivateKeyJwkB64 } from './encryption';
import { getUserHpkeBundleByPublicKey } from './encryption';
import { setActiveHpkePrivateKey } from './encryption';
import { setActiveHpkePublicKey } from './encryption';
import { importHpkePrivateKeyJwkB64 } from './encryption';
import { decryptWithHpkePrivateKey } from './encryption';
import { UserPrivateData } from '../../../../server/src/types/user';

export type DecryptedPrivateProfile = Partial<User> & {
  email?: string;
  shops?: unknown;
};

async function getPrivateKeyCandidates(publicKeyB64: string): Promise<string[]> {
  const candidates: string[] = [];
  const addCandidate = (privateKeyJwkB64: string | null | undefined) => {
    if (privateKeyJwkB64 && !candidates.includes(privateKeyJwkB64)) {
      candidates.push(privateKeyJwkB64);
    }
  };

  const matchedBundle = await getUserHpkeBundleByPublicKey(publicKeyB64);
  if (matchedBundle) {
    await setActiveHpkePrivateKey(matchedBundle.privateKeyJwkB64);
    await setActiveHpkePublicKey(matchedBundle.publicKeyB64);
    addCandidate(matchedBundle.privateKeyJwkB64);
  }

  addCandidate(await getActiveHpkePrivateKeyJwkB64());

  return candidates;
}

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
    const privateKeyCandidates = await getPrivateKeyCandidates(
      user.hpkePublicKeyB64
    );
    if (!privateKeyCandidates.length) {
      return null;
    }

    let decrypted: string | null = null;
    for (const privateKeyJwkB64 of privateKeyCandidates) {
      try {
        const privateKey = await importHpkePrivateKeyJwkB64(privateKeyJwkB64);
        decrypted = await decryptWithHpkePrivateKey(
          privateKey,
          privateData.original_cipher,
          privateData.original_iv,
          privateData.original_encap_pubkey
        );
        break;
      } catch {
        decrypted = null;
      }
    }

    if (!decrypted) {
      return null;
    }

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
