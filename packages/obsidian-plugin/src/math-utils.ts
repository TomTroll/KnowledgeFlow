// packages/obsidian-plugin/src/math-utils.ts
// Shared math utilities for vector operations.

/** Dot product of two equal-length vectors. */
export function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}
