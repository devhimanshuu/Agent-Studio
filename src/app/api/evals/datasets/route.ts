import { NextRequest, NextResponse } from "next/server";
import { listEvalDatasets, createCustomEvalDataset } from "@/modules/evals/datasetStore";

export async function GET() {
  try {
    const datasets = listEvalDatasets();
    return NextResponse.json({
      success: true,
      data: datasets,
      totalCount: datasets.length,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load datasets" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, category, targetType, items } = body;

    if (!name || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { success: false, error: "Dataset 'name' and 'items' array are required." },
        { status: 400 }
      );
    }

    const created = createCustomEvalDataset({
      name,
      description: description || "Custom Evaluation Dataset",
      category: category || "CUSTOM",
      targetType: targetType || "GRAPH",
      items,
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create dataset" },
      { status: 500 }
    );
  }
}
