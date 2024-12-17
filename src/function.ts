import DLMM, { StrategyType } from "@meteora-ag/dlmm";
import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";

const connection = new Connection(
  process.env.SOLANA_RPC_URL || clusterApiUrl("devnet"),
  "confirmed"
);

const SOL_USDC_POOL = new PublicKey(
  "ARwi1S4DaiTG5DX7S4M4ZsrXqpMD1MrTmbu9ue2tpmEq"
);

export async function createLiquidityPosition(
  tokenMint: string,
  solAmount: number,
  priceRange: { lower: number; upper: number }
) {
  try {
    console.log("Creating liquidity position...");
    const dlmmPool = await DLMM.create(connection, SOL_USDC_POOL);

    const activeBin = await dlmmPool.getActiveBin();
    const activeBinPricePerToken = dlmmPool.fromPricePerLamport(
      Number(activeBin.price)
    );

    // Calculate bin IDs based on price range
    const minBinId = dlmmPool.getBinIdFromPrice(priceRange.lower, true);
    const maxBinId = dlmmPool.getBinIdFromPrice(priceRange.upper, true);

    // Convert SOL amount to lamports
    const totalXAmount = new BN(solAmount * 1e9);
    const totalYAmount = totalXAmount.mul(new BN(activeBinPricePerToken));

    // Generate a new PublicKey for the position
    const positionPubKey = PublicKey.unique();

    // Create liquidity position (Spot Balance deposit)
    const createPositionTx =
      await dlmmPool.initializePositionAndAddLiquidityByStrategy({
        totalXAmount,
        totalYAmount,
        strategy: {
          maxBinId,
          minBinId,
          strategyType: StrategyType.BidAskOneSide,
        },
        user: new PublicKey(tokenMint),
        positionPubKey,
      });

    return createPositionTx;
  } catch (error) {
    console.log(error);
  }
}
