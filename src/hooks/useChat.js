import { useRef, useEffect } from "react";
import { useChatSession } from "@/context/ChatSessionContext";
import { dtcCodesDictionary } from "@/lib/const";

const useChat = ({
  setCurrentView,
  setMessagesToShow,
  setIsTyping,
  setIsRecording,
  selectedDevice,
  isSpeakerMuted,
  selectedOperation,
}) => {
  const socketRef = useRef(null);
  const processorRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioInputRef = useRef(null);

  const sessionId = useChatSession();

  // Debug logging
  useEffect(() => {
    console.log("useChat hook initialized with selectedOperation:", selectedOperation);
  }, [selectedOperation]);

  // Web Socket Config
  const protocol = process.env.NEXT_PUBLIC_ENV === "local" ? "ws" : "wss";
  const host = typeof window !== "undefined" ? window.location.host : "";

  const handleLLMResponse = async (userMessage) => {
    setIsTyping(true);
    let assistantMessageIndex;
    setMessagesToShow((prev) => {
      const updatedMessages = [...prev, { sender: "assistant", text: "" }];
      assistantMessageIndex = updatedMessages.length - 1;
      return updatedMessages;
    });

    // const response = await fetch("/api/gcp/test");
    // const data = await response.json();
    // console.log(data);

    const response = await fetch("/api/gcp/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionId,
        message: userMessage,
      }),
    });

    if (!response.body) {
      console.error("Response stream is empty.");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let partialMessage = "";
    let isFunctionCallActive = false;

    const processStream = async () => {
      const { value, done } = await reader.read();
      if (done && !isFunctionCallActive) {
        setIsTyping(false);
        if (partialMessage && !isSpeakerMuted)
          await handleTextToSpeech(partialMessage);
        return;
      }

      const decodedChunk = decoder.decode(value, { stream: true });

      try {
        const parsedChunk = JSON.parse(decodedChunk);
        if (parsedChunk.functionCall) {
          isFunctionCallActive = true;
          await handleFunctionCall(parsedChunk.functionCall);
          isFunctionCallActive = false;
        }
      } catch {
        partialMessage += decodedChunk;
        setMessagesToShow((prevMessages) =>
          prevMessages.map((msg, index) =>
            index === assistantMessageIndex
              ? { ...msg, text: partialMessage }
              : msg
          )
        );
      }

      processStream();
    };

    processStream();
  };

  const addLog = async (sessionId, toolName, type, details) => {
    try {
      await fetch("/api/action/updateOne", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection: "logs",
          filter: { sessionId },
          update: {
            $push: {
              logs: {
                timestamp: new Date().toISOString(),
                toolName,
                type,
                details,
              },
            },
          },
          upsert: true,
        }),
      });
    } catch (error) {
      console.error("Error saving log:", error);
    }
  };

  const handleFunctionCall = async (functionCall) => {
    return new Promise(async (resolve) => {
      switch (functionCall.name) {
        case "retrieveChecklist":
          try {
            // Use the selectedOperation passed from the component, or get from function args
            const operationId = functionCall.args?.operationId || selectedOperation;
            
            console.log("retrieveChecklist called with:", {
              functionCallArgs: functionCall.args,
              selectedOperation,
              finalOperationId: operationId
            });
            
            if (!operationId) {
              console.log("No operation ID available");
              let errorResponse = { success: false, error: "No operation selected" };
              replyToFunctionCall(functionCall.name, errorResponse);
              addLog(sessionId, functionCall.name, "error", errorResponse);
              resolve();
              break;
            }

            const response = await fetch("/api/checklist/get", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ operationId }),
            });

            const checklistData = await response.json();
            
            if (response.ok) {
              let responseData = {
                success: true,
                checklist: checklistData.checklist,
                operationTitle: checklistData.operationTitle,
                prior: checklistData.prior,
                operationId,
              };
              
              replyToFunctionCall(functionCall.name, responseData);
              addLog(sessionId, functionCall.name, "response", responseData);
            } else {
              let errorResponse = { success: false, error: checklistData.error };
              replyToFunctionCall(functionCall.name, errorResponse);
              addLog(sessionId, functionCall.name, "error", errorResponse);
            }
          } catch (error) {
            console.error("Error retrieving checklist:", error);
            let errorResponse = { success: false, error: error.message };
            replyToFunctionCall(functionCall.name, errorResponse);
            addLog(sessionId, functionCall.name, "error", errorResponse);
          }
          resolve();
          break;

        case "queryDataworkz":
          try {
            const { questionText } = functionCall.args;
            const response = await fetch("/api/dataworkz/answer", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ questionText }),
            });

            const dataworkzResponse = await response.json();
            
            if (response.ok) {
              let responseData = {
                success: true,
                answer: dataworkzResponse.answer || dataworkzResponse,
                questionText,
              };
              
              replyToFunctionCall(functionCall.name, responseData);
              addLog(sessionId, functionCall.name, "response", responseData);
            } else {
              let errorResponse = { success: false, error: dataworkzResponse.error };
              replyToFunctionCall(functionCall.name, errorResponse);
              addLog(sessionId, functionCall.name, "error", errorResponse);
            }
          } catch (error) {
            console.error("Error querying Dataworkz:", error);
            let errorResponse = { success: false, error: error.message };
            replyToFunctionCall(functionCall.name, errorResponse);
            addLog(sessionId, functionCall.name, "error", errorResponse);
          }
          resolve();
          break;

        case "closeChat":
          setTimeout(() => {
            setCurrentView("navigation");

            let response = { success: true };
            replyToFunctionCall(functionCall.name, response);

            addLog(sessionId, functionCall.name, "response", response);

            resolve();
          }, 500);
          break;
        default:
          console.warn("Unknown function call:", functionCall.name);
          resolve();
      }
    });
  };

  const replyToFunctionCall = async (name, content) => {
    const functionResponseParts = [
      { functionResponse: { name, response: { name, content } } },
    ];

    const response = await fetch("/api/gcp/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionId,
        message: functionResponseParts,
      }),
    });

    if (!response.body) {
      console.error("Error sending function response.");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let partialMessage = "";

    const processStream = async () => {
      const { value, done } = await reader.read();
      if (done) {
        if (partialMessage && !isSpeakerMuted)
          await handleTextToSpeech(partialMessage);
        return;
      }

      partialMessage += decoder.decode(value, { stream: true });

      setMessagesToShow((prevMessages) =>
        prevMessages.map((msg, index) =>
          index === prevMessages.length - 2
            ? { ...msg, text: partialMessage }
            : msg
        )
      );

      processStream();
    };

    processStream();
  };

  const startRecording = async () => {
    setIsRecording(true);

    setMessagesToShow((prev) => {
      // Check if the last message is from the user and is empty
      const lastMessage = prev[prev.length - 1];
      if (lastMessage?.sender === "user" && lastMessage?.text?.trim() === "") {
        return prev; 
      }
      return [...prev, { sender: "user", text: "" }];
    });

    // Initialize WebSocket connection to the server
    socketRef.current = new WebSocket(
      `${protocol}://${host}/api/gcp/speechToText`
    );
    socketRef.current.onopen = () => {
      console.log("WebSocket connection established");
    };

    socketRef.current.onclose = () => {
      console.log("WebSocket connection closed");
    };

    socketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessagesToShow((prev) => {
        const updatedMessages = [...prev];
        // Replace the last user message (empty one) with the final transcription
        updatedMessages[updatedMessages.length - 1] = {
          sender: "user",
          text: data.text,
        };
        return updatedMessages;
      });
      if (data.final && data.text.trim() !== "") {
        stopRecording();
        handleLLMResponse(data.text);
      }
    };

    // Set up Web Audio API
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: selectedDevice,
        sampleRate: 16000,
        channelCount: 1,
      },
      video: false,
    });

    audioContextRef.current = new (window.AudioContext ||
      window.webkitAudioContext)();

    await audioContextRef.current.audioWorklet.addModule(
      "/worklets/recorderWorkletProcessor.js"
    );

    audioInputRef.current =
      audioContextRef.current.createMediaStreamSource(stream);

    processorRef.current = new AudioWorkletNode(
      audioContextRef.current,
      "recorder.worklet"
    );

    processorRef.current.connect(audioContextRef.current.destination);
    audioInputRef.current.connect(processorRef.current);

    processorRef.current.port.onmessage = (event) => {
      const audioData = event.data;
      if (socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(audioData);
      }
    };
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (socketRef.current) {
      socketRef.current.close();
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
    }
    if (audioInputRef.current) {
      audioInputRef.current.disconnect();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };

  const handleTextToSpeech = async (text) => {
    try {
      const audioResponse = await fetch("/api/gcp/textToSpeech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const { audioContent } = await audioResponse.json();

      if (audioContent) {
        const audio = new Audio(`data:audio/wav;base64,${audioContent}`);

        const playPromise = audio.play();

        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.log("Audio playback required user interaction first:", error);
          });
        }
      }
    } catch (error) {
      console.error("Error in text-to-speech:", error);
    }
  };

  return {
    handleLLMResponse,
    startRecording,
    stopRecording,
  };
};

export default useChat;
