import { User } from '@/hooks/useUserContext';
import Modal from '../Modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Calendar } from 'lucide-react';
import { useTRPC } from '@/hooks/TrpcContext';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useUser } from '@/hooks/useUserContext';
import InfoRow from './user-info/InfoRow';
import { useEffect, useMemo, useState } from 'react';
import {
  decryptWithHpkePrivateKey,
  getActiveHpkePrivateKeyJwkB64,
  importHpkePrivateKeyJwkB64,
} from '@/lib/encryption/encryption';

interface UserInfoModalProps {
  activeUser: User;
  setShowUserInfoModal: (show: boolean) => void;
  setActiveUser: (user: User | null) => void;
  onUserUpdated?: () => void;
}

type UserInfoField =
  | 'username'
  | 'roleId'
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'phoneNumber'
  | 'dateOfBirth'
  | 'gender'
  | 'country'
  | 'city'
  | 'address'
  | 'zip';

type SharedProfile = Record<string, unknown>;

export default function UserInfoModal({
  activeUser,
  setShowUserInfoModal,
  setActiveUser,
}: UserInfoModalProps) {
  const { role } = useUser();
  const trpc = useTRPC();
  const activeUserEmail = (activeUser as User & { email?: string }).email ?? '';
  const [message, setMessage] = useState({ message: '', type: '' });
  const [sharedProfile, setSharedProfile] = useState<SharedProfile | null>(
    null
  );
  const [sharedVisibility, setSharedVisibility] = useState<
    'anonymized' | 'visible' | null
  >(null);
  const [sharedProfileError, setSharedProfileError] = useState<string | null>(
    null
  );

  const providerSharedDataQuery = useQuery({
    ...trpc.providers.getSharedUserData.queryOptions({
      userId: activeUser.userId,
    }),
    refetchOnMount: 'always',
    enabled:
      role?.roleName === 'provider' &&
      Boolean(activeUser.userId) &&
      Boolean(activeUser.registered),
  });
  const sendResetPasswordEmailMutation = useMutation(
    trpc.email.sendResetPasswordEmail.mutationOptions({
      onSuccess: (data) => {
        console.log('reset password email sent: ', data);
        setMessage({
          message: 'Reset password email sent successfully',
          type: 'success',
        });
        setTimeout(() => {
          setMessage({ message: '', type: '' });
        }, 3000);
      },
      onError: (error) => {
        console.error('Error sending reset password email', error);
        setMessage({
          message: 'Error sending reset password email',
          type: 'error',
        });
        setTimeout(() => {
          setMessage({ message: '', type: '' });
        }, 3000);
      },
    })
  );

  const handleClose = () => {
    setActiveUser(null);
    setShowUserInfoModal(false);
  };

  useEffect(() => {
    const decryptSharedData = async () => {
      setSharedProfile(null);
      setSharedVisibility(null);
      setSharedProfileError(null);

      if (role?.roleName !== 'provider') {
        return;
      }

      const sharedData = providerSharedDataQuery.data;
      if (
        !sharedData ||
        !sharedData.userCipher ||
        !sharedData.userIv ||
        !sharedData.userEncapPubKey
      ) {
        return;
      }

      try {
        const privateKeyJwkB64 = await getActiveHpkePrivateKeyJwkB64();
        if (!privateKeyJwkB64) {
          throw new Error('Missing active HPKE private key in this browser');
        }

        const privateKey = await importHpkePrivateKeyJwkB64(privateKeyJwkB64);
        const decrypted = await decryptWithHpkePrivateKey(
          privateKey,
          sharedData.userCipher,
          sharedData.userIv,
          sharedData.userEncapPubKey
        );

        try {
          const parsed = JSON.parse(decrypted) as SharedProfile;
          setSharedProfile(parsed);
        } catch {
          setSharedProfile({ value: decrypted });
        }

        setSharedVisibility(sharedData.visibility);
      } catch (error) {
        console.error('Failed to decrypt provider shared profile', error);
        setSharedProfileError(
          'Shared profile exists, but this device cannot decrypt it.'
        );
      }
    };

    void decryptSharedData();
  }, [providerSharedDataQuery.data, role?.roleName]);

  const getSharedFieldValue = (field: UserInfoField): string | null => {
    if (!sharedProfile) {
      return null;
    }

    const value = sharedProfile[field];
    if (value === null || value === undefined) {
      return null;
    }

    return String(value);
  };

  const getVisibility = (
    field: UserInfoField
  ): 'hidden' | 'anonymized' | 'visible' => {
    const v = activeUser.privacy?.[field];
    if (v === 'hidden' || v === 'anonymized' || v === 'visible') return v;
    if (role?.roleName === 'provider' && sharedVisibility) {
      return sharedVisibility;
    }
    return 'hidden';
  };

  const formatValue = (
    field: UserInfoField,
    raw: string | null | undefined
  ) => {
    if (role?.roleName === 'provider') {
      const sharedValue = getSharedFieldValue(field);
      return sharedValue ?? '';
    }

    const visibility = getVisibility(field);
    if (visibility === 'visible' || visibility === 'anonymized') {
      return raw ?? '';
    }
    return '';
  };

  const emailDisplay = useMemo(
    () => formatValue('email', activeUserEmail),
    [activeUserEmail, role?.roleName, sharedProfile, sharedVisibility]
  );

  const phoneDisplay = useMemo(
    () => formatValue('phoneNumber', activeUser.phoneNumber ?? ''),
    [activeUser.phoneNumber, role?.roleName, sharedProfile, sharedVisibility]
  );

  const usernameDisplay = useMemo(
    () => formatValue('username', activeUser.username),
    [activeUser.username, role?.roleName, sharedProfile, sharedVisibility]
  );

  const initials = () => {
    const first = activeUser.firstName?.[0] ?? '';
    const last = activeUser.lastName?.[0] ?? '';
    const nameInitials = (first + last).trim();
    if (nameInitials) return nameInitials.toUpperCase();
    return (activeUser.username?.slice(0, 2) ?? 'U').toUpperCase();
  };

  const handleSendResetPasswordEmail = async () => {
    console.log(
      'sending reset password email to: ',
      activeUserEmail,
      activeUser.userId
    );
    await sendResetPasswordEmailMutation.mutateAsync({
      to: activeUserEmail,
      userId: activeUser.userId,
    });
  };

  // Admin users cannot see user info
  if (role?.roleName === 'admin') {
    return (
      <Modal
        title="Manage User"
        open={true}
        onClose={handleClose}
        description="Send Reset Password Email"
        footer={
          <div className="flex flex-col gap-2 w-full">
            <Button type="button" onClick={handleSendResetPasswordEmail}>
              Send Reset Password Email
            </Button>
            {message.message && (
              <div
                className={`alert ${
                  message.type === 'success' ? 'alert-success' : 'alert-error'
                }`}
              >
                {message.message}
              </div>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-4 items-center justify-center py-6">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">
              User: {activeUser.username}
            </p>
            <p className="text-sm text-muted-foreground">
              Admin users can only send password reset emails
            </p>
          </div>
        </div>
      </Modal>
    );
  }

  // Providers and other roles can see user info
  return (
    <Modal
      title="User Info"
      open={true}
      onClose={handleClose}
      description="User Info"
      footer={null}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center text-sm font-semibold">
            {initials()}
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-sm">
              {(() => {
                const f = formatValue('firstName', activeUser.firstName);
                const l = formatValue('lastName', activeUser.lastName);
                if (!f && !l) {
                  return usernameDisplay || 'Hidden user';
                }
                return `${f} ${l}`.trim();
              })()}
            </span>
            <span className="text-xs text-muted-foreground">
              ID: {activeUser.userId}
            </span>
          </div>
        </div>

        <div className="divide-y">
          <InfoRow
            label="Username"
            display={usernameDisplay}
            visibility={getVisibility('username')}
          />
          <InfoRow
            label="Email"
            display={emailDisplay}
            visibility={getVisibility('email')}
            icon={<Mail className="h-4 w-4" />}
            canCopy
            copyText={emailDisplay}
          />
          <InfoRow
            label="Phone"
            display={phoneDisplay}
            visibility={getVisibility('phoneNumber')}
            icon={<Phone className="h-4 w-4" />}
            canCopy
            copyText={phoneDisplay}
          />
          <InfoRow
            label="Date of Birth"
            display={formatValue('dateOfBirth', activeUser.dateOfBirth ?? '')}
            visibility={getVisibility('dateOfBirth')}
            icon={<Calendar className="h-4 w-4" />}
          />
          <InfoRow
            label="First Name"
            display={formatValue('firstName', activeUser.firstName ?? '')}
            visibility={getVisibility('firstName')}
          />
          <InfoRow
            label="Last Name"
            display={formatValue('lastName', activeUser.lastName ?? '')}
            visibility={getVisibility('lastName')}
          />
          <InfoRow
            label="Gender"
            display={formatValue('gender', activeUser.gender ?? '')}
            visibility={getVisibility('gender')}
          />
          <InfoRow
            label="Country"
            display={formatValue('country', activeUser.country ?? '')}
            visibility={getVisibility('country')}
          />
          <InfoRow
            label="City"
            display={formatValue('city', activeUser.city ?? '')}
            visibility={getVisibility('city')}
          />
          <InfoRow
            label="Address"
            display={formatValue('address', activeUser.address ?? '')}
            visibility={getVisibility('address')}
          />
          <InfoRow
            label="Zip"
            display={formatValue('zip', activeUser.zip ?? '')}
            visibility={getVisibility('zip')}
          />
        </div>

        <div className="text-xs text-muted-foreground">
          Privacy legend:{' '}
          <Badge className="mx-1" variant="default">
            Visible
          </Badge>
          <Badge className="mx-1" variant="outline">
            Anonymized
          </Badge>
          <Badge className="mx-1" variant="destructive">
            Hidden
          </Badge>
        </div>
        {role?.roleName === 'provider' && (
          <div className="text-xs text-muted-foreground">
            {providerSharedDataQuery.isLoading && 'Loading shared profile...'}
            {!providerSharedDataQuery.isLoading &&
              sharedVisibility &&
              `Shared profile access: ${sharedVisibility}`}
            {!providerSharedDataQuery.isLoading &&
              !sharedVisibility &&
              !sharedProfileError &&
              'No shared profile access granted by this user.'}
            {sharedProfileError && sharedProfileError}
          </div>
        )}
      </div>
    </Modal>
  );
}
