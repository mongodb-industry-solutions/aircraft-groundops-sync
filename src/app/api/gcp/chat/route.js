import { NextResponse } from "next/server";
import { startChatSession } from "@/lib/vertexai";
import { clientPromise } from "@/lib/mongodb";

export async function POST(req) {
  try {
    const { sessionId, message } = await req.json();
    // Added by gio to ensure sessionId is provided
    console.log("Received sessionId:", sessionId);
    console.log("Received message:", message);

    const chat = startChatSession(sessionId);
    console.log("chat session started:", chat);

    const result = await chat.sendMessageStream(message);
    console.log("Received result from chat:", result);

    // End block of code added by Gio
    
    let functionCall = null;
    let assistantResponse = "";

    // Create a stream response
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

            // Client-side function calls (handled in frontend)
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
        "X-Accel-Buffering": "no", // Ensure streaming works correctly
      },
    });
  } catch (error) {
    console.log("API error:", error);
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
