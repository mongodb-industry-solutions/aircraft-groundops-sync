import { NextResponse } from "next/server";

function POST(request) {
    return request.json()
        .then(body => {
            var questionText = body.questionText;

            if (!questionText) {
                return NextResponse.json({ error: "A question Text is required" }, { status: 400 });
            }

            const systemId = process.env.DATAWORKZ_SYSTEM_ID;
            const apiKey = process.env.DATAWORKZ_API_KEY;
            const llmProviderId = process.env.DATAWORKZ_LLM_PROVIDER_ID;

            var url = `https://ragapps.dataworkz.com/api/qna/v1/systems/${systemId}/answer?questionText=${encodeURIComponent(
                questionText
            )}&llmProviderId=${encodeURIComponent(llmProviderId)}`;

            return fetch(url, {
                method: "GET",
                headers: {
                    Authorization: apiKey,
                    Accept: "*/*",
                },
            })
            .then(response => {
                if (!response.ok) {
                    return response.text().then(errorText =>
                        NextResponse.json(
                            { error: "Dataworkz error", details: errorText },
                            { status: response.status }
                        )
                    );
                }
                return response.json().then(data =>
                    NextResponse.json(data, { status: 200 })
                );
            });
        })
        .catch(error => {
            return NextResponse.json(
                { error: "Error", details: error.message },
                { status: 500 }
            );
        });
}

export { POST };
