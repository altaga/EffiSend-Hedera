const functions = require('@google-cloud/functions-framework');
const Firestore = require("@google-cloud/firestore");
const {
  Hbar,
  Client,
  PrivateKey,
  TransferTransaction,
} = require("@hashgraph/sdk");
const fs = require("node:fs");

const db = new Firestore({
  projectId: "effisend",
  keyFilename: "credential.json",
});

const Accounts = db.collection("AccountsHedera");

const { privateKey, accountId: cloudAccountId } = JSON.parse(
  fs.readFileSync(
    "keypair.json",
    "utf8"
  )
);
const cloudPrivateKey = PrivateKey.fromStringDer(privateKey);

const client = Client.forMainnet();
client.setOperator(cloudAccountId, cloudPrivateKey);
client.setDefaultMaxTransactionFee(new Hbar(100));
client.setDefaultMaxQueryPayment(new Hbar(50));

functions.http('helloHttp', async (req, res) => {
  try {
    const _accountId = req.body.accountId
    let query = await Accounts.where("accountId", "==", _accountId).get();
    if (!query.empty) {
      const { rewards, user } = query.docs[0].data();
      if (rewards <= 0) {
        throw "NO REWARDS"
      }
      const token = "0.0.731861"; // SAUCE TOKEN
      const transaction = await new TransferTransaction()
        .addTokenTransfer(token, cloudAccountId, -rewards * Math.pow(10, 6))
        .addTokenTransfer(token, _accountId, rewards * Math.pow(10, 6))
        .freezeWith(client);
      const signTx = await transaction.sign(cloudPrivateKey);
      const txResponse = await signTx.execute(client);
      const transactionReceipt = await txResponse.getRecord(client);
      const dataFrameTemp = query.docs[0].data();
      const dataframe = {
        ...dataFrameTemp,
        rewards: "0"
      }
      await Accounts.doc(user).set(dataframe);
      res.send({
        error: null,
        result: {
          hash: Buffer.from(transactionReceipt.transactionHash).toString(
            'hex',
          )
        }
      });
    } else {
      res.send({
        error: "BAD ADDRESS",
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