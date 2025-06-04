# Aircraft GorundOps Sync

-- Description --

## About the Solution

## How MongoDB Helps

## High-Level Architecture

## Tech Stack

- **[Next.js](https://nextjs.org/)** for the frontend framework
- **[MongoDB Atlas](https://www.mongodb.com/atlas)** for the database and vector search
- **[Google Cloud Platform](https://cloud.google.com/)** for the LLM, speech-to-text, and embeddings

## Prerequisites

Before running the demo, ensure you have the following:

- A **MongoDB Atlas Cluster**
- **Node.js 20** or higher
- A **GCP account** with access to Vertex AI APIs

## Environment Variables

To configure the environment for this demo, you need to set up the following variables in a `.env.local` file. These variables ensure seamless integration with MongoDB Atlas, Google Cloud Platform, and other services used in the application. Below is an example configuration:

```dotenv
MONGODB_URI="<your-mongodb-connection-string>"
DATABASE_NAME="car_assistant_demo"
GCP_PROJECT_ID="<your-gcp-project-id>"
GCP_LOCATION="us-central1"
VERTEXAI_COMPLETIONS_MODEL="gemini-2.0-flash-001"
VERTEXAI_EMBEDDINGS_MODEL="text-embedding-005"
VERTEXAI_API_ENDPOINT="us-central1-aiplatform.googleapis.com"
NEXT_PUBLIC_ENV="local"
```

## Run it Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open **http://localhost:3000** in your browser to access the assistant and vehicle dashboard.
