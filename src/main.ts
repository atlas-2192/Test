import inquirer from "inquirer";
import {
  createLiquidityPosition,
  withdrawPosition,
  swapTokensToSol,
} from "./functions";

async function main() {
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
          {
            type: "input",
            name: "tokenMint",
            message: "Token Mint Address:",
            validate: (input) => {
              if (!input || input.trim() === "") {
                return "Token mint address cannot be empty";
              }
              return true;
            },
          },
          {
            type: "input",
            name: "solAmount",
            message: "SOL Amount for Liquidity:",
            validate: (input: string) => {
              if (!input.match(/^\d*\.?\d+$/)) {
                return "Please enter a valid decimal number";
              }
              const value = parseFloat(input);
              if (value <= 0) {
                return "Amount must be greater than 0";
              }
              return true;
            },
            filter: (input: string) => {
              const parsed = parseFloat(input);
              return isNaN(parsed) ? input : parsed;
            },
          },
          {
            type: "input",
            name: "lower",
            message: "Lower Price Bound:",
            validate: (input: string) => {
              if (!input.match(/^\d*\.?\d+$/)) {
                return "Please enter a valid decimal number";
              }
              return true;
            },
            filter: (input: string) => {
              const parsed = parseFloat(input);
              return isNaN(parsed) ? input : parsed;
            },
          },
          {
            type: "input",
            name: "upper",
            message: "Upper Price Bound:",
            validate: (input: string) => {
              if (!input.match(/^\d*\.?\d+$/)) {
                return "Please enter a valid decimal number";
              }
              return true;
            },
            filter: (input: string) => {
              const parsed = parseFloat(input);
              return isNaN(parsed) ? input : parsed;
            },
          },
        ]);
        const position = await createLiquidityPosition(tokenMint, solAmount, {
          lower,
          upper,
        });
        console.log("Position created: ", position?.toBase58());
        break;

      case "Withdraw Position":
        const { positionId } = await inquirer.prompt([
          {
            type: "input",
            name: "positionId",
            message: "Position ID:",
            validate: (input) => {
              if (!input || input.trim() === "") {
                return "Position ID cannot be empty";
              }
              return true;
            },
          },
        ]);
        await withdrawPosition(positionId);
        break;

      case "Swap Tokens to SOL":
        const { swapTokenMint, swapAmount } = await inquirer.prompt([
          {
            type: "input",
            name: "swapTokenMint",
            message: "Token Mint Address:",
            validate: (input) => {
              if (!input || input.trim() === "") {
                return "Token mint address cannot be empty";
              }
              return true;
            },
          },
          {
            type: "input",
            name: "swapAmount",
            message: "Amount to Swap:",
            validate: (input: string) => {
              if (!input.match(/^\d*\.?\d+$/)) {
                return "Please enter a valid decimal number";
              }
              const value = parseFloat(input);
              if (value <= 0) {
                return "Amount must be greater than 0";
              }
              return true;
            },
            filter: (input: string) => {
              const parsed = parseFloat(input);
              return isNaN(parsed) ? input : parsed;
            },
          },
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
}

process.on("exit", () => {
  process.stdin.setRawMode?.(false);
});

main();
