"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("../src/functions");
test("createLiquidityPosition should fail with invalid input", async () => {
    await expect((0, functions_1.createLiquidityPosition)("invalid_mint", 1, { lower: 10, upper: 20 })).rejects.toThrow();
});
test("withdrawPosition should fail with invalid position ID", async () => {
    await expect((0, functions_1.withdrawPosition)("invalid_id")).rejects.toThrow();
});
test("swapTokensToSol should fail with invalid token mint", async () => {
    await expect((0, functions_1.swapTokensToSol)("invalid_mint", 10)).rejects.toThrow();
});
