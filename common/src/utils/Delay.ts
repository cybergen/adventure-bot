export module Delay {
  export function ms(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}