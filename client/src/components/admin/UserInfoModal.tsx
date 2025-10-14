import { User } from '@/hooks/useUserContext';
import Modal from '../Modal';

export default function UserInfoModal({
  activeUser,
  setShowUserInfoModal,
  setActiveUser,
}: {
  activeUser: User;
  setShowUserInfoModal: (show: boolean) => void;
  setActiveUser: (user: User | null) => void;
}) {
  const handleClose = () => {
    setActiveUser(null);
    setShowUserInfoModal(false);
  };

  return (
    <Modal title="User Info" open={true} onClose={handleClose}>
      <div className="flex flex-col gap-2">
        <p>{activeUser.username}</p>
        <p>{activeUser.password}</p>
        <p>{activeUser.roleId}</p>
        <p>{activeUser.credentials}</p>
      </div>
    </Modal>
  );
}
