"use client";

import styles from "./page.module.css";
import { useState } from "react";
import InfoWizard from "@/components/infoWizard/InfoWizard";
//import LogConsole from "@/components/logConsole/LogConsole";
import OutboundOps from "@/components/OutboundOps/OutboundOps";
import Checklist from "@/components/Checklist/checklist";
import "../fonts.css";
import dynamic from "next/dynamic";

const Login = dynamic(() => import("@/components/Login/Login"), { ssr: false });

export default function Home() {
  const [userSelected, setUserSelected] = useState(false);
  const [operationSelected, setOperationSelected] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState(null);
  const [openHelpModal, setOpenHelpModal] = useState(false);
  const [checklistCompleted, setChecklistCompleted] = useState(false);

  const handleUserSelected = () => {
    setUserSelected(true);
  };

  const handleOperationSelected = (operation) => {
    setSelectedOperation(operation);
    setOperationSelected(true);
    setChecklistCompleted(false); // Reset completion state for new operation
  };

  const handleChecklistCompleted = (operationTitle) => {
    //console.log(`Manual checklist completed for: ${operationTitle}`);
    setChecklistCompleted(true);
  };

  return (
    <>
      {!userSelected && <Login onUserSelected={handleUserSelected} />}
      {userSelected && !operationSelected && (
        <OutboundOps onOperationSelected={handleOperationSelected} />
      )}
      {userSelected && operationSelected && (
        <div className={styles.page}>
          <InfoWizard
            open={openHelpModal}
            setOpen={setOpenHelpModal}
            tooltipText="Tell me more!"
            iconGlyph="Wizard"
          />

          <Checklist
            selectedOperation={selectedOperation}
            onBack={() => {
              setOperationSelected(false);
              setSelectedOperation(null);
              setChecklistCompleted(false);
            }}
            onManualStepCompleted={(stepNumber, stepText) => {
              //console.log(`Manual step completed: ${stepNumber} - ${stepText}`);
            }}
            onChecklistCompleted={handleChecklistCompleted}
          />
          {checklistCompleted && (
            <div className={styles.completionOptions}>
              <div className={styles.completionMessage}>
                <h3>Checklist Complete! 🎉</h3>
                <p>
                  Great job! Your checklist has been completed successfully.
                </p>
              </div>
              <div className={styles.nextSteps}>
                <button
                  onClick={() => {
                    setOperationSelected(false);
                    setSelectedOperation(null);
                    setChecklistCompleted(false);
                  }}
                  className={styles.backButton}
                >
                  Back to Main Menu
                </button>
              </div>
            </div>
          )}

          {/* <LogConsole simulationMode={false} /> */}
        </div>
      )}
    </>
  );
}
