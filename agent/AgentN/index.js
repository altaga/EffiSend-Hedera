import { PrivateKey, AccountBalanceQuery, Client } from "@hashgraph/sdk";
import { HCS10Client } from "@hashgraphonline/standards-sdk";
import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import { tool } from "@langchain/core/tools";
import {
    END,
    MemorySaver,
    MessagesAnnotation,
    START,
    StateGraph,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatOllama } from "@langchain/ollama";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { formatUnits } from "ethers";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import * as fs from "fs";
import express from "express"; 
import http from "http"; 
import WebSocket, { WebSocketServer } from "ws"; 

import AgentCommunicationHandler, { HybridEncryption } from "./lib.js"; 
import { tokens } from "./constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Hedera Account and Topic Configuration
const AGENT_CONFIG = {
    PRIV_KEY_DER: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    MY_ACCOUNT_ID: "x.x.xxxxxxx",
    AGENT_HUB_ACCOUNT_ID: "x.x.xxxxxxx",
    CONNECTION_TOPIC_ID: "x.x.xxxxxxx",
};

// RSA Key Paths for Encryption/Decryption
const KEY_PATHS = {
    AGENT_HUB_PUBLIC: path.join(__dirname, "./keys/xxxxxxxxxxxxxxxxxxx"),
    AGENT2_PRIVATE: path.join(__dirname, "./keys/xxxxxxxxxxxxxxxxxxxx"),
    AGENT2_PUBLIC: path.join(__dirname, "./keys/xxxxxxxxxxxxxxxxxxxxx"),
};

// Hedera Client Setup
const MY_PRIVATE_KEY = PrivateKey.fromStringDer(AGENT_CONFIG.PRIV_KEY_DER);
const hederaClient = Client.forMainnet();

// LLM and Tool Initialization
const LLM_MODEL = "llama3.1:8b";
const webSearchTool = new DuckDuckGoSearch({
    safeSearch: "strict",
    maxResults: 1,
});
const llm = new ChatOllama({
    model: LLM_MODEL,
    temperature: 0.1,
    maxRetries: 2,
    keepAlive: "24h",
    numCtx: 1024 * 25,
});

// Utility to load RSA keys
function loadAgentKeys() {
    if (
        !fs.existsSync(KEY_PATHS.AGENT2_PRIVATE) ||
        !fs.existsSync(KEY_PATHS.AGENT2_PUBLIC)
    ) {
        console.error(`\nFATAL ERROR: Agent 1 key files are missing.`);
        console.error(`Missing Private Key at: ${KEY_PATHS.AGENT2_PRIVATE}`);
        throw new Error(
            "Agent 1 keys must be pre-generated and placed in the app directory."
        );
    }

    console.log("Loading existing Agent 1 RSA keys...");

    const privateKey = fs.readFileSync(KEY_PATHS.AGENT2_PRIVATE, "utf8");
    const publicKey = fs.readFileSync(KEY_PATHS.AGENT2_PUBLIC, "utf8");

    return { privateKey, publicKey };
}

// Rounding utility for balance comparisons
function epsilonRound(num, zeros = 9) {
    let temp = typeof num === "string" ? parseFloat(num) : num;
    return (
        Math.round((temp + Number.EPSILON) * Math.pow(10, zeros)) /
        Math.pow(10, zeros)
    );
}

// Utility for API calls
async function fetchURL(url, body) {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify(body),
        redirect: "follow",
    };

    try {
        const response = await fetch(url, requestOptions);
        const result = await response.json();

        if (result.error === null) {
            return result.result;
        } else {
            console.error("fetchURL API Error:", result.error);
            return null;
        }
    } catch (error) {
        console.error("fetchURL Network Error:", error);
        return null;
    }
}

// Creates LangGraph invocation config
const config = (data = {}) => {
    return { configurable: { thread_id: uuidv4(), ...data } };
};

