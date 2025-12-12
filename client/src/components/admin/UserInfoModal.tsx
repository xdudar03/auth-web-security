import { User } from '@/hooks/useUserContext';
import Modal from '../Modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Calendar } from 'lucide-react';
import { useTRPC } from '@/hooks/TrpcContext';
import { useMutation } from '@tanstack/react-query';
import { useUser } from '@/hooks/useUserContext';
import InfoRow from './user-info/InfoRow';

interface UserInfoModalProps {
  activeUser: User;
  setShowUserInfoModal: (show: boolean) => void;
  setActiveUser: (user: User | null) => void;
  onUserUpdated?: () => void;
}

export default function UserInfoModal({
  activeUser,
  setShowUserInfoModal,
  setActiveUser,
}: UserInfoModalProps) {
  const { role } = useUser();
  const trpc = useTRPC();
  const sendResetPasswordEmailMutation = useMutation(
    trpc.email.sendResetPasswordEmail.mutationOptions({
      onSuccess: (data) => {
        console.log('reset password email sent: ', data);
      },
      onError: (error) => {
        console.error('Error sending reset password email', error);
      },
    })
  );

  const handleClose = () => {
    setActiveUser(null);
    setShowUserInfoModal(false);
  };

  const getVisibility = (
    field: keyof {
      username: string;
      roleId: string | null;
      email: string;
      firstName: string | null;
      lastName: string | null;
      phoneNumber: string | null;
      dateOfBirth: string | null;
      gender: string | null;
      country: string | null;
      city: string | null;
      address: string | null;
      zip: string | null;
    }
  ): 'hidden' | 'anonymized' | 'visible' => {
    const v = activeUser.privacy?.[field];
    if (v === 'hidden' || v === 'anonymized' || v === 'visible') return v;
    return 'hidden';
  };

  const formatValue = (
    field: keyof {
      username: string;
      roleId: string | null;
      email: string;
      firstName: string | null;
      lastName: string | null;
      phoneNumber: string | null;
      dateOfBirth: string | null;
      gender: string | null;
      country: string | null;
      city: string | null;
      address: string | null;
      zip: string | null;
    },
    raw: string | null | undefined
  ) => {
    const visibility = getVisibility(field);
    if (visibility === 'visible' || visibility === 'anonymized') {
      return raw ?? '';
    }
    return '';
  };

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
      activeUser.email,
      activeUser.userId
    );
    await sendResetPasswordEmailMutation.mutateAsync({
      to: activeUser.email,
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
          <Button type="button" onClick={handleSendResetPasswordEmail}>
            Send Reset Password Email
          </Button>
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
                return !f && !l ? activeUser.username : `${f} ${l}`.trim();
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
            display={formatValue('username', activeUser.username)}
            visibility={getVisibility('username')}
          />
          <InfoRow
            label="Email"
            display={formatValue('email', activeUser.email)}
            visibility={getVisibility('email')}
            icon={<Mail className="h-4 w-4" />}
            canCopy
            copyText={activeUser.email}
          />
          <InfoRow
            label="Phone"
            display={formatValue('phoneNumber', activeUser.phoneNumber ?? '')}
            visibility={getVisibility('phoneNumber')}
            icon={<Phone className="h-4 w-4" />}
            canCopy
            copyText={activeUser.phoneNumber ?? ''}
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
            label="Role"
            display={formatValue('roleId', activeUser.roleId?.toString() ?? '')}
            visibility={getVisibility('roleId')}
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
      </div>
    </Modal>
  );
}
