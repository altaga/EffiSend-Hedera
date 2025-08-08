import { MaterialIcons } from "@expo/vector-icons";
import { CameraView } from "expo-camera";
import { ImageManipulator } from "expo-image-manipulator";
import React, { Component, createRef } from "react";
import { Pressable, View } from "react-native";
import { mainColor } from "../core/styles";

export default class CamFace extends Component {
  constructor(props) {
    super(props);
    this.state = {
      take: false,
      cameraReady: false,
      refresh: true,
      facing: this.props.facing,
    };
    this.data = createRef(null);
    this.camera;
  }

  async takePicture() {
    const options = {
      quality: 1,
      base64: true,
    };
    const {
      base64: preImage,
      width,
      height,
    } = await this.camera.takePictureAsync(options);
    let image;
    if (width > 512 || height > 512) {
      const resizeOption = width > height ? { width: 512 } : { height: 512 };
      const render = await ImageManipulator.manipulate(preImage)
        .resize(resizeOption)
        .renderAsync();
      const { base64: imagePost } = await render.saveAsync({
        base64: true,
        format: "jpeg",
      });
      image = `${imagePost}`;
    } else {
      image = `${preImage.replace(/^data:image\/[a-z]+;base64,/, "")}`;
    }
    this.props.onImage(image);
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.take !== this.props.take &&
      this.props.take &&
      this.state.cameraReady
    ) {
      this.takePicture();
    }
  }

  render() {
    return (
      <React.Fragment>
        {this.state.refresh && (
          <CameraView
            onCameraReady={() => this.setState({ cameraReady: true })}
            ratio={"1:1"}
            facing={this.state.facing}
            ref={(ref) => (this.camera = ref)}
            style={{ height: "100%", width: "100%" }}
          />
        )}
        <View style={{ position: "absolute" }}>
          <Pressable
            onPress={() => {
              this.setState(
                {
                  facing: this.state.facing === "back" ? "front" : "back",
                  refresh: false,
                },
                () => {
                  this.setState({ refresh: true });
                }
              );
            }}
            style={[
              {
                margin: 10,
                width: "10%",
                height: "auto",
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: mainColor,
                borderColor: "white",
                borderWidth: 2,
                borderRadius: 50,
                aspectRatio: 1,
                padding: 20,
              },
            ]}
          >
            <MaterialIcons name="cameraswitch" size={22} color="white" />
          </Pressable>
        </View>
      </React.Fragment>
    );
  }
}
