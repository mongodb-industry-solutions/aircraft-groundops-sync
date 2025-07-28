import { NextResponse } from "next/server";
import { startChatSession } from "@/lib/vertexai";
import { clientPromise } from "@/lib/mongodb";

export async function POST(req) {
  try {
    const { sessionId, message } = await req.json();
    //console.log("Received sessionId:", sessionId);
    //console.log("Received message:", message);

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    let messageToSend;
    if (typeof message === 'string') {
      if (message.trim().length === 0) {
        return NextResponse.json(
          { error: "message cannot be empty" },
          { status: 400 }
        );
      }
      messageToSend = message.trim();
    } else if (Array.isArray(message)) {
      // Validate function response format
      if (message.length > 0 && message[0].functionResponse) {
        // Validate the function response structure
        const functionResponse = message[0].functionResponse;
        if (!functionResponse.name || !functionResponse.response) {
          console.error("Invalid function response structure:", functionResponse);
          return NextResponse.json(
            { error: "Function response must have name and response fields" },
            { status: 400 }
          );
        }
        messageToSend = message;
        //console.log("Validated function response:", JSON.stringify(messageToSend, null, 2));
      } else {
        console.error("Invalid function response format:", message);
        return NextResponse.json(
          { error: "Invalid function response format" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "message must be a string or function response array" },
        { status: 400 }
      );
    }

    //console.log("Message to send to VertexAI:", JSON.stringify(messageToSend, null, 2));

    const chat = startChatSession(sessionId);
    //console.log("chat session started:", chat);

    let result;
    try {
      result = await chat.sendMessageStream(messageToSend);
      //console.log("Received result from chat:", result);
    } catch (vertexError) {
      console.error("VertexAI sendMessageStream error:", vertexError);
      return NextResponse.json(
        { 
          error: "VertexAI API error", 
          details: vertexError.message,
          messageType: typeof messageToSend,
          messageLength: Array.isArray(messageToSend) ? messageToSend.length : messageToSend?.length
        },
        { status: 500 }
      );
    }
    
    let functionCall = null;
    let assistantResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const item of result.stream) {
            const candidate = item.candidates[0];

            if (candidate.content?.parts?.[0]?.functionCall) {
              functionCall = candidate.content.parts[0].functionCall;
              addLog(sessionId, functionCall.name, "call", functionCall);
            } else {
              const token = candidate.content.parts?.[0]?.text || "";
              controller.enqueue(token);
              assistantResponse += token;
            }
          }

          if (functionCall) {
            await result.response;
            const { name, args } = functionCall;

            controller.enqueue(JSON.stringify({ functionCall }));
          }

          controller.close(); // Close stream when done
        } catch (error) {
          console.error("Error streaming response:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    //console.log("API error:", error);
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

async function addLog(sessionId, toolName, type, details) {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.DATABASE_NAME);
    const logsCollection = db.collection("logs");

    await logsCollection.updateOne(
      { sessionId },
      {
        $push: {
          logs: {
            timestamp: new Date().toISOString(),
            toolName,
            type,
            details,
          },
        },
      },
      { upsert: true }
    );
  } catch (error) {
    console.error("Error logging tool call:", error);
  }
}