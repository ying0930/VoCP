"use client";

import { Bot, Download, Eye, EyeOff, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MeField, MeSection } from "@/components/me/me-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { t } from "@/lib/i18n";
import {
  downloadAiSettings,
  parseAiSettingsJson,
  saveAiSettings,
  waitForAiSettingsPersistence,
} from "@/src/lib/ai-provider";
import type { AiProvider, AiSettings } from "@/types";

const providers: { label: string; value: AiProvider }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
  { value: "custom", label: "OpenAI compatible" },
];

export function AiSettingsSection({
  settings,
  onChange,
}: {
  settings: AiSettings;
  onChange: (settings: AiSettings) => void;
}) {
  const [showApiKey, setShowApiKey] = useState(false);
  const update = (patch: Partial<AiSettings>) =>
    onChange({ ...settings, ...patch });

  const save = async () => {
    if (settings.enabled && !settings.apiKey.trim()) {
      toast.error(t("me.apiKeyRequired"));
      return;
    }
    saveAiSettings(settings);
    await waitForAiSettingsPersistence();
    toast.success(t("settings.aiSaved"));
  };

  const importSettings = async (file: File) => {
    try {
      const imported = parseAiSettingsJson(await file.text());
      const next = { ...imported, apiKey: settings.apiKey };
      onChange(next);
      saveAiSettings(next);
      await waitForAiSettingsPersistence();
      toast.success(t("settings.aiSaved"));
    } catch (reason) {
      toast.error(
        t("settings.invalidBackup", {
          message: reason instanceof Error ? reason.message : String(reason),
        }),
      );
    }
  };

  return (
    <MeSection
      icon={Bot}
      title={t("settings.ai")}
      description={t("settings.aiDescription")}
    >
      <div className="grid gap-5">
        <div className="flex items-center justify-between gap-4 rounded-xl bg-muted px-4 py-3.5">
          <div>
            <p className="text-sm font-medium">{t("me.directApi")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("me.directApiDescription")}
            </p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(enabled) => update({ enabled })}
            aria-label={t("me.directApi")}
          />
        </div>

        {settings.enabled && (
          <div className="t-panel-reveal grid gap-5">
            <MeField label={t("settings.provider")}>
              <Select
                value={settings.provider}
                onValueChange={(provider) =>
                  update({ provider: provider as AiProvider })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.value} value={provider.value}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </MeField>
            <MeField label={t("settings.model")}>
              <Input
                value={settings.model}
                onChange={(event) => update({ model: event.target.value })}
              />
            </MeField>
            <MeField
              label={t("settings.endpoint")}
              description={t("me.endpointHint")}
            >
              <Input
                inputMode="url"
                value={settings.baseUrl}
                placeholder={t("me.endpointPlaceholder")}
                onChange={(event) => update({ baseUrl: event.target.value })}
              />
            </MeField>
            <MeField label={t("settings.apiKey")}>
              <div className="relative">
                <Input
                  className="pr-12"
                  type={showApiKey ? "text" : "password"}
                  autoComplete="off"
                  value={settings.apiKey}
                  onChange={(event) => update({ apiKey: event.target.value })}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                  aria-label={t(showApiKey ? "me.hideApiKey" : "me.showApiKey")}
                  onClick={() => setShowApiKey((visible) => !visible)}
                >
                  {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </MeField>
            <MeField
              label={t("settings.batchSize")}
              description={t("me.batchSizeHint")}
            >
              <Input
                type="number"
                min={5}
                max={20}
                value={settings.batchSize}
                onChange={(event) =>
                  update({ batchSize: Number(event.target.value) })
                }
              />
            </MeField>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => downloadAiSettings(settings)}
          >
            <Download className="size-4" />
            {t("settings.exportAi")}
          </Button>
          <Button asChild variant="ghost">
            <label className="cursor-pointer">
              <Upload className="size-4" />
              {t("settings.importAi")}
              <input
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importSettings(file);
                  event.target.value = "";
                }}
              />
            </label>
          </Button>
          <Button onClick={() => void save()}>{t("settings.saveAi")}</Button>
        </div>
      </div>
    </MeSection>
  );
}
