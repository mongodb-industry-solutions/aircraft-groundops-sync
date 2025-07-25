"use client";

import styles from "./page.module.css";
import { useState } from "react";
import { H1 } from "@leafygreen-ui/typography";
import InfoWizard from "@/components/InfoWizard/InfoWizard";
import LogConsole from "@/components/logConsole/LogConsole";
import OutboundOps from "@/components/OutboundOps/OutboundOps";
import Checklist from "@/components/Checklist/checklist";
import '../fonts.css'
import dynamic from "next/dynamic";

const Login = dynamic(() => import('@/components/Login/Login'), { ssr: false });

export default function Home() {
  const [userSelected, setUserSelected] = useState(false);
  const [operationSelected, setOperationSelected] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState(null);
  const [simulationMode, setSimulationMode] = useState(false);
  const [openHelpModal, setOpenHelpModal] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistCompleted, setChecklistCompleted] = useState(false);

  const handleUserSelected = () => {
    setUserSelected(true);
  };

  const handleOperationSelected = (operation) => {
    setSelectedOperation(operation);
    setOperationSelected(true);
    setShowChecklist(true); 
    setChecklistCompleted(false);
  };

  const handleChecklistCompleted = (operationTitle) => {
    console.log(`Manual checklist completed for: ${operationTitle}`);
    setChecklistCompleted(true);
  };

  return (
    <>
      {!userSelected && <Login onUserSelected={handleUserSelected} />}
      {userSelected && !operationSelected && (
        <OutboundOps onOperationSelected={handleOperationSelected} />
      )}
      {userSelected && operationSelected && (
        <div className={styles.page} style={{ color: "black" }}>
          <div className={styles.header}>
            <div className={styles.headerControls}>
              <button
                onClick={() => {
                  setOperationSelected(false);
                  setSelectedOperation(null);
                  setShowChecklist(false);
                }}
                className={styles.backButton}
              >
                ← Change Operation
              </button>
            </div>
            <H1>Aircraft Ground Operations - {selectedOperation?.title}</H1>
          </div>
          <InfoWizard
            open={openHelpModal}
            setOpen={setOpenHelpModal}
            tooltipText="Tell me more!"
            iconGlyph="Wizard"
          />

          <div>
            <Checklist 
              selectedOperation={selectedOperation}
              onBack={() => {
                setOperationSelected(false);
                setSelectedOperation(null);
                setShowChecklist(false);
                setChecklistCompleted(false);
              }}
              onManualStepCompleted={(stepNumber, stepText) => {
                console.log(`Manual step completed: ${stepNumber} - ${stepText}`);
              }}
              onChecklistCompleted={handleChecklistCompleted}
            />
            {checklistCompleted && (
              <div className={styles.completionOptions}>
                <div className={styles.completionMessage}>
                  <h3>Checklist Complete! 🎉</h3>
                  <p>Great job! Your checklist has been completed successfully.</p>
                </div>
                <div className={styles.nextSteps}>
                  <button
                    onClick={() => {
                      setOperationSelected(false);
                      setSelectedOperation(null);
                      setShowChecklist(false);
                      setChecklistCompleted(false);
                    }}
                    className={styles.backButton}
                  >
                    Back to Main Menu
                  </button>
                </div>
              </div>
            )}
          </div>

          <LogConsole simulationMode={simulationMode} />
        </div>
      )}
    </>
  );
}
