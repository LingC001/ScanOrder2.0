import type { ValueTransformer } from 'typeorm';

export const integerTransformer: ValueTransformer = {
  to: (value: number) => value,
  from: (value: string | number) => Number(value),
};
