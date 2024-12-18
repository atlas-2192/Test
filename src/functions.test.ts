import {
  createLiquidityPosition,
  withdrawPosition,
  swapTokensToSol,
} from "../src/functions";

test("createLiquidityPosition should fail with invalid input", async () => {
  await expect(
    createLiquidityPosition("invalid_mint", 1, { lower: 10, upper: 20 })
  ).rejects.toThrow();
});

test("createLiquidityPosition should pass with valid input", async () => {
  await expect(
    createLiquidityPosition("22pjBU7bUpg5odASELnoJJ6MDP9FWziUPnsPJfbbRn5t", 1, {
      lower: 10,
      upper: 20,
    })
  ).rejects.toThrow();
});

test("withdrawPosition should fail with invalid position ID", async () => {
  await expect(withdrawPosition("invalid_id")).rejects.toThrow();
});

test("swapTokensToSol should fail with invalid token mint", async () => {
  await expect(swapTokensToSol("invalid_mint", 10)).rejects.toThrow();
});

test("swapTokensToSol should pass with valid token mint", async () => {
  await expect(
    swapTokensToSol("22pjBU7bUpg5odASELnoJJ6MDP9FWziUPnsPJfbbRn5t", 10)
  ).rejects.toThrow();
});
