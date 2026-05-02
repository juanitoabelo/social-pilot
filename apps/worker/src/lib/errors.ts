export class RetryableError extends Error {
  constructor(
    message: string,
    public delayMs?: number,
    public code = "RETRYABLE_ERROR"
  ) {
    super(message);
    this.name = "RetryableError";
  }
}
export class PermanentError extends Error {
  constructor(message: string, public code = "PERMANENT_ERROR") {
    super(message);
    this.name = "PermanentError";
  }
}
export class RateLimitError extends RetryableError {
  constructor(message: string, delayMs = 60000) {
    super(message, delayMs, "RATE_LIMIT_ERROR");
    this.name = "RateLimitError";
  }
}
export class AuthError extends PermanentError {
  constructor(message: string) {
    super(message, "AUTH_ERROR");
    this.name = "AuthError";
  }
}