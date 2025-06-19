import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    var body = await request.json();
    var questionText = body.questionText;

    if (!questionText) {
      return NextResponse.json({ error: "questionText is required" }, { status: 400 });
    }

    const systemId = process.env.DATAWORKZ_SYSTEM_ID;
    const apiKey = process.env.DATAWORKZ_API_KEY;
    const llmProviderId = process.env.DATAWORKZ_LLM_PROVIDER_ID;

    var url = `https://ragapps.dataworkz.com/api/qna/v1/systems/${systemId}/answer?questionText=${encodeURIComponent(
      questionText
    )}&llmProviderId=${encodeURIComponent(llmProviderId)}`;

    var response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: apiKey,
        Accept: "*/*",
      },
    });

    if (!response.ok) {
      var errorText = await response.text();
      return NextResponse.json(
        { error: "Dataworkz error", details: errorText },
        { status: response.status }
      );
    }

    var data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Error", details: error.message },
      { status: 500 }
    );
  }
}
