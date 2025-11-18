import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import GoogleWallet from "../../../assets/images/GW.png";
import GlobalStyles, { mainColor } from "../../../core/styles";
import { useStateAsync } from "../../../core/useAsyncState";
import { formatTimestamp, getEncryptedStorageValue } from "../../../core/utils";
import ContextModule from "../../../providers/contextModule";

export default function Tab4() {
  const context = React.useContext(ContextModule);
  const scrollView = useRef(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [inputHeight, setInputHeight] = useStateAsync("auto");
  const ws = useRef(null);
  // Ref to updates de value of context on web socket component
  const contextRef = useRef(context.value);
  useEffect(() => {
    contextRef.current = context.value;
  }, [context.value]);

  useEffect(() => {
    ws.current = new WebSocket(process.env.EXPO_PUBLIC_HCS10_AGENT_URL);

    ws.current.onopen = () => {
      console.log("Connected to server");
    };
    ws.current.onmessage = (e) => {
      let temp = [...contextRef.current.chatGeneral];
      const finalResponse = responseModifier(e.data);
      console.log(finalResponse);
      temp.push({
        message: JSON.parse(finalResponse).message,
        type: "system",
        time: Date.now(),
        tool: JSON.parse(finalResponse).last_tool,
      });
      context.setValue({
        chatGeneral: temp,
      });
      setLoading(false);
      setTimeout(() => scrollView.current.scrollToEnd({ animated: true }), 100);
    };
    ws.current.onerror = (e) => {
      console.log("WebSocket error:", e.message);
    };
    ws.current.onclose = (e) => {
      console.log("WebSocket closed:", e.code, e.reason);
    };

    // Cleanup on unmount
    return () => {
      ws.current && ws.current.close();
    };
  }, []);

  async function chatWithAgent(message) {
    const user = await getEncryptedStorageValue("user");
    const raw = JSON.stringify({
      message,
      context: {
        accountId: context.value.accountId,
        user,
      },
    });
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(raw);
    }
  }

  function responseModifier(response) {
    let temp = response;
    /**
      if (temp["last_tool"] === "transfer_to_multiple_spei") {
        temp.message = "All CLABE accounts received the payment successfully.";
      }
    */
    return temp;
  }

  const sendMessage = useCallback(async () => {
    setLoading(true);
    const userMessage = message;
    setMessage("");
    let temp = [...context.value.chatGeneral];
    temp.push({
      message: userMessage,
      type: "user",
      time: Date.now(),
      tool: "",
    });
    await context.setValueAsync({
      chatGeneral: temp,
    });
    scrollView.current.scrollToEnd({ animated: true });
    await chatWithAgent(message);
  }, [scrollView, context, message, setMessage, setLoading]);

  return (
    <Fragment>
      <ScrollView
        ref={(view) => {
          scrollView.current = view;
        }}
        showsVerticalScrollIndicator={false}
        style={[GlobalStyles.scrollContainer]}
        contentContainerStyle={[
          GlobalStyles.scrollContainerContent,
          {
            width: "90%",
            height: "auto",
            alignSelf: "center",
            gap: 0,
          },
        ]}
      >
        {context.value.chatGeneral.map((item, index, array) => (
          <LinearGradient
            angle={90}
            useAngle={true}
            key={`Message:${index}`}
            style={[
              {
                borderRadius: 10,
                borderBottomRightRadius: item.type === "user" ? 0 : 10,
                borderBottomLeftRadius: item.type === "user" ? 10 : 0,
                paddingHorizontal: 16,
                paddingVertical: 10,
                maxWidth: "80%",
                alignSelf: item.type === "user" ? "flex-end" : "flex-start",
              },
              index !== 0 && array[index - 1].type !== item.type
                ? { marginTop: 16 }
                : { marginTop: 5 },
            ]}
            colors={[
              item.type === "user" ? mainColor + "cc" : mainColor + "40",
              item.type === "user" ? mainColor + "cc" : mainColor + "40",
            ]}
          >
            <Text
              style={{
                color: "white",
                textAlign: "justify",
                marginBottom: 10,
                fontSize: 16,
              }}
            >
              {item.message}
            </Text>
            {item.tool === "fund_metamask_card" && (
              <Pressable
                style={{
                  padding: 10,
                }}
                onPress={() => {
                  Linking.openURL(
                    "intent://com.google.android.apps.walletnfcrel/#Intent;scheme=android-app;package=com.google.android.apps.walletnfcrel;end"
                  );
                }}
              >
                <Image
                  style={{
                    height: "auto",
                    width: "100%",
                    aspectRatio: 854 / 197,
                    alignSelf: "center",
                  }}
                  source={GoogleWallet}
                />
              </Pressable>
            )}
            <Text
              style={{
                color: "#cccccc",
                alignSelf: "flex-end",
                fontSize: 12,
                marginRight: -5,
                marginBottom: -5,
              }}
            >
              {formatTimestamp(item.time)}
            </Text>
          </LinearGradient>
        ))}
      </ScrollView>
      <View
        style={[
          {
            height: "auto",
            width: "94%",
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginVertical: 10,
          },
        ]}
      >
        <TextInput
          onPressOut={() => scrollView.current.scrollToEnd({ animated: true })}
          onChange={() => scrollView.current.scrollToEnd({ animated: true })}
          onFocus={() => scrollView.current.scrollToEnd({ animated: true })}
          multiline
          onContentSizeChange={async (event) => {
            if (event.nativeEvent.contentSize.height < 120) {
              await setInputHeight(event.nativeEvent.contentSize.height);
              scrollView.current.scrollToEnd({ animated: true });
            }
          }}
          style={[
            GlobalStyles.inputChat,
            {
              height: inputHeight,
            },
          ]}
          keyboardType="default"
          value={message}
          onChangeText={setMessage}
        />
        <Pressable
          onPress={sendMessage}
          disabled={message.length <= 0 || loading}
          style={[
            {
              width: "10%",
              height: "auto",
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: mainColor,
              borderRadius: 50,
              aspectRatio: 1,
              padding: 20,
            },
            message.length <= 0 || loading ? { opacity: 0.5 } : {},
          ]}
        >
          {loading ? (
            <ActivityIndicator size={22} color="white" />
          ) : (
            <Ionicons name="send" size={22} color="white" />
          )}
        </Pressable>
      </View>
    </Fragment>
  );
}
