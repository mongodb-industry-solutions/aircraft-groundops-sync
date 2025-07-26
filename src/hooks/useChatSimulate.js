import { useCallback, useState } from "react";

const useChatSimulate = ({
  setCurrentView,
  setMessagesToShow,
  setIsTyping,
  setSuggestedAnswer,
}) => {
  const MAX_MESSAGES = 15; // More aggressive memory optimization - reduced from 100 to 15
  const [messageIndex, setMessageIndex] = useState(0);

  const messages = [];

  const playAudioSimulate = useCallback((index) => {
    const audioFile = `/audios/${index}.wav`;
    const audio = new Audio(audioFile);
    audio.addEventListener('ended', () => {
      // Clean up audio element to free memory
      audio.src = '';
      audio.load();
    });
    audio.play();
  }, []);

  const typeMessageSimulate = useCallback(
    (message, index) => {
      return new Promise((resolve) => {
        setIsTyping(true);
        if (message.sender === "assistant") playAudioSimulate(index);

        const words = message.text.split(" ");
        let wordIndex = 0;

        const interval = setInterval(() => {
          setMessagesToShow((prev) => {
            const updated = [...prev];
            if (updated.length > 0) {
              updated[updated.length - 1].text = words
                .slice(0, wordIndex + 1)
                .join(" ");
            }
            // Limit message history during typing for memory optimization
            return updated.length > MAX_MESSAGES 
              ? updated.slice(-MAX_MESSAGES) 
              : updated;
          });

          wordIndex += 1;
          if (wordIndex === words.length) {
            clearInterval(interval);
            setIsTyping(false);
            resolve();
          }
        }, 250);
      });
    },
    [playAudioSimulate]
  );

  const handleToolSimulate = useCallback(
    (toolName) => {
      return new Promise((resolve) => {
        switch (toolName) {
          case "recalculateRoute":
            setTimeout(() => {
              resolve();
            }, 2000);
            break;
          case "closeChat":
            setTimeout(() => {
              setCurrentView("navigation");
              resolve();
            }, 500);
            break;
          default:
            resolve();
        }
      });
    },
    [setCurrentView]
  );

  const handleNextMessageSimulate = useCallback(async () => {
    if (messageIndex < messages.length) {
      const newMessage = messages[messageIndex];

      if (newMessage.tool) {
        await handleToolSimulate(newMessage.tool);
      } else {
        setMessagesToShow((prev) => {
          const updatedMessages = [...prev, { ...newMessage, text: "" }];
          // Limit message history for memory optimization
          return updatedMessages.length > MAX_MESSAGES 
            ? updatedMessages.slice(-MAX_MESSAGES) 
            : updatedMessages;
        });
        await typeMessageSimulate(newMessage, messageIndex);
      }
      setMessageIndex((prev) => prev + 1);
    }
  }, [messageIndex, handleToolSimulate, typeMessageSimulate]);

  const startConversationSimulation = useCallback(async () => {
    if (messageIndex < messages.length) {
      const timeout = setTimeout(async () => {
        const nextMessage = messages[messageIndex];

        if (nextMessage.sender === "user") {
          setSuggestedAnswer(nextMessage.text);
        } else {
          await handleNextMessageSimulate();
        }
      }, 1000);

      return () => clearTimeout(timeout);
    }
  }, [handleNextMessageSimulate, setSuggestedAnswer]);

  return {
    typeMessageSimulate,
    handleNextMessageSimulate,
    startConversationSimulation,
  };
};

export default useChatSimulate;
