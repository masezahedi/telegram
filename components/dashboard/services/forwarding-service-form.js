// components/dashboard/services/forwarding-service-form.js
"use client";

import { useState, useEffect } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Trash2,
  Info,
  Settings2,
  CopyCheck,
  MessageSquareText,
  Brain,
  ExternalLink,
  Copy,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ForwardingService } from "@/lib/services/forwarding-service";
import { AuthService } from "@/lib/services/auth-service";
import { SettingsService } from "@/lib/services/settings-service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription as CardDesc,
} from "@/components/ui/card";

const formSchema = z.object({
  name: z.string().min(2, {
    message: "نام سرویس باید حداقل ۲ کاراکتر باشد.",
  }),
  type: z.enum(["forward", "copy"], {
    errorMap: () => ({ message: "لطفا نوع سرویس را انتخاب کنید." }),
  }),
  sourceChannels: z
    .array(
      z
        .string()
        .min(1, { message: "نام کاربری کانال مبدا نمی‌تواند خالی باشد." })
    )
    .min(1, { message: "حداقل یک کانال مبدا باید وارد شود." }),
  targetChannels: z
    .array(
      z
        .string()
        .min(1, { message: "نام کاربری کانال مقصد نمی‌تواند خالی باشد." })
    )
    .min(1, { message: "حداقل یک کانال مقصد باید وارد شود." }),
  useAI: z.boolean().default(false),
  promptTemplate: z.string().optional(),
  searchReplaceRules: z
    .array(
      z.object({
        search: z.string().optional(),
        replace: z.string().optional(),
      })
    )
    .optional(),
  copyHistory: z.boolean().default(false),
  historyLimit: z.coerce
    .number()
    .min(1, "حداقل 1")
    .max(10000, "حداکثر 10000")
    .optional(),
  historyDirection: z.enum(["newest", "oldest"]).optional(),
  startFromId: z
    .string()
    .optional()
    .refine((val) => !val || /^\d+$/.test(val), {
      message: "شناسه پیام باید فقط شامل اعداد باشد.",
    }),
  copyDirection: z.enum(["before", "after"]).optional(),
});

// Helper to ensure array has at least one item, defaulting to empty string
const ensureInitialArrayField = (fieldValue) => {
  if (Array.isArray(fieldValue)) {
    const filtered = fieldValue.filter(
      (item) => typeof item === "string" && item.trim() !== ""
    );
    return filtered.length > 0 ? filtered : [""];
  }
  if (typeof fieldValue === "string" && fieldValue.trim() !== "") {
    return [fieldValue];
  }
  return [""];
};

