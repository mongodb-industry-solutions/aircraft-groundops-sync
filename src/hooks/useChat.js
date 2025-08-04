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
  const MAX_MESSAGES = 10; 
  
  // filter valid messages for counting
  const getValidMessages = (messages) => {
    return messages.filter(msg => 
      msg.text && 
      msg.text.trim().length > 0 && 
      !msg.failed && 
      !msg.typing &&
      !msg.text.includes("I'm having trouble understanding") && // Exclude error messages from count
      msg.text.trim() !== "" // Exclude blank (empty) messages
    );
  };
  const socketRef = useRef(null);
  const processorRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioInputRef = useRef(null);
  const isPlayingTTSRef = useRef(false); 
  const currentTTSMessageIndexRef = useRef(-1);
  const sessionId = useChatSession();
  const [greetingSent, setGreetingSent] = useState(false);
  const [checklistCompletionSent, setChecklistCompletionSent] = useState(false);
  
  const isGreetingMessage = (text) => {
    return text.includes("Hi, I'm Leafy") || 
           text.includes("would you like to make a question or begin your voice checklist") ||
           text.includes("Hello! I'm Leafy") ||
           text.includes("I'm here to help you") ||
           text.includes("Hi, I'm Leafy, would you like to make a question or begin your voice checklist?");
  };
  
  const isCompletionMessage = (text) => {
    return text.includes("Checklist complete!");
  };
  
  // Centralized audio cleanup utility
  const cleanupAudioElements = () => {
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      try {
        if (!audio.paused) {
          audio.pause();
        }
        audio.src = '';
        audio.load();
        audio.remove();
      } catch (e) {
        console.warn("Error cleaning audio element:", e);
      }
    });
  };
  
  const forceMemoryCleanup = () => {
    try {
      cleanupAudioElements();
      if (typeof window !== 'undefined' && window.gc) {
        window.gc();
      }
    } catch (error) {
        console.warn("Error during memory cleanup:", error);
      }
  };
  
  const stopAllTTS = () => {
    if (isPlayingTTSRef.current) {
      //console.log("Stopping all TTS playback");
      isPlayingTTSRef.current = false;
      currentTTSMessageIndexRef.current = -1; 
      cleanupAudioElements();
    }
  };

  // memory cleanup to save CPU cycles and potential memory overhead
  useEffect(() => {
    const cleanup = setInterval(forceMemoryCleanup, 120000); // 2 minutes for better performance
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
    setGreetingSent(false);
    setChecklistCompletionSent(false);
    //console.log("Reset greeting and checklist completion state for new operation");    
    return () => {
      //console.log("Cleaning up useChat hook resources");
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
        currentTTSMessageIndexRef.current = -1;
      } catch (error) {
        console.warn("Error during useChat cleanup:", error);
      }
    };
  }, [selectedOperation, setIsManualMode]);

  // Web Socket Config
  const protocol = (typeof window !== "undefined" && window.location.protocol === "https:") ? "wss" : "ws";
  const host = typeof window !== "undefined" ? window.location.host : "";

  const handleLLMResponse = async (userMessage) => {
    stopAllTTS();
    
    setIsTyping(true);
    let assistantMessageIndex;
    setMessagesToShow((prev) => {
      const updatedMessages = [...prev, { sender: "assistant", text: "" }];
      assistantMessageIndex = updatedMessages.length - 1;
      currentTTSMessageIndexRef.current = assistantMessageIndex;
      // Only limit valid messages to prevent memory buildup while keeping error/retry messages
      const validMessages = getValidMessages(updatedMessages);
      if (validMessages.length > MAX_MESSAGES) {
        const messagesToKeep = updatedMessages.slice(-MAX_MESSAGES - 2);
        return messagesToKeep;
      }
      return updatedMessages;
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
        
        const errorMessage = "I'm having trouble processing that. Could you please say 'done' when you've completed the step, or let me know if you'd prefer to use the manual checklist?";
        
        setMessagesToShow((prev) => {
          const updatedMessages = [
            ...prev.slice(0, -1), // Remove the empty assistant message
            { 
              sender: "assistant", 
              text: errorMessage
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
            ...prev.slice(0, -1), 
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
            const isGreeting = isGreetingMessage(partialMessage);
            const isCompletion = isCompletionMessage(partialMessage);
            
            if (isGreeting && greetingSent) {
              //console.log("Skipping repeated greeting:", partialMessage.slice(0, 50) + "...");
              partialMessage = null;
              setTimeout(forceMemoryCleanup, 100);
              return;
            }
            
            if (isCompletion && !partialMessage.includes("Well done")) {
              //console.log("Skipping LLM checklist completion message (handled separately):", partialMessage.slice(0, 50) + "...");
              partialMessage = null;
              setTimeout(forceMemoryCleanup, 100);
              return;
            }
            
            if (isGreeting) {
              setGreetingSent(true);
              //console.log("First greeting detected, marking as sent");
            }
            
            await handleTextToSpeech(partialMessage, assistantMessageIndex);
          }
          partialMessage = null;
          setTimeout(forceMemoryCleanup, 100);
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
          try {
            const fullContent = partialMessage + decodedChunk;
            const parsedFullContent = JSON.parse(fullContent);
            if (parsedFullContent.functionCall) {
              isFunctionCallActive = true;
              await handleFunctionCall(parsedFullContent.functionCall);
              isFunctionCallActive = false;
              partialMessage = "";
              processStream();
              return;
            }
          } catch {
          }          
          if (decodedChunk.includes('"functionCall"') && decodedChunk.includes('"name"')) {
            processStream();
            return;
          }
          
          const newContent = partialMessage + decodedChunk;          
          if (newContent.includes('{"functionCall"') || newContent.includes('"functionCall"')) {
            processStream();
            return;
          }
          
          const isGreeting = isGreetingMessage(newContent);
          const isCompletion = isCompletionMessage(newContent);
          
          if (isGreeting && greetingSent) {
            //console.log("Skipping repeated greeting in UI:", newContent.slice(0, 30) + "...");
            return;
          }
          
          if (isCompletion && !newContent.includes("Well done")) {
            //console.log("Skipping LLM checklist completion in UI (handled separately):", newContent.slice(0, 30) + "...");
            return;
          }
          
          partialMessage += decodedChunk;
          setMessagesToShow((prevMessages) => {
            const updatedMessages = prevMessages.map((msg, index) =>
              index === assistantMessageIndex
                ? { ...msg, text: partialMessage }
                : msg
            );
            const validMessages = getValidMessages(updatedMessages);
            if (validMessages.length > MAX_MESSAGES) {
              return updatedMessages.slice(-MAX_MESSAGES - 2); // Keep extra for system messages
            }
            return updatedMessages;
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
                  text: "I'm having trouble understanding that response. Could you please be more specific? You can say 'done' when you've completed a step, ask me a question about procedures, or say 'help' if you need assistance."
                }
              : msg
          );
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
              //console.log("No operation ID available - selectedOperation:", selectedOperation);
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

            //console.log('About to call checklist API with operationId:', operationId);
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
              addLog(sessionId, functionCall.name, "error", { 
                status: response.status,
                error: errorText 
              });
              resolve();
              break;
            }

            let checklistData;
            try {
              const responseText = await response.text();
              checklistData = JSON.parse(responseText);
            } catch (jsonError) {
              console.error("Failed to parse checklist response as JSON:", jsonError);
              let errorResponse = "I received an invalid response from the checklist service. Please try again or restart session.";
              replyToFunctionCall(functionCall.name, errorResponse);
              addLog(sessionId, functionCall.name, "error", { 
                error: "JSON parse error",
                details: jsonError.message 
              });
              resolve();
              break;
            }
            // //console.log('Raw checklist API response:', JSON.stringify(checklistData, null, 2));
            
            if (checklistData.error) {
              let errorResponse = "I couldn't find the checklist for this operation. Please make sure an operation is selected.";
              replyToFunctionCall(functionCall.name, errorResponse);
              addLog(sessionId, functionCall.name, "error", { error: checklistData.error });
            } else {
              const firstChecklistItem = checklistData.checklist?.[0];
              let responseData;
              
              // //console.log('First checklist item:', firstChecklistItem);
              // //console.log('All checklist items:', checklistData.checklist);
              // //console.log('Total checklist steps:', checklistData.checklist?.length || 0);
              
              if (firstChecklistItem) {
                const firstStepNumber = getStepNumber(firstChecklistItem, 0);
                responseData = `Retrieved checklist for ${checklistData.operationTitle}. Start with Step ${firstStepNumber}: "${firstChecklistItem.step}"`;
                // //console.log('First step details:', { stepNumber: firstStepNumber, stepText: firstChecklistItem.step });
              } else {
                responseData = `Retrieved checklist for ${checklistData.operationTitle} but no main checklist items found.`;
              }
              
              // //console.log('Sending response to assistant:', responseData);
              
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
            //console.log('Getting next step after completing step:', stepNumber);
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
                  
                  //console.log(`Current step ${stepNumber} found at index ${currentStepIndex}, looking for next step at index ${nextStepIndex}:`, nextStep);
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
                    if (onChecklistCompleted) {
                      onChecklistCompleted(checklistData.operationTitle);
                    }
                  }
                  
                  //console.log('Sending markStepCompleted response with next step:', responseData);
                  
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
            //console.log("Querying Dataworkz with:", query);
            
            const response = await fetch("/api/dataworkz/answer", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ questionText: query }),
            });

            //console.log("Dataworkz API response status:", response.status);
            const dataworkzResponse = await response.json();
            //console.log("Dataworkz API response data:", dataworkzResponse);
            
            if (response.ok && !dataworkzResponse.error) {
              let responseData = dataworkzResponse.answer || dataworkzResponse.result || dataworkzResponse.response || "Information not found in the knowledge base.";
              
              // Use direct reply to avoid double greetings and ensure TTS
              await replyDirectToUser(functionCall.name, responseData);
              addLog(sessionId, functionCall.name, "response", { query, answered: true });
            } else {
              let errorResponse = "I'm having trouble accessing the knowledge base right now. Would you like to start the checklist instead?";
              await replyDirectToUser(functionCall.name, errorResponse);
              addLog(sessionId, functionCall.name, "error", { 
                error: dataworkzResponse.error || "Failed to get answer",
                details: dataworkzResponse.details 
              });
            }
          } catch (error) {
            console.error("Error querying Dataworkz:", error);
            let errorResponse = "I'm having trouble accessing the knowledge base right now. Would you like to start the checklist instead?";
            await replyDirectToUser(functionCall.name, errorResponse);
            addLog(sessionId, functionCall.name, "error", { error: error.message });
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
            //console.log(`Switching to manual mode: ${reason}`);
            stopAllTTS();            
            if (isRecording) {
              stopRecording();
            }
            setIsManualMode(true);
            
            let responseData = "Manual checklist configuration enabled";            
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

  const replyDirectToUser = async (functionName, content) => {
    setIsTyping(false);
    setMessagesToShow((prev) => {
      const updatedMessages = [...prev, { 
        sender: "assistant", 
        text: content,
        source: functionName 
      }];
      const validMessages = getValidMessages(updatedMessages);
      if (validMessages.length > MAX_MESSAGES) {
        return updatedMessages.slice(-MAX_MESSAGES - 2);
      }
      return updatedMessages;
    });

    // Trigger TTS for the response
    if (!isSpeakerMuted && !isManualMode) {
      await handleTextToSpeech(content);
    }
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
      //console.log("Sending function result as text message:", { name, content, messageToSend });
      
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
              ? "I'm having trouble accessing the manual. Would you like to start the checklist instead?"
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
              const isGreeting = isGreetingMessage(partialMessage);
              const isCompletion = isCompletionMessage(partialMessage);
              
              if (isGreeting && greetingSent) {
                ////console.log("Skipping repeated greeting in function response:", partialMessage);
                return;
              }
              
              if (isCompletion && !partialMessage.includes("Well done")) {
                ////console.log("Skipping LLM checklist completion in function response (handled separately):", partialMessage);
                return;
              }
              
              if (isGreeting) {
                setGreetingSent(true);
                //console.log("First greeting detected in function response, marking as sent");
              }
              
              await handleTextToSpeech(partialMessage);
            }
            return;
          }

          partialMessage += decoder.decode(value, { stream: true });

          const isGreeting = isGreetingMessage(partialMessage);
          const isCompletion = isCompletionMessage(partialMessage);
          
          if (isGreeting && greetingSent) {
            //console.log("Skipping repeated greeting in function response UI:", partialMessage);
            return;
          }
          
          if (isCompletion && !partialMessage.includes("Well done")) {
            //console.log("Skipping LLM checklist completion in function response UI (handled separately):", partialMessage);
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
      //console.log("WebSocket connection established");
    };

    socketRef.current.onclose = () => {
      //console.log("WebSocket connection closed");
    };

    socketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.final && data.text.trim() !== "") {
        //console.log("Speech recognized:", data.text);
        
        // Simplified echo detection for production memory optimization
        setMessagesToShow((prev) => {
          const recentAssistantMessages = prev
            .filter(msg => msg.sender === "assistant" && msg.text)
            .slice(-2)
            .map(msg => msg.text.toLowerCase().trim());
          
          const userText = data.text.toLowerCase().trim();
          const isLikelyEcho = recentAssistantMessages.some(assistantText => {
            return assistantText === userText || 
                   (userText.length > 8 && assistantText.includes(userText)) ||
                   (assistantText.length > 8 && userText.includes(assistantText));
          });
          
          if (userText.length < 2 || /^[^\w]*$/.test(userText)) {
            //console.log("Filtering out noise/short input:", userText);
            return prev;
          }
          
          if (isLikelyEcho) {
            //console.log("Filtering out likely TTS echo:", userText);
            return prev; 
          }
          
          const updatedMessages = [...prev];
          updatedMessages[updatedMessages.length - 1] = {
            sender: "user",
            text: data.text,
          };
          return updatedMessages;
        });
        
        setMessagesToShow((prev) => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage?.sender === "user" && lastMessage?.text === data.text) {
            //console.log("Processing user speech input:", data.text);
            stopRecording();
            
            // Clean up the text before sending to LLM
            const cleanedText = data.text.trim()
              .replace(/\s+/g, ' ')
              .replace(/[^\w\s\.\?\!']/g, ''); 
            
            if (cleanedText.length >= 2 && /[a-zA-Z]/.test(cleanedText)) {
              handleLLMResponse(cleanedText);
            } else {
              //console.log("Input too short or invalid, ignoring:", cleanedText);
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
      }
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
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
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
    cleanupAudioElements();
      if (typeof window !== 'undefined' && window.gc) {
      setTimeout(() => window.gc(), 100);
    }
  };

  const handleTextToSpeech = async (text, messageIndex = -1) => {
    return new Promise(async (resolve, reject) => {
      try {
        const isManualModeMessage = text.includes("Manual checklist configuration enabled");
        const isCompletion = isCompletionMessage(text);        
        if (isCompletion && !text.includes("Well done")) {
          //console.log("Skipping LLM checklist completion TTS (handled separately):", text.slice(0, 50) + "...");
          resolve();
          return;
        }
        
        if (isManualMode && !isManualModeMessage && !isCompletion) {
          //console.log("Skipping TTS - manual mode enabled, text:", text.slice(0, 50) + "...");
          resolve();
          return;
        }
        
        if (isManualModeMessage) {
          //console.log("Speaking manual mode announcement, then stopping all TTS");
        }
        
        if (messageIndex !== -1 && messageIndex < currentTTSMessageIndexRef.current) {
          //console.log(`Skipping TTS for outdated message #${messageIndex}, current is #${currentTTSMessageIndexRef.current}`);
          resolve();
          return;
        }
        
        // Stop any recording before TTS
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          stopRecording();
        }
        
        stopAllTTS();
        isPlayingTTSRef.current = true;
        currentTTSMessageIndexRef.current = messageIndex; 
        
        const audioResponse = await fetch("/api/gcp/textToSpeech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!audioResponse.ok) {
          console.warn(`TTS API error: ${audioResponse.status} ${audioResponse.statusText}`);
          isPlayingTTSRef.current = false;
          currentTTSMessageIndexRef.current = -1;
          resolve();
          return;
        }

        let responseData;
        try {
          responseData = await audioResponse.json();
        } catch (jsonError) {
          console.warn("TTS response is not valid JSON:", jsonError);
          isPlayingTTSRef.current = false;
          currentTTSMessageIndexRef.current = -1;
          resolve();
          return;
        }

        const { audioContent } = responseData;

        if (audioContent) {
          const audio = new Audio(`data:audio/wav;base64,${audioContent}`);
          
          if (messageIndex !== -1 && messageIndex < currentTTSMessageIndexRef.current) {
            //console.log(`Aborting TTS for message #${messageIndex}, newer message #${currentTTSMessageIndexRef.current} is active`);
            isPlayingTTSRef.current = false;
            try {
              audio.src = '';
              audio.load();
            } catch (e) {
              // Ignore cleanup errors
            }
            resolve();
            return;
          }

        const handleEnded = () => {
          //console.log("TTS playback ended");
          isPlayingTTSRef.current = false;
          currentTTSMessageIndexRef.current = -1;
          try {
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
            audio.src = '';
            audio.load();
            audio.remove();
          } catch (e) {
          }
          setTimeout(forceMemoryCleanup, 100);
          resolve();
        };

        const handleError = (event) => {
          console.warn("TTS playback error occurred:", event?.type || 'unknown error');
          isPlayingTTSRef.current = false;
          currentTTSMessageIndexRef.current = -1;
          try {
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
            audio.src = '';
            audio.load();
            audio.remove();
          } catch (e) {
          }
          // Don't reject audio errors, just resolve to continue
          resolve();
        };

        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);

        try {
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            await playPromise.catch((playError) => {
              console.warn("Audio playback required user interaction:", playError?.message || 'unknown error');
              isPlayingTTSRef.current = false;
              currentTTSMessageIndexRef.current = -1;
              try {
                audio.removeEventListener('ended', handleEnded);
                audio.removeEventListener('error', handleError);
                audio.src = '';
                audio.load();
                audio.remove();
              } catch (e) {
                // Ignore cleanup errors
              }
              resolve();
            });
          }
        } catch (playError) {
          console.warn("Error calling audio.play():", playError?.message || 'unknown error');
          isPlayingTTSRef.current = false;
          currentTTSMessageIndexRef.current = -1;
          try {
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
            audio.src = '';
            audio.load();
            audio.remove();
          } catch (e) {
          }
          resolve();
        }
        
      } else {
        isPlayingTTSRef.current = false;
        currentTTSMessageIndexRef.current = -1;
        resolve();
      }
    } catch (error) {
      console.warn("Error in text-to-speech:", error?.message || 'unknown error');
      isPlayingTTSRef.current = false;
      currentTTSMessageIndexRef.current = -1;
      resolve(); // Always resolve to prevent breaking the conversation flow
    }
  });
};

  useEffect(() => {
    if (onManualStepCompleted) {
      const handleManualCompletion = (stepNumber, stepText) => {
        //console.log(`Manual step completion received: Step ${stepNumber} - ${stepText}`);
        if (!isManualMode) {
          //console.log("Switching to manual mode");          
          setIsManualMode(true);
          stopAllTTS();
          if (isRecording) {
            stopRecording();
          }
          
          const manualMessage = "Manual checklist configuration enabled";
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
          //console.log("Already in manual mode");
        }
      };
      
      window.handleManualStepCompletion = handleManualCompletion;
    }
  }, [onManualStepCompleted, isRecording, stopRecording, setMessagesToShow, setIsManualMode, isManualMode, isSpeakerMuted, handleTextToSpeech]);

  useEffect(() => {
    if (onChecklistCompleted) {
      const handleChecklistCompletion = (operationTitle) => {
        //console.log(`Checklist completed for: ${operationTitle}`);
        if (checklistCompletionSent) {
          //console.log("Checklist completion already handled, skipping duplicate");
          return;
        }
        setChecklistCompletionSent(true);        
        stopAllTTS();
        
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
                //console.log("Restarting recording after checklist completion TTS finished");
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
            //console.log("Starting recording for user response after checklist completion (muted)");
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
    stopAllTTS,
    isPlayingTTS: () => isPlayingTTSRef.current,
    handleTextToSpeech,
  };
};

export default useChat;