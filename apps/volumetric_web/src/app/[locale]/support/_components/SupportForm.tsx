"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  Bug,
  CircleCheckBig,
  Coins,
  Lightbulb,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Send,
  UserX,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccount } from "@/hooks";
import { useTRPC } from "@/trpc/react";

const SUBJECT_OPTIONS = [
  "generalInquiry",
  "technicalIssue",
  "accountProblem",
  "featureRequest",
  "depositWithdrawal",
  "other",
] as const;

const SUBJECT_ICONS = {
  generalInquiry: MessageCircle,
  technicalIssue: Bug,
  accountProblem: UserX,
  featureRequest: Lightbulb,
  depositWithdrawal: Coins,
  other: MoreHorizontal,
} as const;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB total
const ALLOWED_FILE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
];

type Attachment = {
  filename: string;
  content: string;
  contentType: string;
  size: number;
};

export function SupportForm() {
  const t = useTranslations("Support");
  const tCommon = useTranslations("Common");
  const { setShowAuthFlow, primaryWallet } = useDynamicContext();
  const { data: accountData } = useAccount();
  const trpc = useTRPC();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [hasSubmittedSuccessfully, setHasSubmittedSuccessfully] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);

  // Create schema with translated error messages
  const formSchema = z.object({
    subject: z.string().min(1, t("errors.subjectRequired")),
    customSubject: z.string().optional(),
    email: z.string().email(t("errors.invalidEmail")),
    message: z.string().min(10, t("errors.messageMinLength")),
  });

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange", // Enable real-time validation
    defaultValues: {
      subject: "",
      customSubject: "",
      email: "",
      message: "",
    },
  });

  const submitMutation = useMutation(
    trpc.support.submitTicket.mutationOptions({
      onSuccess: (data) => {
        if (data.success) {
          setHasSubmittedSuccessfully(true);
          setSubmittedTicketId(data.ticketId ?? null);
          toast.success(t("ticketSubmitted"), {
            description: data.ticketId ? t("ticketId", { id: data.ticketId }) : undefined,
          });
          // Reset form
          form.reset();
          setAttachments([]);
        } else {
          toast.error(tCommon("somethingWentWrong"), {
            description: data.error,
          });
        }
      },
      onError: () => {
        toast.error(tCommon("somethingWentWrong"));
      },
    }),
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const currentSize = attachments.reduce((sum, a) => sum + a.size, 0);
    const newAttachments: Attachment[] = [];

    for (const file of Array.from(files)) {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        toast.error(t("invalidFileType"));
        continue;
      }

      if (currentSize + file.size > MAX_FILE_SIZE) {
        toast.error(t("fileTooLarge"));
        break;
      }

      const content = await fileToBase64(file);
      newAttachments.push({
        filename: file.name,
        content,
        contentType: file.type,
        size: file.size,
      });
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (filename: string) => {
    setAttachments((prev) => prev.filter((a) => a.filename !== filename));
  };

  const onSubmit = (values: FormValues) => {
    if (!primaryWallet || !accountData?.profile) return;

    const subjectValue =
      values.subject === "other" ? t("subjects.other") : t(`subjects.${values.subject}`);

    submitMutation.mutate({
      subject: subjectValue,
      customSubject: values.subject === "other" ? values.customSubject : undefined,
      message: values.message,
      email: values.email,
      userId: accountData.profile.address,
      walletAddress: primaryWallet.address,
      attachments: attachments.map(({ filename, content, contentType }) => ({
        filename,
        content,
        contentType,
      })),
    });
  };

  if (!primaryWallet) {
    return (
      <Card className="p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">{t("title")}</h1>
        <p className="text-muted-foreground mb-6">{t("connectToSubmit")}</p>
        <Button onClick={() => setShowAuthFlow(true)}>{t("connectWallet")}</Button>
      </Card>
    );
  }

  if (hasSubmittedSuccessfully) {
    return (
      <Card className="p-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <CircleCheckBig className="size-10 text-green-500" />
          <h2 className="md:text-xl text-lg font-bold">{t("ticketSubmitted")}</h2>
          <p className="text-muted-foreground">{t("successMessage")}</p>
          {submittedTicketId ? (
            <Badge variant="secondary">{t("ticketId", { id: submittedTicketId })}</Badge>
          ) : null}
        </div>
      </Card>
    );
  }

  const selectedSubject = form.watch("subject");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Subject Select */}
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("subject")}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="min-w-64">
                        <SelectValue placeholder={t("selectSubject")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SUBJECT_OPTIONS.map((option) => {
                        const Icon = SUBJECT_ICONS[option];
                        return (
                          <SelectItem key={option} value={option}>
                            <div className="flex items-center gap-2">
                              <Icon className="size-4" />
                              {t(`subjects.${option}`)}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Custom Subject (when "Other" selected) */}
            {selectedSubject === "other" && (
              <FormField
                control={form.control}
                name="customSubject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("customSubject")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("enterSubject")} maxLength={100} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex justify-between">
                    {t("email")}
                    <FormMessage className="h-3.5" />
                  </FormLabel>
                  <FormControl>
                    <Input type="email" placeholder={t("enterEmail")} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Message */}
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex justify-between">
                    {t("message")}
                    <FormMessage className="h-3.5" />
                  </FormLabel>
                  <FormControl>
                    <textarea
                      placeholder={t("enterMessage")}
                      rows={6}
                      className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none md:text-sm"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Attachments */}
            <div className="space-y-2">
              <span className="text-sm font-medium">{t("attachments")}</span>
              <div className="flex flex-wrap gap-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.filename}
                    className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-md text-sm"
                  >
                    <Paperclip className="size-3.5" />
                    <span className="max-w-[150px] truncate">{attachment.filename}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.filename)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_FILE_TYPES.join(",")}
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="size-4 mr-2" />
                {t("addAttachment")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("maxFileSize")}</p>
            </div>

            {/* Submit */}
            <Button type="submit" disabled={submitMutation.isPending} className="w-full">
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  {t("submitting")}
                </>
              ) : (
                <>
                  <Send className="size-4 mr-2" />
                  {t("submit")}
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix to get just the base64
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
