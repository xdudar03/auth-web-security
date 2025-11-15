import { User } from '@/hooks/useUserContext';
import Modal from '../Modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Calendar } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { useTRPC } from '@/hooks/TrpcContext';
import { useMutation } from '@tanstack/react-query';
import InfoRow from './user-info/InfoRow';

interface UserInfoModalProps {
  activeUser: User;
  setShowUserInfoModal: (show: boolean) => void;
  setActiveUser: (user: User | null) => void;
  mode: 'view' | 'edit';
  setMode: (mode: 'view' | 'edit') => void;
  onUserUpdated?: () => void;
}

export default function UserInfoModal({
  activeUser,
  setShowUserInfoModal,
  setActiveUser,
  mode,
  setMode,
  onUserUpdated,
}: UserInfoModalProps) {
  const trpc = useTRPC();
  const updateUserMutation = useMutation(
    trpc.admin.updateUser.mutationOptions({
      onSuccess: (data) => {
        console.log('updated user data: ', data);
        setActiveUser(data.user);
        setMode('view');
        onUserUpdated?.();
      },
      onError: (error) => {
        console.error('Error updating user', error);
      },
    })
  );
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
  console.log('activeUser: ', activeUser);

  type FormValues = {
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
  };

  const form = useForm<FormValues>({
    defaultValues: {
      username: activeUser.username,
      roleId: activeUser.roleId?.toString() ?? null,
      email: activeUser.email,
      firstName: activeUser.firstName ?? null,
      lastName: activeUser.lastName ?? null,
      phoneNumber: activeUser.phoneNumber ?? null,
      dateOfBirth: activeUser.dateOfBirth ?? null,
    },
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  const handleClose = () => {
    console.log('handleClose');
    setActiveUser(null);
    setShowUserInfoModal(false);
    setMode('view');
    console.log('setMode', mode);
  };

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    const updates: User = {
      ...activeUser,
      ...values,
      roleId: values.roleId ? Number(values.roleId) : activeUser.roleId,
    } as User;

    await updateUserMutation.mutateAsync({
      userId: activeUser.userId,
      updates: updates,
    });
  };

  const getVisibility = (
    field: keyof FormValues
  ): 'hidden' | 'anonymized' | 'visible' => {
    const v = activeUser.privacy?.[field];
    if (v === 'hidden' || v === 'anonymized' || v === 'visible') return v;
    return 'hidden';
  };

  const formatValue = (
    field: keyof FormValues,
    raw: string | null | undefined
  ) => {
    const visibility = getVisibility(field);
    console.log('visibility: ', visibility);
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

  const renderInput = (
    name: keyof FormValues,
    label: string,
    type: string = 'text',
    disabled: boolean = false
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="w-72 sm:w-80">
          <FormLabel>{label}</FormLabel>
          <FormControl>
            {activeUser.privacy?.[name] !== 'hidden' ? (
              <Input
                {...field}
                type={type}
                disabled={disabled}
                value={field.value ?? ''}
              />
            ) : (
              <p className="text-muted-foreground">
                {activeUser.privacy?.[name]}
              </p>
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

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

  return (
    <Modal
      title={mode === 'view' ? 'User Info' : 'Edit User'}
      open={true}
      onClose={handleClose}
      description={mode === 'view' ? 'User Info' : 'Edit User'}
      footer={
        mode === 'edit' && (
          <>
            <Button type="button" onClick={handleSendResetPasswordEmail}>
              Send Reset Password Email
            </Button>
            <Button type="submit" form="user-info-form">
              Save
            </Button>
          </>
        )
      }
    >
      {mode === 'edit' ? (
        <Form {...form}>
          <form
            id="user-info-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-2"
          >
            {renderInput('username', 'Username', 'text', false)}
            {renderInput('roleId', 'Role', 'text', false)}
            {renderInput('email', 'Email', 'email', false)}
            {renderInput('firstName', 'First Name', 'text', false)}
            {renderInput('lastName', 'Last Name', 'text', false)}
            {renderInput('phoneNumber', 'Phone Number', 'tel', false)}
            {renderInput('dateOfBirth', 'Date of Birth', 'text', false)}
          </form>
        </Form>
      ) : (
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
              display={formatValue(
                'roleId',
                activeUser.roleId?.toString() ?? ''
              )}
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
      )}
    </Modal>
  );
}
