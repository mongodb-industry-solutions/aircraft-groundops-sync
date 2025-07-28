"use client";

import { useState } from "react";
import Button from "@leafygreen-ui/button";
import AudioConfigMenu from "./audioConfigMenu/AudioConfigMenu";
import styles from "./optionsView.module.css";

const OptionsView = ({
  setCurrentView,
  setSelectedDevice,
}) => {
  const [isAudioConfigOpen, setIsAudioConfigOpen] = useState(false);

  const handleExecutionMode = () => {
    setIsAudioConfigOpen(true);
  };

  const handleDeviceConfirm = (deviceId) => {
    setSelectedDevice(deviceId);
    setCurrentView("navigation");
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Options Menu</h1>
      <div className={styles.buttonContainer}>
        <Button
          className={styles.button}
          onClick={handleExecutionMode}
        >
          Configure Audio & Start
        </Button>
      </div>

      <AudioConfigMenu
        isOpen={isAudioConfigOpen}
        onClose={() => setIsAudioConfigOpen(false)}
        onConfirm={handleDeviceConfirm}
      />
    </div>
  );
};

export default OptionsView;
