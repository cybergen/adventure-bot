export function compoundKey(...components: string[]): string {
  return components.join(`-`);
}