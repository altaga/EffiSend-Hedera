import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import "dotenv/config";
import { blockchains } from "./chains.js";

// Import your modularized chain services
import { handleHedera } from "./services/hedera.js";

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const TABLE_NAME = "xxxxxxxxxxxxx";

function response(statusCode, body) {
    return {
        statusCode,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify(body),
    };
}

export const handler = async (event) => {
    try {
        const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body || {};
        const { user, chainType, chainId, tokenId, amount, to } = body;

        if (!user || typeof user !== "string") throw new Error("BAD USER");

        // 1. Validate Chain Config
        const chainConfig = blockchains.find(c => {
            if (c.type !== chainType) return false;
            if (chainType === "evm" && chainId != null && c.chainId != chainId) return false;
            return c.tokens.some(t => (t.address || t.accountId || t.symbol) === tokenId);
        });

        if (!chainConfig) throw new Error("UNSUPPORTED CHAIN OR TOKEN");
        const tokenInfo = chainConfig.tokens.find(t => (t.address || t.accountId || t.symbol) === tokenId);

        // 2. Fetch User Data
        const queryResult = await docClient.send(
            new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: "#u = :userVal",
                ExpressionAttributeNames: { "#u": "user" },
                ExpressionAttributeValues: { ":userVal": user },
                Limit: 1,
            })
        );

        if (!queryResult.Items || queryResult.Items.length === 0) throw new Error("BAD USER");
        const accountData = queryResult.Items[0];

        let transactionHash = "";

        // 3. Route to the appropriate chain module
        switch (chainType) {
            case "hedera":
                transactionHash = await handleHedera({ user, accountData, tokenInfo, amount, to });
                break;
            default:
                throw new Error("UNSUPPORTED CHAIN TYPE");
        }

        return response(200, { error: null, result: transactionHash });

    } catch (e) {
        console.error("Execution Error:", e);
        const errMsg = e.message || "BAD REQUEST";
        return response(200, {
            error: errMsg.includes("BAD USER") ? "BAD USER" : errMsg,
            message: JSON.stringify(e, Object.getOwnPropertyNames(e)),
            result: null,
        });
    }
};