import inquirer from "inquirer";
import chalk from "chalk"; // Add color support
import {
  createLiquidityPosition,
  withdrawPosition,
  swapTokensToSol,
} from "./functions";

async function main() {
  // Enable raw mode for better terminal handling
  process.stdin.setRawMode?.(true);
  process.stdin.resume();

  console.clear();

  const { action } = await inquirer.prompt({
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
        const { tokenMint, solAmount, lower, upper } = await inquirer.prompt([
          { type: "input", name: "tokenMint", message: "Token Mint Address:" },
          {
            type: "number",
            name: "solAmount",
            message: "SOL Amount for Liquidity:",
          },
          { type: "number", name: "lower", message: "Lower Price Bound:" },
          { type: "number", name: "upper", message: "Upper Price Bound:" },
        ]);
        const position = await createLiquidityPosition(tokenMint, solAmount, {
          lower,
          upper,
        });
        console.log("position: ", position?.toBase58());
        break;

      case "Withdraw Position":
        const { positionId } = await inquirer.prompt([
          { type: "input", name: "positionId", message: "Position ID:" },
        ]);
        await withdrawPosition(positionId);
        break;

      case "Swap Tokens to SOL":
        const { swapTokenMint, swapAmount } = await inquirer.prompt([
          {
            type: "input",
            name: "swapTokenMint",
            message: "Token Mint Address:",
          },
          { type: "number", name: "swapAmount", message: "Amount to Swap:" },
        ]);
        await swapTokensToSol(swapTokenMint, swapAmount);
        break;

      default:
        console.log("Invalid action. Exiting...");
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Operation failed:", error.message);
    } else {
      console.error("Operation failed:", String(error));
    }
  }
} // Handle clean exit
process.on("exit", () => {
  process.stdin.setRawMode?.(false);
});

main();
