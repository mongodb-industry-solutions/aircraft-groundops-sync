"use client";

import styles from "./page.module.css";
import { MongoDBLogo } from "@leafygreen-ui/logo";
import { useState } from "react";
import { H1 } from "@leafygreen-ui/typography";
import ChatView from "@/components/chatView/ChatView";
import InfoWizard from "@/components/infoWizard/InfoWizard";
import LogConsole from "@/components/logConsole/LogConsole";
import { TALK_TRACK } from "@/lib/const";

export default function Home() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [simulationMode, setSimulationMode] = useState(false);
  const [openHelpModal, setOpenHelpModal] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [currentView, setCurrentView] = useState("navigation");
  const [showChatView, setShowChatView] = useState(false);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <MongoDBLogo />
        <H1>Aircraft Ground Operations</H1>
      </div>
      <InfoWizard
        open={openHelpModal}
        setOpen={setOpenHelpModal}
        tooltipText="Tell me more!"
        iconGlyph="Wizard"
        sections={TALK_TRACK}
      />

      {!showChatView ? (
        <div className={styles.openAssistantButton}>
          <button
            onClick={() => setShowChatView(true)}
            className={styles.assistantButton}
          >
            Open Assistant
          </button>
        </div>
      ) : (
        <ChatView
          setIsRecalculating={setIsRecalculating}
          setCurrentView={(view) => {
            setCurrentView(view);
            if (view === "navigation") {
              setShowChatView(false);
            }
          }}
          simulationMode={simulationMode}
          selectedDevice={selectedDevice}
        />
      )}

      <LogConsole simulationMode={simulationMode} />
    </div>
  );
}
