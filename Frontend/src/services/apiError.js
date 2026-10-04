/** Mirrors the contract's error shape: { error: { code, message, field } }. */
export class ApiError extends Error {
  constructor({ code = 'UNKNOWN_ERROR', message = 'Something went wrong. Please try again.', field = null, status = 0 } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.field = field;
    this.status = status;
  }
}
