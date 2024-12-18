import BN from "bn.js";
import * as web3 from "@solana/web3.js";
import bs58 from "bs58";
import "dotenv/config";
import DLMM, { StrategyType } from "@meteora-ag/dlmm";
import { createJupiterApiClient } from "@jup-ag/api";
import {
  clusterApiUrl,
  Connection,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";

const connection = new Connection(
  process.env.SOLANA_RPC_URL || clusterApiUrl("devnet"),
  "confirmed"
);

const SOL_USDC_POOL = new PublicKey(
  "vC5B1ZegcGBasscPAjtvgwBLahrME4tvyntC9ovpCpx"
);

let cachedDlmmPool: DLMM | null = null;

const getDlmmPool = async () => {
  if (!cachedDlmmPool) {
    cachedDlmmPool = await DLMM.create(connection, SOL_USDC_POOL);
  }
  return cachedDlmmPool;
};

const airDropSol = async (
  connection: Connection,
  publicKey: PublicKey,
  amount = 1 * web3.LAMPORTS_PER_SOL
) => {
  try {
    const airdropSignature = await connection.requestAirdrop(publicKey, amount);
    const latestBlockHash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: airdropSignature,
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const getUser = async () => {
  // Initialize user keypair with token mint
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Private key is not defined in environment variables");
  }
  return web3.Keypair.fromSecretKey(bs58.decode(privateKey));
};

export async function createLiquidityPosition(
  tokenMint: string,
  solAmount: number,
  priceRange: { lower: number; upper: number }
) {
  // Input validation
  if (solAmount <= 0) {
    throw new Error("Invalid solAmount. It must be greater than 0.");
  }

  if (priceRange.lower <= 0 || priceRange.upper <= 0) {
    throw new Error(
      "Invalid price range. Both lower and upper prices must be greater than 0."
    );
  }

  if (priceRange.lower >= priceRange.upper) {
    throw new Error(
      "Invalid price range. The lower price must be less than the upper price."
    );
  }

  try {
    console.log("Creating liquidity position...");
    const dlmmPool = await getDlmmPool();

    // Validate user has sufficient SOL balance
    const balance = await connection.getBalance(new PublicKey(tokenMint));
    const requiredBalance = solAmount * 1e9;

    console.log("balance => ", balance);

    if (balance < requiredBalance) {
      throw new Error(
        `Insufficient SOL balance. Required: ${requiredBalance}, Available: ${balance}`
      );
    }

    const activeBin = await dlmmPool.getActiveBin();
    const activeBinPricePerToken = dlmmPool.fromPricePerLamport(
      Number(activeBin.price)
    );

    console.log("Active Bin Price Per Token:", activeBinPricePerToken);

    // Calculate bin IDs based on price range
    const minBinId = dlmmPool.getBinIdFromPrice(priceRange.lower, true);
    const maxBinId = dlmmPool.getBinIdFromPrice(priceRange.upper, true);

    console.log("requiredBalance", requiredBalance);

    // Setup position amounts
    const totalXAmount = new BN(requiredBalance);
    const totalYAmount = new BN(
      Math.floor(requiredBalance * Number(activeBinPricePerToken))
    );

    console.log("Total X Amount:", totalXAmount.toString());
    console.log("Total Y Amount:", totalYAmount.toString());

    // Generate unique position ID
    const posKeypair = web3.Keypair.generate();
    const positionPubKey = posKeypair.publicKey;

    const userKeypair = await getUser();

    // Initialize position with one-sided strategy
    const createPositionTx =
      await dlmmPool.initializePositionAndAddLiquidityByStrategy({
        totalXAmount,
        totalYAmount,
        strategy: {
          maxBinId,
          minBinId,
          strategyType: StrategyType.BidAskOneSide,
        },
        user: userKeypair.publicKey,
        positionPubKey,
      });

    try {
      // Convert to versioned transaction
      const versionedTx = new web3.VersionedTransaction(
        createPositionTx.compileMessage()
      );
      versionedTx.sign([userKeypair, posKeypair]);

      // Send the versioned transaction
      const txSignature = await connection.sendTransaction(versionedTx, {
        skipPreflight: true,
        maxRetries: 3,
      });

      try {
        const result = await connection.confirmTransaction(txSignature);

        console.log("result => ", result);
      } catch (error) {
        throw new Error(`Transaction failed: ${error}`);
      }
    } catch (error) {
      throw new Error(`Error creating position => ${error}`);
    }

    return positionPubKey;
  } catch (error) {
    console.log(error);
  }
}

export async function withdrawPosition(positionId: string, amount?: number) {
  try {
    console.log(`Withdrawing position ID: ${positionId}`);

    const userKeypair = await getUser();

    const dlmmPool = await getDlmmPool();

    const positionPubKey = new PublicKey(positionId);

    // Get position details
    const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(
      userKeypair.publicKey
    );

    console.log("userPositons => ", userPositions);

    const userPosition = userPositions.find(({ publicKey }) =>
      publicKey.equals(positionPubKey)
    );

    console.log("userPosition => ", userPosition);

    if (!userPosition) {
      throw new Error("Position not found");
    }

    // Calculate withdrawal amounts
    const binIdsToRemove = userPosition.positionData.positionBinData.map(
      (bin) => bin.binId
    );

    // Handle partial or full withdrawal
    const bpsToRemove = amount
      ? Math.min(amount * 100, 10000) // Convert amount to basis points (max 100%)
      : 10000; // 100% for full withdrawal

    const bps = new BN(bpsToRemove);

    // Execute withdrawal transaction
    const removeLiquidityTx = await dlmmPool.removeLiquidity({
      position: userPosition.publicKey,
      user: positionPubKey,
      binIds: binIdsToRemove,
      bps,
      shouldClaimAndClose: !amount, // Only close if full withdrawal
    });

    // Track withdrawn amounts
    let totalWithdrawnSOL = 0;
    let totalWithdrawnUSDC = 0;

    // Process transaction(s)
    const txResults = [];
    for (let tx of Array.isArray(removeLiquidityTx)
      ? removeLiquidityTx
      : [removeLiquidityTx]) {
      const txHash = await sendAndConfirmTransaction(connection, tx, [], {
        skipPreflight: false,
        preflightCommitment: "singleGossip",
      });
      txResults.push(txHash);
    }

    // Get final position state
    const finalPosition = amount
      ? await dlmmPool.getPositionsByUserAndLbPair(positionPubKey)
      : null;

    return {
      success: true,
      transactionHashes: txResults,
      withdrawnAmounts: {
        sol: totalWithdrawnSOL,
        usdc: totalWithdrawnUSDC,
      },
      remainingPosition: finalPosition,
      fullyClosed: !amount,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Withdrawal failed: ${error.message}`);
    }
    throw new Error("Withdrawal failed: Unknown error");
  }
}

export async function swapTokensToSol(
  tokenMint: string,
  amountToSwap: number,
  slippageBps: number = 100 // Default 1% slippage
) {
  const quoteApi = createJupiterApiClient();

  console.log("quoteApi -> ", quoteApi);

  try {
    // Get quote
    const quoteResponse = await quoteApi.quoteGet({
      inputMint: tokenMint,
      outputMint: "So11111111111111111111111111111111111111112", // Native SOL
      amount: amountToSwap,
      slippageBps: slippageBps,
      onlyDirectRoutes: false,
    });

    console.log({ quoteResponse: quoteResponse });

    // Get swap transaction
    const swapTransaction = await quoteApi.swapPost({
      swapRequest: {
        quoteResponse,
        userPublicKey: tokenMint,
      },
    });

    // Execute the swap
    const signature = await sendAndConfirmTransaction(
      connection,
      Transaction.from(Buffer.from(swapTransaction.swapTransaction, "base64")),
      [],
      { skipPreflight: false }
    );

    return {
      success: true,
      inputAmount: amountToSwap,
      outputAmount: quoteResponse.outAmount,
      route: {
        marketInfos: quoteResponse.routePlan,
        priceImpactPct: quoteResponse.priceImpactPct,
      },
      fees: quoteResponse.otherAmountThreshold,
      txHash: signature,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get quote: ${error.message}`);
    } else {
      throw new Error("Failed to get quote: Unknown error");
    }
  }
}
