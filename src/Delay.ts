export module Delay {
  export async function ms(ms: number) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}