// Tool: Get Token Balance on Hedera Mainnet
const getBalanceTokens = tool(
    async ({ token }, { configurable: { accountId } }) => {
        try {
            console.log("Get Balance Tool invoked with token:", token);
            const tokenSelected = tokens.find((t) => t.symbol === token);
            const tokenIndex = tokens.findIndex((t) => t.symbol === token);

            if (!tokenSelected) {
                return JSON.stringify({
                    status: "error",
                    message: `Token ${token} not recognized.`,
                });
            }

            const balance = await new AccountBalanceQuery()
                .setAccountId(accountId)
                .execute(hederaClient); 

            const jsonValues = {
                hbar: balance.hbars.toString(),
                tokens: JSON.parse(balance.tokens.toString()),
                tokensDecimals: JSON.parse(balance.tokenDecimals.toString()),
            };

            let finalBalance;
            if (tokenIndex === 0) {
                finalBalance = parseFloat(jsonValues.hbar);
            } else {
                const tokenBalance = jsonValues.tokens[tokenSelected.accountId] || {
                    low: 0,
                };
                finalBalance = parseFloat(
                    formatUnits(tokenBalance.low, tokenSelected.decimals)
                );
            }

            finalBalance = epsilonRound(finalBalance, tokenSelected.decimals);

            return JSON.stringify({
                status: "success",
                balance: `${finalBalance} ${tokenSelected.symbol}`,
            });
        } catch (error) {
            console.error("getBalanceTokens error:", error);
            return JSON.stringify({
                status: "error",
                message: `Failed to fetch balance: ${error.message}`,
            });
        }
    },
    {
        name: "get_balance_hedera",
        description: `This tool retrieves the user's current X token balance, where X is any token on Hedera Mainnet. Use this when the user specifically asks for their token balance, 'token', "balance", or general wallet funds on Hedera Mainnet.
            This is the list of available tokens: ${tokens.map(
                (t) => `${t.symbol}, `
            )}`,
        schema: z.object({ token: z.string() }),
    }
);

// Tool: Transfer Tokens on Hedera Mainnet
const transferTokens = tool(
    async ({ amount, to, token }, { configurable: { user } }) => {
        try {
            const tokenIndex = tokens.findIndex((t) => t.symbol === token);
            if (tokenIndex === -1) {
                return JSON.stringify({
                    status: "error",
                    message: `Token ${token} not recognized.`,
                });
            }

            const response = await fetchURL("xxxxxxxxxxxx/execute_payment_api", {
                user,
                amount,
                id: tokenIndex,
                to,
            });

            if (response === null || !response.hash) {
                return JSON.stringify({
                    status: "error",
                    message: "Transaction failed or incomplete response from API.",
                });
            }

            const { hash } = response;
            return JSON.stringify({
                message: "Transaction created and available on Hedera Mainnet.",
                status: "success",
                transaction: hash,
            });
        } catch (error) {
            console.error("transferTokens error:", error);
            return JSON.stringify({
                status: "error",
                message: `Transaction failed: ${error.message}`,
            });
        }
    },
    {
        name: "transfer_tokens",
        description: `This tool facilitates Tokens transfers on the Hedera Mainnet. It generates the transaction data for the user to sign. It activates whenever the user explicitly requests to send Tokens, initiates a transaction, or mentions terms like 'transfer,' 'Tokens,' or 'Hedera Mainnet' in relation to their wallet activity.`,
        schema: z.object({ amount: z.string(), to: z.string(), token: z.string() }),
    }
);

