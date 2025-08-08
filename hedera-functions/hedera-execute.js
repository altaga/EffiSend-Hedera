const functions = require('@google-cloud/functions-framework');
const Firestore = require("@google-cloud/firestore");
const { tokens } = require("./constants.js")
const {
    Hbar,
    Client,
    TransferTransaction,
    PrivateKey
} = require("@hashgraph/sdk");

const db = new Firestore({
    projectId: "effisend",
    keyFilename: "credential.json",
});

const Accounts = db.collection("AccountsHedera");

functions.http('helloHttp', async (req, res) => {
    try {
        const user = req.body.user
        if (!isValidUUID(user)) throw "USER BAD FORMAT";
        let query = await Accounts.where("user", "==", user).get();
        if (!query.empty) {
            const { amount, to, id } = req.body;
            const token = tokens[id].accountId;
            const { accountId, privateKey: privateKeyUser } = query.docs[0].data();
            const privateKey = PrivateKey.fromStringDer(privateKeyUser);
            const client = Client.forMainnet();
            client.setOperator(accountId, privateKey);
            client.setDefaultMaxTransactionFee(new Hbar(100));
            client.setDefaultMaxQueryPayment(new Hbar(50));
            let transactionReceipt;
            if (token === '0.0.000000') {
                const txResponse = await new TransferTransaction()
                    .addHbarTransfer(accountId, Hbar.from(-amount))
                    .addHbarTransfer(to, Hbar.from(amount))
                    .execute(client);
                transactionReceipt = txResponse.transactionId.toString();
            }
            else {
                const { decimals } = tokens.find((_token) => _token.accountId === token)
                const transaction = await new TransferTransaction()
                    .addTokenTransfer(token, accountId, -amount * Math.pow(10, decimals))
                    .addTokenTransfer(token, to, amount * Math.pow(10, decimals))
                    .freezeWith(client);
                const signTx = await transaction.sign(privateKey);
                const txResponse = await signTx.execute(client);
                transactionReceipt = txResponse.transactionId.toString();
            }
            console.log(`https://hashscan.io/mainnet/transaction/${transactionReceipt}`)
            res.send({
                error: null,
                result: {
                    hash: transactionReceipt
                }
            });
        } else {
            res.send({
                error: "BAD USER",
                result: null
            });
        }
    }
    catch (e) {
        console.log(e)
        res.send({
            error: "BAD REQUEST",
            result: null
        });
    }
});

function extractUUID(input) {
    const match = input.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
    return match ? match[0] : null;
}

function isValidUUID(input) {
    const uuid = extractUUID(input);
    const regex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
    return regex.test(uuid);
}
