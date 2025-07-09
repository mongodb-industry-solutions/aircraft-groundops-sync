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
    const db = client.db(process.env.DATABASE_NAME);
    const checklistCollection = db.collection('checklist');

    const checklistData = await checklistCollection.findOne({
      "aircraft_ground_ops.outbound_operations": {
        $exists: true
      }
    });

    if (!checklistData) {
      return NextResponse.json(
        { error: 'Checklist data not found' },
        { status: 404 }
      );
    }

    const operationData = checklistData.aircraft_ground_ops?.outbound_operations?.[operationId];

    if (!operationData) {
      return NextResponse.json(
        { error: `Operation '${operationId}' not found in checklist data` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      operationId,
      operationTitle: operationId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      prior: operationData.prior || [],
      checklist: operationData.checklist || [],
      responseInterval: operationData.response_interval || 5,
      secondMessage: operationData.second_message || "Do you need more time to complete this step?"
    });

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