// Tool: Fund MetaMask Card (USDC transfer cross-chain)
const fundMemamaskCard = tool(
    async ({ amount, to }, { configurable: { user } }) => {
        try {
            const response = await fetchURL("xxxxxxxxxxxx/top_up_payment_api", {
                user,
                amount,
                to,
            });

            if (response === null || !response.hash) {
                return JSON.stringify({
                    status: "error",
                    message: "Transaction failed or incomplete response from API.",
                });
            }

            const { hash } = response;
            return JSON.stringify({
                status: "success",
                message: "Transaction successfully completed.",
                transaction: hash,
            });
        } catch (error) {
            console.error("fundMemamaskCard error:", error);
            return JSON.stringify({
                status: "error",
                message: `Transaction failed: ${error.message}`,
            });
        }
    },
    {
        name: "fund_metamask_card",
        description:
            "This tool facilitates transfers where the specified amount is in USD, but the sending token is USDC on the Hedera Mainnet to USDC on Linea. It generates transaction data for the user to sign and activates when the user explicitly opts to send USD to a MetaMask Card or mentions relevant terms such as 'transfer,' 'USDC,' 'Hedera Mainnet,' or 'MetaMask Card' in the context of wallet activity.",
        schema: z.object({ amount: z.string(), to: z.string() }),
    }
);

// Tool: List available capabilities
const listOfTools = tool(
    () => {
        console.log("List of Tools Tool invoked.");
        return JSON.stringify({
            status: "info",
            message:
                "DeSmond can help you fund your MetaMask card, transfer tokens on Hedera Mainnet, and retrieve your current balance for any token on Hedera Mainnet.",
        });
    },
    {
        name: "list_of_tools",
        description:
            "This tool provides a list of available tools for the user to interact with. It activates whenever the user explicitly requests information about available tools, mentions terms like 'tools,' 'features,' or 'commands'.",
        schema: z.object({}),
    }
);

// Tool: Friendly welcome fallback
const fallbackTool = tool(
    () => {
        console.log("Fallback Tool invoked.");
        return JSON.stringify({
            status: "info",
            message:
                "Hello! I'm DeSmond, a helpful AI assistant. I can assist with Hedera token transfers, checking balances, and funding your MetaMask card. How can I help you today?",
        });
    },
    {
        name: "fallback",
        description:
            "This tool activates when the user greets the assistant with a simple 'hi' or 'hello' and asks for help. It provides a friendly and welcoming message to initiate the conversation.",
        schema: z.object({}),
    }
);

// Tool: General web search functionality
const webSearch = tool(
    async ({ query }) => {
        console.log("Web Search Tool invoked with query:", query);
        try {
            const res = await webSearchTool.invoke(query);
            return JSON.stringify({ status: "success", query, results: res });
        } catch (error) {
            console.error("Web Search Tool error:", error);
            return JSON.stringify({ status: "error", message: error.message });
        }
    },
    {
        name: "web_search",
        description:
            "This tool facilitates precise and comprehensive internet searches, enabling users to gather current and detailed information about specific topics or queries. Use this for general inquiries requiring up-to-date, internet-sourced information.",
        schema: z.object({ query: z.string() }),
    }
);

// List of all functional tools used by the LLM
const all_api_tools = [
    // webSearch, 
    listOfTools,
    getBalanceTokens,
    fallbackTool,
    transferTokens,
    fundMemamaskCard,
];

// LangGraph State Machine Workflow setup
function createWorkflow() {
    const tools_node = new ToolNode(all_api_tools);
    const llm_with_tools = llm.bindTools(all_api_tools);

    // Node to invoke the LLM
    const call_model = async (state) => {
        const response = await llm_with_tools.invoke(state.messages);
        return { messages: response };
    };

    // Conditional edge logic: decide whether to run a tool or end
    function shouldContinue(state) {
        const lastMessage = state.messages[state.messages.length - 1];
        if (lastMessage["tool_calls"] && lastMessage["tool_calls"].length > 0) {
            return "tool";
        }
        return END;
    }

    // Define the graph structure and edges
    const workflow = new StateGraph(MessagesAnnotation)
        .addNode("model", call_model)
        .addNode("tool", tools_node)
        .addConditionalEdges("model", shouldContinue, ["tool", END])
        .addEdge(START, "model")
        .addEdge("tool", "model");

    return workflow.compile({ checkpointer: new MemorySaver() });
}

