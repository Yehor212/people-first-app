import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Loader2, Save, UserRound } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { updateProfileName } from "@/lib/accountService";
import { logger } from "@/lib/logger";
import { sanitizeUserName } from "@/lib/sanitize";
import {
  assertSettingsOwnerCurrent,
  readVerifiedSettingsOwnerRealm,
  SettingsOwnerBoundaryError,
  type VerifiedSettingsOwnerRealm,
} from "@/lib/settingsOwnerBoundary";
import {
  captureOriginAccountBoundaryGeneration,
  subscribeOriginAccountBoundaryObservation,
} from "@/storage/accountBoundaryRuntime";
import { userNameSchema } from "@/lib/validation";

import {
  PanelFrame,
  SettingsFieldHeader,
  SettingsInlineButton,
  SettingsStatus,
  SettingsTextInput,
} from "./components/V2SettingsControlPrimitives";
import type { V2SettingsControls } from "./types";

export function ProfilePanel({
  controls,
  interactionBlocked = false,
}: {
  controls: V2SettingsControls;
  interactionBlocked?: boolean;
}) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const visibleName =
    controls.userName === "Friend" && controls.userNameCustom === false ? "" : controls.userName;
  const [name, setName] = useState(visibleName);
  const [nameStatus, setNameStatus] = useState<string | null>(null);
  const [nameSaveError, setNameSaveError] = useState<string | null>(null);
  const [lastSavedName, setLastSavedName] = useState(visibleName);
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [ownerGeneration, setOwnerGeneration] = useState(() =>
    captureOriginAccountBoundaryGeneration()
  );
  const nameSaveGenerationRef = useRef(0);
  const visibleNameRef = useRef(visibleName);
  const nameErrorId = useId();
  const interactionBlockedId = useId();
  visibleNameRef.current = visibleName;

  useEffect(
    () => subscribeOriginAccountBoundaryObservation(setOwnerGeneration),
    []
  );

  useEffect(() => {
    nameSaveGenerationRef.current += 1;
    const currentVisibleName = visibleNameRef.current;
    setName(currentVisibleName);
    setLastSavedName(currentVisibleName);
    setNameStatus(null);
    setNameSaveError(null);
    setNameTouched(false);
    setIsSavingName(false);
  }, [ownerGeneration]);

  useEffect(() => {
    setName(visibleName);
    setLastSavedName(visibleName);
    setNameStatus(null);
    setNameSaveError(null);
    setNameTouched(false);
  }, [visibleName]);

  const trimmedName = name.trim();
  const sanitizedName = sanitizeUserName(trimmedName);
  const sanitizedCurrentName = sanitizeUserName(lastSavedName);
  const isNameLengthValid = trimmedName.length >= 1 && trimmedName.length <= 100;
  const isNameContentValid =
    userNameSchema.safeParse(trimmedName).success && sanitizedName === trimmedName;
  const isNameValid = isNameLengthValid && isNameContentValid;
  const nameValidationMessage =
    nameTouched && !isNameValid
      ? isNameLengthValid
        ? tx.invalidNameCharacters ||
          "This name includes text ZenFlow can’t use. Try letters, numbers, spaces, or ordinary punctuation."
        : tx.invalidNameFormat || "Enter a name between 1 and 100 characters."
      : null;

  const isNameSaveDisabled =
    interactionBlocked || isSavingName || !isNameValid || sanitizedName === sanitizedCurrentName;
  const nameDescriptionIds = [
    nameValidationMessage ? nameErrorId : null,
    interactionBlocked ? interactionBlockedId : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  const handleNameSave = async () => {
    const trimmed = name.trim();
    const sanitized = sanitizeUserName(trimmed);
    if (interactionBlocked || isSavingName || !sanitized) return;

    try {
      userNameSchema.parse(trimmed);
      if (sanitized !== trimmed) throw new Error("unsupported-name-content");
    } catch {
      setNameTouched(true);
      return;
    }

    const operationGeneration = ++nameSaveGenerationRef.current;
    setIsSavingName(true);
    setNameSaveError(null);
    let ownerRealm: VerifiedSettingsOwnerRealm | null = null;
    let localSaveCommitted = false;

    try {
      const verifiedOwnerRealm = await readVerifiedSettingsOwnerRealm("Profile name save");
      ownerRealm = verifiedOwnerRealm;
      await assertSettingsOwnerCurrent(verifiedOwnerRealm, "Profile name save");
      if (operationGeneration !== nameSaveGenerationRef.current) return;

      await controls.onNameChange(sanitized, true, verifiedOwnerRealm.generation);
      localSaveCommitted = true;
      await assertSettingsOwnerCurrent(verifiedOwnerRealm, "Profile name save");
      if (operationGeneration !== nameSaveGenerationRef.current) return;
      setName(sanitized);
      setLastSavedName(sanitized);
      setNameStatus(tx.nameSaved || "Saved");
      if (verifiedOwnerRealm.kind === "local") {
        setNameStatus(tx.nameSavedLocally || "Saved on this device");
        return;
      }

      const success = await updateProfileName(verifiedOwnerRealm.ownerUserId, sanitized);
      await assertSettingsOwnerCurrent(verifiedOwnerRealm, "Profile name save");
      if (operationGeneration !== nameSaveGenerationRef.current) return;
      if (!success) {
        setNameStatus(tx.nameSavedLocally || "Saved on this device");
      }
    } catch (error) {
      if (error instanceof SettingsOwnerBoundaryError) return;
      if (ownerRealm) {
        try {
          await assertSettingsOwnerCurrent(ownerRealm, "Profile name save error");
        } catch (ownerError) {
          if (ownerError instanceof SettingsOwnerBoundaryError) return;
          throw ownerError;
        }
      }
      if (operationGeneration !== nameSaveGenerationRef.current) return;
      logger.error("[V2Settings] Failed to update profile name:", error);
      if (localSaveCommitted) {
        setNameStatus(tx.nameSavedLocally || "Saved on this device");
      } else {
        setNameStatus(null);
        setNameSaveError(
          tx.settingsPreferenceSaveError ||
            "Couldn’t save this change. Your previous setting is still active."
        );
      }
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
            setNameSaveError(null);
          }}
          autoComplete="name"
          disabled={isSavingName || interactionBlocked}
          placeholder={tx.profileNamePlaceholder || "Enter your name"}
          fill
          onKeyDown={handleNameKeyDown}
          tone={nameValidationMessage ? "danger" : "neutral"}
          ariaInvalid={Boolean(nameValidationMessage)}
          ariaDescribedBy={nameDescriptionIds || undefined}
          ariaLabel={tx.yourName || "Your name"}
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
          width="content"
        >
          {isSavingName ? tx.saving || "Saving..." : tx.saveName || "Save name"}
        </SettingsInlineButton>
      </div>
      {nameValidationMessage ? (
        <p id={nameErrorId} role="alert" className="text-sm text-destructive">
          {nameValidationMessage}
        </p>
      ) : null}
      {interactionBlocked ? (
        <p
          id={interactionBlockedId}
          className="min-w-0 break-words text-sm text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]"
        >
          {tx.authSignOutRecoveryTitle || "Finish signing out"}
        </p>
      ) : null}
      {nameSaveError ? (
        <p role="alert" className="text-sm text-destructive">
          {nameSaveError}
        </p>
      ) : null}
      <div>
        <SettingsStatus>{nameStatus}</SettingsStatus>
      </div>
    </PanelFrame>
  );
}
