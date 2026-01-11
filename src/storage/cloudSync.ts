import { exportBackup, importBackup } from "@/storage/backup";
import { supabase } from "@/lib/supabaseClient";

const BACKUP_TABLE = "user_backups";

export const syncWithCloud = async (mode: "merge" | "replace" = "merge") => {
  if (!supabase) {
    throw new Error("Supabase not configured.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated.");
  }

  const localBackup = await exportBackup();

  const { data: remote, error: fetchError } = await supabase
    .from(BACKUP_TABLE)
    .select("payload, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  let syncStatus: "pulled" | "pushed" = "pushed";

  if (remote?.payload) {
    const remotePayload = remote.payload;
    const localDate = new Date((localBackup as any).createdAt || localBackup.exportedAt).getTime();
    const remoteDate = new Date(remotePayload.createdAt || remotePayload.exportedAt || remote.updated_at || 0).getTime();
    if (remoteDate > localDate) {
      await importBackup(remotePayload, mode);
      syncStatus = "pulled";
    }
  }

  const mergedBackup = await exportBackup();
  const { error: upsertError } = await supabase.from(BACKUP_TABLE).upsert(
    {
      user_id: user.id,
      payload: mergedBackup,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (upsertError) {
    throw upsertError;
  }

  return { status: syncStatus };
};
