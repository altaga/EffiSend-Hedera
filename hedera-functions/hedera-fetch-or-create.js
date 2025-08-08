const functions = require('@google-cloud/functions-framework');
const Firestore = require("@google-cloud/firestore");
const {
  Hbar,
  Client,
  AccountCreateTransaction,
  PrivateKey
} = require("@hashgraph/sdk");
const fs = require("node:fs");

const { privateKey: cloudPrivateKey, accountId: cloudAccountId } = JSON.parse(
  fs.readFileSync(
    "keypair.json",
    "utf8"
  )
);

const client = Client.forMainnet();
client.setOperator(cloudAccountId, cloudPrivateKey);
client.setDefaultMaxTransactionFee(new Hbar(100));
client.setDefaultMaxQueryPayment(new Hbar(50));

const db = new Firestore({
  projectId: "effisend",
  keyFilename: "credential.json",
});

const Accounts = db.collection("AccountsHedera");

functions.http('helloHttp', async (req, res) => {
  try {
    const user = req.body.user
    if(!isValidUUID(user)) throw "USER BAD FORMAT";
    let query = await Accounts.where("user", "==", user).get();
    if (query.empty) {
      const newAccountPrivateKey = PrivateKey.generateED25519();
      const newAccountPublicKey = newAccountPrivateKey.publicKey;
      const newAccount = await new AccountCreateTransaction()
        .setMaxAutomaticTokenAssociations(-1)
        .setKey(newAccountPublicKey)
        .setInitialBalance(Hbar.fromTinybars(0))
        .execute(client);
      const getReceipt = await newAccount.getReceipt(client);
      const dataframe = {
        accountId: getReceipt.accountId.toString(),
        address: newAccountPublicKey.toStringDer(),
        privateKey: newAccountPrivateKey.toStringDer(),
        user,
        rewards: "1"
      }
      await Accounts.doc(user).set(dataframe);
      res.send({
        error: null,
        result: {
          accountId:getReceipt.accountId.toString(),
          user,
        }
      });
    } else {
      const { user, accountId } = query.docs[0].data();
      res.send({
        error: null,
        result: {
          accountId,
          user,
        }
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
