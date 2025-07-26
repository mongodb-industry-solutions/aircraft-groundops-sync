import { useRef, useEffect, useState } from "react";
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
  onManualStepCompleted,
  onChecklistCompleted,
  isManualMode,
  setIsManualMode,
}) => {
  const MAX_MESSAGES = 100; // Temporarily increased from 30 to 100 to test if aggressive limiting is causing message loss
  const socketRef = useRef(null);
  const processorRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioInputRef = useRef(null);
  const isPlayingTTSRef = useRef(false); 
  const sessionId = useChatSession();
  const [greetingSent, setGreetingSent] = useState(false);
  const [checklistCompletionSent, setChecklistCompletionSent] = useState(false);
  
  // Aggressive memory cleanup function
  const forceMemoryCleanup = () => {
    try {
      // Clear any hanging audio elements
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach(audio => {
        if (!audio.paused) {
          audio.pause();
        }
        audio.src = '';
        audio.load();
        audio.remove();
      });
      
      // Force garbage collection if available
      if (typeof window !== 'undefined' && window.gc) {
        window.gc();
      }
      
      // Clear potential memory leaks from WebSocket or fetch
      if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
        const memInfo = window.performance.memory;
        console.log('Memory usage:', {
          used: Math.round(memInfo.usedJSHeapSize / 1048576) + 'MB',
          total: Math.round(memInfo.totalJSHeapSize / 1048576) + 'MB',
          limit: Math.round(memInfo.jsHeapSizeLimit / 1048576) + 'MB'
        });
      }
    } catch (error) {
      console.warn("Error during memory cleanup:", error);
    }
  };
  
  // Periodic memory cleanup
  useEffect(() => {
    const cleanup = setInterval(forceMemoryCleanup, 30000); // Every 30 seconds
    return () => clearInterval(cleanup);
  }, []);
  const getStepNumber = (step, index) => {
    return step.order ?? (index + 1);
  };

  useEffect(() => {
    console.log("useChat hook initialized with selectedOperation:", {
      selectedOperation: selectedOperation,
      type: typeof selectedOperation,
      id: selectedOperation?.id,
      title: selectedOperation?.title,
      isNull: selectedOperation === null,
      isUndefined: selectedOperation === undefined
    });
    if (setIsManualMode) {
      setIsManualMode(false);
    }
    // Reset greeting state for new operation/session
    setGreetingSent(false);
    setChecklistCompletionSent(false);
    console.log("Reset greeting and checklist completion state for new operation");
    
    // Cleanup function for memory management
    return () => {
      console.log("Cleaning up useChat hook resources");
      try {
        if (socketRef.current) {
          socketRef.current.close();
          socketRef.current = null;
        }
        if (processorRef.current) {
          processorRef.current.disconnect();
          processorRef.current = null;
        }
        if (audioInputRef.current) {
          audioInputRef.current.disconnect();
          audioInputRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(console.error);
          audioContextRef.current = null;
        }
        isPlayingTTSRef.current = false;
      } catch (error) {
        console.warn("Error during useChat cleanup:", error);
      }
    };
  }, [selectedOperation, setIsManualMode]);

  // Web Socket Config
  const protocol = process.env.NEXT_PUBLIC_ENV === "local" ? "ws" : "wss";
  const host = typeof window !== "undefined" ? window.location.host : "";

  const handleLLMResponse = async (userMessage) => {
    setIsTyping(true);
    let assistantMessageIndex;
    setMessagesToShow((prev) => {
      const updatedMessages = [...prev, { sender: "assistant", text: "" }];
      assistantMessageIndex = updatedMessages.length - 1;
      // Immediately limit messages to prevent memory buildup
      return updatedMessages.length > MAX_MESSAGES 
        ? updatedMessages.slice(-MAX_MESSAGES) 
        : updatedMessages;
    });

    let response, reader, decoder;
    try {
      response = await fetch("/api/gcp/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId,
          message: userMessage,
        }),
      });

      if (!response.ok) {
        console.error("LLM API error:", response.status, response.statusText);
        setIsTyping(false);
        setMessagesToShow((prev) => {
          const updatedMessages = [
            ...prev.slice(0, -1), // Remove the empty assistant message
            { 
              sender: "assistant", 
              text: "I'm having trouble processing that. Could you please say 'done' when you've completed the step, or let me know if you'd prefer to use the manual checklist?"
            }
          ];
          return updatedMessages.length > MAX_MESSAGES 
            ? updatedMessages.slice(-MAX_MESSAGES) 
            : updatedMessages;
        });
        return;
      }

      if (!response.body) {
        console.error("Response stream is empty.");
        setIsTyping(false);
        setMessagesToShow((prev) => {
          const updatedMessages = [
            ...prev.slice(0, -1), // Remove the empty assistant message
            { 
              sender: "assistant", 
              text: "I'm having trouble understanding. Please say 'done' when ready, or I can switch you to manual mode."
            }
          ];
          return updatedMessages.length > MAX_MESSAGES 
            ? updatedMessages.slice(-MAX_MESSAGES) 
            : updatedMessages;
        });
        return;
      }

      reader = response.body.getReader();
      decoder = new TextDecoder();
    } catch (error) {
      console.error("Error setting up LLM response:", error);
      setIsTyping(false);
      setMessagesToShow((prev) => {
        const updatedMessages = [
          ...prev.slice(0, -1),
          { 
            sender: "assistant", 
            text: "I'm having connection issues. Please try again."
          }
        ];
        return updatedMessages.length > MAX_MESSAGES 
          ? updatedMessages.slice(-MAX_MESSAGES) 
          : updatedMessages;
      });
      return;
    }
    let partialMessage = "";
    let isFunctionCallActive = false;

    const processStream = async () => {
      try {
        const { value, done } = await reader.read();
        if (done) {
          // Clean up reader when done
          try {
            reader.releaseLock();
          } catch (e) {
            console.warn("Reader already released:", e);
          }
          setIsTyping(false);
          if (partialMessage && !isSpeakerMuted && !isManualMode) {
            const isGreeting = partialMessage.includes("Hi, I'm Leafy") || 
                              partialMessage.includes("would you like to make a question or begin your voice checklist");
            const isCompletionMessage = partialMessage.includes("Checklist complete!");
            
            if (isGreeting && greetingSent) {
              console.log("Skipping repeated greeting:", partialMessage);
              partialMessage = null;
              return;
            }
            
            // Skip any completion message that comes through the LLM since we handle it separately
            if (isCompletionMessage && !partialMessage.includes("Well done")) {
              console.log("Skipping LLM checklist completion message (handled separately):", partialMessage);
              partialMessage = null;
              return;
            }
            
            if (isGreeting) {
              setGreetingSent(true);
              console.log("First greeting detected, marking as sent");
            }
            
            await handleTextToSpeech(partialMessage);
          }
          // Clear partial message to free memory
          partialMessage = null;
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
          const newContent = partialMessage + decodedChunk;
          const isGreeting = newContent.includes("Hi, I'm Leafy") || 
                            newContent.includes("would you like to make a question or begin your voice checklist");
          const isCompletionMessage = newContent.includes("Checklist complete!");
          
          if (isGreeting && greetingSent) {
            console.log("Skipping repeated greeting in UI:", newContent);
            return;
          }
          
          // Skip any completion message that comes through the LLM since we handle it separately
          if (isCompletionMessage && !newContent.includes("Well done")) {
            console.log("Skipping LLM checklist completion in UI (handled separately):", newContent);
            return;
          }
          
          partialMessage += decodedChunk;
          setMessagesToShow((prevMessages) => {
            const updatedMessages = prevMessages.map((msg, index) =>
              index === assistantMessageIndex
                ? { ...msg, text: partialMessage }
                : msg
            );
            // Limit message history during streaming for memory optimization
            return updatedMessages.length > MAX_MESSAGES 
              ? updatedMessages.slice(-MAX_MESSAGES) 
              : updatedMessages;
          });
        }

        processStream();
      } catch (error) {
        console.error("Error processing stream:", error);
        // Clean up on error
        try {
          reader.releaseLock();
        } catch (cleanupError) {
          console.error("Error during stream cleanup:", cleanupError);
        }
        partialMessage = null;
        setIsTyping(false);
        setMessagesToShow((prevMessages) => {
          const updatedMessages = prevMessages.map((msg, index) =>
            index === assistantMessageIndex
              ? { 
                  ...msg, 
                  text: "I'm having trouble with that response. Could you please say 'done' when you've completed the step, or would you prefer to continue manually?"
                }
              : msg
          );
          // Limit message history during error handling for memory optimization
          return updatedMessages.length > MAX_MESSAGES 
            ? updatedMessages.slice(-MAX_MESSAGES) 
            : updatedMessages;
        });
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
    console.log("Function call received:", {
      name: functionCall.name,
      args: functionCall.args,
      currentSelectedOperation: selectedOperation,
      currentSelectedOperationId: selectedOperation?.id
    });
    
    return new Promise(async (resolve) => {
      switch (functionCall.name) {
        case "retrieveChecklist":
          try {
            console.log("DEBUG: selectedOperation at retrieval time:", {
              selectedOperation: selectedOperation,
              type: typeof selectedOperation,
              keys: selectedOperation ? Object.keys(selectedOperation) : 'null/undefined',
              id: selectedOperation?.id,
              title: selectedOperation?.title
            });
            console.log('Processing fresh checklist retrieval for operation:', selectedOperation?.id);            
            const operationId = functionCall.args?.operationId || selectedOperation?.id;
            
            console.log("retrieveChecklist called with:", {
              functionCallArgs: functionCall.args,
              selectedOperation: selectedOperation,
              selectedOperationType: typeof selectedOperation,
              selectedOperationId: selectedOperation?.id,
              finalOperationId: operationId,
              isSelectedOperationNull: selectedOperation === null,
              isSelectedOperationUndefined: selectedOperation === undefined
            });
            
            if (!operationId) {
              console.log("No operation ID available - selectedOperation:", selectedOperation);
              let errorResponse = "I need an operation to be selected first. Please go back and select an operation from the Outbound Operations menu, then return to start the checklist.";
              replyToFunctionCall(functionCall.name, errorResponse);
              addLog(sessionId, functionCall.name, "error", { 
                error: "No operation ID available",
                selectedOperation: selectedOperation,
                selectedOperationType: typeof selectedOperation
              });
              resolve();
              break;
            }

            console.log('About to call checklist API with operationId:', operationId);
            const response = await fetch("/api/checklist/get", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ operationId }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error("API response error:", response.status, errorText);
              let errorResponse = "I'm having trouble getting the checklist. Let me try again in a moment.";
              replyToFunctionCall(functionCall.name, errorResponse);
              addLog(sessionId, functionCall.name, "error", { error: errorText });
              resolve();
              break;
            }

            const checklistData = await response.json();
            console.log('Raw checklist API response:', JSON.stringify(checklistData, null, 2));
            
            if (checklistData.error) {
              let errorResponse = "I couldn't find the checklist for this operation. Please make sure an operation is selected.";
              replyToFunctionCall(functionCall.name, errorResponse);
              addLog(sessionId, functionCall.name, "error", { error: checklistData.error });
            } else {
              const firstChecklistItem = checklistData.checklist?.[0];
              let responseData;
              
              console.log('First checklist item:', firstChecklistItem);
              console.log('All checklist items:', checklistData.checklist);
              console.log('Total checklist steps:', checklistData.checklist?.length || 0);
              
              if (firstChecklistItem) {
                const firstStepNumber = getStepNumber(firstChecklistItem, 0);
                responseData = `Retrieved checklist for ${checklistData.operationTitle}. Start with Step ${firstStepNumber}: "${firstChecklistItem.step}"`;
                console.log('First step details:', { stepNumber: firstStepNumber, stepText: firstChecklistItem.step });
              } else {
                responseData = `Retrieved checklist for ${checklistData.operationTitle} but no main checklist items found.`;
              }
              
              console.log('Sending response to assistant:', responseData);
              
              replyToFunctionCall(functionCall.name, responseData);
              addLog(sessionId, functionCall.name, "response", { 
                operationTitle: checklistData.operationTitle,
                checklistCount: checklistData.checklist?.length || 0,
                firstStep: firstChecklistItem?.step || 'None',
                responseData: responseData
              });
            }
          } catch (error) {
            console.error("Error retrieving checklist:", error);
            let errorResponse = "I encountered an error while getting the checklist. Let me try again.";
            replyToFunctionCall(functionCall.name, errorResponse);
            addLog(sessionId, functionCall.name, "error", { error: error.message });
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
              operationId: selectedOperation?.id,
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

            // Get the current checklist to find the next step
            console.log('Getting next step after completing step:', stepNumber);
            const operationId = selectedOperation?.id;
            
            if (operationId) {
              try {
                const response = await fetch("/api/checklist/get", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ operationId }),
                });

                if (response.ok) {
                  const checklistData = await response.json();                  
                  const currentStepIndex = checklistData.checklist?.findIndex(item => 
                    getStepNumber(item, checklistData.checklist.indexOf(item)) === stepNumber
                  );
                  
                  const nextStepIndex = currentStepIndex !== -1 ? currentStepIndex + 1 : stepNumber;
                  const nextStep = checklistData.checklist?.[nextStepIndex];
                  
                  console.log(`Current step ${stepNumber} found at index ${currentStepIndex}, looking for next step at index ${nextStepIndex}:`, nextStep);
                  console.log('All available checklist steps:', checklistData.checklist?.map((step, idx) => ({
                    index: idx,
                    stepNumber: getStepNumber(step, idx),
                    step: step.step,
                    hasOrder: step.order !== undefined
                  })));
                  
                  let responseData;
                  if (nextStep) {
                    const nextStepNumber = getStepNumber(nextStep, nextStepIndex);
                    responseData = `Step ${stepNumber} marked as completed: ${stepText}. Next: Step ${nextStepNumber}: "${nextStep.step}"`;
                  } else {
                    responseData = `Step ${stepNumber} marked as completed: ${stepText}.`;
                    // Trigger checklist completion callback
                    if (onChecklistCompleted) {
                      onChecklistCompleted(checklistData.operationTitle);
                    }
                  }
                  
                  console.log('Sending markStepCompleted response with next step:', responseData);
                  
                  if (onStepCompleted) {
                    onStepCompleted(stepNumber, stepText);
                  }
                  
                  replyToFunctionCall(functionCall.name, responseData);
                  addLog(sessionId, functionCall.name, "response", { 
                    stepNumber, 
                    stepText, 
                    nextStepNumber: nextStep ? getStepNumber(nextStep, nextStepIndex) : 'none',
                    nextStepText: nextStep?.step || 'none',
                    responseData: responseData
                  });
                } else {
                  throw new Error('Failed to get checklist for next step');
                }
              } catch (error) {
                console.error("Error getting next step:", error);
                let responseData = `Step ${stepNumber} marked as completed: ${stepText}. Continue with the next step.`;
                
                if (onStepCompleted) {
                  onStepCompleted(stepNumber, stepText);
                }
                
                replyToFunctionCall(functionCall.name, responseData);
                addLog(sessionId, functionCall.name, "response", { stepNumber, stepText });
              }
            } else {
              let responseData = `Step ${stepNumber} marked as completed: ${stepText}`;
              
              if (onStepCompleted) {
                onStepCompleted(stepNumber, stepText);
              }
              
              replyToFunctionCall(functionCall.name, responseData);
              addLog(sessionId, functionCall.name, "response", { stepNumber, stepText });
            }
            
          } catch (error) {
            console.error("Error marking step completed:", error);
            let errorResponse = "Error marking step as completed";
            replyToFunctionCall(functionCall.name, errorResponse);
            addLog(sessionId, functionCall.name, "error", { error: error.message });
          }
          resolve();
          break;

        case "queryDataworkz":
          try {
            const { query } = functionCall.args;
            console.log("Querying Dataworkz with:", query);
            
            const response = await fetch("/api/dataworkz/answer", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ questionText: query }),
            });

            console.log("Dataworkz API response status:", response.status);
            const dataworkzResponse = await response.json();
            console.log("Dataworkz API response data:", dataworkzResponse);
            
            if (response.ok && !dataworkzResponse.error) {
              let responseData = dataworkzResponse.answer || dataworkzResponse.result || dataworkzResponse.response || "No answer found in the knowledge base.";
              
              replyToFunctionCall(functionCall.name, responseData);
              addLog(sessionId, functionCall.name, "response", { query, answered: true });
            } else {
              let errorResponse = "I'm having trouble accessing the knowledge base right now. Would you like to start the checklist instead?";
              replyToFunctionCall(functionCall.name, errorResponse);
              addLog(sessionId, functionCall.name, "error", { 
                error: dataworkzResponse.error || "Failed to get answer",
                details: dataworkzResponse.details 
              });
            }
          } catch (error) {
            console.error("Error querying Dataworkz:", error);
            let errorResponse = "I'm having trouble accessing the knowledge base right now. Would you like to start the checklist instead?";
            replyToFunctionCall(functionCall.name, errorResponse);
            addLog(sessionId, functionCall.name, "error", { error: error.message });
            addLog(sessionId, functionCall.name, "error", errorResponse);
          }
          resolve();
          break;

        case "closeChat":
          setTimeout(() => {
            setCurrentView("navigation");

            let response = "Closing chat and returning to navigation.";
            replyToFunctionCall(functionCall.name, response);

            addLog(sessionId, functionCall.name, "response", { action: "closeChat" });

            resolve();
          }, 500);
          break;
          
        case "switchToManualMode":
          try {
            const { reason } = functionCall.args;
            console.log(`Switching to manual mode: ${reason}`);
            
            // IMMEDIATELY stop any TTS and recording
            if (isPlayingTTSRef.current) {
              console.log("EMERGENCY: Stopping all TTS for manual mode");
              isPlayingTTSRef.current = false;
              const audioElements = document.querySelectorAll('audio');
              audioElements.forEach(audio => {
                if (!audio.paused) {
                  audio.pause();
                  audio.currentTime = 0;
                }
              });
            }
            
            if (isRecording) {
              stopRecording();
            }
            setIsManualMode(true);
            
            let responseData = "Manual checklist configuration enabled, speech stops.";            
            setMessagesToShow((prev) => [
              ...prev,
              { 
                sender: "assistant", 
                text: responseData,
                source: "manual_mode_switch"
              }
            ]);
            addLog(sessionId, functionCall.name, "response", { reason });
            
          } catch (error) {
            console.error("Error switching to manual mode:", error);
            let errorResponse = "Error switching to manual mode";
            setMessagesToShow((prev) => [
              ...prev,
              { 
                sender: "assistant", 
                text: errorResponse,
                source: "manual_mode_error"
              }
            ]);
            addLog(sessionId, functionCall.name, "error", { error: error.message });
          }
          resolve();
          break;
          
        default:
          console.warn("Unknown function call:", functionCall.name);
          resolve();
      }
    });
  };

  const replyToFunctionCall = async (name, content) => {
  const messageToSend = `Function ${name} completed: ${content}`;

    let assistantMessageIndex;
    setMessagesToShow((prev) => {
      const updatedMessages = [...prev, { sender: "assistant", text: "" }];
      assistantMessageIndex = updatedMessages.length - 1;
      return updatedMessages;
    });

    try {
      console.log("Sending function result as text message:", { name, content, messageToSend });
      
      const response = await fetch("/api/gcp/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId,
          message: messageToSend,
        }),
      });

      if (!response.ok) {
        console.error("Function response API error:", response.status, response.statusText);
        const errorText = await response.text();
        console.error("Error details:", errorText);
        setMessagesToShow((prev) => [
          ...prev.slice(0, -1), 
          { 
            sender: "assistant", 
            text: name === "queryDataworkz" 
              ? "I'm having trouble accessing the knowledge base. Would you like to start the checklist instead?"
              : "I'm processing your request. Please continue with the next step or say 'done' when ready."
          }
        ]);
        return;
      }

      if (!response.body) {
        console.error("Error sending function response - no response body.");
        setMessagesToShow((prev) => [
          ...prev.slice(0, -1),
          { 
            sender: "assistant", 
            text: "Please continue with the next step or say 'done' when ready."
          }
        ]);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let partialMessage = "";

      const processStream = async () => {
        try {
          const { value, done } = await reader.read();
          if (done) {
            if (partialMessage && !isSpeakerMuted && !isManualMode) {
              const isGreeting = partialMessage.includes("Hi, I'm Leafy") || 
                                partialMessage.includes("would you like to make a question or begin your voice checklist");
              const isCompletionMessage = partialMessage.includes("Checklist complete!");
              
              if (isGreeting && greetingSent) {
                console.log("Skipping repeated greeting in function response:", partialMessage);
                return;
              }
              
              // Skip any completion message that comes through the LLM since we handle it separately
              if (isCompletionMessage && !partialMessage.includes("Well done")) {
                console.log("Skipping LLM checklist completion in function response (handled separately):", partialMessage);
                return;
              }
              
              if (isGreeting) {
                setGreetingSent(true);
                console.log("First greeting detected in function response, marking as sent");
              }
              
              await handleTextToSpeech(partialMessage);
            }
            return;
          }

          partialMessage += decoder.decode(value, { stream: true });

          const isGreeting = partialMessage.includes("Hi, I'm Leafy") || 
                            partialMessage.includes("would you like to make a question or begin your voice checklist");
          const isCompletionMessage = partialMessage.includes("Checklist complete!");
          
          if (isGreeting && greetingSent) {
            console.log("Skipping repeated greeting in function response UI:", partialMessage);
            return;
          }
          
          // Skip any completion message that comes through the LLM since we handle it separately
          if (isCompletionMessage && !partialMessage.includes("Well done")) {
            console.log("Skipping LLM checklist completion in function response UI (handled separately):", partialMessage);
            return;
          }

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
        console.log("Speech recognized:", data.text);
        
        // Improved echo detection and filtering
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
            
            if (userText.length > 8 && assistantText.includes(userText)) {
              return true;
            }
            
            if (assistantText.length > 8 && userText.includes(assistantText)) {
              return true;
            }
            
            // Check for similar words
            const assistantWords = assistantText.split(' ');
            const userWords = userText.split(' ');
            if (userWords.length > 1 && assistantWords.length > 1) {
              const matchingWords = userWords.filter(word => 
                word.length > 3 && assistantWords.some(aWord => 
                  aWord.includes(word) || word.includes(aWord)
                )
              );
              if (matchingWords.length > userWords.length * 0.7) {
                return true;
              }
            }
            
            return false;
          });
          
          if (userText.length < 2 || /^[^\w]*$/.test(userText)) {
            console.log("Filtering out noise/short input:", userText);
            return prev;
          }
          
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
            console.log("Processing user speech input:", data.text);
            stopRecording();
            
            // Clean up the text before sending to LLM
            const cleanedText = data.text.trim()
              .replace(/\s+/g, ' ')
              .replace(/[^\w\s\.\?\!']/g, ''); 
            
            if (cleanedText.length >= 2 && /[a-zA-Z]/.test(cleanedText)) {
              handleLLMResponse(cleanedText);
            } else {
              console.log("Input too short or invalid, ignoring:", cleanedText);
            }
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
    
    // More aggressive cleanup with immediate nullification
    try {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    } catch (e) {
      console.warn("Error closing socket:", e);
    }
    
    try {
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.port.onmessage = null;
        processorRef.current = null;
      }
    } catch (e) {
      console.warn("Error cleaning processor:", e);
    }
    
    try {
      if (audioInputRef.current) {
        audioInputRef.current.disconnect();
        audioInputRef.current = null;
      }
    } catch (e) {
      console.warn("Error cleaning audio input:", e);
    }
    
    try {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
    } catch (e) {
      console.warn("Error closing audio context:", e);
    }
    
    // Aggressive memory cleanup
    if (typeof window !== 'undefined') {
      // Force garbage collection if available
      if (window.gc) {
        setTimeout(() => window.gc(), 100);
      }
      
      // Clear any remaining audio elements
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach(audio => {
        try {
          if (!audio.paused) {
            audio.pause();
          }
          audio.src = '';
          audio.load();
        } catch (e) {
          console.warn("Error cleaning audio element:", e);
        }
      });
    }
  };

  const handleTextToSpeech = async (text) => {
    return new Promise(async (resolve, reject) => {
      try {
        const isManualModeMessage = text.includes("Manual checklist configuration enabled");
        const isCompletionMessage = text.includes("Checklist complete!");
        
        // Prevent duplicate completion messages in TTS
        if (isCompletionMessage && !text.includes("Well done")) {
          console.log("Skipping LLM checklist completion TTS (handled separately):", text);
          resolve();
          return;
        }
        
        if (isManualMode && !isManualModeMessage && !isCompletionMessage) {
          console.log("Skipping TTS - manual mode enabled, text:", text);
          resolve();
          return;
        }
        if (isManualModeMessage) {
          console.log("Speaking manual mode announcement, then stopping all TTS");
        }
        
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

          // event listeners to track playback state and resolve promise
          audio.addEventListener('ended', () => {
            console.log("TTS playback ended");
            isPlayingTTSRef.current = false;
            // Clean up audio element to free memory
            audio.src = '';
            audio.load();
            resolve();
          });

          audio.addEventListener('error', (error) => {
            console.log("TTS playback error:", error);
            isPlayingTTSRef.current = false;
            // Clean up audio element to free memory
            audio.src = '';
            audio.load();
            reject(error);
          });

          const playPromise = audio.play();

          if (playPromise !== undefined) {
            await playPromise.catch((error) => {
              console.log("Audio playback required user interaction first:", error);
              isPlayingTTSRef.current = false;
              reject(error);
            });
          }
          
        } else {
          isPlayingTTSRef.current = false;
          resolve();
        }
      } catch (error) {
        console.error("Error in text-to-speech:", error);
        isPlayingTTSRef.current = false;
        reject(error);
      }
    });
  };

  useEffect(() => {
    if (onManualStepCompleted) {
      const handleManualCompletion = (stepNumber, stepText) => {
        console.log(`Manual step completion received: Step ${stepNumber} - ${stepText}`);
        if (!isManualMode) {
          console.log("Switching to manual mode");          
          setIsManualMode(true);
          
          if (isPlayingTTSRef.current) {
            console.log("Stopping TTS due to manual step completion");
            isPlayingTTSRef.current = false;
            const audioElements = document.querySelectorAll('audio');
            audioElements.forEach(audio => {
              if (!audio.paused) {
                audio.pause();
                audio.currentTime = 0;
              }
            });
          }
          
          if (isRecording) {
            stopRecording();
          }
          
          const manualMessage = "Manual checklist configuration enabled, speech stops.";
          setMessagesToShow((prev) => [
            ...prev,
            { 
              sender: "assistant", 
              text: manualMessage,
              source: "manual_completion"
            }
          ]);
          
          if (!isSpeakerMuted) {
            setTimeout(() => {
              handleTextToSpeech(manualMessage);
            }, 500);
          }
        } else {
          console.log("Already in manual mode, ignoring subsequent manual completions");
        }
      };
      
      window.handleManualStepCompletion = handleManualCompletion;
    }
  }, [onManualStepCompleted, isRecording, stopRecording, setMessagesToShow, setIsManualMode, isManualMode, isSpeakerMuted, handleTextToSpeech]);

  useEffect(() => {
    if (onChecklistCompleted) {
      const handleChecklistCompletion = (operationTitle) => {
        console.log(`Checklist completed for: ${operationTitle}`);
        
        // Set completion flag immediately to prevent duplicates
        if (checklistCompletionSent) {
          console.log("Checklist completion already handled, skipping duplicate");
          return;
        }
        setChecklistCompletionSent(true);
        
        if (isPlayingTTSRef.current) {
          isPlayingTTSRef.current = false;
          const audioElements = document.querySelectorAll('audio');
          audioElements.forEach(audio => {
            if (!audio.paused) {
              audio.pause();
              audio.currentTime = 0;
            }
          });
        }
        const congratsMessage = `Checklist complete! Well done. Is there anything else I can help you with today, or would you like me to close the session?`;
        setMessagesToShow((prev) => [
          ...prev,
          { 
            sender: "assistant", 
            text: congratsMessage,
            source: "completion"
          }
        ]);
        
        if (!isSpeakerMuted) {
          setTimeout(async () => {
            try {
              await handleTextToSpeech(congratsMessage);
              if (!isRecording && !isManualMode) {
                console.log("Restarting recording after checklist completion TTS finished");
                startRecording();
              }
            } catch (error) {
              console.error("Error during TTS, still restarting recording:", error);
              if (!isRecording && !isManualMode) {
                startRecording();
              }
            }
          }, 500);
        } else {
          if (!isRecording && !isManualMode) {
            console.log("Starting recording for user response after checklist completion (muted)");
            setTimeout(() => {
              startRecording();
            }, 500);
          }
        }
      };
      
      window.handleChecklistCompletion = handleChecklistCompletion;
    }
  }, [onChecklistCompleted, isRecording, isSpeakerMuted, stopRecording, handleTextToSpeech, setMessagesToShow, startRecording, isManualMode, checklistCompletionSent, setChecklistCompletionSent]);

  return {
    handleLLMResponse,
    startRecording,
    stopRecording,
    isPlayingTTS: () => isPlayingTTSRef.current,
    handleTextToSpeech,
  };
};

export default useChat;
