import { NextResponse } from 'next/server';
import {
  checkVehicleDuplicateByText,
  checkCaravanDuplicateByText,
  checkAccessoryDuplicateByText,
} from '@/lib/duplicate-detection';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  if (type === 'vehicle') {
    const makeName = searchParams.get('makeName') ?? '';
    const modelName = searchParams.get('modelName') ?? '';
    const year = parseInt(searchParams.get('year') ?? '0', 10);

    if (!makeName || !modelName || !year) {
      return NextResponse.json({ hasDuplicate: false, matches: [] });
    }

    const result = await checkVehicleDuplicateByText({
      makeName,
      modelName,
      year,
    });
    return NextResponse.json(result);
  }

  if (type === 'caravan') {
    const makeName = searchParams.get('makeName') ?? '';
    const modelName = searchParams.get('modelName') ?? '';
    const year = parseInt(searchParams.get('year') ?? '0', 10);

    if (!makeName || !modelName || !year) {
      return NextResponse.json({ hasDuplicate: false, matches: [] });
    }

    const result = await checkCaravanDuplicateByText({
      makeName,
      modelName,
      year,
    });
    return NextResponse.json(result);
  }

  if (type === 'accessory') {
    const brandName = searchParams.get('brandName') ?? '';
    const modelName = searchParams.get('modelName') ?? '';

    if (!brandName || !modelName) {
      return NextResponse.json({ hasDuplicate: false, matches: [] });
    }

    const result = await checkAccessoryDuplicateByText({
      brandName,
      modelName,
    });
    return NextResponse.json(result);
  }

  return NextResponse.json(
    { error: 'type must be vehicle, caravan, or accessory' },
    { status: 400 },
  );
}
