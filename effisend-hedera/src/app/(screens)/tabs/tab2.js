import { fetch } from "expo/fetch";
import { Component, Fragment } from "react";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import VirtualKeyboard from "react-native-virtual-keyboard";
import checkMark from "../../../assets/images/checkMark.png";
import CamFace from "../../../components/camFace";
import CamQR from "../../../components/camQR";
import { blockchain } from "../../../core/constants";
import GlobalStyles, {
  mainColor,
  secondaryColor,
  tertiaryColor,
} from "../../../core/styles";
import {
  deleteLeadingZeros,
  formatInputText,
  normalizeFontSize,
  rgbaToHex,
  setAsyncStorageValue,
} from "../../../core/utils";
import { useHOCS } from "../../../hocs/useHOCS";
import ContextModule from "../../../providers/contextModule";
import { formatUnits } from "ethers";

const BaseStateTab2 = {
  // Base
  balances: blockchain.tokens.map(() => 0),
  activeTokens: blockchain.tokens.map(() => false),
  stage: 0, // 0
  amount: "0.00", // "0.00"
  kindPayment: 0, // 0
  // wallets
  user: "",
  accountId: "",
  // Extra
  explorerURL: "",
  hash: "",
  transactionDisplay: {
    amount: "0.00",
    name: blockchain.tokens[0].symbol,
    tokenAddress: blockchain.tokens[0].accountId,
    icon: blockchain.tokens[0].icon,
    chain: 0,
  },
  destinationChain: 0,
  // QR print
  saveData: "",
  // Utils
  take: false,
  loading: false,
};

class Tab2 extends Component {
  constructor(props) {
    super(props);
    this.state = BaseStateTab2;
    this.controller = new AbortController();
    this.svg = null;
  }

  static contextType = ContextModule;

  async getDataURL() {
    return new Promise(async (resolve, reject) => {
      this.svg.toDataURL(async (data) => {
        this.setState(
          {
            saveData: data,
          },
          () => resolve("ok")
        );
      });
    });
  }

