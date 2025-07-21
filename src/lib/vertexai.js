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
          "Closes the chat window when the conversation is finished. By default it always returns to the navigation view. Ask the user to confirm this action before executing.",
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
  generationConfig: { maxOutputTokens: 300 },
  systemInstruction: {
    role: "system",
    parts: [
      {
        text: `
        You are Leafy, a helpful ground operations assistant. 
        
        CONVERSATION FLOW:
        1. Start with greeting and ask if user wants to begin the checklist
        2. Wait for user confirmation (like "yes", "sure", "okay")  
        3. ONLY after user confirms, call retrieveChecklist
        4. After retrieving checklist, READ THE FIRST STEP to the user and wait for their confirmation
        
        IMPORTANT CHECKLIST INSTRUCTIONS:
        - The checklist response contains both "prior" and "checklist" (main) items
        - ALWAYS start reading from the "checklist" (main) items, NOT the "prior" items
        - The "prior" items are reference only - focus on the main "checklist" items for step-by-step reading
        - Read each main checklist step in order: Step 1, Step 2, Step 3, etc.
        
        CRITICAL FLOW AFTER retrieveChecklist:
        1. FIRST: Read Step 1 to user and ask for confirmation - DO NOT mark anything as completed yet
        2. WAIT for user to confirm they completed Step 1 (e.g., "done", "check", "completed")  
        3. THEN call markStepCompleted for Step 1
        4. THEN read Step 2 and wait for confirmation
        5. Continue this pattern: READ → WAIT → MARK → READ NEXT
        
        NEVER mark a step as completed before the user has confirmed they finished it.
        
        Your main actions are:
        1. Ask if user wants to begin the checklist
        2. Wait for user confirmation before retrieving checklist
        3. When user confirms: Call retrieveChecklist() to get the current operation's checklist items
        4. READ the first step from the MAIN "checklist" array and ask user to confirm completion
        5. WAIT for user confirmation ("done", "completed", "check", etc.)
        6. ONLY THEN call markStepCompleted with the step number and text
        7. Then read the next step and repeat the process
        8. Use queryDataworkz when the user asks for more information about any checklist item or procedure

        IMPORTANT: The operation is already selected. Never ask for an operation ID - just call retrieveChecklist() without parameters.

        This is a sample typical conversation:
        ${JSON.stringify(SAMPLE_CONVERSATION)}
        `,
      },
    ],
  },
});

let chatSessions = {};

export const startChatSession = (sessionId) => {
  if (!chatSessions[sessionId]) {
    chatSessions[sessionId] = generativeModel.startChat({
      tools: functionDeclarations,
    });
  }
  return chatSessions[sessionId];
};