"use client";

import styles from "./page.module.css";
//import { MongoDBLogo } from "@leafygreen-ui/logo";
import { useState } from "react";
import { H1 } from "@leafygreen-ui/typography";
import ChatView from "@/components/chatView/ChatView";
import InfoWizard from "@/components/infoWizard/InfoWizard";
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
  const [dataworkzQuestion, setDataworkzQuestion] = useState("");
  const [dataworkzAnswer, setDataworkzAnswer] = useState(null);
  const [isLoadingDataworkz, setIsLoadingDataworkz] = useState(false);

  const handleUserSelected = () => {
    setUserSelected(true);
  };

  // Q&A Dataworkz
  const askDataworkz = async () => {
    if (!dataworkzQuestion.trim()) return;
    setIsLoadingDataworkz(true);
    setDataworkzAnswer(null);
    try {
      const res = await fetch("/api/dataworkz/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionText: dataworkzQuestion }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setDataworkzAnswer(
          errorData.error
            ? `Error: ${errorData.error}${errorData.details ? ` (${errorData.details})` : ""}`
            : "Unknown error occurred."
        );
        setIsLoadingDataworkz(false);
        return;
      }

      const data = await res.json();

      if (data.error) {
        setDataworkzAnswer(
          `Error: ${data.error}${data.details ? ` (${data.details})` : ""}`
        );
      } else {
        setDataworkzAnswer(
          data.answer || data.result || data.response || "No answer found."
        );
      }
    } catch (e) {
      setDataworkzAnswer("Network or server error. Please try again.");
      console.warn(e);
    }
    setIsLoadingDataworkz(false);
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

          <div style={{ margin: "24px 0", padding: 16, border: "1px solid #eee", borderRadius: 8, background: "#fafbfc", color: "black" }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Ask Dataworkz:</div>
            <input
              type="text"
              value={dataworkzQuestion}
              onChange={e => setDataworkzQuestion(e.target.value)}
              placeholder="Ask question..."
              style={{ width: "60%", marginRight: 8, padding: 4, color: "black" }}
              onKeyDown={e => { if (e.key === "Enter") askDataworkz(); }}
              disabled={isLoadingDataworkz}
            />
            <button onClick={askDataworkz} disabled={isLoadingDataworkz || !dataworkzQuestion.trim()}>
              {isLoadingDataworkz ? "Asking..." : "Ask"}
            </button>
            {dataworkzAnswer && (
              <div style={{ marginTop: 12, color: "#2a7", fontWeight: 500 }}>
                <span style={{ background: "#e6f7e6", padding: "4px 8px", borderRadius: 4, color: "black" }}>Dataworkz:</span> {dataworkzAnswer}
              </div>
            )}
          </div>

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
