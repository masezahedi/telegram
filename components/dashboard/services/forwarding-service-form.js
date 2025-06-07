// components/dashboard/services/forwarding-service-form.js
"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import { SettingsService } from "@/lib/services/settings-service";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";

// ... (Schema and helper function remain the same as before)
const formSchema = z.object({
  name: z.string().min(2, { message: "نام سرویس باید حداقل ۲ کاراکتر باشد." }),
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

const ensureInitialArrayField = (fieldValue) => {
  if (Array.isArray(fieldValue)) {
    const filtered = fieldValue.filter(
      (item) => typeof item === "string" && item.trim() !== ""
    );
    return filtered.length > 0 ? filtered : [""];
  }
  if (typeof fieldValue === "string" && fieldValue.trim() !== "")
    return [fieldValue];
  return [""];
};

export default function ForwardingServiceForm({
  service,
  onSuccess,
  userAccountStatus,
}) {
  // ... (All the state and useEffect hooks remain the same)
  const [loading, setLoading] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);

  const {
    isExpired: isAccountExpired,
    isPremium,
    isAdmin,
    trialActivated: isTrialActuallyActivated,
    isTelegramConnected,
    tariffSettings,
  } = userAccountStatus || {};
  const normalUserMaxChannelsPerService =
    tariffSettings?.normalUserMaxChannelsPerService ?? 1;
  const premiumUserMaxChannelsPerService =
    tariffSettings?.premiumUserMaxChannelsPerService ?? 10;
  const normalUserTrialDays = tariffSettings?.normalUserTrialDays ?? 15;

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
      const firstSource = currentSourceChannels?.[0] || "";
      const firstTarget = currentTargetChannels?.[0] || "";
      replaceSource([firstSource]);
      replaceTarget([firstTarget]);
    } else {
      if (sourceFields.length === 0) appendSource("");
      if (targetFields.length === 0) appendTarget("");
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
    // ... (onSubmit logic remains exactly the same)
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

    const isNewService = !service?.id;
    if (!isAdmin) {
      if (isAccountExpired && isNewService) {
        toast.error(
          "مهلت استفاده شما از سرویس‌ها به پایان رسیده است و نمی‌توانید سرویس جدیدی ایجاد کنید. برای ادامه، لطفاً اشتراک خود را ارتقا دهید."
        );
        return;
      }
      if (!isPremium && !isTrialActuallyActivated && isNewService) {
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
        form.setError("sourceChannels.0", {
          type: "manual",
          message: errorMsg,
        });
        form.setError("targetChannels.0", {
          type: "manual",
          message: errorMsg,
        });
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

  // ... (the rest of the component's state and logic remains the same)
  const copyHistoryEnabled = form.watch("copyHistory");
  const startFromIdWatched = form.watch("startFromId");
  const channelLimitMessage = isAdmin
    ? "مدیران محدودیتی در تعداد کانال ندارند."
    : isPremium
    ? `کاربران پرمیوم می‌توانند حداکثر ${premiumUserMaxChannelsPerService} کانال مبدأ و ${premiumUserMaxChannelsPerService} کانال مقصد تعریف کنند.`
    : `کاربران عادی می‌توانند حداکثر ${normalUserMaxChannelsPerService} کانال مبدأ و ${normalUserMaxChannelsPerService} کانال مقصد تعریف کنند.`;

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
  if (!service?.id && !isAdmin && isAccountExpired) {
    return (
      <Alert variant="destructive">
        <Info className="h-4 w-4" />
        <AlertTitle>محدودیت ایجاد سرویس</AlertTitle>
        <AlertDescription>
          امکان ایجاد سرویس جدید وجود ندارد. لطفاً{" "}
          {!isPremium && !isTrialActuallyActivated
            ? `مهلت ${normalUserTrialDays} روزه آزمایشی خود را فعال کنید`
            : "اشتراک خود را ارتقا دهید."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 dir-rtl"
      >
        <Accordion
          type="multiple"
          defaultValue={["item-1", "item-2"]}
          className="w-full space-y-4"
        >
          <AccordionItem
            value="item-1"
            className="border rounded-lg overflow-hidden"
          >
            <AccordionTrigger className="bg-muted/50 px-4 py-3 hover:no-underline">
              <span className="flex items-center gap-x-2 font-semibold text-lg">
                <Settings2 className="h-5 w-5 text-primary" />
                ۱. تنظیمات اصلی
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-4 space-y-6">
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
                          <SelectItem value="forward">
                            فوروارد خودکار
                          </SelectItem>
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
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="item-2"
            className="border rounded-lg overflow-hidden"
          >
            <AccordionTrigger className="bg-muted/50 px-4 py-3 hover:no-underline">
              <span className="flex items-center gap-x-2 font-semibold text-lg">
                <CopyCheck className="h-5 w-5 text-primary" />
                ۲. کانال‌های مبدأ و مقصد
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-4 space-y-6">
                <Alert
                  variant="default"
                  className="border-info text-info dark:border-blue-700 dark:text-blue-300 dark:[&>svg]:text-blue-400"
                >
                  <Info className="h-4 w-4" />
                  <AlertDescription>{channelLimitMessage}</AlertDescription>
                </Alert>
                <div className="space-y-3">
                  <FormLabel className="text-base font-medium block text-right">
                    {" "}
                    {isCopyService ? "کانال مبدأ" : "کانال‌های مبدأ"}
                  </FormLabel>
                  <FormDescription className="block text-right">
                    نام کاربری کانال(ها) بدون @ یا با @ وارد شود.
                  </FormDescription>
                  {isCopyService
                    ? sourceFields.length > 0 && (
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
                <div className="space-y-3">
                  <FormLabel className="text-base font-medium block text-right">
                    {isCopyService ? "کانال مقصد" : "کانال‌های مقصد"}
                  </FormLabel>
                  <FormDescription className="block text-right">
                    نام کاربری کانال(ها) بدون @ یا با @ وارد شود.
                  </FormDescription>
                  {isCopyService
                    ? targetFields.length > 0 && (
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
            </AccordionContent>
          </AccordionItem>

          {isCopyService && (
            <AccordionItem
              value="item-3"
              className="border rounded-lg overflow-hidden"
            >
              <AccordionTrigger className="bg-muted/50 px-4 py-3 hover:no-underline">
                <span className="flex items-center gap-x-2 font-semibold text-lg">
                  <Copy className="h-5 w-5 text-primary" />
                  تنظیمات کپی تاریخچه
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-4 space-y-6">
                  {/* All copy history fields go here */}
                </CardContent>
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem
            value="item-4"
            className="border rounded-lg overflow-hidden"
          >
            <AccordionTrigger className="bg-muted/50 px-4 py-3 hover:no-underline">
              <span className="flex items-center gap-x-2 font-semibold text-lg">
                <Brain className="h-5 w-5 text-primary" />
                تنظیمات هوش مصنوعی
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-4 space-y-6">
                {/* All AI fields go here */}
              </CardContent>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="item-5"
            className="border rounded-lg overflow-hidden"
          >
            <AccordionTrigger className="bg-muted/50 px-4 py-3 hover:no-underline">
              <span className="flex items-center gap-x-2 font-semibold text-lg">
                <MessageSquareText className="h-5 w-5 text-primary" />
                جایگزینی متن
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-4 space-y-4">
                {/* All Search/Replace fields go here */}
              </CardContent>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex justify-start pt-4">
          <Button
            type="submit"
            size="lg"
            className="w-full sm:w-auto"
            disabled={loading || (!service?.id && !isAdmin && isAccountExpired)}
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