  async encryptData(data) {
    return new Promise((resolve, reject) => {
      const myHeaders = new Headers();
      myHeaders.append("Content-Type", "application/json");

      const raw = JSON.stringify({
        data,
      });

      const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow",
      };

      fetch(`/api/encrypt`, requestOptions)
        .then((response) => response.json())
        .then((result) => resolve(result))
        .catch((error) => console.error(error));
    });
  }

  printURL() {
    window.open(
      `/receipt?kindPayment=${this.state.kindPayment}&amount=${this.state.transactionDisplay.amount}&name=${this.state.transactionDisplay.name}&hash=${this.state.hash}`,
      "_blank"
    );
  }

  componentDidMount() {
    this.setState(BaseStateTab2);
  }

  async payFromAnySource(i) {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    const raw = JSON.stringify({
      user: this.state.user,
      id: i,
      amount: (this.state.amount / this.context.value.usdConversion[i]).toFixed(
        blockchain.tokens[i].decimals
      ),
      to: this.context.value.accountId,
    });
    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };
    fetch(`/api/executePayment`, requestOptions)
      .then((response) => response.json())
      .then(async (result) => {
        console.log(result);
        if (result.error === null) {
          await this.setStateAsync({
            status: "Confirmed",
            loading: false,
            explorerURL: `${blockchain.blockExplorer}transaction/${result.result.hash}`,
            hash: result.result.hash,
          });
        }
      })
      .catch((error) => console.error(error));
  }

  async fetchPayment(kind, data) {
    let raw;
    if (kind === 0) {
      raw = JSON.stringify({
        nonce: data,
      });
    } else if (kind === 1) {
      raw = JSON.stringify({
        user: data,
      });
    }
    return new Promise((resolve, reject) => {
      const myHeaders = new Headers();
      myHeaders.append("Content-Type", "application/json");

      const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow",
      };

      fetch("/api/fetchPayment", requestOptions)
        .then((response) => response.json())
        .then((result) => resolve(result))
        .catch((error) => console.error(error));
    });
  }

  async getUSD() {
    const array = blockchain.tokens.map((token) => token.coingecko);
    var myHeaders = new Headers();
    myHeaders.append("accept", "application/json");
    var requestOptions = {
      signal: this.controller.signal,
      method: "GET",
      headers: myHeaders,
      redirect: "follow",
    };
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${array.toString()}&vs_currencies=usd`,
      requestOptions
    );
    const result = await response.json();
    const usdConversion = array.map((x) => result[x].usd);
    await setAsyncStorageValue({ usdConversion });
    this.context.setValue({ usdConversion });
  }

  hederaGetBalance = async () => {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    const raw = JSON.stringify({
      accountId: this.state.accountId,
    });
    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };
    return new Promise((resolve) => {
      fetch(`/api/hederaGetBalance`, requestOptions)
        .then((response) => response.json())
        .then((result) => resolve(result))
        .catch(() => resolve({ result: null, error: "BAD REQUEST" }));
    });
  };

  async getBalances() {
    const { result } = await this.hederaGetBalance();
    console.log(result);
    const balances = blockchain.tokens.map((token, index) => {
      if (index === 0) {
        return parseFloat(result.hbar);
      } else {
        try {
          return parseFloat(
            formatUnits(result.tokens[token.accountId].low, token.decimals)
          );
        } catch (e) {
          return 0.0;
        }
      }
    });
    console.log(2>1);
    const activeTokens = balances.map(
      (balance, i) =>
        balance >
        parseFloat(deleteLeadingZeros(formatInputText(this.state.amount))) /
          this.context.value.usdConversion[i]
    );
    await this.setStateAsync({
      balances,
      activeTokens,
    });
  }

  async fetchFaceID(image) {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    const raw = JSON.stringify({
      image,
    });
    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };
    return new Promise((resolve) => {
      fetch(`/api/fetchFaceID`, requestOptions)
        .then((response) => response.json())
        .then((result) => resolve(result))
        .catch(() => resolve(null));
    });
  }

  // Utils
  async setStateAsync(value) {
    return new Promise((resolve) => {
      this.setState(
        {
          ...value,
        },
        () => resolve()
      );
    });
  }

  render() {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={[GlobalStyles.scrollContainer]}
        contentContainerStyle={[
          GlobalStyles.scrollContainerContent,
          { width: "90%", alignSelf: "center" },
        ]}
      >
        {this.state.stage === 0 && (
          <Fragment>
            <Text style={GlobalStyles.title}>Enter Amount (USD)</Text>
            <Text style={{ fontSize: 36, color: "white" }}>
              {deleteLeadingZeros(formatInputText(this.state.amount))}
            </Text>
            <VirtualKeyboard
              style={{
                fontSize: 40,
                textAlign: "center",
                marginTop: -10,
              }}
              cellStyle={{
                width: normalizeFontSize(100),
                height: normalizeFontSize(50),
                borderWidth: 1,
                borderColor: rgbaToHex(255, 255, 255, 20),
                borderRadius: 5,
                margin: 3,
              }}
              rowStyle={{
                width: "100%",
              }}
              color="white"
              pressMode="string"
              onPress={(amount) => this.setState({ amount })}
              decimal
            />
            <View
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                width: "100%",
              }}
            >
              <Pressable
                style={[
                  GlobalStyles.buttonStyle,
                  {
                    backgroundColor: secondaryColor,
                    borderColor: secondaryColor,
                  },
                ]}
                onPress={() => this.setState({ stage: 1, kindPayment: 0 })}
              >
                <Text style={GlobalStyles.buttonText}>Pay with QR</Text>
              </Pressable>
              <Pressable
                style={[
                  GlobalStyles.buttonStyle,
                  {
                    backgroundColor: tertiaryColor,
                    borderColor: tertiaryColor,
                  },
                ]}
                onPress={() => this.setState({ stage: 1, kindPayment: 1 })}
              >
                <Text style={GlobalStyles.buttonText}>Pay with FaceID</Text>
              </Pressable>
            </View>
          </Fragment>
        )}
        {this.state.stage === 1 && this.state.kindPayment === 0 && (
          <Fragment>
            <View style={{ alignItems: "center" }}>
              <Text style={GlobalStyles.title}>Amount (USD)</Text>
              <Text style={{ fontSize: 36, color: "white" }}>
                $ {deleteLeadingZeros(formatInputText(this.state.amount))}
              </Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={GlobalStyles.title}>QR Code</Text>
            </View>
            <View
              style={{
                height: "auto",
                width: "90%",
                marginVertical: 20,
                borderColor: this.state.loading ? mainColor : secondaryColor,
                borderWidth: 5,
                borderRadius: 10,
                aspectRatio: 1,
              }}
            >
              <CamQR
                facing={"back"}
                callbackAddress={async (nonce) => {
                  try {
                    await this.setStateAsync({ loading: true });
                    const {
                      result: { accountId, user },
                    } = await this.fetchPayment(0, nonce);
                    await this.setStateAsync({ accountId, user });
                    await this.getUSD();
                    await this.getBalances();
                    await this.setStateAsync({
                      loading: false,
                      stage: 2,
                    });
                  } catch (error) {
                    console.log(error);
                    this.setState(BaseStateTab2);
                  }
                }}
              />
            </View>
            <View
              key={"This element its only to align the QR reader in center"}
            />
          </Fragment>
        )}
        {this.state.stage === 1 && this.state.kindPayment === 1 && (
          <Fragment>
            <View style={{ alignItems: "center" }}>
              <Text style={GlobalStyles.title}>Amount (USD)</Text>
              <Text style={{ fontSize: 36, color: "white" }}>
                $ {deleteLeadingZeros(formatInputText(this.state.amount))}
              </Text>
            </View>
            <View>
              <Text style={{ color: "white", fontSize: 28 }}>FaceID</Text>
            </View>
            <View
              style={{
                height: "auto",
                width: "90%",
                marginVertical: 20,
                borderColor: this.state.loading ? mainColor : secondaryColor,
                borderWidth: 5,
                borderRadius: 10,
                aspectRatio: 1,
              }}
            >
              <CamFace
                facing={"back"}
                take={this.state.take}
                onImage={async (image) => {
                  try {
                    const { result: user } = await this.fetchFaceID(image);
                    const {
                      result: { accountId },
                    } = await this.fetchPayment(1, user);
                    console.log(accountId);
                    await this.setStateAsync({ accountId, user });
                    await this.getUSD();
                    await this.getBalances();
                    await this.setStateAsync({
                      loading: false,
                      stage: 2,
                    });
                  } catch (error) {
                    console.log(error);
                    this.setState(BaseStateTab2);
                  }
                }}
              />
            </View>
            <Pressable
              disabled={this.state.loading}
              style={[
                GlobalStyles.buttonStyle,
                this.state.loading ? { opacity: 0.5 } : {},
              ]}
              onPress={() =>
                this.setState({ take: true, loading: true }, () => {
                  this.setState({
                    take: false,
                  });
                })
              }
            >
              <Text style={[GlobalStyles.buttonText]}>
                {this.state.loading ? "Processing..." : "Take Picture"}
              </Text>
            </Pressable>
          </Fragment>
        )}
        {this.state.stage === 2 && (
          <Fragment>
            <Text
              style={{
                fontSize: 28,
                color: "white",
                textAlign: "center",
              }}
            >
              {this.state.accountId}
            </Text>
            <Text style={[GlobalStyles.titlePaymentToken]}>
              Select Payment Token
            </Text>
            <View style={{ width: "90%", flex: 1 }}>
              {blockchain.tokens.map((token, i) =>
                this.state.activeTokens[i] ? (
                  <View
                    key={`${token.name}-${i}`}
                    style={{
                      paddingBottom: 20,
                      marginBottom: 20,
                    }}
                  >
                    <Pressable
                      disabled={this.state.loading}
                      style={[
                        GlobalStyles.buttonStyle,
                        this.state.loading ? { opacity: 0.5 } : {},
                        {
                          backgroundColor: token.color,
                          borderColor: token.color,
                        },
                      ]}
                      onPress={async () => {
                        try {
                          await this.setStateAsync({
                            transactionDisplay: {
                              amount: (
                                this.state.amount /
                                this.context.value.usdConversion[i]
                              ).toFixed(6),
                              name: token.symbol,
                              icon: token.icon,
                            },
                            status: "Processing...",
                            stage: 3,
                            explorerURL: "",
                            loading: true,
                          });
                          await this.payFromAnySource(i);
                        } catch (error) {
                          console.log(error);
                          await this.setStateAsync({ loading: false });
                        }
                      }}
                    >
                      <Text style={GlobalStyles.buttonText}>{token.name}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Fragment key={`${token.name}-${i}`} />
                )
              )}
            </View>
          </Fragment>
        )}
        {
          // Stage 3
          this.state.stage === 3 && (
            <Fragment>
              <Image
                source={checkMark}
                alt="check"
                style={{ width: "60%", height: "auto", aspectRatio: 1 }}
              />
              <Text
                style={{
                  textShadowRadius: 1,
                  fontSize: 28,
                  fontWeight: "bold",
                  color:
                    this.state.explorerURL === "" ? secondaryColor : mainColor,
                }}
              >
                {this.state.explorerURL === "" ? "Processing..." : "Completed"}
              </Text>
              <View
                style={[
                  GlobalStyles.network,
                  {
                    width: "100%",
                  },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 10,
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 20, color: "white" }}>
                      Transaction
                    </Text>
                    <Text style={{ fontSize: 14, color: "white" }}>
                      {this.state.kindPayment === 0
                        ? "QR Payment"
                        : "FaceID Payment"}
                    </Text>
                  </View>
                </View>
                {this.state.transactionDisplay.icon}
                <Text style={{ color: "white" }}>
                  {`${deleteLeadingZeros(
                    formatInputText(this.state.transactionDisplay.amount)
                  )}`}{" "}
                  {this.state.transactionDisplay.name}
                </Text>
                <View style={{ width: 0, height: 1 }} />
              </View>
              <View style={GlobalStyles.buttonContainer}>
                <Pressable
                  disabled={this.state.explorerURL === ""}
                  style={[
                    GlobalStyles.buttonStyle,
                    this.state.explorerURL === ""
                      ? { opacity: 0.5, borderColor: "black" }
                      : {},
                  ]}
                  onPress={() => Linking.openURL(this.state.explorerURL)}
                >
                  <Text style={GlobalStyles.buttonText}>View on Explorer</Text>
                </Pressable>
                <Pressable
                  style={[
                    GlobalStyles.buttonStyle,
                    {
                      backgroundColor: secondaryColor,
                      borderColor: secondaryColor,
                    },
                    this.state.explorerURL === ""
                      ? { opacity: 0.5, borderColor: "black" }
                      : {},
                  ]}
                  onPress={async () => {
                    this.printURL(this.state.explorerURL);
                  }}
                  disabled={this.state.explorerURL === ""}
                >
                  <Text style={GlobalStyles.buttonText}>Show Receipt</Text>
                </Pressable>
                <Pressable
                  style={[
                    GlobalStyles.buttonStyle,
                    {
                      backgroundColor: tertiaryColor,
                      borderColor: tertiaryColor,
                    },
                    this.state.explorerURL === ""
                      ? { opacity: 0.5, borderColor: "black" }
                      : {},
                  ]}
                  onPress={async () => {
                    this.setState({
                      stage: 0,
                      explorerURL: "",
                      check: "Check",
                      errorText: "",
                      amount: "0.00", // "0.00"
                    });
                  }}
                  disabled={this.state.explorerURL === ""}
                >
                  <Text style={GlobalStyles.buttonText}>Done</Text>
                </Pressable>
              </View>
            </Fragment>
          )
        }
      </ScrollView>
    );
  }
}

export default useHOCS(Tab2);
