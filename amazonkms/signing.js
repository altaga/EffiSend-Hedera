import { DescribeKeyCommand, GetPublicKeyCommand, KMSClient, ListResourceTagsCommand, SignCommand } from "@aws-sdk/client-kms";
import { Hbar, Client as HederaClient, PrivateKey as HederaPrivateKey, PublicKey as HederaPublicKey, TransferTransaction } from "@hashgraph/sdk";
import { keccak256 } from "ethers";

const kmsClient = new KMSClient({});

export const handleHedera = async ({ user, accountData, tokenInfo, amount, to }) => {
    const client = HederaClient.forMainnet();
    client.setDefaultMaxTransactionFee(new Hbar(1));

    const tokenId = tokenInfo.accountId || tokenInfo.address || tokenInfo.symbol;
    const kmsKeyAlias = `alias/${user}`;

    let useKms = false;
    let kmsPublicKey;
    let hederaAccountId = accountData?.hedera?.accountId;

    // 1. Check for KMS and Fetch Account ID directly from Tags
    try {
        const getPublicKeyCommand = new GetPublicKeyCommand({ KeyId: kmsKeyAlias });
        const publicKeyResponse = await kmsClient.send(getPublicKeyCommand);
        const publicKeyBytes = Buffer.from(publicKeyResponse.PublicKey);
        kmsPublicKey = HederaPublicKey.fromBytesECDSA(publicKeyBytes);

        const describeCmd = new DescribeKeyCommand({ KeyId: kmsKeyAlias });
        const describeRes = await kmsClient.send(describeCmd);
        const actualKeyId = describeRes.KeyMetadata.KeyId;

        const tagsCmd = new ListResourceTagsCommand({ KeyId: actualKeyId });
        const tagsRes = await kmsClient.send(tagsCmd);

        const accountIdTag = tagsRes.Tags?.find(t => t.TagKey === "AccountId");
        if (accountIdTag && accountIdTag.TagValue) {
            hederaAccountId = accountIdTag.TagValue;
        }

        useKms = true;
    } catch (error) {
        if (error.name !== "NotFoundException" && error.name !== "ResourceNotFoundException") {
            throw error;
        }
    }

    if (!hederaAccountId) {
        throw new Error("NO HEDERA WALLET FOUND (Not in KMS Tags or DynamoDB)");
    }

    // --- Dynamic Memo Selection ---
    const memo = useKms ? "Signed by AWS KMS" : "Signed with Native Signer";

    // 2. Configure the Client Operator
    if (useKms) {
        const kmsSigner = async (message) => {
            const digestHex = keccak256(message);
            const digestBytes = Buffer.from(digestHex.slice(2), 'hex');

            const signCommand = new SignCommand({
                KeyId: kmsKeyAlias,
                Message: digestBytes,
                MessageType: "DIGEST",
                SigningAlgorithm: "ECDSA_SHA_256"
            });
            const signResponse = await kmsClient.send(signCommand);
            return extractRawSignatureFromDER(Buffer.from(signResponse.Signature));
        };
        client.setOperatorWith(hederaAccountId, kmsPublicKey, kmsSigner);
    } else {
        if (!accountData.hedera?.privateKeyDer) {
            throw new Error("NO HEDERA PRIVATE KEY FOUND FOR TRADITIONAL SIGNING");
        }
        const privateKey = HederaPrivateKey.fromStringDer(accountData.hedera.privateKeyDer);
        client.setOperator(hederaAccountId, privateKey);
    }

    // 3. Execute the Transaction with the selected Memo
    try {
        return await executeHederaTransfer(client, hederaAccountId, tokenId, to, amount, tokenInfo.decimals, memo);
    } finally {
        client.close();
    }
};

// --- Helper Functions ---

async function executeHederaTransfer(client, senderId, tokenId, to, amount, decimals, memo) {
    let transaction;

    if (tokenId === "0.0.0" || tokenId === "0.0.000000" || tokenId.toLowerCase() === "hbar") {
        transaction = new TransferTransaction()
            .addHbarTransfer(senderId, Hbar.from(-amount))
            .addHbarTransfer(to, Hbar.from(amount));
    } else {
        const atomicAmount = Math.round(amount * Math.pow(10, decimals));
        transaction = new TransferTransaction()
            .addTokenTransfer(tokenId, senderId, -atomicAmount)
            .addTokenTransfer(tokenId, to, atomicAmount);
    }

    // Apply the audit memo to the transaction
    transaction.setTransactionMemo(memo);

    const txResponse = await transaction.execute(client);
    await txResponse.getReceipt(client);

    return txResponse.transactionId.toString();
}

/**
 * Strips ASN.1 DER formatting from AWS KMS signatures to return a raw 64-byte signature.
 */
function extractRawSignatureFromDER(derBuffer) {
    let offset = 0;
    if (derBuffer[offset++] !== 0x30) throw new Error("Invalid DER Signature");
    offset++;

    if (derBuffer[offset++] !== 0x02) throw new Error("Invalid DER 'r'");
    const rLen = derBuffer[offset++];
    let rBuffer = derBuffer.subarray(offset, offset + rLen);
    offset += rLen;

    if (derBuffer[offset++] !== 0x02) throw new Error("Invalid DER 's'");
    const sLen = derBuffer[offset++];
    let sBuffer = derBuffer.subarray(offset, offset + sLen);

    if (rBuffer.length === 33 && rBuffer[0] === 0x00) rBuffer = rBuffer.subarray(1);
    if (sBuffer.length === 33 && sBuffer[0] === 0x00) sBuffer = sBuffer.subarray(1);

    const r32 = Buffer.alloc(32);
    rBuffer.copy(r32, 32 - rBuffer.length);

    const s32 = Buffer.alloc(32);
    sBuffer.copy(s32, 32 - sBuffer.length);

    return Buffer.concat([r32, s32]);
}