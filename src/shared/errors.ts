/**
 * Modüllerin fırlattığı, framework'ten bağımsız iş hataları.
 * Route'larda `shared/http > api()` bunları HTTP durum koduna çevirir.
 */
export type AppErrorKind = "unauthorized" | "invalid" | "not_found" | "conflict";

export class AppError extends Error {
  constructor(
    readonly kind: AppErrorKind,
    message: string,
  ) {
    super(message);
  }
}

export const unauthorized = (m = "Giriş gerekli.") => new AppError("unauthorized", m);
export const invalid = (m: string) => new AppError("invalid", m);
export const notFound = (m = "Bulunamadı.") => new AppError("not_found", m);
export const conflict = (m: string) => new AppError("conflict", m);
