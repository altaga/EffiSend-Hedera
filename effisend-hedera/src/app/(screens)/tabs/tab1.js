import Clipboard from "@react-native-clipboard/clipboard";
import { formatUnits, randomBytes, uuidV4 } from "ethers";
import { LinearGradient } from "expo-linear-gradient";
import { fetch } from "expo/fetch";
import { Component, Fragment } from "react";
import {
  Keyboard,
  NativeEventEmitter,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  ToastAndroid,
  View,
} from "react-native";
import IconIonicons from "react-native-vector-icons/Ionicons";
import { Toast } from "toastify-react-native";
import QrAddress from "../../../components/qrAddress";
import { blockchain, refreshTime } from "../../../core/constants";
import GlobalStyles, { mainColor } from "../../../core/styles";
import {
  arraySum,
  epsilonRound,
  getAsyncStorageValue,
  getEncryptedStorageValue,
  normalizeFontSize,
  setAsyncStorageValue,
} from "../../../core/utils";
import { useHOCS } from "../../../hocs/useHOCS";
import ContextModule from "../../../providers/contextModule";

const baseTab1State = {
  // Transaction settings
  amount: "",
  loading: false,
  take: false,
  keyboardHeight: 0,
  selector: 0,
  qrData: "",
  cameraDelayLoading: false, // Force the camera to load when component is mounted and helps UX
};

class Tab1 extends Component {
  constructor(props) {
    super(props);
    this.state = baseTab1State;
    this.EventEmitter = new NativeEventEmitter();
    this.controller = new AbortController();
  }

  static contextType = ContextModule;

  async getlastRefresh() {
    try {
      const lastRefresh = await getAsyncStorageValue("lastRefresh");
      if (lastRefresh === null) throw "Set First Date";
      return lastRefresh;
    } catch (err) {
      await setAsyncStorageValue({ lastRefresh: 0 });
      return 0;
    }
  }

  async componentDidMount() {
    setTimeout(async () => {
      if (this.context.value.accountId !== "") {
        // Event Emitter
        this.EventEmitter.addListener("refresh", async () => {
          Keyboard.dismiss();
          await this.setStateAsync(baseTab1State);
          await setAsyncStorageValue({ lastRefresh: Date.now() });
          this.refresh();
        });
        // Get Last Refresh
        const lastRefresh = await this.getlastRefresh();
        if (Date.now() - lastRefresh >= refreshTime) {
          console.log("Refreshing...");
          await setAsyncStorageValue({ lastRefresh: Date.now() });
          this.refresh();
        } else {
          console.log(
            `Next refresh Available: ${Math.round(
              (refreshTime - (Date.now() - lastRefresh)) / 1000
            )} Seconds`
          );
        }
      }
    }, 1000);
    setTimeout(() => this.setState({ cameraDelayLoading: true }), 1);
  }

  componentWillUnmount() {
    this.EventEmitter.removeAllListeners("refresh");
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
    setAsyncStorageValue({ usdConversion });
    this.context.setValue({ usdConversion });
  }

  async refresh() {
    await this.setStateAsync({ refreshing: true });
    try {
      await Promise.all([this.getUSD(), this.getBalance()]);
    } catch (e) {
      console.log(e);
    }
    await this.setStateAsync({ refreshing: false });
  }

