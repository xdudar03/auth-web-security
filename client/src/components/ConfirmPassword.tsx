export default function ConfirmPassword({
  setConfirmPassword,
  message,
}: {
  setConfirmPassword: (value: string) => void;
  message: { message: string; type: string };
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'confirmPassword') {
      setConfirmPassword(value);
    }
  };
  return (
    <div className="form-field flex flex-col gap-2 w-full justify-center  ">
      <label className="form-label" htmlFor="confirmPassword">
        Confirm your password
      </label>
      <input
        className="form-input"
        id="confirmPassword"
        type="password"
        name="confirmPassword"
        placeholder="Enter your password"
        onChange={handleChange}
      />
      {message.message && (
        <p
          className={`${
            message.type === 'error' ? 'text-error' : 'text-success'
          }`}
        >
          {message.message}
        </p>
      )}
    </div>
  );
}
