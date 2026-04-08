/// <reference types="vite/client" />

declare const XLSX: {
  read(data: ArrayBuffer, opts?: { type?: string; cellDates?: boolean }): any;
  utils: {
    sheet_to_json(ws: any, opts?: { header?: number; defval?: any }): any[];
    decode_range(range: string): { s: { r: number; c: number }; e: { r: number; c: number } };
    encode_range(range: { s: { r: number; c: number }; e: { r: number; c: number } }): string;
  };
  write(wb: any, opts?: { type?: string; bookType?: string }): any;
};