  hederaGetBalance = async () => {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    const raw = JSON.stringify({
      accountId: this.context.value.accountId,
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

  async getBalance() {
    const { result } = await this.hederaGetBalance();
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
    setAsyncStorageValue({ balances });
    this.context.setValue({ balances });
  }

  async createPayment(tempNonce) {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    const tempUser = await getEncryptedStorageValue("user");
    const raw = JSON.stringify({
      nonce: tempNonce,
      user: tempUser,
    });
    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };
    return new Promise((resolve) => {
      fetch(`/api/createPayment`, requestOptions)
        .then((response) => response.json())
        .then((result) => resolve(result.result))
        .catch(() => resolve(null));
    });
  }

  async createQR() {
    this.setState({
      loading: true,
    });
    const bytes = randomBytes(16);
    const noncePayment = uuidV4(bytes);
    const { res } = await this.createPayment(noncePayment);
    if (res === "BAD REQUEST") {
      await this.setStateAsync({
        loading: false,
      });
      return;
    }
    this.setState({
      loading: false,
      qrData: noncePayment,
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
        refreshControl={
          this.context.value.accountId !== "" && (
            <RefreshControl
              progressBackgroundColor={mainColor}
              refreshing={this.state.refreshing}
              onRefresh={async () => {
                await setAsyncStorageValue({
                  lastRefresh: Date.now().toString(),
                });
                await this.refresh();
              }}
            />
          )
        }
        style={[GlobalStyles.scrollContainer]}
        contentContainerStyle={[
          GlobalStyles.scrollContainerContent,
          { width: "90%", alignSelf: "center" },
        ]}
      >
        <LinearGradient
          style={{
            justifyContent: "center",
            alignItems: "center",
            width: "110%",
            marginTop: 20,
          }}
          colors={["#000000", "#010101", "#1a1a1a", "#010101", "#000000"]}
        >
          <Text style={[GlobalStyles.title]}>FaceID Balance</Text>
          <Text style={[GlobalStyles.balance]}>
            {`$ ${epsilonRound(
              arraySum(
                this.context.value.balances.map(
                  (balance, i) => balance * this.context.value.usdConversion[i]
                )
              ),
              2
            )} USD`}
          </Text>
        </LinearGradient>
        <View
          style={{
            flexDirection: "row",
            width: "100%",
            justifyContent: "space-around",
            alignItems: "center",
            marginTop: 20,
            marginBottom: 10,
          }}
        >
          <Pressable
            disabled={this.state.loading}
            style={[
              GlobalStyles.buttonSelectorSelectedStyle,
              this.state.selector !== 0 && {
                borderColor: "#aaaaaa",
              },
            ]}
            onPress={async () => {
              this.setState({ selector: 0 });
            }}
          >
            <Text style={[GlobalStyles.buttonTextSmall]}>Tokens</Text>
          </Pressable>
          <Pressable
            disabled={this.state.loading}
            style={[
              GlobalStyles.buttonSelectorSelectedStyle,
              this.state.selector !== 1 && {
                borderColor: "#aaaaaa",
              },
            ]}
            onPress={async () => {
              this.setState({ selector: 1 });
            }}
          >
            <Text style={[GlobalStyles.buttonTextSmall]}>Receive</Text>
          </Pressable>
          <Pressable
            disabled={this.state.loading}
            style={[
              GlobalStyles.buttonSelectorSelectedStyle,
              this.state.selector !== 2 && {
                borderColor: "#aaaaaa",
              },
            ]}
            onPress={async () => {
              this.setState({ selector: 2 });
            }}
          >
            <Text style={[GlobalStyles.buttonTextSmall]}>QR Pay</Text>
          </Pressable>
        </View>
        {this.state.selector === 0 && (
          <Fragment>
            {blockchain.tokens.map((token, i) => (
              <View key={`${i}`} style={GlobalStyles.network}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-around",
                  }}
                >
                  <View style={GlobalStyles.networkMarginIcon}>
                    {token.icon}
                  </View>
                  <View style={{ justifyContent: "center" }}>
                    <Text style={GlobalStyles.networkTokenName}>
                      {token.name}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "flex-start",
                      }}
                    >
                      <Text style={GlobalStyles.networkTokenData}>
                        {this.context.value.balances[i] === 0
                          ? "0"
                          : this.context.value.balances[i] < 0.001
                          ? "<0.001"
                          : epsilonRound(
                              this.context.value.balances[i],
                              3
                            )}{" "}
                        {token.symbol}
                      </Text>
                      <Text style={GlobalStyles.networkTokenData}>
                        {`  -  ($${epsilonRound(
                          this.context.value.usdConversion[i],
                          4
                        )} USD)`}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={{ marginHorizontal: 20 }}>
                  <Text style={{ color: "white" }}>
                    $
                    {epsilonRound(
                      this.context.value.balances[i] *
                        this.context.value.usdConversion[i],
                      2
                    )}{" "}
                    USD
                  </Text>
                </View>
              </View>
            ))}
          </Fragment>
        )}
        {this.state.selector === 1 && (
          <Fragment>
            <View
              style={{
                width: "90%",
                height: "auto",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <QrAddress address={this.context.value.accountId} />
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-start",
                alignItems: "center",
                width: "100%",
                gap: 10,
                paddingBottom: 20,
              }}
            >
              <Text
                style={{
                  fontSize: normalizeFontSize(22),
                  fontWeight: "bold",
                  color: "white",
                  textAlign: "center",
                  width: "85%",
                }}
              >
                {this.context.value.accountId}
              </Text>
              <Pressable
                onPress={() => {
                  Clipboard.setString(this.context.value.accountId);
                  if (Platform.OS === "web") {
                    Toast.show({
                      type: "info",
                      text1: "Address copied to clipboard",
                      position: "bottom",
                      visibilityTime: 3000,
                      autoHide: true,
                    });
                  } else {
                    ToastAndroid.show(
                      "Address copied to clipboard",
                      ToastAndroid.LONG
                    );
                  }
                }}
                style={{
                  width: "15%",
                  alignItems: "flex-start",
                }}
              >
                <IconIonicons name="copy" size={30} color={"white"} />
              </Pressable>
            </View>
          </Fragment>
        )}
        {this.state.selector === 2 && (
          <Fragment>
            {this.state.qrData === "" ? (
              <View
                style={{
                  flex: 1,
                  width: "100%",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Pressable
                  disabled={this.state.loading}
                  style={[
                    GlobalStyles.buttonStyle,
                    this.state.loading ? { opacity: 0.5 } : {},
                  ]}
                  onPress={() => this.createQR()}
                >
                  <Text style={[GlobalStyles.buttonText]}>
                    {this.state.loading ? "Creating..." : "Create QR Payment"}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Fragment>
                <Text style={GlobalStyles.formTitleCard}>Payment QR</Text>
                <View
                  style={{
                    width: "90%",
                    height: "auto",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <QrAddress address={this.state.qrData} />
                </View>
              </Fragment>
            )}
          </Fragment>
        )}
      </ScrollView>
    );
  }
}

export default useHOCS(Tab1);
