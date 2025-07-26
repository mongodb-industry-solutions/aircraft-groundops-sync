import React, { useState, useCallback } from "react";
import Toggle from "@leafygreen-ui/toggle";
import TextInput from "@leafygreen-ui/text-input";
import Button from "@leafygreen-ui/button";
import styles from "./chatOptions.module.css";
import { Body } from "@leafygreen-ui/typography";
import Icon from "@leafygreen-ui/icon";
import IconButton from "@leafygreen-ui/icon-button";

const ChatOptions = ({
  isSpeakerMuted,
  setIsSpeakerMuted,
  writerMode,
  setWriterMode,
  isRecording,
  startRecording,
  stopRecording,
  isTyping,
  submitMessage,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [userInput, setUserInput] = useState("");

  const handleExpandMenu = useCallback(() => {
    console.log("Expanding chat options menu");
    setIsCollapsed(false);
  }, []);

  const handleCollapseMenu = useCallback(() => {
    console.log("Collapsing chat options menu");
    setIsCollapsed(true);
  }, []);

  const handleToggleRecording = useCallback(() => {
    console.log("Toggling recording:", isRecording ? "stop" : "start");
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handleToggleWriterMode = useCallback(() => {
    console.log("Toggling writer mode:", writerMode ? "disable" : "enable");
    if (!writerMode && isRecording) {
      stopRecording();
    }
    setWriterMode((prev) => !prev);
  }, [writerMode, isRecording, stopRecording, setWriterMode]);

  const handleToggleSpeaker = useCallback(() => {
    console.log("Toggling speaker mute:", isSpeakerMuted ? "unmute" : "mute");
    setIsSpeakerMuted((prev) => !prev);
  }, [isSpeakerMuted, setIsSpeakerMuted]);

  return (
    <div 
      className={styles.chatOptionsContainer}
      data-debug={process.env.NODE_ENV === 'development'}
      data-collapsed={isCollapsed}
      data-writer-mode={writerMode}
    >
      {isCollapsed ? (
        <div className={styles.collapsedBanner}>
          <IconButton
            onClick={handleExpandMenu}
            aria-label="Expand Menu"
          >
            <Icon glyph="ChevronDown" />
          </IconButton>
        </div>
      ) : (
        <div className={styles.expandedMenu}>
          {/* Header */}
          <div className={styles.menuHeader}>
            <IconButton
              onClick={handleCollapseMenu}
              aria-label="Collapse Menu"
            >
              <Icon glyph="ChevronUp" />
            </IconButton>
          </div>

          {/* Toggle Controls */}
          <div className={styles.togglesContainer}>
            <div className={styles.toggleGroup}>
              <Body weight="medium">Mic</Body>
              <Toggle
                size="xsmall"
                checked={isRecording}
                onChange={handleToggleRecording}
                aria-label="Microphone Toggle"
              />
            </div>

            <div className={styles.toggleGroup}>
              <Body weight="medium">Speaker</Body>
              <Toggle
                size="xsmall"
                checked={!isSpeakerMuted}
                onChange={handleToggleSpeaker}
                aria-label="Speaker Toggle"
              />
            </div>

            <div className={styles.toggleGroup}>
              <Body weight="medium">Typing</Body>
              <Toggle
                size="xsmall"
                checked={writerMode}
                onChange={handleToggleWriterMode}
                aria-label="Typing Mode Toggle"
              />
            </div>
          </div>

          {writerMode && (
            <div className={styles.writerContainer}>
              <TextInput
                placeholder="Type your message..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && userInput.trim()) {
                    console.log("Submitting message via Enter:", userInput);
                    submitMessage(userInput);
                    setUserInput(""); 
                  }
                }}
                aria-labelledby="Text input"
                className={styles.textArea}
                disabled={isTyping}
              />
              <Button
                className={styles.sendButton}
                disabled={isTyping || !userInput.trim()}
                onClick={() => {
                  console.log("Submitting message via button:", userInput);
                  submitMessage(userInput);
                  setUserInput("");
                }}
              >
                Send
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatOptions;
