export const DEFAULT_GREETINGS = {
  sender: "assistant",
  text: "Hi, I'm Leafy, would you like to make a question or begin your voice checklist?",
};

export const SAMPLE_CONVERSATION = [
  // Question scenario
  { 
    sender: "user", 
    text: "Tell me about the APU"
  },
  { sender: "assistant", tool: "queryDataworkz" },
  {
    sender: "assistant",
    text: "Based on the manual: {dynamic answer from Dataworkz}. Would you like to ask another question or begin your checklist?"
  },
  { 
    sender: "user", 
    text: "I have a question" 
  },
  {
    sender: "assistant",
    text: "Great, what would you like to know?"
  },
  // Checklist scenario
  { 
    sender: "user", 
    text: "Begin checklist" 
  },
  { sender: "assistant", tool: "retrieveChecklist" },
  {
    sender: "assistant",
    text: "Step 1: GSE and passenger stairs detached; stand clear of obstructions, please confirm completion"
  },
  { 
    sender: "user", text: "Done" 
  },
  { sender: "assistant", tool: "markStepCompleted" },
  {
    sender: "assistant",
    text: "Step 2: {Read the next main checklist item}, please confirm completion"
  },
  { 
    sender: "user", text: "I'll do this manually" 
  },
  { sender: "assistant", tool: "switchToManualMode" },
  // Manual completion 
  {
    sender: "assistant",
    text: "Manual checklist configuration enabled"
  },
  {
    sender: "assistant",
    text: "Checklist complete! Well done. Closing outbound operation session."
  },
  {
    sender: "user",
    text: "That's all, thank you"
  },
  { sender: "assistant", tool: "closeChat" },
  {
    sender: "assistant",
    text: "You're welcome! Have a great day."
  },
  {
    sender: "user",
    text: "No, that's all. Thanks!"
  },
  { sender: "assistant", tool: "closeChat" },
];

