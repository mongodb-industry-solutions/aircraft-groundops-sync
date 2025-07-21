import { useRef, useEffect } from "react";
import { useChatSession } from "@/context/ChatSessionContext";
import { dtcCodesDictionary } from "@/lib/const";

const useChat = ({
  setCurrentView,
  setMessagesToShow,
  setIsTyping,
  setIsRecording,
  isRecording,
  selectedDevice,
  isSpeakerMuted,
  selectedOperation,
  onStepCompleted,
}) => {
  const socketRef = useRef(null);
  const processorRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioInputRef = useRef(null);
  const isPlayingTTSRef = useRef(false); 

  const sessionId = useChatSession();

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
      try {
        const { value, done } = await reader.read();
        if (done) {
          setIsTyping(false);
          if (partialMessage && !isSpeakerMuted) {
            await handleTextToSpeech(partialMessage);
          }
          return;
        }

        const decodedChunk = decoder.decode(value, { stream: true });

        try {
          const parsedChunk = JSON.parse(decodedChunk);
          if (parsedChunk.functionCall) {
            isFunctionCallActive = true;
            await handleFunctionCall(parsedChunk.functionCall);
            isFunctionCallActive = false;
            processStream();
            return;
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
      } catch (error) {
        console.error("Error processing stream:", error);
        setIsTyping(false);
      }
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
            const operationId = functionCall.args?.operationId || selectedOperation;
            
            console.log("retrieveChecklist called with:", {
              functionCallArgs: functionCall.args,
              selectedOperation,
              finalOperationId: operationId
            });
            
            if (!operationId) {
              console.log("No operation ID available");
              let errorResponse = { 
                success: false, 
                error: "No operation selected. Please select an operation first.",
                message: "I need an operation to be selected before I can retrieve the checklist."
              };
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

            if (!response.ok) {
              const errorText = await response.text();
              console.error("API response error:", response.status, errorText);
              let errorResponse = { 
                success: false, 
                error: `Failed to retrieve checklist: ${response.status}`,
                message: "I'm having trouble getting the checklist. Let me try again in a moment."
              };
              replyToFunctionCall(functionCall.name, errorResponse);
              addLog(sessionId, functionCall.name, "error", errorResponse);
              resolve();
              break;
            }

            const checklistData = await response.json();
            
            if (checklistData.error) {
              let errorResponse = { 
                success: false, 
                error: checklistData.error,
                message: "I couldn't find the checklist for this operation. Please make sure an operation is selected."
              };
              replyToFunctionCall(functionCall.name, errorResponse);
              addLog(sessionId, functionCall.name, "error", errorResponse);
            } else {
              let responseData = {
                success: true,
                checklist: checklistData.checklist,
                operationTitle: checklistData.operationTitle,
                prior: checklistData.prior,
                operationId,
                message: `Retrieved checklist for ${checklistData.operationTitle}. Starting with main checklist items.`
              };
              
              replyToFunctionCall(functionCall.name, responseData);
              addLog(sessionId, functionCall.name, "response", responseData);
            }
          } catch (error) {
            console.error("Error retrieving checklist:", error);
            let errorResponse = { 
              success: false, 
              error: error.message,
              message: "I encountered an error while getting the checklist. Let me try again."
            };
            replyToFunctionCall(functionCall.name, errorResponse);
            addLog(sessionId, functionCall.name, "error", errorResponse);
          }
          resolve();
          break;

        case "markStepCompleted":
          try {
            const { stepNumber, stepText } = functionCall.args;
            const stepCompletionData = {
              stepNumber,
              stepText,
              completedAt: new Date().toISOString(),
              operationId: selectedOperation,
            };
            
            // Save step completion to MongoDB
            await fetch("/api/action/insertOne", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                collection: "completedSteps",
                document: {
                  sessionId,
                  ...stepCompletionData,
                },
              }),
            });

            let responseData = {
              success: true,
              message: `Step ${stepNumber} marked as completed: ${stepText}`,
              stepNumber,
              stepText,
            };
            
            if (onStepCompleted) {
              onStepCompleted(stepNumber, stepText);
            }
            
            replyToFunctionCall(functionCall.name, responseData);
            addLog(sessionId, functionCall.name, "response", responseData);
            
          } catch (error) {
            console.error("Error marking step completed:", error);
            let errorResponse = { success: false, error: error.message };
            replyToFunctionCall(functionCall.name, errorResponse);
            addLog(sessionId, functionCall.name, "error", errorResponse);
          }
          resolve();
          break;

        case "queryDataworkz":
          try {
            const { query } = functionCall.args;
            const response = await fetch("/api/dataworkz/answer", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ questionText: query }),
            });

            const dataworkzResponse = await response.json();
            
            if (response.ok) {
              let responseData = {
                success: true,
                answer: dataworkzResponse.answer || dataworkzResponse.result || dataworkzResponse.response || "No answer found.",
                query,
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

    let assistantMessageIndex;
    setMessagesToShow((prev) => {
      const updatedMessages = [...prev, { sender: "assistant", text: "" }];
      assistantMessageIndex = updatedMessages.length - 1;
      return updatedMessages;
    });

    try {
      const response = await fetch("/api/gcp/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId,
          message: functionResponseParts,
        }),
      });

      if (!response.body) {
        console.error("Error sending function response - no response body.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let partialMessage = "";

      const processStream = async () => {
        try {
          const { value, done } = await reader.read();
          if (done) {
            if (partialMessage && !isSpeakerMuted)
              await handleTextToSpeech(partialMessage);
            return;
          }

          partialMessage += decoder.decode(value, { stream: true });

          setMessagesToShow((prevMessages) =>
            prevMessages.map((msg, index) =>
              index === assistantMessageIndex
                ? { ...msg, text: partialMessage }
                : msg
            )
          );

          processStream();
        } catch (error) {
          console.error("Error processing function response stream:", error);
        }
      };

      processStream();
    } catch (error) {
      console.error("Error in replyToFunctionCall:", error);
    }
  };

  const startRecording = async () => {
    if (isRecording || isPlayingTTSRef.current) {
      return;
    }
    
    setIsRecording(true);

    setMessagesToShow((prev) => {
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
      
      if (data.final && data.text.trim() !== "") {
        setMessagesToShow((prev) => {
          const recentAssistantMessages = prev
            .filter(msg => msg.sender === "assistant" && msg.text)
            .slice(-3) // Check last 3 assistant messages
            .map(msg => msg.text.toLowerCase().trim());
          
          const userText = data.text.toLowerCase().trim();
          const isLikelyEcho = recentAssistantMessages.some(assistantText => {
            if (assistantText === userText) {
              return true;
            }
            
            if (assistantText.includes(userText) && userText.length > 5) {
              return true;
            }
            
            if (userText.includes(assistantText) && assistantText.length > 5) {
              return true;
            }
            
            return false;
          });
          
          if (isLikelyEcho) {
            console.log("Filtering out likely TTS echo:", userText);
            return prev; 
          }
          
          const updatedMessages = [...prev];
          updatedMessages[updatedMessages.length - 1] = {
            sender: "user",
            text: data.text,
          };
          return updatedMessages;
        });
        
        // Only proceed with LLM response if it's not an echo
        setMessagesToShow((prev) => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage?.sender === "user" && lastMessage?.text === data.text) {
            stopRecording();
            handleLLMResponse(data.text);
          }
          return prev;
        });
      } else {
        setMessagesToShow((prev) => {
          const updatedMessages = [...prev];
          if (updatedMessages[updatedMessages.length - 1]?.sender === "user") {
            updatedMessages[updatedMessages.length - 1] = {
              sender: "user",
              text: data.text,
            };
          }
          return updatedMessages;
        });
      }
    };

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
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        stopRecording();
      }
      
      isPlayingTTSRef.current = true; 
      
      const audioResponse = await fetch("/api/gcp/textToSpeech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const { audioContent } = await audioResponse.json();

      if (audioContent) {
        const audio = new Audio(`data:audio/wav;base64,${audioContent}`);

        // event listeners to track playback state
        audio.addEventListener('ended', () => {
          console.log("TTS playback ended");
          isPlayingTTSRef.current = false;
        });

        audio.addEventListener('error', (error) => {
          console.log("TTS playback error:", error);
          isPlayingTTSRef.current = false;
        });

        const playPromise = audio.play();

        if (playPromise !== undefined) {
          await playPromise.catch((error) => {
            console.log("Audio playback required user interaction first:", error);
            isPlayingTTSRef.current = false;
          });
        }
        
      } else {
        isPlayingTTSRef.current = false;
      }
    } catch (error) {
      console.error("Error in text-to-speech:", error);
      isPlayingTTSRef.current = false;
    }
  };

  return {
    handleLLMResponse,
    startRecording,
    stopRecording,
    isPlayingTTS: () => isPlayingTTSRef.current,
    handleTextToSpeech,
  };
};

export default useChat;
