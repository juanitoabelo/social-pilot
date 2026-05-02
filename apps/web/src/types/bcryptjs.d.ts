declare module "bcryptjs" {
  export function hash(data: string | Buffer, salt: string | number): string;
  export function compare(data: string | Buffer, encrypted: string): boolean;
  export function hashSync(data: string | Buffer, salt: string | number): string;
  export function compareSync(data: string | Buffer, encrypted: string): boolean;
  export function genSaltSync(rounds?: number): string;
  export function genSalt(rounds: number, callback: (err: Error | null, salt: string) => void): void;
  export function hash(data: string | Buffer, salt: string | number, callback: (err: Error | null, encrypted: string) => void): void;
  export function compare(data: string | Buffer, encrypted: string, callback: (err: Error | null, same: boolean) => void): void;
}
