export const DEFAULT_GREETINGS = {
  sender: "assistant",
  text: "Hi! I'm Leafy, I'll help you with your Ground Ops today",
};

export const SAMPLE_CONVERSATION = [
  {
    sender: "assistant",
    text: "Hi! I'm Leafy, I'll help you with your Ground Ops today",
  },
  {
    sender: "assistant",
    text: "Let's begin your Outbound operation's Checklist",
  },
  { sender: "user", text: "Hey, what’s this red light on my dashboard?" },
  { sender: "assistant", tool: "fetchDTCCodes" },
  {
    sender: "assistant",
    text: "That’s the engine oil pressure warning. It means your oil level might be low. Want me to guide you on what to do?",
  },
  { sender: "user", text: "Yes, please." },
  { sender: "assistant", tool: "consultManual" },
  {
    sender: "assistant",
    text: "First, pull over safely and turn off the engine. Then, check the oil level and top it up if needed. If the light stays on, you should get the car checked. Want me to add the nearest service station to your route?",
  },
  { sender: "user", text: "Yes, that’d be great!" },
  { sender: "assistant", tool: "recalculateRoute" },
  {
    sender: "assistant",
    text: "Done! I’ve set your route to the closest service station. Drive safely! Is there anything else I can assist you with today?",
  },
  {
    sender: "user",
    text: "No, that's all. Thanks!",
  },
  { sender: "assistant", tool: "closeChat" },
];

