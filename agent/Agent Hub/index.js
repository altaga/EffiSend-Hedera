import { PrivateKey } from "@hashgraph/sdk";
import { HCS10Client } from "@hashgraphonline/standards-sdk";
import * as crypto from "crypto";
import * as fs from "fs";
import AgentCommunicationHandler from "./lib.js";
import { HybridEncryption } from "./lib.js";
import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Hedera Network and Agent Identities
const privatKeyDer =
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const MY_ACCOUNT_ID = "x.x.xxxxxxx";
const CONNECTION_TOPIC_ID = "x.x.xxxxxxx";
const AGENT1_ACCOUNT_ID = "x.x.xxxxxxx";
const AUTHORIZED_CLIENTS = [AGENT1_ACCOUNT_ID, AGENT2_ACCOUNT_ID, AGENT3_ACCOUNT_ID]; 
// List of authorized agents [AGENT1_ACCOUNT_ID, AGENT2_ACCOUNT_ID, AGENT3_ACCOUNT_ID......, AGENTN_ACCOUNT_ID]

const MY_PRIVATE_KEY = PrivateKey.fromStringDer(privatKeyDer);

// Key Paths
const agent1PublicKeyPath = path.join(
    __dirname,
    "./keys/xxxxxxxxxxxxxxxxxxxxxx"
);
if (!fs.existsSync(agent1PublicKeyPath)) {
    throw new Error(
        `Public key file not found at ${agent1PublicKeyPath}. Please ensure Agent 1's key is present.`
    );
}
const agent1PublicKey = fs.readFileSync(agent1PublicKeyPath, "utf8");

const recipientPublicKeys = {
    [AGENT1_ACCOUNT_ID]: agent1PublicKey,
};

// Utility to generate or load RSA keys for the Hub Agent
function generateOrLoadKeys() {
    const privateKeyPath = path.join(__dirname, "./keys/xxxxxxxxxxxxxxxxxxxx");
    const publicKeyPath = path.join(__dirname, "./keys/xxxxxxxxxxxxxxxxxxxxx");
    if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
        console.log("Existing RSA keys found and loaded.");
        return {
            privateKey: fs.readFileSync(privateKeyPath, "utf8"),
            publicKey: fs.readFileSync(publicKeyPath, "utf8"),
        };
    }
    console.log("Generating new RSA key pair for the Hub Agent...");
    const { privateKey, publicKey } = HybridEncryption.generateKeyPair(2048);
    fs.writeFileSync(privateKeyPath, privateKey);
    fs.writeFileSync(publicKeyPath, publicKey);
    console.log("New keys saved to files.");
    return { privateKey, publicKey };
}

// WebSocket Setup
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Tracking Maps
let connectionId = 1;
const wsToId = new Map();
const idToWs = new Map();
const pendingRequests = new Map();

// Generates a unique request ID.
function guid() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// HCS Agent Initialization
const myKeys = generateOrLoadKeys();
const client = new HCS10Client({
    network: "mainnet",
    operatorId: MY_ACCOUNT_ID,
    operatorPrivateKey: MY_PRIVATE_KEY.toStringRaw(),
    logLevel: "silent",
});

// Agent Communication Handler (Hub logic)
const handler = new AgentCommunicationHandler(
    client,
    CONNECTION_TOPIC_ID,
    MY_ACCOUNT_ID,
    myKeys.privateKey,
    recipientPublicKeys,
    AUTHORIZED_CLIENTS
);

// Listener for decrypted messages coming FROM Agent 1 (the reply)
handler.on("messageReceived", (event) => {
    const message = event.message;
    const senderId = event.senderId;

    console.log(`[RECV Agent ${senderId}] Decrypted message:`, message);

    if (message && message.requestId && pendingRequests.has(message.requestId)) {
        const wsId = pendingRequests.get(message.requestId);

        const ws = idToWs.get(wsId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            delete message.requestId;
            // Send the decrypted response to the originating client
            ws.send(JSON.stringify(message));
        }
        pendingRequests.delete(message.requestId); // Clean up the request tracker
    } else {
        console.warn(
            "Received HCS message without a matching pending request or malformed payload."
        );
    }
});

handler.on("error", (error) => {
    console.error(
        `[HANDLER ERROR] An error occurred in the communication handler: ${error.message}`
    );
});

// Start monitoring incoming HCS messages
handler.monitorConnectionMessages();

// WebSocket Server Logic
wss.on("connection", (ws) => {
    const id = connectionId++;
    wsToId.set(ws, id);
    idToWs.set(id, ws);
    ws.isAlive = true;
    ws.on("pong", () => {
        ws.isAlive = true;
    });
    console.log(`Client #${id} connected`);

    ws.on("message", async (message) => {
        const textMessage = message.toString();
        console.log(`Received from client #${id}: ${textMessage}`); 

        const requestId = guid();
        pendingRequests.set(requestId, id); // Map HCS request ID to WebSocket ID

        try {
            // Forward message to Agent 1 via HCS
            await handler.sendMessage(
                {
                    requestId: requestId, // Key for routing the reply back
                    text: JSON.parse(textMessage),
                    from: MY_ACCOUNT_ID,
                },
                AGENT1_ACCOUNT_ID
            );
            console.log(
                `Prompt forwarded to Agent 1 with Account ID: ${AGENT1_ACCOUNT_ID}`
            );
        } catch (error) {
            console.error(`Failed to forward message to Agent 1: ${error.message}`);
            ws.send(`[ERROR] Failed to send message to Agent 1: ${error.message}`);
            pendingRequests.delete(requestId);
        }
    });

    ws.on("close", () => {
        console.log(`Client #${wsToId.get(ws)} disconnected`);
        const closedId = wsToId.get(ws);
        wsToId.delete(ws);
        idToWs.delete(closedId);

        // Clean up pending requests tied to this client
        for (const [rId, userId] of pendingRequests.entries()) {
            if (userId === closedId) pendingRequests.delete(rId);
        }
    });
});

// Heartbeat Keepalive Interval
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log(`Terminating dead client ${wsToId.get(ws)}`);
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on("close", () => {
    clearInterval(interval);
});

// Start Server
server.listen(3000, () => {
    console.log("Server running on port 3000");
});