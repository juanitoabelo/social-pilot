declare module "recharts" {
  import { ComponentType, ReactNode } from "react";

  export const LineChart: ComponentType<{ data?: unknown[]; children?: ReactNode; width?: number | string; height?: number | string }>;
  export const Line: ComponentType<{ type?: string; dataKey?: string; stroke?: string; strokeWidth?: number; dot?: boolean; name?: string }>;
  export const BarChart: ComponentType<{ data?: unknown[]; children?: ReactNode; width?: number | string; height?: number | string }>;
  export const Bar: ComponentType<{ dataKey?: string; fill?: string; radius?: number[]; name?: string }>;
  export const XAxis: ComponentType<{ dataKey?: string; tick?: unknown; tickFormatter?: (value: unknown) => string }>;
  export const YAxis: ComponentType<{ tick?: unknown; tickFormatter?: (value: unknown) => string }>;
  export const CartesianGrid: ComponentType<{ strokeDasharray?: string; stroke?: string }>;
  export const Tooltip: ComponentType<{ labelFormatter?: (value: unknown) => string; formatter?: (value: unknown, name: string) => unknown[] }>;
  export const ResponsiveContainer: ComponentType<{ width?: number | string; height?: number | string; children?: ReactNode }>;
  export const Legend: ComponentType<unknown>;
}

