import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';

export async function POST(request: Request) {
  const body = await request.json();
  const { name, email, password } = body;

  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json(
      { error: 'Email and password are required.' },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.' },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: 'An account with this email already exists.' },
      { status: 409 },
    );
  }

  const hashed = await hashPassword(password);

  await prisma.user.create({
    data: {
      name: typeof name === 'string' ? name : null,
      email,
      password: hashed,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
