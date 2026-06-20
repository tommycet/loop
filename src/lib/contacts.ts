import type { Contact } from "../types";
import { getSupabase } from "./supabase";

export async function upsertContactByPhone(
  phone: string,
  name?: string,
  metadata?: Record<string, unknown>,
): Promise<Contact> {
  const { data, error } = await getSupabase()
    .from("contacts")
    .upsert(
      {
        phone,
        name: name ?? null,
        metadata: metadata ?? {},
      },
      { onConflict: "phone" },
    )
    .select()
    .single();

  if (error) throw error;
  return data as Contact;
}

export async function upsertContactByEmail(
  email: string,
  name?: string,
  metadata?: Record<string, unknown>,
): Promise<Contact> {
  const { data, error } = await getSupabase()
    .from("contacts")
    .upsert(
      {
        email,
        name: name ?? null,
        metadata: metadata ?? {},
      },
      { onConflict: "email" },
    )
    .select()
    .single();

  if (error) throw error;
  return data as Contact;
}
