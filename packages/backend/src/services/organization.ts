import { eq } from 'drizzle-orm';
import { db } from '../db';
import { organizationMembers } from '../db/schema';

export interface UserOrganization {
  organizationId: string;
  role: 'owner' | 'admin' | 'member';
}

export async function getUserOrganizations(userId: string): Promise<UserOrganization[]> {
  const memberships = await db.query.organizationMembers.findMany({
    where: eq(organizationMembers.userId, userId),
  });
  
  return memberships.map(m => ({
    organizationId: m.organizationId,
    role: m.role,
  }));
}

export async function isUserInOrganization(userId: string, organizationId: string): Promise<boolean> {
  const membership = await db.query.organizationMembers.findFirst({
    where: (members, { and, eq }) => and(
      eq(members.userId, userId),
      eq(members.organizationId, organizationId)
    ),
  });
  
  return !!membership;
}

export async function getUserRole(userId: string, organizationId: string): Promise<string | null> {
  const membership = await db.query.organizationMembers.findFirst({
    where: (members, { and, eq }) => and(
      eq(members.userId, userId),
      eq(members.organizationId, organizationId)
    ),
  });
  
  return membership?.role ?? null;
}



