"use client";

import styles from "./page.module.css";
import { useState } from "react";
import { H1 } from "@leafygreen-ui/typography";
import ChatView from "@/components/chatView/ChatView";
import InfoWizard from "@/components/InfoWizard/InfoWizard";
import LogConsole from "@/components/logConsole/LogConsole";
import { TALK_TRACK } from "@/lib/const";
import '../fonts.css'
import dynamic from "next/dynamic";

const Login = dynamic(() => import('@/components/Login/Login'), { ssr: false });

export default function Home() {
  const [userSelected, setUserSelected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simulationMode, setSimulationMode] = useState(false);
  const [openHelpModal, setOpenHelpModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [currentView, setCurrentView] = useState("navigation");
  const [showChatView, setShowChatView] = useState(false);

  const handleUserSelected = () => {
    setUserSelected(true);
  };

  return (
    <>
      {!userSelected && <Login onUserSelected={handleUserSelected} />}
      {userSelected && (
        <div className={styles.page} style={{ color: "black" }}>
          <div className={styles.header}>
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
      )}
    </>
  );
}
