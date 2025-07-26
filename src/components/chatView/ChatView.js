import React, { useEffect, useRef, useState } from "react";
import Message from "./message/Message";
import SuggestedAnswer from "./suggestedAnswer/SuggestedAnswer";
import styles from "./chatView.module.css";
import useChatSimulate from "@/hooks/useChatSimulate";
import useChat from "@/hooks/useChat";
import { DEFAULT_GREETINGS } from "@/lib/const";
import ChatOptions from "./chatOptions/ChatOptions";

const MAX_MESSAGES = 15; // More aggressive memory optimization - reduced from 100 to 15

const ChatView = ({
  setCurrentView,
  simulationMode,
  selectedDevice,
  selectedOperation,
  onStepCompleted,
  onManualStepCompleted,
  onChecklistCompleted,
  checklistCompleted = false,
}) => {
  const chatEndRef = useRef(null);
  const [messagesToShow, setMessagesToShow] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [suggestedAnswer, setSuggestedAnswer] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [writerMode, setWriterMode] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);

  const {
    handleNextMessageSimulate,
    typeMessageSimulate,
    startConversationSimulation,
  } = useChatSimulate({
    setCurrentView,
    setMessagesToShow,
    setIsTyping,
    setSuggestedAnswer,
  });

  const { handleLLMResponse, startRecording, stopRecording, isPlayingTTS, handleTextToSpeech } = useChat({
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
  });

  useEffect(() => {
    if (simulationMode) {
      startConversationSimulation();
    } else {
      if (messagesToShow.length === 0) {
        setMessagesToShow([DEFAULT_GREETINGS]);
        setIsTyping(false);
        setTimeout(() => {
          if (!isSpeakerMuted) {
            handleTextToSpeech(DEFAULT_GREETINGS.text);
          }
        }, 500);
      }
    }
  }, [simulationMode, selectedOperation, messagesToShow.length, isSpeakerMuted, handleTextToSpeech]);

  useEffect(() => {
    if (checklistCompleted && !simulationMode && messagesToShow.length > 0 && !isRecording) {
      console.log("Auto-starting recording after checklist completion");
      setTimeout(() => {
        if (!isRecording && !isPlayingTTS) {
          startRecording();
        }
      }, 1500);
    }
  }, [checklistCompleted, simulationMode, messagesToShow.length, isRecording, isPlayingTTS, startRecording]);

  useEffect(() => {
  }, [selectedOperation]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesToShow, suggestedAnswer]);

  // submitMessage for typing mode - use LLM chat to maintain conversation continuity
  const submitMessage = async (text) => {
    // Add user message to conversation first
    setMessagesToShow((prev) => {
      const lastMessage = prev[prev.length - 1];
      let updatedMessages;
      if (lastMessage?.sender === "user" && lastMessage?.text.trim() === "") {
        updatedMessages = [...prev.slice(0, -1), { sender: "user", text }];
      } else {
        updatedMessages = [...prev, { sender: "user", text }];
      }
      // Limit message history to prevent memory accumulation
      return updatedMessages.length > MAX_MESSAGES 
        ? updatedMessages.slice(-MAX_MESSAGES) 
        : updatedMessages;
    });

    // Use LLM chat instead of Dataworkz to maintain session continuity
    await handleLLMResponse(text);
  };

  useEffect(() => {
    if (!simulationMode && !isTyping && !isRecording && !writerMode && !isManualMode && messagesToShow.length > 0) {
      
      const checkTTSAndStartRecording = () => {
        const isTTSPlaying = isPlayingTTS ? isPlayingTTS() : false;
        
        if (isTTSPlaying) {
          setTimeout(checkTTSAndStartRecording, 500);
        } else {
          setTimeout(() => {
            if (!simulationMode && !isTyping && !isRecording && !writerMode && !isManualMode) {
              startRecording();
            }
          }, 500); // half second delay after text to speech ends 
        }
      };
      
      const timer = setTimeout(checkTTSAndStartRecording, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isTyping, simulationMode, isRecording, writerMode, isManualMode, messagesToShow.length, isPlayingTTS, startRecording]);

  return (
    <div className={styles.chatViewContainer}>
      <div className={`${styles.conversationContainer} ${selectedOperation ? styles.checklistContext : ''}`}>
        {messagesToShow.map((msg, index) => (
          <Message
            key={index}
            message={msg}
            isRecording={isRecording}
            isLastMessage={index === messagesToShow.length - 1}
            isFirstMessage={index === 0}
          />
        ))}
        <div ref={chatEndRef} />
      </div>

      {!simulationMode ? (
        <ChatOptions
          isSpeakerMuted={isSpeakerMuted}
          setIsSpeakerMuted={setIsSpeakerMuted}
          writerMode={writerMode}
          setWriterMode={setWriterMode}
          isRecording={isRecording}
          startRecording={startRecording}
          stopRecording={stopRecording}
          isTyping={isTyping}
          submitMessage={submitMessage}
        />
      ) : (
        <SuggestedAnswer
          suggestedAnswer={suggestedAnswer}
          isTyping={isTyping}
          onSuggestionClick={() => {
            setSuggestedAnswer(null);
            handleNextMessageSimulate();
          }}
        />
      )}
    </div>
  );
};

export default ChatView;