import React from "react";
import { Body, Label } from "@leafygreen-ui/typography";
import styles from "./message.module.css";

const Message = ({ message, isRecording, isLastMessage, isFirstMessage }) => {
  const isUser = message.sender === "user";
  return (
    <div
      className={`${styles.messageContainer} ${
        isUser ? styles.user : styles.assistant
      } ${isFirstMessage ? styles.firstMessage : ''}`}
    >
      <div className={styles.messageHeader}>
        {isUser && isLastMessage && (
          <span
            className={`${styles.recordingIndicator} ${
              isRecording ? styles.pulsing : ""
            }`}
          />
        )}
        <Label className={styles.senderName} baseFontSize={13}>
          {message.sender === "user" ? "Eddy" : "Leafy Assistant"}
        </Label>
      </div>
      <Body
        className={styles.messageBubble}
        baseFontSize={16}
        weight={"medium"}
      >
        {message.text}
      </Body>
    </div>
  );
};

export default Message;
