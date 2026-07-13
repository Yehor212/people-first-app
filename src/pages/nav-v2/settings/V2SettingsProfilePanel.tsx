import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Loader2, Save, UserRound } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { updateProfileName } from "@/lib/accountService";
import { logger } from "@/lib/logger";
import { sanitizeUserName } from "@/lib/sanitize";
import {
  assertSettingsOwnerCurrent,
  SettingsOwnerBoundaryError,
} from "@/lib/settingsOwnerBoundary";
import { getCurrentSessionUserId } from "@/lib/supabaseClient";
import { userNameSchema } from "@/lib/validation";

import {
  PanelFrame,
  SettingsFieldHeader,
  SettingsInlineButton,
  SettingsStatus,
  SettingsTextInput,
} from "./components/V2SettingsControlPrimitives";
import type { V2SettingsControls } from "./types";

export function ProfilePanel({ controls }: { controls: V2SettingsControls }) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const visibleName =
    controls.userName === "Friend" && controls.userNameCustom === false ? "" : controls.userName;
  const [name, setName] = useState(visibleName);
  const [nameStatus, setNameStatus] = useState<string | null>(null);
  const [lastSavedName, setLastSavedName] = useState(visibleName);
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const nameSaveGenerationRef = useRef(0);
  const nameErrorId = useId();

  useEffect(() => {
    setName(visibleName);
    setLastSavedName(visibleName);
    setNameStatus(null);
    setNameTouched(false);
  }, [visibleName]);

  useEffect(() => {
    if (!nameStatus) return;
    const timer = window.setTimeout(() => setNameStatus(null), 2400);
    return () => window.clearTimeout(timer);
  }, [nameStatus]);

  const trimmedName = name.trim();
  const sanitizedName = sanitizeUserName(trimmedName);
  const sanitizedCurrentName = sanitizeUserName(lastSavedName);
  const isNameValid =
    userNameSchema.safeParse(trimmedName).success && sanitizedName === trimmedName;
  const nameValidationMessage =
    nameTouched && !isNameValid
      ? tx.invalidNameFormat || "Enter a name between 1 and 100 characters."
      : null;

  const isNameSaveDisabled = isSavingName || !isNameValid || sanitizedName === sanitizedCurrentName;

  const handleNameSave = async () => {
    const trimmed = name.trim();
    const sanitized = sanitizeUserName(trimmed);
    if (isSavingName || !sanitized) return;

    try {
      userNameSchema.parse(trimmed);
      if (sanitized !== trimmed) throw new Error("unsupported-name-content");
    } catch {
      setNameTouched(true);
      return;
    }

    const operationGeneration = ++nameSaveGenerationRef.current;
    setIsSavingName(true);
    let expectedOwnerUserId: string | null = null;
    let ownerCaptured = false;

    try {
      expectedOwnerUserId = await getCurrentSessionUserId();
      ownerCaptured = true;
      await assertSettingsOwnerCurrent(expectedOwnerUserId, "Profile name save");
      if (operationGeneration !== nameSaveGenerationRef.current) return;

      setName(sanitized);
      setLastSavedName(sanitized);
      controls.onNameChange(sanitized);
      setNameStatus(tx.nameSaved || "Saved");
      if (!expectedOwnerUserId) {
        setNameStatus(tx.nameSavedLocally || "Saved on this device");
        return;
      }

      const success = await updateProfileName(expectedOwnerUserId, sanitized);
      await assertSettingsOwnerCurrent(expectedOwnerUserId, "Profile name save");
      if (operationGeneration !== nameSaveGenerationRef.current) return;
      if (!success) {
        setNameStatus(tx.nameSavedLocally || "Saved on this device");
      }
    } catch (error) {
      if (error instanceof SettingsOwnerBoundaryError) return;
      if (ownerCaptured) {
        try {
          await assertSettingsOwnerCurrent(expectedOwnerUserId, "Profile name save error");
        } catch (ownerError) {
          if (ownerError instanceof SettingsOwnerBoundaryError) return;
          throw ownerError;
        }
      }
      if (operationGeneration !== nameSaveGenerationRef.current) return;
      logger.error("[V2Settings] Failed to update profile name:", error);
      setNameStatus(tx.nameSavedLocally || "Saved on this device");
    } finally {
      if (operationGeneration === nameSaveGenerationRef.current) {
        setIsSavingName(false);
      }
    }
  };

  const handleNameKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || isNameSaveDisabled) return;
    event.preventDefault();
    void handleNameSave();
  };

  return (
    <PanelFrame
      icon={UserRound}
      title={tx.profile || tx.settingsGroupProfile || "Profile"}
      description={tx.yourName || "Name and personal preferences."}
      testId="settings-v2-panel-profile"
    >
      <SettingsFieldHeader htmlFor="settings-v2-name" title={tx.yourName || "Your name"} />
      <div className="flex flex-col gap-2 min-[520px]:flex-row">
        <SettingsTextInput
          id="settings-v2-name"
          value={name}
          onChange={(value) => {
            setName(value);
            setNameTouched(true);
            setNameStatus(null);
          }}
          autoComplete="name"
          placeholder={tx.profileNamePlaceholder || "Enter your name"}
          fill
          onKeyDown={handleNameKeyDown}
          tone={nameValidationMessage ? "danger" : "neutral"}
          ariaInvalid={Boolean(nameValidationMessage)}
          ariaDescribedBy={nameValidationMessage ? nameErrorId : undefined}
        />
        <SettingsInlineButton
          icon={isSavingName ? Loader2 : Save}
          isLoading={isSavingName}
          onClick={() => {
            void handleNameSave();
          }}
          disabled={isNameSaveDisabled}
          testId="settings-v2-profile-save"
          variant="primary"
        >
          {isSavingName ? tx.saving || "Saving..." : tx.saveName || "Save name"}
        </SettingsInlineButton>
      </div>
      {nameValidationMessage ? (
        <p id={nameErrorId} role="alert" className="text-sm text-destructive">
          {nameValidationMessage}
        </p>
      ) : null}
      <div>
        <SettingsStatus>{nameStatus}</SettingsStatus>
      </div>
    </PanelFrame>
  );
}