export default function ForwardingServiceForm({
  service,
  onSuccess,
  userAccountStatus,
}) {
  const [loading, setLoading] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);

  // Extract tariff settings and user status
  const normalUserMaxChannelsPerService = userAccountStatus?.tariffSettings?.normalUserMaxChannelsPerService ?? 1;
  const premiumUserMaxChannelsPerService = userAccountStatus?.tariffSettings?.premiumUserMaxChannelsPerService ?? 10;
  const normalUserTrialDays = userAccountStatus?.tariffSettings?.normalUserTrialDays ?? 15;

  const isTelegramConnected = userAccountStatus?.isTelegramConnected;
  const isAdmin = userAccountStatus?.isAdmin;
  const isPremium = userAccountStatus?.isPremium;
  const trialActivatedAt = userAccountStatus?.trialActivatedAt; // This is the actual timestamp
  const premiumExpiryDate = userAccountStatus?.premiumExpiryDate; // This is the actual timestamp


  // Determine if the user's account is currently expired
  const now = new Date();
  let isAccountExpired = false;

  // Check if trialActivatedAt exists (meaning trial was activated)
  const isTrialActuallyActivated = Boolean(trialActivatedAt);

  if (!isAdmin) {
    if (isPremium) {
      // Premium users: check premiumExpiryDate
      if (premiumExpiryDate && new Date(premiumExpiryDate) < now) {
        isAccountExpired = true;
      }
    } else {
      // Normal users: check trial_activated_at and calculate expiry based on normalUserTrialDays
      if (isTrialActuallyActivated) {
        const trialStartDate = new Date(trialActivatedAt);
        const trialEndDate = new Date(trialStartDate);
        trialEndDate.setDate(trialStartDate.getDate() + normalUserTrialDays);
        if (trialEndDate < now) {
          isAccountExpired = true;
        }
      } else {
        // If not premium and trial never activated, consider as expired for service creation/activation purposes
        isAccountExpired = true; // This handles the case where trial hasn't started yet
      }
    }
  }

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: service?.name || "",
      type: service?.type || "forward",
      sourceChannels: ensureInitialArrayField(
        service?.source_channels
          ? Array.isArray(service.source_channels)
            ? service.source_channels
            : JSON.parse(service.source_channels || '[""]')
          : [""]
      ),
      targetChannels: ensureInitialArrayField(
        service?.target_channels
          ? Array.isArray(service.target_channels)
            ? service.target_channels
            : JSON.parse(service.target_channels || '[""]')
          : [""]
      ),
      useAI: Boolean(service?.prompt_template),
      promptTemplate:
        service?.prompt_template ||
        "پیام زیر را به فارسی روان ترجمه کن  :\n\n{text}",
      searchReplaceRules: service?.search_replace_rules
        ? (Array.isArray(service.search_replace_rules)
            ? service.search_replace_rules
            : JSON.parse(service.search_replace_rules || "[]")
          ).length > 0
          ? Array.isArray(service.search_replace_rules)
            ? service.search_replace_rules
            : JSON.parse(service.search_replace_rules || "[]")
          : [{ search: "", replace: "" }]
        : [{ search: "", replace: "" }],
      copyHistory: Boolean(service?.copy_history),
      historyLimit: service?.history_limit || 100,
      historyDirection: service?.history_direction || "newest",
      startFromId: service?.start_from_id || "",
      copyDirection: service?.copy_direction || "before",
    },
  });

  const serviceType = form.watch("type");
  const isCopyService = serviceType === "copy";

  const {
    fields: sourceFields,
    append: appendSource,
    remove: removeSource,
    replace: replaceSource,
  } = useFieldArray({ control: form.control, name: "sourceChannels" });
  const {
    fields: targetFields,
    append: appendTarget,
    remove: removeTarget,
    replace: replaceTarget,
  } = useFieldArray({ control: form.control, name: "targetChannels" });
  const {
    fields: ruleFields,
    append: appendRule,
    remove: removeRule,
  } = useFieldArray({ control: form.control, name: "searchReplaceRules" });

  useEffect(() => {
    const checkRequirements = async () => {
      const settings = await SettingsService.getSettings();
      setHasGeminiKey(Boolean(settings?.gemini_api_key));
    };
    checkRequirements();
  }, []);

  useEffect(() => {
    const currentSourceChannels = form.getValues("sourceChannels");
    const currentTargetChannels = form.getValues("targetChannels");

    if (isCopyService) {
      // For "copy" type, ensure exactly one source and one target channel field.
      const firstSource = currentSourceChannels?.[0] || "";
      const firstTarget = currentTargetChannels?.[0] || "";
      replaceSource([firstSource]);
      replaceTarget([firstTarget]);
    } else {
      // For "forward" type, if fields are empty (e.g., after switching from copy and deleting), ensure at least one.
      if (sourceFields.length === 0) {
        appendSource("");
      }
      if (targetFields.length === 0) {
        appendTarget("");
      }
    }
  }, [
    isCopyService,
    form,
    replaceSource,
    replaceTarget,
    appendSource,
    appendTarget,
    sourceFields.length,
    targetFields.length,
  ]);

  const onSubmit = async (values) => {
    // NEW LOGIC: Check Telegram connection
    if (!isTelegramConnected) {
      toast.error("لطفاً ابتدا حساب تلگرام خود را متصل کنید.");
      return;
    }

    if (values.useAI && !hasGeminiKey) {
      toast.error(
        "برای استفاده از هوش مصنوعی، لطفاً کلید API جیمنای را در تنظیمات وارد کنید"
      );
      return;
    }

    // NEW LOGIC: Prevent creation/editing if user account is expired or trial not activated
    const isNewService = !service?.id;
    if (!isAdmin) {
      if (isAccountExpired && isNewService) { // Only block new service creation for expired non-admins
        toast.error(
          "مهلت استفاده شما از سرویس‌ها به پایان رسیده است و نمی‌توانید سرویس جدیدی ایجاد کنید. برای ادامه، لطفاً اشتراک خود را ارتقا دهید."
        );
        return;
      }
      if (!isPremium && !isTrialActuallyActivated && isNewService) { // Only for new services if normal user and trial not activated
        toast.error(
          `لطفاً برای شروع ایجاد سرویس، مهلت ${normalUserTrialDays} روزه آزمایشی خود را فعال کنید. (در بخش لیست سرویس‌ها)`
        );
        return;
      }
    }

    let finalSourceChannels = values.sourceChannels
      .map((s) => (typeof s === "string" ? s : ""))
      .filter(Boolean);
    let finalTargetChannels = values.targetChannels
      .map((t) => (typeof t === "string" ? t : ""))
      .filter(Boolean);

    if (values.type === "copy") {
      finalSourceChannels = finalSourceChannels.slice(0, 1);
      finalTargetChannels = finalTargetChannels.slice(0, 1);
    }

    if (finalSourceChannels.length === 0) {
      form.setError("sourceChannels.0", {
        type: "manual",
        message: "حداقل یک کانال مبدا الزامی است.",
      });
      return;
    }
    if (finalTargetChannels.length === 0) {
      form.setError("targetChannels.0", {
        type: "manual",
        message: "حداقل یک کانال مقصد الزامی است.",
      });
      return;
    }

    // Client-side channel count validation based on tariff settings
    if (!isAdmin) {
      const currentMaxChannels = isPremium
        ? premiumUserMaxChannelsPerService
        : normalUserMaxChannelsPerService;

      if (
        finalSourceChannels.length > currentMaxChannels ||
        finalTargetChannels.length > currentMaxChannels
      ) {
        const role = isPremium ? "پرمیوم" : "عادی";
        const errorMsg = `کاربران ${role} حداکثر می‌توانند ${currentMaxChannels} کانال مبدأ و ${currentMaxChannels} کانال مقصد تعریف کنند.`;
        toast.error(errorMsg);
        form.setError("sourceChannels.0", { type: "manual", message: errorMsg });
        form.setError("targetChannels.0", { type: "manual", message: errorMsg });
        return;
      }
    }


    if (values.type === "copy") {
      if (values.startFromId && values.startFromId.trim()) {
        const messageId = parseInt(values.startFromId.trim(), 10);
        if (isNaN(messageId) || messageId <= 0) {
          toast.error("شناسه پیام باید یک عدد مثبت باشد");
          return;
        }
      }
    }

    setLoading(true);
    try {
      const cleanedValues = {
        ...values,
        sourceChannels: finalSourceChannels.map((channel) =>
          channel.trim().startsWith("@") ? channel.trim() : `@${channel.trim()}`
        ),
        targetChannels: finalTargetChannels.map((channel) =>
          channel.trim().startsWith("@") ? channel.trim() : `@${channel.trim()}`
        ),
        searchReplaceRules: (values.searchReplaceRules || []).filter(
          (rule) => rule.search || rule.replace
        ),
        promptTemplate: values.useAI ? values.promptTemplate : "",
        copyHistory: values.type === "copy" ? values.copyHistory : false,
        historyLimit:
          values.type === "copy" && values.copyHistory
            ? values.historyLimit
            : 100,
        historyDirection:
          values.type === "copy" ? values.historyDirection : "newest",
        startFromId:
          values.type === "copy" && values.startFromId
            ? values.startFromId.trim()
            : null,
        copyDirection: values.type === "copy" ? values.copyDirection : "before",
      };

      const result = service?.id
        ? await ForwardingService.updateService(service.id, cleanedValues)
        : await ForwardingService.createService(cleanedValues);

      if (result.success) {
        toast.success(
          service?.id
            ? "سرویس با موفقیت بروزرسانی شد"
            : "سرویس با موفقیت ایجاد شد"
        );
        form.reset({
          name: "",
          type: "forward",
          sourceChannels: [""],
          targetChannels: [""],
          useAI: false,
          promptTemplate: "پیام زیر را به فارسی روان ترجمه کن  :\n\n{text}",
          searchReplaceRules: [{ search: "", replace: "" }],
          copyHistory: false,
          historyLimit: 100,
          historyDirection: "newest",
          startFromId: "",
          copyDirection: "before",
        });
        onSuccess?.();
      } else {
        toast.error(result.error || "خطا در عملیات سرویس");
      }
    } catch (error) {
      console.error("Service operation error:", error);
      toast.error("خطا در عملیات سرویس");
    } finally {
      setLoading(false);
    }
  };

  const copyHistoryEnabled = form.watch("copyHistory");
  const startFromIdWatched = form.watch("startFromId");

  // Determine channel limits message
  const channelLimitMessage = isAdmin
    ? "مدیران محدودیتی در تعداد کانال ندارند."
    : isPremium
      ? `کاربران پرمیوم می‌توانند حداکثر ${premiumUserMaxChannelsPerService} کانال مبدأ و ${premiumUserMaxChannelsPerService} کانال مقصد تعریف کنند.`
      : `کاربران عادی می‌توانند حداکثر ${normalUserMaxChannelsPerService} کانال مبدأ و ${normalUserMaxChannelsPerService} کانال مقصد تعریف کنند.`;


  // NEW LOGIC: Conditional rendering based on Telegram connection and trial status
  if (!isTelegramConnected) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-4">
          برای ایجاد و مدیریت سرویس‌ها، ابتدا باید به تلگرام متصل شوید.
        </p>
        <Button
          variant="outline"
          onClick={() => (window.location.href = "/dashboard")}
        >
          اتصال به تلگرام
        </Button>
      </div>
    );
  }

  // NEW LOGIC: Block new service creation if account is expired or trial not activated
  if (!service?.id && !isAdmin && (isAccountExpired)) { // Simplified: isAccountExpired already covers trial not activated
    return (
      <Alert variant="destructive">
        <Info className="h-4 w-4" />
        <AlertTitle>محدودیت ایجاد سرویس</AlertTitle>
        <AlertDescription>
          امکان ایجاد سرویس جدید وجود ندارد. لطفاً{" "}
          {!isPremium && !isTrialActuallyActivated ? `مهلت ${normalUserTrialDays} روزه آزمایشی خود را فعال کنید` : ""}
          {isAccountExpired ? " یا اشتراک خود را ارتقا دهید." : "."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-8 dir-rtl"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-x-2">
              <Settings2 className="h-6 w-6 text-primary" />
              تنظیمات اصلی سرویس
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نام سرویس</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="مثال: فوروارد از کانال خبر به کانال شخصی"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نوع سرویس</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    dir="rtl"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="یک نوع را انتخاب کنید" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="forward">فوروارد خودکار</SelectItem>
                      <SelectItem value="copy">کپی کانال</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {isCopyService
                      ? "کپی کامل یک کانال به کانال دیگر."
                      : "فوروارد پیام‌ها بین چندین کانال."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {isCopyService && (
          <Alert
            variant="default"
            className="border-primary/50 text-primary dark:border-primary/70 dark:text-primary/90 [&>svg]:text-primary"
          >
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>توجه:</strong> در حالت "کپی کانال"، فقط یک کانال مبدا و یک
              کانال مقصد مجاز است. برای فوروارد از چندین مبدا به چندین مقصد، از
              نوع "فوروارد خودکار" استفاده کنید.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-x-2">
              <CopyCheck className="h-6 w-6 text-primary" />
              کانال‌های مبدأ و مقصد
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
             <Alert variant="default" className="border-info text-info dark:border-blue-700 dark:text-blue-300 dark:[&>svg]:text-blue-400">
              <Info className="h-4 w-4" />
              <AlertDescription>
                {channelLimitMessage}
              </AlertDescription>
            </Alert>
            {/* Source Channels Section */}
            <div className="space-y-3 rounded-md border p-4">
              <FormLabel className="text-base font-medium block text-right">
                {" "}
                {isCopyService ? "کانال مبدأ" : "کانال‌های مبدأ"}
              </FormLabel>
              <FormDescription className="block text-right">
                نام کاربری کانال(ها) بدون @ یا با @ وارد شود.
              </FormDescription>
              {isCopyService
                ? // Only render the first field for copy service type
                  sourceFields.length > 0 && ( // Ensure field exists before rendering
                    <FormField
                      control={form.control}
                      name={`sourceChannels.0`}
                      render={({ field: controlledField }) => (
                        <FormItem>
                          <div className="flex items-center gap-x-2">
                            <FormControl>
                              <Input
                                dir="ltr"
                                placeholder="@SourceChannel"
                                {...controlledField}
                              />
                            </FormControl>
                          </div>
                          <FormMessage className="text-right" />
                        </FormItem>
                      )}
                    />
                  )
                : sourceFields.map((item, index) => (
                    <FormField
                      key={item.id}
                      control={form.control}
                      name={`sourceChannels.${index}`}
                      render={({ field: controlledField }) => (
                        <FormItem>
                          <div className="flex items-center gap-x-2">
                            <FormControl>
                              <Input
                                dir="ltr"
                                placeholder="@SourceChannel"
                                {...controlledField}
                              />
                            </FormControl>
                            {sourceFields.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => removeSource(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <FormMessage className="text-right" />
                        </FormItem>
                      )}
                    />
                  ))}
              {!isCopyService && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendSource("")}
                  className="w-full gap-x-1"
                >
                  <Plus className="h-4 w-4" />
                  افزودن مبدأ
                </Button>
              )}
            </div>

            {/* Target Channels Section */}
            <div className="space-y-3 rounded-md border p-4">
              <FormLabel className="text-base font-medium block text-right">
                {isCopyService ? "کانال مقصد" : "کانال‌های مقصد"}
              </FormLabel>
              <FormDescription className="block text-right">
                نام کاربری کانال(ها) بدون @ یا با @ وارد شود.
              </FormDescription>
              {isCopyService
                ? // Only render the first field for copy service type
                  targetFields.length > 0 && ( // Ensure field exists
                    <FormField
                      control={form.control}
                      name={`targetChannels.0`}
                      render={({ field: controlledField }) => (
                        <FormItem>
                          <div className="flex items-center gap-x-2">
                            <FormControl>
                              <Input
                                dir="ltr"
                                placeholder="@TargetChannel"
                                {...controlledField}
                              />
                            </FormControl>
                          </div>
                          <FormMessage className="text-right" />
                        </FormItem>
                      )}
                    />
                  )
                : targetFields.map((item, index) => (
                    <FormField
                      key={item.id}
                      control={form.control}
                      name={`targetChannels.${index}`}
                      render={({ field: controlledField }) => (
                        <FormItem>
                          <div className="flex items-center gap-x-2">
                            <FormControl>
                              <Input
                                dir="ltr"
                                placeholder="@TargetChannel"
                                {...controlledField}
                              />
                            </FormControl>
                            {targetFields.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => removeTarget(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <FormMessage className="text-right" />
                        </FormItem>
                      )}
                    />
                  ))}
              {!isCopyService && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendTarget("")}
                  className="w-full gap-x-1"
                >
                  <Plus className="h-4 w-4" />
                  افزودن مقصد
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {isCopyService && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-x-2">
                <Copy className="h-5 w-5 text-primary" />
                تنظیمات کپی تاریخچه
              </CardTitle>
              <CardDesc>
                تنظیمات مربوط به نحوه کپی پیام‌های قدیمی کانال.
              </CardDesc>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="copyHistory"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5 text-right">
                      <FormLabel className="text-base">
                        کپی پیام‌های قبلی
                      </FormLabel>
                      <FormDescription>
                        کپی پیام‌های قدیمی کانال مبدا به مقصد هنگام فعال‌سازی.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        dir="ltr"
                        id="copyHistory-switch"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              {copyHistoryEnabled && (
                <>
                  <FormField
                    control={form.control}
                    name="historyLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>تعداد پیام‌های قدیمی</FormLabel>
                        <FormControl>
                          <Input
                            dir="ltr"
                            type="number"
                            min="1"
                            max="10000"
                            placeholder="100"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>حداکثر ۱۰۰۰۰ پیام.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="historyDirection"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>ترتیب انتخاب پیام‌ها</FormLabel>
                        <RadioGroup
                          dir="rtl"
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center gap-x-2">
                            <FormControl>
                              <RadioGroupItem value="newest" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              جدیدترین
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center gap-x-2">
                            <FormControl>
                              <RadioGroupItem value="oldest" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              قدیمی‌ترین
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-3 rounded-md border p-4 bg-muted/10">
                    <FormLabel className="text-sm font-medium flex items-center gap-x-1">
                      <Info className="h-4 w-4" />
                      کپی از پیام خاص (اختیاری)
                    </FormLabel>
                    <FormField
                      control={form.control}
                      name="startFromId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>شناسه پیام شروع</FormLabel>
                          <FormControl>
                            <Input
                              dir="ltr"
                              type="text"
                              placeholder="شناسه عددی پیام"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {startFromIdWatched && startFromIdWatched.trim() && (
                      <FormField
                        control={form.control}
                        name="copyDirection"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <FormLabel>جهت کپی</FormLabel>
                            <RadioGroup
                              dir="rtl"
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex flex-col space-y-1"
                            >
                              <FormItem className="flex items-center gap-x-2">
                                <FormControl>
                                  <RadioGroupItem value="before" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  پیام‌های قبل (قدیمی‌تر)
                                </FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center gap-x-2">
                                <FormControl>
                                  <RadioGroupItem value="after" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  پیام‌های بعد (جدیدتر)
                                </FormLabel>
                              </FormItem>
                            </RadioGroup>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-x-2">
              <Brain className="h-5 w-5 text-primary" />
              تنظیمات هوش مصنوعی
            </CardTitle>
            <CardDesc>
              از هوش مصنوعی برای بهبود و تغییر محتوای پیام‌ها استفاده کنید.
            </CardDesc>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="useAI"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5 text-right">
                    <FormLabel htmlFor="useAI-switch" className="text-base">
                      استفاده از هوش مصنوعی
                    </FormLabel>
                    <FormDescription>
                      ترجمه، خلاصه‌سازی یا بازنویسی متن پیام‌ها با Gemini.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      dir="ltr"
                      id="useAI-switch"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={!hasGeminiKey}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {!hasGeminiKey && form.watch("useAI") && (
              <Alert variant="destructive">
                <Info className="h-4 w-4" />
                <AlertTitle>کلید API مورد نیاز است</AlertTitle>
                <AlertDescription>
                  برای استفاده از هوش مصنوعی، لطفاً کلید API جیمنای را در بخش{" "}
                  <Link
                    href="/dashboard/settings"
                    className="font-semibold underline hover:text-destructive/80 inline-flex items-center gap-x-1"
                  >
                    تنظیمات <ExternalLink className="h-3 w-3" />
                  </Link>{" "}
                  وارد کنید.
                </AlertDescription>
              </Alert>
            )}
            {form.watch("useAI") && hasGeminiKey && (
              <FormField
                control={form.control}
                name="promptTemplate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>قالب دستور به هوش مصنوعی (پرامپت)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="مثال: متن زیر را به فارسی روان ترجمه کن  :\n\n{text}"
                        className="min-h-[120px] font-mono text-sm leading-relaxed"
                        dir="rtl"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      از `&#123;text&#125;` برای جایگذاری متن اصلی پیام استفاده
                      کنید.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-x-2">
              <MessageSquareText className="h-5 w-5 text-primary" />
              جایگزینی متن
            </CardTitle>
            <CardDesc>قوانین جستجو و جایگزینی عبارات در متن پیام‌ها.</CardDesc>
          </CardHeader>
          <CardContent className="space-y-4">
            {ruleFields.map((item, index) => (
              <div
                key={item.id}
                className="flex items-end gap-x-2 p-3 border rounded-md bg-muted/20"
              >
                <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                  <FormField
                    control={form.control}
                    name={`searchReplaceRules.${index}.search`}
                    render={({ field: controlledField }) => (
                      <FormItem>
                        <FormLabel>متن جستجو</FormLabel>
                        <FormControl>
                          <Input
                            dir="rtl"
                            placeholder="عبارتی که می‌خواهید پیدا شود"
                            {...controlledField}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`searchReplaceRules.${index}.replace`}
                    render={({ field: controlledField }) => (
                      <FormItem>
                        <FormLabel>متن جایگزین</FormLabel>
                        <FormControl>
                          <Input
                            dir="rtl"
                            placeholder="عبارتی که جایگزین می‌شود (خالی برای حذف)"
                            {...controlledField}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRule(index)}
                  className="text-destructive hover:text-destructive/80 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">حذف قانون</span>
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => appendRule({ search: "", replace: "" })}
              className="w-full gap-x-1"
            >
              <Plus className="h-4 w-4" />
              افزودن قانون جدید
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-start pt-4">
          <Button
            type="submit"
            size="lg"
            className="w-full sm:w-auto"
            disabled={
              loading ||
              (!service?.id && !isAdmin && (isAccountExpired))
            }
          >
            {loading
              ? "در حال پردازش..."
              : service?.id
              ? "بروزرسانی سرویس"
              : "ایجاد سرویس"}
          </Button>
        </div>
      </form>
    </Form>
  );
}