"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLiquidityPosition = createLiquidityPosition;
exports.withdrawPosition = withdrawPosition;
exports.swapTokensToSol = swapTokensToSol;
const dlmm_1 = __importStar(require("@meteora-ag/dlmm"));
const api_1 = require("@jup-ag/api");
const web3_js_1 = require("@solana/web3.js");
const bn_js_1 = require("bn.js");
const connection = new web3_js_1.Connection(process.env.SOLANA_RPC_URL || (0, web3_js_1.clusterApiUrl)("devnet"), "confirmed");
const SOL_USDC_POOL = new web3_js_1.PublicKey("ARwi1S4DaiTG5DX7S4M4ZsrXqpMD1MrTmbu9ue2tpmEq");
async function createLiquidityPosition(tokenMint, solAmount, priceRange) {
    // Input validation
    if (solAmount <= 0) {
        throw new Error("Invalid solAmount. It must be greater than 0.");
    }
    if (priceRange.lower <= 0 || priceRange.upper <= 0) {
        throw new Error("Invalid price range. Both lower and upper prices must be greater than 0.");
    }
    if (priceRange.lower >= priceRange.upper) {
        throw new Error("Invalid price range. The lower price must be less than the upper price.");
    }
    try {
        console.log("Creating liquidity position...");
        const dlmmPool = await dlmm_1.default.create(connection, SOL_USDC_POOL);
        // Validate user has sufficient SOL balance
        const balance = await connection.getBalance(new web3_js_1.PublicKey(tokenMint));
        const requiredBalance = solAmount * 1e9;
        if (balance < requiredBalance) {
            throw new Error(`Insufficient SOL balance. Required: ${requiredBalance}, Available: ${balance}`);
        }
        const activeBin = await dlmmPool.getActiveBin();
        const activeBinPricePerToken = dlmmPool.fromPricePerLamport(Number(activeBin.price));
        // Calculate bin IDs based on price range
        const minBinId = dlmmPool.getBinIdFromPrice(priceRange.lower, true);
        const maxBinId = dlmmPool.getBinIdFromPrice(priceRange.upper, true);
        // Setup position amounts
        const totalXAmount = new bn_js_1.BN(requiredBalance);
        const totalYAmount = totalXAmount.mul(new bn_js_1.BN(activeBinPricePerToken));
        // Generate unique position ID
        const positionPubKey = web3_js_1.PublicKey.unique();
        // Initialize position with one-sided strategy
        await dlmmPool.initializePositionAndAddLiquidityByStrategy({
            totalXAmount,
            totalYAmount,
            strategy: {
                maxBinId,
                minBinId,
                strategyType: dlmm_1.StrategyType.BidAskOneSide,
            },
            user: new web3_js_1.PublicKey(tokenMint),
            positionPubKey,
        });
        return positionPubKey;
    }
    catch (error) {
        console.log(error);
    }
}
async function withdrawPosition(positionId, amount) {
    try {
        console.log(`Withdrawing position ID: ${positionId}`);
        const dlmmPool = await dlmm_1.default.create(connection, SOL_USDC_POOL);
        const positionPubKey = new web3_js_1.PublicKey(positionId);
        // Get position details
        const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(positionPubKey);
        const userPosition = userPositions.find(({ publicKey }) => publicKey.equals(positionPubKey));
        if (!userPosition) {
            throw new Error("Position not found");
        }
        // Calculate withdrawal amounts
        const binIdsToRemove = userPosition.positionData.positionBinData.map((bin) => bin.binId);
        // Handle partial or full withdrawal
        const bpsToRemove = amount
            ? Math.min(amount * 100, 10000) // Convert amount to basis points (max 100%)
            : 10000; // 100% for full withdrawal
        const bps = new bn_js_1.BN(bpsToRemove);
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
            const txHash = await (0, web3_js_1.sendAndConfirmTransaction)(connection, tx, [], {
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
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Withdrawal failed: ${error.message}`);
        }
        throw new Error("Withdrawal failed: Unknown error");
    }
}
async function swapTokensToSol(tokenMint, amountToSwap, slippageBps = 100 // Default 1% slippage
) {
    const quoteApi = (0, api_1.createJupiterApiClient)();
    // Get quote
    const quoteResponse = await quoteApi.quoteGet({
        inputMint: tokenMint,
        outputMint: "So11111111111111111111111111111111111111112", // Native SOL
        amount: amountToSwap,
        slippageBps: slippageBps,
        onlyDirectRoutes: false,
    });
    // Get swap transaction
    const swapTransaction = await quoteApi.swapPost({
        swapRequest: {
            quoteResponse,
            userPublicKey: tokenMint,
        },
    });
    // Execute the swap
    const signature = await (0, web3_js_1.sendAndConfirmTransaction)(connection, web3_js_1.Transaction.from(Buffer.from(swapTransaction.swapTransaction, "base64")), [], { skipPreflight: false });
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
}
