import { Dimensions, Image, PixelRatio, Platform } from "react-native";
// Blockchain
import HBAR from "../assets/logos/hbar.png";
import SAUCER from "../assets/logos/saucer.png";
import USDC from "../assets/logos/usdc.png";
import CLXY from "../assets/logos/clxy.png";
import HLQT from "../assets/logos/hlqt.png";
import STEAM from "../assets/logos/steam.png";
import HCHF from "../assets/logos/hchf.png";
import BULL from "../assets/logos/bull.png";
import HSUITE from "../assets/logos/hsuite.png";
import LCX from "../assets/logos/lcx.png";
import WAVAX from "../assets/logos/avax.png";
import LINK from "../assets/logos/link.png";
import DAI from "../assets/logos/dai.png";
import KARATE from "../assets/logos/karate.png";
import DAVINCI from "../assets/logos/davinci.png";
import DOVU from "../assets/logos/dovu.png";
import QUANT from "../assets/logos/quant.png";
import WETH from "../assets/logos/weth.png";
import GRELF from "../assets/logos/grelf.png";
import KBL from "../assets/logos/kbl.png";
import PACK from "../assets/logos/pack.png";
import HST from "../assets/logos/hst.png";
import WBTC from "../assets/logos/wbtc.png";
import USDT from "../assets/logos/usdt.png";

const normalizeFontSize = (size) => {
  let { width, height } = Dimensions.get("window");
  if (Platform.OS === "web" && height / width < 1) {
    width /= 2.3179;
    height *= 0.7668;
  }
  const scale = Math.min(width / 375, height / 667); // Based on a standard screen size
  return PixelRatio.roundToNearestPixel(size * scale);
};

const w = normalizeFontSize(50);
const h = normalizeFontSize(50);

export const refreshTime = 1000 * 60 * 0.25;

export const iconsBlockchain = {
  hbar: (
    <Image source={HBAR} style={{ width: w, height: h, borderRadius: 10 }} />
  ),
  usdc: (
    <Image source={USDC} style={{ width: w, height: h, borderRadius: 10 }} />
  ),
  saucer: (
    <Image source={SAUCER} style={{ width: w, height: h, borderRadius: 10 }} />
  ),
  clxy: (
    <Image source={CLXY} style={{ width: w, height: h, borderRadius: 10 }} />
  ),
  hlqt: (
    <Image source={HLQT} style={{ width: w, height: h, borderRadius: 10 }} />
  ),
  steam: (
    <Image source={STEAM} style={{ width: w, height: h, borderRadius: 10 }} />
  ),
  hchf: (
    <Image source={HCHF} style={{ width: w, height: h, borderRadius: 10 }} />
  ),
  bull: (
    <Image source={BULL} style={{ width: w, height: h, borderRadius: 10 }} />
  ),
  hsuite: (
    <Image source={HSUITE} style={{ width: w, height: h, borderRadius: 10 }} />
  ),
  lcx: <Image source={LCX} style={{ width: w, height: h, borderRadius: 10 }} />,
  wavax: (
    <Image source={WAVAX} style={{ width: w, height: h, borderRadius: 10 }} />
  ),
  link: (
    <Image source={LINK} style={{ width: w, height: h, borderRadius: 10 }} />
  ),
  dai: <Image source={DAI} style={{ width: w, height: h, borderRadius: 10 }} />,
  karate: (
    <Image source={KARATE} style={{ width: w, height: h, borderRadius: 10 }} />
  ),
  davinci: (
    <Image source={DAVINCI} style={{ width: w, height: h, borderRadius: 10 }} />
  ),
  dovu: (
    <Image source={DOVU} style={{ width: w, height: h, borderRadius: 10 }} />
  ),
  quant: (
    <Image source={QUANT} style={{ width: w, height: h, borderRadius: 10 }} />
  ),
  weth: (
    <Image source={WETH} style={{ width: w, height: h, borderRadius: 10 }} />
  ),
  grelf: (
    <Image source={GRELF} style={{ width: w, height: h, borderRadius: 10 }} />
  ),
  kbl: <Image source={KBL} style={{ width: w, height: h, borderRadius: 10 }} />,
  pack: (
    <Image source={PACK} style={{ width: w, height: h, borderRadius: 10 }} />
  ),
  hst: <Image source={HST} style={{ width: w, height: h, borderRadius: 10 }} />,
  wbtc: (
    <Image source={WBTC} style={{ width: w, height: h, borderRadius: 10 }} />
  ),
  usdt: (
    <Image source={USDT} style={{ width: w, height: h, borderRadius: 10 }} />
  ),
};

