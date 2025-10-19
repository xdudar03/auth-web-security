import { User, useUser } from '@/hooks/useUserContext';
import Modal from '../Modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { changeUserInfo } from '@/lib/admin/changeUserInfo';
import { useForm, type SubmitHandler } from 'react-hook-form';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';

export default function UserInfoModal({
  activeUser,
  setShowUserInfoModal,
  setActiveUser,
  mode,
  setMode,
}: {
  activeUser: User;
  setShowUserInfoModal: (show: boolean) => void;
  setActiveUser: (user: User | null) => void;
  mode: 'view' | 'edit';
  setMode: (mode: 'view' | 'edit') => void;
}) {
  const { role } = useUser();

  type FormValues = {
    username: string;
    roleId: string | null;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phoneNumber: string | null;
    dateOfBirth: string | null;
    credentials?: string | null;
    password?: string;
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
      credentials: activeUser.credentials ?? null,
      password: activeUser.password,
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

    const result = await changeUserInfo(activeUser.id, updates);
    if (result?.user) {
      setActiveUser(result.user as User);
    }
    setMode('view');
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
            <Input
              {...field}
              type={type}
              disabled={disabled}
              value={field.value ?? ''}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Modal
      title={mode === 'view' ? 'User Info' : 'Edit User'}
      open={true}
      onClose={handleClose}
      description={mode === 'view' ? 'User Info' : 'Edit User'}
      footer={
        mode === 'edit' && (
          <Button type="submit" form="user-info-form">
            Save
          </Button>
        )
      }
    >
      <Form {...form}>
        <form
          id="user-info-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-2"
        >
          {renderInput('username', 'Username', 'text', mode === 'view')}
          {renderInput('roleId', 'Role', 'text', mode === 'view')}
          {renderInput('email', 'Email', 'email', mode === 'view')}
          {renderInput('firstName', 'First Name', 'text', mode === 'view')}
          {renderInput('lastName', 'Last Name', 'text', mode === 'view')}
          {renderInput('phoneNumber', 'Phone Number', 'tel', mode === 'view')}
          {renderInput('dateOfBirth', 'Date of Birth', 'text', mode === 'view')}

          {role?.canReadUsersCredentials && (
            <>
              {renderInput(
                'credentials',
                'Credentials',
                'text',
                mode === 'view'
              )}
              {renderInput('password', 'Password', 'password', mode === 'view')}
            </>
          )}
        </form>
      </Form>
    </Modal>
  );
}
