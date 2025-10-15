import { User, useUser } from '@/hooks/useUserContext';
import Modal from '../Modal';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
  const handleClose = () => {
    setActiveUser(null);
    setShowUserInfoModal(false);
    setMode('view');
  };

  console.log('mode', mode);
  console.log('activeUser', activeUser);
  console.log('role', role);

  const handleEdit = (e: React.ChangeEvent<HTMLInputElement>) => {
    setActiveUser({ ...activeUser, [e.target.name]: e.target.value });
  };

  const editInput = (label: string, value: string, disabled: boolean) => {
    return (
      <div className="flex flex-col gap-1 w-72 sm:w-80">
        <Label htmlFor={label}>{label}</Label>
        <Input
          id={label}
          type="text"
          value={value}
          onChange={handleEdit}
          disabled={disabled}
          name={label}
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
      footer={
        mode === 'edit' && <Button onClick={() => setMode('view')}>Save</Button>
      }
    >
      <div className="flex flex-col gap-2">
        {editInput('Username', activeUser.username, mode === 'view')}
        {editInput(
          'Role',
          activeUser.roleId?.toString() ?? '',
          mode === 'view'
        )}

        {role?.canReadUsersCredentials && (
          <>
            {editInput('Credentials', activeUser.credentials, mode === 'view')}
            {editInput('Password', activeUser.password, mode === 'view')}
          </>
        )}
      </div>
    </Modal>
  );
}
