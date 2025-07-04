import React, { useEffect, useRef, useState } from "react";
import Message from "./message/Message";
import SuggestedAnswer from "./suggestedAnswer/SuggestedAnswer";
import styles from "./chatView.module.css";
import useChatSimulate from "@/hooks/useChatSimulate";
import useChat from "@/hooks/useChat";
import { DEFAULT_GREETINGS } from "@/lib/const";
import ChatOptions from "./chatOptions/ChatOptions";

const ChatView = ({
  setCurrentView,
  simulationMode,
  selectedDevice,
}) => {
  const chatEndRef = useRef(null);
  const [messagesToShow, setMessagesToShow] = useState([]);
  const [isTyping, setIsTyping] = useState(true);
  const [suggestedAnswer, setSuggestedAnswer] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [writerMode, setWriterMode] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isLoadingDataworkz, setIsLoadingDataworkz] = useState(false);

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

  const { handleLLMResponse, startRecording, stopRecording } = useChat({
    setCurrentView,
    setMessagesToShow,
    setIsTyping,
    setIsRecording,
    selectedDevice,
    isSpeakerMuted,
  });

  useEffect(() => {
    if (simulationMode) {
      startConversationSimulation();
    } else {
      setMessagesToShow([DEFAULT_GREETINGS]);
      typeMessageSimulate(DEFAULT_GREETINGS, 0);
    }
  }, [simulationMode, startConversationSimulation, typeMessageSimulate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesToShow, suggestedAnswer]);

  // submitMessage to Dataworkz
  const submitMessage = async (text) => {
    setMessagesToShow((prev) => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage?.sender === "user" && lastMessage?.text.trim() === "") {
        return [...prev.slice(0, -1), { sender: "user", text }];
      }
      return [...prev, { sender: "user", text }];
    });

    // Send all messages to Dataworkz API
    setIsTyping(true);
    setIsLoadingDataworkz(true);
    try {
      const res = await fetch("/api/dataworkz/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionText: text }),
      });
      
      let answer = "No answer found.";
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        answer = errorData.error
          ? `Error: ${errorData.error}${errorData.details ? ` (${errorData.details})` : ""}`
          : "Unknown error occurred.";
      } else {
        const data = await res.json();
        if (data.error) {
          answer = `Error: ${data.error}${data.details ? ` (${data.details})` : ""}`;
        } else {
          answer = data.answer || data.result || data.response || "No answer found.";
        }
      }
      setMessagesToShow((prev) => [
        ...prev,
        { sender: "assistant", text: answer, source: "dataworkz" },
      ]);
    } catch (e) {
      setMessagesToShow((prev) => [
        ...prev,
        { sender: "assistant", text: "Network or server error. Please try again.", source: "dataworkz" },
      ]);
    }
    setIsTyping(false);
    setIsLoadingDataworkz(false);
  };

  // Stop after LLM response sent
  useEffect(() => {
    if (!simulationMode && !isTyping && !isRecording && !writerMode) {
      startRecording();
    }
  }, [isTyping, simulationMode]);

  return (
    <div className={styles.chatViewContainer}>
      <div className={styles.conversationContainer}>
        {messagesToShow.map((msg, index) => (
          <Message
            key={index}
            message={msg}
            isRecording={isRecording}
            isLastMessage={index === messagesToShow.length - 1}
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
          isTyping={isTyping || isLoadingDataworkz}
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
