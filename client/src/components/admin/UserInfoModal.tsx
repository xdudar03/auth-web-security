import { User, useUser } from '@/hooks/useUserContext';
import Modal from '../Modal';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { changeUserInfo } from '@/lib/admin/changeUserInfo';

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
  const [updatedUser, setUpdatedUser] = useState<User | null>(null);
  const handleClose = () => {
    setActiveUser(null);
    setShowUserInfoModal(false);
    setMode('view');
  };

  const handleEdit = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const { name, value } = e.target;
    console.log('name', name);
    console.log('value', value);
    const updates = { [name]: value };
    console.log('updates', updates);
    // setUpdatedUser({ ...activeUser, ...updates });
  };

  const handleSave = async () => {
    if (!updatedUser) {
      alert('No updates to save');
      return;
    }
    const result = await changeUserInfo(activeUser.id, updatedUser as User);
    console.log('result', result);
    if (result) {
      setActiveUser(result.user as User);
    }
    setMode('view');
  };

  const editInput = (
    label: string,
    value: string,
    disabled: boolean,
    name: string
  ) => {
    return (
      <div className="flex flex-col gap-1 w-72 sm:w-80">
        <Label htmlFor={label}>{label}</Label>
        <Input
          id={label}
          type="text"
          value={value}
          onChange={handleEdit}
          disabled={disabled}
          name={name}
        />
      </div>
    );
  };

  return (
    <Modal
      title={mode === 'view' ? 'User Info' : 'Edit User'}
      open={true}
      onClose={handleClose}
      description={mode === 'view' ? 'User Info' : 'Edit User'}
      footer={mode === 'edit' && <Button onClick={handleSave}>Save</Button>}
    >
      <div className="flex flex-col gap-2">
        {editInput(
          'Username',
          activeUser.username,
          mode === 'view',
          'username'
        )}
        {editInput(
          'Role',
          activeUser.roleId?.toString() ?? '',
          mode === 'view',
          'roleId'
        )}
        {editInput('Email', activeUser.email ?? '', mode === 'view', 'email')}
        {editInput(
          'First Name',
          activeUser.firstName ?? '',
          mode === 'view',
          'firstName'
        )}
        {editInput(
          'Last Name',
          activeUser.lastName ?? '',
          mode === 'view',
          'lastName'
        )}
        {editInput(
          'Phone Number',
          activeUser.phoneNumber ?? '',
          mode === 'view',
          'phoneNumber'
        )}
        {editInput(
          'Date of Birth',
          activeUser.dateOfBirth ?? '',
          mode === 'view',
          'dateOfBirth'
        )}
        {/* {editInput('Gender', activeUser.gender, mode === 'view')} */}

        {role?.canReadUsersCredentials && (
          <>
            {editInput(
              'Credentials',
              activeUser.credentials ?? '',
              mode === 'view',
              'credentials'
            )}
            {editInput(
              'Password',
              activeUser.password,
              mode === 'view',
              'password'
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