export const blockchain = {
  network: "Hedera Mainnet",
  blockExplorer: "https://hashscan.io/mainnet/",
  tokens: [
    {
      name: "Hedera",
      color: "#202020",
      symbol: "HBAR",
      accountId: "0.0.000000",
      decimals: 8,
      icon: iconsBlockchain.hbar,
      coingecko: "hedera-hashgraph",
    },
    {
      name: "USD Coin",
      color: "#2775ca",
      symbol: "USDC",
      accountId: "0.0.456858",
      decimals: 6,
      icon: iconsBlockchain.usdc,
      coingecko: "usd-coin",
    },
    {
      name: "SaucerSwap",
      color: "#6bff53",
      symbol: "SAUCE",
      accountId: "0.0.731861",
      decimals: 6,
      icon: iconsBlockchain.saucer,
      coingecko: "saucerswap",
    },
    {
      name: "Tether USD",
      color: "#26A17B",
      symbol: "USDT",
      accountId: "0.0.1055472",
      decimals: 6,
      icon: iconsBlockchain.usdt,
      coingecko: "tether",
    },

    {
      name: "Dai Stablecoin",
      color: "#F4B731",
      symbol: "DAI",
      accountId: "0.0.1055477",
      decimals: 8,
      icon: iconsBlockchain.dai,
      coingecko: "dai",
    },
    {
      name: "ChainLink",
      color: "#345bce",
      symbol: "LINK",
      accountId: "0.0.1055495",
      decimals: 8,
      icon: iconsBlockchain.link,
      coingecko: "chainlink",
    },
    {
      name: "Wrapped BTC",
      color: "#F7931A",
      symbol: "WBTC",
      accountId: "0.0.1055483",
      decimals: 8,
      icon: iconsBlockchain.wbtc,
      coingecko: "wrapped-bitcoin",
    },
    {
      name: "Wrapped Ether",
      color: "#485563",
      symbol: "WETH",
      accountId: "0.0.541564",
      decimals: 8,
      icon: iconsBlockchain.weth,
      coingecko: "weth",
    },
    {
      name: "Wrapped AVAX",
      color: "#E84142",
      symbol: "WAVAX",
      accountId: "0.0.1157020",
      decimals: 8,
      icon: iconsBlockchain.wavax,
      coingecko: "wrapped-avax",
    },
    {
      name: "HashPack",
      color: "#595b9f",
      symbol: "PACK",
      accountId: "0.0.4794920",
      decimals: 6,
      icon: iconsBlockchain.pack,
      coingecko: "hashpack",
    },
    {
      name: "HeadStarter",
      color: "#3f61ad",
      symbol: "HST",
      accountId: "0.0.968069",
      decimals: 8,
      icon: iconsBlockchain.hst,
      coingecko: "headstarter",
    },
    {
      name: "Calaxy Tokens",
      color: "#7a04d6",
      symbol: "CLXY",
      accountId: "0.0.859814",
      decimals: 6,
      icon: iconsBlockchain.clxy,
      coingecko: "calaxy",
    },
    {
      name: "Hedera Liquity",
      color: "#057ccd",
      symbol: "HLQT",
      accountId: "0.0.6070128",
      decimals: 8,
      icon: iconsBlockchain.hlqt,
      coingecko: "hedera-liquity",
    },
    {
      name: "STEAM",
      color: "#2099af",
      symbol: "STEAM",
      accountId: "0.0.3210123",
      decimals: 2,
      icon: iconsBlockchain.steam,
      coingecko: "steam",
    },
    {
      name: "Hedera Swiss Franc",
      color: "#FF0000",
      symbol: "HCHF",
      accountId: "0.0.6070123",
      decimals: 8,
      icon: iconsBlockchain.hchf,
      coingecko: "hedera-swiss-franc",
    },
    {
      name: "BullBar",
      color: "#F7931A",
      symbol: "BULL",
      accountId: "0.0.3155326",
      decimals: 6,
      icon: iconsBlockchain.bull,
      coingecko: "bullbar",
    },
    {
      name: "HbarSuite",
      color: "#7c13de",
      symbol: "HSUITE",
      accountId: "0.0.786931",
      decimals: 4,
      icon: iconsBlockchain.hsuite,
      coingecko: "hsuite",
    },
    {
      name: "LCX",
      color: "#555555",
      symbol: "LCX",
      accountId: "0.0.1304772",
      decimals: 8,
      icon: iconsBlockchain.lcx,
      coingecko: "lcx",
    },

    {
      name: "Karate",
      color: "#181818",
      symbol: "KARATE",
      accountId: "0.0.2283230",
      decimals: 8,
      icon: iconsBlockchain.karate,
      coingecko: "karate-combat",
    },
    {
      name: "Davincigraph",
      color: "#f4b62f",
      symbol: "DAVINCI",
      accountId: "0.0.3706639",
      decimals: 9,
      icon: iconsBlockchain.davinci,
      coingecko: "davincigraph",
    },
    {
      name: "Dovu",
      color: "#262626",
      symbol: "DOVU",
      accountId: "0.0.3716059",
      decimals: 8,
      icon: iconsBlockchain.dovu,
      coingecko: "dovu-2",
    },
    {
      name: "Quant",
      color: "#3b3b3b",
      symbol: "QNT",
      accountId: "0.0.1304757",
      decimals: 8,
      icon: iconsBlockchain.quant,
      coingecko: "quant-network",
    },
    {
      name: "GRELF",
      color: "#d8aa8c",
      symbol: "GRELF",
      accountId: "0.0.1159074",
      decimals: 8,
      icon: iconsBlockchain.grelf,
      coingecko: "grelf",
    },
    {
      name: "Kabila",
      color: "#2d8b69",
      symbol: "KBL",
      accountId: "0.0.5989978",
      decimals: 6,
      icon: iconsBlockchain.kbl,
      coingecko: "kabila",
    },
  ],
};
