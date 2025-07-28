import { NextResponse } from "next/server";
// import { startChatSession } from "@/lib/vertexai";
// import { clientPromise } from "@/lib/mongodb";

export async function GET() {
  try {
    //console.log("GET request received for chat session");
    return NextResponse.json(
      { message: "API is reachable!" },
      { status: 200 }
    );
  } catch (error) {
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