import { CreateCollectionCommand, DescribeCollectionCommand, IndexFacesCommand, RekognitionClient, SearchFacesByImageCommand } from "@aws-sdk/client-rekognition";
import Jimp from "jimp";

const client = new RekognitionClient({ region: process.env.AWS_REGION });
const COLLECTION_ID = process.env.COLLECTION_ID;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB limit for image payload

export const handler = async (event) => {
  console.log("========== NEW REQUEST STARTED ==========");

  try {
    // await ensureCollectionExists();

    const path = event.path || event.rawPath;
    console.log(` Request received for path: ${path}`);

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (parseError) {
      console.error(" Failed to parse JSON body:", parseError);
      return { statusCode: 400, body: JSON.stringify({ detail: "Invalid JSON payload" }) };
    }

    const { image, nonce } = body;

    if (!image) {
      console.warn(" Missing 'image' string in payload");
      return { statusCode: 422, body: JSON.stringify({ detail: "Missing image" }) };
    }

    // Base64 encoding inflates data size by roughly 33%. We check to ensure the payload roughly respects the 10MB limit.
    if (image.length > MAX_IMAGE_SIZE * 1.33) {
      console.warn(` Image string too large. Length: ${image.length}`);
      return { statusCode: 413, body: JSON.stringify({ detail: "Image bytes too large" }) };
    }

    console.log(" Decoding base64 and resizing with Jimp...");
    let resizedImageBytes;
    try {
      const imageBuffer = Buffer.from(image, 'base64');
      const jimpImage = await Jimp.read(imageBuffer);
      jimpImage.resize(512, Jimp.AUTO);
      resizedImageBytes = await jimpImage.getBufferAsync(Jimp.MIME_JPEG);
      console.log(` Image resized to ${resizedImageBytes.length} bytes.`);
    } catch (jimpError) {
      console.error(" Jimp failed to process image (Likely invalid base64 or corrupt image):", jimpError);
      return { statusCode: 422, body: JSON.stringify({ detail: "Malformed or oversized image provided." }) };
    }

    try {
      console.log(" Executing SearchFacesByImageCommand...");
      const searchCommand = new SearchFacesByImageCommand({
        CollectionId: COLLECTION_ID,
        Image: { Bytes: resizedImageBytes },
        FaceMatchThreshold: 90,
        MaxFaces: 1
      });

      const searchResponse = await client.send(searchCommand);

      if (searchResponse.FaceMatches && searchResponse.FaceMatches.length > 0) {
        console.log(" Match found in DB!");
        console.log(searchResponse.FaceMatches[0].Face);
        // Use  since searchResponse.FaceMatches is an array [1]
        const identity = searchResponse.FaceMatches[0].Face.ExternalImageId;
        console.log(` Identity found! Matched nonce: ${identity} with confidence ${searchResponse.FaceMatches[0].Similarity}`);
        return { statusCode: 200, body: JSON.stringify({ result: identity }) };
      }

      console.log(" Face detected, but no matching identity found in DB.");

      if (path === '/fetch') {
        console.log(" Endpoint /fetch complete. Returning false.");
        return { statusCode: 200, body: JSON.stringify({ result: false }) };
      }

      if (path === '/fetchOrSave') {
        if (!nonce) {
          console.warn(" Missing 'nonce' for saving new face.");
          return { statusCode: 422, body: JSON.stringify({ detail: "Missing nonce for saving" }) };
        }

        console.log(` Executing IndexFacesCommand to save nonce: ${nonce}...`);
        const indexCommand = new IndexFacesCommand({
          CollectionId: COLLECTION_ID,
          Image: { Bytes: resizedImageBytes },
          ExternalImageId: nonce,
          MaxFaces: 1,
          QualityFilter: "HIGH"
        });

        await client.send(indexCommand);
        console.log(` Saved user image to DB with nonce: ${nonce}`);
        return { statusCode: 200, body: JSON.stringify({ result: true }) };
      }

      console.warn(` Unrecognized path requested: ${path}`);
      return { statusCode: 404, body: JSON.stringify({ detail: "Endpoint not found" }) };

    } catch (rekogError) {
      console.error(` Caught Amazon Rekognition exception: ${rekogError.name}`);

      // If Rekognition algorithm cannot detect a face, it immediately returns an InvalidParameterException [1]
      if (rekogError.name === 'InvalidParameterException') {
        console.log("[FLAG - NO FACE] Rekognition rejected image: No face detected.");
        return { statusCode: 422, body: JSON.stringify({ result: false }) };
      }

      // Safety net: AWS Rekognition limits raw byte payloads to exactly 5MB [2]
      if (rekogError.name === 'ImageTooLargeException') {
        console.error(" Image size exceeded 5MB limit even after Jimp resize.");
        return { statusCode: 413, body: JSON.stringify({ detail: "Image too large for AWS Rekognition" }) };
      }

      throw rekogError;
    }

  } catch (error) {
    console.error(" Unhandled internal server error:", error);
    return { statusCode: 500, body: JSON.stringify({ detail: "Internal Server Error" }) };
  } finally {
    console.log("========== REQUEST COMPLETED ==========\n");
  }
};