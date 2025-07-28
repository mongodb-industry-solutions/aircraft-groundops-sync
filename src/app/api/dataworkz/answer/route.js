import { NextResponse } from "next/server";

export async function POST(request) {
    try {
        const body = await request.json();
        const questionText = body.questionText;

        if (!questionText) {
            return NextResponse.json({ error: "A question Text is required" }, { status: 400 });
        }

        const systemId = process.env.DATAWORKZ_SYSTEM_ID;
        const apiKey = process.env.DATAWORKZ_API_KEY;
        const llmProviderId = process.env.DATAWORKZ_LLM_PROVIDER_ID;

        if (!systemId || !apiKey || !llmProviderId) {
            console.error("Missing Dataworkz environment variables:", { 
                systemId: !!systemId, 
                apiKey: !!apiKey, 
                llmProviderId: !!llmProviderId,
                systemIdValue: systemId ? `${systemId.substring(0, 4)}...` : 'missing',
                apiKeyValue: apiKey ? `${apiKey.substring(0, 4)}...` : 'missing',
                llmProviderIdValue: llmProviderId ? `${llmProviderId.substring(0, 4)}...` : 'missing'
            });
            return NextResponse.json({ error: "Dataworkz configuration incomplete" }, { status: 500 });
        }

        const url = `https://ragapps.dataworkz.com/api/qna/v1/systems/${systemId}/answer?questionText=${encodeURIComponent(
            questionText
        )}&llmProviderId=${encodeURIComponent(llmProviderId)}`;

        //console.log("Calling Dataworkz API:", { url: url.replace(apiKey, '[REDACTED]'), questionText });

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: apiKey,
                Accept: "*/*",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Dataworkz API error:", response.status, errorText);
            return NextResponse.json(
                { error: "Dataworkz API error", details: errorText },
                { status: response.status }
            );
        }

        const data = await response.json();
        // //console.log("Dataworkz response:", data);
        return NextResponse.json(data, { status: 200 });

    } catch (error) {
        console.error("Dataworkz route error:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error.message },
            { status: 500 }
        );
    }
}
