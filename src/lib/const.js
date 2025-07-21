export const DEFAULT_GREETINGS = {
  sender: "assistant",
  text: "Hi, I'm Leafy, how can I help you today?",
};

export const SAMPLE_CONVERSATION = [
  {
    sender: "assistant",
    text: "Would you like to begin your Outbound Operation checklist?"
  },
  { 
    sender: "user", 
    text: "Yes" 
  },
  { sender: "assistant", tool: "retrieveChecklist" },
  {
    sender: "assistant",
    text: "Step 1: {Read the first main checklist item}, please confirm completion"
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
    sender: "user", text: "Check" 
  },
  { sender: "assistant", tool: "markStepCompleted" },
  {
    sender: "assistant",
    text: "Step 3: {Read the next main checklist item}, please confirm completion"
  },
  { 
    sender: "user", text: "Completed" 
  },
  { sender: "assistant", tool: "markStepCompleted" },
  {
    sender: "assistant",
    text: "Step 4: {Read the next main checklist item}, please confirm completion"
  },
  { sender: "user", text: "Done" },
  { sender: "assistant", tool: "markStepCompleted" },
  {
    sender: "assistant",
    text: "Excellent! You've completed your Outbound Operation checklist. Need anything else?"
  },
  { sender: "user", text: "What does step 3 involve exactly?" },
  { sender: "assistant", tool: "queryDataworkz" },
  {
    sender: "assistant",
    text: "Step 3 involves {detailed explanation}. Do you need further assistance?"
  },
  {
    sender: "user",
    text: "No, that's all. Thanks!"
  },
  { sender: "assistant", tool: "closeChat" },
];

