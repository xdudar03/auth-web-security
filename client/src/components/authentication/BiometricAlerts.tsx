type FeedbackMessage = {
  type: 'success' | 'error' | 'warning';
  text: string;
};

type BiometricAlertsProps = {
  action: string;
  isModelTraining: boolean;
  isModelStatusError: boolean;
  feedbackMessage: FeedbackMessage | null;
};

export type { FeedbackMessage };

export default function BiometricAlerts({
  action,
  isModelTraining,
  isModelStatusError,
  feedbackMessage,
}: BiometricAlertsProps) {
  return (
    <>
      {action === 'login' && isModelTraining && (
        <div className="alert alert-warning w-full">
          Your biometric model is training right now. Biometric sign-in is
          temporarily unavailable.
        </div>
      )}

      {action === 'login' && isModelStatusError && (
        <div className="alert alert-warning w-full">
          We could not confirm model status right now. Please retry in a moment.
        </div>
      )}

      {feedbackMessage && (
        <div
          className={`w-full ${
            feedbackMessage.type === 'success'
              ? 'alert alert-success'
              : feedbackMessage.type === 'warning'
                ? 'alert alert-warning'
                : 'alert alert-error'
          }`}
        >
          {feedbackMessage.text}
        </div>
      )}
    </>
  );
}
