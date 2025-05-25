"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { ForwardingService } from "@/lib/services/forwarding-service";
import { AuthService } from "@/lib/services/auth-service";
import { SettingsService } from "@/lib/services/settings-service";

const formSchema = z.object({
  name: z.string().min(2, {
    message: "نام سرویس باید حداقل ۲ کاراکتر باشد",
  }),
  sourceChannels: z.array(z.string()).min(1, {
    message: "حداقل یک کانال مبدا باید وارد شود",
  }),
  targetChannels: z.array(z.string()).min(1, {
    message: "حداقل یک کانال مقصد باید وارد شود",
  }),
  useAI: z.boolean().default(false),
  promptTemplate: z.string().optional(),
  searchReplaceRules: z.array(
    z.object({
      search: z.string(),
      replace: z.string(),
    })
  ),
});

export default function ForwardingServiceForm({ service, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [isTelegramConnected, setIsTelegramConnected] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: service?.name || "",
      sourceChannels: service?.source_channels || [""],
      targetChannels: service?.target_channels || [""],
      useAI: Boolean(service?.prompt_template),
      promptTemplate: service?.prompt_template || "",
      searchReplaceRules: service?.search_replace_rules || [
        { search: "", replace: "" },
      ],
    },
  });

  useEffect(() => {
    const checkRequirements = async () => {
      const user = AuthService.getStoredUser();
      setIsTelegramConnected(Boolean(user?.telegramSession));

      const settings = await SettingsService.getSettings();
      setHasGeminiKey(Boolean(settings?.gemini_api_key));
    };

    checkRequirements();
  }, []);

  const onSubmit = async (values) => {
    if (!isTelegramConnected) {
      toast.error("لطفاً ابتدا به تلگرام متصل شوید");
      return;
    }

    if (values.useAI && !hasGeminiKey) {
      toast.error(
        "برای استفاده از هوش مصنوعی، لطفاً کلید API جیمنای را در تنظیمات وارد کنید"
      );
      return;
    }

    setLoading(true);
    try {
      const cleanedValues = {
        ...values,
        sourceChannels: values.sourceChannels.filter(Boolean),
        targetChannels: values.targetChannels.filter(Boolean),
        searchReplaceRules: values.searchReplaceRules.filter(
          (rule) => rule.search && rule.replace
        ),
        promptTemplate: values.useAI ? values.promptTemplate : null,
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
        form.reset();
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

  const addSourceChannel = () => {
    const currentChannels = form.getValues("sourceChannels");
    form.setValue("sourceChannels", [...currentChannels, ""]);
  };

  const removeSourceChannel = (index) => {
    const currentChannels = form.getValues("sourceChannels");
    if (currentChannels.length > 1) {
      form.setValue(
        "sourceChannels",
        currentChannels.filter((_, i) => i !== index)
      );
    }
  };

  const addTargetChannel = () => {
    const currentChannels = form.getValues("targetChannels");
    form.setValue("targetChannels", [...currentChannels, ""]);
  };

  const removeTargetChannel = (index) => {
    const currentChannels = form.getValues("targetChannels");
    if (currentChannels.length > 1) {
      form.setValue(
        "targetChannels",
        currentChannels.filter((_, i) => i !== index)
      );
    }
  };

  const addSearchReplaceRule = () => {
    const currentRules = form.getValues("searchReplaceRules");
    form.setValue("searchReplaceRules", [
      ...currentRules,
      { search: "", replace: "" },
    ]);
  };

  const removeSearchReplaceRule = (index) => {
    const currentRules = form.getValues("searchReplaceRules");
    if (currentRules.length > 1) {
      form.setValue(
        "searchReplaceRules",
        currentRules.filter((_, i) => i !== index)
      );
    }
  };

  if (!isTelegramConnected) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-4">
          برای ایجاد سرویس، ابتدا باید به تلگرام متصل شوید
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

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 text-right"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-right block">نام سرویس</FormLabel>
              <FormControl>
                <Input
                  placeholder="نام سرویس را وارد کنید"
                  className="text-right"
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-right" />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-right">کانال‌های مبدا</h3>
          {form.watch("sourceChannels").map((_, index) => (
            <div key={index} className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => removeSourceChannel(index)}
                disabled={form.watch("sourceChannels").length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <FormField
                control={form.control}
                name={`sourceChannels.${index}`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input
                        placeholder="نام کاربری کانال مبدا"
                        className="text-right"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-right" />
                  </FormItem>
                )}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={addSourceChannel}
            className="w-full"
          >
            <Plus className="h-4 w-4 ml-2" />
            افزودن کانال مبدا
          </Button>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-right">کانال‌های مقصد</h3>
          {form.watch("targetChannels").map((_, index) => (
            <div key={index} className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => removeTargetChannel(index)}
                disabled={form.watch("targetChannels").length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <FormField
                control={form.control}
                name={`targetChannels.${index}`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input
                        placeholder="نام کاربری کانال مقصد"
                        className="text-right"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-right" />
                  </FormItem>
                )}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={addTargetChannel}
            className="w-full"
          >
            <Plus className="h-4 w-4 ml-2" />
            افزودن کانال مقصد
          </Button>
        </div>

        <FormField
          control={form.control}
          name="useAI"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5 text-right">
                <FormLabel className="text-base">
                  استفاده از هوش مصنوعی
                </FormLabel>
                <FormDescription>
                  ترجمه خودکار متن‌ها با استفاده از هوش مصنوعی
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={!hasGeminiKey}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {form.watch("useAI") && (
          <FormField
            control={form.control}
            name="promptTemplate"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-right block">قالب پرامپت</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="قالب پرامپت را وارد کنید"
                    className="min-h-[150px] font-mono text-sm text-right"
                    dir="rtl"
                    {...field}
                  />
                </FormControl>
                <FormDescription className="text-right">
                  از {"{text}"} برای جایگذاری متن اصلی استفاده کنید
                </FormDescription>
                <FormMessage className="text-right" />
              </FormItem>
            )}
          />
        )}

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-right">
            قوانین جایگزینی متن
          </h3>
          {form.watch("searchReplaceRules").map((_, index) => (
            <div key={index} className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => removeSearchReplaceRule(index)}
                disabled={form.watch("searchReplaceRules").length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <FormField
                control={form.control}
                name={`searchReplaceRules.${index}.replace`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input
                        placeholder="متن جایگزین"
                        className="text-right"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-right" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`searchReplaceRules.${index}.search`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input
                        placeholder="متن جستجو"
                        className="text-right"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-right" />
                  </FormItem>
                )}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={addSearchReplaceRule}
            className="w-full"
          >
            <Plus className="h-4 w-4 ml-2" />
            افزودن قانون جایگزینی
          </Button>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading
            ? "در حال پردازش..."
            : service?.id
            ? "بروزرسانی سرویس"
            : "ایجاد سرویس"}
        </Button>
      </form>
    </Form>
  );
}
