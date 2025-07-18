export const DEFAULT_GREETINGS = {
  sender: "assistant",
  text: "Ready to start your checklist! Let me get the items for you.",
};

export const SAMPLE_CONVERSATION = [
  {
    sender: "assistant",
    text: "Ready to start your checklist! Let me get the items for you.",
  },
  { sender: "assistant", tool: "retrieveChecklist" },
  {
    sender: "assistant",
    text: "Let's begin your Outbound Operation's checklist",
  },
  {
    sender: "assistant",
    text: "The first step is: {Read the checklist in steps order}, please confirm completion"
  },
  { 
    sender: "user", text: "Done" 
  },
  {
    sender: "assistant",
    text: "Step {next number step} : {Read the checklist in steps order}, please confirm completion"
  },
  { 
    sender: "user", text: "Check" 
  },
  {
    sender: "assistant",
    text: "Step {next number step} : {Read the checklist in steps order}, please confirm completion"
  },
  { 
    sender: "user", text: "Completed" 
  },
  {
    sender: "assistant",
    text: "Step {next number step} : {Read the checklist in steps order}, please confirm completion"
  },
  { sender: "user", text: "Done" },
  {
    sender: "assistant",
    text: "Step {next number step} : {Read the checklist in steps order}, please confirm completion"
  },
  { sender: "user", text: "Check" },
  {
    sender: "assistant",
    text: "Done! You've completed your Outbound Operation's checklist. If you need further assistance, let me know!",
  },
  { sender: "user", text: "What does step 3 involve exactly?" },
  { sender: "assistant", tool: "queryDataworkz" },
    {
    sender: "assistant",
    text: "Do you need further assistance?"
  },
  {
    sender: "user",
    text: "No, that's all. Thanks!",
  },
  { sender: "assistant", tool: "closeChat" },
];

