"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const inquirer_1 = __importDefault(require("inquirer"));
const functions_1 = require("./functions");
async function main() {
    // Enable raw mode for better terminal handling
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    console.clear();
    const { action } = await inquirer_1.default.prompt({
        type: "list",
        name: "action",
        message: "Select an action:",
        pageSize: 3,
        loop: true,
        choices: [
            { name: "Create Liquidity Position", value: "Create Liquidity Position" },
            { name: "Withdraw Position", value: "Withdraw Position" },
            { name: "Swap Tokens to SOL", value: "Swap Tokens to SOL" },
        ],
    });
    try {
        switch (action) {
            case "Create Liquidity Position":
                const { tokenMint, solAmount, lower, upper } = await inquirer_1.default.prompt([
                    { type: "input", name: "tokenMint", message: "Token Mint Address:" },
                    {
                        type: "number",
                        name: "solAmount",
                        message: "SOL Amount for Liquidity:",
                    },
                    { type: "number", name: "lower", message: "Lower Price Bound:" },
                    { type: "number", name: "upper", message: "Upper Price Bound:" },
                ]);
                await (0, functions_1.createLiquidityPosition)(tokenMint, solAmount, { lower, upper });
                break;
            case "Withdraw Position":
                const { positionId } = await inquirer_1.default.prompt([
                    { type: "input", name: "positionId", message: "Position ID:" },
                ]);
                await (0, functions_1.withdrawPosition)(positionId);
                break;
            case "Swap Tokens to SOL":
                const { swapTokenMint, swapAmount } = await inquirer_1.default.prompt([
                    {
                        type: "input",
                        name: "swapTokenMint",
                        message: "Token Mint Address:",
                    },
                    { type: "number", name: "swapAmount", message: "Amount to Swap:" },
                ]);
                await (0, functions_1.swapTokensToSol)(swapTokenMint, swapAmount);
                break;
            default:
                console.log("Invalid action. Exiting...");
        }
    }
    catch (error) {
        if (error instanceof Error) {
            console.error("Operation failed:", error.message);
        }
        else {
            console.error("Operation failed:", String(error));
        }
    }
} // Handle clean exit
process.on("exit", () => {
    process.stdin.setRawMode?.(false);
});
main();
