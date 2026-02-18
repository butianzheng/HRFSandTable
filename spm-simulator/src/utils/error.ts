interface FormValidateError {
  errorFields: unknown[];
}

export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isFormValidateError(error: unknown): error is FormValidateError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'errorFields' in error &&
    Array.isArray((error as { errorFields?: unknown }).errorFields)
  );
}
