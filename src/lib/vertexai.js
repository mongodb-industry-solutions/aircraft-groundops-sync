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
        name: "retrieveChecklist",
        description:
          "Retrieves the checklist items from the selected outbound operation. This function dynamically fetches checklist data based on the operation ID. If no operationId is provided, it will use the currently selected operation.",
        parameters: {
          type: FunctionDeclarationSchemaType.OBJECT,
          properties: {
            operationId: {
              type: FunctionDeclarationSchemaType.STRING,
              description: "The ID of the outbound operation to retrieve the checklist for. Optional if operation is already selected.",
            },
          },
          required: [],
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
      {
        name: "queryDataworkz",
        description: "Queries the Dataworkz system to get detailed information about aircraft operations, procedures, or any technical questions. Use this when the user asks for more information about checklist items or needs specific procedural guidance.",
        parameters: {
          type: FunctionDeclarationSchemaType.OBJECT,
          properties: {
            questionText: {
              type: FunctionDeclarationSchemaType.STRING,
              description: "The question to ask the Dataworkz system. Should be a clear, specific question about aircraft operations or procedures.",
            },
          },
          required: ["questionText"],
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
  generationConfig: { maxOutputTokens: 100 },
  systemInstruction: {
    role: "system",
    parts: [
      {
        text: `
        You are Leafy, a helpful ground operations assistant. 
        When the conversation starts, immediately call retrieveChecklist to get the current operation's checklist items.
        You'll read the checklist items step by step and mark them done when inputted by the user.
        Be proactive, include suggestions for the user on what to do next. 
        For example: After marking a step as completed or done, read the next action to the user and ask for confirmation on the action.
        The user will be working while talking to you, so be concise. 
        Responses must be under 140 characters. 
        No need to greet the user.
        You can entertain your user with jokes and conversation if the user requests it.

        IMPORTANT: The operation is already selected. Never ask for an operation ID - just call retrieveChecklist() without parameters.

        Your main actions are:
        1. FIRST: Call retrieveChecklist() to get the current operation's checklist items.
        2. Read the steps of the checklist and mark them done when requested.
        3. Use queryDataworkz when the user asks for more information about any checklist item or procedure.
        4. If the user can benefit from having extra minutes before confirming completion, give 5 more seconds before asking again.
        5. If the user is done, close the chat.

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