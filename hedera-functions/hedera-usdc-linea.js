const functions = require('@google-cloud/functions-framework');
const Firestore = require("@google-cloud/firestore");
const fs = require("node:fs");
const {
  DynamicProvider,
  FallbackStrategy,
} = require("ethers-dynamic-provider");
const {
  Contract,
  parseUnits,
  Wallet,
} = require("ethers");
const {
  abi: ERC20abi,
} = require("@openzeppelin/contracts/build/contracts/ERC20.json");
const {
  Hbar,
  Client,
  TransferTransaction,
  PrivateKey
} = require("@hashgraph/sdk");

function setupProvider(rpcs) {
  return new DynamicProvider(rpcs, {
    strategy: new FallbackStrategy(),
  });
}
const { accountId: cloudAccountId } = JSON.parse(
  fs.readFileSync(
    "accountHedera.json",
    "utf8"
  )
);

const { privateKey: privateKeyLinea } = JSON.parse(
  fs.readFileSync("accountLinea.json", "utf8")
);

const rpcs = [
  "https://linea-rpc.publicnode.com",
  "https://linea.drpc.org",
  "https://1rpc.io/linea",
  "https://rpc.linea.build/"
];

const providerLinea = setupProvider(rpcs);

const wallet = new Wallet(privateKeyLinea, providerLinea);
// USDC Contract Linea
const contract = new Contract("0x176211869ca2b568f2a7d4ee941e073a821ee1ff", ERC20abi, wallet);

const db = new Firestore({
  projectId: "effisend",
  keyFilename: "credential.json",
});

const Accounts = db.collection("AccountsHedera");

functions.http('helloHttp', async (req, res) => {
  try {
    const user = req.body.user
    let query = await Accounts.where("user", "==", user).get();
    if (!query.empty) {
      const { amount, to } = req.body;
      const { accountId, privateKey: privateKeyUser } = query.docs[0].data();
      const privateKey = PrivateKey.fromStringDer(privateKeyUser);
      const client = Client.forMainnet();
      client.setOperator(accountId, privateKey);
      client.setDefaultMaxTransactionFee(new Hbar(100));
      client.setDefaultMaxQueryPayment(new Hbar(50));
      let transactionReceipt;
      const transaction = await new TransferTransaction()
        .addTokenTransfer("0.0.456858", accountId, -amount * Math.pow(10, 6))
        .addTokenTransfer("0.0.456858", cloudAccountId, amount * Math.pow(10, 6))
        .freezeWith(client);
      const signTx = await transaction.sign(privateKey);
      const txResponse = await signTx.execute(client);
      transactionReceipt = txResponse.transactionId.toString();
      console.log(`https://hashscan.io/mainnet/transaction/${transactionReceipt}`)
      // Send tokent from our linea to address
      const transactionLinea = await contract.transfer(to,
        parseUnits(
          amount,
          6
        ))
      await transactionLinea.wait()
      console.log(`https://lineascan.build/tx/${transactionLinea.hash}`)
      res.send({
        error: null,
        result: {
          hash: transactionReceipt
        }
      });
    } else {
      console.log(e)
      res.send({
        error: "BAD USER",
        res: null
      });
    }
  }
  catch (e) {
    console.log(e)
    res.send({
      error: "BAD ERROR",
      res: null
    });
  }
});
