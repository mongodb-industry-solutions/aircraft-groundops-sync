"use client";

import { createContext, useContext, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

const ChatSessionContext = createContext();

export function ChatSessionProvider({ children }) {
  const sessionId = useRef(uuidv4());

  return (
    <ChatSessionContext.Provider value={sessionId.current}>
      {children}
    </ChatSessionContext.Provider>
  );
}

export function useChatSession() {
  return useContext(ChatSessionContext);
}
