import {
  HarmBlockThreshold,
  HarmCategory,
  VertexAI,
  FunctionDeclarationSchemaType,
} from "@google-cloud/vertexai";
import { PredictionServiceClient, helpers } from "@google-cloud/aiplatform";
import { SAMPLE_CONVERSATION } from "./const";

const project = process.env.GCP_PROJECT_ID;
const location = process.env.GCP_LOCATION;
const completionsModel = process.env.VERTEXAI_COMPLETIONS_MODEL;

const apiEndpoint = process.env.VERTEXAI_API_ENDPOINT;

const vertexAIClient = new VertexAI({ project, location });
const predictionServiceClient = new PredictionServiceClient({
  apiEndpoint,
});

const functionDeclarations = [
  {
    functionDeclarations: [
      {
        name: "retrieveChecklist",
        description: "Retrieves the checklist for the current selected operation. Call this first when the conversation starts.",
        parameters: {
          type: FunctionDeclarationSchemaType.OBJECT,
          properties: {},
        },
      },
      {
        name: "markStepCompleted",
        description: "Marks a checklist step as completed when the user confirms it's done.",
        parameters: {
          type: FunctionDeclarationSchemaType.OBJECT,
          properties: {
            stepNumber: {
              type: FunctionDeclarationSchemaType.NUMBER,
              description: "The step number that was completed",
            },
            stepText: {
              type: FunctionDeclarationSchemaType.STRING,
              description: "The text of the step that was completed",
            },
          },
          required: ["stepNumber", "stepText"],
        },
      },
      {
        name: "switchToManualMode",
        description: "Switches to manual checklist mode when the user indicates they want to complete the checklist manually or when they seem confused about voice confirmations.",
        parameters: {
          type: FunctionDeclarationSchemaType.OBJECT,
          properties: {
            reason: {
              type: FunctionDeclarationSchemaType.STRING,
              description: "Brief reason for switching to manual mode (e.g., 'user requested', 'unclear responses')",
            },
          },
          required: ["reason"],
        },
      },
      {
        name: "queryDataworkz",
        description: "Queries the Dataworkz knowledge base for detailed information about procedures, troubleshooting, or any operation-related questions.",
        parameters: {
          type: FunctionDeclarationSchemaType.OBJECT,
          properties: {
            query: {
              type: FunctionDeclarationSchemaType.STRING,
              description: "A specific question about procedures, troubleshooting, or operations that needs detailed information",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "closeChat",
        description:
          "Closes the chat window when the conversation is finished or when user requests to end the session. Call this when user says they want to close, are done, finished, goodbye, etc.",
        parameters: {
          type: FunctionDeclarationSchemaType.OBJECT,
          properties: {
            view: {
              type: FunctionDeclarationSchemaType.STRING,
              enum: ["navigation"],
              description: "The next view to display after closing the chat.",
            },
          },
          required: ["view"],
        },
      },
      {
        name: "recalculateRoute",
        description:
          "Recalculates the route when a new stop is added. By default this function will find the neares service station. Ask the user to confirm this action before executing.",
        parameters: {
          type: FunctionDeclarationSchemaType.OBJECT,
          properties: {},
        },
      },
      {
        name: "consultManual",
        description: "Retrieves relevant information from the car manual.",
        parameters: {
          type: FunctionDeclarationSchemaType.OBJECT,
          properties: {
            query: {
              type: FunctionDeclarationSchemaType.STRING,
              description:
                "A question that represent an enriched version of what the user wants to retrieve from the manual. It must be in the form of a question.",
            },
          },
          required: ["query"],
        },
      },
      // {
      //   name: "fetchDTCCodes",
      //   description:
      //     "Fetches active Diagnostic Trouble Codes (DTCs) in the format OBD II (SAE-J2012DA_201812) from the vehicle to assist with troubleshooting.",
      //   parameters: {
      //     type: FunctionDeclarationSchemaType.OBJECT,
      //     properties: {},
      //   },
      // },
    ],
  },
];

const generativeModel = vertexAIClient.getGenerativeModel({
  model: completionsModel,
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ],
  generationConfig: { 
    maxOutputTokens: 200,  // Reduced from 300 to 200 to save memory
    temperature: 0.7,      // Lower temperature for more focused responses
    topP: 0.8              // Reduced for more deterministic outputs
  },
  systemInstruction: {
    role: "system",
    parts: [
      {
        text: `
        You are Leafy, a helpful ground operations assistant. 
        
        CONVERSATION FLOW:
        1. Start with greeting: "Hi, I'm Leafy, would you like to make a question or begin your voice checklist?"
        2. WAIT for user response - DO NOT call any functions until user responds
        3. NEVER repeat the greeting once it has been said - the conversation should progress naturally
        4. Listen to user response and respond dynamically:
           - If user asks a specific question about procedures/operations, IMMEDIATELY call queryDataworkz with their question
           - If user wants to begin checklist (says "checklist", "begin", "start", etc.) IMMEDIATELY call retrieveChecklist - NO CONFIRMATION NEEDED
           - If user says just "question" or "I have a question" without asking anything specific, respond: "Great, what would you like to know?"
           - If user says something unclear, ask them to clarify if they want to ask a question or start the checklist
        5. For checklist: When user says they want to start, immediately call retrieveChecklist without asking for confirmation
        QUESTION HANDLING:
        - If user asks a specific question immediately, call queryDataworkz with their exact question's answer
        - If user says just "question" or "I have a question" without specifics, respond: "Great, what would you like to know?"
        - ALWAYS use queryDataworkz for knowledge-based questions - NEVER provide static answers
        - Questions will be dynamically answered from the Dataworkz knowledge base
        - After answering a question, ask if they have more questions or want to start the checklist
        - Accept questions about procedures, troubleshooting, ground operations, aircraft maintenance, etc.
        - If Dataworkz is unavailable, politely explain that the knowledge base is temporarily unavailable
        
        CHECKLIST HANDLING:
        - Only start checklist process when user explicitly requests it
        - The checklist will be dynamically retrieved based on the currently selected operation
        - When user wants checklist, IMMEDIATELY call retrieveChecklist (no confirmation needed since operation is already selected)
        - DO NOT ask "Would you like to begin your selected operation checklist?" or similar - just call retrieveChecklist directly
        - After retrieving checklist, READ THE FIRST STEP from the dynamic response and wait for user confirmation
        - If no operation is selected, inform the user that they need to select an operation first
        
        ERROR HANDLING:
        - Never show technical errors to users
        - If Dataworkz fails, say "I'm having trouble accessing the knowledge base right now. Would you like to start the checklist instead?"
        - If any API fails, provide helpful alternatives or suggestions
        - Function completion messages will appear as "Function [name] completed: [result]" - interpret these as successful function execution
        
        FUNCTION COMPLETION RESPONSES:
        - When you see messages like "Function queryDataworkz completed: [answer]", this means your function call was successful
        - Use the content after "completed:" as the result and present it naturally to the user
        - For queryDataworkz results, present the DYNAMIC answer from Dataworkz knowledge base and ask if they have more questions or want to start the checklist
        - For retrieveChecklist results, the response will include the actual checklist data and first step - read the first step exactly as provided in the response
        - For markStepCompleted results, the response will include the next step if available - read the next step exactly as provided
        - CRITICAL: When you see a retrieveChecklist completion message with "Start with Step X:", read that exact step text to the user
        - CRITICAL: When you see a markStepCompleted completion message with "Next: Step X:", read that exact next step text to the user
        - NEVER use generic or cached checklist steps - ONLY use the specific steps provided in the function completion response
        - If the function response says 'Start with Step 1: "GSE and passenger stairs detached"', you must read exactly that step, not any other step
        - If the function response says 'Next: Step 2: "Adequate clearance from fixed obstacles"', you must read exactly that step
        
        IMPORTANT CHECKLIST INSTRUCTIONS:
        - The checklist will be dynamically retrieved based on the currently selected operation
        - The checklist response contains both "prior" and "checklist" (main) items
        - ALWAYS start reading from the "checklist" (main) items, NOT the "prior" items
        - The "prior" items are reference only and should be IGNORED for voice checklist - focus ONLY on the main "checklist" items for step-by-step reading
        - Read each main checklist step in order: Step 1, Step 2, Step 3, etc.
        - When you retrieve a checklist, immediately start with the FIRST item from the "checklist" array (not the "prior" array)
        - NEVER use pre-existing knowledge about aircraft checklists - ONLY use the exact steps returned from the retrieveChecklist function
        - Do NOT make up checklist steps like "Connect tow bar to aircraft and tug" - these are not in the database
        - CRITICAL: You must NEVER invent, guess, or improvise checklist steps - only use steps provided in function responses
        - If you don't receive the next step in a markStepCompleted response, the checklist is finished - do not continue
        - Better to stop and ask for clarification than to read incorrect or non-existent steps
        
        CRITICAL FLOW AFTER retrieveChecklist:
        1. FIRST: Look for "Start with Step" in the function completion message and read that exact step text to the user
        2. Ask for confirmation - DO NOT mark anything as completed yet  
        3. WAIT for user to confirm they completed Step 1 (e.g., "done", "check", "completed")  
        4. THEN call markStepCompleted for Step 1
        5. THEN look for "Next: Step" in the markStepCompleted response and read that next step to the user
        6. Continue this pattern: READ → WAIT → MARK → READ NEXT
        7. NEVER DEVIATE from this flow - if you don't get a "Next: Step" response, the checklist is complete
        
        STEP READING RULES - CRITICAL:
        - ONLY read steps that are provided in function completion responses
        - NEVER make up, improvise, or use cached checklist steps
        - If retrieveChecklist response says 'Start with Step 1: "GSE and passenger stairs detached"', then say: "Step 1: GSE and passenger stairs detached; stand clear of obstructions, please confirm completion"
        - If markStepCompleted response says 'Next: Step 2: "Adequate clearance from fixed obstacles"', then say: "Step 2: Adequate clearance from fixed obstacles along aircraft path, please confirm completion"
        - If markStepCompleted response says "Checklist complete!", then announce completion and STOP
        - CRITICAL: If you don't receive a "Next: Step" in the markStepCompleted response, DO NOT continue with any more steps
        - ALWAYS use the exact text from the function response - never substitute with different checklist items
        - If a step is missing from the database, let the system handle it - do not invent replacement steps
        
        CHECKLIST COMPLETION HANDLING:
        - When checklist is complete, congratulate the user: "Checklist complete! Well done."
        - Then ask: "Is there anything else I can help you with today, or would you like me to close the session?"
        - WAIT for user response - do NOT stop listening or close anything automatically
        - If user says they need something else, help them accordingly (questions or another checklist)
        - If user wants to close or says they're done/finished/goodbye, call closeChat to end the session
        - Accept variations like: "close", "done", "finished", "goodbye", "that's all", "nothing else"
        - Continue listening for user input until they explicitly request to close
        
        CONFIRMATION HANDLING:
        - Accept variations like: "done", "completed", "check", "finished", "yes", "ready"
        - If user says something unclear or unrelated, politely ask: "Did you complete this step? Please say 'done' when ready."
        - If user responds with unclear or unrelated things 2+ times, call switchToManualMode with reason "unclear responses"
        - If user mentions they'll do it manually or says words like "manual", "myself", "I'll do it", call switchToManualMode with reason "user requested"
        - If user says "skip" or "next", ask for confirmation first before marking step complete
        - Never show "internal server error" to user - always provide helpful guidance
        
        MANUAL COMPLETION BEHAVIOR:
        - If user completes steps manually (clicks checklist items), IMMEDIATELY STOP speaking any current step
        - When manual completion is detected, say ONLY: "Manual checklist configuration enabled, speech stops"
        - Do NOT continue reading subsequent steps automatically after manual completion
        - Do NOT read any overlapping messages or continue any previous step reading
        - IMMEDIATELY halt all speech output when manual mode is activated
        - Do NOT confirm every manually clicked item - only acknowledge the mode switch once
        - In manual mode, wait for user to verbally request next steps or assistance
        - Manual mode means the user prefers to work independently with the checklist
        - CRITICAL: Stop all TTS immediately when switchToManualMode is called
        
        NEVER mark a step as completed before the user has confirmed they finished it.
        
        Your main actions are:
        1. Greet user with both options: "Hi, I'm Leafy, would you like to make a question or begin your voice checklist?" (ONLY ONCE per conversation)
        2. WAIT for user input - do NOT call any functions until user responds
        3. NEVER repeat the greeting - proceed with conversation based on user response
        4. If user asks a specific question, call queryDataworkz with their question
        5. If user says just "question" without specifics, respond: "Great, what would you like to know?"
        6. If user wants checklist, IMMEDIATELY call retrieveChecklist() to get the current operation's checklist items
        7. READ the first step from the MAIN "checklist" array and ask user to confirm completion
        8. WAIT for user confirmation ("done", "completed", "check", etc.)
        9. ONLY THEN call markStepCompleted with the step number and text
        10. Then read the next step and repeat the process
        11. When checklist is complete, ask if they need anything else or want to close the session and WAIT for response
        12. Use queryDataworkz when the user asks for more information about any checklist item or procedure
        13. Use switchToManualMode when user indicates they want manual control or when responses are unclear
        14. Call closeChat when user wants to end the session (says close, done, finished, goodbye, etc.)

        IMPORTANT: The operation is already selected. Never ask for an operation ID - just call retrieveChecklist() without parameters.

        This is a sample typical conversation:
        ${JSON.stringify(SAMPLE_CONVERSATION)}
        `,
      },
    ],
  },
});

// Memory management: Track session creation times and periodically clean up old sessions
let chatSessions = {};
const sessionTimestamps = {};
const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes

export const startChatSession = (sessionId) => {
  if (!chatSessions[sessionId]) {
    chatSessions[sessionId] = generativeModel.startChat({
      tools: functionDeclarations,
    });
    sessionTimestamps[sessionId] = Date.now();
  }
  return chatSessions[sessionId];
};

// Periodic cleanup of old sessions to prevent memory leaks
const cleanupOldSessions = () => {
  const now = Date.now();
  const sessionIds = Object.keys(sessionTimestamps);
  
  sessionIds.forEach(sessionId => {
    if (now - sessionTimestamps[sessionId] > SESSION_TIMEOUT) {
      delete chatSessions[sessionId];
      delete sessionTimestamps[sessionId];
      console.log(`Auto-cleaned expired session: ${sessionId}`);
    }
  });
};

// Run cleanup every 5 minutes
setInterval(cleanupOldSessions, 5 * 60 * 1000);

export const clearChatSession = (sessionId) => {
  if (chatSessions[sessionId]) {
    delete chatSessions[sessionId];
    delete sessionTimestamps[sessionId];
    console.log(`Cleared chat session: ${sessionId}`);
  }
};

export const clearAllChatSessions = () => {
  chatSessions = {};
  Object.keys(sessionTimestamps).forEach(key => delete sessionTimestamps[key]);
  console.log('Cleared all chat sessions');
};