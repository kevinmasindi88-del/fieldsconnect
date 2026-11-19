import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Post visibility and profile visibility are separate permissions. A member may
 * publish a visible post without exposing their private profile details.
 */
export type TimelineAuthorIdentity = {
  id: string;
  display_name: string;
  role_type: string;
  field: string | null;
  avatar_url: string | null;
};

/**
 * Supplement profiles visible through normal RLS with the restricted identity
 * projection already used by FieldsConnect's Find People feature.
 * This RPC rejects unauthenticated callers, respects blocks/deactivated
 * accounts, and masks private profile details at the database layer.
 */
export async function resolveTimelineAuthorProfiles(
  visibleProfiles: TimelineAuthorIdentity[],
  authorIds: string[]
): Promise<TimelineAuthorIdentity[]> {
  const byId = new Map(visibleProfiles.map((profile) => [profile.id, profile]));
  const missingIds = [...new Set(authorIds)].filter((id) => id && !byId.has(id));

  if (missingIds.length === 0) return visibleProfiles;

  const supabase = getSupabaseBrowserClient();

  // get_discoverable_member_cards enforces a 100-ID limit per request.
  for (let index = 0; index < missingIds.length; index += 100) {
    const { data, error } = await supabase.rpc("get_discoverable_member_cards", {
      target_ids: missingIds.slice(index, index + 100),
    });

    if (error) {
      console.warn("Could not resolve discoverable timeline authors:", error);
      continue;
    }

    for (const card of data ?? []) {
      if (!card.id || !card.display_name) continue;

      const isPrivate = card.profile_visibility === "private";
      byId.set(card.id, {
        id: card.id,
        display_name: card.display_name,
        role_type: isPrivate ? "Profile" : (card.role_type ?? "Profile"),
        field: isPrivate ? null : card.field,
        // Private avatars are withheld by the existing discovery policy.
        avatar_url: isPrivate ? null : card.avatar_url,
      });
    }
  }

  return [...byId.values()];
}
