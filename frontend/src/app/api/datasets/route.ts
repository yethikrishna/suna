/**
 * y0 Datasets API Route
 * Handles dataset CRUD operations using Blink SDK
 */

import { NextRequest, NextResponse } from 'next/server'
import { blink } from '@/lib/blink/client'

export async function GET(request: NextRequest) {
  try {
    // Get current user using Blink SDK
    const user = await blink.auth.me()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get datasets for current user from Blink database
    const datasets = await blink.db.datasets?.list({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    }) || []

    return NextResponse.json({
      success: true,
      data: datasets
    })

  } catch (error) {
    console.error('Error fetching datasets:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch datasets'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await blink.auth.me()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { name, description, data, schema, tags } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Dataset name is required' },
        { status: 400 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Dataset data is required' },
        { status: 400 }
      )
    }

    // Create dataset in Blink database
    const dataset = await blink.db.datasets?.create({
      name,
      description: description || '',
      data: data,
      schema: schema || null,
      tags: tags || [],
      userId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      size: JSON.stringify(data).length
    })

    if (!dataset) {
      throw new Error('Failed to create dataset')
    }

    return NextResponse.json({
      success: true,
      data: dataset
    })

  } catch (error) {
    console.error('Error creating dataset:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create dataset'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Get current user
    const user = await blink.auth.me()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body for dataset IDs to delete
    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Dataset IDs are required for deletion' },
        { status: 400 }
      )
    }

    // Delete datasets (verify ownership first)
    const deletedIds = []
    for (const id of ids) {
      const existingDataset = await blink.db.datasets?.list({
        where: { id, userId: user.id }
      })

      if (existingDataset && existingDataset.length > 0) {
        await blink.db.datasets?.delete(id)
        deletedIds.push(id)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        deletedCount: deletedIds.length,
        deletedIds
      }
    })

  } catch (error) {
    console.error('Error deleting datasets:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete datasets'
      },
      { status: 500 }
    )
  }
}