// Prepare user message for the graph
function setInput(input) {
    return {
        messages: [
            {
                role: "system",
                content:
                    "You are DeSmond, a knowledgeable and friendly assistant. Focus on providing insights and guidance across various topics without returning code snippets. Maintain a professional and warm tone, adapting responses to suit user needs.",
            },
            {
                role: "user",
                content: input,
            },
        ],
    };
}

// Core function to run the message through the LangGraph agent
async function invokeAgent(message, contextData, graph) {
    const input = setInput(message);
    const context = config(contextData);
    console.log("Invoking Agent with Input:", input.messages[1].content);
    
    const output = await graph.invoke(input, context);
    
    const finalMessage = output.messages[output.messages.length - 1];
    
    const tool = output.messages[2]?.["tool_calls"]?.[0]?.name ?? null; 
    
    let finalContent = finalMessage.content;
    
    return { status: "success", message: finalContent, last_tool: tool };
}

// HCS listener and response handler
async function handleIncomingHcsMessage(processedMessage, handler, graph) {
    const senderId = processedMessage.senderId;
    
    const { 
        text: { message, context },
        requestId,
    } = processedMessage.message;
    
    console.log(`\n[HCS RECV] From: ${senderId}, Request ID: ${requestId}, Message: "${message}"`);

    try {
        const agentResponse = await invokeAgent(message, context, graph);
        
        const replyPayload = {
            ...agentResponse,
            requestId: requestId, // Send back original request ID
        };

        await handler.sendMessage(replyPayload, senderId);
        
        console.log(`[HCS SENT] Reply sent successfully to ${senderId} (Request ID: ${requestId}).`);
        
    } catch (error) {
        console.error(
            `CRITICAL ERROR: Failed to process or respond to message from ${senderId}. Error: ${error.message}`
        );
        await handler.sendMessage({ 
            status: "error", 
            message: "An internal processing error occurred.", 
            requestId: requestId 
        }, senderId);
    }
}

// Main execution function
async function main() {
    console.log("Starting Agent 1 in load-only, event-driven mode...");

    const graph = createWorkflow();
    const myKeys = loadAgentKeys();

    let agentHubPublicKey;
    try {
        console.log(
            `\nAttempting to read Agent Hub Public Key from: ${KEY_PATHS.AGENT_HUB_PUBLIC}`
        );
        agentHubPublicKey = fs.readFileSync(KEY_PATHS.AGENT_HUB_PUBLIC, "utf8");
        console.log("SUCCESS: Agent Hub Public Key loaded.");
    } catch (error) {
        console.error(
            `\nFATAL ERROR: Could not read Agent Hub Public Key file: ${KEY_PATHS.AGENT_HUB_PUBLIC}`
        );
        throw error;
    }

    const recipientPublicKeys = {
        [AGENT_CONFIG.AGENT_HUB_ACCOUNT_ID]: agentHubPublicKey,
    };

    // Initialize Hedera SDK client for HCS
    const hcsClient = new HCS10Client({
        network: "mainnet",
        operatorId: AGENT_CONFIG.MY_ACCOUNT_ID,
        operatorPrivateKey: MY_PRIVATE_KEY.toStringRaw(),
        logLevel: "silent",
    });

    // Communication Handler setup
    const handler = new AgentCommunicationHandler(
        hcsClient,
        AGENT_CONFIG.CONNECTION_TOPIC_ID,
        AGENT_CONFIG.MY_ACCOUNT_ID,
        myKeys.privateKey,
        recipientPublicKeys,
        [AGENT_CONFIG.AGENT_HUB_ACCOUNT_ID]
    );

    console.log("\nAgent 1 ready. Starting HCS monitoring...");

    // Attach HCS message listener
    handler.on("messageReceived", (message) => {
        handleIncomingHcsMessage(message, handler, graph);
    });

    // Attach error listener
    handler.on("error", (err) => {
        console.error(
            "[HANDLER ERROR] A communication or processing error occurred:",
            err.message
        );
    });

    // Start monitoring HCS topic
    await handler.monitorConnectionMessages();
}

main().catch(console.error);