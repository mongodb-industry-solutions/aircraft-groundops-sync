import { clientPromise } from '@/lib/mongodb';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { operationId } = await request.json();

    if (!operationId) {
      return NextResponse.json(
        { error: 'Operation ID is required' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const databaseName = client.db(process.env.DATABASE_NAME);

    if (!databaseName) {
      console.error('DATABASE_NAME environment variable is not set');
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }
    const db = client.db(databaseName);
    const checklistCollection = db.collection('checklist');

    const checklistData = await checklistCollection.findOne({
      "aircraft_ground_ops.outbound_operations": {
        $exists: true
      }
    });

    if (!checklistData) {
      return NextResponse.json(
        { 
          error: 'Checklist data not found. Please ensure the checklist collection exists in MongoDB.'
        },
        { status: 404 }
      );
    }

    const operationData = checklistData.aircraft_ground_ops?.outbound_operations?.[operationId];

    if (!operationData) {
      const availableOperations = Object.keys(checklistData.aircraft_ground_ops?.outbound_operations || {});
      
      return NextResponse.json(
        { 
          error: `Operation '${operationId}' not found in checklist data`,
          availableOperations: availableOperations,
          requestedOperation: operationId
        },
        { status: 404 }
      );
    }

    const response = {
      operationId,
      operationTitle: operationId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      prior: operationData.prior || [],
      checklist: operationData.checklist || [],
      responseInterval: operationData.response_interval || 5,
      secondMessage: operationData.second_message || "Do you need more time to complete this step?"
    };
    // //console.log(`Returning checklist for ${operationId}:`, {
    //   operationTitle: response.operationTitle,
    //   priorCount: response.prior.length,
    //   checklistCount: response.checklist.length,
    //   firstChecklistItem: response.checklist[0]?.step || 'No checklist items found'
    // });

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching checklist data:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
