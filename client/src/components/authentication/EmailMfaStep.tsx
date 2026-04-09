'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type EmailMfaStepProps = {
  factorLabel: string;
  email: string;
  code: string;
  isCodeSent: boolean;
  isSending: boolean;
  isVerifying: boolean;
  onEmailChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onSendCode: () => void;
  onVerifyCode: () => void;
};

export default function EmailMfaStep({
  factorLabel,
  email,
  code,
  isCodeSent,
  isSending,
  isVerifying,
  onEmailChange,
  onCodeChange,
  onSendCode,
  onVerifyCode,
}: EmailMfaStepProps) {
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="form-field text-left">
        <h3 className="text-base font-semibold">Email verification</h3>
        <p className="text-sm text-muted">
          {factorLabel} succeeded. Finish sign-in with a one-time code sent to
          your account email.
        </p>
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="mfa-email">
          Email *
        </label>
        <Input
          id="mfa-email"
          type="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="Enter your email"
          autoComplete="email"
        />
      </div>

      {isCodeSent && (
        <div className="form-field">
          <label className="form-label" htmlFor="mfa-code">
            Verification Code *
          </label>
          <Input
            id="mfa-code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(event) =>
              onCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))
            }
            placeholder="Enter 6-digit code"
            autoComplete="one-time-code"
          />
        </div>
      )}

      <div className="form-field">
        <Button
          type="button"
          className="w-full p-0"
          disabled={isSending || isVerifying}
          onClick={isCodeSent ? onVerifyCode : onSendCode}
        >
          {isCodeSent ? 'Verify and sign in' : 'Send verification code'}
        </Button>
        {isCodeSent && (
          <Button
            type="button"
            variant="link"
            className="shadow-none self-center w-full p-0"
            disabled={isSending || isVerifying}
            onClick={onSendCode}
          >
            Resend verification code
          </Button>
        )}
      </div>
    </div>
  );
}
