import { getSpeechRecognitionStream } from "@/lib/speech";

export function SOCKET(client, request, server) {
  console.log("Client connected");

  let recognizeStream = null;
  let isStreamActive = false;

  client.on("message", async (audioChunk) => {
    if (!recognizeStream || !isStreamActive) {
      try {
        recognizeStream = getSpeechRecognitionStream(client);
        isStreamActive = true;
        
        recognizeStream.on('error', (error) => {
          console.error("Recognition stream error:", error);
          isStreamActive = false;
          recognizeStream = null;
        });
        
        recognizeStream.on('end', () => {
          console.log("Recognition stream ended");
          isStreamActive = false;
          recognizeStream = null;
        });
        
      } catch (error) {
        console.error("Error starting recognition stream:", error);
        client.send(
          JSON.stringify({ error: "Failed to start recognition stream" })
        );
        return;
      }
    }

    // Stream the audio data to Google Cloud only if stream is active
    if (recognizeStream && isStreamActive) {
      try {
        recognizeStream.write(audioChunk);
      } catch (err) {
        console.error("Error streaming audio data:", err);
        isStreamActive = false;
        recognizeStream = null;
      }
    }
  });

  // Close the recognition stream when the WebSocket is done
  client.on("close", () => {
    console.log("Client disconnected");
    if (recognizeStream && isStreamActive) {
      try {
        recognizeStream.end();
      } catch (err) {
        console.error("Error ending recognition stream:", err);
      }
      recognizeStream = null;
      isStreamActive = false;
    }
  });
}