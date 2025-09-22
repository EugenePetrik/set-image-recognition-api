/**
 * Utility function to safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return JSON.stringify(error.message);
  }
  return 'Unknown error occurred';
}

/**
 * Utility function to check if error has a specific name
 */
export function hasErrorName(error: unknown, name: string): boolean {
  return error instanceof Error && error.name === name;
}
